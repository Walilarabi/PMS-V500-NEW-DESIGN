-- ============================================================================
-- FLOWTYM RMS — Migration 0160 : Pricing Grid (MVP Phase 1)
-- ----------------------------------------------------------------------------
-- Adds the foundation tables for the Revenue Management module:
--   * rate_plans          — distinct pricing plans (Rack RO, Rack BB, NANR, ...)
--   * pricing_rules       — cascade rules (reference room + plan + diffs)
--   * rate_prices         — daily prices per room_type × plan × stay_date
--   * rate_restrictions   — CTA/CTD/MinLOS/MaxLOS + inventory overrides
--
-- Conventions:
--   * room_type_code (TEXT) is the cascade key (stable, human-readable).
--   * version (INT) on every mutable table for optimistic concurrency control.
--   * Soft delete (deleted_at) on rate_plans only — prices are kept forever
--     for audit/regulatory reasons.
--   * RLS via existing public.get_user_hotel_id() helper from 0010.
--
-- Audit:
--   * Trigger on rate_prices logs every meaningful change to audit_logs.
--     Uses public.audit_resolve_actor() from 0151 to safely resolve actor.
-- ============================================================================

-- Add room_type_code to existing rooms table (bridge mock IDs ↔ uuid)
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS room_type_code text;

CREATE INDEX IF NOT EXISTS idx_rooms_type_code
  ON public.rooms(hotel_id, room_type_code)
  WHERE room_type_code IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 1. rate_plans — distinct pricing plans per hotel
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  plan_code text NOT NULL,
  plan_name text NOT NULL,
  pension_type text NOT NULL CHECK (pension_type IN ('RO','BB','HB','FB','AI','Package')),
  channel_type text NOT NULL DEFAULT 'OTA' CHECK (channel_type IN ('OTA','Mobile','Corporate','Direct')),
  calc_mode text NOT NULL DEFAULT 'derived' CHECK (calc_mode IN ('fixed','derived')),
  calc_value numeric NOT NULL DEFAULT 0,
  reference_plan_id uuid REFERENCES public.rate_plans(id) ON DELETE SET NULL,
  is_reference boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  connectivity_type text NOT NULL DEFAULT 'Aucun' CHECK (connectivity_type IN ('D-EDGE','ChannelManager','Aucun')),
  is_connectivity_locked boolean NOT NULL DEFAULT false,
  distribution_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_stay integer,
  max_stay integer,
  cancellation_policy text,
  meal_plan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (hotel_id, plan_code)
);

-- Idempotency safety: if rate_plans already exists from a partial earlier run
-- with missing columns, add them now so the rest of the migration works.
ALTER TABLE public.rate_plans
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS pension_type text,
  ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'OTA',
  ADD COLUMN IF NOT EXISTS calc_mode text NOT NULL DEFAULT 'derived',
  ADD COLUMN IF NOT EXISTS calc_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_plan_id uuid,
  ADD COLUMN IF NOT EXISTS is_reference boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS connectivity_type text NOT NULL DEFAULT 'Aucun',
  ADD COLUMN IF NOT EXISTS is_connectivity_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS distribution_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS min_stay integer,
  ADD COLUMN IF NOT EXISTS max_stay integer,
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS meal_plan text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Only ONE reference plan per hotel (enforced at DB level)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rate_plans_one_reference_per_hotel
  ON public.rate_plans(hotel_id)
  WHERE is_reference = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rate_plans_hotel
  ON public.rate_plans(hotel_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_rate_plans_updated_at ON public.rate_plans;
CREATE TRIGGER trg_rate_plans_updated_at
  BEFORE UPDATE ON public.rate_plans
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. pricing_rules — one row per hotel
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  hotel_id uuid PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  reference_room_type_code text NOT NULL,
  reference_plan_id uuid REFERENCES public.rate_plans(id) ON DELETE SET NULL,
  -- room_rules JSON shape:
  --   [{ room_type_code: "DELUXE", diff_type: "fixed"|"percent", diff_value: 30 }]
  room_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- plan_rules JSON shape:
  --   [{ plan_id: "<uuid>", diff_type: "fixed"|"percent", diff_value: 15 }]
  plan_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1
);

ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS reference_plan_id uuid,
  ADD COLUMN IF NOT EXISTS room_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

