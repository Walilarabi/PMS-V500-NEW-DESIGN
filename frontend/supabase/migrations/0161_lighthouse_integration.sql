-- ============================================================================
-- FLOWTYM RMS — Migration 0161 : Lighthouse Integration (MVP Phase 1)
-- ----------------------------------------------------------------------------
-- Adds the infrastructure for competitor rate intelligence via Lighthouse API:
--   * Adds 4 columns to hotels (token, subscription_id, last_sync_at, enabled)
--   * Creates competitor_rates table for ingested data
--   * Creates competitor_sync_failures for forensic logging
--   * RLS so each hotel only sees its own competitor data
--
-- Lighthouse API quota: ~1098 €/month for 20 hotels under negotiated plan.
--   - 10 competitors per hotel
--   - Daily refresh on 60 next days
--   - Monthly refresh up to 365 days
--   - 4 OTAs MVP: bookingdotcom, expedia, airbnb, branddotcom
--
-- Token is stored as TEXT but should be encrypted at application level.
-- (pgsodium / Vault would be the next iteration; not in scope for MVP.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend public.hotels with Lighthouse columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS lighthouse_api_token text,
  ADD COLUMN IF NOT EXISTS lighthouse_subscription_id text,
  ADD COLUMN IF NOT EXISTS lighthouse_competitor_set_id integer,
  ADD COLUMN IF NOT EXISTS lighthouse_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS lighthouse_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lighthouse_otas jsonb NOT NULL DEFAULT
    '["bookingdotcom","expedia","airbnb","branddotcom"]'::jsonb;

COMMENT ON COLUMN public.hotels.lighthouse_api_token IS
  'Lighthouse v3 API token (X-Oi-Authorization header). MUST be encrypted at app level.';
COMMENT ON COLUMN public.hotels.lighthouse_subscription_id IS
  'Lighthouse subscriptionId used in /v3/rates queries.';
COMMENT ON COLUMN public.hotels.lighthouse_competitor_set_id IS
  'Optional Lighthouse compset id; NULL = use default.';
COMMENT ON COLUMN public.hotels.lighthouse_last_sync_at IS
  'Timestamp of the last successful Lighthouse sync.';
COMMENT ON COLUMN public.hotels.lighthouse_enabled IS
  'Hotel is included in Lighthouse contract. Set per-hotel admin-side.';
COMMENT ON COLUMN public.hotels.lighthouse_otas IS
  'Array of OTAs to fetch for this hotel.';

-- ----------------------------------------------------------------------------
-- 2. competitor_rates — ingested Lighthouse data (1 row per shopping)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  -- Lighthouse-side identifiers
  competitor_id bigint NOT NULL,                   -- Lighthouse's hotel id
  competitor_name text NOT NULL,
  ota text NOT NULL,                               -- 'bookingdotcom', 'expedia', ...
  -- Stay characteristics
  stay_date date NOT NULL,                         -- arrival date
  los integer NOT NULL DEFAULT 1,                  -- length of stay shopped
  -- Price data (NULL price = sold out / unavailable)
  price numeric,
  currency text NOT NULL DEFAULT 'EUR',
  available boolean NOT NULL DEFAULT true,
  -- Optional Lighthouse metadata
  meal_type text,                                  -- 'breakfast_included' | 'room_only' | ...
  room_type_label text,
  is_refundable boolean,
  -- Ranking position if Lighthouse returns it
  position integer,
  -- Tracking freshness
  shopped_at timestamptz NOT NULL,                 -- when Lighthouse scraped
  fetched_at timestamptz NOT NULL DEFAULT now(),   -- when we ingested
  -- Forensic safety: keep raw JSON in case Lighthouse changes their schema
  raw_payload jsonb,
  UNIQUE (hotel_id, competitor_id, ota, stay_date, los, shopped_at)
);

CREATE INDEX IF NOT EXISTS idx_competitor_rates_lookup
  ON public.competitor_rates(hotel_id, stay_date)
  INCLUDE (price, ota, available);

CREATE INDEX IF NOT EXISTS idx_competitor_rates_ota
  ON public.competitor_rates(hotel_id, ota, stay_date);

CREATE INDEX IF NOT EXISTS idx_competitor_rates_recent
  ON public.competitor_rates(hotel_id, shopped_at DESC);

-- ----------------------------------------------------------------------------
-- 3. competitor_sync_failures — forensic log for failed syncs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitor_sync_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  ota text,
  status_code integer,
  error_message text,
  request_url text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_failures_recent
  ON public.competitor_sync_failures(hotel_id, occurred_at DESC);

-- ----------------------------------------------------------------------------
-- 4. View: latest competitor rate per (hotel, stay_date, competitor, ota)
-- ----------------------------------------------------------------------------
-- This is the view the frontend hits for "what's the current competitor median?"
-- It deduplicates multiple shoppings per day to keep only the most recent.
CREATE OR REPLACE VIEW public.competitor_rates_latest AS
SELECT DISTINCT ON (hotel_id, competitor_id, ota, stay_date, los)
  hotel_id,
  competitor_id,
  competitor_name,
  ota,
  stay_date,
  los,
  price,
  currency,
  available,
  meal_type,
  room_type_label,
  is_refundable,
  position,
  shopped_at,
  fetched_at
FROM public.competitor_rates
ORDER BY hotel_id, competitor_id, ota, stay_date, los, shopped_at DESC;

-- ----------------------------------------------------------------------------
-- 5. RLS POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.competitor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_sync_failures ENABLE ROW LEVEL SECURITY;

-- SELECT for any user of the hotel
DROP POLICY IF EXISTS competitor_rates_select ON public.competitor_rates;
CREATE POLICY competitor_rates_select ON public.competitor_rates FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

-- No INSERT/UPDATE from authenticated users — only service_role (worker)
DROP POLICY IF EXISTS competitor_rates_no_write ON public.competitor_rates;
CREATE POLICY competitor_rates_no_write ON public.competitor_rates FOR ALL
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS sync_failures_select ON public.competitor_sync_failures;
CREATE POLICY sync_failures_select ON public.competitor_sync_failures FOR SELECT
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction','revenue_manager')
  );

DROP POLICY IF EXISTS sync_failures_no_write ON public.competitor_sync_failures;
CREATE POLICY sync_failures_no_write ON public.competitor_sync_failures FOR ALL
  USING (false) WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- 6. Helper RPC: stats on competitor data freshness
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.competitor_freshness(p_hotel_id uuid)
RETURNS TABLE (
  ota text,
  last_shopped_at timestamptz,
  rows_count bigint,
  hours_since_last_shop numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    ota,
    MAX(shopped_at) AS last_shopped_at,
    COUNT(*) AS rows_count,
    EXTRACT(EPOCH FROM (now() - MAX(shopped_at))) / 3600 AS hours_since_last_shop
  FROM public.competitor_rates
  WHERE hotel_id = p_hotel_id
    AND shopped_at > now() - interval '7 days'
  GROUP BY ota
  ORDER BY ota;
$$;

REVOKE ALL ON FUNCTION public.competitor_freshness(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.competitor_freshness(uuid) TO authenticated';
  END IF;
END $$;
