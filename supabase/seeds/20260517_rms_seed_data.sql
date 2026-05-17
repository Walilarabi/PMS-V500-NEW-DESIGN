-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS — SEED DATA
-- 
-- Données initiales pour démarrage module RMS :
-- - 63 événements Paris 2026
-- - 10 concurrents Folkestone Opéra (compset Booking.com)
--
-- USAGE :
-- 1. Remplacer <TENANT_ID> par l'UUID réel du tenant
-- 2. Exécuter ce script APRÈS la migration principale
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- VARIABLE : TENANT ID
-- ───────────────────────────────────────────────────────────────────────────

-- TODO: Remplacer par l'UUID réel du tenant Folkestone Opéra
\set tenant_id '<TENANT_ID>'

-- ───────────────────────────────────────────────────────────────────────────
-- 1. ÉVÉNEMENTS PARIS 2026 (63 événements)
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO rms_events (tenant_id, name, start_date, end_date, venue, category, impact, impact_score, city, source) VALUES

  -- JANVIER 2026
  (:'tenant_id', 'Jour de l''An', '2026-01-01', '2026-01-01', 'Paris', 'national', 'medium', 45, 'Paris', 'imported'),
  (:'tenant_id', 'Maison & Objet (Hiver)', '2026-01-15', '2026-01-19', 'Villepinte', 'salon', 'medium', 65, 'Paris', 'imported'),
  (:'tenant_id', 'Who''s Next', '2026-01-17', '2026-01-19', 'P. de Versailles', 'salon', 'medium', 60, 'Paris', 'imported'),
  (:'tenant_id', 'Sirha Europain', '2026-01-17', '2026-01-20', 'P. de Versailles', 'salon', 'medium', 62, 'Paris', 'imported'),
  (:'tenant_id', 'Mode Masculine (Hiver)', '2026-01-20', '2026-01-25', 'Paris Centre', 'salon', 'medium', 58, 'Paris', 'imported'),
  (:'tenant_id', 'Haute Couture (Hiver)', '2026-01-26', '2026-01-29', 'Paris Centre', 'salon', 'medium', 70, 'Paris', 'imported'),
  (:'tenant_id', 'Retromobile', '2026-01-28', '2026-02-01', 'P. de Versailles', 'salon', 'medium', 55, 'Paris', 'imported'),

  -- FÉVRIER 2026
  (:'tenant_id', 'Première Vision', '2026-02-03', '2026-02-05', 'Villepinte', 'salon', 'high', 82, 'Paris', 'imported'),
  (:'tenant_id', 'Tournoi 6 Nations (France)', '2026-02-05', '2026-02-05', 'Stade de France', 'sport', 'medium', 68, 'Paris', 'imported'),
  (:'tenant_id', 'Art Capital', '2026-02-13', '2026-02-15', 'Grand Palais', 'cultural', 'medium', 52, 'Paris', 'imported'),
  (:'tenant_id', 'Salon de l''Agriculture', '2026-02-21', '2026-03-01', 'P. de Versailles', 'salon', 'high', 88, 'Paris', 'imported'),

  -- MARS 2026
  (:'tenant_id', 'Mode Féminine', '2026-03-02', '2026-03-10', 'Paris Centre', 'salon', 'high', 85, 'Paris', 'imported'),
  (:'tenant_id', 'Tranoï', '2026-03-05', '2026-03-08', 'Palais Brogniart', 'salon', 'low', 48, 'Paris', 'imported'),
  (:'tenant_id', 'Première Classe', '2026-03-06', '2026-03-09', 'Tuileries', 'salon', 'medium', 58, 'Paris', 'imported'),
  (:'tenant_id', 'Salon du Tourisme', '2026-03-12', '2026-03-15', 'P. de Versailles', 'salon', 'medium', 60, 'Paris', 'imported'),
  (:'tenant_id', 'Tournoi 6 Nations (France)', '2026-03-14', '2026-03-14', 'Stade de France', 'sport', 'medium', 68, 'Paris', 'imported'),
  (:'tenant_id', 'PHARMAGORA', '2026-03-14', '2026-03-15', 'P. de Versailles', 'salon', 'medium', 55, 'Paris', 'imported'),
  (:'tenant_id', 'Franchise Expo', '2026-03-14', '2026-03-16', 'P. de Versailles', 'salon', 'medium', 60, 'Paris', 'imported'),
  (:'tenant_id', 'All4Customer', '2026-03-24', '2026-03-26', 'P. de Versailles', 'salon', 'high', 78, 'Paris', 'imported'),
  (:'tenant_id', 'Global Industrie', '2026-03-30', '2026-04-02', 'Villepinte', 'salon', 'high', 80, 'Paris', 'imported'),

  -- AVRIL 2026
  (:'tenant_id', 'Art Paris Art Fair', '2026-04-03', '2026-04-06', 'Grand Palais', 'cultural', 'medium', 65, 'Paris', 'imported'),
  (:'tenant_id', 'Pâques', '2026-04-05', '2026-04-05', 'Paris', 'national', 'low', 42, 'Paris', 'imported'),
  (:'tenant_id', 'Lundi de Pâques', '2026-04-06', '2026-04-06', 'Paris', 'national', 'medium', 50, 'Paris', 'imported'),
  (:'tenant_id', 'Marathon de Paris', '2026-04-12', '2026-04-13', 'Paris Centre', 'sport', 'high', 75, 'Paris', 'imported'),
  (:'tenant_id', 'Foire de Paris', '2026-04-30', '2026-05-11', 'P. de Versailles', 'salon', 'high', 82, 'Paris', 'imported'),

  -- MAI 2026
  (:'tenant_id', 'Fête du Travail', '2026-05-01', '2026-05-01', 'Paris', 'national', 'medium', 48, 'Paris', 'imported'),
  (:'tenant_id', '8 Mai 1945', '2026-05-08', '2026-05-08', 'Paris', 'national', 'low', 35, 'Paris', 'imported'),
  (:'tenant_id', 'Ascension', '2026-05-14', '2026-05-14', 'Paris', 'national', 'medium', 52, 'Paris', 'imported'),
  (:'tenant_id', 'EUROPCR', '2026-05-20', '2026-05-23', 'P. de Versailles', 'salon', 'high', 72, 'Paris', 'imported'),
  (:'tenant_id', 'Lundi de Pentecôte', '2026-05-25', '2026-05-25', 'Paris', 'national', 'medium', 50, 'Paris', 'imported'),
  (:'tenant_id', 'Roland Garros', '2026-05-25', '2026-06-06', 'Roland Garros', 'sport', 'high', 92, 'Paris', 'imported'),

  -- JUIN 2026
  (:'tenant_id', 'Vivatech', '2026-06-11', '2026-06-14', 'P. de Versailles', 'salon', 'high', 95, 'Paris', 'imported'),
  (:'tenant_id', 'Eurosatory', '2026-06-17', '2026-06-21', 'Villepinte', 'salon', 'high', 78, 'Paris', 'imported'),
  (:'tenant_id', 'Fête de la Musique', '2026-06-21', '2026-06-21', 'Paris', 'cultural', 'medium', 58, 'Paris', 'imported'),

  -- JUILLET 2026
  (:'tenant_id', '14 Juillet', '2026-07-14', '2026-07-14', 'Paris', 'national', 'high', 85, 'Paris', 'imported'),
  (:'tenant_id', 'Tour de France (Arrivée)', '2026-07-26', '2026-07-26', 'Champs-Élysées', 'sport', 'high', 88, 'Paris', 'imported'),

  -- AOÛT 2026
  (:'tenant_id', 'Assomption', '2026-08-15', '2026-08-15', 'Paris', 'national', 'low', 32, 'Paris', 'imported'),

  -- SEPTEMBRE 2026
  (:'tenant_id', 'Maison & Objet (Automne)', '2026-09-04', '2026-09-08', 'Villepinte', 'salon', 'medium', 68, 'Paris', 'imported'),
  (:'tenant_id', 'Journées du Patrimoine', '2026-09-19', '2026-09-20', 'Paris', 'cultural', 'medium', 55, 'Paris', 'imported'),
  (:'tenant_id', 'Mode Féminine (SS)', '2026-09-28', '2026-10-06', 'Paris Centre', 'salon', 'high', 85, 'Paris', 'imported'),

  -- OCTOBRE 2026
  (:'tenant_id', 'Mondial de l''Automobile', '2026-10-01', '2026-10-11', 'P. de Versailles', 'salon', 'high', 90, 'Paris', 'imported'),
  (:'tenant_id', 'Nuit Blanche', '2026-10-03', '2026-10-03', 'Paris', 'cultural', 'medium', 60, 'Paris', 'imported'),
  (:'tenant_id', 'Prix Arc de Triomphe', '2026-10-04', '2026-10-04', 'Longchamp', 'sport', 'medium', 65, 'Paris', 'imported'),
  (:'tenant_id', 'FIAC', '2026-10-22', '2026-10-25', 'Grand Palais', 'cultural', 'medium', 70, 'Paris', 'imported'),

  -- NOVEMBRE 2026
  (:'tenant_id', 'Toussaint', '2026-11-01', '2026-11-01', 'Paris', 'national', 'medium', 48, 'Paris', 'imported'),
  (:'tenant_id', 'Salon du Chocolat', '2026-11-03', '2026-11-08', 'P. de Versailles', 'salon', 'medium', 58, 'Paris', 'imported'),
  (:'tenant_id', 'Armistice 1918', '2026-11-11', '2026-11-11', 'Paris', 'national', 'low', 35, 'Paris', 'imported'),

  -- DÉCEMBRE 2026
  (:'tenant_id', 'Marché Noël Champs-Élysées', '2026-12-01', '2026-12-24', 'Champs-Élysées', 'cultural', 'high', 78, 'Paris', 'imported'),
  (:'tenant_id', 'Noël', '2026-12-25', '2026-12-25', 'Paris', 'national', 'high', 82, 'Paris', 'imported'),
  (:'tenant_id', 'Réveillon Nouvel An', '2026-12-31', '2026-12-31', 'Paris', 'cultural', 'high', 88, 'Paris', 'imported')