DROP TRIGGER IF EXISTS trg_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. rate_prices — daily prices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_type_code text NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  stay_date date NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','restricted','readonly')),
  plan_closed boolean NOT NULL DEFAULT false,
  block_reason text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','cascade','rms_recommendation','import','lighthouse')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (hotel_id, room_type_code, plan_id, stay_date)
);

ALTER TABLE public.rate_prices
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS plan_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_rate_prices_lookup
  ON public.rate_prices(hotel_id, stay_date, room_type_code);

CREATE INDEX IF NOT EXISTS idx_rate_prices_plan
  ON public.rate_prices(plan_id, stay_date);

DROP TRIGGER IF EXISTS trg_rate_prices_updated_at ON public.rate_prices;
CREATE TRIGGER trg_rate_prices_updated_at
  BEFORE UPDATE ON public.rate_prices
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. rate_restrictions — CTA/CTD/MinLOS/MaxLOS + inventory
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_type_code text NOT NULL,
  stay_date date NOT NULL,
  cta boolean NOT NULL DEFAULT false,
  ctd boolean NOT NULL DEFAULT false,
  min_stay integer CHECK (min_stay IS NULL OR min_stay >= 1),
  max_stay integer CHECK (max_stay IS NULL OR max_stay >= 1),
  inventory integer NOT NULL DEFAULT 0,
  capacity integer,
  sold integer NOT NULL DEFAULT 0,
  inventory_override text CHECK (inventory_override IS NULL OR inventory_override IN ('manual_closed','force_open')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (hotel_id, room_type_code, stay_date)
);

ALTER TABLE public.rate_restrictions
  ADD COLUMN IF NOT EXISTS cta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ctd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_stay integer,
  ADD COLUMN IF NOT EXISTS max_stay integer,
  ADD COLUMN IF NOT EXISTS inventory integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS sold integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_override text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_rate_restrictions_lookup
  ON public.rate_restrictions(hotel_id, stay_date, room_type_code);

DROP TRIGGER IF EXISTS trg_rate_restrictions_updated_at ON public.rate_restrictions;
CREATE TRIGGER trg_rate_restrictions_updated_at
  BEFORE UPDATE ON public.rate_restrictions
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ============================================================================
-- AUDIT TRIGGER on rate_prices
-- ============================================================================
CREATE OR REPLACE FUNCTION public.audit_rate_prices_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb;
  v_actor uuid;
BEGIN
  BEGIN
    v_actor := public.audit_resolve_actor();

    IF tg_op = 'INSERT' THEN
      v_payload := jsonb_build_object('after', to_jsonb(NEW));
    ELSIF tg_op = 'UPDATE' THEN
      -- Skip noisy updates: same price + same status = no audit
      IF NEW.price = OLD.price
         AND NEW.status = OLD.status
         AND NEW.plan_closed = OLD.plan_closed THEN
        RETURN NEW;
      END IF;
      v_payload := jsonb_build_object(
        'before', jsonb_build_object('price', OLD.price, 'status', OLD.status),
        'after',  jsonb_build_object('price', NEW.price, 'status', NEW.status),
        'source', NEW.source
      );
    ELSIF tg_op = 'DELETE' THEN
      v_payload := jsonb_build_object('before', to_jsonb(OLD));
    END IF;

    INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
    VALUES (
      COALESCE(NEW.hotel_id, OLD.hotel_id),
      v_actor,
      'rate_price',
      COALESCE(NEW.id, OLD.id),
      tg_op,
      v_payload
    );

  EXCEPTION WHEN OTHERS THEN
    -- Audit must never break business operations
    RAISE NOTICE 'audit_rate_prices_change swallowed: %', SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_rate_prices ON public.rate_prices;
