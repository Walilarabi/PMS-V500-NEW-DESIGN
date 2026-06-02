-- ROLLBACK r4d. Supprime les permissions documentaires des nouveaux rôles.
DELETE FROM public.document_role_permissions
 WHERE role IN ('admin_hotel', 'comptabilite', 'revenue_manager');
