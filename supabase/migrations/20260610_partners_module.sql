-- FLOWTYM — Partners module
-- Extends distribution_partners + rate_plan_partner_mappings, creates partner_room_mappings.
-- NOTE: partner_commissions / partner_promotions already exist in the DB for a
-- different `partners` module (FK -> partners), so dedicated tables are created
-- in 20260611 (dist_partner_commissions / dist_partner_promotions).
ALTER TABLE public.distribution_partners
  ADD COLUMN IF NOT EXISTS partner_type            TEXT NOT NULL DEFAULT 'OTA'
    CHECK (partner_type IN ('OTA','direct','corporate','wholesaler','GDS','other')),
  ADD COLUMN IF NOT EXISTS default_commission_type TEXT NOT NULL DEFAULT 'percent'
    CHECK (default_commission_type IN ('percent','fixed')),
  ADD COLUMN IF NOT EXISTS default_commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency                TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE public.rate_plan_partner_mappings
  ADD COLUMN IF NOT EXISTS partner_rate_name TEXT,
  ADD COLUMN IF NOT EXISTS meal_plan         TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_type TEXT,
  ADD COLUMN IF NOT EXISTS occupancy         TEXT;

CREATE TABLE IF NOT EXISTS public.partner_room_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.distribution_partners(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
  partner_room_code TEXT, partner_room_name TEXT, capacity INTEGER,
  display_priority INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, partner_id, room_type_id)
);
CREATE INDEX IF NOT EXISTS idx_prm_hotel ON public.partner_room_mappings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_prm_partner ON public.partner_room_mappings(partner_id);
ALTER TABLE public.partner_room_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY prm_select ON public.partner_room_mappings FOR SELECT USING (hotel_id = get_user_hotel_id());
CREATE POLICY prm_insert ON public.partner_room_mappings FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY prm_update ON public.partner_room_mappings FOR UPDATE USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY prm_delete ON public.partner_room_mappings FOR DELETE USING (hotel_id = get_user_hotel_id());
