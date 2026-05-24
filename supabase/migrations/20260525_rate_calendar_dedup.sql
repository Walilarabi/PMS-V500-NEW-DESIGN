-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM — Nettoyage des doublons Calendrier tarifaire (Phase 4 — bug fix)
--
-- Symptôme : "dédoublement Ouverture/Fermeture + 3 lignes tarifaires
-- dupliquées pour un même plan tarifaire".
--
-- Cause racine :
--   - rate_plans : pas de contrainte UNIQUE sur (hotel_id, plan_code) →
--     les imports successifs créaient des doublons silencieux
--   - rate_restrictions : pas d'index UNIQUE sur (hotel_id, room_type_code,
--     stay_date) → idem
--
-- Actions :
--   1. Purge des doublons existants (garde le plus récent par created_at)
--   2. Ajout des contraintes UNIQUE pour empêcher toute récidive
--   3. Pas de DROP : opérations idempotentes pour migration progressive
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Purge des doublons rate_plans ──────────────────────────────────────
-- Pour chaque (hotel_id, plan_code), garde la ligne avec le created_at
-- le plus récent. Les autres sont supprimées (CASCADE sur rate_prices).
DELETE FROM rate_plans rp
WHERE EXISTS (
  SELECT 1
    FROM rate_plans rp2
   WHERE rp2.hotel_id = rp.hotel_id
     AND LOWER(TRIM(rp2.plan_code)) = LOWER(TRIM(rp.plan_code))
     AND rp2.id <> rp.id
     AND (rp2.created_at > rp.created_at
          OR (rp2.created_at = rp.created_at AND rp2.id > rp.id))
);

-- ─── 2. Purge des doublons rate_restrictions ───────────────────────────────
-- Pour chaque (hotel_id, room_type_code, stay_date), garde la ligne avec
-- la version la plus élevée (ou created_at si version absente).
DELETE FROM rate_restrictions rr
WHERE EXISTS (
  SELECT 1
    FROM rate_restrictions rr2
   WHERE rr2.hotel_id = rr.hotel_id
     AND rr2.room_type_code = rr.room_type_code
     AND rr2.stay_date = rr.stay_date
     AND rr2.id <> rr.id
     AND (COALESCE(rr2.version, 0) > COALESCE(rr.version, 0)
          OR (COALESCE(rr2.version, 0) = COALESCE(rr.version, 0)
              AND rr2.id > rr.id))
);

-- ─── 3. Contraintes UNIQUE pour empêcher toute récidive ────────────────────
-- Idempotent : ajout uniquement si absent. Le LOWER(TRIM(...)) est géré
-- côté application (cohérence de casse).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'rate_plans_hotel_plan_code_unique'
  ) THEN
    ALTER TABLE rate_plans
      ADD CONSTRAINT rate_plans_hotel_plan_code_unique
      UNIQUE (hotel_id, plan_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'rate_restrictions_hotel_room_date_unique'
  ) THEN
    ALTER TABLE rate_restrictions
      ADD CONSTRAINT rate_restrictions_hotel_room_date_unique
      UNIQUE (hotel_id, room_type_code, stay_date);
  END IF;
END $$;

-- ─── 4. Index supplémentaires pour perf ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rate_plans_hotel_code_active
  ON rate_plans(hotel_id, plan_code, is_active);

CREATE INDEX IF NOT EXISTS idx_rate_restrictions_hotel_room_date
  ON rate_restrictions(hotel_id, room_type_code, stay_date);

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION 20260525_rate_calendar_dedup.sql
-- ═══════════════════════════════════════════════════════════════════════════
