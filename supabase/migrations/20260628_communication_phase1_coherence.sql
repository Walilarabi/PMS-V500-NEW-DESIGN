-- =============================================================================
-- 20260628_communication_phase1_coherence.sql  (Lot L0 — cohérence)
-- =============================================================================
-- OBJECTIF :
--   C2 — Réconcilier le système de BADGES (guests.badges, écrit par
--   set_guest_badges / Flowday) avec le système de FLAGS CRM (guests.vip /
--   guests.blacklisted, écrit par crm_flag_guest / GuestFlagModal).
--
--   Sans cette migration, deux chemins d'écriture distincts touchent vip/
--   blacklisted et badges → risque de désynchronisation (un badge VIP posé
--   dans Flowday n'apparaît pas dans le CRM, et inversement).
--
-- SOLUTION :
--   Un trigger BEFORE INSERT/UPDATE sur public.guests qui maintient en
--   permanence la cohérence bidirectionnelle :
--     • si badges change  → vip/blacklisted sont dérivés des badges (badges
--       fait autorité) ;
--     • si vip/blacklisted change seul → le badge correspondant est ajouté/
--       retiré de badges.
--   Les deux RPC existantes continuent de fonctionner sans modification ;
--   le trigger garantit que les deux représentations restent identiques.
--
-- IDEMPOTENT : peut être relancée sans dommage.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guests_sync_badges_flags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_badges        text[] := COALESCE(NEW.badges, '{}');
  v_has_vip       boolean;
  v_has_blacklist boolean;
  v_badges_changed boolean;
  v_vip_changed    boolean;
  v_bl_changed     boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Union des deux représentations à la création
    IF COALESCE(NEW.vip, false) AND NOT ('vip' = ANY(v_badges)) THEN
      v_badges := array_append(v_badges, 'vip');
    END IF;
    IF COALESCE(NEW.blacklisted, false) AND NOT ('blacklist' = ANY(v_badges)) THEN
      v_badges := array_append(v_badges, 'blacklist');
    END IF;
    NEW.badges      := v_badges;
    NEW.vip         := ('vip'       = ANY(v_badges));
    NEW.blacklisted := ('blacklist' = ANY(v_badges));
    RETURN NEW;
  END IF;

  -- UPDATE : déterminer quel côté a changé
  v_badges_changed := NEW.badges       IS DISTINCT FROM OLD.badges;
  v_vip_changed    := NEW.vip          IS DISTINCT FROM OLD.vip;
  v_bl_changed     := NEW.blacklisted  IS DISTINCT FROM OLD.blacklisted;

  IF v_badges_changed THEN
    -- badges fait autorité (couvre aussi le cas "les deux changent")
    NEW.vip         := ('vip'       = ANY(v_badges));
    NEW.blacklisted := ('blacklist' = ANY(v_badges));
  ELSE
    -- seuls vip/blacklisted ont bougé → on les replie dans badges
    IF v_vip_changed THEN
      IF COALESCE(NEW.vip, false) AND NOT ('vip' = ANY(v_badges)) THEN
        v_badges := array_append(v_badges, 'vip');
      ELSIF NOT COALESCE(NEW.vip, false) AND ('vip' = ANY(v_badges)) THEN
        v_badges := array_remove(v_badges, 'vip');
      END IF;
    END IF;
    IF v_bl_changed THEN
      IF COALESCE(NEW.blacklisted, false) AND NOT ('blacklist' = ANY(v_badges)) THEN
        v_badges := array_append(v_badges, 'blacklist');
      ELSIF NOT COALESCE(NEW.blacklisted, false) AND ('blacklist' = ANY(v_badges)) THEN
        v_badges := array_remove(v_badges, 'blacklist');
      END IF;
    END IF;
    NEW.badges := v_badges;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guests_sync_badges_flags ON public.guests;
CREATE TRIGGER trg_guests_sync_badges_flags
  BEFORE INSERT OR UPDATE OF badges, vip, blacklisted ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.guests_sync_badges_flags();

-- -----------------------------------------------------------------------------
-- Backfill : replier l'état vip/blacklisted existant dans badges (et inversement)
-- -----------------------------------------------------------------------------
UPDATE public.guests
   SET badges = (
     SELECT ARRAY(SELECT DISTINCT x FROM unnest(
       COALESCE(badges, '{}')
       || CASE WHEN COALESCE(vip, false)         THEN ARRAY['vip']       ELSE ARRAY[]::text[] END
       || CASE WHEN COALESCE(blacklisted, false) THEN ARRAY['blacklist'] ELSE ARRAY[]::text[] END
     ) AS x)
   )
 WHERE COALESCE(vip, false)
    OR COALESCE(blacklisted, false)
    OR ('vip' = ANY(COALESCE(badges, '{}')))
    OR ('blacklist' = ANY(COALESCE(badges, '{}')));

-- =============================================================================
-- FIN 20260628_communication_phase1_coherence.sql
-- =============================================================================
