-- =============================================================================
-- ROLLBACK de 20260630_communication_timeline.sql  (Lot L3)
-- =============================================================================
-- ⚠️  PAS une migration : vit hors de supabase/migrations/ pour ne JAMAIS
--     s'exécuter automatiquement. À lancer manuellement uniquement.
--
-- SÛRETÉ :
--   * On NE DROP PAS public.guest_incidents : la table a été créée en
--     CREATE IF NOT EXISTS et peut PRÉEXISTER (données CRM réelles). La
--     supprimer serait destructif. On la laisse intacte.
--   * communication_logs / conversations / settings : non touchés.
-- =============================================================================

DROP FUNCTION IF EXISTS public.communication_timeline(uuid, uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public.add_internal_note(uuid, uuid, text);
DROP TABLE IF EXISTS public.communication_internal_notes CASCADE;

-- =============================================================================
-- FIN rollback L3
-- =============================================================================
