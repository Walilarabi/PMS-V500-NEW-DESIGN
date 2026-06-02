-- =============================================================================
-- 20260640_r4e_unify_role_fn.sql  (R4 — Unification des fonctions de rôle)
-- =============================================================================
-- get_user_role() et current_user_role() sont redondantes (même requête).
-- On conserve les deux pour compatibilité (13 policies utilisent get_user_role
-- avec cast ::admin_user_role). current_user_role() (text, R1) devient la
-- référence documentée pour tout nouveau code. La migration complète des RLS
-- vers current_user_role() est différée (hors R4) pour limiter le risque.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS admin_user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;
COMMENT ON FUNCTION public.get_user_role() IS
  'R4 : dépréciée — préférer current_user_role() pour tout nouveau code. Conservée pour compatibilité des RLS existantes (cast ::admin_user_role).';
COMMENT ON FUNCTION public.current_user_role() IS
  'R4 : fonction de référence pour la résolution du rôle hôtel (text). Utilisée par R1/R2/R3 et le nouveau code.';
-- =============================================================================
-- FIN 20260640_r4e_unify_role_fn.sql
-- =============================================================================
