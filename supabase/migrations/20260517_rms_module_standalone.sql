-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS — MIGRATION STANDALONE (Sans dépendance tenants)
-- 
-- VERSION SIMPLIFIÉE pour démarrage rapide
-- À utiliser si la table tenants n'existe pas encore
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 0. FONCTION HELPER updated_at (si elle n'existe pas)
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. ÉVÉNEMENTS (PARIS 2026+)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
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
  source TEXT,
  external_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_rms_events_dates ON rms_events(start_date, end_date);
CREATE INDEX idx_rms_events_city ON rms_events(city) WHERE is_active = true;
CREATE INDEX idx_rms_events_impact ON rms_events(impact_score DESC) WHERE is_active = true;

CREATE TRIGGER rms_events_updated_at
  BEFORE UPDATE ON rms_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CONCURRENTS COMPSET
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  name TEXT NOT NULL,
  stars INTEGER CHECK (stars >= 1 AND stars <= 5),
  segment TEXT NOT NULL CHECK (segment IN ('budget', 'midscale', 'upscale', 'luxury')),
  
  -- Localisation
  distance_km NUMERIC(5,2),
  address TEXT,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'FR',
  
  -- Caractéristiques
  capacity INTEGER,
  base_price NUMERIC(10,2),
  quality_score NUMERIC(3,2) CHECK (quality_score >= 0 AND quality_score <= 10),
  review_count INTEGER DEFAULT 0,
  
  -- Sources externes
  booking_id TEXT,
  
  -- Métadonnées
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary_compset BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rms_competitors_primary ON rms_competitors(is_primary_compset) WHERE is_active = true;
CREATE INDEX idx_rms_competitors_segment ON rms_competitors(segment) WHERE is_active = true;

CREATE TRIGGER rms_competitors_updated_at
  BEFORE UPDATE ON rms_competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. PRIX CONCURRENTS (HISTORIQUE)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_competitor_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES rms_competitors(id) ON DELETE CASCADE,
  
  -- Date & prix
  date DATE NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  availability TEXT CHECK (availability IN ('high', 'medium', 'low', 'sold-out')),
  
  -- Variations
  variation_vs_yesterday NUMERIC(5,2),
  variation_vs_3days NUMERIC(5,2),
  variation_vs_7days NUMERIC(5,2),
  
  -- Métadonnées scraping
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'booking.com',
  is_reliable BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT unique_competitor_price_per_day UNIQUE (competitor_id, date)
);

CREATE INDEX idx_rms_competitor_pricing_comp_date ON rms_competitor_pricing(competitor_id, date DESC);
CREATE INDEX idx_rms_competitor_pricing_date ON rms_competitor_pricing(date DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RECOMMANDATIONS PRICING
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_pricing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Date & pricing
  date DATE NOT NULL,
  room_type_id UUID,
  rate_plan_id UUID,
  
  -- Prix
  current_price NUMERIC(10,2) NOT NULL,
  recommended_price NUMERIC(10,2) NOT NULL,
  delta_amount NUMERIC(10,2) NOT NULL,
  delta_percent NUMERIC(5,2) NOT NULL,
  
  -- Confiance & status
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'expired')),
  
  -- Métadonnées
  triggered_rules TEXT[],
  warnings TEXT[],
  opportunities TEXT[],
  
  -- Application
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_rms_pricing_reco_date ON rms_pricing_recommendations(date DESC);
CREATE INDEX idx_rms_pricing_reco_status ON rms_pricing_recommendations(status) WHERE status = 'pending';
CREATE INDEX idx_rms_pricing_reco_confidence ON rms_pricing_recommendations(confidence_score DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. FACTEURS DE PRICING (DÉTAIL RECOMMANDATIONS)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_pricing_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES rms_pricing_recommendations(id) ON DELETE CASCADE,
  
  -- Facteur
  factor_id TEXT NOT NULL,
  factor_name TEXT NOT NULL,
  weight NUMERIC(3,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  value NUMERIC(10,2) NOT NULL,
  impact NUMERIC(4,2) NOT NULL CHECK (impact >= -1 AND impact <= 1),
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  explanation TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rms_pricing_factors_reco ON rms_pricing_factors(recommendation_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. HISTORIQUE APPLICATIONS PRICING
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rms_pricing_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES rms_pricing_recommendations(id),
  
  -- Application
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by UUID,
  
  -- Pricing appliqué
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  room_type_id UUID,
  rate_plan_id UUID,
  
  old_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  
  -- Résultats
  actual_occupancy NUMERIC(5,2),
  actual_revenue NUMERIC(10,2),
  performance_vs_forecast NUMERIC(5,2),
  
  -- Métadonnées
  notes TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_rms_pricing_apps_dates ON rms_pricing_applications(date_range_start, date_range_end);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. FUNCTIONS UTILITAIRES
-- ───────────────────────────────────────────────────────────────────────────

-- Function : Calculer impact événements pour une date
CREATE OR REPLACE FUNCTION rms_get_event_impact_score(
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
  WHERE city = p_city
    AND is_active = true
    AND p_date >= start_date
    AND p_date <= end_date;
  
  RETURN LEAST(v_total_impact, 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function : Obtenir statistiques compset pour une date
CREATE OR REPLACE FUNCTION rms_get_compset_stats(p_date DATE)
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
  WHERE cp.date = p_date
    AND cp.is_reliable = true
    AND c.is_active = true
    AND c.is_primary_compset = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTAIRES
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE rms_events IS 'Événements impactant le pricing (salons, sport, jours fériés)';
COMMENT ON TABLE rms_competitors IS 'Concurrents du compset (primary = top 10 directs)';
COMMENT ON TABLE rms_competitor_pricing IS 'Historique prix concurrents';
COMMENT ON TABLE rms_pricing_recommendations IS 'Recommandations tarifaires générées';
COMMENT ON TABLE rms_pricing_factors IS 'Détail des 11 facteurs par recommandation';
COMMENT ON TABLE rms_pricing_applications IS 'Historique applications pricing avec résultats';
