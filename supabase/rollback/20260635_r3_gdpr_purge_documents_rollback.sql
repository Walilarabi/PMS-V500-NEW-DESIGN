-- ROLLBACK R3 (hors migrations/). crm_gdpr_erase_guest non re-cassé volontairement
-- (le correctif tags reste). Suppression de la purge documentaire :
DROP FUNCTION IF EXISTS public.crm_gdpr_purge_guest_documents(uuid);
-- Edge function : supprimer `gdpr-erase-guest` côté plateforme.
