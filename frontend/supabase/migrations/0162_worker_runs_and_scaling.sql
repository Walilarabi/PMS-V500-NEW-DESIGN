-- ============================================================================
-- FLOWTYM RMS — Migration 0162 : Worker runs tracking + Lighthouse plan tier
-- ----------------------------------------------------------------------------
-- Supports the SCALING_PLAN by instrumenting worker executions and tracking
-- which Lighthouse pricing plan each hotel is on.
--
-- This data tells us WHEN to upgrade from Tier 1 (GitHub Actions cron) to
-- Tier 2 (Actions matrix), Tier 3 (dedicated worker + Redis), etc.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. worker_runs — one row per worker execution
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  trigger_source text NOT NULL DEFAULT 'cron',  -- 'cron' | 'manual' | 'api'
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','succeeded','failed','partial')),
  -- Batching info (for Tier 2 matrix parallel execution)
  batch_index integer NOT NULL DEFAULT 0,
  batch_count integer NOT NULL DEFAULT 1,
  -- Outcome metrics
  hotels_processed integer NOT NULL DEFAULT 0,
  hotels_succeeded integer NOT NULL DEFAULT 0,
  hotels_failed integer NOT NULL DEFAULT 0,
  rows_ingested integer NOT NULL DEFAULT 0,
  api_failures integer NOT NULL DEFAULT 0,
  -- Computed duration (in seconds)
  duration_seconds numeric GENERATED ALWAYS AS (
    CASE
      WHEN finished_at IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (finished_at - started_at))
    END
  ) STORED,
  -- Free-form notes / error summary (no secrets!)
  summary text
);

CREATE INDEX IF NOT EXISTS idx_worker_runs_recent
  ON public.worker_runs(worker_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_runs_status
  ON public.worker_runs(status, started_at DESC);

COMMENT ON TABLE public.worker_runs IS
  'Operational log of background workers (Lighthouse sync, etc). Used to monitor scaling thresholds.';

-- ----------------------------------------------------------------------------
-- 2. Lighthouse plan tier per hotel
-- ----------------------------------------------------------------------------
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS lighthouse_plan_tier text
    CHECK (lighthouse_plan_tier IS NULL OR lighthouse_plan_tier IN (
      'none',
      'rate_insight_api_only',
      'rate_insight_premium',
      'rate_insight_enterprise'
    ))
    DEFAULT 'none';

COMMENT ON COLUMN public.hotels.lighthouse_plan_tier IS
  'Subscribed Lighthouse plan: none | rate_insight_api_only (25€/mo) | rate_insight_premium (62.40€/mo, 10 competitors + market demand)';

-- ----------------------------------------------------------------------------
-- 3. RLS — worker_runs visible to direction + revenue_manager
-- ----------------------------------------------------------------------------
ALTER TABLE public.worker_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_runs_select ON public.worker_runs;
CREATE POLICY worker_runs_select ON public.worker_runs FOR SELECT
  USING (
    public.get_user_role() IN ('direction','revenue_manager')
  );

-- No INSERT/UPDATE/DELETE from authenticated users — service_role only.
-- (service_role bypasses RLS automatically.)
DROP POLICY IF EXISTS worker_runs_no_write ON public.worker_runs;
CREATE POLICY worker_runs_no_write ON public.worker_runs FOR ALL
  USING (false) WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- 4. Scaling monitoring view — "Are we close to a tier upgrade?"
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.scaling_health AS
SELECT
  worker_name,
  COUNT(*) FILTER (WHERE started_at > now() - interval '7 days') AS runs_last_7d,
  AVG(duration_seconds) FILTER (WHERE started_at > now() - interval '7 days') AS avg_duration_7d,
  MAX(duration_seconds) FILTER (WHERE started_at > now() - interval '7 days') AS max_duration_7d,
  SUM(hotels_processed) FILTER (WHERE started_at > now() - interval '7 days') AS hotels_processed_7d,
  SUM(rows_ingested) FILTER (WHERE started_at > now() - interval '7 days') AS rows_ingested_7d,
  COUNT(*) FILTER (WHERE status = 'failed' AND started_at > now() - interval '7 days') AS failed_runs_7d,
  -- Tier upgrade signals (Tier 1 → Tier 2 when avg > 480s OR hotels > 30)
  CASE
    WHEN AVG(duration_seconds) FILTER (WHERE started_at > now() - interval '7 days') > 480 THEN 'upgrade_recommended'
    WHEN AVG(duration_seconds) FILTER (WHERE started_at > now() - interval '7 days') > 300 THEN 'watch_closely'
    ELSE 'healthy'
  END AS tier_status
FROM public.worker_runs
WHERE finished_at IS NOT NULL
GROUP BY worker_name;
