-- ============================================================================
-- AUDIT FLOWTYM — Correctif #4
-- Problème : l'edge function `invite-user` appelle l'RPC `gen_audit_log_invite`
--            qui N'EXISTE PAS. Le chemin d'audit principal échoue donc toujours
--            et retombe (try/catch) sur un INSERT direct dans
--            hr_document_audit_logs. Non-fatal mais sale.
-- Correctif : créer la fonction attendue, alignée sur le fallback existant.
-- Statut : PRÊT À APPLIQUER (optionnel — l'invitation fonctionne sans, via fallback).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gen_audit_log_invite(
  p_hotel_id    uuid,
  p_actor_id    uuid,
  p_actor_email text,
  p_entity_id   uuid,
  p_details     text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO public.hr_document_audit_logs
    (id, hotel_id, actor_user_id, actor_email, action, entity_type, entity_id, details)
  VALUES
    (gen_random_uuid(), p_hotel_id, p_actor_id, p_actor_email,
     'invite_user', 'user', p_entity_id,
     COALESCE(p_details, '{}')::jsonb);
END;
$function$;
