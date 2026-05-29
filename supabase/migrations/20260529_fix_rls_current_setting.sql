-- ============================================================================
-- SECURITY FIX: Replace current_setting('app.current_tenant_id') RLS policies
-- ============================================================================
--
-- VULNERABILITY (CRITICAL): The original RMS and Market Intelligence migrations
-- used current_setting('app.current_tenant_id') as the tenant isolation predicate.
-- PostgreSQL GUCs (session settings) can be freely set by any client via:
--   SET app.current_tenant_id = '<victim_hotel_uuid>'
-- This allowed any authenticated user to read/write RMS data of other hotels.
--
-- FIX: Drop the vulnerable policies on all affected tables and replace them
-- with get_user_hotel_id() — a SECURITY DEFINER function that derives the
-- hotel from the JWT, which the client cannot spoof.
--
-- Affected tables (from 20260517_rms_module.sql):
--   rms_events, rms_competitors, rms_competitor_pricing,
--   rms_pricing_recommendations, rms_pricing_factors, rms_pricing_applications
-- Affected tables (from 20260601_market_intelligence.sql):
--   mi_recommendations, mi_recommendation_actions, mi_alerts
-- ============================================================================

-- ─── rms_events ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_events_tenant_isolation" ON rms_events;

CREATE POLICY "rms_events_tenant_isolation_v2" ON rms_events
  FOR ALL
  USING (tenant_id = public.get_user_hotel_id())
  WITH CHECK (tenant_id = public.get_user_hotel_id());

-- ─── rms_competitors ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_competitors_tenant_isolation" ON rms_competitors;

CREATE POLICY "rms_competitors_tenant_isolation_v2" ON rms_competitors
  FOR ALL
  USING (tenant_id = public.get_user_hotel_id())
  WITH CHECK (tenant_id = public.get_user_hotel_id());

-- ─── rms_competitor_pricing ───────────────────────────────────────────────────
-- Note: security_phase1 added a USING(true) select policy for "global catalog"
-- rationale. We keep SELECT as hotel-scoped (each hotel's compset is private).

DROP POLICY IF EXISTS "rms_competitor_pricing_tenant_isolation" ON rms_competitor_pricing;
DROP POLICY IF EXISTS "rms_competitor_pricing_select"            ON rms_competitor_pricing;
DROP POLICY IF EXISTS "rms_competitor_pricing_no_write"          ON rms_competitor_pricing;

CREATE POLICY "rms_competitor_pricing_select_v2" ON rms_competitor_pricing
  FOR SELECT
  USING (
    -- Competitor belongs to user's hotel (via rms_competitors)
    competitor_id IN (
      SELECT id FROM rms_competitors
      WHERE tenant_id = public.get_user_hotel_id()
    )
  );

CREATE POLICY "rms_competitor_pricing_insert_platform_admin" ON rms_competitor_pricing
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "rms_competitor_pricing_update_platform_admin" ON rms_competitor_pricing
  FOR UPDATE
  USING (public.is_platform_admin());

CREATE POLICY "rms_competitor_pricing_delete_platform_admin" ON rms_competitor_pricing
  FOR DELETE
  USING (public.is_platform_admin());

-- ─── rms_pricing_recommendations ─────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_pricing_reco_tenant_isolation" ON rms_pricing_recommendations;

CREATE POLICY "rms_pricing_reco_tenant_isolation_v2" ON rms_pricing_recommendations
  FOR ALL
  USING (tenant_id = public.get_user_hotel_id())
  WITH CHECK (tenant_id = public.get_user_hotel_id());

-- ─── rms_pricing_factors ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_pricing_factors_via_recommendation" ON rms_pricing_factors;

CREATE POLICY "rms_pricing_factors_via_recommendation_v2" ON rms_pricing_factors
  FOR ALL
  USING (
    recommendation_id IN (
      SELECT id FROM rms_pricing_recommendations
      WHERE tenant_id = public.get_user_hotel_id()
    )
  )
  WITH CHECK (
    recommendation_id IN (
      SELECT id FROM rms_pricing_recommendations
      WHERE tenant_id = public.get_user_hotel_id()
    )
  );

-- ─── rms_pricing_applications ────────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_pricing_apps_tenant_isolation" ON rms_pricing_applications;

CREATE POLICY "rms_pricing_apps_tenant_isolation_v2" ON rms_pricing_applications
  FOR ALL
  USING (tenant_id = public.get_user_hotel_id())
  WITH CHECK (tenant_id = public.get_user_hotel_id());

-- ─── mi_recommendations ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "mi_recommendations_tenant_isolation" ON mi_recommendations;

CREATE POLICY "mi_recommendations_tenant_isolation_v2" ON mi_recommendations
  FOR ALL
  USING (tenant_id = public.get_user_hotel_id())
  WITH CHECK (tenant_id = public.get_user_hotel_id());

-- ─── mi_recommendation_actions ───────────────────────────────────────────────

DROP POLICY IF EXISTS "mi_reco_actions_tenant_isolation" ON mi_recommendation_actions;

CREATE POLICY "mi_reco_actions_tenant_isolation_v2" ON mi_recommendation_actions
  FOR ALL
  USING (tenant_id = public.get_user_hotel_id())
  WITH CHECK (tenant_id = public.get_user_hotel_id());

-- ─── mi_alerts ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "mi_alerts_tenant_isolation" ON mi_alerts;

CREATE POLICY "mi_alerts_tenant_isolation_v2" ON mi_alerts
  FOR ALL
  USING (tenant_id = public.get_user_hotel_id())
  WITH CHECK (tenant_id = public.get_user_hotel_id());
