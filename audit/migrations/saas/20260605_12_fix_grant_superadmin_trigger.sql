-- ============================================================================
-- FLOWTYM SaaS — CORRECTIF CRITIQUE : grant_superadmin_on_new_hotel()
-- BUG (bloquant) : la fonction (trigger AFTER INSERT sur hotels) insérait dans
--   user_hotels une colonne `is_active` INEXISTANTE, un role 'admin' (valeur
--   enum admin_user_role INVALIDE) et utilisait auth.users.id au lieu du
--   public.users.id. => TOUTE création d'hôtel échouait (erreur 42703).
-- CORRECTIF : résout le public.users.id du super_admin via platform_admins
--   (générique, sans email en dur), role valide 'direction', sans is_active.
-- APPLIQUÉE EN PROD (migration saas_12). Prouvée : création d'hôtel OK +
--   super_admin auto-rattaché (superadmin_autolinked=1) en simulation rollback.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.grant_superadmin_on_new_hotel()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_superadmin_id uuid;
BEGIN
  SELECT u.id INTO v_superadmin_id
    FROM public.users u
    JOIN public.platform_admins pa
      ON pa.auth_id = u.auth_id AND pa.role = 'super_admin' AND pa.is_active = true
   ORDER BY pa.created_at
   LIMIT 1;

  IF v_superadmin_id IS NOT NULL THEN
    INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default)
    VALUES (v_superadmin_id, NEW.id, 'direction', false)
    ON CONFLICT (user_id, hotel_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
