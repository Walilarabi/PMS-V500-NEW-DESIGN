-- ============================================================================
-- FLOWTYM SaaS — Couche "Applications" (PHASE 1 / fondation)
-- Additif et NON destructif : 3 nouvelles tables + seed + RLS.
-- Aucune table existante modifiée, aucune donnée métier touchée.
--
--   platform_apps           : catalogue des applications Flowtym (PMS, RH, futures)
--   hotel_app_subscriptions : quelles apps un hôtel a souscrites (+ statut/essai/prix)
--   user_app_access         : à quelles apps un utilisateur a accès (par hôtel)
--
-- RLS : platform_admin = accès total ; membres = lecture de leurs hôtels.
-- ============================================================================

-- ── 1. Catalogue des applications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_apps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,              -- PMS, RH, COMPLIANCE, ...
  name        text NOT NULL,
  description text,
  base_url    text,                              -- https://app.flowtym.com ...
  icon        text,
  color       text,
  is_available boolean NOT NULL DEFAULT false,   -- activable par les hôtels aujourd'hui ?
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed du catalogue (idempotent). PMS + RH disponibles ; le reste en "coming soon".
INSERT INTO public.platform_apps (code, name, description, base_url, icon, color, is_available, sort_order) VALUES
  ('PMS',            'Flowtym PMS',            'Property Management System',        'https://app.flowtym.com', 'bed',        '#8B5CF6', true,  10),
  ('RH',             'Flowtym RH',             'Ressources Humaines & Planning',    'https://rh.flowtym.com',  'users',      '#4F46E5', true,  20),
  ('COMPLIANCE',     'Flowtym Compliance',     'Conformité & RGPD',                 NULL,                      'shield',     '#0EA5E9', false, 30),
  ('HOUSEKEEPING',   'Flowtym Housekeeping',   'Gouvernance & étages',              NULL,                      'sparkles',   '#10B981', false, 40),
  ('SUPPLIERS',      'Flowtym Suppliers',      'Fournisseurs & achats',             NULL,                      'truck',      '#F59E0B', false, 50),
  ('GUEST_RELATIONS','Flowtym Guest Relations','Relation client',                   NULL,                      'heart',      '#EC4899', false, 60),
  ('FINANCE',        'Flowtym Finance',        'Finance & comptabilité',            NULL,                      'calculator', '#14B8A6', false, 70),
  ('RMS',            'Flowtym RMS',            'Revenue Management System',         NULL,                      'trending-up','#6366F1', false, 80)
ON CONFLICT (code) DO UPDATE
  SET name=EXCLUDED.name, description=EXCLUDED.description, base_url=EXCLUDED.base_url,
      icon=EXCLUDED.icon, color=EXCLUDED.color, sort_order=EXCLUDED.sort_order, updated_at=now();

-- ── 2. Abonnements applicatifs par hôtel ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hotel_app_subscriptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  app_id         uuid NOT NULL REFERENCES public.platform_apps(id) ON DELETE RESTRICT,
  status         text NOT NULL DEFAULT 'trial'
                 CHECK (status IN ('trial','active','suspended','cancelled','expired')),
  plan_id        uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  price_monthly  numeric,
  currency       text NOT NULL DEFAULT 'EUR',
  included_users integer,
  included_hotels integer,
  trial_ends_at  timestamptz,
  started_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,
  notes          text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, app_id)
);
CREATE INDEX IF NOT EXISTS idx_hotel_app_subs_hotel ON public.hotel_app_subscriptions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_app_subs_app   ON public.hotel_app_subscriptions(app_id);

-- ── 3. Accès applicatif par utilisateur (dans un hôtel) ────────────────────
CREATE TABLE IF NOT EXISTS public.user_app_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hotel_id    uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  app_id      uuid NOT NULL REFERENCES public.platform_apps(id) ON DELETE CASCADE,
  granted_by  uuid,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hotel_id, app_id)
);
CREATE INDEX IF NOT EXISTS idx_user_app_access_user  ON public.user_app_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_access_hotel ON public.user_app_access(hotel_id);

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_apps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_app_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_access          ENABLE ROW LEVEL SECURITY;

-- platform_apps : catalogue lisible par tout authentifié ; écriture super_admin
DROP POLICY IF EXISTS platform_apps_read       ON public.platform_apps;
DROP POLICY IF EXISTS platform_apps_admin_write ON public.platform_apps;
CREATE POLICY platform_apps_read        ON public.platform_apps FOR SELECT TO authenticated USING (true);
CREATE POLICY platform_apps_admin_write ON public.platform_apps FOR ALL    TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- hotel_app_subscriptions : admin total ; membres lisent leurs hôtels
DROP POLICY IF EXISTS hotel_app_subs_admin  ON public.hotel_app_subscriptions;
DROP POLICY IF EXISTS hotel_app_subs_member ON public.hotel_app_subscriptions;
CREATE POLICY hotel_app_subs_admin  ON public.hotel_app_subscriptions FOR ALL    TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY hotel_app_subs_member ON public.hotel_app_subscriptions FOR SELECT TO authenticated USING (hotel_id IN (SELECT pl_my_hotels()));

-- user_app_access : admin total ; l'utilisateur lit ses propres accès ; managers de l'hôtel lisent ceux de leur hôtel
DROP POLICY IF EXISTS user_app_access_admin   ON public.user_app_access;
DROP POLICY IF EXISTS user_app_access_self     ON public.user_app_access;
DROP POLICY IF EXISTS user_app_access_hotelmgr ON public.user_app_access;
CREATE POLICY user_app_access_admin    ON public.user_app_access FOR ALL    TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY user_app_access_self     ON public.user_app_access FOR SELECT TO authenticated USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));
CREATE POLICY user_app_access_hotelmgr ON public.user_app_access FOR SELECT TO authenticated USING (hotel_id IN (SELECT pl_my_hotels()));

-- ── 5. Helper : l'utilisateur courant a-t-il accès à une app (souscrite+accordée) ?
CREATE OR REPLACE FUNCTION public.current_user_has_app(p_app_code text)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_app_access uaa
    JOIN public.users u           ON u.id = uaa.user_id AND u.auth_id = auth.uid()
    JOIN public.platform_apps pa  ON pa.id = uaa.app_id AND pa.code = p_app_code
    JOIN public.hotel_app_subscriptions has
         ON has.hotel_id = uaa.hotel_id AND has.app_id = uaa.app_id
        AND has.status IN ('trial','active')
  );
$$;
