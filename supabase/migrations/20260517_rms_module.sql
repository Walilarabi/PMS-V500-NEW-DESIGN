-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS — MIGRATION SUPABASE
-- 
-- Architecture complète pour Revenue Management System
-- - Événements (events)
-- - Compset (competitors + pricing)
-- - Recommandations (pricing recommendations + factors)
-- - Historique applications
-- - RLS strict multi-tenant
-- - Indexes performance
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. ÉVÉNEMENTS (PARIS 2026+)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Données événement
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  venue TEXT,
  category TEXT NOT NULL CHECK (category IN ('salon', 'sport', 'national', 'cultural')),
  impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
  impact_score INTEGER NOT NULL CHECK (impact_score >= 0 AND impact_score <= 100),
  
  -- Localisation
  city TEXT NOT NULL DEFAULT 'Paris',
  country_code TEXT NOT NULL DEFAULT 'FR',
  
  -- Métadonnées
  source TEXT, -- 'manual', 'imported', 'api'
  external_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Contraintes
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT unique_event_per_tenant UNIQUE (tenant_id, name, start_date)
);

-- Indexes
CREATE INDEX idx_rms_events_tenant ON rms_events(tenant_id);
CREATE INDEX idx_rms_events_dates ON rms_events(start_date, end_date);
CREATE INDEX idx_rms_events_city ON rms_events(city) WHERE is_active = true;
CREATE INDEX idx_rms_events_impact ON rms_events(impact_score DESC) WHERE is_active = true;

-- RLS
ALTER TABLE rms_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rms_events_tenant_isolation" ON rms_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Trigger updated_at
CREATE TRIGGER rms_events_updated_at
  BEFORE UPDATE ON rms_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CONCURRENTS COMPSET
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identification
  name TEXT NOT NULL,
  stars INTEGER CHECK (stars >= 1 AND stars <= 5),
  segment TEXT NOT NULL CHECK (segment IN ('budget', 'midscale', 'upscale', 'luxury')),
  
  -- Localisation
  distance_km NUMERIC(5,2), -- Distance de notre hôtel
  address TEXT,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'FR',
  
  -- Caractéristiques
  capacity INTEGER, -- Nombre chambres
  base_price NUMERIC(10,2), -- Prix moyen annuel
  quality_score NUMERIC(3,2) CHECK (quality_score >= 0 AND quality_score <= 10),
  review_count INTEGER DEFAULT 0,
  
  -- Sources externes
  booking_id TEXT,
  expedia_id TEXT,
  google_place_id TEXT,
  
  -- Métadonnées
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary_compset BOOLEAN NOT NULL DEFAULT false, -- Top 10 concurrents directs
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_competitor_per_tenant UNIQUE (tenant_id, name)
);

-- Indexes
CREATE INDEX idx_rms_competitors_tenant ON rms_competitors(tenant_id);
CREATE INDEX idx_rms_competitors_primary ON rms_competitors(tenant_id, is_primary_compset) WHERE is_active = true;
CREATE INDEX idx_rms_competitors_segment ON rms_competitors(segment) WHERE is_active = true;

-- RLS
ALTER TABLE rms_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rms_competitors_tenant_isolation" ON rms_competitors
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Trigger
CREATE TRIGGER rms_competitors_updated_at
  BEFORE UPDATE ON rms_competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. PRIX CONCURRENTS (HISTORIQUE)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_competitor_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES rms_competitors(id) ON DELETE CASCADE,
  
  -- Date & prix
  date DATE NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  availability TEXT CHECK (availability IN ('high', 'medium', 'low', 'sold-out')),
  
  -- Variations
  variation_vs_yesterday NUMERIC(5,2), -- %
  variation_vs_3days NUMERIC(5,2),
  variation_vs_7days NUMERIC(5,2),
  
  -- Métadonnées scraping
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'booking.com',
  is_reliable BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT unique_competitor_price_per_day UNIQUE (competitor_id, date)
);

-- Partitioning par date (mensuel) pour performance
-- Note: À implémenter selon volume de données
-- CREATE TABLE rms_competitor_pricing_y2026m05 PARTITION OF rms_competitor_pricing
--   FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes
CREATE INDEX idx_rms_competitor_pricing_tenant ON rms_competitor_pricing(tenant_id);
CREATE INDEX idx_rms_competitor_pricing_comp_date ON rms_competitor_pricing(competitor_id, date DESC);
CREATE INDEX idx_rms_competitor_pricing_date ON rms_competitor_pricing(date DESC);

