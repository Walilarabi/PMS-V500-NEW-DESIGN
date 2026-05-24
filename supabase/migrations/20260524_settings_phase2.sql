-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM Settings — PHASE 2 (PERSISTENCE)
--
-- Couche persistance Supabase pour les modules Paramètres encore en
-- localStorage :
--   - settings_virtual_rooms        : chambres virtuelles (adjacentes,
--                                     communicantes, suite composée, etc.)
--   - settings_event_sources        : sources d'événements custom
--                                     ajoutées dans le moteur Revenue
--   - settings_custom_partners      : partenaires de connectivité custom
--                                     (Ctrip, Agoda, Airbnb non livrés en
--                                     standard)
--   - settings_imported_rate_plans  : rapports d'import + mapping des
--                                     plans tarifaires Excel
--   - settings_permissions_matrix   : matrice RBAC par rôle / capability
--
-- RÈGLES MÉTIER :
--   - Multi-tenant strict : RLS via hotel_users
--   - Idempotent : CREATE IF NOT EXISTS partout
--   - Pas de seed : on garde le localStorage comme cache local, la
--     synchro Supabase est append-only via les hooks dans les stores
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── settings_virtual_rooms ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings_virtual_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  room_type_id TEXT NOT NULL,           -- "rt_<code>"
  room_type_name TEXT NOT NULL,
  room_type_code TEXT NOT NULL,

  virtual_kind TEXT NOT NULL CHECK (virtual_kind IN (
    'adjacent', 'connecting', 'suite_combo', 'family_combo', 'split_twin', 'custom'
  )),
  component_room_type_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  components_required TEXT NOT NULL DEFAULT 'all' CHECK (components_required IN ('all', 'any')),

  capacity INTEGER NOT NULL DEFAULT 2,
  bathroom TEXT NOT NULL DEFAULT 'Douche',
  description TEXT NOT NULL DEFAULT '',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (hotel_id, room_type_code)
);

CREATE INDEX IF NOT EXISTS idx_settings_virtual_rooms_hotel ON settings_virtual_rooms(hotel_id);

