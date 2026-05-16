-- ============================================================================
-- FLOWTYM RMS — Initialisation Folkestone Opéra (Stratégie B)
-- ----------------------------------------------------------------------------
-- Source : H2258__FOLKESTONE_OPERA_1.xls + H2258__FOLKESTONE_OPERA__Planning.xlsx
-- Périmètre : 8 chambres réelles × 5 plans tarifaires principaux
-- 
-- IMPORTANT : 
--   * Ce script ne charge PAS les rate_prices ni rate_restrictions.
--     Ces données (230 jours × ~38 cellules) sont chargées séparément via
--     le script Python `folkestone_planning_import.py` (cf. workflow Actions).
--   * Idempotent : peut être relancé sans dommage.
-- ============================================================================

-- ─── Nettoyage préalable (au cas où) ─────────────────────────────────────
-- À décommenter si tu as fait des essais précédents avec d'autres UUIDs
-- DELETE FROM public.rate_prices WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';
-- DELETE FROM public.rate_restrictions WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';
-- DELETE FROM public.pricing_rules WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';
-- DELETE FROM public.rate_plans WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';
-- DELETE FROM public.rooms WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';

-- ─── 1. Chambres (8 types réels Folkestone) ──────────────────────────────
INSERT INTO public.rooms 
  (hotel_id, number, type, category, max_occupancy, room_type_code, active)
VALUES
  -- DBL-CLASSIC = chambre de référence cascade
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '101', 'Double Classique',                 'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '102', 'Double Single Use Classique',      'Classique', 1, 'SGL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '103', 'Twin Classique',                   'Classique', 2, 'TWIN-CLASSIC',    true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '104', 'Double Classique Terrasse',        'Classique', 2, 'DBL-CLASSIC-TER', true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '201', 'Double Deluxe',                    'Deluxe',    2, 'DBL-DELUXE',      true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '202', 'Twin Deluxe',                      'Deluxe',    2, 'TWIN-DELUXE',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '203', 'Double Deluxe Terrasse',           'Deluxe',    2, 'DBL-DELUXE-TER',  true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '301', 'Deux Chambres Adjacentes 4 personnes', 'Familiale', 4, 'ADJ-4P',      true);

-- ─── 2. Rate plans (5 plans principaux, Stratégie B) ────────────────────
-- IDs déterministes pour faciliter la cascade
INSERT INTO public.rate_plans 
  (id, hotel_id, plan_code, plan_name, pension_type, calc_mode, calc_value, is_reference, is_active)
VALUES
  ('a4685000-0000-0000-0000-000000004685',
   '02b9eb0e-89ef-45de-ba8e-20d4b41c500c',
   'RACK-RO-FLEX', 'Rack Room-only Flexible', 'RO', 'fixed', 0, true, true),

  ('a6820070-0000-0000-0000-000000682007',
   '02b9eb0e-89ef-45de-ba8e-20d4b41c500c',
   'RACK-RO-NANR', 'Rack Room-only Non Remboursable', 'RO', 'derived', -5, false, true),

  ('a6815320-0000-0000-0000-000000681532',
   '02b9eb0e-89ef-45de-ba8e-20d4b41c500c',
   'OTA-RO-FLEX', 'OTA Room-only Flexible', 'RO', 'derived', 0, false, true),

  ('a0457780-0000-0000-0000-000000045778',
   '02b9eb0e-89ef-45de-ba8e-20d4b41c500c',
   'OTA-RO-NANR', 'OTA Room-only Non Remboursable', 'RO', 'derived', -5, false, true),

  ('a2471840-0000-0000-0000-000000247184',
   '02b9eb0e-89ef-45de-ba8e-20d4b41c500c',
   'OTA-BB-FLEX-2P', 'OTA Bed & Breakfast 2 pax Flex', 'BB', 'derived', 15, false, true);

-- ─── 3. Pricing rules ───────────────────────────────────────────────────
-- Référence cascade : DBL-CLASSIC × RACK-RO-FLEX
-- Diffs estimés depuis les vraies données du Planning Folkestone :
--   * SGL-CLASSIC      ≈ -20€  (chambre single)
--   * TWIN-CLASSIC     ≈   0€  (même prix que double)
--   * DBL-CLASSIC-TER  ≈ +20€  (terrasse)
--   * DBL-DELUXE       ≈ +50€  (deluxe)
--   * TWIN-DELUXE      ≈ +50€
--   * DBL-DELUXE-TER   ≈ +70€  (deluxe + terrasse)
--   * ADJ-4P           ≈ +150€ (2 chambres adjacentes 4 pax)
-- Les vrais prix individuels seront chargés via le script Python ;
-- ces diffs servent uniquement à la cascade FUTURE (quand tu changeras
-- le prix de référence dans la grille).
INSERT INTO public.pricing_rules 
  (hotel_id, reference_room_type_code, reference_plan_id, room_rules, plan_rules)
VALUES (
  '02b9eb0e-89ef-45de-ba8e-20d4b41c500c',
  'DBL-CLASSIC',
  'a4685000-0000-0000-0000-000000004685',
  '[
    {"room_type_code": "SGL-CLASSIC",     "diff_type": "fixed", "diff_value": -20},
    {"room_type_code": "TWIN-CLASSIC",    "diff_type": "fixed", "diff_value": 0},
    {"room_type_code": "DBL-CLASSIC-TER", "diff_type": "fixed", "diff_value": 20},
    {"room_type_code": "DBL-DELUXE",      "diff_type": "fixed", "diff_value": 50},
    {"room_type_code": "TWIN-DELUXE",     "diff_type": "fixed", "diff_value": 50},
    {"room_type_code": "DBL-DELUXE-TER",  "diff_type": "fixed", "diff_value": 70},
    {"room_type_code": "ADJ-4P",          "diff_type": "fixed", "diff_value": 150}
  ]'::jsonb,
  '[
    {"plan_id": "a6820070-0000-0000-0000-000000682007", "diff_type": "percent", "diff_value": -5},
    {"plan_id": "a6815320-0000-0000-0000-000000681532", "diff_type": "fixed",   "diff_value": 0},
    {"plan_id": "a0457780-0000-0000-0000-000000045778", "diff_type": "percent", "diff_value": -5},
    {"plan_id": "a2471840-0000-0000-0000-000000247184", "diff_type": "fixed",   "diff_value": 15}
  ]'::jsonb
)
ON CONFLICT (hotel_id) DO UPDATE SET
  reference_room_type_code = EXCLUDED.reference_room_type_code,
  reference_plan_id        = EXCLUDED.reference_plan_id,
  room_rules               = EXCLUDED.room_rules,
  plan_rules               = EXCLUDED.plan_rules,
  version                  = public.pricing_rules.version + 1;

-- ─── 4. Vérification ────────────────────────────────────────────────────
SELECT 'rooms' AS table_name, COUNT(*) AS nb FROM public.rooms 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
UNION ALL
SELECT 'rate_plans', COUNT(*) FROM public.rate_plans 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c' AND deleted_at IS NULL
UNION ALL
SELECT 'pricing_rules', COUNT(*) FROM public.pricing_rules 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
UNION ALL
SELECT 'rate_prices (pas encore chargé)', COUNT(*) FROM public.rate_prices 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
UNION ALL
SELECT 'competitor_rates (Lighthouse)', COUNT(*) FROM public.competitor_rates 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';
