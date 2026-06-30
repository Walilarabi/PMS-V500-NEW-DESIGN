-- FLOWTYM — Commissions & promotions for distribution_partners.
-- (Dedicated tables: the pre-existing partner_commissions/partner_promotions
-- belong to a separate `partners` module with FK -> partners.)
CREATE TABLE IF NOT EXISTS public.dist_partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.distribution_partners(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES public.room_types(id) ON DELETE CASCADE,
  rate_plan_id UUID REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL DEFAULT 'percent' CHECK (commission_type IN ('percent','fixed')),
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 0, start_date DATE, end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dpc_hotel ON public.dist_partner_commissions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_dpc_partner ON public.dist_partner_commissions(partner_id);
ALTER TABLE public.dist_partner_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dpc_select ON public.dist_partner_commissions FOR SELECT USING (hotel_id = get_user_hotel_id());
CREATE POLICY dpc_insert ON public.dist_partner_commissions FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY dpc_update ON public.dist_partner_commissions FOR UPDATE USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY dpc_delete ON public.dist_partner_commissions FOR DELETE USING (hotel_id = get_user_hotel_id());

CREATE TABLE IF NOT EXISTS public.dist_partner_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.distribution_partners(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES public.room_types(id) ON DELETE CASCADE,
  rate_plan_id UUID REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0, start_date DATE, end_date DATE,
  is_stackable BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dpp_hotel ON public.dist_partner_promotions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_dpp_partner ON public.dist_partner_promotions(partner_id);
ALTER TABLE public.dist_partner_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dpp_select ON public.dist_partner_promotions FOR SELECT USING (hotel_id = get_user_hotel_id());
CREATE POLICY dpp_insert ON public.dist_partner_promotions FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY dpp_update ON public.dist_partner_promotions FOR UPDATE USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY dpp_delete ON public.dist_partner_promotions FOR DELETE USING (hotel_id = get_user_hotel_id());
