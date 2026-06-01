-- S2-2: Avoirs / Credit notes — schema + RPCs atomiques
-- State machine: draft → issued (immutable) → voided (traced, never deleted)
-- Guarantees: hotel isolation, unique numbering, amount cap, audit trail, immutability trigger.

-- ─── Schema additions ─────────────────────────────────────────────────────────

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS deposit_id  uuid REFERENCES public.deposits(id),
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

-- Unique credit_note_number per hotel — prevents race condition double-numbering
ALTER TABLE public.credit_notes
  DROP CONSTRAINT IF EXISTS credit_notes_number_unique;
ALTER TABLE public.credit_notes
  ADD CONSTRAINT credit_notes_number_unique UNIQUE(hotel_id, credit_note_number);

-- ─── Immutability trigger ─────────────────────────────────────────────────────
-- Once issued: only status→voided allowed; amounts/reason/number are frozen.
-- Once voided: no further updates permitted.

CREATE OR REPLACE FUNCTION public.trg_fn_credit_notes_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'issued' THEN
    IF NEW.status NOT IN ('issued', 'voided') THEN
      RAISE EXCEPTION 'Transition invalide pour un avoir émis: % → %', OLD.status, NEW.status;
    END IF;
    IF NEW.total_ttc            <> OLD.total_ttc
       OR NEW.total_ht          <> OLD.total_ht
       OR NEW.total_tva         <> OLD.total_tva
       OR NEW.reason            <> OLD.reason
       OR NEW.credit_note_number <> OLD.credit_note_number THEN
      RAISE EXCEPTION 'Un avoir émis est immutable : montants, raison et numéro ne peuvent être modifiés';
    END IF;
  END IF;
  IF OLD.status = 'voided' THEN
    RAISE EXCEPTION 'Un avoir annulé ne peut être modifié';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_notes_immutable ON public.credit_notes;
CREATE TRIGGER trg_credit_notes_immutable
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_credit_notes_immutable();

-- ─── create_credit_note ───────────────────────────────────────────────────────
-- Atomically generates number + inserts draft.
-- Guards: invoice belongs to hotel, total_ttc ≤ remaining refundable.

CREATE OR REPLACE FUNCTION public.create_credit_note(
  p_invoice_id      uuid,
  p_total_ttc       numeric,
  p_reason          text,
  p_total_ht        numeric  DEFAULT NULL,
  p_total_tva       numeric  DEFAULT 0,
  p_notes           text     DEFAULT NULL,
  p_deposit_id      uuid     DEFAULT NULL,
  p_reservation_id  uuid     DEFAULT NULL,
  p_guest_id        uuid     DEFAULT NULL,
  p_bill_to_name    text     DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id         uuid := get_user_hotel_id();
  v_actor_id         uuid;
  v_inv              record;
  v_already_credited numeric;
  v_max_refundable   numeric;
  v_cn_number        text;
  v_cn_id            uuid;
  v_total_ht         numeric;
BEGIN
  IF v_hotel_id IS NULL THEN RAISE EXCEPTION 'Accès non autorisé'; END IF;

  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  -- Amount guards
  IF p_total_ttc <= 0 THEN
    RAISE EXCEPTION 'Le montant de l''avoir doit être positif (reçu: %)', p_total_ttc;
  END IF;
  IF COALESCE(p_total_tva, 0) < 0 THEN
    RAISE EXCEPTION 'total_tva ne peut être négatif';
  END IF;

  -- total_ht defaults to total_ttc - total_tva if not provided
  v_total_ht := COALESCE(p_total_ht, p_total_ttc - COALESCE(p_total_tva, 0));
  IF v_total_ht < 0 THEN
    RAISE EXCEPTION 'total_ht ne peut être négatif';
  END IF;

  -- Validate + lock invoice (FOR SHARE: reads consistent, allows concurrent reads)
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable: %', p_invoice_id;
  END IF;
  IF v_inv.hotel_id IS NOT NULL AND v_inv.hotel_id <> v_hotel_id THEN
    RAISE EXCEPTION 'Accès non autorisé à la facture';
  END IF;

  -- Compute remaining refundable: invoice.total_ttc - (draft + issued credit notes)
  SELECT COALESCE(SUM(cn.total_ttc), 0) INTO v_already_credited
  FROM public.credit_notes cn
  WHERE cn.original_invoice_id = p_invoice_id
    AND cn.status IN ('draft', 'issued');

  v_max_refundable := COALESCE(v_inv.total_ttc, 0) - v_already_credited;

  IF p_total_ttc > v_max_refundable THEN
    RAISE EXCEPTION
      'Montant avoir (%) dépasse le remboursable (%). Déjà couvert par avoirs: %',
      p_total_ttc, v_max_refundable, v_already_credited;
  END IF;

  -- Atomic number generation (sequence increment inside transaction)
  v_cn_number := public.next_credit_note_number(v_hotel_id);

  INSERT INTO public.credit_notes (
    hotel_id, credit_note_number, original_invoice_id,
    reservation_id, guest_id, deposit_id,
    total_ht, total_tva, total_ttc,
    reason, notes, bill_to_name,
    status, created_by
  ) VALUES (
    v_hotel_id, v_cn_number, p_invoice_id,
    p_reservation_id, p_guest_id, p_deposit_id,
    v_total_ht, COALESCE(p_total_tva, 0), p_total_ttc,
    p_reason, p_notes, p_bill_to_name,
    'draft', auth.uid()
  ) RETURNING id INTO v_cn_id;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'credit_note', v_cn_id, 'CREATE',
    jsonb_build_object(
      'credit_note_number', v_cn_number,
      'invoice_id',         p_invoice_id,
      'total_ttc',          p_total_ttc,
      'reason',             p_reason,
      'deposit_id',         p_deposit_id
    ));

  RETURN v_cn_id;
