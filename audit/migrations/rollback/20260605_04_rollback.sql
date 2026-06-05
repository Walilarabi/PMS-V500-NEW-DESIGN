-- ROLLBACK MIGRATION 04 — la fonction n'existait pas avant
DROP FUNCTION IF EXISTS public.gen_audit_log_invite(uuid, uuid, text, uuid, text);
