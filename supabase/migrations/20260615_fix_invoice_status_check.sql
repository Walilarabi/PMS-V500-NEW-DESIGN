-- Fix: add 'issued' and 'voided' to invoices.status check constraint
-- Sprint 1 smoke test T2/T3: frontend uses these values but DB constraint rejected them.

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY(ARRAY[
    'draft','issued','sent','paid','voided','cancelled','overdue'
  ]));
