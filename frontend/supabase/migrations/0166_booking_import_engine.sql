-- =============================================================================
-- 0166_booking_import_engine.sql
-- =============================================================================
-- OBJECTIF :
--   Bâtir le moteur d'intégration des réservations externes (Booking, Expedia,
--   etc.) en commençant par l'import Excel BookingExport. Cette migration
--   pose les fondations pour TOUS les hôtels et futures intégrations OTA/API.
--
-- SCOPE SPRINT 1 :
--   * 5 nouvelles tables :
--       ota_partners                  — référentiel des partenaires (16 partenaires)
--       external_reservation_imports  — journal des fichiers uploadés
--       external_reservations         — lignes brutes audit immuable
--       reservation_rooms             — N:N réservation ↔ chambres physiques
--       ota_room_type_mappings        — "Booking room name" → room_type_code
--       adjacent_room_combinations    — paires de chambres pour "Deux Chambres Adjacentes"
--   * Extensions de public.reservations (compatibilité ascendante)
--   * Seed Folkestone : 45 chambres physiques, 13 paires adjacentes, 16 OTAs
--
-- IDEMPOTENT : peut être relancée sans dommage (ON CONFLICT DO NOTHING partout)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE ota_partners — référentiel des partenaires
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ota_partners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text UNIQUE NOT NULL,     -- 'booking', 'expedia', 'agoda', 'direct'
  name              text NOT NULL,
  category          text NOT NULL CHECK (category IN ('ota', 'gds', 'wholesaler', 'tour_operator', 'direct', 'other')),
  -- Commission par défaut (Booking 15%, Expedia 18%, etc.)
  default_commission_pct numeric(5,2) DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ota_partners IS
  'Référentiel des partenaires de distribution (OTA, GDS, wholesalers, direct).';

-- -----------------------------------------------------------------------------
-- 2. TABLE external_reservation_imports — journal des fichiers uploadés
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_reservation_imports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  filename          text NOT NULL,
  file_size_bytes   bigint,
  source_type       text NOT NULL CHECK (source_type IN ('booking_export', 'expedia_partner', 'channel_manager', 'manual', 'api')),
  source_partner_id uuid REFERENCES public.ota_partners(id),
  rows_total        integer NOT NULL DEFAULT 0,
  rows_created      integer NOT NULL DEFAULT 0,
  rows_updated      integer NOT NULL DEFAULT 0,
  rows_cancelled    integer NOT NULL DEFAULT 0,
  rows_skipped      integer NOT NULL DEFAULT 0,
  rows_conflict     integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
  warnings          jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message     text,
  uploaded_by       uuid REFERENCES public.users(id),
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  duration_seconds  numeric GENERATED ALWAYS AS (
    CASE WHEN processed_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (processed_at - uploaded_at)) END
  ) STORED
);

CREATE INDEX IF NOT EXISTS external_imports_hotel_idx
  ON public.external_reservation_imports (hotel_id, uploaded_at DESC);

COMMENT ON TABLE public.external_reservation_imports IS
  'Journal des fichiers d''import OTA (équivalent à lighthouse_imports pour les concurrents).';

-- -----------------------------------------------------------------------------
-- 3. TABLE external_reservations — audit immuable des lignes brutes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_reservations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  import_id         uuid NOT NULL REFERENCES public.external_reservation_imports(id) ON DELETE CASCADE,
  -- Référence externe unique pour idempotence (ex: "7C7TU7" Booking)
  external_ref      text NOT NULL,
  source_partner_id uuid REFERENCES public.ota_partners(id),
  -- Statut OTA (pas le statut PMS) — Validée / Modifiée / Annulée
  ota_status        text NOT NULL,
  -- Snapshot complet de la ligne d'origine (debug + audit)
  raw_payload       jsonb NOT NULL,
  -- Pointeur vers la réservation PMS créée (NULL si pas encore traitée ou en conflit)
  reservation_id    uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  processing_status text NOT NULL DEFAULT 'pending'
                    CHECK (processing_status IN ('pending', 'created', 'updated', 'cancelled', 'conflict', 'skipped')),
  processing_notes  text,
  ingested_at       timestamptz NOT NULL DEFAULT now()
);

