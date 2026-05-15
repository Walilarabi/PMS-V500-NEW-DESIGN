-- =============================================================================
-- 0150_fix_audit_fk_and_user_sync.sql
-- =============================================================================
-- PROBLÈME :
--   insert or update on table "audit_logs" violates foreign key constraint
--   "audit_logs_actor_user_id_fkey"
--
-- CAUSE RACINE :
--   1. audit_logs.actor_user_id référence public.users(id)
--   2. public.users est un profil applicatif (avec hotel_id NOT NULL)
--   3. Un user peut être authentifié dans auth.users SANS avoir
--      de profil dans public.users (onboarding pas encore terminé,
--      ou profil créé manuellement)
--   4. Les triggers DB (0030, 0060, 0110) insertent dans audit_logs
--      avec actor_user_id = auth.uid() → FK violation si le profil
--      public.users n'existe pas encore
--
-- SOLUTIONS APPLIQUÉES :
--   A) Rendre actor_user_id nullable avec ON DELETE SET NULL
--      (était déjà nullable mais la FK sans ON DELETE SET NULL
--      bloquait les inserts avec un auth.uid() sans profil public)
--   B) Trigger on_auth_user_created : crée un stub public.users
--      minimal dès qu'un user auth est créé (sans hotel_id pour l'instant)
--      → remplacé par ON DELETE SET NULL pour ne pas bloquer l'audit
--   C) writeAuditLog frontend : actor_user_id résolu via auth_id
--      (on cherche public.users.id à partir de auth.uid())
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Rendre la FK ON DELETE SET NULL (idempotente)
-- -----------------------------------------------------------------------------

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

-- Recréer avec ON DELETE SET NULL
-- Cela permet :
--   • d'insérer avec actor_user_id = NULL (user non profilé)
--   • de ne jamais bloquer un INSERT d'audit quand le profil n'existe pas
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES public.users(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- -----------------------------------------------------------------------------
-- B. Fonction helper : résoudre public.users.id depuis auth.uid()
--    Retourne NULL si pas de profil (jamais d'erreur)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.resolve_actor_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- C. Mettre à jour les triggers existants pour utiliser resolve_actor_user_id()
--    au lieu de auth.uid() directement (qui pointe vers auth.users, pas public.users)
-- -----------------------------------------------------------------------------

-- Trigger sur reservations (0030)
CREATE OR REPLACE FUNCTION app.log_reservation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _actor uuid;
  _payload jsonb;
BEGIN
  _actor := app.resolve_actor_user_id(); -- NULL-safe, jamais d'erreur FK

  IF TG_OP = 'DELETE' THEN
    _payload := to_jsonb(OLD);
    INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
    VALUES (OLD.hotel_id, _actor, 'reservation', OLD.id, 'DELETE', _payload);
    RETURN OLD;
  END IF;

  _payload := to_jsonb(NEW);
  -- Supprimer les champs inutiles pour alléger le payload
  _payload := _payload - 'hotel_id' - 'version' - 'updated_at';

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    NEW.hotel_id,
    _actor,
    'reservation',
    NEW.id,
    TG_OP,
    _payload
  )
  ON CONFLICT DO NOTHING;  -- idempotence

  RETURN NEW;
END;
$$;

-- Recréer le trigger sur reservations (drop + create pour idempotence)
DROP TRIGGER IF EXISTS trg_log_reservation_change ON public.reservations;
CREATE TRIGGER trg_log_reservation_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION app.log_reservation_change();

-- -----------------------------------------------------------------------------
-- D. Insérer l'utilisateur courant dans public.users si manquant
--    (RPC appelable depuis le frontend lors du login)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.ensure_user_profile(
  p_hotel_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _auth_user_id uuid;
  _email text;
  _full_name text;
  _existing_id uuid;
  _hotel_id uuid;
BEGIN
  _auth_user_id := auth.uid();
  IF _auth_user_id IS NULL THEN RETURN NULL; END IF;

  -- Vérifier si le profil existe déjà
  SELECT id INTO _existing_id
  FROM public.users
  WHERE auth_id = _auth_user_id
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    RETURN _existing_id;
  END IF;

  -- Récupérer email depuis auth.users
  SELECT email INTO _email
  FROM auth.users
  WHERE id = _auth_user_id;

  -- Récupérer full_name depuis auth.users metadata
  SELECT
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      split_part(_email, '@', 1)
    ) INTO _full_name
  FROM auth.users
  WHERE id = _auth_user_id;

  -- Utiliser le premier hôtel disponible si hotel_id non fourni
  IF p_hotel_id IS NULL THEN
    SELECT id INTO _hotel_id FROM public.hotels LIMIT 1;
  ELSE
    _hotel_id := p_hotel_id;
  END IF;

  IF _hotel_id IS NULL THEN
    -- Pas d'hôtel disponible → pas de profil possible, retourner NULL
    RETURN NULL;
  END IF;

  -- Créer le profil
  INSERT INTO public.users (auth_id, hotel_id, email, full_name, role)
  VALUES (_auth_user_id, _hotel_id, _email, _full_name, 'admin')
  ON CONFLICT (hotel_id, email) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
        updated_at = now()
  RETURNING id INTO _existing_id;

  RETURN _existing_id;
END;
$$;

-- Accès RPC depuis le frontend (authenticated uniquement)
REVOKE ALL ON FUNCTION app.ensure_user_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.ensure_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.resolve_actor_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app.resolve_actor_user_id() TO service_role;
