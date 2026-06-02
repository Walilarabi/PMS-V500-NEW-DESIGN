-- ROLLBACK r4e. Restaure get_user_role() sans le commentaire de dépréciation.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS admin_user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;
COMMENT ON FUNCTION public.get_user_role() IS NULL;
COMMENT ON FUNCTION public.current_user_role() IS NULL;
