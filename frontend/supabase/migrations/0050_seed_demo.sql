-- ============================================================================
-- FLOWTYM PMS — Seed 0050 : Données de démo Mas Provencal Aix
-- Hôtel ID : 00000000-0000-0000-0000-000000000001
-- Date de référence : 2026-05-13 (aujourd'hui)
-- ============================================================================

DO $$
DECLARE
  v_hotel_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_today     date := '2026-05-13';

  -- Room IDs
  r101 uuid := gen_random_uuid();
  r102 uuid := gen_random_uuid();
  r103 uuid := gen_random_uuid();
  r104 uuid := gen_random_uuid();
  r201 uuid := gen_random_uuid();
  r202 uuid := gen_random_uuid();
  r203 uuid := gen_random_uuid();
  r204 uuid := gen_random_uuid();
  r301 uuid := gen_random_uuid();
  r302 uuid := gen_random_uuid();
  r401 uuid := gen_random_uuid();
  r402 uuid := gen_random_uuid();

  -- Guest IDs
  g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
  g3 uuid := gen_random_uuid();
  g4 uuid := gen_random_uuid();
  g5 uuid := gen_random_uuid();
  g6 uuid := gen_random_uuid();
  g7 uuid := gen_random_uuid();
  g8 uuid := gen_random_uuid();
  g9 uuid := gen_random_uuid();
  g10 uuid := gen_random_uuid();

BEGIN

-- ─── 1. Chambres ─────────────────────────────────────────────────────────────
-- Nettoyage préalable pour idempotence
DELETE FROM public.rooms WHERE hotel_id = v_hotel_id;

INSERT INTO public.rooms (id, hotel_id, number, type, category, floor, status, housekeeping_status, capacity, base_rate, description) VALUES
  -- Étage 1 — Classiques
  (r101, v_hotel_id, '101', 'DBL', 'CL',  1, 'occupied', 'dirty',     2, 180.00, 'Chambre double classique, vue jardin'),
  (r102, v_hotel_id, '102', 'DBL', 'CL',  1, 'occupied', 'occupied',  2, 180.00, 'Chambre double classique, vue jardin'),
  (r103, v_hotel_id, '103', 'SGL', 'CL',  1, 'clean',    'clean',     1, 120.00, 'Chambre simple classique'),
  (r104, v_hotel_id, '104', 'TWN', 'CL',  1, 'dirty',    'dirty',     2, 190.00, 'Chambre twin classique'),
  -- Étage 2 — Supérieures
  (r201, v_hotel_id, '201', 'DBL', 'SUP', 2, 'clean',    'clean',     2, 220.00, 'Chambre double supérieure, vue piscine'),
  (r202, v_hotel_id, '202', 'DBL', 'SUP', 2, 'occupied', 'occupied',  2, 220.00, 'Chambre double supérieure, balcon'),
  (r203, v_hotel_id, '203', 'TWN', 'SUP', 2, 'clean',    'inspected', 2, 230.00, 'Chambre twin supérieure'),
  (r204, v_hotel_id, '204', 'DBL', 'SUP', 2, 'dirty',    'dirty',     2, 220.00, 'Chambre double supérieure'),
  -- Étage 3 — Deluxe
  (r301, v_hotel_id, '301', 'DBL', 'DLX', 3, 'occupied', 'occupied',  2, 280.00, 'Chambre double deluxe, terrasse'),
  (r302, v_hotel_id, '302', 'DBL', 'DLX', 3, 'clean',    'clean',     2, 280.00, 'Chambre double deluxe, terrasse'),
  -- Étage 4 — Suites
  (r401, v_hotel_id, '401', 'STE', 'JS',  4, 'occupied', 'occupied',  4, 420.00, 'Junior Suite avec salon et baignoire'),
  (r402, v_hotel_id, '402', 'STE', 'PS',  4, 'clean',    'clean',     4, 680.00, 'Suite Prestige avec jacuzzi et terrasse panoramique')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Guests ───────────────────────────────────────────────────────────────
DELETE FROM public.guests WHERE hotel_id = v_hotel_id;

INSERT INTO public.guests (id, hotel_id, first_name, last_name, email, phone, nationality, vip_level, total_stays, notes) VALUES
  (g1,  v_hotel_id, 'Sophie',    'Dubois',     'sophie.dubois@email.fr',    '+33 6 12 34 56 78', 'FR', 0, 3,  NULL),
  (g2,  v_hotel_id, 'Marc',      'Laurent',    'marc.laurent@company.com',  '+33 6 23 45 67 89', 'FR', 1, 8,  'Client fidèle — demande chambre calme'),
  (g3,  v_hotel_id, 'Emma',      'Wilson',     'emma.wilson@gmail.com',     '+44 7911 123456',   'GB', 0, 1,  NULL),
  (g4,  v_hotel_id, 'Thomas',    'Müller',     'thomas.muller@web.de',      '+49 170 1234567',   'DE', 0, 2,  'Allergie aux plumes'),
  (g5,  v_hotel_id, 'Isabella',  'Rossi',      'i.rossi@mail.it',           '+39 333 1234567',   'IT', 2, 12, 'VIP — Champagne offert à l arrivée'),
  (g6,  v_hotel_id, 'Jean-Paul', 'Bertrand',   'jpbertrand@groupe.fr',      '+33 6 45 67 89 01', 'FR', 0, 1,  'Groupe Bertrand & Associés — 4 chambres'),
  (g7,  v_hotel_id, 'Yuki',      'Tanaka',     'y.tanaka@softbank.jp',      '+81 90 1234 5678',  'JP', 1, 5,  'Préfère oreiller ferme'),
  (g8,  v_hotel_id, 'Chloé',     'Martin',     'chloe.martin@outlook.fr',   '+33 6 56 78 90 12', 'FR', 0, 2,  NULL),
  (g9,  v_hotel_id, 'Ahmad',     'Al-Rashidi', 'a.rashidi@invest.ae',       '+971 50 123 4567',  'AE', 2, 7,  'VIP — Suite uniquement. Transfert aéroport.'),
  (g10, v_hotel_id, 'Léa',       'Fontaine',   'lea.fontaine@media.fr',     '+33 6 67 89 01 23', 'FR', 0, 1,  NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Réservations ─────────────────────────────────────────────────────────
-- Couvre : arrivées du jour, départs du jour, in-house, demain, J+7

DELETE FROM public.reservations WHERE hotel_id = v_hotel_id;

INSERT INTO public.reservations (
  id, hotel_id, room_id, guest_id,
  reference, guest_name, guest_email, guest_phone,
  room_number, room_type, room_category,
  check_in, check_out, nights,
  adults, children, pax,
  status, checkin_status, payment_status,
  total_amount, paid_amount, solde,
  source, segment, notes, version
) VALUES

-- ── Arrivées aujourd'hui (check_in = today) ──────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r103, g3,
  'RES-001', 'Emma Wilson', 'emma.wilson@gmail.com', '+44 7911 123456',
  '103', 'SGL', 'CL', v_today, v_today + 3, 3,
  1, 0, 1, 'confirmed', 'expected', 'unpaid',
  360.00, 0.00, 360.00, 'BOOKING', 'loisir',
  'Arrivée vers 15h. Vue jardin demandée.', 1
),
(
  gen_random_uuid(), v_hotel_id, r201, g4,
  'RES-002', 'Thomas Müller', 'thomas.muller@web.de', '+49 170 1234567',
  '201', 'DBL', 'SUP', v_today, v_today + 2, 2,
  2, 0, 2, 'confirmed', 'expected', 'partial',
  440.00, 220.00, 220.00, 'EXPEDIA', 'loisir',
  'Allergie aux plumes — prévoir oreillers synthétiques.', 1
),
(
  gen_random_uuid(), v_hotel_id, r402, g9,
  'RES-003', 'Ahmad Al-Rashidi', 'a.rashidi@invest.ae', '+971 50 123 4567',
  '402', 'STE', 'PS', v_today, v_today + 5, 5,
  2, 0, 2, 'confirmed', 'expected', 'paid',
  3400.00, 3400.00, 0.00, 'DIRECT', 'affaires',
  'VIP Suite Prestige. Transfert aéroport 14h. Champagne Billecart-Salmon.', 1
),

-- ── Départs aujourd'hui (check_out = today) ───────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r101, g1,
  'RES-004', 'Sophie Dubois', 'sophie.dubois@email.fr', '+33 6 12 34 56 78',
  '101', 'DBL', 'CL', v_today - 2, v_today, 2,
  2, 0, 2, 'checked_in', 'checked_in', 'paid',
  360.00, 360.00, 0.00, 'DIRECT', 'loisir',
  'Départ prévu avant 11h.', 1
),
(
  gen_random_uuid(), v_hotel_id, r301, g5,
  'RES-005', 'Isabella Rossi', 'i.rossi@mail.it', '+39 333 1234567',
  '301', 'DBL', 'DLX', v_today - 4, v_today, 4,
  2, 1, 3, 'checked_in', 'checked_in', 'paid',
  1120.00, 1120.00, 0.00, 'BOOKING', 'loisir',
  'VIP — Champagne offert servi hier soir. Excellent séjour.', 1
),

