-- Fix: apply_deposit_to_invoice silently capped paid_amount via LEAST() when deposit > invoice balance.
-- This left deposits.applied_amount > actual amount credited → reconciliation mismatch.
-- New behaviour: refuse explicitly when v_apply_amount > remaining invoice balance.
-- Caller must split the deposit (partial apply) or issue a credit note for the surplus.

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
      'apply_amount',    v_apply_amount,
      'invoice_balance', v_new_balance,
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