-- Unicité par (hotel + référence externe + import) — un même fichier peut contenir des annulations re-réf
CREATE UNIQUE INDEX IF NOT EXISTS external_reservations_unique_per_import
  ON public.external_reservations (hotel_id, external_ref, import_id);

CREATE INDEX IF NOT EXISTS external_reservations_external_ref_idx
  ON public.external_reservations (hotel_id, external_ref);

CREATE INDEX IF NOT EXISTS external_reservations_reservation_idx
  ON public.external_reservations (reservation_id) WHERE reservation_id IS NOT NULL;

COMMENT ON TABLE public.external_reservations IS
  'Audit immuable des lignes du fichier Excel. Sert de source de vérité pour les imports répétés et la résolution de conflits.';

-- -----------------------------------------------------------------------------
-- 4. EXTENSION DE public.reservations
-- -----------------------------------------------------------------------------
-- Colonnes nouvelles pour tracer l'origine OTA. Toutes nullable pour
-- compatibilité ascendante.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS source_partner_id uuid REFERENCES public.ota_partners(id);
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS parent_import_id uuid REFERENCES public.external_reservation_imports(id);
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS modification_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz;

-- Index unique par (hotel + référence externe) pour idempotence
CREATE UNIQUE INDEX IF NOT EXISTS reservations_external_ref_unique
  ON public.reservations (hotel_id, external_ref)
  WHERE external_ref IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. TABLE reservation_rooms — N:N réservation ↔ chambres physiques
-- -----------------------------------------------------------------------------
-- Permet une réservation à plusieurs chambres :
--   - Multi-chambres (3 Double Classique pour un groupe)
--   - Composition mixte (1 Twin + 1 Double pour une famille)
--   - "Deux Chambres Adjacentes" (1 réservation = 2 chambres physiques)
CREATE TABLE IF NOT EXISTS public.reservation_rooms (
  reservation_id    uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  room_id           uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  -- Pour les adjacentes : flag indiquant les 2 chambres d'une même paire virtuelle
  is_part_of_pair   boolean NOT NULL DEFAULT false,
  -- Ordre d'affichage (chambre principale vs secondaire dans le folio)
  position          smallint NOT NULL DEFAULT 1,
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reservation_id, room_id)
);

CREATE INDEX IF NOT EXISTS reservation_rooms_room_idx
  ON public.reservation_rooms (room_id);

COMMENT ON TABLE public.reservation_rooms IS
  'Lie une réservation à 1..N chambres physiques. Pour la majorité des cas (1 résa = 1 chambre), c''est redondant avec reservations.room_id. Pour les multi-chambres et adjacentes, c''est la source de vérité.';

-- -----------------------------------------------------------------------------
-- 6. TABLE ota_room_type_mappings — alignement nom OTA ↔ room_type_code
-- -----------------------------------------------------------------------------
-- Booking dit "Double Classique" → Flowtym dit "DBL-CLASSIC"
-- Expedia dit "Standard Double Room" → Flowtym dit "DBL-CLASSIC"
-- Ce mapping est scopé par hôtel parce que les nominations varient.
CREATE TABLE IF NOT EXISTS public.ota_room_type_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  source_partner_id uuid REFERENCES public.ota_partners(id),
  -- Le nom tel qu'il vient de l'OTA (ex: "Deux Chambres Adjacentes 4 personnes")
  external_name     text NOT NULL,
  -- Le room_type_code Flowtym cible (ex: 'ADJ-4P' ou 'DBL-CLASSIC')
  room_type_code    text NOT NULL,
  -- Indique si c'est une catégorie virtuelle (nécessitant un room-binding spécial)
  is_virtual        boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, source_partner_id, external_name)
);

CREATE INDEX IF NOT EXISTS ota_mappings_hotel_idx
  ON public.ota_room_type_mappings (hotel_id);

