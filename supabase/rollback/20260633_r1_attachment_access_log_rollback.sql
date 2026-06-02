-- ROLLBACK R1 (hors migrations/). Restaure la signature directe + retire l'audit.
DROP FUNCTION IF EXISTS public.request_attachment_download(uuid, text);
-- Restaurer la policy de signature directe (état pré-R1)
DROP POLICY IF EXISTS comm_attach_read ON storage.objects;
CREATE POLICY comm_attach_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'communication-attachments' AND (storage.foldername(name))[1] = public.get_user_hotel_id()::text);
-- Revenir aux versions register/delete sans journalisation : ré-appliquer la
-- définition de 20260633 sans les INSERT attachment_access_log (voir historique).
DROP TABLE IF EXISTS public.attachment_access_log CASCADE;
-- current_user_role() est conservée (réutilisée par R2). Supprimer si R2 absent :
-- DROP FUNCTION IF EXISTS public.current_user_role();
-- Edge function : supprimer `attachment-access` côté plateforme.
