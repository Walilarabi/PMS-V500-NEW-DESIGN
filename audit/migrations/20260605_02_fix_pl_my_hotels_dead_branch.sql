-- ============================================================================
-- AUDIT FLOWTYM — Correctif RLS #2
-- Fonction : public.pl_my_hotels()  (utilisée par les policies RH :
--            employees, staff_planning, absence_requests, portal_audit_log…)
-- Problème : la 1re branche du UNION compare `user_hotels.user_id` à `auth.uid()`.
--            Or user_hotels.user_id = public.users.id (PAS un auth.users.id).
--            => branche morte. Inopérante aujourd'hui (la 2e branche, via
--               users.auth_id, fournit le bon résultat), MAIS c'est un vecteur
--               de fuite THÉORIQUE : si un public.users.id venait à coïncider
--               avec un auth.uid() d'un AUTRE utilisateur, des hôtels d'autrui
--               seraient ajoutés à l'ensemble visible.
-- Correctif : ne garder que la jointure correcte via users.auth_id.
-- Statut : PRÊT À APPLIQUER (équivalent fonctionnel, nettoyage de sécurité).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pl_my_hotels()
  RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT uh.hotel_id
  FROM public.user_hotels uh
  JOIN public.users u ON u.id = uh.user_id
  WHERE u.auth_id = auth.uid();
$function$;