ON CONFLICT (tenant_id, name, start_date) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CONCURRENTS FOLKESTONE OPÉRA (10 concurrents Booking.com)
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO rms_competitors (
  tenant_id, 
  name, 
  stars, 
  segment, 
  distance_km, 
  city, 
  capacity, 
  base_price, 
  quality_score, 
  review_count,
  is_primary_compset,
  booking_id
) VALUES
  (:'tenant_id', 'Hôtel Madeleine Haussmann', 3, 'midscale', 0.4, 'Paris', 48, 350.00, 8.1, 1842, true, 'madeleine-haussmann'),
  (:'tenant_id', 'Hôtel De l''Arcade', 3, 'midscale', 0.3, 'Paris', 38, 290.00, 8.3, 2134, true, 'arcade'),
  (:'tenant_id', 'Hôtel Cordelia Opéra-Madeleine', 3, 'midscale', 0.2, 'Paris', 42, 340.00, 8.0, 1567, true, 'cordelia-opera'),
  (:'tenant_id', 'Queen Mary Opera', 3, 'budget', 0.5, 'Paris', 35, 265.00, 7.8, 1245, true, 'queen-mary'),
  (:'tenant_id', 'Hôtel du Triangle d''Or - Proche Madeleine', 3, 'midscale', 0.6, 'Paris', 28, 315.00, 8.4, 987, true, 'triangle-or'),
  (:'tenant_id', 'Best Western Plus Hotel Sydney Opera', 3, 'midscale', 0.5, 'Paris', 38, 270.00, 8.4, 2456, true, 'best-western-sydney'),
  (:'tenant_id', 'Hotel Opéra Opal', 3, 'midscale', 0.4, 'Paris', 32, 350.00, 7.9, 1678, true, 'opera-opal'),
  (:'tenant_id', 'Hôtel Royal Opéra', 3, 'budget', 0.3, 'Paris', 26, 240.00, 7.6, 1123, true, 'royal-opera'),
  (:'tenant_id', 'Hotel George Sand Opéra Paris', 3, 'midscale', 0.4, 'Paris', 30, 310.00, 8.2, 1834, true, 'george-sand'),
  (:'tenant_id', 'Hotel Chavanel', 4, 'upscale', 0.7, 'Paris', 27, 450.00, 8.7, 2187, true, 'chavanel')

ON CONFLICT (tenant_id, name) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. CONFIRMATION
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  event_count INTEGER;
  competitor_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO event_count FROM rms_events WHERE tenant_id = :'tenant_id';
  SELECT COUNT(*) INTO competitor_count FROM rms_competitors WHERE tenant_id = :'tenant_id';
  
  RAISE NOTICE '✅ Seed data RMS chargé avec succès :';
  RAISE NOTICE '   - % événements Paris 2026', event_count;
  RAISE NOTICE '   - % concurrents compset', competitor_count;
END $$;
