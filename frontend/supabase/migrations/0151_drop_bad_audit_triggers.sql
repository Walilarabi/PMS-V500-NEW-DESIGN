-- =============================================================================
-- 0151_drop_bad_audit_triggers.sql
-- =============================================================================
-- PROBLÈME RÉEL (diagnostiqué avec certitude) :
--
--   Le trigger trg_reservations_audit (créé dans 0030 et réécrit dans 0060)
--   utilise auth.uid() DIRECTEMENT comme actor_user_id dans audit_logs.
--
--   auth.uid() retourne l'UUID de auth.users.
--   audit_logs.actor_user_id référence public.users(id) — UUIDs DIFFÉRENTS.
--
--   → INSERT dans reservations → trigger → INSERT audit_logs avec auth.uid()
--   → FK violation → ROLLBACK de TOUTE la transaction → réservation non sauvée
--
-- POURQUOI 0150 n'a pas suffi :
--   0150 a ajouté ON DELETE SET NULL à la FK ET créé app.log_reservation_change()
--   MAIS n'a pas droppé trg_reservations_audit qui était encore actif.
--   Les DEUX triggers s'exécutaient, trg_reservations_audit continuait à échouer.
--
-- SOLUTION :
--   1. Dropper trg_reservations_audit (le mauvais) sur toutes les tables
--   2. Dropper trg_payments_audit (même problème sur payments)
--   3. S'assurer que trg_audit_reservations (0110, le bon) est bien actif
--   4. S'assurer que la FK est bien ON DELETE SET NULL (sécurité supplémentaire)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Supprimer les triggers problématiques (auth.uid() direct sans résolution)
-- -----------------------------------------------------------------------------

-- Sur reservations (créé dans 0030 et recréé dans 0060)
DROP TRIGGER IF EXISTS trg_reservations_audit ON public.reservations;

-- Sur payments (même pattern, créé dans 0030 et 0060)
DROP TRIGGER IF EXISTS trg_payments_audit ON public.payments;

-- Sur les autres tables avec le même mauvais pattern (0060)
DROP TRIGGER IF EXISTS trg_reservations_audit ON public.bank_statements;

-- -----------------------------------------------------------------------------
-- 2. Dropper aussi le trigger de 0150 (doublon inutile — 0110 fait mieux)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_log_reservation_change ON public.reservations;

-- -----------------------------------------------------------------------------
-- 3. Re-confirmer que trg_audit_reservations (0110) est actif et correct
--    Il utilise public.audit_trigger_fn() qui appelle audit_resolve_actor()
--    qui fait SELECT id FROM public.users WHERE auth_id = auth.uid()
--    ET qui a EXCEPTION WHEN OTHERS → swallow → jamais de FK violation
-- -----------------------------------------------------------------------------

-- Recréer proprement (idempotent)
DROP TRIGGER IF EXISTS trg_audit_reservations ON public.reservations;
CREATE TRIGGER trg_audit_reservations
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn('reservation');

-- -----------------------------------------------------------------------------
-- 4. S'assurer que la FK a bien ON DELETE SET NULL (défense en profondeur)
--    Si audit_resolve_actor() retourne un UUID qui ne correspond plus à
--    public.users (ex: user supprimé), ON DELETE SET NULL empêche tout blocage.
-- -----------------------------------------------------------------------------

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES public.users(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- -----------------------------------------------------------------------------
-- 5. S'assurer que audit_resolve_actor() est robuste (réécrit depuis 0110)
--    Version blindée avec double exception handler
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_resolve_actor()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _auth_uid uuid;
  _pub_id   uuid;
BEGIN
  -- Récupérer auth.uid() sans jamais crasher
  BEGIN
    _auth_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF _auth_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Résoudre public.users.id depuis auth_id
  BEGIN
    SELECT id INTO _pub_id
    FROM public.users
    WHERE auth_id = _auth_uid
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN _pub_id; -- NULL si pas de profil public.users — accepté par la FK
END;
$$;

REVOKE ALL ON FUNCTION public.audit_resolve_actor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_resolve_actor() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. S'assurer que audit_trigger_fn() swallow toujours les erreurs (0110)
--    Réécrit ici pour garantir que même une erreur FK inattendue ne casse rien
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity    text := tg_argv[0];
  v_action    text;
  v_entity_id uuid;
  v_hotel_id  uuid;
  v_payload   jsonb;
  v_before    jsonb;
  v_after     jsonb;
BEGIN
  BEGIN  -- Inner block : toute erreur ici est swallowed, jamais de rollback parent
    IF (tg_op = 'INSERT') THEN
      v_action    := 'created';
      v_after     := to_jsonb(NEW);
      v_entity_id := (NEW).id;
      v_hotel_id  := ((NEW).hotel_id)::uuid;
      v_payload   := jsonb_build_object('after', v_after);
    ELSIF (tg_op = 'UPDATE') THEN
      v_action    := 'updated';
      v_before    := to_jsonb(OLD);
      v_after     := to_jsonb(NEW);
      v_entity_id := (NEW).id;
      v_hotel_id  := ((NEW).hotel_id)::uuid;
      IF public.audit_jsonb_diff(v_before, v_after) = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
      v_payload := jsonb_build_object('diff', public.audit_jsonb_diff(v_before, v_after));
    ELSIF (tg_op = 'DELETE') THEN
      v_action    := 'deleted';
      v_before    := to_jsonb(OLD);
      v_entity_id := (OLD).id;
      v_hotel_id  := ((OLD).hotel_id)::uuid;
      v_payload   := jsonb_build_object('before', v_before);
    END IF;

    IF v_hotel_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
    VALUES (v_hotel_id, public.audit_resolve_actor(), v_entity, v_entity_id, v_action, v_payload);

  EXCEPTION WHEN OTHERS THEN
    -- L'audit ne doit JAMAIS faire échouer une opération métier
    RAISE NOTICE 'audit_trigger_fn swallowed error on % %: %', tg_table_name, tg_op, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_trigger_fn() FROM PUBLIC, anon;
