-- ============================================================================
-- FLOWTYM PMS — Migration 0021 : RIE seed (partners + payment models + rules)
-- ----------------------------------------------------------------------------
-- Seeds the Mas Provencal Aix hotel with a realistic configuration:
--   * 3 partners: DIRECT, BOOKING, EXPEDIA
--   * Payment models per partner (Booking : HOTEL_COLLECT default; Expedia :
--     OTA_COLLECT + HOTEL_COLLECT detected by `payment_collect` payload field)
--   * Default commission rates
--   * Promotions catalogue
--   * Default scoring rule
--   * EUR currency rates baseline
-- ============================================================================

do $$
declare
  v_hotel_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_direct_id   uuid;
  v_booking_id  uuid;
  v_expedia_id  uuid;
  v_b_hcollect uuid;
  v_e_otacollect uuid;
  v_e_hcollect uuid;
begin
  -- ----------- partners ---------------------------------------------------
  insert into public.partners (hotel_id, code, name, api_provider, country, currency, status, metadata)
  values (v_hotel_id, 'DIRECT', 'Direct (Hotel Website)', 'direct', 'FR', 'EUR', 'active', '{}')
  on conflict (hotel_id, code) do update set name = excluded.name
  returning id into v_direct_id;

  insert into public.partners (hotel_id, code, name, api_provider, country, currency, status, metadata)
  values (v_hotel_id, 'BOOKING', 'Booking.com', 'channel_manager', 'NL', 'EUR', 'active',
          jsonb_build_object('partner_url','https://booking.com'))
  on conflict (hotel_id, code) do update set name = excluded.name
  returning id into v_booking_id;

  insert into public.partners (hotel_id, code, name, api_provider, country, currency, status, metadata)
  values (v_hotel_id, 'EXPEDIA', 'Expedia Group', 'expedia_eqc', 'US', 'EUR', 'active',
          jsonb_build_object('partner_url','https://expediapartnercentral.com'))
  on conflict (hotel_id, code) do update set name = excluded.name
  returning id into v_expedia_id;

  -- ----------- payment models -------------------------------------------
  insert into public.partner_payment_models
    (hotel_id, partner_id, collection_type, commission_mode, payout_mode,
     is_default, detection_rules, priority, enabled)
  values
    (v_hotel_id, v_direct_id, 'HOTEL_COLLECT', 'PERCENTAGE', 'IMMEDIATE', true, '[]'::jsonb, 10, true);

  -- Booking : HOTEL_COLLECT default
  insert into public.partner_payment_models
    (hotel_id, partner_id, collection_type, commission_mode, payout_mode,
     is_default, detection_rules, priority, enabled)
  values (v_hotel_id, v_booking_id, 'HOTEL_COLLECT', 'PERCENTAGE', 'POST_PAID',
          true, '[]'::jsonb, 10, true)
  returning id into v_b_hcollect;

  -- Expedia : detection rules
  --   if payload.payment_collect = 'OTA' or virtual_card.present = true → OTA_COLLECT
  --   else                                                              → HOTEL_COLLECT
  insert into public.partner_payment_models
    (hotel_id, partner_id, collection_type, commission_mode, payout_mode,
     is_default, detection_rules, priority, enabled)
  values (v_hotel_id, v_expedia_id, 'OTA_COLLECT', 'PERCENTAGE', 'PRE_DEDUCTED',
          false,
          jsonb_build_array(
            jsonb_build_object('path','payment_collect','op','equals','value','OTA'),
            jsonb_build_object('path','virtual_card.present','op','equals','value', true)
          ),
          5, true)
  returning id into v_e_otacollect;

  insert into public.partner_payment_models
    (hotel_id, partner_id, collection_type, commission_mode, payout_mode,
     is_default, detection_rules, priority, enabled)
  values (v_hotel_id, v_expedia_id, 'HOTEL_COLLECT', 'PERCENTAGE', 'POST_PAID',
          true, '[]'::jsonb, 50, true)
  returning id into v_e_hcollect;

  -- ----------- commissions ----------------------------------------------
  insert into public.partner_commissions
    (hotel_id, partner_id, payment_model_id, mode, rate, currency, applies_on)
  values
    (v_hotel_id, v_direct_id, null, 'PERCENTAGE', 0.0000, 'EUR', 'NET'),
    (v_hotel_id, v_booking_id, v_b_hcollect, 'PERCENTAGE', 0.1500, 'EUR', 'NET'),
    (v_hotel_id, v_expedia_id, v_e_otacollect, 'PERCENTAGE', 0.1800, 'EUR', 'NET'),
    (v_hotel_id, v_expedia_id, v_e_hcollect,  'PERCENTAGE', 0.1500, 'EUR', 'NET');

  -- ----------- promotions ------------------------------------------------
  insert into public.partner_promotions
    (hotel_id, partner_id, code, name, discount_type, discount_value, cumulable, priority, enabled)
  values
    (v_hotel_id, v_booking_id, 'GENIUS', 'Genius Loyalty', 'PERCENTAGE', 0.1000, false, 10, true),
    (v_hotel_id, v_booking_id, 'MOBILE_RATE', 'Mobile Rate', 'PERCENTAGE', 0.1000, true, 30, true),
    (v_hotel_id, v_booking_id, 'EARLY_BOOKING', 'Réservez à l''avance', 'PERCENTAGE', 0.1500, false, 20, true),
    (v_hotel_id, v_expedia_id, 'MEMBER_RATE', 'Expedia Members', 'PERCENTAGE', 0.0800, false, 10, true),
    (v_hotel_id, v_expedia_id, 'PREFERRED_RATE', 'Preferred Hotel', 'PERCENTAGE', 0.0500, true, 50, true);

  -- ----------- scoring (default fallback for the hotel) -----------------
  insert into public.scoring_rules (hotel_id, partner_id, currency, bands, thresholds, is_default)
  values (v_hotel_id, null, null,
    jsonb_build_array(
      jsonb_build_object('max_delta_abs', 0.50, 'max_delta_pct', 0.005, 'score', 100),
      jsonb_build_object('max_delta_abs', 2.00, 'max_delta_pct', 0.010, 'score', 95),
      jsonb_build_object('max_delta_abs', 5.00, 'max_delta_pct', 0.020, 'score', 88),
      jsonb_build_object('max_delta_abs', 10.00,'max_delta_pct', 0.040, 'score', 78),
      jsonb_build_object('max_delta_abs', 25.00,'max_delta_pct', 0.080, 'score', 65),
      jsonb_build_object('max_delta_abs', 9999, 'max_delta_pct', 1.0,  'score', 40)
    ),
    jsonb_build_object('auto', 95, 'warning', 85, 'manual', 70),
    true
  );

  -- ----------- currency rates baseline ----------------------------------
  insert into public.currency_rates (hotel_id, from_currency, to_currency, rate, source)
  values
    (v_hotel_id, 'USD', 'EUR', 0.920000, 'seed'),
    (v_hotel_id, 'GBP', 'EUR', 1.170000, 'seed'),
    (v_hotel_id, 'EUR', 'EUR', 1.000000, 'seed');
end $$;
