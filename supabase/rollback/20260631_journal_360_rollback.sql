-- =============================================================================
-- ROLLBACK de 20260631_journal_360.sql  (Lot L3.1)
-- =============================================================================
-- ⚠️  PAS une migration : hors de supabase/migrations/. Manuel uniquement.
-- SÛRETÉ : ne touche AUCUNE table existante (audit_logs, payments, invoices,
--   invoice_lines, communication_*). Le bucket Storage peut être conservé vide.
-- =============================================================================

DROP FUNCTION IF EXISTS public.communication_timeline_v2(uuid,uuid,text[],text[],uuid,timestamptz,timestamptz,text,integer,timestamptz);
DROP FUNCTION IF EXISTS public.register_attachment(text,text,text,bigint,text,uuid,uuid,uuid,uuid,text);
DROP FUNCTION IF EXISTS public.delete_attachment(uuid);

DROP POLICY IF EXISTS comm_attach_read   ON storage.objects;
DROP POLICY IF EXISTS comm_attach_insert ON storage.objects;
DROP POLICY IF EXISTS comm_attach_delete ON storage.objects;

DROP TABLE IF EXISTS public.communication_attachments CASCADE;

-- Bucket conservé par sûreté (suppression manuelle si souhaitée) :
-- DELETE FROM storage.buckets WHERE id = 'communication-attachments';

-- =============================================================================
-- FIN rollback L3.1
-- =============================================================================
