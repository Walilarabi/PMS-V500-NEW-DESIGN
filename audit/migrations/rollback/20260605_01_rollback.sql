-- ROLLBACK MIGRATION 01 — restaure l'état AVANT (capturé 2026-06-05)
-- État initial : audit_log_insert INSERT, roles={public}, WITH CHECK (true)
DROP POLICY IF EXISTS audit_log_insert ON public.portal_audit_log;
CREATE POLICY audit_log_insert ON public.portal_audit_log
  FOR INSERT TO public
  WITH CHECK (true);