-- ── In-house (check_in < today < check_out) ───────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r102, g2,
  'RES-006', 'Marc Laurent', 'marc.laurent@company.com', '+33 6 23 45 67 89',
  '102', 'DBL', 'CL', v_today - 1, v_today + 2, 3,
  1, 0, 1, 'checked_in', 'checked_in', 'partial',
  540.00, 270.00, 270.00, 'DIRECT', 'affaires',
  'Client fidèle. Chambre calme demandée côté jardin.', 1
),
(
  gen_random_uuid(), v_hotel_id, r202, g7,
  'RES-007', 'Yuki Tanaka', 'y.tanaka@softbank.jp', '+81 90 1234 5678',
  '202', 'DBL', 'SUP', v_today - 2, v_today + 1, 3,
  2, 0, 2, 'checked_in', 'checked_in', 'paid',
  660.00, 660.00, 0.00, 'EXPEDIA', 'affaires',
  'Préfère oreiller ferme. Petit-déjeuner en chambre à 7h30.', 1
),
(
  gen_random_uuid(), v_hotel_id, r401, g6,
  'RES-008', 'Jean-Paul Bertrand', 'jpbertrand@groupe.fr', '+33 6 45 67 89 01',
  '401', 'STE', 'JS', v_today - 1, v_today + 3, 4,
  3, 1, 4, 'checked_in', 'checked_in', 'unpaid',
  1680.00, 0.00, 1680.00, 'DIRECT', 'groupe',
  'Séminaire Bertrand & Associés. Facturation société.', 1
),

