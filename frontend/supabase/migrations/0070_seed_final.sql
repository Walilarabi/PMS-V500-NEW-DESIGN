DO $$
DECLARE
  v_hotel_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_today     date := CURRENT_DATE;
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
  g1  uuid := gen_random_uuid();
  g2  uuid := gen_random_uuid();
  g3  uuid := gen_random_uuid();
  g4  uuid := gen_random_uuid();
  g5  uuid := gen_random_uuid();
  g6  uuid := gen_random_uuid();
  g7  uuid := gen_random_uuid();
  g8  uuid := gen_random_uuid();
  g9  uuid := gen_random_uuid();
  g10 uuid := gen_random_uuid();
BEGIN

-- 1. Chambres
DELETE FROM public.rooms WHERE hotel_id = v_hotel_id;

INSERT INTO public.rooms (id, hotel_id, number, type, category, floor, surface_m2, max_occupancy, base_price, status, active, notes) VALUES
  (r101, v_hotel_id, '101', 'DBL', 'CL',  1, 22, 2, 180.00, 'occupied', true, 'Vue jardin'),
  (r102, v_hotel_id, '102', 'DBL', 'CL',  1, 22, 2, 180.00, 'occupied', true, 'Vue jardin'),
  (r103, v_hotel_id, '103', 'SGL', 'CL',  1, 16, 1, 120.00, 'clean',    true, 'Chambre simple'),
  (r104, v_hotel_id, '104', 'TWN', 'CL',  1, 24, 2, 190.00, 'dirty',    true, 'Lits separes'),
  (r201, v_hotel_id, '201', 'DBL', 'SUP', 2, 28, 2, 220.00, 'clean',    true, 'Vue piscine'),
  (r202, v_hotel_id, '202', 'DBL', 'SUP', 2, 28, 2, 220.00, 'occupied', true, 'Balcon'),
  (r203, v_hotel_id, '203', 'TWN', 'SUP', 2, 30, 2, 230.00, 'clean',    true, 'Lits separes'),
  (r204, v_hotel_id, '204', 'DBL', 'SUP', 2, 28, 2, 220.00, 'dirty',    true, NULL),
  (r301, v_hotel_id, '301', 'DBL', 'DLX', 3, 35, 2, 280.00, 'occupied', true, 'Terrasse privee'),
  (r302, v_hotel_id, '302', 'DBL', 'DLX', 3, 35, 2, 280.00, 'clean',    true, 'Terrasse privee'),
  (r401, v_hotel_id, '401', 'STE', 'JS',  4, 55, 4, 420.00, 'occupied', true, 'Junior Suite'),
  (r402, v_hotel_id, '402', 'STE', 'PS',  4, 80, 4, 680.00, 'clean',    true, 'Suite Prestige');

-- 2. Guests
DELETE FROM public.guests WHERE hotel_id = v_hotel_id;

INSERT INTO public.guests (id, hotel_id, first_name, last_name, email, phone, nationality, loyalty_level, total_stays, notes, gdpr_consent) VALUES
  (g1,  v_hotel_id, 'Sophie',    'Dubois',     'sophie.dubois@email.fr',   '+33612345678',  'FR', 'standard', 3,  NULL,                            true),
  (g2,  v_hotel_id, 'Marc',      'Laurent',    'marc.laurent@company.com', '+33623456789',  'FR', 'gold',     8,  'Client fidele - chambre calme', true),
  (g3,  v_hotel_id, 'Emma',      'Wilson',     'emma.wilson@gmail.com',    '+447911123456', 'GB', 'standard', 1,  NULL,                            true),
  (g4,  v_hotel_id, 'Thomas',    'Muller',     'thomas.muller@web.de',     '+491701234567', 'DE', 'standard', 2,  'Allergie aux plumes',           true),
  (g5,  v_hotel_id, 'Isabella',  'Rossi',      'i.rossi@mail.it',          '+393331234567', 'IT', 'platinum', 12, 'VIP Champagne a l arrivee',     true),
  (g6,  v_hotel_id, 'Jean-Paul', 'Bertrand',   'jpbertrand@groupe.fr',     '+33645678901',  'FR', 'standard', 1,  'Groupe seminaire',              true),
  (g7,  v_hotel_id, 'Yuki',      'Tanaka',     'y.tanaka@softbank.jp',     '+819012345678', 'JP', 'gold',     5,  'Oreiller ferme',                true),
  (g8,  v_hotel_id, 'Chloe',     'Martin',     'chloe.martin@outlook.fr',  '+33656789012',  'FR', 'standard', 2,  NULL,                            true),
  (g9,  v_hotel_id, 'Ahmad',     'Al-Rashidi', 'a.rashidi@invest.ae',      '+971501234567', 'AE', 'platinum', 7,  'VIP Suite transfert aeroport',  true),
  (g10, v_hotel_id, 'Lea',       'Fontaine',   'lea.fontaine@media.fr',    '+33667890123',  'FR', 'standard', 1,  NULL,                            true);

