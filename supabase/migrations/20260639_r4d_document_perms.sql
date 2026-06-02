-- =============================================================================
-- 20260639_r4d_document_perms.sql  (R4 — Permissions documentaires)
-- =============================================================================
-- admin_hotel : tout SAUF id_doc (aucune ligne id_doc = deny par défaut).
-- comptabilite : contract/invoice/quote/other en view+download uniquement.
-- revenue_manager : contract/invoice/quote en view+download uniquement.
-- =============================================================================

INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload)
SELECT 'admin_hotel', k, true, true, true, true
FROM unnest(ARRAY['contract','invoice','quote','other']) k
ON CONFLICT (role, kind) DO UPDATE
  SET can_view=true, can_download=true, can_delete=true, can_upload=true;

INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload) VALUES
  ('comptabilite','contract', true, true, false, false),
  ('comptabilite','invoice',  true, true, false, false),
  ('comptabilite','quote',    true, true, false, false),
  ('comptabilite','other',    true, true, false, false)
ON CONFLICT (role, kind) DO UPDATE
  SET can_view=EXCLUDED.can_view, can_download=EXCLUDED.can_download,
      can_delete=EXCLUDED.can_delete, can_upload=EXCLUDED.can_upload;

INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload) VALUES
  ('revenue_manager','contract', true, true, false, false),
  ('revenue_manager','invoice',  true, true, false, false),
  ('revenue_manager','quote',    true, true, false, false)
ON CONFLICT (role, kind) DO UPDATE
  SET can_view=EXCLUDED.can_view, can_download=EXCLUDED.can_download,
      can_delete=EXCLUDED.can_delete, can_upload=EXCLUDED.can_upload;

-- =============================================================================
-- FIN 20260639_r4d_document_perms.sql
-- =============================================================================
