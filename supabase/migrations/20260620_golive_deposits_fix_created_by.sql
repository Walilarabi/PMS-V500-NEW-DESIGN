-- Fix: create_deposit used v_actor_id (public.users.id) for deposits.created_by,
-- but that FK references auth.users.id. Use auth.uid() directly.
-- v_actor_id is still used for audit_logs.actor_user_id → public.users.id (correct).

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
