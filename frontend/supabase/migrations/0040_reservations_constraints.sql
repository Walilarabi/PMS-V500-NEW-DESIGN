-- ============================================================================
-- FLOWTYM PMS — Migration 0040 : Contraintes de réservation (UNIFIÉ)
-- ============================================================================
--
-- HISTORIQUE :
--   • 0030 : colonne `version` + trigger audit_reservations
--   • 0040 original (main) : anti-overbooking trigger
--   • conflict_2109 0040 : voulait remplacer anti-overbooking par version bump
--     → REFUSÉ : l'anti-overbooking est NON NÉGOCIABLE (FLOWTYM_MASTER_RULES)
--
-- CETTE MIGRATION :
--   1. Conserve et renforce l'anti-overbooking DB
--   2. Ajoute le version-bump trigger (complémentaire, pas de remplacement)
--   3. Ajoute les index de performance
--   4. Documente explicitement l'invariant métier
--
-- INVARIANT MÉTIER ABSOLU :
--   Deux réservations actives NE PEUVENT PAS partager le même room_id
--   sur une période de dates chevauchante.
--   Cette contrainte est garantie au niveau DB — elle ne peut pas être
--   contournée par du code applicatif défaillant ou des agents IA.
--
-- REQUIRES: extension btree_gist (disponible sur Supabase par défaut)
-- ============================================================================

-- Idempotent
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- PARTIE 1 : ANTI-OVERBOOKING (NON NÉGOCIABLE)
-- ============================================================================
-- Principe : trigger BEFORE INSERT OR UPDATE qui examine toutes les
-- réservations actives pour la même chambre et rejette tout chevauchement.
--
-- Statuts exclus du contrôle (réservations inactives) :
--   cancelled  — annulée par le client ou l'hôtel
--   checked_out — séjour terminé
--   no_show    — client non présenté
--
-- Code d'erreur PostgreSQL 23P01 (exclusion_violation) utilisé pour permettre
-- une détection précise côté client (mapSupabaseError).
-- ============================================================================

CREATE OR REPLACE FUNCTION app.check_no_overbooking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_conflict_ref text;
  v_conflict_in  date;
  v_conflict_out date;
BEGIN
  -- Réservations annulées ou terminées : pas de contrôle de chevauchement
  IF NEW.status IN ('cancelled', 'checked_out', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Pas de chambre assignée : pas d'overbooking possible
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rechercher une réservation active chevauchante sur la même chambre
  -- Chevauchement strict : [new.check_in, new.check_out) ∩ [r.check_in, r.check_out) ≠ ∅
  --   ⟺  NEW.check_in < r.check_out  AND  NEW.check_out > r.check_in
  SELECT r.reference, r.check_in, r.check_out
    INTO v_conflict_ref, v_conflict_in, v_conflict_out
    FROM public.reservations r
   WHERE r.room_id  = NEW.room_id
     AND r.id      <> NEW.id   -- exclure la réservation elle-même (cas UPDATE)
     AND r.status  NOT IN ('cancelled', 'checked_out', 'no_show')
     AND NEW.check_in  < r.check_out
     AND NEW.check_out > r.check_in
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'OVERBOOKING_CONFLICT: Chambre % déjà réservée (réf. %) du % au %. '
      'Tentative : du % au %.',
      NEW.room_id,
      coalesce(v_conflict_ref, '???'),
      v_conflict_in,
      v_conflict_out,
      NEW.check_in,
      NEW.check_out
      USING ERRCODE = '23P01';  -- exclusion_violation — détectable par mapSupabaseError
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT OR UPDATE — avant écriture, jamais après
DROP TRIGGER IF EXISTS trg_no_overbooking ON public.reservations;
CREATE TRIGGER trg_no_overbooking
  BEFORE INSERT OR UPDATE OF room_id, check_in, check_out, status
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION app.check_no_overbooking();

COMMENT ON FUNCTION app.check_no_overbooking IS
  'INVARIANT MÉTIER CRITIQUE — Anti-overbooking : '
  'lève exclusion_violation (23P01) si room_id + période chevauche '
  'une réservation active. NE PAS SUPPRIMER ni désactiver sans validation '
  'architecturale complète (FLOWTYM_MASTER_RULES §PRIORITÉ MÉTIER).';

-- ============================================================================
-- PARTIE 2 : VERSION BUMP (OPTIMISTIC LOCKING — complémentaire)
-- ============================================================================
-- Incrémente automatiquement reservations.version à chaque UPDATE.
-- Permet au planning (drag&drop) de détecter les modifications concurrentes.
-- Note : la colonne version est créée dans 0030_reservations_audit_locking.sql.
-- Ce trigger remplace / renforce la gestion du versioning.
-- ============================================================================

CREATE OR REPLACE FUNCTION app.bump_reservation_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, app, pg_temp
AS $$
BEGIN
  -- Incrémenter uniquement si le client n'a pas déjà bumped
  -- (évite le double-incrément si le caller envoie version+1)
  IF NEW.version IS NULL OR NEW.version <= OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_version_bump ON public.reservations;
CREATE TRIGGER trg_reservations_version_bump
  BEFORE UPDATE
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION app.bump_reservation_version();

COMMENT ON FUNCTION app.bump_reservation_version IS
  'Optimistic locking : incrémente reservations.version à chaque UPDATE '
  'pour que le planning détecte les modifications concurrentes. '
  'COMPLÉMENTAIRE à trg_no_overbooking, ne le remplace pas.';

-- ============================================================================
-- PARTIE 3 : INDEX DE PERFORMANCE
-- ============================================================================
-- Index partiel utilisé par check_no_overbooking() lors de la recherche
-- de conflits. Exclut les statuts inactifs pour un index compact.

CREATE INDEX IF NOT EXISTS idx_reservations_room_dates
  ON public.reservations(room_id, check_in, check_out)
  WHERE status NOT IN ('cancelled', 'checked_out', 'no_show');

-- Index pour le planning Gantt (plage de dates, hotel_id)
CREATE INDEX IF NOT EXISTS idx_reservations_hotel_checkin
  ON public.reservations(hotel_id, check_in, check_out)
  WHERE status NOT IN ('cancelled');

-- Index pour les listes triées par date de modification (temps réel)
CREATE INDEX IF NOT EXISTS idx_reservations_updated_at
  ON public.reservations(updated_at DESC);

-- ============================================================================
-- VÉRIFICATION SELF-DOCUMENTING
-- ============================================================================
-- Ces commentaires sont stockés dans pg_description et interrogeables via
-- SELECT obj_description(oid) — utile pour les audits de conformité.

COMMENT ON INDEX idx_reservations_room_dates IS
  'Supporte check_no_overbooking() — NE PAS SUPPRIMER sans revalider '
  'les performances du trigger anti-overbooking sous charge.';
