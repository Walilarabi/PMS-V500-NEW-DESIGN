-- =============================================================================
-- CALENDRIER TARIFAIRE — tables de stockage prix/restrictions/règles
-- Schéma de référence (DDL reconstitué depuis la base source).
-- =============================================================================
--
-- PRÉREQUIS : public.get_user_hotel_id() RETURNS uuid  (helper RLS multi-tenant).
--             Tables de base attendues côté cible : rooms, room_types, rate_plans
--             (un PMS standard les a déjà — non fournies ici).
--
-- Ces 3 tables sont propres au module Calendrier tarifaire :
--   rate_prices       — prix par chambre × plan × jour
--   rate_restrictions — restrictions/inventaire par chambre × jour
--   pricing_rules     — règles de dérivation prix (cascade), 1 ligne/hôtel
--
-- Adapte les types/contraintes à ton schéma si nécessaire.
-- =============================================================================

-- ─── rate_prices ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL,
  room_type_code text NOT NULL,
  plan_id        uuid NOT NULL,
  stay_date      date NOT NULL,
  price          numeric NOT NULL DEFAULT 0,
  currency       text NOT NULL DEFAULT 'EUR',
  status         text NOT NULL DEFAULT 'open',
  plan_closed    boolean NOT NULL DEFAULT false,
  block_reason   text,
  source         text NOT NULL DEFAULT 'manual',
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  CONSTRAINT rate_prices_unique UNIQUE (hotel_id, room_type_code, plan_id, stay_date)
);
CREATE INDEX IF NOT EXISTS idx_rate_prices_lookup
  ON public.rate_prices (hotel_id, stay_date);
ALTER TABLE public.rate_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_prices_own ON public.rate_prices
  FOR ALL USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─── rate_restrictions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_restrictions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id           uuid NOT NULL,
  room_type_code     text NOT NULL,
  stay_date          date NOT NULL,
  cta                boolean NOT NULL DEFAULT false,
  ctd                boolean NOT NULL DEFAULT false,
  min_stay           integer,
  max_stay           integer,
  inventory          integer NOT NULL DEFAULT 0,
  capacity           integer,
  sold               integer NOT NULL DEFAULT 0,
  inventory_override text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  CONSTRAINT rate_restrictions_unique UNIQUE (hotel_id, room_type_code, stay_date)
);
CREATE INDEX IF NOT EXISTS idx_rate_restrictions_lookup
  ON public.rate_restrictions (hotel_id, stay_date);
ALTER TABLE public.rate_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_restrictions_own ON public.rate_restrictions
  FOR ALL USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─── pricing_rules (config cascade, 1 ligne par hôtel) ───────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  hotel_id                 uuid PRIMARY KEY,
  reference_room_type_code text NOT NULL,
  reference_plan_id        uuid,
  room_rules               jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_rules               jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  version                  integer NOT NULL DEFAULT 1
);
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_rules_own ON public.pricing_rules
  FOR ALL USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());
