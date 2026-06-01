-- =============================================================================
-- GO LIVE SPRINT 1 — Closure RPCs + Night Audit
-- =============================================================================
--
-- Résout P0-3 : closure_start / closure_execute_step / closure_rollback
--               → clôture crashait immédiatement (RPCs introuvables)
-- Résout P0-4 : generate_night_audit_lines
--               → nuitées recouchants non facturées automatiquement
--
-- Patch inclus : protect_invoice_financials + recalc_invoice_totals
--   Le trigger recalc (20260613) tente de modifier total_ht/tva/ttc mais
--   protect_invoice_financials l'en empêche. Fix : variable de session
--   app.invoice_recalc_active (LOCAL à la transaction).
--
-- Idempotent : CREATE OR REPLACE pour toutes les fonctions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Patch protect_invoice_financials — autoriser le bypass recalc
--    Remplace la version de 20260613.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_invoice_financials()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Bypass pour recalc_invoice_totals et recalc_invoice_paid (session var LOCAL)
  IF current_setting('app.invoice_recalc_active', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.invoice_number IS DISTINCT FROM NEW.invoice_number THEN
    RAISE EXCEPTION 'INVOICE_LOCKED: Le numéro de facture est immuable.';
  END IF;
  IF OLD.total_ht  IS DISTINCT FROM NEW.total_ht  OR
     OLD.total_tva IS DISTINCT FROM NEW.total_tva OR
     OLD.total_ttc IS DISTINCT FROM NEW.total_ttc
  THEN
    RAISE EXCEPTION 'INVOICE_LOCKED: Les montants HT/TVA/TTC ne sont pas modifiables directement.';
  END IF;
  IF OLD.hotel_id IS DISTINCT FROM NEW.hotel_id THEN
    RAISE EXCEPTION 'INVOICE_LOCKED: L''hôtel d''une facture est immuable.';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 0b. Patch recalc_invoice_totals — signal bypass avant UPDATE invoices
--     Remplace la version de 20260613.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalc_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_ht  NUMERIC(12,2);
  v_tva NUMERIC(12,2);
  v_ttc NUMERIC(12,2);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT
    COALESCE(SUM(total_ht),  0),
    COALESCE(SUM(total_tva), 0),
    COALESCE(SUM(total_ttc), 0)
  INTO v_ht, v_tva, v_ttc
  FROM public.invoice_lines
  WHERE invoice_id = v_invoice_id;

  PERFORM set_config('app.invoice_recalc_active', 'true', true);

  UPDATE public.invoices
  SET total_ht  = v_ht,
      total_tva = v_tva,
      total_ttc = v_ttc,
      updated_at = now()
  WHERE id = v_invoice_id;

  PERFORM set_config('app.invoice_recalc_active', 'false', true);

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. generate_night_audit_lines(p_closure_id UUID) → JSONB
--    Génère les lignes "Nuitée Hébergement" pour toutes les réservations
--    checked_in à la date de clôture.
--    Idempotent : ne duplique pas si une ligne night_audit existe déjà.
--    TVA hébergement France : 10%.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_night_audit_lines(p_closure_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id      UUID;
  v_closure_date  DATE;
  rec             RECORD;
  v_invoice_id    UUID;
  v_folio_id      UUID;
  v_unit_price_ht NUMERIC(12,2);
  v_total_ht      NUMERIC(12,2);
  v_total_tva     NUMERIC(12,2);
  v_total_ttc     NUMERIC(12,2);
  v_lines_created INTEGER       := 0;
  v_total_amount  NUMERIC(12,2) := 0;
  v_warnings      JSONB         := '[]'::JSONB;
  v_already       INTEGER;
BEGIN
  SELECT hotel_id, closure_date
  INTO v_hotel_id, v_closure_date
  FROM public.closure_workflow
  WHERE id = p_closure_id;

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'CLOSURE_NOT_FOUND: Clôture % introuvable.', p_closure_id;
  END IF;

  -- Isolation hôtel (SECURITY DEFINER bypass RLS → vérification manuelle)
  IF v_hotel_id != public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'CLOSURE_FORBIDDEN: Accès refusé.';
  END IF;

  -- Activer le bypass du trigger protect pour les recalcs en cascade
  PERFORM set_config('app.invoice_recalc_active', 'true', true);

  FOR rec IN (
    SELECT
      r.id            AS reservation_id,
      r.total_amount,
      r.nights,
      r.guest_name
    FROM public.reservations r
    WHERE r.hotel_id        = v_hotel_id
      AND r.status          = 'checked_in'
      AND r.check_in::date  <= v_closure_date
      AND r.check_out::date >  v_closure_date
  ) LOOP

    -- Chercher une facture active (draft ou issued) + son folio principal
    SELECT i.id, f.id
    INTO v_invoice_id, v_folio_id
    FROM public.invoices i
    JOIN public.folios   f ON f.invoice_id = i.id
    WHERE i.reservation_id = rec.reservation_id
      AND i.hotel_id       = v_hotel_id
      AND i.status         IN ('draft', 'issued')
    ORDER BY f.folio_order ASC
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'reservation_id', rec.reservation_id,
        'guest_name',     rec.guest_name,
        'message',        'Pas de facture active — nuitée non créée'
      ));
      CONTINUE;
    END IF;

    -- Idempotence : ne pas doubler si la ligne existe déjà
    SELECT COUNT(*) INTO v_already
    FROM public.invoice_lines
    WHERE invoice_id   = v_invoice_id
      AND source       = 'night_audit'
      AND service_date = v_closure_date;

    IF v_already > 0 THEN CONTINUE; END IF;

    -- Prix nuitée : total_amount est TTC, TVA hébergement = 10%
    v_unit_price_ht := ROUND(
      (rec.total_amount / GREATEST(rec.nights::NUMERIC, 1)) / 1.10,
    2);
    v_total_ht  := v_unit_price_ht;
    v_total_tva := ROUND(v_unit_price_ht * 0.10, 2);
    v_total_ttc := v_total_ht + v_total_tva;

    INSERT INTO public.invoice_lines (
      hotel_id,
      folio_id,
      invoice_id,
      product_code,
      description,
      service_date,
      quantity,
      unit_price_ht,
      tva_rate,
      total_ht,
      total_tva,
      total_ttc,
      source
    ) VALUES (
      v_hotel_id,
      v_folio_id,
      v_invoice_id,
      'NUIT',
      'Nuitée Hébergement — ' || to_char(v_closure_date, 'DD/MM/YYYY'),
      v_closure_date,
      1,
      v_unit_price_ht,
      10,
      v_total_ht,
      v_total_tva,
      v_total_ttc,
      'night_audit'
    );

    v_lines_created := v_lines_created + 1;
    v_total_amount  := v_total_amount + v_total_ttc;
  END LOOP;

  PERFORM set_config('app.invoice_recalc_active', 'false', true);

  RETURN jsonb_build_object(
    'lines_created', v_lines_created,
    'total_amount',  v_total_amount,
    'warnings',      v_warnings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_night_audit_lines(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_night_audit_lines(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. closure_start(p_closure_date DATE) → UUID
--    Crée ou reprend une entrée closure_workflow.
--    Bloque si la clôture est déjà complète.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.closure_start(p_closure_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id   UUID;
  v_closure_id UUID;
  v_existing   TEXT;
BEGIN
  v_hotel_id := public.get_user_hotel_id();

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'CLOSURE_AUTH: Hôtel introuvable — reconnectez-vous.';
  END IF;

  -- Vérifier une éventuelle clôture existante pour cette date
  SELECT id, state
  INTO v_closure_id, v_existing
  FROM public.closure_workflow
  WHERE hotel_id = v_hotel_id AND closure_date = p_closure_date;

  IF v_existing = 'completed' THEN
    RAISE EXCEPTION 'CLOSURE_DUPLICATE: La clôture du % est déjà complète.', p_closure_date;
  END IF;

  -- Reprendre une clôture en cours (pending ou in_progress)
  IF v_closure_id IS NOT NULL THEN
    RETURN v_closure_id;
  END IF;

  INSERT INTO public.closure_workflow (
    hotel_id,
    closure_date,
    state,
    step_current,
    steps_done,
    steps_errors,
    started_at,
    initiated_by
  ) VALUES (
    v_hotel_id,
    p_closure_date,
    'in_progress',
    0,
    '[]'::JSONB,
    '{}'::JSONB,
    now(),
    auth.uid()
  )
  RETURNING id INTO v_closure_id;

  RETURN v_closure_id;
END;
$$;

REVOKE ALL ON FUNCTION public.closure_start(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.closure_start(DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. closure_execute_step(p_closure_id UUID, p_step INTEGER) → JSONB
--
--   Étape 1 — Pré-contrôles : départs non soldés (warnings uniquement)
--   Étape 2 — No-shows : confirmed → no_show si check_in = closure_date
--   Étape 3 — Recouchants : nuitées via generate_night_audit_lines
--   Étape 4 — Sauvegarde : audit_log snapshot
--   Étape 5 — MC Règlements : totaux par mode de paiement
--   Étape 6 — Impression états : audit_log
--   Étape 7 — Changement date : audit_log date +1
--   Étape 8 — Verrouillage fiscal : snapshot TVA + clôture complète
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.closure_execute_step(
  p_closure_id UUID,
  p_step       INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id      UUID;
  v_closure_date  DATE;
  v_state         TEXT;
  v_step_start    TIMESTAMPTZ := clock_timestamp();
  v_result        JSONB;
  v_warnings      JSONB := '[]'::JSONB;
  v_count         INTEGER := 0;
  v_amount        NUMERIC(12,2) := 0;
  v_night_result  JSONB;
  v_by_method     JSONB;
  rec             RECORD;
BEGIN
  SELECT hotel_id, closure_date, state
  INTO v_hotel_id, v_closure_date, v_state
  FROM public.closure_workflow
  WHERE id = p_closure_id;

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'CLOSURE_NOT_FOUND: Clôture % introuvable.', p_closure_id;
  END IF;

  IF v_hotel_id != public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'CLOSURE_FORBIDDEN: Accès refusé.';
  END IF;

  IF v_state = 'completed' THEN
    RAISE EXCEPTION 'CLOSURE_DONE: Cette clôture est déjà complète.';
  END IF;

  -- ── Étape 1 : Pré-contrôles ──────────────────────────────────────────────
  IF p_step = 1 THEN
    FOR rec IN (
      SELECT r.reference, r.guest_name
      FROM public.reservations r
      LEFT JOIN public.invoices i ON i.reservation_id = r.id
      WHERE r.hotel_id         = v_hotel_id
        AND r.check_out::date  = v_closure_date
        AND r.status           = 'checked_out'
        AND (i.id IS NULL OR COALESCE(i.balance, 0) > 0)
    ) LOOP
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'type', 'unpaid_checkout', 'ref', rec.reference, 'guest', rec.guest_name
      ));
      v_count := v_count + 1;
    END LOOP;

    v_result := jsonb_build_object(
      'step',           1,
      'success',        true,
      'duration_ms',    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at',   now(),
      'warnings',       v_warnings,
      'warnings_count', v_count
    );

  -- ── Étape 2 : Récupération arrivées — marquage no-shows ──────────────────
  ELSIF p_step = 2 THEN
    UPDATE public.reservations
    SET status = 'no_show', updated_at = now()
    WHERE hotel_id         = v_hotel_id
      AND check_in::date   = v_closure_date
      AND status           = 'confirmed';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    v_result := jsonb_build_object(
      'step',           2,
      'success',        true,
      'duration_ms',    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at',   now(),
      'noshows_marked', v_count
    );

  -- ── Étape 3 : Recouchants — génération des nuitées ───────────────────────
  ELSIF p_step = 3 THEN
    v_night_result := public.generate_night_audit_lines(p_closure_id);

    v_result := jsonb_build_object(
      'step',                3,
      'success',             true,
      'duration_ms',         EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at',        now(),
      'recouchants_created', (v_night_result->>'lines_created')::INTEGER,
      'total_amount',        (v_night_result->>'total_amount')::NUMERIC,
      'warnings',            v_night_result->'warnings'
    );

  -- ── Étape 4 : Sauvegarde express ─────────────────────────────────────────
  ELSIF p_step = 4 THEN
    INSERT INTO public.audit_logs (hotel_id, entity, entity_id, action, payload)
    VALUES (
      v_hotel_id, 'closure', p_closure_id::TEXT, 'SNAPSHOT',
      jsonb_build_object('closure_date', v_closure_date, 'timestamp', now())
    );

    v_result := jsonb_build_object(
      'step',         4,
      'success',      true,
      'duration_ms',  EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at', now()
    );

  -- ── Étape 5 : MC Règlements — totaux par mode de paiement ────────────────
  ELSIF p_step = 5 THEN
    SELECT COALESCE(jsonb_object_agg(method, total), '{}')
    INTO v_by_method
    FROM (
      SELECT p.method, SUM(p.amount) AS total
      FROM public.payments p
      JOIN public.invoices i ON i.id = p.invoice_id
      WHERE i.hotel_id            = v_hotel_id
        AND p.status              = 'completed'
        AND p.collected_at::date  = v_closure_date
      GROUP BY p.method
    ) t;

    v_result := jsonb_build_object(
      'step',         5,
      'success',      true,
      'duration_ms',  EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at', now(),
      'by_method',    v_by_method
    );

  -- ── Étape 6 : Impression états ───────────────────────────────────────────
  ELSIF p_step = 6 THEN
    INSERT INTO public.audit_logs (hotel_id, entity, entity_id, action, payload)
    VALUES (
      v_hotel_id, 'closure', p_closure_id::TEXT, 'REPORTS_READY',
      jsonb_build_object('closure_date', v_closure_date, 'timestamp', now())
    );

    v_result := jsonb_build_object(
      'step',         6,
      'success',      true,
      'duration_ms',  EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at', now()
    );

  -- ── Étape 7 : Changement date hôtel +1 ───────────────────────────────────
  ELSIF p_step = 7 THEN
    INSERT INTO public.audit_logs (hotel_id, entity, entity_id, action, payload)
    VALUES (
      v_hotel_id, 'closure', p_closure_id::TEXT, 'DATE_ADVANCE',
      jsonb_build_object(
        'from_date', v_closure_date,
        'to_date',   (v_closure_date + INTERVAL '1 day')::DATE,
        'timestamp', now()
      )
    );

    v_result := jsonb_build_object(
      'step',         7,
      'success',      true,
      'duration_ms',  EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at', now(),
      'new_date',     (v_closure_date + INTERVAL '1 day')::DATE
    );

  -- ── Étape 8 : Verrouillage fiscal ────────────────────────────────────────
  ELSIF p_step = 8 THEN
    SELECT
      COALESCE(SUM(il.total_ht),  0),
      COALESCE(SUM(il.total_tva), 0)
    INTO v_amount, v_count
    FROM public.invoice_lines il
    JOIN public.invoices i ON i.id = il.invoice_id
    WHERE i.hotel_id      = v_hotel_id
      AND il.service_date = v_closure_date;

    INSERT INTO public.audit_logs (hotel_id, entity, entity_id, action, payload)
    VALUES (
      v_hotel_id, 'closure', p_closure_id::TEXT, 'FISCAL_LOCK',
      jsonb_build_object(
        'closure_date', v_closure_date,
        'total_ht',     v_amount,
        'total_tva',    v_count,
        'timestamp',    now()
      )
    );

    UPDATE public.closure_workflow
    SET state        = 'completed',
        step_current = 8,
        steps_done   = steps_done || '[8]'::JSONB,
        finished_at  = now(),
        duration_ms  = EXTRACT(MILLISECONDS FROM now() - started_at)::INTEGER
    WHERE id = p_closure_id;

    RETURN jsonb_build_object(
      'step',         8,
      'success',      true,
      'duration_ms',  EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER,
      'completed_at', now()
    );

  ELSE
    RAISE EXCEPTION 'CLOSURE_STEP_INVALID: Étape % inconnue (1–8 attendu).', p_step;
  END IF;

  -- Mise à jour de l'avancement (hors étape 8 qui gère elle-même)
  UPDATE public.closure_workflow
  SET step_current = p_step,
      steps_done   = steps_done || jsonb_build_array(p_step)
  WHERE id = p_closure_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.closure_execute_step(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.closure_execute_step(UUID, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. closure_rollback(p_closure_id UUID) → JSONB
--    Annule les étapes 2 (no-shows → confirmed) et 3 (supprime les nuitées).
--    Les étapes 4-8 ne sont pas réversibles.
--    Une clôture 'completed' ne peut pas être annulée.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.closure_rollback(p_closure_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id          UUID;
  v_closure_date      DATE;
  v_state             TEXT;
  v_noshows_reverted  INTEGER := 0;
  v_reco_reverted     INTEGER := 0;
BEGIN
  SELECT hotel_id, closure_date, state
  INTO v_hotel_id, v_closure_date, v_state
  FROM public.closure_workflow
  WHERE id = p_closure_id;

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'CLOSURE_NOT_FOUND: Clôture % introuvable.', p_closure_id;
  END IF;

  IF v_hotel_id != public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'CLOSURE_FORBIDDEN: Accès refusé.';
  END IF;

  IF v_state = 'completed' THEN
    RAISE EXCEPTION 'CLOSURE_LOCKED: Une clôture complète ne peut pas être annulée.';
  END IF;

  -- Annuler l'étape 2 : remettre les no-shows en confirmed
  UPDATE public.reservations
  SET status = 'confirmed', updated_at = now()
  WHERE hotel_id        = v_hotel_id
    AND check_in::date  = v_closure_date
    AND status          = 'no_show';

  GET DIAGNOSTICS v_noshows_reverted = ROW_COUNT;

  -- Annuler l'étape 3 : supprimer les lignes night_audit de cette date
  -- (recalc_invoice_totals se déclenchera → bypass protect via set_config)
  PERFORM set_config('app.invoice_recalc_active', 'true', true);

  DELETE FROM public.invoice_lines
  WHERE hotel_id    = v_hotel_id
    AND source      = 'night_audit'
    AND service_date = v_closure_date;

  GET DIAGNOSTICS v_reco_reverted = ROW_COUNT;

  PERFORM set_config('app.invoice_recalc_active', 'false', true);

  -- Remettre la clôture en état rolled_back
  UPDATE public.closure_workflow
  SET state        = 'rolled_back',
      step_current = 0,
      steps_done   = '[]'::JSONB,
      steps_errors = '{}'::JSONB,
      notes        = COALESCE(notes || E'\n', '') || 'Rollback effectué à ' || now()::TEXT
  WHERE id = p_closure_id;

  RETURN jsonb_build_object(
    'noshows_reverted',    v_noshows_reverted,
    'recouchants_reverted', v_reco_reverted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.closure_rollback(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.closure_rollback(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Grants finaux
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.protect_invoice_financials()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_totals()        TO authenticated;