END;
$$;

-- ─── issue_credit_note ────────────────────────────────────────────────────────
-- Transitions draft → issued. Once issued, immutability trigger locks the record.

CREATE OR REPLACE FUNCTION public.issue_credit_note(
  p_credit_note_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := get_user_hotel_id();
  v_actor_id uuid;
  v_cn       record;
BEGIN
  IF v_hotel_id IS NULL THEN RAISE EXCEPTION 'Accès non autorisé'; END IF;
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  SELECT * INTO v_cn FROM public.credit_notes WHERE id = p_credit_note_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Avoir introuvable');
  END IF;
  IF v_cn.hotel_id <> v_hotel_id THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF v_cn.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'L''avoir doit être en brouillon pour être émis', 'current_status', v_cn.status);
  END IF;

  UPDATE public.credit_notes
  SET status = 'issued', issued_at = now(), updated_at = now()
  WHERE id = p_credit_note_id;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'credit_note', p_credit_note_id, 'ISSUE',
    jsonb_build_object(
      'credit_note_number', v_cn.credit_note_number,
      'total_ttc',          v_cn.total_ttc,
      'invoice_id',         v_cn.original_invoice_id
    ));

  RETURN jsonb_build_object(
    'success',            true,
    'credit_note_id',     p_credit_note_id,
    'credit_note_number', v_cn.credit_note_number
  );
END;
$$;

-- ─── void_credit_note ─────────────────────────────────────────────────────────
-- Valid transitions: draft → voided, issued → voided.
-- Never deletes. Records voided_at, voided_by, void_reason.

CREATE OR REPLACE FUNCTION public.void_credit_note(
  p_credit_note_id uuid,
  p_reason         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := get_user_hotel_id();
  v_actor_id uuid;
  v_cn       record;
BEGIN
  IF v_hotel_id IS NULL THEN RAISE EXCEPTION 'Accès non autorisé'; END IF;
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  SELECT * INTO v_cn FROM public.credit_notes WHERE id = p_credit_note_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Avoir introuvable');
  END IF;
  IF v_cn.hotel_id <> v_hotel_id THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF v_cn.status = 'voided' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Avoir déjà annulé');
  END IF;
  IF v_cn.status NOT IN ('draft', 'issued') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Transition invalide', 'current_status', v_cn.status);
  END IF;

  UPDATE public.credit_notes
  SET status      = 'voided',
      voided_at   = now(),
      voided_by   = auth.uid(),
      void_reason = p_reason,
      updated_at  = now()
  WHERE id = p_credit_note_id;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, v_actor_id, 'credit_note', p_credit_note_id, 'VOID',
    jsonb_build_object(
      'credit_note_number', v_cn.credit_note_number,
      'previous_status',    v_cn.status,
      'void_reason',        p_reason,
      'total_ttc',          v_cn.total_ttc
    ));

  RETURN jsonb_build_object(
    'success',         true,
    'credit_note_id',  p_credit_note_id,
    'previous_status', v_cn.status
  );
END;
$$;
