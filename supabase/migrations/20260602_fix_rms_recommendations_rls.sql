-- Fix rms_pricing_recommendations INSERT policy.
-- Previous: only platform admins could insert.
-- Fixed: hotel users can insert recommendations scoped to their hotel's rate plans.
-- This unblocks the client-side RMS engine (useCreatePricingRecommendation hook).

DROP POLICY IF EXISTS rms_pricing_recommendations_insert ON public.rms_pricing_recommendations;

CREATE POLICY rms_pricing_recommendations_insert ON public.rms_pricing_recommendations
  FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR (
      rate_plan_id IS NULL
      OR rate_plan_id IN (
        SELECT id FROM public.rate_plans
        WHERE hotel_id = public.get_user_hotel_id()
      )
    )
  );
