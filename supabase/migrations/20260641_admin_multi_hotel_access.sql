-- =============================================================================
-- 20260641_admin_multi_hotel_access.sql
-- Gestion centralisée des accès utilisateurs multi-hôtels / multi-applications
-- depuis le panel /admin (super_admin plateforme).
--
-- Principe : tout utilisateur passe par le modèle unifié
--   public.users  (compte)            -- 1 ligne par personne
--   public.user_hotels (accès hôtel)  -- N hôtels autorisés + rôle par hôtel + défaut
--   public.user_app_access (accès app) -- N applications autorisées par (user, hôtel)
--
-- Le rôle EFFECTIF (RBAC) suit l'hôtel ACTIF : get_user_role() lit désormais
-- user_hotels pour l'hôtel courant (fallback users.role).
--
-- Sécurité : les écritures de gestion sont réservées au super_admin plateforme
-- via is_platform_admin() (RLS + RPC SECURITY DEFINER avec garde explicite).
-- Aucun utilisateur ne peut lire/écrire un hôtel auquel il n'est pas rattaché
-- (RLS existante : pl_my_hotels / get_user_hotel_id inchangées).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BACKFILL — unifier les utilisateurs legacy dans le modèle multi-hôtels
-- -----------------------------------------------------------------------------

-- 1a. Tout user ayant un hotel_id mais aucune ligne user_hotels → on crée son
--     accès à son hôtel principal (rôle = users.role, défaut = true).
INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default, granted_at)
SELECT u.id, u.hotel_id, u.role, true, now()
FROM public.users u
WHERE u.hotel_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_hotels uh WHERE uh.user_id = u.id)
ON CONFLICT (user_id, hotel_id) DO NOTHING;

-- 1b. Tout user multi-hôtels sans hôtel par défaut → on en désigne un (le plus
--     ancien accès), exactement un, pour satisfaire l'index unique partiel.
WITH need AS (
  SELECT uh.ctid AS tid
  FROM public.user_hotels uh
  WHERE NOT EXISTS (
          SELECT 1 FROM public.user_hotels d
          WHERE d.user_id = uh.user_id AND d.is_default
        )
    AND uh.ctid = (
          SELECT x.ctid FROM public.user_hotels x
          WHERE x.user_id = uh.user_id
          ORDER BY x.granted_at, x.ctid
          LIMIT 1
        )
)
UPDATE public.user_hotels SET is_default = true
WHERE ctid IN (SELECT tid FROM need);

-- 1c. Octroyer à chaque couple (user, hôtel) l'accès aux applications
--     actuellement disponibles (PMS, RH…). Garantit ZÉRO régression : tout
--     utilisateur conserve l'accès qu'il avait implicitement, l'enforcement
--     applicatif devient réel sans verrouiller personne.
INSERT INTO public.user_app_access (user_id, hotel_id, app_id)
SELECT uh.user_id, uh.hotel_id, pa.id
FROM public.user_hotels uh
CROSS JOIN public.platform_apps pa
WHERE pa.is_available
ON CONFLICT (user_id, hotel_id, app_id) DO NOTHING;

-- 1d. Aligner users.role sur le rôle de l'hôtel par défaut (cohérence fallback).
UPDATE public.users u
SET role = uh.role, updated_at = now()
FROM public.user_hotels uh
WHERE uh.user_id = u.id AND uh.is_default = true AND uh.role <> u.role;

-- -----------------------------------------------------------------------------
-- 2. INTÉGRITÉ — un seul hôtel par défaut par utilisateur
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS user_hotels_one_default_idx
  ON public.user_hotels (user_id)
  WHERE is_default;

-- -----------------------------------------------------------------------------
-- 3. RÔLE EFFECTIF SUIVANT L'HÔTEL ACTIF
--    get_user_role() lit user_hotels pour l'hôtel courant (fallback users.role).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS admin_user_role
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid;
  v_hotel   uuid;
  v_role    admin_user_role;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NOT NULL THEN
    SELECT uh.role INTO v_role
    FROM public.user_hotels uh
    WHERE uh.user_id = v_user_id AND uh.hotel_id = v_hotel
    LIMIT 1;
    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id LIMIT 1;
  RETURN v_role;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS — accès super_admin plateforme aux tables de gestion
--    (user_app_access a déjà une policy is_platform_admin ALL — inchangée)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS user_hotels_platform_admin ON public.user_hotels;
CREATE POLICY user_hotels_platform_admin ON public.user_hotels
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS users_platform_admin_manage ON public.users;
CREATE POLICY users_platform_admin_manage ON public.users
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS user_invitations_platform_admin ON public.user_invitations;
CREATE POLICY user_invitations_platform_admin ON public.user_invitations
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 5. HELPER interne — resynchroniser users.role sur le rôle de l'hôtel défaut
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._admin_sync_user_default_role(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  UPDATE public.users u
  SET role = COALESCE(
        (SELECT uh.role FROM public.user_hotels uh
         WHERE uh.user_id = p_user_id AND uh.is_default LIMIT 1),
        u.role),
      updated_at = now()
  WHERE u.id = p_user_id;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC — snapshot complet pour le panel admin (un seul appel)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_user_access()
RETURNS TABLE (
  user_id       uuid,
  auth_id       uuid,
  email         text,
  full_name     text,
  global_role   admin_user_role,
  is_active     boolean,
  last_login_at timestamptz,
  created_at    timestamptz,
  hotels        jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    u.id, u.auth_id, u.email, u.full_name, u.role, u.is_active,
    u.last_login_at, u.created_at,
    COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'hotel_id',   uh.hotel_id,
                 'hotel_name', h.name,
                 'role',       uh.role,
                 'is_default', uh.is_default,
                 'app_ids',    COALESCE((
                                 SELECT jsonb_agg(uaa.app_id)
                                 FROM public.user_app_access uaa
                                 WHERE uaa.user_id = u.id
                                   AND uaa.hotel_id = uh.hotel_id
                               ), '[]'::jsonb)
               )
               ORDER BY uh.is_default DESC, h.name
             )
      FROM public.user_hotels uh
      JOIN public.hotels h ON h.id = uh.hotel_id
      WHERE uh.user_id = u.id
    ), '[]'::jsonb) AS hotels
  FROM public.users u
  WHERE public.is_platform_admin()
  ORDER BY u.full_name NULLS LAST, u.email;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC — accorder un hôtel à un utilisateur