COMMENT ON TABLE public.ota_room_type_mappings IS
  'Mapping nom OTA → room_type_code Flowtym, par hôtel et par partenaire.';

-- -----------------------------------------------------------------------------
-- 7. TABLE adjacent_room_combinations — paires de chambres adjacentes
-- -----------------------------------------------------------------------------
-- Liste finie des combinaisons possibles pour vendre une "Deux Chambres Adjacentes".
-- L'allocator parcourt cette table et prend la première paire dont les deux
-- chambres sont libres sur la période demandée.
CREATE TABLE IF NOT EXISTS public.adjacent_room_combinations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  -- room_type_code de la catégorie virtuelle (ex: 'ADJ-4P')
  virtual_room_type_code text NOT NULL,
  -- Les 2 chambres physiques composant la paire
  room_a_id         uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  room_b_id         uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  -- Priorité d'allocation : 1 = essayer d'abord
  priority          smallint NOT NULL DEFAULT 1,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Empêcher les doublons exacts (et A-B = B-A)
  CONSTRAINT adjacent_pair_ordered CHECK (room_a_id < room_b_id),
  UNIQUE (hotel_id, virtual_room_type_code, room_a_id, room_b_id)
);

CREATE INDEX IF NOT EXISTS adjacent_combinations_hotel_type_idx
  ON public.adjacent_room_combinations (hotel_id, virtual_room_type_code)
  WHERE is_active = true;

COMMENT ON TABLE public.adjacent_room_combinations IS
  'Définit les paires possibles de chambres physiques que l''allocator peut utiliser pour réaliser une réservation "chambres adjacentes". L''allocator choisit la première paire dont les 2 chambres sont libres.';

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.ota_partners                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_reservation_imports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_reservations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ota_room_type_mappings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjacent_room_combinations      ENABLE ROW LEVEL SECURITY;

-- ota_partners : lecture publique authentifiée (référentiel global)
DROP POLICY IF EXISTS "ota_partners_select_all" ON public.ota_partners;
CREATE POLICY "ota_partners_select_all" ON public.ota_partners
  FOR SELECT TO authenticated USING (true);

-- external_reservation_imports : scopé par hôtel
DROP POLICY IF EXISTS "external_imports_tenant" ON public.external_reservation_imports;
CREATE POLICY "external_imports_tenant" ON public.external_reservation_imports
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- external_reservations : scopé par hôtel
DROP POLICY IF EXISTS "external_reservations_tenant" ON public.external_reservations;
CREATE POLICY "external_reservations_tenant" ON public.external_reservations
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- reservation_rooms : scopé via la réservation parente
DROP POLICY IF EXISTS "reservation_rooms_tenant" ON public.reservation_rooms;
CREATE POLICY "reservation_rooms_tenant" ON public.reservation_rooms
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_rooms.reservation_id
      AND r.hotel_id = public.get_user_hotel_id()
  ));

-- ota_room_type_mappings : scopé par hôtel
DROP POLICY IF EXISTS "ota_mappings_tenant" ON public.ota_room_type_mappings;
CREATE POLICY "ota_mappings_tenant" ON public.ota_room_type_mappings
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- adjacent_room_combinations : scopé par hôtel
DROP POLICY IF EXISTS "adjacent_combinations_tenant" ON public.adjacent_room_combinations;
CREATE POLICY "adjacent_combinations_tenant" ON public.adjacent_room_combinations
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- -----------------------------------------------------------------------------
-- 9. SEED : 16 partenaires OTA (extraits du fichier BookingExport)
-- -----------------------------------------------------------------------------
INSERT INTO public.ota_partners (code, name, category, default_commission_pct) VALUES
  ('booking',         'Booking.com',                       'ota',          15.0),
  ('expedia',         'Expedia',                           'ota',          18.0),
  ('website',         'Website',                           'direct',       0.0),
  ('hotelbeds',       'Hotelbeds',                         'wholesaler',   25.0),
  ('agoda',           'Agoda',                             'ota',          17.0),
  ('ctrip',           'Ctrip',                             'ota',          16.0),
  ('his',             'H.I.S. International Tours France', 'tour_operator', 12.0),
  ('miki',            'Miki Travel Ltd',                   'tour_operator', 12.0),
  ('tbo',             'TBO Holidays',                      'wholesaler',   22.0),
  ('hrs',             'HRS',                               'ota',          15.0),
  ('travco',          'Travco',                            'wholesaler',   22.0),
  ('sunhotels',       'SunHotels',                         'wholesaler',   22.0),
  ('olympia',         'Olympia Europe',                    'tour_operator', 15.0),
  ('gds',             'GDS',                               'gds',          10.0),
  ('infinitehotel',   'InfiniteHotel',                     'ota',          15.0),
  ('hoteltrader',     'Hotel Trader',                      'wholesaler',   22.0)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. SEED : 45 chambres physiques Folkestone Opéra