-- 3. Nettoyer FK avant suppression reservations
UPDATE public.bank_statements
  SET matched_reservation_id = NULL
  WHERE matched_reservation_id IN (
    SELECT id FROM public.reservations WHERE hotel_id = v_hotel_id
  );

DELETE FROM public.reservations WHERE hotel_id = v_hotel_id;

-- 4. Reservations
-- checkin_status: 'pending' ou 'completed' uniquement
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
  (gen_random_uuid(), v_hotel_id, r103, g3,
   'RES-001', 'Emma Wilson', 'emma.wilson@gmail.com', '+447911123456',
   '103', 'SGL', 'CL', v_today, v_today+3, 3,
   1, 0, 1, 'confirmed', 'pending', 'unpaid',
   360.00, 0.00, 360.00, 'BOOKING', 'loisir', 'Arrivee 15h', 1),

  (gen_random_uuid(), v_hotel_id, r201, g4,
   'RES-002', 'Thomas Muller', 'thomas.muller@web.de', '+491701234567',
   '201', 'DBL', 'SUP', v_today, v_today+2, 2,
   2, 0, 2, 'confirmed', 'pending', 'partial',
   440.00, 220.00, 220.00, 'EXPEDIA', 'loisir', 'Oreillers synthetiques', 1),

  (gen_random_uuid(), v_hotel_id, r402, g9,
   'RES-003', 'Ahmad Al-Rashidi', 'a.rashidi@invest.ae', '+971501234567',
   '402', 'STE', 'PS', v_today, v_today+5, 5,
   2, 0, 2, 'confirmed', 'pending', 'paid',
   3400.00, 3400.00, 0.00, 'DIRECT', 'affaires', 'VIP Transfert 14h', 1),

  (gen_random_uuid(), v_hotel_id, r101, g1,
   'RES-004', 'Sophie Dubois', 'sophie.dubois@email.fr', '+33612345678',
   '101', 'DBL', 'CL', v_today-2, v_today, 2,
   2, 0, 2, 'checked_in', 'completed', 'paid',
   360.00, 360.00, 0.00, 'DIRECT', 'loisir', 'Depart avant 11h', 1),

  (gen_random_uuid(), v_hotel_id, r301, g5,
   'RES-005', 'Isabella Rossi', 'i.rossi@mail.it', '+393331234567',
   '301', 'DBL', 'DLX', v_today-4, v_today, 4,
   2, 1, 3, 'checked_in', 'completed', 'paid',
   1120.00, 1120.00, 0.00, 'BOOKING', 'loisir', 'VIP excellent sejour', 1),

  (gen_random_uuid(), v_hotel_id, r102, g2,
   'RES-006', 'Marc Laurent', 'marc.laurent@company.com', '+33623456789',
   '102', 'DBL', 'CL', v_today-1, v_today+2, 3,
   1, 0, 1, 'checked_in', 'completed', 'partial',
   540.00, 270.00, 270.00, 'DIRECT', 'affaires', 'Chambre calme', 1),

  (gen_random_uuid(), v_hotel_id, r202, g7,
   'RES-007', 'Yuki Tanaka', 'y.tanaka@softbank.jp', '+819012345678',
   '202', 'DBL', 'SUP', v_today-2, v_today+1, 3,
   2, 0, 2, 'checked_in', 'completed', 'paid',
   660.00, 660.00, 0.00, 'EXPEDIA', 'affaires', 'PDJ en chambre 7h30', 1),

  (gen_random_uuid(), v_hotel_id, r401, g6,
   'RES-008', 'Jean-Paul Bertrand', 'jpbertrand@groupe.fr', '+33645678901',
   '401', 'STE', 'JS', v_today-1, v_today+3, 4,
   3, 1, 4, 'checked_in', 'completed', 'unpaid',
   1680.00, 0.00, 1680.00, 'DIRECT', 'groupe', 'Seminaire facturation societe', 1),

  (gen_random_uuid(), v_hotel_id, r203, g8,
   'RES-009', 'Chloe Martin', 'chloe.martin@outlook.fr', '+33656789012',
   '203', 'TWN', 'SUP', v_today+1, v_today+4, 3,
   2, 0, 2, 'confirmed', 'pending', 'paid',
   690.00, 690.00, 0.00, 'AIRBNB', 'loisir', NULL, 1),

  (gen_random_uuid(), v_hotel_id, r302, g10,
   'RES-010', 'Lea Fontaine', 'lea.fontaine@media.fr', '+33667890123',
   '302', 'DBL', 'DLX', v_today+1, v_today+3, 2,
   2, 0, 2, 'confirmed', 'pending', 'unpaid',
   560.00, 0.00, 560.00, 'BOOKING', 'loisir', NULL, 1),

  (gen_random_uuid(), v_hotel_id, r101, g1,
   'RES-011', 'Sophie Dubois', 'sophie.dubois@email.fr', '+33612345678',
   '101', 'DBL', 'CL', v_today+7, v_today+10, 3,
   2, 0, 2, 'confirmed', 'pending', 'partial',
   540.00, 270.00, 270.00, 'DIRECT', 'loisir', 'Meme chambre', 1),

  (gen_random_uuid(), v_hotel_id, r104, g4,
   'RES-012', 'Thomas Muller', 'thomas.muller@web.de', '+491701234567',
   '104', 'TWN', 'CL', v_today+5, v_today+8, 3,
   2, 1, 3, 'confirmed', 'pending', 'unpaid',
   570.00, 0.00, 570.00, 'EXPEDIA', 'loisir', NULL, 1),

  (gen_random_uuid(), v_hotel_id, r204, NULL,
   'RES-013', 'Client Annule', NULL, NULL,
   '204', 'DBL', 'SUP', v_today, v_today+2, 2,
   2, 0, 2, 'cancelled', NULL, 'unpaid',
   440.00, 0.00, 440.00, 'BOOKING', 'loisir', 'Annulation J-1', 1);

