-- ============================================================================
-- FLOWTYM PMS — Migration 0001 : foundations + tenants + hotels + users
-- ----------------------------------------------------------------------------
-- Objectives
--   * Strict multi-tenant model (tenant_id on every business table).
--   * Custom JWT claim `tenant_id` consumed by RLS policies.
--   * Optimistic locking via `version` columns on mutating entities.
--   * Immutability hooks for finance entities (added in later migrations).
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- helper: app.current_tenant_id() — reads from JWT claim
-- ----------------------------------------------------------------------------
create schema if not exists app;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::json ->> 'tenant_id',
      ''
    ),
    ''
  )::uuid;
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app.bump_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := coalesce(old.version, 0) + 1;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum (
    'owner', 'admin', 'manager', 'receptionist', 'housekeeping', 'accountant'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type room_status as enum (
    'clean', 'dirty', 'inspected', 'out_of_order', 'maintenance'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum (
    'draft', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- tenants
-- ----------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- hotels
-- ----------------------------------------------------------------------------
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  stars smallint not null default 3 check (stars between 0 and 5),
  address text,
  city text,
  zip text,
  country text not null default 'FR',
  phone text,
  email text,
  timezone text not null default 'Europe/Paris',
  currency text not null default 'EUR',
  locale text not null default 'fr-FR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_hotels_tenant on public.hotels(tenant_id);

drop trigger if exists trg_hotels_updated_at on public.hotels;
create trigger trg_hotels_updated_at
before update on public.hotels
for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- app_users (links Supabase auth.users to a tenant + role)
-- ----------------------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  auth_user_id uuid not null unique,
  email text not null,
  full_name text not null,
  role user_role not null default 'receptionist',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists idx_app_users_tenant on public.app_users(tenant_id);
create index if not exists idx_app_users_auth on public.app_users(auth_user_id);

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function app.set_updated_at();