-- -----------------------------------------------------------------------------
-- Important : on supprime les chambres factices créées par la migration 0164
-- (qui avait inséré 101/102/103/104/105/201/202/203/301 avec des room_type_code
-- déjà mais pas les bons types réels). On les remplace par les 45 réelles.
DO $$
DECLARE
  v_hotel_id uuid := '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';
  v_existing_count int;
BEGIN
  SELECT COUNT(*) INTO v_existing_count
  FROM public.rooms WHERE hotel_id = v_hotel_id;
  
  IF v_existing_count > 0 THEN
    -- Supprimer les chambres factices (les vraies données rate_prices vont
    -- continuer à exister puisqu'elles référencent room_type_code, pas room_id)
    DELETE FROM public.rooms WHERE hotel_id = v_hotel_id;
    RAISE NOTICE 'Supprimé % anciennes chambres factices Folkestone', v_existing_count;
  END IF;
END $$;

-- Insertion des 45 chambres physiques réelles
INSERT INTO public.rooms (hotel_id, number, type, category, max_occupancy, room_type_code, active) VALUES
  -- Étage 1
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '101', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '102', 'Double Deluxe',                'Deluxe',    2, 'DBL-DELUXE',      true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '103', 'Twin Deluxe',                  'Deluxe',    2, 'TWIN-DELUXE',     true),
  -- Étage 2
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '201', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '202', 'Double Single Use Classique',  'Classique', 1, 'SGL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '203', 'Twin Deluxe',                  'Deluxe',    2, 'TWIN-DELUXE',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '204', 'Double Single Use Classique',  'Classique', 2, 'SGL-CLASSIC',     true),
  -- Étage 3
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '301', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '302', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '303', 'Double Deluxe',                'Deluxe',    2, 'DBL-DELUXE',      true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '304', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '306', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '307', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '308', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '309', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  -- Étage 4
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '401', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '402', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '403', 'Double Deluxe',                'Deluxe',    2, 'DBL-DELUXE',      true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '404', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '406', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '407', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '408', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '409', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  -- Étage 5
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '501', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '502', 'Double Deluxe',                'Deluxe',    2, 'DBL-DELUXE',      true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '503', 'Double Deluxe',                'Deluxe',    2, 'DBL-DELUXE',      true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '504', 'Double Single Use Classique',  'Classique', 2, 'SGL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '506', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '507', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '508', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '509', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  -- Étage 6
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '602', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '603', 'Double Deluxe Terrasse',       'Deluxe',    2, 'DBL-DELUXE-TER',  true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '604', 'Double Single Use Classique',  'Classique', 2, 'SGL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '605', 'Double Classique Terrasse',    'Classique', 2, 'DBL-CLASSIC-TER', true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '606', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '607', 'Double Classique Terrasse',    'Classique', 2, 'DBL-CLASSIC-TER', true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '608', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  -- Étage 7
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '701', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '702', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '703', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '704', 'Twin Classique',               'Classique', 2, 'TWIN-CLASSIC',    true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '705', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '706', 'Double Single Use Classique',  'Classique', 2, 'SGL-CLASSIC',     true),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', '708', 'Double Classique',             'Classique', 2, 'DBL-CLASSIC',     true);

