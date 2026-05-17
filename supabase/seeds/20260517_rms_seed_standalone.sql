-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS — SEED DATA STANDALONE
-- 
-- Données initiales sans dépendance tenant
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. ÉVÉNEMENTS PARIS 2026
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO rms_events (name, start_date, end_date, venue, category, impact, impact_score, city, source) VALUES
  -- JANVIER 2026
  ('Jour de l''An', '2026-01-01', '2026-01-01', 'Paris', 'national', 'medium', 45, 'Paris', 'imported'),
  ('Maison & Objet (Hiver)', '2026-01-15', '2026-01-19', 'Villepinte', 'salon', 'medium', 65, 'Paris', 'imported'),
  ('Who''s Next', '2026-01-17', '2026-01-19', 'P. de Versailles', 'salon', 'medium', 60, 'Paris', 'imported'),
  ('Sirha Europain', '2026-01-17', '2026-01-20', 'P. de Versailles', 'salon', 'medium', 62, 'Paris', 'imported'),
  ('Mode Masculine (Hiver)', '2026-01-20', '2026-01-25', 'Paris Centre', 'salon', 'medium', 58, 'Paris', 'imported'),
  ('Haute Couture (Hiver)', '2026-01-26', '2026-01-29', 'Paris Centre', 'salon', 'medium', 70, 'Paris', 'imported'),
  ('Retromobile', '2026-01-28', '2026-02-01', 'P. de Versailles', 'salon', 'medium', 55, 'Paris', 'imported'),
  
  -- FÉVRIER 2026
  ('Première Vision', '2026-02-03', '2026-02-05', 'Villepinte', 'salon', 'high', 82, 'Paris', 'imported'),
  ('Tournoi 6 Nations (France)', '2026-02-05', '2026-02-05', 'Stade de France', 'sport', 'medium', 68, 'Paris', 'imported'),
  ('Art Capital', '2026-02-13', '2026-02-15', 'Grand Palais', 'cultural', 'medium', 52, 'Paris', 'imported'),
  ('Salon de l''Agriculture', '2026-02-21', '2026-03-01', 'P. de Versailles', 'salon', 'high', 88, 'Paris', 'imported'),
  
  -- MARS 2026
  ('Mode Féminine', '2026-03-02', '2026-03-10', 'Paris Centre', 'salon', 'high', 85, 'Paris', 'imported'),
  ('Tranoï', '2026-03-05', '2026-03-08', 'Palais Brogniart', 'salon', 'low', 48, 'Paris', 'imported'),
  ('Première Classe', '2026-03-06', '2026-03-09', 'Tuileries', 'salon', 'medium', 58, 'Paris', 'imported'),
  ('Salon du Tourisme', '2026-03-12', '2026-03-15', 'P. de Versailles', 'salon', 'medium', 60, 'Paris', 'imported'),
  ('Tournoi 6 Nations (France)', '2026-03-14', '2026-03-14', 'Stade de France', 'sport', 'medium', 68, 'Paris', 'imported'),
  ('PHARMAGORA', '2026-03-14', '2026-03-15', 'P. de Versailles', 'salon', 'medium', 55, 'Paris', 'imported'),
  ('Franchise Expo', '2026-03-14', '2026-03-16', 'P. de Versailles', 'salon', 'medium', 60, 'Paris', 'imported'),
  ('All4Customer', '2026-03-24', '2026-03-26', 'P. de Versailles', 'salon', 'high', 78, 'Paris', 'imported'),
  ('Global Industrie', '2026-03-30', '2026-04-02', 'Villepinte', 'salon', 'high', 80, 'Paris', 'imported'),
  
  -- AVRIL 2026
  ('Art Paris Art Fair', '2026-04-03', '2026-04-06', 'Grand Palais', 'cultural', 'medium', 65, 'Paris', 'imported'),
  ('Pâques', '2026-04-05', '2026-04-05', 'Paris', 'national', 'low', 42, 'Paris', 'imported'),
  ('Lundi de Pâques', '2026-04-06', '2026-04-06', 'Paris', 'national', 'medium', 50, 'Paris', 'imported'),
  ('Marathon de Paris', '2026-04-12', '2026-04-13', 'Paris Centre', 'sport', 'high', 75, 'Paris', 'imported'),
  ('Foire de Paris', '2026-04-30', '2026-05-11', 'P. de Versailles', 'salon', 'high', 82, 'Paris', 'imported'),
  
  -- MAI 2026
  ('Fête du Travail', '2026-05-01', '2026-05-01', 'Paris', 'national', 'medium', 48, 'Paris', 'imported'),
  ('8 Mai 1945', '2026-05-08', '2026-05-08', 'Paris', 'national', 'low', 35, 'Paris', 'imported'),
  ('Ascension', '2026-05-14', '2026-05-14', 'Paris', 'national', 'medium', 52, 'Paris', 'imported'),
  ('EUROPCR', '2026-05-20', '2026-05-23', 'P. de Versailles', 'salon', 'high', 72, 'Paris', 'imported'),
  ('Lundi de Pentecôte', '2026-05-25', '2026-05-25', 'Paris', 'national', 'medium', 50, 'Paris', 'imported'),
  ('Roland Garros', '2026-05-25', '2026-06-06', 'Roland Garros', 'sport', 'high', 92, 'Paris', 'imported'),
  
  -- JUIN 2026
  ('Vivatech', '2026-06-11', '2026-06-14', 'P. de Versailles', 'salon', 'high', 95, 'Paris', 'imported'),
  ('Eurosatory', '2026-06-17', '2026-06-21', 'Villepinte', 'salon', 'high', 78, 'Paris', 'imported'),
  ('Fête de la Musique', '2026-06-21', '2026-06-21', 'Paris', 'cultural', 'medium', 58, 'Paris', 'imported'),
  
  -- JUILLET 2026
  ('14 Juillet', '2026-07-14', '2026-07-14', 'Paris', 'national', 'high', 85, 'Paris', 'imported'),
  ('Tour de France (Arrivée)', '2026-07-26', '2026-07-26', 'Champs-Élysées', 'sport', 'high', 88, 'Paris', 'imported'),
  
  -- AOÛT 2026
  ('Assomption', '2026-08-15', '2026-08-15', 'Paris', 'national', 'low', 32, 'Paris', 'imported'),
  
  -- SEPTEMBRE 2026
  ('Maison & Objet (Automne)', '2026-09-04', '2026-09-08', 'Villepinte', 'salon', 'medium', 68, 'Paris', 'imported'),
  ('Journées du Patrimoine', '2026-09-19', '2026-09-20', 'Paris', 'cultural', 'medium', 55, 'Paris', 'imported'),
  ('Mode Féminine (SS)', '2026-09-28', '2026-10-06', 'Paris Centre', 'salon', 'high', 85, 'Paris', 'imported'),
  
  -- OCTOBRE 2026
  ('Mondial de l''Automobile', '2026-10-01', '2026-10-11', 'P. de Versailles', 'salon', 'high', 90, 'Paris', 'imported'),
  ('Nuit Blanche', '2026-10-03', '2026-10-03', 'Paris', 'cultural', 'medium', 60, 'Paris', 'imported'),
  ('Prix Arc de Triomphe', '2026-10-04', '2026-10-04', 'Longchamp', 'sport', 'medium', 65, 'Paris', 'imported'),
  ('FIAC', '2026-10-22', '2026-10-25', 'Grand Palais', 'cultural', 'medium', 70, 'Paris', 'imported'),
  
  -- NOVEMBRE 2026
  ('Toussaint', '2026-11-01', '2026-11-01', 'Paris', 'national', 'medium', 48, 'Paris', 'imported'),
  ('Salon du Chocolat', '2026-11-03', '2026-11-08', 'P. de Versailles', 'salon', 'medium', 58, 'Paris', 'imported'),
  ('Armistice 1918', '2026-11-11', '2026-11-11', 'Paris', 'national', 'low', 35, 'Paris', 'imported'),
  
  -- DÉCEMBRE 2026
  ('Marché Noël Champs-Élysées', '2026-12-01', '2026-12-24', 'Champs-Élysées', 'cultural', 'high', 78, 'Paris', 'imported'),
  ('Noël', '2026-12-25', '2026-12-25', 'Paris', 'national', 'high', 82, 'Paris', 'imported'),
  ('Réveillon Nouvel An', '2026-12-31', '2026-12-31', 'Paris', 'cultural', 'high', 88, 'Paris', 'imported')
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CONCURRENTS FOLKESTONE OPÉRA
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO rms_competitors (name, stars, segment, distance_km, city, capacity, base_price, quality_score, review_count, is_primary_compset, booking_id) VALUES
  ('Hôtel Madeleine Haussmann', 3, 'midscale', 0.4, 'Paris', 48, 350.00, 8.1, 1842, true, 'madeleine-haussmann'),
  ('Hôtel De l''Arcade', 3, 'midscale', 0.3, 'Paris', 38, 290.00, 8.3, 2134, true, 'arcade'),
  ('Hôtel Cordelia Opéra-Madeleine', 3, 'midscale', 0.2, 'Paris', 42, 340.00, 8.0, 1567, true, 'cordelia-opera'),
  ('Queen Mary Opera', 3, 'budget', 0.5, 'Paris', 35, 265.00, 7.8, 1245, true, 'queen-mary'),
  ('Hôtel du Triangle d''Or - Proche Madeleine', 3, 'midscale', 0.6, 'Paris', 28, 315.00, 8.4, 987, true, 'triangle-or'),
  ('Best Western Plus Hotel Sydney Opera', 3, 'midscale', 0.5, 'Paris', 38, 270.00, 8.4, 2456, true, 'best-western-sydney'),
  ('Hotel Opéra Opal', 3, 'midscale', 0.4, 'Paris', 32, 350.00, 7.9, 1678, true, 'opera-opal'),
  ('Hôtel Royal Opéra', 3, 'budget', 0.3, 'Paris', 26, 240.00, 7.6, 1123, true, 'royal-opera'),
  ('Hotel George Sand Opéra Paris', 3, 'midscale', 0.4, 'Paris', 30, 310.00, 8.2, 1834, true, 'george-sand'),
  ('Hotel Chavanel', 4, 'upscale', 0.7, 'Paris', 27, 450.00, 8.7, 2187, true, 'chavanel')
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. CONFIRMATION
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  event_count INTEGER;
  competitor_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO event_count FROM rms_events;
  SELECT COUNT(*) INTO competitor_count FROM rms_competitors;
  
  RAISE NOTICE '✅ Seed data RMS chargé :';
  RAISE NOTICE '   - % événements Paris 2026', event_count;
  RAISE NOTICE '   - % concurrents compset', competitor_count;
END $$;
