-- =============================================================================
-- MODULE ANALYSE — Schéma SQL autonome (Supabase / PostgreSQL)
-- Extrait de FLOWTYM PMS pour injection dans un projet tiers.
-- =============================================================================
--
-- PRÉREQUIS (doivent exister dans le projet cible AVANT ce script) :
--
--   1. Fonction helper RLS :
--        public.get_user_hotel_id() RETURNS uuid
--      Retourne l'UUID de l'hôtel de l'utilisateur courant (multi-tenant).
--      Utilisée par TOUTES les policies RLS ci-dessous et par
--      evaluate_alert_watchers(). Si ton projet n'est pas multi-hôtel,
--      remplace les `hotel_id = public.get_user_hotel_id()` par ta propre
--      logique de scoping (ex: `true`, ou un filtre sur auth.uid()).
--
--   2. Extension uuid (gen_random_uuid) — standard sur Supabase.
--
--   3. Auth Supabase active (auth.uid()).
--
-- TABLES CRÉÉES (5) :
--   analysis_alert_watchers   — seuils de surveillance KPI
--   analysis_alert_triggers   — historique des déclenchements (inbox)
--   analysis_user_favorites   — favoris rapports par utilisateur
--   analysis_user_recent      — rapports récemment consultés
--   analysis_saved_views      — vues/filtres sauvegardés
--
-- FONCTIONS RPC CRÉÉES (2) :
--   push_user_recent(p_report_id TEXT)  — appelée par report-prefs.service.ts
--   evaluate_alert_watchers()           — appelée par alerts.service.ts
--
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Tables analysis_* + RLS + push_user_recent()
-- ─────────────────────────────────────────────────────────────────────────────

-- analysis_alert_watchers — KPI threshold monitors
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_alert_watchers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  metric              TEXT NOT NULL,
  operator            TEXT NOT NULL CHECK (operator IN ('<','<=','>','>=','=')),
  threshold           NUMERIC NOT NULL,
  period              TEXT NOT NULL CHECK (period IN ('today','last_7d','last_30d')),
  severity            TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  enabled             BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  last_evaluated_at   TIMESTAMPTZ,
  last_triggered_at   TIMESTAMPTZ,
  last_value          NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_watchers_hotel   ON public.analysis_alert_watchers(hotel_id);
CREATE INDEX IF NOT EXISTS idx_alert_watchers_enabled ON public.analysis_alert_watchers(hotel_id, enabled);

