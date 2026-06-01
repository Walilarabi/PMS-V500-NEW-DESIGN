-- Fix: closure_step_3_recouchants used invalid prestation status 'confirmed'.
-- Sprint 1 smoke test T8: prestations_status_check only allows active/cancelled/invoiced.

CREATE OR REPLACE FUNCTION public.closure_step_3_recouchants(p_closure_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closure       record;
  v_hotel_id      uuid;
  v_closure_date  date;
  v_count         int := 0;
  v_total_amount  numeric := 0;
  v_res           record;
  v_rate          numeric;
  v_prestation_id uuid;
BEGIN
  SELECT * INTO v_closure FROM public.closure_workflow WHERE id = p_closure_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Closure not found');
  END IF;

  v_hotel_id     := v_closure.hotel_id;
  v_closure_date := v_closure.closure_date;

  -- Process in-house reservations (check_in <= closure_date < check_out)
  FOR v_res IN
    SELECT r.id, r.room_id, r.guest_id, r.hotel_id,
           COALESCE(rp.price_per_night, 0) AS nightly_rate
    FROM public.reservations r
    LEFT JOIN public.rate_plans rp
           ON rp.hotel_id = r.hotel_id
          AND rp.id = r.rate_plan_id
    WHERE r.hotel_id = v_hotel_id
      AND r.status   = 'checked_in'
      AND r.check_in <= v_closure_date
      AND r.check_out > v_closure_date
  LOOP
    v_rate := COALESCE(v_res.nightly_rate, 0);

    -- Idempotency: skip if prestation already created for this closure+reservation
    IF EXISTS (
      SELECT 1 FROM public.prestations
      WHERE hotel_id    = v_hotel_id
        AND reservation_id = v_res.id
        AND closure_id  = p_closure_id
        AND type        = 'nuitee'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.prestations (
      hotel_id, reservation_id, guest_id, closure_id,
      type, label, service_date,
      unit_price, quantity,
      status
    ) VALUES (
      v_hotel_id, v_res.id, v_res.guest_id, p_closure_id,
      'nuitee', 'Nuitée ' || v_closure_date, v_closure_date,
      v_rate, 1,
      'active'   -- was incorrectly 'confirmed' — only active/cancelled/invoiced allowed
    )
    RETURNING id INTO v_prestation_id;

    v_count        := v_count + 1;
    v_total_amount := v_total_amount + v_rate;
  END LOOP;

  RETURN jsonb_build_object(
    'success',            true,
    'recouchants_created', v_count,
    'total_amount',        v_total_amount
  );
END;
$$;
