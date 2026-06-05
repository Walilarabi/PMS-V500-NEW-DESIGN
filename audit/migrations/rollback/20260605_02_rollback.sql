-- ROLLBACK MIGRATION 02 — restaure la définition AVANT (capturée 2026-06-05)
CREATE OR REPLACE FUNCTION public.pl_my_hotels()
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select hotel_id from public.user_hotels where user_id = auth.uid()
  union
  select uh.hotel_id from public.user_hotels uh join public.users u on u.id = uh.user_id where u.auth_id = auth.uid()
$function$;
