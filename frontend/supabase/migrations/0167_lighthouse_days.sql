-- ============================================================================
-- FLOWTYM RMS — Migration 0167 : lighthouse_days + lighthouse_imports columns
-- ----------------------------------------------------------------------------
-- Fixes the P0 pipeline blocker: the lighthouse-persistence.service.ts inserts
-- into lighthouse_days (missing table) and references 6 columns on
-- lighthouse_imports (missing from migration 0163).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend lighthouse_imports with columns used by persistence service
-- ----------------------------------------------------------------------------
ALTER TABLE public.lighthouse_imports
  ADD COLUMN IF NOT EXISTS our_hotel_name   text,
  ADD COLUMN IF NOT EXISTS competitor_names jsonb,
  ADD COLUMN IF NOT EXISTS sheets_found     jsonb,
  ADD COLUMN IF NOT EXISTS days_count       integer,
  ADD COLUMN IF NOT EXISTS is_active        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at      timestamptz;

-- Index for fast "get active import for this hotel" lookup
CREATE INDEX IF NOT EXISTS idx_lighthouse_imports_active
  ON public.lighthouse_imports(hotel_id, is_active)
  WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 2. lighthouse_days — one row per stay date per import snapshot
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lighthouse_days (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id               uuid        NOT NULL REFERENCES public.lighthouse_imports(id) ON DELETE CASCADE,
  hotel_id                uuid        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  stay_date               date        NOT NULL,
  day_name                text,
  -- Pricing
  our_price               numeric,
  compset_median          numeric,
  compset_min             numeric,
  compset_max             numeric,
  -- Market intelligence
  market_demand           numeric,
  market_demand_percent   numeric,
  ranking                 text,
  rank_position           integer,
  rank_total              integer,
  booking_rank            text,
  -- Context
  holidays                text,
  events                  text,
  -- Competitors snapshot (array of { name, price, delta } objects)
  competitors             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Trend deltas vs prior days
  var_vs_yesterday        numeric,
  var_vs_3days            numeric,
  var_vs_7days            numeric,
  -- Audit
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Ensure uniqueness: one row per import × date
CREATE UNIQUE INDEX IF NOT EXISTS lighthouse_days_import_date_key
  ON public.lighthouse_days(import_id, stay_date);

-- Query patterns: range queries on active import's days
CREATE INDEX IF NOT EXISTS idx_lighthouse_days_hotel_date
  ON public.lighthouse_days(hotel_id, stay_date);

CREATE INDEX IF NOT EXISTS idx_lighthouse_days_import
  ON public.lighthouse_days(import_id);

COMMENT ON TABLE public.lighthouse_days IS
  'Per-date competitor rate snapshot from Lighthouse Excel imports. '
  'One row per stay_date per import. FK cascades on import deletion.';

-- ----------------------------------------------------------------------------
-- 3. RLS — hotel_id isolation
-- ----------------------------------------------------------------------------
ALTER TABLE public.lighthouse_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lighthouse_days_select ON public.lighthouse_days;
CREATE POLICY lighthouse_days_select ON public.lighthouse_days FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

-- Inserts via service_role only (persistence service runs server-side or
-- as the authenticated user for the hotel — allow matching hotel_id)
DROP POLICY IF EXISTS lighthouse_days_insert ON public.lighthouse_days;
CREATE POLICY lighthouse_days_insert ON public.lighthouse_days FOR INSERT
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- No direct UPDATE/DELETE from client — archive at import level only
DROP POLICY IF EXISTS lighthouse_days_no_update ON public.lighthouse_days;
CREATE POLICY lighthouse_days_no_update ON public.lighthouse_days FOR UPDATE
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS lighthouse_days_no_delete ON public.lighthouse_days;
CREATE POLICY lighthouse_days_no_delete ON public.lighthouse_days FOR DELETE
  USING (false);
