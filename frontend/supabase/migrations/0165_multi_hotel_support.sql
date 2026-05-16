-- =============================================================================
-- 0165_multi_hotel_support.sql
-- =============================================================================
-- OBJECTIF :
--   Permettre à un utilisateur d'accéder à plusieurs hôtels et de basculer
--   entre eux via un sélecteur dans l'app.
--
-- ARCHITECTURE :
--   1. Table user_hotels (N:N) : lien user ↔ hotel avec rôle et flag is_default
--   2. Table user_active_hotel (1:1) : stocke l'hôtel actif de l'utilisateur
--   3. RPC get_user_hotel_id() modifiée : lit user_active_hotel, fallback
--      sur user_hotels.is_default, fallback sur users.hotel_id (legacy)
--   4. RPC list_user_hotels() : liste les hôtels accessibles avec leurs métas
--   5. RPC set_active_hotel(p_hotel_id) : change l'hôtel actif (vérifie accès)
--
-- COMPATIBILITÉ :
--   * users.hotel_id reste pour rétro-compatibilité (legacy, fallback)
--   * RLS policies actuelles fonctionnent inchangées (get_user_hotel_id() est
--     le seul point d'entrée et reste valide)
--   * Migration des données existantes : pour chaque users.hotel_id, on insère
--     une row user_hotels avec is_default=true
--
-- IDEMPOTENT : peut être relancée sans dommage
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE user_hotels — relation N:N user ↔ hotel
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_hotels (
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hotel_id     uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  role         public.admin_user_role NOT NULL DEFAULT 'direction',
  is_default   boolean NOT NULL DEFAULT false,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  granted_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, hotel_id)
);

-- Un seul hôtel par défaut par user
CREATE UNIQUE INDEX IF NOT EXISTS user_hotels_one_default_per_user
  ON public.user_hotels (user_id)
  WHERE is_default = true;

-- Index pour les lookups inverses (qui a accès à cet hôtel ?)
CREATE INDEX IF NOT EXISTS user_hotels_hotel_id_idx
  ON public.user_hotels (hotel_id);

COMMENT ON TABLE public.user_hotels IS
  'Multi-tenant access: une row par (user, hotel) auquel l''utilisateur a accès. is_default = l''hôtel sélectionné par défaut au login.';

-- -----------------------------------------------------------------------------
-- 2. TABLE user_active_hotel — l'hôtel actuellement sélectionné par l'utilisateur
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_active_hotel (
  user_id      uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  hotel_id     uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  switched_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_active_hotel IS
  'Stocke l''hôtel actif (sélectionné par le sélecteur UI) pour chaque utilisateur. Un seul hôtel actif à la fois par user.';

-- -----------------------------------------------------------------------------
-- 3. RLS sur les deux tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_hotels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_hotel ENABLE ROW LEVEL SECURITY;

-- Lecture : un user peut voir SES propres user_hotels uniquement
DROP POLICY IF EXISTS "user_hotels_select_own" ON public.user_hotels;
CREATE POLICY "user_hotels_select_own" ON public.user_hotels
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Pas d'INSERT/UPDATE/DELETE depuis l'UI : gestion via RPC admin uniquement
-- (création initiale par script de seeding)

DROP POLICY IF EXISTS "user_active_hotel_select_own" ON public.user_active_hotel;
CREATE POLICY "user_active_hotel_select_own" ON public.user_active_hotel
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "user_active_hotel_upsert_own" ON public.user_active_hotel;
CREATE POLICY "user_active_hotel_upsert_own" ON public.user_active_hotel
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 4. RPC get_user_hotel_id() — REMPLACE l'ancienne version
-- -----------------------------------------------------------------------------
-- Stratégie de résolution (dans cet ordre) :
--   a) user_active_hotel : si l'utilisateur a explicitement choisi un hôtel
--   b) user_hotels.is_default : si pas de selection active, prendre le default
--   c) users.hotel_id : fallback legacy (compat ascendante)
--
-- SECURITY DEFINER : la fonction doit pouvoir lire user_hotels et users
-- même si l'utilisateur n'a pas les droits directs.
CREATE OR REPLACE FUNCTION public.get_user_hotel_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_auth_uid    uuid := auth.uid();
  v_user_id     uuid;
  v_hotel_id    uuid;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Trouver l'id public.users à partir de auth.uid()
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = v_auth_uid
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- a) Hôtel actif (sélectionné par le user)
  SELECT uah.hotel_id INTO v_hotel_id
  FROM public.user_active_hotel uah
  WHERE uah.user_id = v_user_id
    -- Vérifier que l'user a TOUJOURS accès à cet hôtel (sécurité)
    AND EXISTS (
      SELECT 1 FROM public.user_hotels uh
      WHERE uh.user_id = v_user_id AND uh.hotel_id = uah.hotel_id
    )
  LIMIT 1;

  IF v_hotel_id IS NOT NULL THEN
    RETURN v_hotel_id;
  END IF;

  -- b) Hôtel par défaut dans user_hotels
  SELECT uh.hotel_id INTO v_hotel_id
  FROM public.user_hotels uh
  WHERE uh.user_id = v_user_id AND uh.is_default = true
  LIMIT 1;

  IF v_hotel_id IS NOT NULL THEN
    RETURN v_hotel_id;
  END IF;

  -- c) Fallback legacy : users.hotel_id
  SELECT u.hotel_id INTO v_hotel_id
  FROM public.users u
  WHERE u.id = v_user_id
  LIMIT 1;

  RETURN v_hotel_id;
END;
$$;

COMMENT ON FUNCTION public.get_user_hotel_id() IS
  'Retourne l''hotel_id actif de l''utilisateur connecté. Résolution: user_active_hotel > user_hotels.is_default > users.hotel_id (legacy). Utilisé par toutes les policies RLS.';

