-- ═══════════════════════════════════════════════════════════════════
-- FLOWTYM — Distribution partners + rate-plan/partner mappings
-- For the Excel import of distributed rate plans (Activation /
-- Partenaires de distribution / Tarifs distribués).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.rate_plans
  ADD COLUMN IF NOT EXISTS cancellation_type TEXT,   -- FLEX / NANR / null
  ADD COLUMN IF NOT EXISTS occupancy         TEXT;   -- 1P / 2P / 4P / null

CREATE TABLE IF NOT EXISTS public.distribution_partners (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  external_id TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, name)
);
CREATE INDEX IF NOT EXISTS idx_distribution_partners_hotel ON public.distribution_partners(hotel_id);

ALTER TABLE public.distribution_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY distribution_partners_tenant_select ON public.distribution_partners
  FOR SELECT USING (hotel_id = get_user_hotel_id());
CREATE POLICY distribution_partners_tenant_insert ON public.distribution_partners
  FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY distribution_partners_tenant_update ON public.distribution_partners
  FOR UPDATE USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY distribution_partners_tenant_delete ON public.distribution_partners
  FOR DELETE USING (hotel_id = get_user_hotel_id());

CREATE TABLE IF NOT EXISTS public.rate_plan_partner_mappings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          UUID        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  rate_plan_id      UUID        NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  partner_id        UUID        NOT NULL REFERENCES public.distribution_partners(id) ON DELETE CASCADE,
  partner_rate_code TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, rate_plan_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_rppm_hotel   ON public.rate_plan_partner_mappings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rppm_plan    ON public.rate_plan_partner_mappings(rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_rppm_partner ON public.rate_plan_partner_mappings(partner_id);

ALTER TABLE public.rate_plan_partner_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rppm_tenant_select ON public.rate_plan_partner_mappings
  FOR SELECT USING (hotel_id = get_user_hotel_id());
CREATE POLICY rppm_tenant_insert ON public.rate_plan_partner_mappings
  FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY rppm_tenant_update ON public.rate_plan_partner_mappings
  FOR UPDATE USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY rppm_tenant_delete ON public.rate_plan_partner_mappings
  FOR DELETE USING (hotel_id = get_user_hotel_id());
