-- SECURITY: RLS hardening — multi-tenant isolation fixes
--
-- Addresses findings from the 2026-06-03 offensive security audit:
--
--   CRITICAL-1: rms_pricing_recommendations_select had OR rate_plan_id IS NULL
--               → any authenticated user could read all NULL-scoped recommendations
--   CRITICAL-2: rms_pricing_recommendations_insert had OR rate_plan_id IS NULL
--               → any authenticated user could insert unscoped recommendations
--   MEDIUM:     rms_events_select / rms_competitors_select USING(true)
--               → full cross-hotel read of event catalog and compset
--   HIGH:       rms_tactical_rules, rms_guardrails, rms_priority_hierarchy,
--               rms_audit_log, rms_decisions used hotel_users subquery instead of
--               get_user_hotel_id() — allows multi-hotel membership bypass
--   HIGH:       get_user_hotel_id() and get_user_role() granted to anon
--               → unnecessary attack-surface widening
--   LOW:        Dead no-write policies on rms_competitor_pricing cluttered schema

-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL-1 + CRITICAL-2: rms_pricing_recommendations
-- The v2 ALL policy (rms_pricing_reco_tenant_isolation_v2) already scopes all
-- operations correctly via tenant_id = get_user_hotel_id(). The stale phase1
-- policies with the IS NULL bypass are redundant and dangerous.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_pricing_recommendations_select" ON public.rms_pricing_recommendations;
DROP POLICY IF EXISTS "rms_pricing_recommendations_modify" ON public.rms_pricing_recommendations;
DROP POLICY IF EXISTS "rms_pricing_recommendations_insert" ON public.rms_pricing_recommendations;

-- No replacement needed: rms_pricing_reco_tenant_isolation_v2 (FOR ALL, tenant_id
-- = get_user_hotel_id()) already handles SELECT/INSERT/UPDATE/DELETE correctly.

-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM: rms_events and rms_competitors — drop global USING(true) SELECT
-- rms_events_tenant_isolation_v2 and rms_competitors_tenant_isolation_v2
-- (both FOR ALL, tenant_id = get_user_hotel_id()) handle tenant scoping.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_events_select" ON public.rms_events;
DROP POLICY IF EXISTS "rms_competitors_select" ON public.rms_competitors;

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: rms_tactical_rules — replace hotel_users subquery with get_user_hotel_id()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rms_tactical_rules_select_own ON public.rms_tactical_rules;
DROP POLICY IF EXISTS rms_tactical_rules_insert_own ON public.rms_tactical_rules;
DROP POLICY IF EXISTS rms_tactical_rules_update_own ON public.rms_tactical_rules;
DROP POLICY IF EXISTS rms_tactical_rules_delete_own ON public.rms_tactical_rules;

CREATE POLICY rms_tactical_rules_select_own
  ON public.rms_tactical_rules FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_tactical_rules_insert_own
  ON public.rms_tactical_rules FOR INSERT
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_tactical_rules_update_own
  ON public.rms_tactical_rules FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_tactical_rules_delete_own
  ON public.rms_tactical_rules FOR DELETE
  USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: rms_guardrails — replace hotel_users subquery with get_user_hotel_id()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rms_guardrails_select_own ON public.rms_guardrails;
DROP POLICY IF EXISTS rms_guardrails_insert_own ON public.rms_guardrails;
DROP POLICY IF EXISTS rms_guardrails_update_own ON public.rms_guardrails;
DROP POLICY IF EXISTS rms_guardrails_delete_own ON public.rms_guardrails;

CREATE POLICY rms_guardrails_select_own
  ON public.rms_guardrails FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_guardrails_insert_own
  ON public.rms_guardrails FOR INSERT
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_guardrails_update_own
  ON public.rms_guardrails FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_guardrails_delete_own
  ON public.rms_guardrails FOR DELETE
  USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: rms_priority_hierarchy — replace hotel_users subquery
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rms_priority_select_own ON public.rms_priority_hierarchy;
DROP POLICY IF EXISTS rms_priority_insert_own ON public.rms_priority_hierarchy;
DROP POLICY IF EXISTS rms_priority_update_own ON public.rms_priority_hierarchy;
DROP POLICY IF EXISTS rms_priority_delete_own ON public.rms_priority_hierarchy;

CREATE POLICY rms_priority_select_own
  ON public.rms_priority_hierarchy FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_priority_insert_own
  ON public.rms_priority_hierarchy FOR INSERT
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_priority_update_own
  ON public.rms_priority_hierarchy FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_priority_delete_own
  ON public.rms_priority_hierarchy FOR DELETE
  USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: rms_audit_log — replace hotel_users subquery (append-only table)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rms_audit_select_own ON public.rms_audit_log;
DROP POLICY IF EXISTS rms_audit_insert_own ON public.rms_audit_log;

CREATE POLICY rms_audit_select_own
  ON public.rms_audit_log FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_audit_insert_own
  ON public.rms_audit_log FOR INSERT
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: rms_decisions — replace hotel_users subquery
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rms_decisions_select_own_hotel ON public.rms_decisions;
DROP POLICY IF EXISTS rms_decisions_insert_own_hotel ON public.rms_decisions;

CREATE POLICY rms_decisions_select_own_hotel
  ON public.rms_decisions FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_decisions_insert_own_hotel
  ON public.rms_decisions FOR INSERT
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: remove anon access to SECURITY DEFINER auth helper functions
-- These functions serve no purpose for unauthenticated callers and widen the
-- attack surface for the IS NULL bypass pattern described above.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.get_user_hotel_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role()     FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- LOW: drop dead no-write policies on rms_competitor_pricing (schema cleanup)
-- The write-block policies are superseded by platform_admin policies from
-- the fix_rls_current_setting migration.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rms_competitor_pricing_no_update" ON public.rms_competitor_pricing;
DROP POLICY IF EXISTS "rms_competitor_pricing_no_delete" ON public.rms_competitor_pricing;
