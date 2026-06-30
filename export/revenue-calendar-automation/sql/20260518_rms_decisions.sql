-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS — HISTORIQUE HORODATÉ DES DÉCISIONS
--
-- Table immutable qui trace chaque action utilisateur sur les recommandations
-- IA du tableau RMS : accepter / refuser / maintenir.
--
-- RÈGLES MÉTIER :
-- - Append-only : pas d'UPDATE, pas de DELETE (auditabilité)
-- - Multi-tenant strict via RLS
-- - Indexée par hotel_id + stay_date + created_at pour requêtes rapides
-- - Toutes les valeurs au moment de la décision sont gelées (snapshot)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rms_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identifiant de la cellule décidée (chambre référente + date)
  stay_date DATE NOT NULL,
  room_type_code TEXT,             -- Optionnel (peut être null si décision globale)

  -- Action utilisateur
  action TEXT NOT NULL CHECK (action IN ('accepted', 'rejected', 'maintained')),

  -- Snapshot au moment de la décision (gelé, jamais modifié)
  current_price NUMERIC(10, 2) NOT NULL,         -- Prix avant action
  suggested_price NUMERIC(10, 2) NOT NULL,       -- Prix IA recommandé
  final_price NUMERIC(10, 2) NOT NULL,           -- Prix effectivement appliqué
  strategy TEXT NOT NULL,                        -- "Yield Max", "Défensive", etc.
  recommendation TEXT NOT NULL,                  -- "Augmenter", "Maintenir", "Baisser"
  confidence_score INTEGER,                      -- 0..100, optionnel

  -- Snapshot du contexte marché (gelé)
  market_pressure_percent INTEGER,               -- 0..100
  occupancy_rate NUMERIC(5, 2),                  -- 0..100
  median_price NUMERIC(10, 2),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Contraintes métier : append-only (interdiction logique de modifier)
  CONSTRAINT rms_decisions_action_valid CHECK (action IN ('accepted', 'rejected', 'maintained'))
);

-- Indexes pour requêtes typiques
CREATE INDEX IF NOT EXISTS idx_rms_decisions_hotel ON rms_decisions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rms_decisions_hotel_date ON rms_decisions(hotel_id, stay_date DESC);
CREATE INDEX IF NOT EXISTS idx_rms_decisions_created_at ON rms_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rms_decisions_user ON rms_decisions(created_by);

-- ─── RLS multi-tenant ──────────────────────────────────────────────────────
ALTER TABLE rms_decisions ENABLE ROW LEVEL SECURITY;

-- SELECT : utilisateurs voient uniquement les décisions de leur hôtel
CREATE POLICY rms_decisions_select_own_hotel
  ON rms_decisions FOR SELECT
  USING (hotel_id IN (
    SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()
  ));

-- INSERT : utilisateurs peuvent insérer uniquement pour leur hôtel
CREATE POLICY rms_decisions_insert_own_hotel
  ON rms_decisions FOR INSERT
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid())
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

-- Pas de UPDATE policy : append-only par construction
-- Pas de DELETE policy : append-only par construction

-- ─── Trigger : refuser UPDATE et DELETE explicitement ──────────────────────
CREATE OR REPLACE FUNCTION rms_decisions_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'rms_decisions est immutable : ni UPDATE ni DELETE autorisé. Utilisez une nouvelle décision pour corriger.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rms_decisions_block_update ON rms_decisions;
CREATE TRIGGER rms_decisions_block_update
  BEFORE UPDATE ON rms_decisions
  FOR EACH ROW EXECUTE FUNCTION rms_decisions_immutable_check();

DROP TRIGGER IF EXISTS rms_decisions_block_delete ON rms_decisions;
CREATE TRIGGER rms_decisions_block_delete
  BEFORE DELETE ON rms_decisions
  FOR EACH ROW EXECUTE FUNCTION rms_decisions_immutable_check();

COMMENT ON TABLE rms_decisions IS 'Historique horodaté immutable des décisions yield manager sur les recommandations IA. Append-only.';
