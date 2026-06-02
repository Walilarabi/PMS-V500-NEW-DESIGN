-- ROLLBACK r4a. Restaure le défaut user_hotels.role + is_platform_admin original.
-- ⚠️ ATTENTION : restaurer is_platform_admin(id=auth.uid()) RECASSE le super_admin
-- (id ≠ auth_id en prod). À n'utiliser qu'en cas de régression avérée et après
-- analyse. Le défaut 'direction' réintroduit le sur-privilege (INC-07).
ALTER TABLE public.user_hotels
  ALTER COLUMN role SET DEFAULT 'direction'::admin_user_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND is_active = true
  );
$$;
