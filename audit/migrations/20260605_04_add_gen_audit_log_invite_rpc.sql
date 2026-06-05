-- ============================================================================
-- AUDIT FLOWTYM — #4 (CORRIGÉ & VALIDÉ) — Traçage officiel des invitations
-- ----------------------------------------------------------------------------
-- Objectif : chaque invitation utilisateur (edge function `invite-user`) est
--   tracée dans le JOURNAL D'AUDIT OFFICIEL `public.audit_logs` (hash-chaîné,
--   immuable), via la RPC `gen_audit_log_invite` déjà appelée par l'edge function.
--
-- Garanties :
--   • Ne contourne pas l'audit : écrit dans le journal officiel audit_logs,
--     le trigger BEFORE INSERT `audit_chain_link()` calcule seq/prev_hash/entry_hash.
--   • Ne désactive AUCUNE contrainte : audit_logs.action est en texte libre
--     (aucun CHECK) ; on ajoute simplement la valeur d'action 'user_invited'.
--   • Pas de doublon : `invite-user` appelle cette RPC EN PREMIER ; le fallback
--     vers hr_document_audit_logs ne s'exécute QUE si la RPC échoue. La RPC
--     réussissant désormais, il n'y a qu'une seule entrée d'audit.
--
-- Convention : entity='user', action='user_invited', entity_id = id du user invité,
--   actor_user_id/actor_label = invitant, payload = { email, role, access_type, ... }.
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
  INSERT INTO public.audit_logs
    (hotel_id, actor_user_id, actor_label, entity, entity_id, action, payload)
  VALUES (
    p_hotel_id,
    p_actor_id,
    p_actor_email,
    'user',
    COALESCE(p_entity_id, p_actor_id),       -- entity_id NOT NULL : id du user invité
    'user_invited',
    COALESCE(NULLIF(p_details, ''), '{}')::jsonb
  );
  -- seq / prev_hash / entry_hash sont calculés par le trigger audit_chain_link().
END;
$function$;
