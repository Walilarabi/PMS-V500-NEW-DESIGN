-- ============================================================================
-- AUDIT FLOWTYM — Correctif RLS #1
-- Table : public.portal_audit_log
-- Problème : la policy INSERT `audit_log_insert` a `WITH CHECK (true)`.
--            => n'importe quel utilisateur authentifié peut insérer une ligne
--               d'audit attribuée à N'IMPORTE QUEL hotel_id / employee_id.
--            Détecté par Supabase advisor `rls_policy_always_true` (0024).
-- Correctif : lier l'écriture à l'identité réelle de l'appelant et à son hôtel.
-- Statut : PRÊT À APPLIQUER (à valider sur branche avant prod).
-- ============================================================================

DROP POLICY IF EXISTS audit_log_insert ON public.portal_audit_log;

CREATE POLICY audit_log_insert
  ON public.portal_audit_log
  FOR INSERT
  TO public
  WITH CHECK (
    -- L'acteur déclaré DOIT être l'utilisateur courant (anti-usurpation)
    actor_auth_id = auth.uid()
    AND (
      -- Manager : seulement sur un hôtel auquel il appartient
      hotel_id IN (SELECT pl_my_hotels())
      -- Salarié (portail) : seulement sur sa propre fiche employé
      OR employee_id = pl_portal_employee_id()
    )
  );
