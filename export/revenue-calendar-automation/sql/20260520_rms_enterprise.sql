-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS Enterprise — RÈGLES TACTIQUES, GARDE-FOUS, HIÉRARCHIE, AUDIT
--
-- Couche persistance du moteur RMS Enterprise :
--   - rms_tactical_rules     : 10+ règles tactiques contextuelles
--   - rms_guardrails         : garde-fous bloquants/avertissements/ajustements
--   - rms_priority_hierarchy : ordre d'exécution des règles
--   - rms_audit_log          : journal append-only (rule_triggered, guardrail_block, …)
--
-- RÈGLES MÉTIER :
--   - Multi-tenant strict : RLS basé sur hotel_users
--   - rms_audit_log immutable (append-only) ; les autres tables sont CRUD
--   - Seed des 10 règles + 12 garde-fous + 10 niveaux d'hiérarchie
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── rms_tactical_rules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rms_tactical_rules (
  id TEXT PRIMARY KEY,                              -- 'market_compression', 'custom_xxx', …
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('demand','pricing','distribution','event','protection')),
  priority INTEGER NOT NULL DEFAULT 99,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','simulation')),

  triggers JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{label, metric, operator, threshold}]
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{label, type, magnitude}]
  connectivity TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  ia_confidence INTEGER NOT NULL DEFAULT 75 CHECK (ia_confidence BETWEEN 0 AND 100),

  -- Stats agrégées (mises à jour par le moteur)
  revenue_impact_30d NUMERIC(12, 2) NOT NULL DEFAULT 0,
  revpar_impact_30d NUMERIC(6, 2) NOT NULL DEFAULT 0,
  triggers_count_30d INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  adjusted_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_tactical_rules_hotel ON rms_tactical_rules(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rms_tactical_rules_priority ON rms_tactical_rules(hotel_id, priority);

ALTER TABLE rms_tactical_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY rms_tactical_rules_select_own
  ON rms_tactical_rules FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_tactical_rules_insert_own
  ON rms_tactical_rules FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_tactical_rules_update_own
  ON rms_tactical_rules FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_tactical_rules_delete_own
  ON rms_tactical_rules FOR DELETE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- ─── rms_guardrails ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rms_guardrails (
  id TEXT PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pricing','availability','restriction','distribution','quality')),
  severity TEXT NOT NULL CHECK (severity IN ('blocking','warning','auto_adjust')),

  condition_text TEXT NOT NULL DEFAULT '',
  threshold TEXT NOT NULL DEFAULT '',                  -- affichage "110 €" / "±15%"
  threshold_value NUMERIC(12, 4) NOT NULL DEFAULT 0,   -- valeur numérique
  action_text TEXT NOT NULL DEFAULT '',

  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,         -- { scope, detail, percentage }
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),

  -- Stats agrégées
  blocks_count_30d INTEGER NOT NULL DEFAULT 0,
  warnings_count_30d INTEGER NOT NULL DEFAULT 0,
  adjustments_count_30d INTEGER NOT NULL DEFAULT 0,
  average_delta_limited NUMERIC(6, 2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_guardrails_hotel ON rms_guardrails(hotel_id);

ALTER TABLE rms_guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY rms_guardrails_select_own
  ON rms_guardrails FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_guardrails_insert_own
  ON rms_guardrails FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_guardrails_update_own
  ON rms_guardrails FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_guardrails_delete_own
  ON rms_guardrails FOR DELETE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- ─── rms_priority_hierarchy ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rms_priority_hierarchy (
  id TEXT PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  priority INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('rule','guardrail','strategy','event','autopilot')),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  type_label TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  preemption TEXT NOT NULL DEFAULT '',
  revenue_impact_30d NUMERIC(12, 2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (hotel_id, priority)
);

CREATE INDEX IF NOT EXISTS idx_rms_priority_hotel ON rms_priority_hierarchy(hotel_id, priority);

ALTER TABLE rms_priority_hierarchy ENABLE ROW LEVEL SECURITY;

CREATE POLICY rms_priority_select_own
  ON rms_priority_hierarchy FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_priority_insert_own
  ON rms_priority_hierarchy FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_priority_update_own
  ON rms_priority_hierarchy FOR UPDATE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_priority_delete_own
  ON rms_priority_hierarchy FOR DELETE
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- ─── rms_audit_log (append-only) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rms_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (event_type IN (
    'rule_triggered','rule_adjusted','rule_blocked',
    'guardrail_block','guardrail_warn','guardrail_adjust',
    'conflict_detected','conflict_resolved',
    'priority_changed',
    'autopilot_push','rollback'
  )),
  actor TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  impact NUMERIC(12, 2),
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_rms_audit_hotel_created ON rms_audit_log(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rms_audit_actor ON rms_audit_log(hotel_id, actor);
CREATE INDEX IF NOT EXISTS idx_rms_audit_type ON rms_audit_log(hotel_id, event_type);

ALTER TABLE rms_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY rms_audit_select_own
  ON rms_audit_log FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

CREATE POLICY rms_audit_insert_own
  ON rms_audit_log FOR INSERT
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid())
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

-- Immutabilité : refus d'UPDATE et DELETE
CREATE OR REPLACE FUNCTION rms_audit_log_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'rms_audit_log est immutable (append-only).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rms_audit_log_no_update ON rms_audit_log;
CREATE TRIGGER rms_audit_log_no_update
  BEFORE UPDATE ON rms_audit_log
  FOR EACH ROW EXECUTE FUNCTION rms_audit_log_immutable_check();

DROP TRIGGER IF EXISTS rms_audit_log_no_delete ON rms_audit_log;
CREATE TRIGGER rms_audit_log_no_delete
  BEFORE DELETE ON rms_audit_log
  FOR EACH ROW EXECUTE FUNCTION rms_audit_log_immutable_check();

-- ─── updated_at triggers ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rms_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rms_tactical_rules_touch ON rms_tactical_rules;
CREATE TRIGGER rms_tactical_rules_touch
  BEFORE UPDATE ON rms_tactical_rules
  FOR EACH ROW EXECUTE FUNCTION rms_touch_updated_at();

DROP TRIGGER IF EXISTS rms_guardrails_touch ON rms_guardrails;
CREATE TRIGGER rms_guardrails_touch
  BEFORE UPDATE ON rms_guardrails
  FOR EACH ROW EXECUTE FUNCTION rms_touch_updated_at();

DROP TRIGGER IF EXISTS rms_priority_touch ON rms_priority_hierarchy;
CREATE TRIGGER rms_priority_touch
  BEFORE UPDATE ON rms_priority_hierarchy
  FOR EACH ROW EXECUTE FUNCTION rms_touch_updated_at();

-- ─── Commentaires ───────────────────────────────────────────────────────────
COMMENT ON TABLE rms_tactical_rules     IS 'FLOWTYM — Catalogue des règles tactiques RMS Enterprise (par hôtel).';
COMMENT ON TABLE rms_guardrails         IS 'FLOWTYM — Garde-fous RMS (couche sécurité bloquante / avertissement / ajustement).';
COMMENT ON TABLE rms_priority_hierarchy IS 'FLOWTYM — Hiérarchie des priorités RMS (ordre d''évaluation, 1 = plus haut).';
COMMENT ON TABLE rms_audit_log          IS 'FLOWTYM — Journal append-only des décisions et blocages RMS.';
