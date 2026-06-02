-- ROLLBACK R2 (hors migrations/). Revient à un accès documentaire hôtel-seul.
DROP POLICY IF EXISTS communication_attachments_select ON public.communication_attachments;
CREATE POLICY communication_attachments_select ON public.communication_attachments
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());
-- Retirer les gardes de rôle : ré-appliquer register/delete/request_attachment_download
-- de 20260633 (sans les checks can_access_document) + v2 de 20260632 (sans filtre PJ).
DROP FUNCTION IF EXISTS public.can_access_document(text, text);
DROP TABLE IF EXISTS public.document_role_permissions;
