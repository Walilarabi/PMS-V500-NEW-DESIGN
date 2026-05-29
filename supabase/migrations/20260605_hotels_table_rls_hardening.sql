-- SECURITY: hotels table RLS hardening + hotel_subscriptions write-block
--
-- Findings addressed:
--   HIGH: hotels — no RLS enabled → all authenticated users can read all hotels
--   HIGH: hotels — no INSERT/DELETE block → authenticated users can create/delete hotels
--   MEDIUM: hotel_subscriptions — SELECT-only policy existed, no explicit write-block
--
-- After this migration:
--   hotels:
--     SELECT: hotel's own users (via get_user_hotel_id) OR platform_admins
--     UPDATE: hotel's own users only (hotels self-maintain their settings)
--     INSERT/DELETE: platform_admins only (only super_admin flow creates/deletes hotels)
--
--   hotel_subscriptions:
--     SELECT: hotel's own users (already existed)
--     INSERT/UPDATE/DELETE: platform_admins only (subscriptions managed centrally)

-- ─────────────────────────────────────────────────────────────────────────────
-- hotels — enable RLS and add granular policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels FORCE ROW LEVEL SECURITY;

-- Drop any legacy policies first
DROP POLICY IF EXISTS "hotels_select_own"          ON public.hotels;
DROP POLICY IF EXISTS "hotels_update_own"          ON public.hotels;
DROP POLICY IF EXISTS "hotels_insert_admin"        ON public.hotels;
DROP POLICY IF EXISTS "hotels_delete_admin"        ON public.hotels;
DROP POLICY IF EXISTS "hotels_platform_admin_all"  ON public.hotels;

-- Hotel users can read their own hotel row
CREATE POLICY hotels_select_own ON public.hotels
  FOR SELECT
  USING (
    id = public.get_user_hotel_id()
    OR public.is_platform_admin()
  );

-- Hotel users can update their own hotel settings (name, config, etc.)
CREATE POLICY hotels_update_own ON public.hotels
  FOR UPDATE
  USING (id = public.get_user_hotel_id() OR public.is_platform_admin())
  WITH CHECK (id = public.get_user_hotel_id() OR public.is_platform_admin());

-- Only platform admins can create new hotels
CREATE POLICY hotels_insert_admin ON public.hotels
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

-- Only platform admins can delete hotels
CREATE POLICY hotels_delete_admin ON public.hotels
  FOR DELETE
  USING (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- hotel_subscriptions — add explicit write-block policies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT policy was already added in 20260528_security_phase1.sql
-- This adds explicit blocks for INSERT / UPDATE / DELETE

DROP POLICY IF EXISTS "hotel_subscriptions_no_insert"    ON public.hotel_subscriptions;
DROP POLICY IF EXISTS "hotel_subscriptions_no_update"    ON public.hotel_subscriptions;
DROP POLICY IF EXISTS "hotel_subscriptions_no_delete"    ON public.hotel_subscriptions;
DROP POLICY IF EXISTS "hotel_subscriptions_admin_write"  ON public.hotel_subscriptions;

-- Platform admins can do everything on subscriptions
CREATE POLICY hotel_subscriptions_admin_write ON public.hotel_subscriptions
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Explicitly block non-admin writes
CREATE POLICY hotel_subscriptions_no_insert ON public.hotel_subscriptions
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY hotel_subscriptions_no_update ON public.hotel_subscriptions
  FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY hotel_subscriptions_no_delete ON public.hotel_subscriptions
  FOR DELETE
  USING (public.is_platform_admin());
