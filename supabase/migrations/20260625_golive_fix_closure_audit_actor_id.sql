-- Correctif : closure_step_4/6/7/8 et closure_rollback passaient auth.uid()
-- directement dans audit_logs.actor_user_id, mais ce champ référence public.users.id
-- (FK audit_logs_actor_user_id_fkey → public.users.id), pas auth.users.id.
-- Fix : résoudre auth.uid() → public.users.id via get_actor_user_id().

CREATE OR REPLACE FUNCTION public.get_actor_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ── closure_step_4_backup ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.closure_step_4_backup(p_closure_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hotel_id uuid; v_res_count int; v_pay_count int; v_pre_count int;
BEGIN
  v_hotel_id := get_user_hotel_id();
  SELECT count(*) INTO v_res_count FROM reservations WHERE hotel_id = v_hotel_id;
  SELECT count(*) INTO v_pay_count FROM payments      WHERE hotel_id = v_hotel_id;
  SELECT count(*) INTO v_pre_count FROM prestations   WHERE hotel_id = v_hotel_id;

  INSERT INTO audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    v_hotel_id, get_actor_user_id(), 'closure', gen_random_uuid(), 'backup_snapshot',
    jsonb_build_object(
      'closure_date',  p_closure_date,
      'reservations',  v_res_count,
      'payments',      v_pay_count,
      'prestations',   v_pre_count
    )
  );

  RETURN jsonb_build_object(
    'step', 4, 'success', true,
    'reservations_snapshot', v_res_count,
    'payments_snapshot',     v_pay_count,
    'prestations_snapshot',  v_pre_count,
    'storage', 'audit_logs'
  );
END;
$$;

-- ── closure_step_6_reports ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.closure_step_6_reports(p_closure_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hotel_id uuid;
BEGIN
  v_hotel_id := get_user_hotel_id();
  INSERT INTO audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    v_hotel_id, get_actor_user_id(), 'closure', gen_random_uuid(), 'reports_marked_ready',
    jsonb_build_object(
      'closure_date', p_closure_date,
      'reports', ARRAY['12001_mc_prestations', '12003_mc_reglements', '12006_position_encours']
    )
  );
  RETURN jsonb_build_object(
    'step', 6, 'success', true,
    'reports_ready', ARRAY['12001', '12003', '12006']
  );
END;
$$;

-- ── closure_step_7_date_change ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.closure_step_7_date_change(p_closure_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hotel_id uuid; v_next_date date;
BEGIN
  v_hotel_id := get_user_hotel_id();
  v_next_date := p_closure_date + 1;

  INSERT INTO audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    v_hotel_id, get_actor_user_id(), 'closure', gen_random_uuid(), 'hotel_date_advanced',
    jsonb_build_object('from', p_closure_date, 'to', v_next_date)
  );
  RETURN jsonb_build_object(
    'step', 7, 'success', true,
    'previous_date', p_closure_date,
    'next_date',     v_next_date
  );
END;
$$;

-- ── closure_step_8_fiscal_lock ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.closure_step_8_fiscal_lock(p_closure_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id        uuid;
  v_tva_snap        public.tva_snapshots;
  v_is_month_end    boolean;
  v_locked_invoices int;
BEGIN
  v_hotel_id     := get_user_hotel_id();
  v_is_month_end := (p_closure_date =
    (date_trunc('month', p_closure_date) + INTERVAL '1 month - 1 day')::date);

  IF v_is_month_end THEN
    v_tva_snap := public.generate_tva_snapshot(
      EXTRACT(YEAR  FROM p_closure_date)::int,
      EXTRACT(MONTH FROM p_closure_date)::int
    );
  END IF;

  SELECT count(*) INTO v_locked_invoices
  FROM invoices
  WHERE hotel_id = v_hotel_id
    AND issue_date <= p_closure_date
    AND COALESCE(status, '') NOT IN ('voided');

  INSERT INTO audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    v_hotel_id, get_actor_user_id(), 'closure', gen_random_uuid(), 'fiscal_lock_applied',
    jsonb_build_object(
      'closure_date',    p_closure_date,
      'is_month_end',    v_is_month_end,
      'tva_snapshot_id', v_tva_snap.id,
      'fiscal_stamp',    v_tva_snap.fiscal_stamp,
      'invoices_count',  v_locked_invoices
    )
  );

  RETURN jsonb_build_object(
    'step', 8, 'success', true,
    'is_month_end',    v_is_month_end,
    'tva_snapshot_id', v_tva_snap.id,
    'fiscal_stamp',    v_tva_snap.fiscal_stamp,
    'invoices_locked', v_locked_invoices
  );
END;
$$;

-- ── closure_rollback ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.closure_rollback(p_closure_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id             uuid;
  v_workflow             public.closure_workflow;
  v_reverted_recouchants int := 0;
  v_reverted_noshows     int := 0;
BEGIN
  v_hotel_id := get_user_hotel_id();
  SELECT * INTO v_workflow FROM closure_workflow
  WHERE id = p_closure_id AND hotel_id = v_hotel_id;
  IF v_workflow IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  IF v_workflow.state = 'completed' AND v_workflow.step_current = 8 THEN
    RAISE EXCEPTION 'Rollback impossible : verrouillage fiscal effectué';
  END IF;

  IF v_workflow.step_current >= 3 THEN
    DELETE FROM prestations
    WHERE hotel_id = v_hotel_id
      AND prestation_date = v_workflow.closure_date
      AND code = 'NUITEE'
      AND label LIKE 'Recouchant %';
    GET DIAGNOSTICS v_reverted_recouchants = ROW_COUNT;
  END IF;

  IF v_workflow.step_current >= 2 THEN
    UPDATE reservations
    SET status = 'confirmed', no_show_at = NULL
    WHERE hotel_id = v_hotel_id
      AND status = 'no_show'
      AND no_show_at::date = v_workflow.closure_date;
    GET DIAGNOSTICS v_reverted_noshows = ROW_COUNT;
  END IF;

  UPDATE closure_workflow
  SET state = 'rolled_back', finished_at = now(),
      notes = COALESCE(notes, '') || ' [Rollback exécuté à ' || now()::text || ']'
  WHERE id = p_closure_id;

  INSERT INTO audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (v_hotel_id, get_actor_user_id(), 'closure', p_closure_id, 'rollback',
    jsonb_build_object(
      'recouchants_reverted', v_reverted_recouchants,
      'noshows_reverted',     v_reverted_noshows
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'recouchants_reverted', v_reverted_recouchants,
    'noshows_reverted',     v_reverted_noshows
  );
END;
$$;
