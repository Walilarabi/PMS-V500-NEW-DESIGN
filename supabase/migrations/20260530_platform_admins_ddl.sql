-- ============================================================================
-- SECURITY FIX C3: Define platform_admins table + is_platform_admin()
-- ============================================================================
--
-- VULNERABILITY: is_platform_admin() was referenced in multiple RLS policies
-- (security_phase1, rms_module, market_intelligence) but never defined.
-- PostgreSQL raises an error when a policy calls an unknown function, causing
-- all writes to those tables to fail open or closed depending on the error
-- handler — neither is acceptable.
--
-- Additionally, AdminContext.tsx queried platform_admins without a user_id
-- filter, so the first active admin row would be returned regardless of who
-- is logged in (privilege escalation for any authenticated user).
--
-- FIX:
--   1. Create platform_admins table with user_id FK to auth.users
--   2. Create is_platform_admin() SECURITY DEFINER backed by this table
--   3. RLS: only the row owner can read their own record
-- ============================================================================

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  full_name  text,
  role       text NOT NULL CHECK (role IN ('super_admin', 'support_agent', 'billing_admin')),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only the platform admin can read their own record
CREATE POLICY "platform_admins_self_read" ON public.platform_admins
  FOR SELECT
  USING (user_id = auth.uid());

-- Only super_admins (via service role / Edge Function) can write
CREATE POLICY "platform_admins_service_write" ON public.platform_admins
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── is_platform_admin() ─────────────────────────────────────────────────────

-- SECURITY DEFINER so RLS policies on other tables can call it without the
-- caller needing SELECT on platform_admins.  The function itself is hardened:
--   • reads only the row for the current JWT uid
--   • returns false (not error) when no row exists
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id  = auth.uid()
      AND is_active = true
  );
$$;

-- ─── Trigger: keep updated_at current ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_platform_admins_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_platform_admins_updated_at
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.set_platform_admins_updated_at();
