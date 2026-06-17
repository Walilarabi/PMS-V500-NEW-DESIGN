-- =============================================================================
-- 20260652_security_sprint2_hardening.sql
-- =============================================================================
-- SECURITY SPRINT 2 — fermeture des vulnérabilités MAJEURES restantes
-- identifiées par l'audit + Supabase Advisors.
--
-- Périmètre :
--   V9   `_admin_sync_user_default_role` privesc → guard is_platform_admin()
--   V10  3 tables RLS Enabled No Policy → policy explicite (deny-all sauf
--        service_role) avec documentation du flux d'accès attendu
--   V11  6 fonctions function_search_path_mutable → SET search_path fixé
--
--   V12  auth_leaked_password_protection est un setting dashboard Supabase
--        (non patchable via SQL). Tâche ops séparée — voir docs/ops/V12.md
-- =============================================================================

-- ─── V9 — _admin_sync_user_default_role guard ───────────────────────────────
-- VULNÉRABILITÉ :
--   SECURITY DEFINER accessible à `authenticated` sans aucun check. N'importe
--   quel user pouvait appeler avec n'importe quel p_user_id et resync son
--   rôle public.users.role à partir de user_hotels.role. Impact limité (le
--   rôle est récupéré depuis user_hotels dont la modification est sous RLS),
--   mais pollution silencieuse possible.
-- CORRECTIF : exiger is_platform_admin() en tête.
CREATE OR REPLACE FUNCTION public._admin_sync_user_default_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden: platform admin required'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.users u
     SET role = COALESCE(
           (SELECT uh.role FROM public.user_hotels uh
             WHERE uh.user_id = p_user_id AND uh.is_default LIMIT 1),
           u.role),
         updated_at = now()
   WHERE u.id = p_user_id;
END
$$;

-- ─── V10 — 3 tables RLS enabled no policy ───────────────────────────────────
-- Ces tables étaient en `ENABLE ROW LEVEL SECURITY` mais SANS aucune policy
-- → comportement Postgres = deny-all pour tout rôle non superuser. Le code
-- actuel y accède via service_role (qui bypass RLS), donc OK fonctionnellement.
-- Mais Supabase Advisors WARN avec raison : pas de policy explicite = intention
-- ambigüe. On documente explicitement le pattern « service_role only ».

-- public._hotel_communication_secrets : SMTP password, Gmail/Meta tokens
-- → DOIT rester service_role only (Edge Functions). Policy deny pour authenticated.
DROP POLICY IF EXISTS "service_role_only_hotel_communication_secrets" ON public._hotel_communication_secrets;
CREATE POLICY "service_role_only_hotel_communication_secrets"
  ON public._hotel_communication_secrets
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- public._odms_cron_config : configuration cron OTA dispute. service_role only.
DROP POLICY IF EXISTS "service_role_only_odms_cron_config" ON public._odms_cron_config;
CREATE POLICY "service_role_only_odms_cron_config"
  ON public._odms_cron_config
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- app.schema_migrations : table interne migration tooling. service_role only.
DROP POLICY IF EXISTS "service_role_only_schema_migrations" ON app.schema_migrations;
CREATE POLICY "service_role_only_schema_migrations"
  ON app.schema_migrations
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ─── V11 — 6 fonctions function_search_path_mutable ─────────────────────────
-- Risque : recherche d'objets dans des schémas non-fiables si search_path
-- contient un schéma exploitable par un attaquant ayant droits CREATE sur
-- un autre schéma (rare en pratique, mais best practice de durcir).
-- Correctif : fixer search_path à 'public', 'pg_temp' sur toutes les fonctions
-- identifiées par les advisors.

ALTER FUNCTION public.set_updated_at()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.next_contract_number(uuid)        SET search_path = public, pg_temp;
ALTER FUNCTION public.cmap_cat(text)                    SET search_path = public, pg_temp;
ALTER FUNCTION public.find_replacement_candidates(uuid, uuid, date, integer)
                                                        SET search_path = public, pg_temp;
ALTER FUNCTION public.check_replacement_constraints(uuid, uuid, date, time, time)
                                                        SET search_path = public, pg_temp;
ALTER FUNCTION public.set_mi_updated_at()               SET search_path = public, pg_temp;

-- =============================================================================
-- FIN 20260652_security_sprint2_hardening.sql
-- =============================================================================
