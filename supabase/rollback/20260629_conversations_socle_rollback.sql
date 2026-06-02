-- =============================================================================
-- ROLLBACK de 20260629_conversations_socle.sql  (Lot L2)
-- =============================================================================
-- ⚠️  Ce fichier N'EST PAS une migration : il vit hors de supabase/migrations/
--     pour ne JAMAIS être exécuté automatiquement par `supabase db push`.
--     À lancer manuellement uniquement pour revenir à l'état pré-L2.
--
-- SÛRETÉ : les objets L2 ne sont référencés par AUCUNE table legacy
--   (la FK communication_log_id pointe DEPUIS conversations VERS
--   communication_logs, jamais l'inverse). Leur suppression n'affecte donc
--   ni communication_logs, ni communication_templates, ni les settings.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_conversations_bump_thread ON public.conversation_messages;
DROP FUNCTION IF EXISTS public.conversations_bump_thread();
DROP FUNCTION IF EXISTS public.conversation_get_or_create_thread(public.conv_channel, text, uuid, uuid, text);

DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversation_messages CASCADE;
DROP TABLE IF EXISTS public.conversation_threads CASCADE;

DROP TYPE IF EXISTS public.conv_message_status;
DROP TYPE IF EXISTS public.conv_direction;
DROP TYPE IF EXISTS public.conv_channel;

-- =============================================================================
-- FIN rollback L2
-- =============================================================================
