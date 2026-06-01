-- S2-3: Checkout guard — blocage DB + RPC sécurisé
-- Règles: facture obligatoire, balance = 0, avoirs émis pris en compte.
-- Deux couches: trigger (backstop pour UPDATE directs) + RPC (API propre).

-- ─── Trigger BEFORE UPDATE ────────────────────────────────────────────────────
-- Fires on ANY reservation UPDATE that transitions status → checked_out.
-- SECURITY DEFINER: reads invoices/credit_notes bypassing RLS for reliability.
-- Blocks direct Supabase client updates (T8) and any non-RPC path.

CREATE OR REPLACE FUNCTION public.trg_fn_reservation_checkout_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_inv_count  int;
  v_outstanding_bal  numeric;
  v_has_any_invoice  boolean;
  v_has_draft        boolean;
BEGIN
  -- Only intercept transitions TO checked_out
  IF NOT (OLD.status <> 'checked_out' AND NEW.status = 'checked_out') THEN
    RETURN NEW;
  END IF;

  -- Guard 1: any invoice at all?
  SELECT EXISTS(
    SELECT 1 FROM public.invoices WHERE reservation_id = NEW.id
  ) INTO v_has_any_invoice;

  IF NOT v_has_any_invoice THEN
    RAISE EXCEPTION 'CHECKOUT_BLOCKED:no_invoice:Aucune facture liée à cette réservation.';
  END IF;

  -- Guard 2: at least one valid invoice (issued/sent/paid)?
  SELECT COUNT(*) INTO v_valid_inv_count
  FROM public.invoices
  WHERE reservation_id = NEW.id
    AND status IN ('issued', 'sent', 'paid');

  IF v_valid_inv_count = 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM public.invoices WHERE reservation_id = NEW.id AND status = 'draft'
    ) INTO v_has_draft;

    IF v_has_draft THEN
      RAISE EXCEPTION 'CHECKOUT_BLOCKED:draft_invoice_only:La facture est en brouillon. Veuillez l''émettre avant le départ.';
    ELSE
      RAISE EXCEPTION 'CHECKOUT_BLOCKED:voided_invoice_only:Toutes les factures sont annulées ou résiliées. Veuillez créer une facture valide.';
    END IF;
  END IF;

  -- Guard 3: outstanding balance across all valid invoices (deduct issued credit notes)
  SELECT COALESCE(SUM(
    GREATEST(0,
      COALESCE(inv.total_ttc, 0)
      - COALESCE(inv.paid_amount, 0)
      - COALESCE((
          SELECT SUM(cn.total_ttc)
          FROM public.credit_notes cn
          WHERE cn.original_invoice_id = inv.id
            AND cn.status = 'issued'
        ), 0)
    )
  ), 0) INTO v_outstanding_bal
  FROM public.invoices inv
  WHERE inv.reservation_id = NEW.id
    AND inv.status IN ('issued', 'sent', 'paid');

  IF v_outstanding_bal > 0 THEN
    RAISE EXCEPTION
      'CHECKOUT_BLOCKED:balance_due:Solde restant dû : % €. Veuillez encaisser le paiement ou appliquer un acompte avant le départ.',
      v_outstanding_bal;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_checkout_guard ON public.reservations;
CREATE TRIGGER trg_reservation_checkout_guard
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_reservation_checkout_guard();

-- ─── checkout_reservation RPC ─────────────────────────────────────────────────
-- Pre-validates billing and returns structured JSON errors (T9).
-- On success: UPDATE triggers the guard above (double-validation), then writes
-- a specific CHECKOUT audit entry for T11.

CREATE OR REPLACE FUNCTION public.checkout_reservation(
  p_reservation_id  uuid,
  p_expected_version int DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id         uuid := get_user_hotel_id();
  v_actor_id         uuid;
  v_res              record;
  v_valid_inv_count  int;
  v_outstanding_bal  numeric;
  v_has_any_invoice  boolean;
  v_has_draft        boolean;
BEGIN
  IF v_hotel_id IS NULL THEN RAISE EXCEPTION 'Accès non autorisé'; END IF;
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  -- Lock reservation
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found',
      'error', 'Réservation introuvable');
  END IF;
  IF v_res.hotel_id <> v_hotel_id THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF v_res.status <> 'checked_in' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_status',
      'error', 'La réservation doit être en statut checked_in pour effectuer le départ',
      'current_status', v_res.status);
  END IF;
  IF p_expected_version IS NOT NULL AND v_res.version <> p_expected_version THEN
    RETURN jsonb_build_object('success', false, 'reason', 'version_conflict',
      'error', 'Conflit de version — rechargez et réessayez',
      'current_version', v_res.version);
  END IF;

  -- Guard 1: any invoice?
  SELECT EXISTS(SELECT 1 FROM public.invoices WHERE reservation_id = p_reservation_id)
  INTO v_has_any_invoice;
  IF NOT v_has_any_invoice THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_invoice',
      'error', 'Aucune facture liée à cette réservation. Veuillez créer et émettre une facture avant le départ.');
  END IF;

  -- Guard 2: valid invoice?
  SELECT COUNT(*) INTO v_valid_inv_count
  FROM public.invoices
  WHERE reservation_id = p_reservation_id
    AND status IN ('issued', 'sent', 'paid');

  IF v_valid_inv_count = 0 THEN
    SELECT EXISTS(SELECT 1 FROM public.invoices WHERE reservation_id = p_reservation_id AND status = 'draft')
    INTO v_has_draft;
    IF v_has_draft THEN
      RETURN jsonb_build_object('success', false, 'reason', 'draft_invoice_only',
        'error', 'La facture est en brouillon. Veuillez l''émettre avant le départ.');
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'voided_invoice_only',
      'error', 'Toutes les factures sont annulées ou résiliées. Veuillez créer une facture valide.');
  END IF;

  -- Guard 3: balance (valid invoices minus issued credit notes)
  SELECT COALESCE(SUM(
    GREATEST(0,
      COALESCE(inv.total_ttc, 0)
      - COALESCE(inv.paid_amount, 0)
      - COALESCE((
          SELECT SUM(cn.total_ttc) FROM public.credit_notes cn
          WHERE cn.original_invoice_id = inv.id AND cn.status = 'issued'
        ), 0)
    )
  ), 0) INTO v_outstanding_bal
  FROM public.invoices inv
  WHERE inv.reservation_id = p_reservation_id
    AND inv.status IN ('issued', 'sent', 'paid');

  IF v_outstanding_bal > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'balance_due',
      'error', 'Solde restant dû. Veuillez encaisser le paiement ou appliquer un acompte avant le départ.',
      'outstanding_balance', v_outstanding_bal);
  END IF;

  -- All guards passed — UPDATE (trigger re-validates as final backstop)
  UPDATE public.reservations
  SET status                = 'checked_out',
      last_status_change_at = now(),
      updated_at            = now()
  WHERE id = p_reservation_id;

  -- Business-level checkout audit entry (richer than generic audit_trigger_fn diff)
  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'reservation', p_reservation_id, 'CHECKOUT',
    jsonb_build_object(
      'previous_status', v_res.status,
      'checked_out_at',  now(),
      'version',         v_res.version,
      'reservation_ref', v_res.reference
    ));

  RETURN jsonb_build_object(
    'success',        true,
    'reservation_id', p_reservation_id,
    'checked_out_at', now()
  );
END;
$$;
