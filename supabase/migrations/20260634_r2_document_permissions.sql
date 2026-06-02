-- =============================================================================
-- 20260634_r2_document_permissions.sql  (R2 — Permissions documentaires par rôle)
-- =============================================================================
-- ⚠️ ALIGNÉ SUR LES VRAIS RÔLES DE PROD (enum admin_user_role) :
--   reception, gouvernante, femme_de_chambre, maintenance, breakfast, direction.
--   (Différent des rôles frontend AppUserRole owner/admin/accountant/rms/
--   housekeeping — incohérence Flowtym à réconcilier séparément, hors périmètre.)
--   'direction' = management (accès complet) ; 'reception' = front-desk ;
--   gouvernante/femme_de_chambre/maintenance/breakfast = aucun accès (deny défaut).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_role_permissions (
  role         text NOT NULL,
  kind         text NOT NULL,
  can_view     boolean NOT NULL DEFAULT false,
  can_download boolean NOT NULL DEFAULT false,
  can_delete   boolean NOT NULL DEFAULT false,
  can_upload   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, kind)
);
ALTER TABLE public.document_role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_role_permissions_read ON public.document_role_permissions;
CREATE POLICY document_role_permissions_read ON public.document_role_permissions
  FOR SELECT TO authenticated USING (true);

DELETE FROM public.document_role_permissions;
INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload)
SELECT 'direction', k, true, true, true, true
FROM unnest(ARRAY['id_doc','contract','invoice','quote','other']) k;
INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload) VALUES
  ('reception','id_doc',  true, true, false, true),
  ('reception','contract',true, true, false, true),
  ('reception','invoice', true, true, false, false),
  ('reception','quote',   true, true, false, true),
  ('reception','other',   true, true, false, true);

CREATE OR REPLACE FUNCTION public.can_access_document(p_kind text, p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE((
    SELECT CASE p_action
      WHEN 'view' THEN can_view WHEN 'download' THEN can_download
      WHEN 'delete' THEN can_delete WHEN 'upload' THEN can_upload ELSE false END
    FROM public.document_role_permissions
    WHERE role = public.current_user_role() AND kind = COALESCE(NULLIF(p_kind,''),'other')
  ), false)
$$;
REVOKE ALL ON FUNCTION public.can_access_document(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_document(text, text) TO authenticated;

-- RLS communication_attachments : lecture filtrée par rôle
DROP POLICY IF EXISTS communication_attachments_select ON public.communication_attachments;
CREATE POLICY communication_attachments_select ON public.communication_attachments
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.can_access_document(kind, 'view'));

-- register_attachment : garde upload
CREATE OR REPLACE FUNCTION public.register_attachment(
  p_storage_path text, p_filename text, p_mime_type text, p_size_bytes bigint,
  p_kind text DEFAULT 'other', p_message_id uuid DEFAULT NULL, p_communication_log_id uuid DEFAULT NULL,
  p_guest_id uuid DEFAULT NULL, p_reservation_id uuid DEFAULT NULL, p_direction text DEFAULT 'internal')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hotel uuid; v_actor uuid; v_id uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN RAISE EXCEPTION 'storage_path requis'; END IF;
  IF NOT public.can_access_document(p_kind, 'upload') THEN RAISE EXCEPTION 'Permission refusée (upload %)', COALESCE(p_kind,'other'); END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  INSERT INTO public.communication_attachments
    (hotel_id, message_id, communication_log_id, guest_id, reservation_id, storage_path, original_filename, mime_type, size_bytes, kind, direction, uploaded_by)
  VALUES (v_hotel, p_message_id, p_communication_log_id, p_guest_id, p_reservation_id, p_storage_path, p_filename, p_mime_type, COALESCE(p_size_bytes, 0), p_kind, p_direction, v_actor)
  RETURNING id INTO v_id;
  INSERT INTO public.attachment_access_log (hotel_id, attachment_id, guest_id, reservation_id, user_id, action)
  VALUES (v_hotel, v_id, p_guest_id, p_reservation_id, v_actor, 'create');
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.register_attachment(text,text,text,bigint,text,uuid,uuid,uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_attachment(text,text,text,bigint,text,uuid,uuid,uuid,uuid,text) TO authenticated;

-- delete_attachment : garde delete (selon kind)
CREATE OR REPLACE FUNCTION public.delete_attachment(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hotel uuid; v_actor uuid; v_path text; v_guest uuid; v_resa uuid; v_kind text;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  SELECT storage_path, guest_id, reservation_id, kind INTO v_path, v_guest, v_resa, v_kind
    FROM public.communication_attachments WHERE id = p_id AND hotel_id = v_hotel;
  IF v_path IS NULL THEN RETURN NULL; END IF;
  IF NOT public.can_access_document(v_kind, 'delete') THEN RAISE EXCEPTION 'Permission refusée (suppression %)', COALESCE(v_kind,'other'); END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  INSERT INTO public.attachment_access_log (hotel_id, attachment_id, guest_id, reservation_id, user_id, action)
  VALUES (v_hotel, p_id, v_guest, v_resa, v_actor, 'delete');
  DELETE FROM public.communication_attachments WHERE id = p_id AND hotel_id = v_hotel;
  RETURN v_path;
END; $$;
REVOKE ALL ON FUNCTION public.delete_attachment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_attachment(uuid) TO authenticated;

-- request_attachment_download : garde view/download (selon kind)
CREATE OR REPLACE FUNCTION public.request_attachment_download(p_attachment_id uuid, p_action text DEFAULT 'download')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hotel uuid; v_actor uuid; v_path text; v_guest uuid; v_resa uuid; v_kind text;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  IF p_action NOT IN ('view','download') THEN RAISE EXCEPTION 'Action invalide: %', p_action; END IF;
  SELECT storage_path, guest_id, reservation_id, kind INTO v_path, v_guest, v_resa, v_kind
    FROM public.communication_attachments WHERE id = p_attachment_id AND hotel_id = v_hotel;
  IF v_path IS NULL THEN RAISE EXCEPTION 'Document introuvable ou accès refusé'; END IF;
  IF NOT public.can_access_document(v_kind, p_action) THEN RAISE EXCEPTION 'Permission refusée (% %)', p_action, COALESCE(v_kind,'other'); END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  INSERT INTO public.attachment_access_log (hotel_id, attachment_id, guest_id, reservation_id, user_id, action)
  VALUES (v_hotel, p_attachment_id, v_guest, v_resa, v_actor, p_action);
  RETURN v_path;
END; $$;
REVOKE ALL ON FUNCTION public.request_attachment_download(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_attachment_download(uuid, text) TO authenticated;

-- communication_timeline_v2 : filtrage des pièces jointes par rôle.
-- DELTA vs 20260632 (3 ajouts) :
--   * branche messages    : sous-requête attachments → "... AND public.can_access_document(a.kind,'view')"
--   * branche logs        : idem sur communication_log_id
--   * branche attachments : "... AND public.can_access_document(at.kind,'view')"
-- (État final complet déployé en prod via r2_timeline_attachment_role_filter.)

-- =============================================================================
-- FIN 20260634_r2_document_permissions.sql
-- =============================================================================
