-- ROLLBACK r4c. Restaure les policies dans leur état pré-R4 (direction/reception
-- uniquement) et supprime set_user_hotel_role(). attach_access_select revient à
-- sa version fantôme owner/admin (état strictement antérieur).

-- 1. attachment_access_log (état pré-R4 avec fantômes)
DROP POLICY IF EXISTS attach_access_select ON public.attachment_access_log;
CREATE POLICY attach_access_select ON public.attachment_access_log FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
    AND public.current_user_role() IN ('owner','direction','admin'));

-- 2. users_admin_manage (direction seul)
DROP POLICY IF EXISTS users_admin_manage ON public.users;
CREATE POLICY users_admin_manage ON public.users FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role)
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role);

-- 3. pricing_rules_write (direction seul)
DROP POLICY IF EXISTS pricing_rules_write ON public.pricing_rules;
CREATE POLICY pricing_rules_write ON public.pricing_rules FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role)
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role);

-- 4. rate_plans_write (direction seul)
DROP POLICY IF EXISTS rate_plans_write ON public.rate_plans;
CREATE POLICY rate_plans_write ON public.rate_plans FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role)
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role);

-- 5. rate_prices_write (direction + reception)
DROP POLICY IF EXISTS rate_prices_write ON public.rate_prices;
CREATE POLICY rate_prices_write ON public.rate_prices FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]))
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]));

-- 6. rate_restrictions_write (direction + reception)
DROP POLICY IF EXISTS rate_restrictions_write ON public.rate_restrictions;
CREATE POLICY rate_restrictions_write ON public.rate_restrictions FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]))
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]));

-- 7. room_blocks_modify (direction + reception)
DROP POLICY IF EXISTS room_blocks_modify ON public.room_blocks;
CREATE POLICY room_blocks_modify ON public.room_blocks FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]))
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]));

-- 8. promo_campaigns_modify (direction + reception)
DROP POLICY IF EXISTS promo_campaigns_modify ON public.promo_campaigns;
CREATE POLICY promo_campaigns_modify ON public.promo_campaigns FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]))
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]));

-- 9. rms_pricing_applications_modify (direction + reception)
DROP POLICY IF EXISTS rms_pricing_applications_modify ON public.rms_pricing_applications;
CREATE POLICY rms_pricing_applications_modify ON public.rms_pricing_applications FOR ALL TO authenticated
  USING ((recommendation_id IN (SELECT r.id FROM rms_pricing_recommendations r WHERE r.rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id())))
    AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]))
  WITH CHECK ((recommendation_id IN (SELECT r.id FROM rms_pricing_recommendations r WHERE r.rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id())))
    AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]));

-- 10. rms_pricing_reco_update (direction + reception)
DROP POLICY IF EXISTS rms_pricing_reco_update ON public.rms_pricing_recommendations;
CREATE POLICY rms_pricing_reco_update ON public.rms_pricing_recommendations FOR UPDATE TO authenticated
  USING ((rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()))
    AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]))
  WITH CHECK ((rate_plan_id IN (SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()))
    AND public.get_user_role() = ANY (ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]));

-- 11. lighthouse_imports_insert (direction seul)
DROP POLICY IF EXISTS lighthouse_imports_insert ON public.lighthouse_imports;
CREATE POLICY lighthouse_imports_insert ON public.lighthouse_imports FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role);

-- 12. worker_runs_select (direction seul)
DROP POLICY IF EXISTS worker_runs_select ON public.worker_runs;
CREATE POLICY worker_runs_select ON public.worker_runs FOR SELECT TO authenticated
  USING (public.get_user_role() = 'direction'::admin_user_role);

-- 13. competitor_sync_failures (direction seul)
DROP POLICY IF EXISTS sync_failures_select ON public.competitor_sync_failures;
CREATE POLICY sync_failures_select ON public.competitor_sync_failures FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction'::admin_user_role);

-- 14. set_user_hotel_role()
DROP FUNCTION IF EXISTS public.set_user_hotel_role(uuid, admin_user_role);
