-- ============================================================================
-- FLOWTYM RMS — Migration 0163 : Lighthouse Excel Import
-- ----------------------------------------------------------------------------
-- Adds the ability to ingest competitor rates from a Lighthouse Excel export
-- (Rate Insight "Tarifs" sheet). Complements the live API sync (worker
-- lighthouse_sync.py): same destination table (competitor_rates), different
-- ingestion path.
--
-- Use case: hotel onboarding before API tokens are issued, or as a fallback
-- when the API is temporarily unavailable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. lighthouse_imports — one row per uploaded Excel file
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lighthouse_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  -- Original upload metadata
  filename text NOT NULL,
  file_size_bytes bigint,
  storage_path text,                              -- where it lives in Supabase Storage
  -- Parsed metadata (from filename + sheet content)
  ota text,                                       -- 'bookingdotcom', 'expedia', ...
  rate_type text,                                 -- 'lowest', 'highest', 'average'
  los integer,                                    -- length of stay shopped
  guests integer,                                 -- number of guests
  client_hotel_name text,                         -- first hotel column (used for verification)
  competitor_count integer,
  -- Lifecycle
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  rows_ingested integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  error_message text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Audit
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  duration_seconds numeric GENERATED ALWAYS AS (
    CASE
      WHEN processed_at IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (processed_at - uploaded_at))
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_lighthouse_imports_hotel
  ON public.lighthouse_imports(hotel_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_lighthouse_imports_status
  ON public.lighthouse_imports(status, uploaded_at DESC);

COMMENT ON TABLE public.lighthouse_imports IS
  'Journal of Excel-based Lighthouse imports. One row per uploaded file.';

-- ----------------------------------------------------------------------------
-- 2. Extend competitor_rates to allow Excel-sourced rows
-- ----------------------------------------------------------------------------
-- We accept the existing UNIQUE constraint as-is, but add an `import_id`
-- column to trace each row back to its import session.
ALTER TABLE public.competitor_rates
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES public.lighthouse_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'api_sync',
  ADD COLUMN IF NOT EXISTS status_text text;

-- Backfill source for existing rows (assume they came from API)
UPDATE public.competitor_rates SET source = 'api_sync' WHERE source IS NULL;

-- Constrain source values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.competitor_rates'::regclass
      AND conname = 'competitor_rates_source_check'
  ) THEN
    ALTER TABLE public.competitor_rates
      ADD CONSTRAINT competitor_rates_source_check
      CHECK (source IN ('api_sync', 'excel_import'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_competitor_rates_import
  ON public.competitor_rates(import_id)
  WHERE import_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. RLS — imports visible to direction only
-- ----------------------------------------------------------------------------
ALTER TABLE public.lighthouse_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lighthouse_imports_select ON public.lighthouse_imports;
CREATE POLICY lighthouse_imports_select ON public.lighthouse_imports FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

-- Authenticated users with 'direction' role can INSERT (trigger an import).
-- The actual file processing is server-side (Edge Function or backend),
-- so the INSERT is just to register the upload intent.
DROP POLICY IF EXISTS lighthouse_imports_insert ON public.lighthouse_imports;
CREATE POLICY lighthouse_imports_insert ON public.lighthouse_imports FOR INSERT
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() = 'direction'
  );

-- Updates and deletes only via service_role (worker).
DROP POLICY IF EXISTS lighthouse_imports_no_modify ON public.lighthouse_imports;
CREATE POLICY lighthouse_imports_no_modify ON public.lighthouse_imports FOR UPDATE
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS lighthouse_imports_no_delete ON public.lighthouse_imports;
CREATE POLICY lighthouse_imports_no_delete ON public.lighthouse_imports FOR DELETE
  USING (false);