ALTER TABLE public.analysis_alert_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_watchers_select_own ON public.analysis_alert_watchers
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_watchers_insert_own ON public.analysis_alert_watchers
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_watchers_update_own ON public.analysis_alert_watchers
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_watchers_delete_own ON public.analysis_alert_watchers
  FOR DELETE USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_alert_triggers — alert trigger history (append-only inbox)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_alert_triggers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watcher_id       UUID NOT NULL REFERENCES public.analysis_alert_watchers(id) ON DELETE CASCADE,
  hotel_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  value            NUMERIC NOT NULL,
  threshold        NUMERIC NOT NULL,
  message          TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  acknowledged     BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_hotel        ON public.analysis_alert_triggers(hotel_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_watcher      ON public.analysis_alert_triggers(watcher_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_unacknowledged ON public.analysis_alert_triggers(hotel_id, acknowledged) WHERE acknowledged = false;

ALTER TABLE public.analysis_alert_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_triggers_select_own ON public.analysis_alert_triggers
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_triggers_insert_own ON public.analysis_alert_triggers
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_triggers_update_own ON public.analysis_alert_triggers
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_user_favorites — per-user report favorites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_user_favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analysis_user_favorites_unique UNIQUE (user_id, hotel_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user  ON public.analysis_user_favorites(user_id, hotel_id);

ALTER TABLE public.analysis_user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_favorites_own ON public.analysis_user_favorites
  FOR ALL
  USING (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id())
  WITH CHECK (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_user_recent — per-user recent report visits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_user_recent (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id   TEXT NOT NULL,
  visited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analysis_user_recent_unique UNIQUE (user_id, hotel_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_user_recent_user ON public.analysis_user_recent(user_id, hotel_id, visited_at DESC);

ALTER TABLE public.analysis_user_recent ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_recent_own ON public.analysis_user_recent
  FOR ALL
  USING (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id())
  WITH CHECK (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id());

-- RPC: upsert + truncate to MAX_RECENT=10 (called fire-and-forget by pushRecent)
CREATE OR REPLACE FUNCTION public.push_user_recent(p_report_id TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hotel_id UUID := public.get_user_hotel_id();
BEGIN
  IF v_user_id IS NULL OR v_hotel_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.analysis_user_recent (user_id, hotel_id, report_id, visited_at)
  VALUES (v_user_id, v_hotel_id, p_report_id, now())
  ON CONFLICT (user_id, hotel_id, report_id) DO UPDATE SET visited_at = now();

  -- Keep only the 10 most recent
  DELETE FROM public.analysis_user_recent
  WHERE user_id = v_user_id AND hotel_id = v_hotel_id
    AND id NOT IN (
      SELECT id FROM public.analysis_user_recent
      WHERE user_id = v_user_id AND hotel_id = v_hotel_id
      ORDER BY visited_at DESC
      LIMIT 10
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.push_user_recent(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.push_user_recent(TEXT) FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_saved_views — saved filter/view configurations per user+hotel
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_saved_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  filters    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user   ON public.analysis_saved_views(user_id, hotel_id, report_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_updated ON public.analysis_saved_views(hotel_id, updated_at DESC);

ALTER TABLE public.analysis_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_views_own ON public.analysis_saved_views
  FOR ALL
  USING (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id())
  WITH CHECK (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- hk_staff — housekeeping team members
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Fonction RPC evaluate_alert_watchers()
-- (référence uniquement analysis_alert_watchers, analysis_alert_triggers
--  et get_user_hotel_id() — voir prérequis)
-- ─────────────────────────────────────────────────────────────────────────────

-- evaluate_alert_watchers RPC — called by alerts.service.ts
-- Evaluates all active watchers for the current hotel and inserts triggers.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.evaluate_alert_watchers()
RETURNS TABLE(
  watcher_id UUID,
  metric     TEXT,
  value      NUMERIC,
  threshold  NUMERIC,
  triggered  BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id UUID := public.get_user_hotel_id();
  v_watcher  RECORD;
  v_value    NUMERIC;
  v_triggered BOOLEAN;
  v_today    DATE := CURRENT_DATE;
BEGIN
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  FOR v_watcher IN
    SELECT * FROM public.analysis_alert_watchers
    WHERE hotel_id = v_hotel_id AND enabled = true
  LOOP
    -- Compute metric value based on period and metric type
    v_value := NULL;

    BEGIN
      CASE v_watcher.metric
        WHEN 'occupancy' THEN
          SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE r.status NOT IN ('cancelled'))
            / NULLIF((SELECT COUNT(*) FROM public.rooms WHERE hotel_id = v_hotel_id), 0),
            2
          )
          INTO v_value
          FROM public.reservations r
          WHERE r.hotel_id = v_hotel_id
            AND CASE v_watcher.period
                  WHEN 'today' THEN v_today BETWEEN r.check_in AND r.check_out - INTERVAL '1 day'
                  WHEN 'last_7d' THEN r.check_in >= v_today - INTERVAL '7 days' AND r.check_in <= v_today
                  WHEN 'last_30d' THEN r.check_in >= v_today - INTERVAL '30 days' AND r.check_in <= v_today
                END;
        WHEN 'adr' THEN
          SELECT ROUND(AVG(r.total_amount / NULLIF(r.nights, 0)), 2)
          INTO v_value
          FROM public.reservations r
          WHERE r.hotel_id = v_hotel_id AND r.status NOT IN ('cancelled')
            AND CASE v_watcher.period
                  WHEN 'today' THEN v_today BETWEEN r.check_in AND r.check_out - INTERVAL '1 day'
                  WHEN 'last_7d' THEN r.check_in >= v_today - INTERVAL '7 days'
                  WHEN 'last_30d' THEN r.check_in >= v_today - INTERVAL '30 days'
                END;
        WHEN 'sold_rooms' THEN
          SELECT COUNT(*)
          INTO v_value
          FROM public.reservations r
          WHERE r.hotel_id = v_hotel_id AND r.status NOT IN ('cancelled')
            AND CASE v_watcher.period
                  WHEN 'today' THEN v_today BETWEEN r.check_in AND r.check_out - INTERVAL '1 day'
                  WHEN 'last_7d' THEN r.check_in >= v_today - INTERVAL '7 days'
                  WHEN 'last_30d' THEN r.check_in >= v_today - INTERVAL '30 days'
                END;
        ELSE
          v_value := 0;
      END CASE;
    EXCEPTION WHEN OTHERS THEN
      v_value := 0;
    END;

    v_value := COALESCE(v_value, 0);

    -- Evaluate operator
    v_triggered := CASE v_watcher.operator
      WHEN '<'  THEN v_value <  v_watcher.threshold
      WHEN '<=' THEN v_value <= v_watcher.threshold
      WHEN '>'  THEN v_value >  v_watcher.threshold
      WHEN '>=' THEN v_value >= v_watcher.threshold
      WHEN '='  THEN v_value =  v_watcher.threshold
      ELSE false
    END;

    -- Update last_evaluated_at and last_value
    UPDATE public.analysis_alert_watchers
    SET last_evaluated_at = now(),
        last_value = v_value,
        last_triggered_at = CASE WHEN v_triggered THEN now() ELSE last_triggered_at END
    WHERE id = v_watcher.id;

    -- Insert trigger record when fired
    IF v_triggered THEN
      INSERT INTO public.analysis_alert_triggers (
        watcher_id, hotel_id, triggered_at, value, threshold, message, severity
      ) VALUES (
        v_watcher.id,
        v_hotel_id,
        now(),
        v_value,
        v_watcher.threshold,
        v_watcher.name || ' : ' || v_watcher.metric || ' ' || v_watcher.operator || ' ' || v_watcher.threshold::text || ' (valeur: ' || v_value::text || ')',
        v_watcher.severity
      );
    END IF;

    RETURN QUERY SELECT v_watcher.id, v_watcher.metric, v_value, v_watcher.threshold, v_triggered;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_alert_watchers() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_alert_watchers() FROM anon;
