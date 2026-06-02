-- =============================================================================
-- 20260636_r4a_bug_fixes.sql  (R4 — Corrections de bugs sans nouveaux rôles)
-- =============================================================================
-- INC-07 : user_hotels.role défaut 'direction' → 'reception' (moindre privilège)
-- INC-08 : is_platform_admin() comparait id = auth.uid() alors que id ≠ auth_id
--          en prod → le super_admin était SILENCIEUSEMENT cassé (28+ policies
--          platform_admin_all niées). Corrigé en auth_id = auth.uid().
-- NB : attach_access_select (INC-02) est traité en r4c (20260638), APRÈS
--      l'extension de l'enum (la policy cible référence 'admin_hotel').
-- =============================================================================

ALTER TABLE public.user_hotels
  ALTER COLUMN role SET DEFAULT 'reception'::admin_user_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE auth_id = auth.uid() AND is_active = true
  );
$$;

-- =============================================================================
-- FIN 20260636_r4a_bug_fixes.sql
-- =============================================================================
