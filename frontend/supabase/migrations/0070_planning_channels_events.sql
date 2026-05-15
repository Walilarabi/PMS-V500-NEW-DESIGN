-- ============================================================================
-- FLOWTYM PMS — Migration 0070 : Planning channels & events
-- ----------------------------------------------------------------------------
-- Two hotel-scoped tables to power the Planning module's channel filter and
-- event overlays (legacy data was held in `configStore` Zustand persistence —
-- this migrates it to Supabase with proper multi-tenant RLS).
--
--   * `planning_channels` — distribution channels per hotel (Booking, Direct…)
--   * `planning_events`   — calendar events that influence demand/yield
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- planning_channels
-- ----------------------------------------------------------------------------
create table if not exists public.planning_channels (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,                    -- BOOKING, EXPEDIA, AIRBNB, DIRECT, WALKIN, PHONE…
  name text not null,                    -- "Booking.com", "Direct"…
  color text not null default '#6366F1', -- hex color used for chips/dots
  position integer not null default 0,   -- ordering in selectors
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, code)
);

create index if not exists idx_planning_channels_hotel
  on public.planning_channels(hotel_id, position, code);

alter table public.planning_channels enable row level security;
drop policy if exists planning_channels_select on public.planning_channels;
drop policy if exists planning_channels_modify on public.planning_channels;
create policy planning_channels_select on public.planning_channels
  for select to authenticated
  using (hotel_id = public.get_user_hotel_id());
create policy planning_channels_modify on public.planning_channels
  for all to authenticated
  using (hotel_id = public.get_user_hotel_id())
  with check (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- planning_events
-- ----------------------------------------------------------------------------
do $$ begin
  create type planning_event_impact as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

create table if not exists public.planning_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  impact planning_event_impact not null default 'medium',
  description text,
  source text,                           -- "Externe", "OTA", "Manuel"…
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists idx_planning_events_hotel_dates
  on public.planning_events(hotel_id, start_date, end_date);

alter table public.planning_events enable row level security;
drop policy if exists planning_events_select on public.planning_events;
drop policy if exists planning_events_modify on public.planning_events;
create policy planning_events_select on public.planning_events
  for select to authenticated
  using (hotel_id = public.get_user_hotel_id());
create policy planning_events_modify on public.planning_events
  for all to authenticated
  using (hotel_id = public.get_user_hotel_id())
  with check (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- updated_at triggers (idempotent)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_planning_channels_updated_at on public.planning_channels;
create trigger trg_planning_channels_updated_at
  before update on public.planning_channels
  for each row execute function public.set_updated_at();

drop trigger if exists trg_planning_events_updated_at on public.planning_events;
create trigger trg_planning_events_updated_at
  before update on public.planning_events
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Seed default channels per hotel (idempotent: hotel_id+code unique)
-- ----------------------------------------------------------------------------
insert into public.planning_channels (hotel_id, code, name, color, position)
select h.id, v.code, v.name, v.color, v.position
from public.hotels h
cross join (values
  ('BOOKING', 'Booking.com', '#003580', 1),
  ('EXPEDIA', 'Expedia',     '#FFC72C', 2),
  ('AIRBNB',  'Airbnb',      '#FF5A5F', 3),
  ('DIRECT',  'Direct',      '#10B981', 4),
  ('WALKIN',  'Walk-in',     '#8B5CF6', 5),
  ('PHONE',   'Téléphone',   '#0EA5E9', 6)
) as v(code, name, color, position)
on conflict (hotel_id, code) do nothing;

-- ----------------------------------------------------------------------------
-- Seed two demo events for "Mas Provencal Aix" (idempotent guard via NOT EXISTS)
-- ----------------------------------------------------------------------------
insert into public.planning_events (hotel_id, name, start_date, end_date, impact, description, source)
select '00000000-0000-0000-0000-000000000001'::uuid,
       'Salon International du Tourisme', '2026-05-15', '2026-05-18',
       'critical', 'Grand pic d''activité', 'Externe'
where exists (select 1 from public.hotels where id = '00000000-0000-0000-0000-000000000001'::uuid)
  and not exists (
    select 1 from public.planning_events
    where hotel_id = '00000000-0000-0000-0000-000000000001'::uuid
      and name = 'Salon International du Tourisme'
      and start_date = '2026-05-15'
  );

insert into public.planning_events (hotel_id, name, start_date, end_date, impact, description, source)
select '00000000-0000-0000-0000-000000000001'::uuid,
       'Concert Stade de France', '2026-05-20', '2026-05-20',
       'high', 'Affluence élevée', 'OTA'
where exists (select 1 from public.hotels where id = '00000000-0000-0000-0000-000000000001'::uuid)
  and not exists (
    select 1 from public.planning_events
    where hotel_id = '00000000-0000-0000-0000-000000000001'::uuid
      and name = 'Concert Stade de France'
      and start_date = '2026-05-20'
  );
