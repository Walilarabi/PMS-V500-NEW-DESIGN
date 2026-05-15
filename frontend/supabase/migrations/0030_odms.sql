-- ============================================================================
-- FLOWTYM PMS — Migration 0030 : OTA Dispute Management System (ODMS)
-- ----------------------------------------------------------------------------
-- 6 tables + partners contact extensions + virtual quarantine rooms.
-- All tables hotel-scoped via RLS, message/status history is immutable.
-- ============================================================================

create extension if not exists "pgcrypto";

-- enums
do $$ begin
  create type ota_dispute_status as enum (
    'DRAFT', 'SENT', 'ACKNOWLEDGED', 'IN_REVIEW',
    'CORRECTED', 'REJECTED', 'CLOSED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_dispute_origin as enum ('AUTO', 'MANUAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_dispute_message_kind as enum (
    'OUTBOUND_EMAIL', 'INBOUND_EMAIL', 'INTERNAL_NOTE', 'SYSTEM_EVENT', 'REMINDER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_participant_role as enum (
    'OTA_SUPPORT', 'OTA_ACCOUNTING', 'OTA_ACCOUNT_MANAGER',
    'HOTEL_RECEPTION_HEAD', 'HOTEL_OPERATIONS_DIRECTOR',
    'HOTEL_REVENUE_MANAGER', 'HOTEL_ACCOUNTING'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- partners contact extensions
-- ----------------------------------------------------------------------------
alter table public.partners
  add column if not exists support_email text,
  add column if not exists accounting_email text,
  add column if not exists account_manager_email text,
  add column if not exists support_phone text,
  add column if not exists sla_hours integer default 72,
  add column if not exists communication_language text default 'fr-FR';

-- ----------------------------------------------------------------------------
-- quarantine_virtual_rooms : technical fictitious rooms used to hold disputed
-- reservations without polluting the operational planning.
-- ----------------------------------------------------------------------------
create table if not exists public.quarantine_virtual_rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  label text not null,
  purpose text not null default 'OTA_DISPUTE',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hotel_id, code)
);

create index if not exists idx_qvr_hotel on public.quarantine_virtual_rooms(hotel_id);

-- ----------------------------------------------------------------------------
-- ota_disputes
-- ----------------------------------------------------------------------------
create table if not exists public.ota_disputes (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  validation_id uuid references public.reservation_validations(id) on delete set null,
  reference text not null,                                  -- DSP-2026-000123
  origin ota_dispute_origin not null default 'MANUAL',
  status ota_dispute_status not null default 'DRAFT',
  subject text not null,
  description text,
  expected_amount numeric(14,2),
  received_amount numeric(14,2),
  claimed_amount numeric(14,2),
  delta_amount numeric(14,2),
  currency text not null default 'EUR',
  anomaly_codes text[] not null default array[]::text[],
  attachments_summary jsonb not null default '[]'::jsonb,   -- preview of generated attachments
  computed_email jsonb,                                     -- last generated email payload
  virtual_room_id uuid references public.quarantine_virtual_rooms(id),
  due_at timestamptz,                                       -- next reminder due date
  reminder_step integer not null default 0,                 -- 0=initial, 1=J+2, 2=J+5, 3=J+10
  resolution text,
  recovered_amount numeric(14,2),
  closed_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, reference)
);

create index if not exists idx_disputes_hotel on public.ota_disputes(hotel_id, status);
create index if not exists idx_disputes_partner on public.ota_disputes(hotel_id, partner_id);
create index if not exists idx_disputes_due on public.ota_disputes(due_at) where status not in ('CLOSED','CORRECTED','REJECTED');

drop trigger if exists trg_disputes_updated_at on public.ota_disputes;
create trigger trg_disputes_updated_at before update on public.ota_disputes
for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- ota_dispute_messages  (immutable except status of message itself)
-- ----------------------------------------------------------------------------
create table if not exists public.ota_dispute_messages (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  dispute_id uuid not null references public.ota_disputes(id) on delete cascade,
  kind ota_dispute_message_kind not null,
  author_user_id uuid references public.users(id),
  from_address text,
  to_addresses text[] not null default array[]::text[],
  cc_addresses text[] not null default array[]::text[],
  subject text,
  body_html text,
  body_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispute_messages_dispute on public.ota_dispute_messages(dispute_id, created_at);

create or replace function app.dispute_messages_immutable() returns trigger language plpgsql as $$
begin raise exception 'ota_dispute_messages are immutable'; end;
$$;

drop trigger if exists trg_dispute_messages_no_update on public.ota_dispute_messages;
create trigger trg_dispute_messages_no_update before update on public.ota_dispute_messages
for each row execute function app.dispute_messages_immutable();

drop trigger if exists trg_dispute_messages_no_delete on public.ota_dispute_messages;
create trigger trg_dispute_messages_no_delete before delete on public.ota_dispute_messages
for each row execute function app.dispute_messages_immutable();

-- ----------------------------------------------------------------------------
-- ota_dispute_attachments
-- ----------------------------------------------------------------------------
create table if not exists public.ota_dispute_attachments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  dispute_id uuid not null references public.ota_disputes(id) on delete cascade,
  message_id uuid references public.ota_dispute_messages(id) on delete set null,
  kind text not null,                       -- PDF_AUDIT, PMS_RATE, OTA_PAYLOAD, COMMISSION, ...
  filename text not null,
  mime_type text not null default 'application/pdf',
  size_bytes integer,
  storage_path text,
  inline_payload jsonb,                     -- when content is inlined (small JSON)
  generated_at timestamptz not null default now()
);

