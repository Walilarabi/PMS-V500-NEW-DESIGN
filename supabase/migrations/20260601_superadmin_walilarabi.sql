-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM — Superadmin walilarabi@gmail.com
--
-- Garantit que walilarabi@gmail.com a un accès `admin` :
--   1. Sur tous les hôtels existants au moment de la migration
--   2. Automatiquement sur tous les hôtels créés par la suite
--      (via un trigger AFTER INSERT sur public.hotels)
--
-- Idempotente : ré-exécutable sans danger.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Backfill — hôtels existants ────────────────────────────────────────
DO $$
DECLARE
  v_user_id UUID;
  v_count INT := 0;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'walilarabi@gmail.com'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE WARNING 'User walilarabi@gmail.com introuvable dans auth.users — backfill ignoré, le trigger s''appliquera dès que le compte sera créé';
    RETURN;
  END IF;

  -- Assure le profil public.users (FK requise par certaines tables)
  INSERT INTO public.users (id, email, full_name)
  VALUES (v_user_id, 'walilarabi@gmail.com', 'Wali Larabi')
  ON CONFLICT (id) DO NOTHING;

  -- Grant admin sur TOUS les hôtels existants
  WITH grants AS (
    INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default, is_active)
    SELECT
      v_user_id,
      h.id,
      'admin',
      (ROW_NUMBER() OVER (ORDER BY h.created_at) = 1),  -- 1er = défaut
      (ROW_NUMBER() OVER (ORDER BY h.created_at) = 1)   -- 1er = actif
    FROM public.hotels h
    ON CONFLICT (user_id, hotel_id) DO UPDATE
      SET role = 'admin',
          is_active = EXCLUDED.is_active OR public.user_hotels.is_active
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM grants;

  RAISE NOTICE 'walilarabi@gmail.com : admin sur % hôtel(s)', v_count;
END $$;

-- ─── 2. Trigger — auto-grant sur tout nouvel hôtel ────────────────────────
CREATE OR REPLACE FUNCTION public.grant_superadmin_on_new_hotel()
RETURNS TRIGGER AS $$
DECLARE
  v_superadmin_id UUID;
BEGIN
  SELECT id INTO v_superadmin_id
    FROM auth.users
   WHERE email = 'walilarabi@gmail.com'
   LIMIT 1;

  IF v_superadmin_id IS NULL THEN
    -- L'user n'existe pas encore : pas de grant possible. Le backfill
    -- ci-dessus le rattrapera quand la migration sera ré-exécutée OU
    -- quand l'user sera créé manuellement.
    RETURN NEW;
  END IF;

  INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default, is_active)
  VALUES (v_superadmin_id, NEW.id, 'admin', FALSE, FALSE)
  ON CONFLICT (user_id, hotel_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_grant_superadmin_on_new_hotel ON public.hotels;
CREATE TRIGGER trg_grant_superadmin_on_new_hotel
  AFTER INSERT ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_superadmin_on_new_hotel();

-- ─── 3. Trigger — auto-grant si l'user est créé après les hôtels ──────────
-- Au cas où walilarabi@gmail.com est inscrit APRÈS la création de certains
-- hôtels, ce trigger lui ouvre l'accès admin rétroactivement à TOUS les
-- hôtels existants dès la création de son auth.users.
CREATE OR REPLACE FUNCTION public.grant_superadmin_on_user_create()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM 'walilarabi@gmail.com' THEN
    RETURN NEW;
  END IF;

  -- Profil public.users
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Wali Larabi'))
  ON CONFLICT (id) DO NOTHING;

  -- Grant admin sur tous les hôtels existants
  INSERT INTO public.user_hotels (user_id, hotel_id, role, is_default, is_active)
  SELECT
    NEW.id,
    h.id,
    'admin',
    (ROW_NUMBER() OVER (ORDER BY h.created_at) = 1),
    (ROW_NUMBER() OVER (ORDER BY h.created_at) = 1)
  FROM public.hotels h
  ON CONFLICT (user_id, hotel_id) DO UPDATE
    SET role = 'admin';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_grant_superadmin_on_user_create ON auth.users;
CREATE TRIGGER trg_grant_superadmin_on_user_create
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_superadmin_on_user_create();

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION 20260601_superadmin_walilarabi.sql
-- ═══════════════════════════════════════════════════════════════════════════
