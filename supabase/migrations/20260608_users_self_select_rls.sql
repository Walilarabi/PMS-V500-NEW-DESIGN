-- ═══════════════════════════════════════════════════════════════════
-- FLOWTYM — Fix: users can always read their OWN profile row
--
-- ROOT CAUSE: the existing users SELECT policies only allowed
--   hotel_id = get_user_hotel_id()
-- get_user_hotel_id() returns the ACTIVE hotel. When a multi-hotel user
-- switches to a hotel different from their home users.hotel_id, their own
-- profile row becomes invisible to themselves → fetchProfile() returns
-- null → session.role = null → falls back to least-privilege 'reader'.
-- This greyed out admin-only buttons (e.g. "Créer une chambre") and
-- blocked Settings pages with "Accès restreint" even for 'direction'
-- (super admin) accounts.
--
-- FIX: a user reading their OWN row (auth_id = auth.uid()) is always
-- legitimate and is REQUIRED for the session/role to load. This does not
-- weaken tenant isolation — it only ever exposes the caller's own record
-- (verified: a different auth uid sees 0 rows of another user).
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS users_self_select ON public.users;

CREATE POLICY users_self_select
  ON public.users
  FOR SELECT
  USING (auth_id = auth.uid());