ALTER TABLE settings_virtual_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_virtual_rooms_select_own
  ON settings_virtual_rooms FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_virtual_rooms_insert_own
  ON settings_virtual_rooms FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_virtual_rooms_update_own
  ON settings_virtual_rooms FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_virtual_rooms_delete_own
  ON settings_virtual_rooms FOR DELETE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- ─── settings_event_sources ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings_event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  source_id TEXT NOT NULL,               -- "custom_<...>"
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'France',
  name TEXT NOT NULL,

  method TEXT NOT NULL CHECK (method IN (
    'api', 'rss', 'ical', 'json_feed', 'xml', 'scraping', 'excel', 'csv', 'manual'
  )),
  url TEXT,
  sync_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (sync_frequency IN (
    'realtime', '6h', 'daily', 'weekly', 'monthly', 'manual'
  )),

  reliability_score INTEGER NOT NULL DEFAULT 75 CHECK (reliability_score BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,

  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'ok', 'error')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (hotel_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_event_sources_hotel ON settings_event_sources(hotel_id);
CREATE INDEX IF NOT EXISTS idx_settings_event_sources_city ON settings_event_sources(hotel_id, city);

ALTER TABLE settings_event_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_event_sources_select_own
  ON settings_event_sources FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_event_sources_insert_own
  ON settings_event_sources FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_event_sources_update_own
  ON settings_event_sources FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_event_sources_delete_own
  ON settings_event_sources FOR DELETE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- ─── settings_custom_partners ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings_custom_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  partner_id TEXT NOT NULL,             -- code court ("ctrip", "agoda"…)
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ota' CHECK (category IN (
    'ota', 'channel_manager', 'gds', 'metasearch', 'corporate', 'other'
  )),
  logo_url TEXT,
  api_endpoint TEXT,
  api_key_ref TEXT,                     -- référence chiffrée vault, jamais la clé en clair

  commission NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (hotel_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_custom_partners_hotel ON settings_custom_partners(hotel_id);

ALTER TABLE settings_custom_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_custom_partners_select_own
  ON settings_custom_partners FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_custom_partners_insert_own
  ON settings_custom_partners FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_custom_partners_update_own
  ON settings_custom_partners FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_custom_partners_delete_own
  ON settings_custom_partners FOR DELETE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- ─── settings_imported_rate_plans ──────────────────────────────────────────
-- Rapport d'import + mapping (chambres / pensions) appliqué.
-- Append-only : chaque import crée une nouvelle ligne. Les plans réels
-- sont écrits dans les tables RMS (rate_plans, room_types).
CREATE TABLE IF NOT EXISTS settings_imported_rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  imported_by UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  parsed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  requires_mapping_count INTEGER NOT NULL DEFAULT 0,

  room_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  meal_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,        -- rapport détaillé (lignes acceptées/rejetées)

  warnings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_settings_imported_rate_plans_hotel ON settings_imported_rate_plans(hotel_id, parsed_at DESC);

ALTER TABLE settings_imported_rate_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_imported_rate_plans_select_own
  ON settings_imported_rate_plans FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_imported_rate_plans_insert_own
  ON settings_imported_rate_plans FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- ─── settings_permissions_matrix ───────────────────────────────────────────
-- Matrice RBAC : 1 ligne par (rôle, capability) avec son niveau d'accès.
-- L'admin n'apparaît jamais ici (verrouillé en code à 'admin' partout).
CREATE TABLE IF NOT EXISTS settings_permissions_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  role_id TEXT NOT NULL CHECK (role_id IN ('manager', 'receptionist', 'housekeeping', 'reader')),
  capability_id TEXT NOT NULL,                      -- ex: 'res_view', 'set_users'…
  access_level TEXT NOT NULL CHECK (access_level IN ('none', 'read', 'write', 'admin')),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  UNIQUE (hotel_id, role_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_permissions_matrix_hotel ON settings_permissions_matrix(hotel_id, role_id);

ALTER TABLE settings_permissions_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_permissions_matrix_select_own
  ON settings_permissions_matrix FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- Mutation réservée aux admins (vérification supplémentaire côté backend
-- en plus du RLS hotel_users — un manager peut être membre du tenant sans
-- pour autant modifier la matrice).
CREATE POLICY settings_permissions_matrix_insert_admin
  ON settings_permissions_matrix FOR INSERT
  WITH CHECK (
    hotel_id IN (
      SELECT hu.hotel_id
        FROM hotel_users hu
       WHERE hu.user_id = auth.uid()
         AND hu.role = 'admin'
    )
  );

CREATE POLICY settings_permissions_matrix_update_admin
  ON settings_permissions_matrix FOR UPDATE
  USING (
    hotel_id IN (
      SELECT hu.hotel_id
        FROM hotel_users hu
       WHERE hu.user_id = auth.uid()
         AND hu.role = 'admin'
    )
  )
  WITH CHECK (
    hotel_id IN (
      SELECT hu.hotel_id
        FROM hotel_users hu
       WHERE hu.user_id = auth.uid()
         AND hu.role = 'admin'
    )
  );

CREATE POLICY settings_permissions_matrix_delete_admin
  ON settings_permissions_matrix FOR DELETE
  USING (
    hotel_id IN (
      SELECT hu.hotel_id
        FROM hotel_users hu
       WHERE hu.user_id = auth.uid()
         AND hu.role = 'admin'
    )
  );

-- ─── Trigger : updated_at ──────────────────────────────────────────────────
-- Réutilise la fonction set_updated_at() existante si déjà créée par
-- les migrations RMS, sinon la déclare.
CREATE OR REPLACE FUNCTION set_updated_at_settings()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settings_virtual_rooms_updated_at ON settings_virtual_rooms;
CREATE TRIGGER trg_settings_virtual_rooms_updated_at
  BEFORE UPDATE ON settings_virtual_rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_settings();

DROP TRIGGER IF EXISTS trg_settings_event_sources_updated_at ON settings_event_sources;
CREATE TRIGGER trg_settings_event_sources_updated_at
  BEFORE UPDATE ON settings_event_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_settings();

DROP TRIGGER IF EXISTS trg_settings_custom_partners_updated_at ON settings_custom_partners;
CREATE TRIGGER trg_settings_custom_partners_updated_at
  BEFORE UPDATE ON settings_custom_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_settings();

DROP TRIGGER IF EXISTS trg_settings_permissions_matrix_updated_at ON settings_permissions_matrix;
CREATE TRIGGER trg_settings_permissions_matrix_updated_at
  BEFORE UPDATE ON settings_permissions_matrix
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_settings();

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION 20260524_settings_phase2.sql
-- ═══════════════════════════════════════════════════════════════════════════
