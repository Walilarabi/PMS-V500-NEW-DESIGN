-- ============================================================================
-- SECURITY FIX M5: Billing tables RLS policies
-- ============================================================================
--
-- VULNERABILITY: The four billing tables (invoices, folios, invoice_lines,
-- payments) all carry a hotel_id column, but no migration ever enabled RLS
-- or created tenant-isolation policies on them.  A client holding a valid
-- JWT could read or write financial records belonging to any other hotel.
--
-- FIX: Enable RLS + FORCE RLS on each table and add minimal policies:
--   SELECT  → hotel_id = get_user_hotel_id()
--   INSERT  → WITH CHECK (hotel_id = get_user_hotel_id())
--   UPDATE  → only service-role / platform admin (accounting immutability)
--   DELETE  → blocked at client level (reversals, not deletes)
-- ============================================================================

-- ─── invoices ────────────────────────────────────────────────────────────────

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select"        ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert"        ON public.invoices;
DROP POLICY IF EXISTS "invoices_no_update"     ON public.invoices;
DROP POLICY IF EXISTS "invoices_no_delete"     ON public.invoices;

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Updates are controlled by the next_invoice_number() / PG triggers;
-- block direct client updates to prevent tampering with totals or status.
CREATE POLICY "invoices_no_client_update" ON public.invoices
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "invoices_no_client_delete" ON public.invoices
  FOR DELETE TO authenticated
  USING (false);

-- ─── folios ──────────────────────────────────────────────────────────────────

ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "folios_select"          ON public.folios;
DROP POLICY IF EXISTS "folios_insert"          ON public.folios;
DROP POLICY IF EXISTS "folios_no_update"       ON public.folios;
DROP POLICY IF EXISTS "folios_no_delete"       ON public.folios;

CREATE POLICY "folios_select" ON public.folios
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY "folios_insert" ON public.folios
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY "folios_no_client_update" ON public.folios
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "folios_no_client_delete" ON public.folios
  FOR DELETE TO authenticated
  USING (false);

-- ─── invoice_lines ───────────────────────────────────────────────────────────

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_lines_select"   ON public.invoice_lines;
DROP POLICY IF EXISTS "invoice_lines_insert"   ON public.invoice_lines;
DROP POLICY IF EXISTS "invoice_lines_no_update" ON public.invoice_lines;
DROP POLICY IF EXISTS "invoice_lines_no_delete" ON public.invoice_lines;

CREATE POLICY "invoice_lines_select" ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY "invoice_lines_insert" ON public.invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Lines are append-only; corrections use reversals (source='reversal'),
-- not updates or deletes.
CREATE POLICY "invoice_lines_no_client_update" ON public.invoice_lines
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "invoice_lines_no_client_delete" ON public.invoice_lines
  FOR DELETE TO authenticated
  USING (false);

-- ─── payments ────────────────────────────────────────────────────────────────

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select"        ON public.payments;
DROP POLICY IF EXISTS "payments_insert"        ON public.payments;
DROP POLICY IF EXISTS "payments_no_update"     ON public.payments;
DROP POLICY IF EXISTS "payments_no_delete"     ON public.payments;

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Payments are corrected via reversal rows (reversal_of FK), not updates.
CREATE POLICY "payments_no_client_update" ON public.payments
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "payments_no_client_delete" ON public.payments
  FOR DELETE TO authenticated
  USING (false);