-- RLS
ALTER TABLE rms_competitor_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rms_competitor_pricing_tenant_isolation" ON rms_competitor_pricing
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RECOMMANDATIONS PRICING
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_pricing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Date & pricing
  date DATE NOT NULL,
  room_type_id UUID REFERENCES room_types(id),
  rate_plan_id UUID REFERENCES rate_plans(id),
  
  -- Prix
  current_price NUMERIC(10,2) NOT NULL,
  recommended_price NUMERIC(10,2) NOT NULL,
  delta_amount NUMERIC(10,2) NOT NULL,
  delta_percent NUMERIC(5,2) NOT NULL,
  
  -- Confiance & status
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'expired')),
  
  -- Métadonnées
  triggered_rules TEXT[], -- Array des règles déclenchées
  warnings TEXT[],
  opportunities TEXT[],
  
  -- Application
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  
  CONSTRAINT unique_recommendation_per_day UNIQUE (tenant_id, date, room_type_id, rate_plan_id, created_at)
);

-- Indexes
CREATE INDEX idx_rms_pricing_reco_tenant ON rms_pricing_recommendations(tenant_id);
CREATE INDEX idx_rms_pricing_reco_date ON rms_pricing_recommendations(date DESC);
CREATE INDEX idx_rms_pricing_reco_status ON rms_pricing_recommendations(status) WHERE status = 'pending';
CREATE INDEX idx_rms_pricing_reco_confidence ON rms_pricing_recommendations(confidence_score DESC);

-- RLS
ALTER TABLE rms_pricing_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rms_pricing_reco_tenant_isolation" ON rms_pricing_recommendations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. FACTEURS DE PRICING (DÉTAIL RECOMMANDATIONS)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_pricing_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES rms_pricing_recommendations(id) ON DELETE CASCADE,
  
  -- Facteur
  factor_id TEXT NOT NULL, -- 'events', 'compset', 'occupancy', etc.
  factor_name TEXT NOT NULL,
  weight NUMERIC(3,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  value NUMERIC(10,2) NOT NULL,
  impact NUMERIC(4,2) NOT NULL CHECK (impact >= -1 AND impact <= 1),
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  explanation TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rms_pricing_factors_reco ON rms_pricing_factors(recommendation_id);
CREATE INDEX idx_rms_pricing_factors_impact ON rms_pricing_factors(ABS(impact) DESC);

-- RLS
ALTER TABLE rms_pricing_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rms_pricing_factors_via_recommendation" ON rms_pricing_factors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rms_pricing_recommendations r
      WHERE r.id = recommendation_id
      AND r.tenant_id = current_setting('app.current_tenant_id')::UUID
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 6. HISTORIQUE APPLICATIONS PRICING
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_pricing_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES rms_pricing_recommendations(id),
  
  -- Application
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Pricing appliqué
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  room_type_id UUID REFERENCES room_types(id),
  rate_plan_id UUID REFERENCES rate_plans(id),
  
  old_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  
  -- Résultats (à remplir après coup)
  actual_occupancy NUMERIC(5,2), -- TO réel
  actual_revenue NUMERIC(10,2), -- Revenue réel
  performance_vs_forecast NUMERIC(5,2), -- % vs prévision
  
  -- Métadonnées
  notes TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_rms_pricing_apps_tenant ON rms_pricing_applications(tenant_id);
CREATE INDEX idx_rms_pricing_apps_dates ON rms_pricing_applications(date_range_start, date_range_end);
CREATE INDEX idx_rms_pricing_apps_user ON rms_pricing_applications(applied_by);

-- RLS
ALTER TABLE rms_pricing_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rms_pricing_apps_tenant_isolation" ON rms_pricing_applications
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. VUES MATÉRIALISÉES (PERFORMANCE)
-- ───────────────────────────────────────────────────────────────────────────

-- Vue : Statistiques compset par date
CREATE MATERIALIZED VIEW IF NOT EXISTS rms_compset_daily_stats AS
SELECT
  tenant_id,
  date,
  COUNT(*) as competitor_count,
  AVG(price) as avg_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) as median_price,
  MIN(price) as min_price,
  MAX(price) as max_price,
  STDDEV(price) as price_stddev,
  COUNT(*) FILTER (WHERE availability = 'sold-out') as sold_out_count
FROM rms_competitor_pricing
WHERE is_reliable = true
GROUP BY tenant_id, date;

CREATE UNIQUE INDEX idx_rms_compset_stats_tenant_date ON rms_compset_daily_stats(tenant_id, date);

-- Refresh automatique (à configurer selon besoins)
-- SELECT cron.schedule('refresh-rms-compset-stats', '0 2 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY rms_compset_daily_stats');

-- ───────────────────────────────────────────────────────────────────────────
-- 8. FUNCTIONS UTILITAIRES
-- ───────────────────────────────────────────────────────────────────────────