-- ── Arrivées demain ───────────────────────────────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r203, g8,
  'RES-009', 'Chloé Martin', 'chloe.martin@outlook.fr', '+33 6 56 78 90 12',
  '203', 'TWN', 'SUP', v_today + 1, v_today + 4, 3,
  2, 0, 2, 'confirmed', 'expected', 'paid',
  690.00, 690.00, 0.00, 'AIRBNB', 'loisir',
  NULL, 1
),
(
  gen_random_uuid(), v_hotel_id, r302, g10,
  'RES-010', 'Léa Fontaine', 'lea.fontaine@media.fr', '+33 6 67 89 01 23',
  '302', 'DBL', 'DLX', v_today + 1, v_today + 3, 2,
  2, 0, 2, 'confirmed', 'expected', 'unpaid',
  560.00, 0.00, 560.00, 'BOOKING', 'loisir',
  NULL, 1
),

-- ── Réservations futures J+3 à J+10 ──────────────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r101, g1,
  'RES-011', 'Sophie Dubois', 'sophie.dubois@email.fr', '+33 6 12 34 56 78',
  '101', 'DBL', 'CL', v_today + 7, v_today + 10, 3,
  2, 0, 2, 'confirmed', 'expected', 'partial',
  540.00, 270.00, 270.00, 'DIRECT', 'loisir',
  'Retour client — même chambre demandée.', 1
),
(
  gen_random_uuid(), v_hotel_id, r104, g4,
  'RES-012', 'Thomas Müller', 'thomas.muller@web.de', '+49 170 1234567',
  '104', 'TWN', 'CL', v_today + 5, v_today + 8, 3,
  2, 1, 3, 'confirmed', 'expected', 'unpaid',
  570.00, 0.00, 570.00, 'EXPEDIA', 'loisir',
  NULL, 1
),

-- ── Réservation annulée (pour tester le filtre) ───────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r204, NULL,
  'RES-013', 'Client Annulé', NULL, NULL,
  '204', 'DBL', 'SUP', v_today, v_today + 2, 2,
  2, 0, 2, 'cancelled', NULL, 'unpaid',
  440.00, 0.00, 440.00, 'BOOKING', 'loisir',
  'Annulation J-1 — pénalité applicable.', 1
)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Données reconciliation (pour Reconciliation Center) ──────────────────
DELETE FROM public.reconciliation_lines WHERE hotel_id = v_hotel_id;