--    (auto-octroi des applications disponibles ; 1er hôtel = défaut)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_hotel(
  p_user_id  uuid,
  p_hotel_id uuid,
  p_role     admin_user_role
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor        uuid;
  v_has_default  boolean;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé au super administrateur' USING errcode = '42501';
  END IF;

  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  SELECT EXISTS (SELECT 1 FROM public.user_hotels WHERE user_id = p_user_id AND is_default)
    INTO v_has_default;

  INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default, granted_by)
  VALUES (p_user_id, p_hotel_id, p_role, NOT v_has_default, v_actor)
  ON CONFLICT (user_id, hotel_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Auto-octroi des applications actuellement disponibles
  INSERT INTO public.user_app_access (user_id, hotel_id, app_id, granted_by)
  SELECT p_user_id, p_hotel_id, pa.id, v_actor
  FROM public.platform_apps pa
  WHERE pa.is_available
  ON CONFLICT (user_id, hotel_id, app_id) DO NOTHING;

  PERFORM public._admin_sync_user_default_role(p_user_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC — retirer un hôtel à un utilisateur (cascade apps + hôtel actif)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revoke_hotel(
  p_user_id  uuid,
  p_hotel_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_was_default boolean;
  v_next_hotel  uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé au super administrateur' USING errcode = '42501';
  END IF;

  SELECT is_default INTO v_was_default
  FROM public.user_hotels WHERE user_id = p_user_id AND hotel_id = p_hotel_id;

  DELETE FROM public.user_app_access WHERE user_id = p_user_id AND hotel_id = p_hotel_id;
  DELETE FROM public.user_active_hotel WHERE user_id = p_user_id AND hotel_id = p_hotel_id;
  DELETE FROM public.user_hotels WHERE user_id = p_user_id AND hotel_id = p_hotel_id;

  -- Si on a retiré l'hôtel par défaut, en promouvoir un autre
  IF COALESCE(v_was_default, false) THEN
    SELECT hotel_id INTO v_next_hotel
    FROM public.user_hotels WHERE user_id = p_user_id
    ORDER BY granted_at LIMIT 1;
    IF v_next_hotel IS NOT NULL THEN
      UPDATE public.user_hotels SET is_default = true
      WHERE user_id = p_user_id AND hotel_id = v_next_hotel;
    END IF;
  END IF;

  PERFORM public._admin_sync_user_default_role(p_user_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC — modifier le rôle d'un utilisateur sur un hôtel
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_hotel_role(
  p_user_id  uuid,
  p_hotel_id uuid,
  p_role     admin_user_role
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé au super administrateur' USING errcode = '42501';
  END IF;

  UPDATE public.user_hotels SET role = p_role
  WHERE user_id = p_user_id AND hotel_id = p_hotel_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accès hôtel introuvable pour cet utilisateur' USING errcode = 'P0002';
  END IF;

  PERFORM public._admin_sync_user_default_role(p_user_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC — définir l'hôtel par défaut (exactement un)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_default_hotel(
  p_user_id  uuid,
  p_hotel_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé au super administrateur' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_hotels WHERE user_id = p_user_id AND hotel_id = p_hotel_id) THEN
    RAISE EXCEPTION 'Accès hôtel introuvable pour cet utilisateur' USING errcode = 'P0002';
  END IF;

  UPDATE public.user_hotels SET is_default = false
  WHERE user_id = p_user_id AND is_default;
  UPDATE public.user_hotels SET is_default = true
  WHERE user_id = p_user_id AND hotel_id = p_hotel_id;

  PERFORM public._admin_sync_user_default_role(p_user_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC — activer/désactiver l'accès d'un utilisateur à une application
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_app_access(
  p_user_id  uuid,
  p_hotel_id uuid,
  p_app_id   uuid,
  p_enabled  boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_actor uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé au super administrateur' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_hotels WHERE user_id = p_user_id AND hotel_id = p_hotel_id) THEN
    RAISE EXCEPTION 'L''utilisateur n''a pas accès à cet hôtel' USING errcode = '42501';
  END IF;

  IF p_enabled THEN
    SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
    INSERT INTO public.user_app_access (user_id, hotel_id, app_id, granted_by)
    VALUES (p_user_id, p_hotel_id, p_app_id, v_actor)
    ON CONFLICT (user_id, hotel_id, app_id) DO NOTHING;
  ELSE
    DELETE FROM public.user_app_access
    WHERE user_id = p_user_id AND hotel_id = p_hotel_id AND app_id = p_app_id;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. RPC — activer/suspendre un utilisateur
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_user_id uuid,
  p_active  boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé au super administrateur' USING errcode = '42501';
  END IF;

  UPDATE public.users SET is_active = p_active, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. GRANTS d'exécution (authenticated ; la garde is_platform_admin protège)
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_list_user_access()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_hotel(uuid, uuid, admin_user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_hotel(uuid, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_hotel_role(uuid, uuid, admin_user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_default_hotel(uuid, uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_app_access(uuid, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, boolean)         TO authenticated;

-- =============================================================================
-- FIN 20260641_admin_multi_hotel_access.sql
-- =============================================================================