CREATE TRIGGER trg_audit_rate_prices
  AFTER INSERT OR UPDATE OR DELETE ON public.rate_prices
  FOR EACH ROW EXECUTE FUNCTION public.audit_rate_prices_change();

-- ============================================================================
-- CASCADE STORED PROCEDURE
-- ----------------------------------------------------------------------------
-- Called when the REFERENCE price (reference room × reference plan) changes
-- for a given stay_date. Recomputes all derived prices using pricing_rules.
--
-- Returns the list of updated rate_prices rows for the client to refresh.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cascade_reference_price(
  p_hotel_id uuid,
  p_stay_date date,
  p_new_price numeric
)
RETURNS TABLE (
  out_id uuid,
  out_room_type_code text,
  out_plan_id uuid,
  out_price numeric,
  out_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rules public.pricing_rules%ROWTYPE;
  v_ref_plan_id uuid;
  v_ref_room_code text;
  v_actor uuid;
  v_grid record;             -- one row per (room_type_code, plan_id) in the grid
  v_room_diff_type text;
  v_room_diff_value numeric;
  v_plan_diff_type text;
  v_plan_diff_value numeric;
  v_room_price numeric;
  v_final_price numeric;
BEGIN
  -- 1. Validate input
  IF p_hotel_id IS NULL THEN
    RAISE EXCEPTION 'hotel_id is required';
  END IF;
  IF p_new_price < 0 THEN
    RAISE EXCEPTION 'price must be >= 0';
  END IF;

  -- 2. Load pricing rules for this hotel
  SELECT * INTO v_rules FROM public.pricing_rules WHERE hotel_id = p_hotel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pricing_rules configured for hotel %', p_hotel_id;
  END IF;

  v_ref_plan_id := v_rules.reference_plan_id;
  v_ref_room_code := v_rules.reference_room_type_code;
  v_actor := public.audit_resolve_actor();

  IF v_ref_plan_id IS NULL OR v_ref_room_code IS NULL THEN
    RAISE EXCEPTION 'reference room or plan not set in pricing_rules';
  END IF;

  -- 3. Iterate every existing (room_type_code, plan_id) cell for this hotel/date
  FOR v_grid IN
    SELECT DISTINCT rp.room_type_code AS rtc, rp.plan_id AS pid
    FROM public.rate_prices rp
    JOIN public.rate_plans pl
      ON pl.id = rp.plan_id
     AND pl.is_active = true
     AND pl.deleted_at IS NULL
    WHERE rp.hotel_id = p_hotel_id
      AND rp.stay_date = p_stay_date
  LOOP
    -- 4. Resolve room-level diff
    v_room_diff_type := NULL;
    v_room_diff_value := 0;
    IF v_grid.rtc <> v_ref_room_code THEN
      SELECT (rule->>'diff_type'),
             COALESCE((rule->>'diff_value')::numeric, 0)
        INTO v_room_diff_type, v_room_diff_value
      FROM jsonb_array_elements(v_rules.room_rules) AS rule
      WHERE rule->>'room_type_code' = v_grid.rtc
      LIMIT 1;
    END IF;

    -- 5. Resolve plan-level diff
    v_plan_diff_type := NULL;
    v_plan_diff_value := 0;
    IF v_grid.pid <> v_ref_plan_id THEN
      SELECT (rule->>'diff_type'),
             COALESCE((rule->>'diff_value')::numeric, 0)
        INTO v_plan_diff_type, v_plan_diff_value
      FROM jsonb_array_elements(v_rules.plan_rules) AS rule
      WHERE rule->>'plan_id' = v_grid.pid::text
      LIMIT 1;
    END IF;

    -- 6. Compute room-level price (apply room diff to reference)
    v_room_price := p_new_price;
    IF v_room_diff_type = 'fixed' THEN
      v_room_price := p_new_price + v_room_diff_value;
    ELSIF v_room_diff_type = 'percent' THEN
      v_room_price := p_new_price * (1 + v_room_diff_value / 100);
    END IF;

    -- 7. Compute final price (apply plan diff)
    v_final_price := v_room_price;
    IF v_plan_diff_type = 'fixed' THEN
      v_final_price := v_room_price + v_plan_diff_value;
    ELSIF v_plan_diff_type = 'percent' THEN
      v_final_price := v_room_price * (1 + v_plan_diff_value / 100);
    END IF;

    -- 8. Safety: floor at 0, round to integer
    v_final_price := GREATEST(0, ROUND(v_final_price));

    -- 9. Update existing row, capture into OUT params
    UPDATE public.rate_prices AS rp
    SET price = v_final_price,
        source = CASE
          WHEN rp.room_type_code = v_ref_room_code AND rp.plan_id = v_ref_plan_id
          THEN 'manual'
          ELSE 'cascade'
        END,
        version = rp.version + 1,
        updated_by = v_actor,
        updated_at = now()
    WHERE rp.hotel_id = p_hotel_id
      AND rp.room_type_code = v_grid.rtc
      AND rp.plan_id = v_grid.pid
      AND rp.stay_date = p_stay_date
    RETURNING
      rp.id,
      rp.room_type_code,
      rp.plan_id,
      rp.price,
      rp.source
    INTO out_id, out_room_type_code, out_plan_id, out_price, out_source;

    -- 10. Emit this row to caller
    IF FOUND THEN
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.cascade_reference_price(uuid, date, numeric) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cascade_reference_price(uuid, date, numeric) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cascade_reference_price(uuid, date, numeric) TO service_role';
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES (tenant scope via existing get_user_hotel_id)
-- ============================================================================
ALTER TABLE public.rate_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_prices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_restrictions  ENABLE ROW LEVEL SECURITY;

-- SELECT: any user of the hotel
DROP POLICY IF EXISTS rate_plans_select ON public.rate_plans;
CREATE POLICY rate_plans_select ON public.rate_plans FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS rate_plans_write ON public.rate_plans;
CREATE POLICY rate_plans_write ON public.rate_plans FOR ALL
  USING (hotel_id = public.get_user_hotel_id()
         AND public.get_user_role() IN ('direction'))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
              AND public.get_user_role() IN ('direction'));