-- 5. Reconciliation
DELETE FROM public.reconciliation_lines WHERE hotel_id = v_hotel_id;

INSERT INTO public.reconciliation_lines (hotel_id, source, reference, description, amount, currency, line_date, status, match_score, match_delta) VALUES
  (v_hotel_id, 'BOOKING',    'BK-PAYOUT-2026-04-15', 'Booking.com Payout mid-Apr',  707.20,  'EUR', '2026-04-15', 'pending', 60.40,  4.80),
  (v_hotel_id, 'EXPEDIA',    'EX-PAYOUT-2026-04-29', 'Expedia Payout Apr',           244.32,  'EUR', '2026-04-29', 'pending', 84.00,  0.00),
  (v_hotel_id, 'BOOKING',    'BK-PAYOUT-2026-04-30', 'Booking.com Payout Apr',      1862.50,  'EUR', '2026-05-03', 'pending', NULL,   NULL),
  (v_hotel_id, 'BANK_HOTEL', 'CB-2026-05-01',         'Encaissement CB direct',      1750.00,  'EUR', '2026-05-05', 'pending', 80.00,  0.00),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-001',       'Test CSV import 1',            250.00,  'EUR', '2026-05-10', 'pending', 87.64,  5.68),
  (v_hotel_id, 'BOOKING',    'TEST-RECON-001',         NULL,                          100.00,  'EUR', '2026-05-10', 'pending', 49.00, 193.40),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-002',       'Test CSV import 2',            375.50,  'EUR', '2026-05-11', 'pending', 49.00,  82.10),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-003',       'Test CSV import 3',            118.75,  'EUR', '2026-05-12', 'pending', 47.00, 174.65),
  (v_hotel_id, 'BOOKING',    'BK-MATCHED-001',        'Booking.com RES-006',          540.00,  'EUR', '2026-05-12', 'matched', 99.00,  0.00);

-- 6. Revenue anomalies
DELETE FROM public.revenue_anomalies WHERE hotel_id = v_hotel_id;

INSERT INTO public.revenue_anomalies (hotel_id, anomaly_type, source, severity, score, expected_amount, actual_amount, delta, description, status, details) VALUES
  (v_hotel_id, 'COMMISSION_ERROR', 'BOOKING', 'critical', 42.00,  89.00,  53.00, -36.00, 'Commission Booking incorrecte RES-002 : 15% au lieu de 12%.', 'open',     '{"contracted":0.12,"applied":0.15}'::jsonb),
  (v_hotel_id, 'PAYOUT_ERROR',     'EXPEDIA', 'warning',  68.00, 244.32, 208.10, -36.22, 'Payout Expedia avril : ecart 36.22 EUR non justifie.',         'open',     '{"payout_ref":"EX-PAYOUT-2026-04-29"}'::jsonb),
  (v_hotel_id, 'PRICE_MISMATCH',   'BOOKING', 'warning',  75.00, 360.00, 342.00, -18.00, 'Tarif Booking RES-001 : 114 EUR/nuit vs 120 EUR/nuit PMS.',    'open',     '{"pms_rate":120,"ota_rate":114}'::jsonb),
  (v_hotel_id, 'TAX_ERROR',        'AIRBNB',  'info',     88.00, 690.00, 689.60,  -0.40, 'Arrondi taxe sejour Airbnb RES-009 : 0.40 EUR.',               'open',     '{"tax_expected":4.60}'::jsonb),
  (v_hotel_id, 'COMMISSION_ERROR', 'EXPEDIA', 'critical', 38.00,  55.00,  82.50,  27.50, 'Sur-commission Expedia RES-007 : 12.5% au lieu de 10%.',       'resolved', '{"contracted":0.10,"applied":0.125}'::jsonb);

RAISE NOTICE 'Seed OK : 12 chambres, 10 guests, 13 reservations, 9 lignes bancaires, 5 anomalies.';
END $$;
