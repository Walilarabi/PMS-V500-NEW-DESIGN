-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM Settings — Config Blobs (Phase 5)
--
-- Couche générique de persistance pour les configurations "simples"
-- (key/value JSON par hôtel). Évite la création d'une table par module
-- pour les pages Paramètres qui n'ont qu'un seul objet de config :
--
--   • flowtym.localtaxes       → namespace 'taxes'
--   • flowtym.languages        → namespace 'languages'
--   • flowtym.branding         → namespace 'branding'
--   • flowtym.payment.modes    → namespace 'payment_modes'
--   • flowtym.numbering        → namespace 'numbering'
--   • flowtym.timezone         → namespace 'timezone'
--   • ...
--
-- Multi-tenant strict via RLS. Append-update : pas de purge, le dernier
-- update écrase. Une version par hôtel × namespace.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS settings_config_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  namespace TEXT NOT NULL,                          -- ex: 'taxes', 'branding'
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  UNIQUE (hotel_id, namespace)
);

CREATE INDEX IF NOT EXISTS idx_settings_config_blobs_hotel
  ON settings_config_blobs(hotel_id, namespace);

ALTER TABLE settings_config_blobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_config_blobs_select_own
  ON settings_config_blobs FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_config_blobs_insert_own
  ON settings_config_blobs FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_config_blobs_update_own
  ON settings_config_blobs FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY settings_config_blobs_delete_own
  ON settings_config_blobs FOR DELETE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_settings_config_blobs_updated_at ON settings_config_blobs;
CREATE TRIGGER trg_settings_config_blobs_updated_at
  BEFORE UPDATE ON settings_config_blobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_settings();

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION 20260526_settings_config_blobs.sql
-- ═══════════════════════════════════════════════════════════════════════════
