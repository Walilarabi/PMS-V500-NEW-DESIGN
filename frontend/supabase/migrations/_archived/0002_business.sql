-- ============================================================================
-- FLOWTYM PMS — Migration 0002 : rooms + room_types + guests + reservations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- room_types
-- ----------------------------------------------------------------------------
create table if not exists public.room_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  label text not null,
  base_capacity smallint not null default 2,
  max_capacity smallint not null default 2,
  base_price_cents integer not null default 0,
  created_at timestamptz not null default now(),
  unique (hotel_id, code)
);

create index if not exists idx_room_types_tenant on public.room_types(tenant_id);
create index if not exists idx_room_types_hotel on public.room_types(hotel_id);

-- ----------------------------------------------------------------------------
-- rooms
-- ----------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_type_id uuid references public.room_types(id) on delete set null,
  number text not null,
  floor text,
  status room_status not null default 'clean',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, number)
);

create index if not exists idx_rooms_tenant on public.rooms(tenant_id);
create index if not exists idx_rooms_hotel on public.rooms(hotel_id);
create index if not exists idx_rooms_status on public.rooms(hotel_id, status) where is_active;

drop trigger if exists trg_rooms_updated_at on public.rooms;
create trigger trg_rooms_updated_at
before update on public.rooms
for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- guests
-- ----------------------------------------------------------------------------
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  nationality text,
  segment text,
  loyalty_tier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guests_tenant on public.guests(tenant_id);
create index if not exists idx_guests_email on public.guests(tenant_id, lower(email));

drop trigger if exists trg_guests_updated_at on public.guests;
create trigger trg_guests_updated_at
before update on public.guests
for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- reservations  (bookings)
-- ----------------------------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  reference text not null,
  guest_id uuid references public.guests(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  status reservation_status not null default 'confirmed',
  payment_status payment_status not null default 'unpaid',
  check_in date not null,
  check_out date not null,
  adults smallint not null default 1 check (adults >= 0),
  children smallint not null default 0 check (children >= 0),
  channel text not null default 'direct',
  rate_plan text,
  total_cents integer not null default 0 check (total_cents >= 0),
  currency text not null default 'EUR',
  notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, reference),
  check (check_out > check_in)
);

create index if not exists idx_reservations_tenant on public.reservations(tenant_id);
create index if not exists idx_reservations_hotel_dates
  on public.reservations(hotel_id, check_in, check_out);
create index if not exists idx_reservations_status
  on public.reservations(hotel_id, status) where status not in ('cancelled', 'no_show');
create index if not exists idx_reservations_guest on public.reservations(guest_id);
create index if not exists idx_reservations_room on public.reservations(room_id);

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row execute function app.set_updated_at();

drop trigger if exists trg_reservations_version on public.reservations;
create trigger trg_reservations_version
before update on public.reservations
for each row execute function app.bump_version();

-- ----------------------------------------------------------------------------
-- audit_logs  (immutable)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_tenant on public.audit_logs(tenant_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity, entity_id);

create or replace function app.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs are immutable';
end;
$$;

drop trigger if exists trg_audit_logs_no_update on public.audit_logs;
create trigger trg_audit_logs_no_update
before update on public.audit_logs
for each row execute function app.audit_logs_immutable();

drop trigger if exists trg_audit_logs_no_delete on public.audit_logs;
create trigger trg_audit_logs_no_delete
before delete on public.audit_logs
for each row execute function app.audit_logs_immutable();
