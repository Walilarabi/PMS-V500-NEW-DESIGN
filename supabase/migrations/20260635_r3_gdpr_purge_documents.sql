-- =============================================================================
-- 20260635_r3_gdpr_purge_documents.sql  (R3 — Droit à l'oubli, extension docs)
-- =============================================================================
-- 1. Correctif du bug pré-existant de crm_gdpr_erase_guest : guests.tags est
--    text[] (et non jsonb) → l'erase RGPD plantait (42804). Aligné prod.
-- 2. crm_gdpr_purge_guest_documents : supprime les métadonnées documentaires,
--    purge le contenu personnel résiduel (notes/messages/logs/incidents),
--    journalise la suppression (trace immuable), renvoie les chemins Storage
--    (supprimés par l'edge function gdpr-erase-guest). Réservée à la direction.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.crm_gdpr_erase_guest(p_guest_id uuid, p_reason text DEFAULT 'GDPR erasure request'::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_hotel_id UUID; v_anon_id TEXT;
BEGIN
  v_hotel_id := get_user_hotel_id();
  v_anon_id  := 'ANON-' || substr(p_guest_id::text, 1, 8);
  UPDATE guests SET
    first_name='Anonymisé', last_name=v_anon_id, email=v_anon_id||'@erased.local',
    phone=NULL, date_of_birth=NULL, passport=NULL, address=NULL, city=NULL, zip=NULL,
    country=NULL, nationality=NULL, whatsapp=NULL, social_links=NULL, photo_url=NULL,
    profession=NULL, employer=NULL, job_title=NULL, visa=NULL, doc_expiry_date=NULL,
    notes='Données effacées — '||p_reason, tags='{}'::text[],
    gdpr_consent=FALSE, gdpr_date=NOW(), updated_at=NOW()
  WHERE id=p_guest_id AND hotel_id=v_hotel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guest not found or access denied'; END IF;
  INSERT INTO gdpr_consent_log (hotel_id, guest_id, consent, channel, notes)
  VALUES (v_hotel_id, p_guest_id, FALSE, 'erasure', p_reason);
END; $function$;

CREATE OR REPLACE FUNCTION public.crm_gdpr_purge_guest_documents(p_guest_id uuid)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hotel uuid; v_actor uuid; v_guest_hotel uuid; v_paths text[];
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  IF public.current_user_role() NOT IN ('direction') THEN
    RAISE EXCEPTION 'Effacement RGPD réservé à la direction'; END IF;
  SELECT hotel_id INTO v_guest_hotel FROM public.guests WHERE id = p_guest_id;
  IF v_guest_hotel IS NULL OR v_guest_hotel <> v_hotel THEN RAISE EXCEPTION 'Client introuvable ou hors hôtel'; END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  SELECT COALESCE(array_agg(storage_path), '{}') INTO v_paths
    FROM public.communication_attachments WHERE guest_id = p_guest_id AND hotel_id = v_hotel;
  INSERT INTO public.attachment_access_log (hotel_id, attachment_id, guest_id, reservation_id, user_id, action)
  SELECT v_hotel, id, guest_id, reservation_id, v_actor, 'delete'
    FROM public.communication_attachments WHERE guest_id = p_guest_id AND hotel_id = v_hotel;
  DELETE FROM public.communication_attachments WHERE guest_id = p_guest_id AND hotel_id = v_hotel;
  UPDATE public.communication_internal_notes SET body = '[Données effacées — RGPD]' WHERE guest_id = p_guest_id AND hotel_id = v_hotel;
  UPDATE public.conversation_messages SET body=NULL, subject=NULL, to_address=NULL, from_address=NULL WHERE guest_id = p_guest_id AND hotel_id = v_hotel;
  UPDATE public.communication_logs SET body=NULL, subject=NULL, to_address=NULL, from_address=NULL WHERE guest_id = p_guest_id AND hotel_id = v_hotel;
  UPDATE public.guest_incidents SET description = '[Données effacées — RGPD]' WHERE guest_id = p_guest_id AND hotel_id = v_hotel;
  RETURN v_paths;
END; $$;
REVOKE ALL ON FUNCTION public.crm_gdpr_purge_guest_documents(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_gdpr_purge_guest_documents(uuid) TO authenticated;

-- L'orchestration (purge → storage.remove → erase) est dans l'edge function
-- gdpr-erase-guest (déployée). À brancher sur crm_resolve_gdpr_request (flux existant).
-- =============================================================================
