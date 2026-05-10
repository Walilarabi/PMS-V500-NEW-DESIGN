-- ============================================================================
-- FLOWTYM PMS — Migration 0020 : Revenue Integrity Engine (RIE) foundations
-- ----------------------------------------------------------------------------
-- 10 tables, hotel-scoped RLS, immutable validation/audit trails.
--   * Configuration : partners, partner_payment_models, partner_commissions,
--                     partner_promotions, scoring_rules, currency_rates
--   * Runtime       : reservation_validations, anomaly_reports,
--                     payout_calculations, quarantine_reservations
-- All numeric monetary values stored in numeric(14,2) with explicit currency.
-- All configuration tables have a `version` integer + `effective_from/to` to
-- support full historisation without physical deletes.
-- ============================================================================

create extension if not exists "pgcrypto";
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type rie_collection_type as enum (
    'HOTEL_COLLECT', 'OTA_COLLECT', 'VIRTUAL_CARD', 'HYBRID_COLLECT', 'PAY_AT_PROPERTY'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type rie_commission_mode as enum ('PERCENTAGE', 'FIXED', 'HYBRID', 'VARIABLE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rie_payout_mode as enum ('POST_PAID', 'PRE_DEDUCTED', 'IMMEDIATE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rie_anomaly_code as enum (
    'PRICE_MISMATCH', 'COMMISSION_ERROR', 'TAX_ERROR', 'PROMOTION_ERROR',
    'PAYOUT_ERROR', 'CURRENCY_ERROR', 'ROUNDING_ERROR', 'MAPPING_ERROR',
    'COLLECTION_MODEL_ERROR'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type rie_severity as enum ('INFO', 'WARNING', 'CRITICAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rie_decision as enum (
    'AUTO_INTEGRATE', 'WARNING', 'MANUAL_REVIEW', 'QUARANTINE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type rie_quarantine_status as enum ('OPEN', 'APPROVED', 'REJECTED', 'EXPIRED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- partners (one row per OTA / direct channel for a given hotel)
-- ---------------------------------------------------------------------------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,                     -- BOOKING, EXPEDIA, DIRECT, AIRBNB...
  name text not null,
  api_provider text,                       -- channel manager / direct API
  country text,
  timezone text default 'Europe/Paris',
  currency text not null default 'EUR',
  status text not null default 'active',   -- active | paused | retired
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, code)
);

create index if not exists idx_partners_hotel on public.partners(hotel_id);

drop trigger if exists trg_partners_updated_at on public.partners;
create trigger trg_partners_updated_at before update on public.partners
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- partner_payment_models
-- Each partner can support multiple collection models. Detection rules are
-- a JSON array of predicates evaluated against the OTA payload.
-- ---------------------------------------------------------------------------
create table if not exists public.partner_payment_models (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  collection_type rie_collection_type not null,
  commission_mode rie_commission_mode not null default 'PERCENTAGE',
  payout_mode rie_payout_mode not null default 'POST_PAID',
  is_default boolean not null default false,
  detection_rules jsonb not null default '[]'::jsonb,   -- [{path, op, value}]
  priority integer not null default 100,                -- lower = higher prio
  enabled boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ppm_partner on public.partner_payment_models(partner_id);
create index if not exists idx_ppm_hotel on public.partner_payment_models(hotel_id);

drop trigger if exists trg_ppm_updated_at on public.partner_payment_models;
create trigger trg_ppm_updated_at before update on public.partner_payment_models
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- partner_commissions  (versioned)
-- ---------------------------------------------------------------------------
create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  payment_model_id uuid references public.partner_payment_models(id) on delete set null,
  mode rie_commission_mode not null default 'PERCENTAGE',
  rate numeric(7,4),                  -- percentage when mode in (PERCENTAGE,HYBRID)
  fixed_amount numeric(14,2),         -- fixed cents when mode in (FIXED,HYBRID)
  currency text not null default 'EUR',
  applies_on text not null default 'NET',   -- NET (excl. VAT) | GROSS (incl.)
  effective_from date not null default current_date,
  effective_to date,
  version integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_commissions_partner on public.partner_commissions(partner_id);

drop trigger if exists trg_pc_updated_at on public.partner_commissions;
create trigger trg_pc_updated_at before update on public.partner_commissions
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- partner_promotions  (versioned, prioritised)
-- ---------------------------------------------------------------------------
create table if not exists public.partner_promotions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  code text not null,                              -- MOBILE_RATE, GENIUS, EARLY_BOOKING ...
  name text not null,
  discount_type text not null default 'PERCENTAGE',-- PERCENTAGE | FIXED
  discount_value numeric(14,4) not null,           -- 0.10 = 10% (PERCENTAGE) or amount
  cumulable boolean not null default false,
  priority integer not null default 100,
  conditions jsonb not null default '{}'::jsonb,   -- {min_nights, channels, geos, room_types}
  enabled boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_promotions_partner on public.partner_promotions(partner_id);
create index if not exists idx_promotions_code on public.partner_promotions(hotel_id, code);

drop trigger if exists trg_promotions_updated_at on public.partner_promotions;
create trigger trg_promotions_updated_at before update on public.partner_promotions
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- scoring_rules   (per hotel / partner / currency overrides)
-- bands : [{ max_delta, score }] sorted ascending; bands JSON is single-source.
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  currency text,                     -- null = applies to all currencies
  bands jsonb not null,              -- [{ max_delta_abs, max_delta_pct, score }]
  thresholds jsonb not null default jsonb_build_object(
    'auto', 95, 'warning', 85, 'manual', 70
  ),
  is_default boolean not null default false,
  enabled boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scoring_partner on public.scoring_rules(hotel_id, partner_id);

drop trigger if exists trg_scoring_updated_at on public.scoring_rules;
create trigger trg_scoring_updated_at before update on public.scoring_rules
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- currency_rates  (historised FX, stored to 6 decimals)
-- ---------------------------------------------------------------------------
create table if not exists public.currency_rates (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete cascade,
  from_currency text not null,
  to_currency text not null,
  rate numeric(18,6) not null,
  observed_at timestamptz not null default now(),
  source text default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists idx_fx_pair on public.currency_rates(from_currency, to_currency, observed_at desc);

-- ---------------------------------------------------------------------------
-- reservation_validations  (immutable runtime audit trail)
-- One row per validation run for a reservation. Replays stored as new rows.
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_validations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  payment_model_id uuid references public.partner_payment_models(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  computation jsonb not null default '{}'::jsonb,    -- step-by-step breakdown
  rules_used jsonb not null default '[]'::jsonb,
  expected_amount numeric(14,2),
  received_amount numeric(14,2),
  delta_amount numeric(14,2),
  delta_pct numeric(7,4),
  currency text not null default 'EUR',
  score integer not null default 0,
  decision rie_decision not null default 'MANUAL_REVIEW',
  collection_type rie_collection_type,
  correlation_id uuid,
  validated_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_rv_hotel_date on public.reservation_validations(hotel_id, created_at desc);
create index if not exists idx_rv_reservation on public.reservation_validations(reservation_id);
create index if not exists idx_rv_decision on public.reservation_validations(decision);

create or replace function app.rv_immutable() returns trigger language plpgsql as $$
begin raise exception 'reservation_validations are immutable'; end;
$$;

drop trigger if exists trg_rv_no_update on public.reservation_validations;
create trigger trg_rv_no_update before update on public.reservation_validations
for each row execute function app.rv_immutable();

drop trigger if exists trg_rv_no_delete on public.reservation_validations;
create trigger trg_rv_no_delete before delete on public.reservation_validations
for each row execute function app.rv_immutable();

-- ---------------------------------------------------------------------------
-- anomaly_reports  (one or more rows per validation; immutable too)
-- ---------------------------------------------------------------------------
create table if not exists public.anomaly_reports (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  validation_id uuid not null references public.reservation_validations(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  code rie_anomaly_code not null,
  severity rie_severity not null default 'WARNING',
  message text not null,
  delta_amount numeric(14,2),
  delta_pct numeric(7,4),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_anomaly_hotel_date on public.anomaly_reports(hotel_id, created_at desc);
create index if not exists idx_anomaly_partner on public.anomaly_reports(hotel_id, partner_id);
create index if not exists idx_anomaly_code on public.anomaly_reports(hotel_id, code);

drop trigger if exists trg_anomaly_no_update on public.anomaly_reports;
create trigger trg_anomaly_no_update before update on public.anomaly_reports
for each row execute function app.rv_immutable();

-- ---------------------------------------------------------------------------
-- payout_calculations (per validation, snapshot of computed amounts)
-- ---------------------------------------------------------------------------
create table if not exists public.payout_calculations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  validation_id uuid not null references public.reservation_validations(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  base_amount numeric(14,2) not null default 0,
  promotion_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  fx_adjustment numeric(14,2) not null default 0,
  rounding_amount numeric(14,2) not null default 0,
  expected_payout numeric(14,2) not null default 0,
  received_payout numeric(14,2),
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create index if not exists idx_payout_hotel on public.payout_calculations(hotel_id, created_at desc);

-- ---------------------------------------------------------------------------
-- quarantine_reservations
-- ---------------------------------------------------------------------------
create table if not exists public.quarantine_reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  validation_id uuid references public.reservation_validations(id) on delete set null,
  status rie_quarantine_status not null default 'OPEN',
  reason text not null,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quarantine_hotel_status on public.quarantine_reservations(hotel_id, status);

drop trigger if exists trg_quarantine_updated_at on public.quarantine_reservations;
create trigger trg_quarantine_updated_at before update on public.quarantine_reservations
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — apply hotel_id isolation to every new table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  rie_tables text[] := array[
    'partners', 'partner_payment_models', 'partner_commissions',
    'partner_promotions', 'scoring_rules', 'currency_rates',
    'reservation_validations', 'anomaly_reports', 'payout_calculations',
    'quarantine_reservations'
  ];
begin
  foreach t in array rie_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_modify on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (hotel_id = public.get_user_hotel_id() or hotel_id is null)',
      t, t);
    execute format(
      'create policy %I_modify on public.%I for all to authenticated using (hotel_id = public.get_user_hotel_id() or hotel_id is null) with check (hotel_id = public.get_user_hotel_id() or hotel_id is null)',
      t, t);
  end loop;
end $$;

-- Add the validation/anomaly/payout tables to the realtime publication
do $$
declare
  t text;
  realtime_extra text[] := array[
    'reservation_validations', 'anomaly_reports', 'quarantine_reservations'
  ];
begin
  for t in select unnest(realtime_extra) loop
    if to_regclass('public.'||t) is not null then
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end if;
  end loop;
end $$;
