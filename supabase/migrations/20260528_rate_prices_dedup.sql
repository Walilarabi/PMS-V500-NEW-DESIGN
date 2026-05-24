-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM — Purge des doublons rate_prices (Phase 8 — bug push RMS)
--
-- Symptôme : après plusieurs push RMS sur la même date, la table
-- rate_prices accumule des doublons (même hotel_id, plan_id,
-- room_type_code, stay_date). L'affichage Calendrier rend alors
-- N cellules au lieu d'une seule.
--
-- Cause racine : pas de contrainte UNIQUE sur la clé fonctionnelle
-- (hotel_id, plan_id, room_type_code, stay_date).
--
-- Actions :
--   1. Purge des doublons existants (garde la version la plus récente)
--   2. Ajout de la contrainte UNIQUE pour empêcher toute récidive
--   3. Index de perf
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Purge des doublons rate_prices ─────────────────────────────────────
DELETE FROM rate_prices rp
WHERE EXISTS (
  SELECT 1
    FROM rate_prices rp2
   WHERE rp2.hotel_id = rp.hotel_id
     AND rp2.plan_id = rp.plan_id
     AND rp2.room_type_code = rp.room_type_code
     AND rp2.stay_date = rp.stay_date
     AND rp2.id <> rp.id
     AND (
       COALESCE(rp2.version, 0) > COALESCE(rp.version, 0)
       OR (COALESCE(rp2.version, 0) = COALESCE(rp.version, 0)
           AND rp2.id > rp.id)
     )
);

-- ─── 2. Contrainte UNIQUE pour empêcher toute récidive ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'rate_prices_hotel_plan_room_date_unique'
  ) THEN
    ALTER TABLE rate_prices
      ADD CONSTRAINT rate_prices_hotel_plan_room_date_unique
      UNIQUE (hotel_id, plan_id, room_type_code, stay_date);
  END IF;
END $$;

-- ─── 3. Index de perf ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rate_prices_hotel_date
  ON rate_prices(hotel_id, stay_date);

CREATE INDEX IF NOT EXISTS idx_rate_prices_plan_room
  ON rate_prices(hotel_id, plan_id, room_type_code);

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION 20260528_rate_prices_dedup.sql
-- ═══════════════════════════════════════════════════════════════════════════