DROP POLICY IF EXISTS pricing_rules_select ON public.pricing_rules;
CREATE POLICY pricing_rules_select ON public.pricing_rules FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS pricing_rules_write ON public.pricing_rules;
CREATE POLICY pricing_rules_write ON public.pricing_rules FOR ALL
  USING (hotel_id = public.get_user_hotel_id()
         AND public.get_user_role() IN ('direction'))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
              AND public.get_user_role() IN ('direction'));

DROP POLICY IF EXISTS rate_prices_select ON public.rate_prices;
CREATE POLICY rate_prices_select ON public.rate_prices FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS rate_prices_write ON public.rate_prices;
CREATE POLICY rate_prices_write ON public.rate_prices FOR ALL
  USING (hotel_id = public.get_user_hotel_id()
         AND public.get_user_role() IN ('direction','reception'))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
              AND public.get_user_role() IN ('direction','reception'));

DROP POLICY IF EXISTS rate_restrictions_select ON public.rate_restrictions;
CREATE POLICY rate_restrictions_select ON public.rate_restrictions FOR SELECT
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS rate_restrictions_write ON public.rate_restrictions;
CREATE POLICY rate_restrictions_write ON public.rate_restrictions FOR ALL
  USING (hotel_id = public.get_user_hotel_id()
         AND public.get_user_role() IN ('direction','reception'))
  WITH CHECK (hotel_id = public.get_user_hotel_id()
              AND public.get_user_role() IN ('direction','reception'));
