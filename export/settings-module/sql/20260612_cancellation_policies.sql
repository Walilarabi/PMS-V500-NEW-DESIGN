-- FLOWTYM — Conditions d'annulation (avec base de calcul de la pénalité). RLS by hotel_id.
CREATE TABLE IF NOT EXISTS public.cancellation_policies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  code          TEXT,
  free_until_hours INTEGER  NOT NULL DEFAULT 0,
  penalty_type  TEXT        NOT NULL DEFAULT 'percentage'
                            CHECK (penalty_type IN ('percentage','fixed_amount')),
  penalty_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  penalty_base  TEXT        NOT NULL DEFAULT 'first_night'
                            CHECK (penalty_base IN ('first_night','total_stay','cancelled_amount','remaining_due','paid_amount','fixed_amount')),
  currency      TEXT        NOT NULL DEFAULT 'EUR',
  applies_from  DATE,
  applies_until DATE,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cancel_pol_hotel ON public.cancellation_policies(hotel_id);
ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY cancel_pol_select ON public.cancellation_policies FOR SELECT USING (hotel_id = get_user_hotel_id());
CREATE POLICY cancel_pol_insert ON public.cancellation_policies FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY cancel_pol_update ON public.cancellation_policies FOR UPDATE USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
CREATE POLICY cancel_pol_delete ON public.cancellation_policies FOR DELETE USING (hotel_id = get_user_hotel_id());