INSERT INTO public.reconciliation_lines (
  hotel_id, source, reference, description,
  amount, currency, line_date, status, match_score, match_delta
) VALUES
  (v_hotel_id, 'BOOKING',    'BK-PAYOUT-2026-04-15', 'Booking.com — Payout mid-Apr',   707.20, 'EUR', '2026-04-15', 'pending', 60.40, 4.80),
  (v_hotel_id, 'EXPEDIA',    'EX-PAYOUT-2026-04-29', 'Expedia — Payout Apr',            244.32, 'EUR', '2026-04-29', 'pending', 84.00, 0.00),
  (v_hotel_id, 'BOOKING',    'BK-PAYOUT-2026-04-30', 'Booking.com — Payout Apr',       1862.50, 'EUR', '2026-05-03', 'pending', NULL,  NULL),
  (v_hotel_id, 'BANK_HOTEL', 'CB-2026-05-01',        'Encaissement CB direct',          1750.00, 'EUR', '2026-05-05', 'pending', 80.00, 0.00),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-001',      'Test CSV import 1',                250.00, 'EUR', '2026-05-10', 'pending', 87.64, 5.68),
  (v_hotel_id, 'BOOKING',    'TEST-RECON-001',       NULL,                               100.00, 'EUR', '2026-05-10', 'pending', 49.00, 193.40),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-002',      'Test CSV import 2',                375.50, 'EUR', '2026-05-11', 'pending', 49.00, 82.10),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-003',      'Test CSV import 3',                118.75, 'EUR', '2026-05-12', 'pending', 47.00, 174.65),
  -- 1 ligne rapprochée
  (v_hotel_id, 'BOOKING',    'BK-MATCHED-001',       'Booking.com — RES-006',            540.00, 'EUR', '2026-05-12', 'matched', 99.00, 0.00);

-- ─── 5. Anomalies Revenue Integrity (pour Revenue Integrity SAS) ──────────────
DELETE FROM public.revenue_anomalies WHERE hotel_id = v_hotel_id;

INSERT INTO public.revenue_anomalies (
  hotel_id, anomaly_type, source, severity, score,
  expected_amount, actual_amount, delta,
  description, status, details
) VALUES
  (
    v_hotel_id, 'COMMISSION_ERROR', 'BOOKING', 'critical', 42.00,
    89.00, 53.00, -36.00,
    'Commission Booking.com incorrecte sur RES-002 : 15% appliqués au lieu de 12% contractuels.',
    'open',
    '{"rule": "commission_rate", "contracted": 0.12, "applied": 0.15, "reservation": "RES-002"}'::jsonb
  ),
  (
    v_hotel_id, 'PAYOUT_ERROR', 'EXPEDIA', 'warning', 68.00,
    244.32, 208.10, -36.22,
    'Payout Expedia avril : écart de 36,22€ non justifié par les frais de service.',
    'open',
    '{"payout_ref": "EX-PAYOUT-2026-04-29", "expected_net": 244.32, "received": 208.10}'::jsonb
  ),
  (
    v_hotel_id, 'PRICE_MISMATCH', 'BOOKING', 'warning', 75.00,
    360.00, 342.00, -18.00,
    'Tarif transmis par Booking pour RES-001 inférieur au tarif PMS : 114€/nuit vs 120€/nuit.',
    'open',
    '{"reservation": "RES-001", "pms_rate": 120, "ota_rate": 114, "nights": 3}'::jsonb
  ),
  (
    v_hotel_id, 'TAX_ERROR', 'AIRBNB', 'info', 88.00,
    690.00, 689.60, -0.40,
    'Arrondi taxe de séjour Airbnb sur RES-009 : écart de 0,40€ en défaveur de l hôtel.',
    'open',
    '{"reservation": "RES-009", "tax_expected": 4.60, "tax_applied": 4.20}'::jsonb
  ),
  (
    v_hotel_id, 'COMMISSION_ERROR', 'EXPEDIA', 'critical', 38.00,
    55.00, 82.50, 27.50,
    'Sur-commission Expedia sur RES-007 : 12,5% prélevés au lieu de 10% contractuels.',
    'resolved',
    '{"rule": "commission_rate", "contracted": 0.10, "applied": 0.125, "reservation": "RES-007"}'::jsonb
  );

RAISE NOTICE 'Seed 0050 terminé : 12 chambres, 10 guests, 13 réservations, 9 lignes bancaires, 5 anomalies Revenue Integrity.';

END $$;
