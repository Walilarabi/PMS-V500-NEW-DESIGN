-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS — MARKET INTELLIGENCE MIGRATION
--
-- Tables pour persister la couche d'intelligence marché :
--   • mi_recommendations   : recommandations RMS générées par le moteur
--   • mi_recommendation_actions : actions utilisateur (accept/reject/snooze)
--   • mi_market_signals    : signaux marché détectés (audit trail)
--   • mi_alerts            : alertes intelligence marché
--
-- Pattern multi-tenant strict (RLS) + indexes pour les requêtes courantes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. RECOMMANDATIONS RMS (générées par le moteur)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mi_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identification
  target_date DATE NOT NULL,
  target_end_date DATE,
  type TEXT NOT NULL CHECK (type IN (
    'bar_lift', 'dynamic_lift', 'close_promotions', 'close_ota', 'min_stay',
    'cta', 'ctd', 'open_premium', 'los_restrictions', 'reduce_allotments',
    'controlled_overbooking', 'inventory_protection'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('soft', 'standard', 'aggressive', 'maximum')),

  -- Contenu
  title TEXT NOT NULL,
  suggested_value NUMERIC(10, 2) NOT NULL,
  suggested_unit TEXT NOT NULL CHECK (suggested_unit IN ('percent', 'nights', 'flag')),
  causes JSONB NOT NULL DEFAULT '[]'::jsonb,
  driving_event_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Métriques
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  compression_snapshot JSONB,
  velocity_snapshot JSONB,

  -- Cycle de vie
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'rejected', 'snoozed', 'expired', 'applied'
  )),
  status_updated_at TIMESTAMPTZ,
  status_updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mi_recommendations_tenant ON mi_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mi_recommendations_status ON mi_recommendations(tenant_id, status, target_date);
CREATE INDEX IF NOT EXISTS idx_mi_recommendations_target_date ON mi_recommendations(target_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mi_recommendations_severity ON mi_recommendations(severity, confidence DESC) WHERE status = 'pending';

ALTER TABLE mi_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mi_recommendations_tenant_isolation" ON mi_recommendations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. ACTIONS UTILISATEUR (audit trail)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mi_recommendation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL REFERENCES mi_recommendations(id) ON DELETE CASCADE,

  action TEXT NOT NULL CHECK (action IN ('accept', 'reject', 'snooze', 'apply')),
  reason TEXT,
  applied_value NUMERIC(10, 2),

  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mi_reco_actions_tenant ON mi_recommendation_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mi_reco_actions_recommendation ON mi_recommendation_actions(recommendation_id);

ALTER TABLE mi_recommendation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mi_reco_actions_tenant_isolation" ON mi_recommendation_actions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. ALERTES INTELLIGENCE MARCHÉ
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mi_alerts (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'critical')),
  code TEXT NOT NULL CHECK (code IN (
    'brutal_compression', 'abnormal_variation', 'stock_disappearance',
    'critical_event_detected', 'market_restrictions_change',
    'pickup_acceleration', 'reliability_drift'
  )),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  refs JSONB NOT NULL DEFAULT '{}'::jsonb,

  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mi_alerts_tenant ON mi_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mi_alerts_unack ON mi_alerts(tenant_id, level, emitted_at DESC)
  WHERE acknowledged_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE mi_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mi_alerts_tenant_isolation" ON mi_alerts
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. DOCUMENTATION
-- ───────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE mi_recommendations IS
  'Recommandations RMS générées par le moteur Market Intelligence (LOT 4).';
COMMENT ON TABLE mi_recommendation_actions IS
  'Audit trail des décisions Revenue Manager sur les recommandations.';
COMMENT ON TABLE mi_alerts IS
  'Alertes intelligence marché (compression brutale, événement critique, etc.).';