create index if not exists idx_dispute_attachments_dispute on public.ota_dispute_attachments(dispute_id);

-- ----------------------------------------------------------------------------
-- ota_dispute_status_history (immutable)
-- ----------------------------------------------------------------------------
create table if not exists public.ota_dispute_status_history (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  dispute_id uuid not null references public.ota_disputes(id) on delete cascade,
  from_status ota_dispute_status,
  to_status ota_dispute_status not null,
  reason text,
  by_user_id uuid references public.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispute_status_history_dispute on public.ota_dispute_status_history(dispute_id, created_at);

drop trigger if exists trg_dsh_no_update on public.ota_dispute_status_history;
create trigger trg_dsh_no_update before update on public.ota_dispute_status_history
for each row execute function app.dispute_messages_immutable();

drop trigger if exists trg_dsh_no_delete on public.ota_dispute_status_history;
create trigger trg_dsh_no_delete before delete on public.ota_dispute_status_history
for each row execute function app.dispute_messages_immutable();

-- ----------------------------------------------------------------------------
-- ota_dispute_participants
-- ----------------------------------------------------------------------------
create table if not exists public.ota_dispute_participants (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  dispute_id uuid not null references public.ota_disputes(id) on delete cascade,
  role ota_participant_role not null,
  display_name text not null,
  email text not null,
  user_id uuid references public.users(id),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispute_participants_dispute on public.ota_dispute_participants(dispute_id);

-- ----------------------------------------------------------------------------
-- partner_reliability_view (rolling 30d)  — VIEW, no RLS, but inherits scope
-- via reservation_validations RLS when queried as authenticated user.
-- ----------------------------------------------------------------------------
create or replace view public.partner_reliability_view as
select
  v.hotel_id,
  v.partner_id,
  count(*)::int as runs,
  round(avg(v.score)::numeric, 1) as avg_score_30d,
  sum(case when v.decision = 'AUTO_INTEGRATE' then 1 else 0 end)::int as auto_count,
  sum(case when v.decision = 'WARNING' then 1 else 0 end)::int as warning_count,
  sum(case when v.decision = 'MANUAL_REVIEW' then 1 else 0 end)::int as manual_count,
  sum(case when v.decision = 'QUARANTINE' then 1 else 0 end)::int as quarantine_count,
  sum(abs(coalesce(v.delta_amount, 0)))::numeric(14,2) as cumulative_delta_30d,
  max(v.created_at) as last_run_at
from public.reservation_validations v
where v.created_at >= now() - interval '30 days'
group by v.hotel_id, v.partner_id;

-- RLS — apply hotel_id isolation to ODMS tables
do $$
declare
  t text;
  odms_tables text[] := array[
    'quarantine_virtual_rooms', 'ota_disputes', 'ota_dispute_messages',
    'ota_dispute_attachments', 'ota_dispute_status_history', 'ota_dispute_participants'
  ];
begin
  foreach t in array odms_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_modify on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (hotel_id = public.get_user_hotel_id())',
      t, t);
    execute format(
      'create policy %I_modify on public.%I for all to authenticated using (hotel_id = public.get_user_hotel_id()) with check (hotel_id = public.get_user_hotel_id())',
      t, t);
  end loop;
end $$;

-- realtime publication
do $$
declare
  t text;
  rt_tables text[] := array['ota_disputes', 'ota_dispute_messages', 'ota_dispute_status_history'];
begin
  for t in select unnest(rt_tables) loop
    if to_regclass('public.'||t) is not null then
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- seed : default virtual quarantine room + partner contacts for Mas Provencal
-- ----------------------------------------------------------------------------
do $$
declare
  v_hotel constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.quarantine_virtual_rooms (hotel_id, code, label, purpose, enabled)
  values
    (v_hotel, 'QUARANTINE-OTA', 'Virtual room — litige OTA', 'OTA_DISPUTE', true),
    (v_hotel, 'HOLD-VALIDATION', 'Virtual room — en attente validation', 'HOLD_VALIDATION', true)
  on conflict (hotel_id, code) do nothing;

  update public.partners
     set support_email = 'support@booking.com',
         accounting_email = 'accounting@booking.com',
         account_manager_email = 'partner@booking.com',
         support_phone = '+44 203 0840000',
         sla_hours = 48,
         communication_language = 'fr-FR'
   where hotel_id = v_hotel and code = 'BOOKING';

  update public.partners
     set support_email = 'lodging-partner-support@expedia.com',
         accounting_email = 'lodging-payments@expedia.com',
         account_manager_email = 'market.manager@expedia.com',
         support_phone = '+1 425 6791000',
         sla_hours = 72,
         communication_language = 'fr-FR'
   where hotel_id = v_hotel and code = 'EXPEDIA';
end $$;
