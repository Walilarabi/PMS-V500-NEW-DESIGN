-- ============================================================================
-- FLOWTYM PMS — Migration 0090 : Idempotent CSV imports for bank_statements
-- ----------------------------------------------------------------------------
-- Adds a partial unique index on (hotel_id, source, external_reference) so that
-- re-importing the same Booking/Expedia/etc. CSV doesn't duplicate rows.
-- ============================================================================

create unique index if not exists ux_bank_statements_idempotent
  on public.bank_statements (hotel_id, source, external_reference)
  where external_reference is not null;
