-- S2-1: Dépôts / Acomptes — RPCs atomiques
-- State machine: pending → captured → released | applied
-- Guarantees: hotel isolation, no double-apply, audit trail, atomic locking.
-- Note: actor_user_id in audit_logs references public.users.id (not auth.uid()).

-- ─── create_deposit ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_deposit(
  p_amount         numeric,
  p_method         text,
  p_deposit_type   text     DEFAULT 'acompte',
  p_reservation_id uuid     DEFAULT NULL,
  p_invoice_id     uuid     DEFAULT NULL,
  p_guest_id       uuid     DEFAULT NULL,
  p_currency       text     DEFAULT 'EUR',
  p_notes          text     DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := get_user_hotel_id();
  v_actor_id uuid;
  v_dep_id   uuid;
BEGIN
  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être positif (reçu: %)', p_amount;
  END IF;

  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  INSERT INTO public.deposits (
    hotel_id, reservation_id, invoice_id, guest_id,
    amount, currency, method, deposit_type, status, notes, created_by
  ) VALUES (
    v_hotel_id, p_reservation_id, p_invoice_id, p_guest_id,
    p_amount, p_currency, p_method, p_deposit_type, 'pending', p_notes, auth.uid()
  ) RETURNING id INTO v_dep_id;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'deposit', v_dep_id, 'CREATE',
    jsonb_build_object('amount', p_amount, 'method', p_method, 'deposit_type', p_deposit_type));

  RETURN v_dep_id;
END;
$$;

-- ─── capture_deposit ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capture_deposit(
  p_deposit_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := get_user_hotel_id();
  v_actor_id uuid;
  v_dep      record;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;
  IF v_dep.hotel_id <> v_hotel_id THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF v_dep.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le dépôt doit être en attente pour être capturé', 'current_status', v_dep.status);
  END IF;

  UPDATE public.deposits SET status = 'captured', captured_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'deposit', p_deposit_id, 'CAPTURE',
    jsonb_build_object('amount', v_dep.amount, 'method', v_dep.method));

  RETURN jsonb_build_object('success', true, 'deposit_id', p_deposit_id);
END;
$$;

-- ─── apply_deposit_to_invoice ────────────────────────────────────────────────
-- Critical: atomic locking prevents double-application.
-- Updates invoices.paid_amount → balance (GENERATED) decreases automatically.

CREATE OR REPLACE FUNCTION public.apply_deposit_to_invoice(
  p_deposit_id     uuid,
  p_invoice_id     uuid,
  p_applied_amount numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id     uuid := get_user_hotel_id();
  v_actor_id     uuid;
  v_dep          record;
  v_inv          record;
  v_apply_amount numeric;
  v_new_paid     numeric;
  v_new_balance  numeric;
BEGIN
  IF v_hotel_id IS NULL THEN RAISE EXCEPTION 'Accès non autorisé'; END IF;
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  -- Lock deposit row — prevents concurrent double-application
  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;
  IF v_dep.hotel_id <> v_hotel_id THEN
    RAISE EXCEPTION 'Accès non autorisé au dépôt';
  END IF;
  IF v_dep.status <> 'captured' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le dépôt doit être capturé avant imputation', 'current_status', v_dep.status);
  END IF;

  -- Lock invoice
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facture introuvable');
  END IF;
  IF v_inv.hotel_id IS NOT NULL AND v_inv.hotel_id <> v_dep.hotel_id THEN
    RAISE EXCEPTION 'Le dépôt et la facture appartiennent à des hôtels différents';
  END IF;
  IF v_inv.status NOT IN ('draft', 'issued', 'sent') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'La facture ne peut pas recevoir d''imputation', 'invoice_status', v_inv.status);
  END IF;

  v_apply_amount := COALESCE(p_applied_amount, v_dep.amount);
  IF v_apply_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant d''imputation doit être positif');
  END IF;
  IF v_apply_amount > v_dep.amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le montant d''imputation dépasse le dépôt', 'deposit_amount', v_dep.amount);
  END IF;

  -- Guard: refuse if applied amount exceeds remaining invoice balance (prevents silent over-payment).
  -- Caller must either split the deposit or issue a credit note for the surplus.
  v_new_balance := COALESCE(v_inv.total_ttc, 0) - COALESCE(v_inv.paid_amount, 0);
  IF v_apply_amount > v_new_balance THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le montant d''imputation dépasse le solde restant de la facture',
      'apply_amount',       v_apply_amount,
      'invoice_balance',    v_new_balance,
      'hint', 'Utilisez p_applied_amount = ' || v_new_balance || ' pour imputer exactement le solde');
  END IF;

  UPDATE public.deposits SET
    status                = 'applied',
    applied_to_invoice_id = p_invoice_id,
    applied_amount        = v_apply_amount,
    applied_at            = now()
  WHERE id = p_deposit_id;

  v_new_paid    := COALESCE(v_inv.paid_amount, 0) + v_apply_amount;
  v_new_balance := COALESCE(v_inv.total_ttc, 0) - v_new_paid;
  UPDATE public.invoices SET paid_amount = v_new_paid WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'deposit', p_deposit_id, 'APPLY',
    jsonb_build_object(
      'invoice_id',          p_invoice_id,
      'applied_amount',      v_apply_amount,
      'invoice_paid_amount', v_new_paid,
      'invoice_balance',     v_new_balance
    ));

  RETURN jsonb_build_object(
    'success',         true,
    'deposit_id',      p_deposit_id,
    'invoice_id',      p_invoice_id,
    'applied_amount',  v_apply_amount,
    'invoice_balance', v_new_balance
  );
END;
$$;

-- ─── release_deposit ─────────────────────────────────────────────────────────
-- Valid transitions: pending → released, captured → released.
-- Blocked: applied → cannot release (would corrupt accounting).

CREATE OR REPLACE FUNCTION public.release_deposit(
  p_deposit_id uuid,
  p_notes      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := get_user_hotel_id();
  v_actor_id uuid;
  v_dep      record;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;
  IF v_dep.hotel_id <> v_hotel_id THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF v_dep.status = 'applied' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Impossible de libérer un dépôt déjà imputé sur facture', 'current_status', 'applied');
  END IF;
  IF v_dep.status = 'released' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt déjà libéré');
  END IF;
  IF v_dep.status NOT IN ('pending', 'captured') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Transition invalide', 'current_status', v_dep.status);
  END IF;

  UPDATE public.deposits SET
    status      = 'released',
    released_at = now(),
    notes       = COALESCE(p_notes, notes)
  WHERE id = p_deposit_id;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'deposit', p_deposit_id, 'RELEASE',
    jsonb_build_object('notes', p_notes, 'previous_status', v_dep.status));

  RETURN jsonb_build_object('success', true, 'deposit_id', p_deposit_id,
    'previous_status', v_dep.status);
END;
$$;
