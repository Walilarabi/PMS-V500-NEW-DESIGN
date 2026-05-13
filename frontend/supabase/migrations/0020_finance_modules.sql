-- ============================================================================
-- FLOWTYM PMS — Migration 0020 : Finance Modules
-- ----------------------------------------------------------------------------
-- Adds:
--   * reconciliation_lines  — lignes bancaires OTA importées + rapprochement
--   * fec_exports           — historique des exports FEC (immutable)
--   * revenue_anomalies     — anomalies détectées par le moteur Revenue Integrity
--   * csv_import_templates  — templates de mapping CSV par source OTA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- reconciliation_lines — Lignes bancaires à rapprocher (Booking, Expedia, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  source          text NOT NULL,                          -- 'BOOKING' | 'EXPEDIA' | 'AIRBNB' | 'BANK_HOTEL'
  reference       text NOT NULL,
  description     text,
  amount          numeric(12,2) NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'EUR',
  line_date       date NOT NULL,
  status          text NOT NULL DEFAULT 'pending',        -- 'pending' | 'matched' | 'disputed' | 'ignored'
  reservation_id  uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  match_score     numeric(5,2),                           -- 0–100 score de confiance du rapprochement auto
  match_delta     numeric(12,2),                          -- écart en € entre la ligne et la réservation
  matched_at      timestamptz,
  matched_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes           text,
  raw_payload     jsonb,                                  -- payload CSV brut
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_hotel_date   ON public.reconciliation_lines(hotel_id, line_date DESC);
CREATE INDEX IF NOT EXISTS idx_recon_status        ON public.reconciliation_lines(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_recon_source        ON public.reconciliation_lines(hotel_id, source);

DROP TRIGGER IF EXISTS trg_recon_updated_at ON public.reconciliation_lines;
CREATE TRIGGER trg_recon_updated_at
  BEFORE UPDATE ON public.reconciliation_lines
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.reconciliation_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recon_hotel_isolation ON public.reconciliation_lines;
CREATE POLICY recon_hotel_isolation ON public.reconciliation_lines
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- fec_exports — Historique immutable des exports FEC (DGFiP)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fec_exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  period_from     date NOT NULL,
  period_to       date NOT NULL,
  siren           text,
  filename        text NOT NULL,                          -- ex: 000000000FEC20260511.txt
  entries_count   int NOT NULL DEFAULT 0,
  total_debit     numeric(14,2) NOT NULL DEFAULT 0,
  total_credit    numeric(14,2) NOT NULL DEFAULT 0,
  is_balanced     boolean NOT NULL DEFAULT false,
  sha256_hash     text,                                   -- hash du fichier pour preuve d'intégrité
  generated_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- FEC immutable : ni UPDATE ni DELETE
CREATE OR REPLACE FUNCTION app.fec_exports_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'fec_exports are immutable — create a new export instead'; END;
$$;

DROP TRIGGER IF EXISTS trg_fec_no_update ON public.fec_exports;
CREATE TRIGGER trg_fec_no_update
  BEFORE UPDATE ON public.fec_exports FOR EACH ROW
  EXECUTE FUNCTION app.fec_exports_immutable();

DROP TRIGGER IF EXISTS trg_fec_no_delete ON public.fec_exports;
CREATE TRIGGER trg_fec_no_delete
  BEFORE DELETE ON public.fec_exports FOR EACH ROW
  EXECUTE FUNCTION app.fec_exports_immutable();

CREATE INDEX IF NOT EXISTS idx_fec_hotel_date ON public.fec_exports(hotel_id, created_at DESC);

ALTER TABLE public.fec_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fec_hotel_isolation ON public.fec_exports;
CREATE POLICY fec_hotel_isolation ON public.fec_exports
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- revenue_anomalies — Anomalies tarifaires / financières détectées (Revenue Integrity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revenue_anomalies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  reservation_id  uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  recon_line_id   uuid REFERENCES public.reconciliation_lines(id) ON DELETE SET NULL,
  anomaly_type    text NOT NULL,  -- 'PRICE_MISMATCH' | 'COMMISSION_ERROR' | 'TAX_ERROR' | 'PAYOUT_ERROR' | 'CURRENCY_ERROR'
  source          text,           -- OTA source
  severity        text NOT NULL DEFAULT 'warning',  -- 'info' | 'warning' | 'critical'
  score           numeric(5,2),   -- 0–100 (100 = parfait)
  expected_amount numeric(12,2),
  actual_amount   numeric(12,2),
  delta           numeric(12,2),  -- actual - expected
  description     text NOT NULL,
  details         jsonb,          -- calcul détaillé, règles utilisées
  status          text NOT NULL DEFAULT 'open',  -- 'open' | 'resolved' | 'ignored'
  resolved_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_hotel_date   ON public.revenue_anomalies(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_status        ON public.revenue_anomalies(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_anomaly_type          ON public.revenue_anomalies(hotel_id, anomaly_type);

DROP TRIGGER IF EXISTS trg_anomaly_updated_at ON public.revenue_anomalies;
CREATE TRIGGER trg_anomaly_updated_at
  BEFORE UPDATE ON public.revenue_anomalies
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.revenue_anomalies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anomaly_hotel_isolation ON public.revenue_anomalies;
CREATE POLICY anomaly_hotel_isolation ON public.revenue_anomalies
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- csv_import_templates — Templates de mapping CSV par source OTA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.csv_import_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name            text NOT NULL,
  source          text NOT NULL,  -- 'BOOKING' | 'EXPEDIA' | 'AIRBNB' | 'BANK_HOTEL'
  mapping         jsonb NOT NULL DEFAULT '{}',  -- { amount: "Montant", date: "Date", reference: "Référence" }
  default_currency char(3) NOT NULL DEFAULT 'EUR',
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, name)
);

CREATE INDEX IF NOT EXISTS idx_csv_tpl_hotel_source ON public.csv_import_templates(hotel_id, source);

DROP TRIGGER IF EXISTS trg_csv_tpl_updated_at ON public.csv_import_templates;
CREATE TRIGGER trg_csv_tpl_updated_at
  BEFORE UPDATE ON public.csv_import_templates
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.csv_import_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS csv_tpl_hotel_isolation ON public.csv_import_templates;
CREATE POLICY csv_tpl_hotel_isolation ON public.csv_import_templates
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- Extend audit_logs RLS to include SELECT for direction role
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_hotel_read ON public.audit_logs;
CREATE POLICY audit_hotel_read ON public.audit_logs
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());