-- -----------------------------------------------------------------------------
-- 11. SEED : Mappings OTA → room_type_code pour Folkestone
-- -----------------------------------------------------------------------------
-- Booking et autres OTA utilisent ces noms exacts dans BookingExport
INSERT INTO public.ota_room_type_mappings (hotel_id, source_partner_id, external_name, room_type_code, is_virtual) VALUES
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Double Classique',                    'DBL-CLASSIC',     false),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Double Single Use Classique',         'SGL-CLASSIC',     false),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Twin Classique',                      'TWIN-CLASSIC',    false),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Double Classique Terrasse',           'DBL-CLASSIC-TER', false),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Double Deluxe',                       'DBL-DELUXE',      false),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Twin Deluxe',                         'TWIN-DELUXE',     false),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Double Deluxe Terrasse',              'DBL-DELUXE-TER',  false),
  ('02b9eb0e-89ef-45de-ba8e-20d4b41c500c', NULL, 'Deux Chambres Adjacentes 4 personnes', 'ADJ-4P',         true)
ON CONFLICT (hotel_id, source_partner_id, external_name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 12. SEED : 13 paires adjacentes Folkestone
-- -----------------------------------------------------------------------------
-- Liste validée par Wali (708 retiré de la paire avec 706 — seule paire 705-708 conservée)
DO $$
DECLARE
  v_hotel_id uuid := '02b9eb0e-89ef-45de-ba8e-20d4b41c500c';
  pair_rec record;
BEGIN
  -- 13 paires validées
  FOR pair_rec IN
    SELECT * FROM (VALUES
      ('202', '204', 1),
      ('302', '304', 1),
      ('306', '308', 1),
      ('307', '309', 1),
      ('402', '404', 1),
      ('406', '408', 1),
      ('407', '409', 1),
      ('506', '508', 1),
      ('507', '509', 1),
      ('606', '608', 1),
      ('605', '607', 1),
      ('705', '708', 1),
      ('701', '704', 1)
    ) AS t(num_a, num_b, prio)
  LOOP
    INSERT INTO public.adjacent_room_combinations 
      (hotel_id, virtual_room_type_code, room_a_id, room_b_id, priority)
    SELECT 
      v_hotel_id,
      'ADJ-4P',
      LEAST(ra.id, rb.id),  -- garantit room_a_id < room_b_id (check constraint)
      GREATEST(ra.id, rb.id),
      pair_rec.prio
    FROM public.rooms ra, public.rooms rb
    WHERE ra.hotel_id = v_hotel_id AND ra.number = pair_rec.num_a
      AND rb.hotel_id = v_hotel_id AND rb.number = pair_rec.num_b
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Adjacent room combinations seeded for Folkestone';
END $$;

-- -----------------------------------------------------------------------------
-- 13. VÉRIFICATION
-- -----------------------------------------------------------------------------
SELECT 'ota_partners' AS table_name, COUNT(*) AS nb FROM public.ota_partners
UNION ALL
SELECT 'rooms (Folkestone)', COUNT(*) FROM public.rooms 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
UNION ALL
SELECT 'ota_room_type_mappings (Folkestone)', COUNT(*) FROM public.ota_room_type_mappings 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
UNION ALL
SELECT 'adjacent_room_combinations (Folkestone)', COUNT(*) FROM public.adjacent_room_combinations 
  WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
UNION ALL
SELECT 'external_reservation_imports', COUNT(*) FROM public.external_reservation_imports
UNION ALL
SELECT 'external_reservations', COUNT(*) FROM public.external_reservations
UNION ALL
SELECT 'reservation_rooms', COUNT(*) FROM public.reservation_rooms;

-- Vérifier la répartition par type
SELECT room_type_code, COUNT(*) AS nb_rooms
FROM public.rooms
WHERE hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
GROUP BY room_type_code
ORDER BY nb_rooms DESC;
