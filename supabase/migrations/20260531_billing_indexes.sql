-- ============================================================================
-- PERF T2: Indexes on billing tables (invoices, folios, invoice_lines, payments)
-- ============================================================================
--
-- The four billing tables were created with RLS in 20260530_billing_rls.sql
-- but without any indexes.  Every RLS policy evaluates
--   hotel_id = get_user_hotel_id()
-- and most list queries order by created_at DESC — both require seq scans
-- without indexes.
-- ============================================================================

-- ─── invoices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_hotel_created
  ON public.invoices (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON public.invoices (hotel_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_reservation
  ON public.invoices (reservation_id)
  WHERE reservation_id IS NOT NULL;

-- ─── folios ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_folios_hotel_created
  ON public.folios (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_folios_invoice
  ON public.folios (invoice_id);

-- ─── invoice_lines ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoice_lines_hotel_created
  ON public.invoice_lines (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
  ON public.invoice_lines (invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_folio
  ON public.invoice_lines (folio_id);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_service_date
  ON public.invoice_lines (hotel_id, service_date DESC);

-- ─── payments ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payments_hotel_created
  ON public.payments (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON public.payments (invoice_id);