-- Function : Calculer impact événements pour une date
CREATE OR REPLACE FUNCTION rms_get_event_impact_score(
  p_tenant_id UUID,
  p_date DATE,
  p_city TEXT DEFAULT 'Paris'
)
RETURNS INTEGER AS $$
DECLARE
  v_total_impact INTEGER;
BEGIN
  SELECT COALESCE(SUM(impact_score), 0)
  INTO v_total_impact
  FROM rms_events
  WHERE tenant_id = p_tenant_id
    AND city = p_city
    AND is_active = true
    AND p_date >= start_date
    AND p_date <= end_date;
  
  -- Plafonner à 100
  RETURN LEAST(v_total_impact, 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function : Obtenir statistiques compset pour une date
CREATE OR REPLACE FUNCTION rms_get_compset_stats(
  p_tenant_id UUID,
  p_date DATE
)
RETURNS TABLE (
  avg_price NUMERIC,
  median_price NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  competitor_count INTEGER,
  sold_out_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(cp.price)::NUMERIC(10,2),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cp.price)::NUMERIC(10,2),
    MIN(cp.price)::NUMERIC(10,2),
    MAX(cp.price)::NUMERIC(10,2),
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE cp.availability = 'sold-out')::INTEGER
  FROM rms_competitor_pricing cp
  INNER JOIN rms_competitors c ON c.id = cp.competitor_id
  WHERE cp.tenant_id = p_tenant_id
    AND cp.date = p_date
    AND cp.is_reliable = true
    AND c.is_active = true
    AND c.is_primary_compset = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- ───────────────────────────────────────────────────────────────────────────
-- 9. AUDIT LOGS (TRACKING MODIFICATIONS)
-- ───────────────────────────────────────────────────────────────────────────

-- Trigger audit pour rms_pricing_recommendations
CREATE OR REPLACE FUNCTION rms_audit_pricing_recommendation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO audit_logs (
      tenant_id,
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      user_id
    ) VALUES (
      NEW.tenant_id,
      'rms_pricing_recommendation',
      NEW.id,
      'status_change',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'applied_by', NEW.applied_by),
      NEW.applied_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rms_pricing_reco_audit
  AFTER UPDATE ON rms_pricing_recommendations
  FOR EACH ROW EXECUTE FUNCTION rms_audit_pricing_recommendation();

-- ───────────────────────────────────────────────────────────────────────────
-- 10. DONNÉES INITIALES (ÉVÉNEMENTS PARIS 2026)
-- ───────────────────────────────────────────────────────────────────────────

-- Note: À adapter selon tenant_id réel
-- Cette section sera exécutée manuellement après création du tenant

/*
INSERT INTO rms_events (tenant_id, name, start_date, end_date, venue, category, impact, impact_score, city) VALUES
  ('<TENANT_ID>', 'Vivatech', '2026-06-11', '2026-06-14', 'P. de Versailles', 'salon', 'high', 95, 'Paris'),
  ('<TENANT_ID>', 'Roland Garros', '2026-05-25', '2026-06-06', 'Roland Garros', 'sport', 'high', 92, 'Paris'),
  ('<TENANT_ID>', 'Salon de l''Agriculture', '2026-02-21', '2026-03-01', 'P. de Versailles', 'salon', 'high', 88, 'Paris'),
  ('<TENANT_ID>', 'Mode Féminine', '2026-03-02', '2026-03-10', 'Paris Centre', 'salon', 'high', 85, 'Paris'),
  ('<TENANT_ID>', '14 Juillet', '2026-07-14', '2026-07-14', 'Paris', 'national', 'high', 85, 'Paris')
  -- ... 58 autres événements
ON CONFLICT DO NOTHING;
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTAIRES & DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE rms_events IS 'Événements impactant le pricing (salons, sport, jours fériés)';
COMMENT ON TABLE rms_competitors IS 'Concurrents du compset (primary = top 10 directs)';
COMMENT ON TABLE rms_competitor_pricing IS 'Historique prix concurrents (partitionné par date)';
COMMENT ON TABLE rms_pricing_recommendations IS 'Recommandations tarifaires générées par l''engine';
COMMENT ON TABLE rms_pricing_factors IS 'Détail des 11 facteurs par recommandation';
COMMENT ON TABLE rms_pricing_applications IS 'Historique des applications pricing avec résultats';

COMMENT ON FUNCTION rms_get_event_impact_score IS 'Calcule le score d''impact cumulé des événements pour une date';
COMMENT ON FUNCTION rms_get_compset_stats IS 'Statistiques compset (avg, median, min, max) pour une date';
