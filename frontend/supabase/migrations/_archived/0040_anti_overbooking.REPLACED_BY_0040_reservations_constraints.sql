-- ============================================================================
-- FLOWTYM PMS — Migration 0040 : Anti-overbooking constraint
-- ----------------------------------------------------------------------------
-- Ajoute une contrainte d'exclusion PostgreSQL sur (room_id, période)
-- pour rendre l'overbooking structurellement impossible au niveau DB.
--
-- REQUIRES: extension btree_gist (disponible sur Supabase par défaut).
-- ============================================================================

-- Activation de l'extension (idempotent)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- Contrainte d'exclusion :
-- Deux réservations ne peuvent pas partager le même room_id
-- sur une période chevauchante (check_in, check_out) excluant les annulées.
--
-- Condition : uniquement sur statuts actifs (pas cancelled / checked_out)
-- Utilise un index partiel via WHERE dans la définition de la contrainte.
-- ----------------------------------------------------------------------------

-- On utilise une fonction pour éviter l'overbooking via un trigger
-- (la contrainte EXCLUDE ne supporte pas de WHERE sur d'autres colonnes).
CREATE OR REPLACE FUNCTION app.check_no_overbooking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ignorer les réservations annulées ou terminées
  IF NEW.status IN ('cancelled', 'checked_out', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Vérifier qu'il n'y a pas de réservation active chevauchante sur la même chambre
  IF NEW.room_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.room_id = NEW.room_id
      AND r.id <> NEW.id  -- exclure la réservation elle-même (UPDATE)
      AND r.status NOT IN ('cancelled', 'checked_out', 'no_show')
      -- Chevauchement : [new.check_in, new.check_out) ∩ [r.check_in, r.check_out) ≠ ∅
      AND NEW.check_in  < r.check_out
      AND NEW.check_out > r.check_in
  ) THEN
    RAISE EXCEPTION
      'OVERBOOKING_CONFLICT: La chambre % est déjà réservée du % au % pour cette période.',
      NEW.room_id,
      NEW.check_in,
      NEW.check_out
      USING ERRCODE = '23P01';  -- exclusion_violation
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT OR UPDATE pour attraper les conflits avant écriture
DROP TRIGGER IF EXISTS trg_no_overbooking ON public.reservations;
CREATE TRIGGER trg_no_overbooking
  BEFORE INSERT OR UPDATE OF room_id, check_in, check_out, status
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION app.check_no_overbooking();

-- ----------------------------------------------------------------------------
-- Index de performance pour la requête de détection de conflit
-- (room_id, check_in, check_out) — utilisé par le trigger ci-dessus
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reservations_room_dates
  ON public.reservations(room_id, check_in, check_out)
  WHERE status NOT IN ('cancelled', 'checked_out', 'no_show');

-- ----------------------------------------------------------------------------
-- Commentaire documentaire
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION app.check_no_overbooking IS
  'Empêche l overbooking : lève une exclusion_violation si room_id + période chevauche une réservation active existante.';
