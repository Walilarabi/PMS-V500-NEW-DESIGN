-- =============================================================================
-- 20260638_r4c_update_rls.sql  (R4 — RLS + anti-élévation + INC-02)
-- =============================================================================
-- Applique admin_hotel / comptabilite / revenue_manager aux policies.
-- Corrige INC-02 (attach_access_select : retrait des fantômes owner/admin,
-- ajout admin_hotel). Crée set_user_hotel_role() (anti-élévation).
-- DOIT être appliqué APRÈS r4b (les valeurs d'enum doivent exister).
-- =============================================================================

-- 1. attachment_access_log : direction + admin_hotel (INC-02 corrigé)
DROP POLICY IF EXISTS attach_access_select ON public.attachment_access_log;
CREATE POLICY attach_access_select ON public.attachment_access_log
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.current_user_role() IN ('direction', 'admin_hotel'));

-- 2. users_admin_manage : direction + admin_hotel
DROP POLICY IF EXISTS users_admin_manage ON public.users;
CREATE POLICY users_admin_manage ON public.users FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role));

-- 3. pricing_rules_write : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS pricing_rules_write ON public.pricing_rules;
CREATE POLICY pricing_rules_write ON public.pricing_rules FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 4. rate_plans_write : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS rate_plans_write ON public.rate_plans;
CREATE POLICY rate_plans_write ON public.rate_plans FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 5. rate_prices_write : direction + admin_hotel + reception + revenue_manager
DROP POLICY IF EXISTS rate_prices_write ON public.rate_prices;
CREATE POLICY rate_prices_write ON public.rate_prices FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 6. rate_restrictions_write : idem rate_prices
DROP POLICY IF EXISTS rate_restrictions_write ON public.rate_restrictions;
CREATE POLICY rate_restrictions_write ON public.rate_restrictions FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 7. room_blocks_modify : direction + admin_hotel + reception
DROP POLICY IF EXISTS room_blocks_modify ON public.room_blocks;
CREATE POLICY room_blocks_modify ON public.room_blocks FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role));

-- 8. promo_campaigns_modify : direction + admin_hotel + reception + revenue_manager
DROP POLICY IF EXISTS promo_campaigns_modify ON public.promo_campaigns;
CREATE POLICY promo_campaigns_modify ON public.promo_campaigns FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 9. rms_pricing_applications_modify : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS rms_pricing_applications_modify ON public.rms_pricing_applications;
CREATE POLICY rms_pricing_applications_modify ON public.rms_pricing_applications FOR ALL TO authenticated
  USING ((recommendation_id IN (
      SELECT r.id FROM rms_pricing_recommendations r
      WHERE r.rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id())))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role))
  WITH CHECK ((recommendation_id IN (
      SELECT r.id FROM rms_pricing_recommendations r
      WHERE r.rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id())))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 10. rms_pricing_reco_update : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS rms_pricing_reco_update ON public.rms_pricing_recommendations;
CREATE POLICY rms_pricing_reco_update ON public.rms_pricing_recommendations FOR UPDATE TO authenticated
  USING ((rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role))
  WITH CHECK ((rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 11. lighthouse_imports_insert : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS lighthouse_imports_insert ON public.lighthouse_imports;
CREATE POLICY lighthouse_imports_insert ON public.lighthouse_imports FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 12. worker_runs_select : direction + admin_hotel
DROP POLICY IF EXISTS worker_runs_select ON public.worker_runs;
CREATE POLICY worker_runs_select ON public.worker_runs FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role));

-- 13. competitor_sync_failures : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS sync_failures_select ON public.competitor_sync_failures;
CREATE POLICY sync_failures_select ON public.competitor_sync_failures FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role));

-- 14. set_user_hotel_role() — anti-élévation (admin_hotel ne peut pas promouvoir
--     vers direction/admin_hotel). Le frontend doit appeler cette RPC au lieu
--     d'un UPDATE direct sur users.role.
CREATE OR REPLACE FUNCTION public.set_user_hotel_role(p_user_id uuid, p_new_role admin_user_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor_role admin_user_role; v_hotel uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  v_actor_role := public.get_user_role();
  IF v_actor_role NOT IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role) THEN
    RAISE EXCEPTION 'Permission refusée : gestion des rôles réservée à la direction / admin hôtel';
  END IF;
  IF v_actor_role = 'admin_hotel'::admin_user_role
     AND p_new_role IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role) THEN
    RAISE EXCEPTION 'Permission refusée : admin_hotel ne peut pas attribuer le rôle %', p_new_role;
  END IF;
  UPDATE public.users SET role = p_new_role
   WHERE id = p_user_id AND hotel_id = v_hotel;
  IF NOT FOUND THEN RAISE EXCEPTION 'Utilisateur introuvable ou hors hôtel'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_user_hotel_role(uuid, admin_user_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_hotel_role(uuid, admin_user_role) TO authenticated;

-- =============================================================================
-- FIN 20260638_r4c_update_rls.sql
-- =============================================================================
