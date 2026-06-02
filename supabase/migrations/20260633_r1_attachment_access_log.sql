-- =============================================================================
-- 20260633_r1_attachment_access_log.sql  (R1 — Audit d'accès documentaire)
-- =============================================================================
-- Journal IMMUABLE des accès aux documents (create/view/download/delete) pour
-- l'accountability RGPD + fermeture de la signature directe (téléchargement
-- routé par la porte auditée = edge function `attachment-access`).
--
-- NOTE : le journal n'a PAS de FK vers attachment/guest/reservation/user (uuid
-- nus, comme audit_logs.entity_id) — sinon un ON DELETE SET NULL/CASCADE
-- déclencherait un UPDATE/DELETE bloqué par le trigger d'immuabilité. Le log
-- survit volontairement aux suppressions (preuve d'accès post-effacement).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.current_user_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

CREATE TABLE IF NOT EXISTS public.attachment_access_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  attachment_id  uuid,   -- uuid nu (pas de FK — immuabilité)
  guest_id       uuid,
  reservation_id uuid,
  user_id        uuid,
  action         text NOT NULL CHECK (action IN ('create','view','download','delete')),
  ip_address     inet,
  user_agent     text,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attach_access_hotel_idx ON public.attachment_access_log (hotel_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS attach_access_doc_idx   ON public.attachment_access_log (attachment_id);
CREATE INDEX IF NOT EXISTS attach_access_guest_idx ON public.attachment_access_log (guest_id);
CREATE INDEX IF NOT EXISTS attach_access_user_idx  ON public.attachment_access_log (user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.attachment_access_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'attachment_access_log est immuable'; END; $$;
DROP TRIGGER IF EXISTS trg_attach_access_no_update ON public.attachment_access_log;
CREATE TRIGGER trg_attach_access_no_update BEFORE UPDATE ON public.attachment_access_log
  FOR EACH ROW EXECUTE FUNCTION public.attachment_access_log_immutable();
DROP TRIGGER IF EXISTS trg_attach_access_no_delete ON public.attachment_access_log;
CREATE TRIGGER trg_attach_access_no_delete BEFORE DELETE ON public.attachment_access_log
  FOR EACH ROW EXECUTE FUNCTION public.attachment_access_log_immutable();

ALTER TABLE public.attachment_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attach_access_select ON public.attachment_access_log;
CREATE POLICY attach_access_select ON public.attachment_access_log
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
         AND public.current_user_role() IN ('owner','direction','admin'));

-- register_attachment : + journalisation 'create'
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

-- delete_attachment : + journalisation 'delete'
CREATE OR REPLACE FUNCTION public.delete_attachment(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hotel uuid; v_actor uuid; v_path text; v_guest uuid; v_resa uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  SELECT storage_path, guest_id, reservation_id INTO v_path, v_guest, v_resa
    FROM public.communication_attachments WHERE id = p_id AND hotel_id = v_hotel;
  IF v_path IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.attachment_access_log (hotel_id, attachment_id, guest_id, reservation_id, user_id, action)
  VALUES (v_hotel, p_id, v_guest, v_resa, v_actor, 'delete');
  DELETE FROM public.communication_attachments WHERE id = p_id AND hotel_id = v_hotel;
  RETURN v_path;
END; $$;
REVOKE ALL ON FUNCTION public.delete_attachment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_attachment(uuid) TO authenticated;

-- request_attachment_download : autorise + journalise (view/download), renvoie le chemin
CREATE OR REPLACE FUNCTION public.request_attachment_download(p_attachment_id uuid, p_action text DEFAULT 'download')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hotel uuid; v_actor uuid; v_path text; v_guest uuid; v_resa uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  IF p_action NOT IN ('view','download') THEN RAISE EXCEPTION 'Action invalide: %', p_action; END IF;
  SELECT storage_path, guest_id, reservation_id INTO v_path, v_guest, v_resa
    FROM public.communication_attachments WHERE id = p_attachment_id AND hotel_id = v_hotel;
  IF v_path IS NULL THEN RAISE EXCEPTION 'Document introuvable ou accès refusé'; END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  INSERT INTO public.attachment_access_log (hotel_id, attachment_id, guest_id, reservation_id, user_id, action)
  VALUES (v_hotel, p_attachment_id, v_guest, v_resa, v_actor, p_action);
  RETURN v_path;
END; $$;
REVOKE ALL ON FUNCTION public.request_attachment_download(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_attachment_download(uuid, text) TO authenticated;

-- Fermeture de la signature directe : seul service_role (edge function attachment-access) signe
DROP POLICY IF EXISTS comm_attach_read ON storage.objects;

-- =============================================================================
-- FIN 20260633_r1_attachment_access_log.sql
-- =============================================================================
