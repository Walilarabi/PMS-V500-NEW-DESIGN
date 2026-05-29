-- FLOWTYM — Lighthouse import pipeline tables
--
-- Creates two tables used by lighthouse-persistence.service.ts and
-- lighthouse-comparison.service.ts:
--   lighthouse_imports — one row per uploaded Lighthouse Excel file (versioned)
--   lighthouse_days    — one row per (import, date) cell with competitor pricing
--
-- Multi-tenant isolation via hotel_id + get_user_hotel_id() RLS.

-- ─────────────────────────────────────────────────────────────────────────────
-- lighthouse_imports — versioned import snapshots
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lighthouse_imports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  filename         TEXT        NOT NULL,
  our_hotel_name   TEXT,
  competitor_names JSONB       NOT NULL DEFAULT '[]',
  sheets_found     JSONB       NOT NULL DEFAULT '[]',
  warnings         JSONB       NOT NULL DEFAULT '[]',
  days_count       INTEGER     NOT NULL DEFAULT 0,
  rows_ingested    INTEGER     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'completed'
                               CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  archived_at      TIMESTAMPTZ,
  uploaded_by      UUID        REFERENCES auth.users(id),
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lighthouse_imports_hotel
  ON public.lighthouse_imports(hotel_id);
CREATE INDEX IF NOT EXISTS idx_lighthouse_imports_hotel_active
  ON public.lighthouse_imports(hotel_id, is_active)
  WHERE is_active = true;

ALTER TABLE public.lighthouse_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lighthouse_imports_tenant_select"
  ON public.lighthouse_imports FOR SELECT
  USING (hotel_id = get_user_hotel_id());

CREATE POLICY "lighthouse_imports_tenant_insert"
  ON public.lighthouse_imports FOR INSERT
  WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY "lighthouse_imports_tenant_update"
  ON public.lighthouse_imports FOR UPDATE
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY "lighthouse_imports_tenant_delete"
  ON public.lighthouse_imports FOR DELETE
  USING (hotel_id = get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- lighthouse_days — per-date competitor pricing data
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lighthouse_days (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id             UUID        NOT NULL REFERENCES public.lighthouse_imports(id) ON DELETE CASCADE,
  hotel_id              UUID        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  stay_date             DATE        NOT NULL,
  day_name              TEXT,
  our_price             NUMERIC(10,2),
  compset_median        NUMERIC(10,2),
  compset_min           NUMERIC(10,2),
  compset_max           NUMERIC(10,2),
  market_demand         NUMERIC(10,2),
  market_demand_percent NUMERIC(5,2),
  ranking               TEXT,
  rank_position         INTEGER,
  rank_total            INTEGER,
  booking_rank          INTEGER,
  holidays              JSONB       NOT NULL DEFAULT '[]',
  events                JSONB       NOT NULL DEFAULT '[]',
  competitors           JSONB       NOT NULL DEFAULT '{}',
  var_vs_yesterday      NUMERIC(8,2),
  var_vs_3days          NUMERIC(8,2),
  var_vs_7days          NUMERIC(8,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lighthouse_days_hotel
  ON public.lighthouse_days(hotel_id);
CREATE INDEX IF NOT EXISTS idx_lighthouse_days_import
  ON public.lighthouse_days(import_id);
CREATE INDEX IF NOT EXISTS idx_lighthouse_days_hotel_date
  ON public.lighthouse_days(hotel_id, stay_date);

ALTER TABLE public.lighthouse_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lighthouse_days_tenant_select"
  ON public.lighthouse_days FOR SELECT
  USING (hotel_id = get_user_hotel_id());

CREATE POLICY "lighthouse_days_tenant_insert"
  ON public.lighthouse_days FOR INSERT
  WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY "lighthouse_days_tenant_update"
  ON public.lighthouse_days FOR UPDATE
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY "lighthouse_days_tenant_delete"
  ON public.lighthouse_days FOR DELETE
  USING (hotel_id = get_user_hotel_id());