GRANT EXECUTE ON FUNCTION public.get_user_hotel_id() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. RPC list_user_hotels() — liste des hôtels accessibles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_user_hotels()
RETURNS TABLE (
  hotel_id    uuid,
  name        text,
  city        text,
  country     text,
  role        public.admin_user_role,
  is_default  boolean,
  is_active   boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id    uuid;
  v_active_id  uuid;
BEGIN
  -- Résoudre user_id depuis auth.uid()
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Récupérer l'hôtel actif courant
  SELECT uah.hotel_id INTO v_active_id
  FROM public.user_active_hotel uah
  WHERE uah.user_id = v_user_id
  LIMIT 1;

  -- Si pas d'actif explicite, fallback sur le default
  IF v_active_id IS NULL THEN
    SELECT uh.hotel_id INTO v_active_id
    FROM public.user_hotels uh
    WHERE uh.user_id = v_user_id AND uh.is_default = true
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    uh.hotel_id,
    h.name,
    h.city,
    h.country,
    uh.role,
    uh.is_default,
    (uh.hotel_id = v_active_id) AS is_active
  FROM public.user_hotels uh
  JOIN public.hotels h ON h.id = uh.hotel_id
  WHERE uh.user_id = v_user_id
  ORDER BY uh.is_default DESC, h.name ASC;
END;
$$;

COMMENT ON FUNCTION public.list_user_hotels() IS
  'Retourne la liste des hôtels accessibles à l''utilisateur connecté, avec son rôle et un flag is_active indiquant celui actuellement sélectionné.';

GRANT EXECUTE ON FUNCTION public.list_user_hotels() TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. RPC set_active_hotel(p_hotel_id uuid) — change l'hôtel actif
-- -----------------------------------------------------------------------------
-- Sécurité : vérifie que l'utilisateur a bien accès à cet hôtel via user_hotels
-- avant d'enregistrer. Retourne true si succès, false sinon.
CREATE OR REPLACE FUNCTION public.set_active_hotel(p_hotel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id     uuid;
  v_has_access  boolean;
BEGIN
  -- Résoudre user_id
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Vérifier l'accès
  SELECT EXISTS (
    SELECT 1 FROM public.user_hotels
    WHERE user_id = v_user_id AND hotel_id = p_hotel_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to hotel %', p_hotel_id
      USING ERRCODE = '42501';
  END IF;

  -- Upsert l'hôtel actif
  INSERT INTO public.user_active_hotel (user_id, hotel_id, switched_at)
  VALUES (v_user_id, p_hotel_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET hotel_id = EXCLUDED.hotel_id,
        switched_at = EXCLUDED.switched_at;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.set_active_hotel(uuid) IS
  'Change l''hôtel actif de l''utilisateur. Vérifie l''accès via user_hotels avant d''enregistrer. RAISE si pas d''accès.';

GRANT EXECUTE ON FUNCTION public.set_active_hotel(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. SEED : migration des données existantes
-- -----------------------------------------------------------------------------
-- Pour chaque user existant ayant un users.hotel_id, créer une row
-- user_hotels avec is_default=true. Idempotent via ON CONFLICT DO NOTHING.
INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default)
SELECT u.id, u.hotel_id, u.role, true
FROM public.users u
WHERE u.hotel_id IS NOT NULL
ON CONFLICT (user_id, hotel_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. SEED SPÉCIFIQUE : compte Wali accès aux 5 hôtels
-- -----------------------------------------------------------------------------
-- Donne au compte walilarabi@gmail.com l'accès aux 5 hôtels :
--   - Mas Provençal Aix (déjà default, créé par étape 7)
--   - Folkestone opera
--   - Vendome opera
--   - Grand Hotel du Havre
--   - Washington Opera
-- Tous en role 'direction'.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'walilarabi@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User walilarabi@gmail.com not found — skipping multi-hotel seed';
    RETURN;
  END IF;

  -- Insérer les 4 autres hôtels (le 1er est déjà inséré par l'étape 7 en default)
  INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default)
  VALUES
    (v_user_id, '02b9eb0e-89ef-45de-ba8e-20d4b41c500c', 'direction', false),
    (v_user_id, '101be214-8b05-4f1c-8cfe-ceb9cf6a1881', 'direction', false),
    (v_user_id, '7f55eb86-0fd4-4636-b8aa-ae1566ecb2c6', 'direction', false),
    (v_user_id, 'ece0fc53-7852-4ff0-ad6f-3eef37b586f0', 'direction', false)
  ON CONFLICT (user_id, hotel_id) DO NOTHING;

  RAISE NOTICE 'Wali multi-hotel access granted: 5 hotels';
END $$;

-- -----------------------------------------------------------------------------
-- 9. VÉRIFICATION
-- -----------------------------------------------------------------------------
SELECT 
  'user_hotels (Wali)' AS check_name,
  count(*) AS rows
FROM public.user_hotels uh
JOIN public.users u ON u.id = uh.user_id
WHERE u.email = 'walilarabi@gmail.com'
UNION ALL
SELECT 
  'user_active_hotel total',
  count(*) FROM public.user_active_hotel
UNION ALL
SELECT
  'RPC get_user_hotel_id exists',
  count(*) FROM pg_proc WHERE proname = 'get_user_hotel_id'
UNION ALL
SELECT
  'RPC list_user_hotels exists',
  count(*) FROM pg_proc WHERE proname = 'list_user_hotels'
UNION ALL
SELECT
  'RPC set_active_hotel exists',
  count(*) FROM pg_proc WHERE proname = 'set_active_hotel';
