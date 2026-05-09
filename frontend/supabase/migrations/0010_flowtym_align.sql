-- ============================================================================
-- FLOWTYM PMS — Migration 0010 : application layer (users + RLS + audit)
-- ----------------------------------------------------------------------------
-- Aligns the existing schema with FLOWTYM operating requirements.
-- Existing PMS tables (hotels, rooms, reservations, guests, invoices, ...)
-- already use `hotel_id` as the tenant key. We add the missing pieces:
--
--   * public.users        — application profile linked to auth.users
--   * public.audit_logs   — immutable journal
--   * recreated helpers   — get_user_hotel_id / get_user_role (SET search_path)
--   * RPC                 — provision_user_for_hotel (SECURITY DEFINER)
--   * RLS policies        — every business table gets a hotel_id-scoped policy
-- ============================================================================

create extension if not exists "pgcrypto";

create schema if not exists app;

create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

-- ----------------------------------------------------------------------------
-- public.users  (application profile bound to auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  email text not null,
  full_name text not null,
  role admin_user_role not null default 'reception',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, email)
);

create index if not exists idx_users_hotel on public.users(hotel_id);
create index if not exists idx_users_auth on public.users(auth_id);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- Recreate helpers (existing ones reference public.users which now exists)
-- ----------------------------------------------------------------------------
create or replace function public.get_user_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select hotel_id from public.users where auth_id = auth.uid() limit 1;
$$;

create or replace function public.get_user_role()
returns admin_user_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select role from public.users where auth_id = auth.uid() limit 1;
$$;

revoke all on function public.get_user_hotel_id() from public;
grant execute on function public.get_user_hotel_id() to authenticated, anon;
revoke all on function public.get_user_role() from public;
grant execute on function public.get_user_role() to authenticated, anon;

-- ----------------------------------------------------------------------------
-- public.audit_logs — immutable journal
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  entity text not null,
  entity_id uuid not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_hotel_date on public.audit_logs(hotel_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity, entity_id);

create or replace function app.audit_logs_immutable()
returns trigger language plpgsql as $$
begin raise exception 'audit_logs are immutable'; end;
$$;

drop trigger if exists trg_audit_logs_no_update on public.audit_logs;
create trigger trg_audit_logs_no_update
before update on public.audit_logs for each row
execute function app.audit_logs_immutable();

drop trigger if exists trg_audit_logs_no_delete on public.audit_logs;
create trigger trg_audit_logs_no_delete
before delete on public.audit_logs for each row
execute function app.audit_logs_immutable();

alter table public.audit_logs enable row level security;
alter table public.users      enable row level security;

-- ----------------------------------------------------------------------------
-- RPC : provision a user for an existing hotel
-- ----------------------------------------------------------------------------
create or replace function public.provision_user_for_hotel(
  p_auth_user_id uuid,
  p_email text,
  p_full_name text,
  p_hotel_id uuid,
  p_role admin_user_role
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user_id uuid;
begin
  if p_auth_user_id is null then raise exception 'p_auth_user_id required'; end if;
  if p_hotel_id is null then raise exception 'p_hotel_id required'; end if;

  insert into public.users (auth_id, hotel_id, email, full_name, role)
  values (p_auth_user_id, p_hotel_id, p_email, coalesce(p_full_name, p_email), p_role)
  on conflict (auth_id) do update
    set hotel_id = excluded.hotel_id,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        role = excluded.role,
        is_active = true,
        updated_at = now()
  returning id into v_user_id;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                              || jsonb_build_object('hotel_id', p_hotel_id::text,
                                                    'role', p_role::text)
   where id = p_auth_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.provision_user_for_hotel(uuid, text, text, uuid, admin_user_role) from public;
grant execute on function public.provision_user_for_hotel(uuid, text, text, uuid, admin_user_role) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- RLS policies — dynamic: any public table with a hotel_id column
-- becomes hotel-scoped (read+write only own hotel).
-- ----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'hotel_id'
      and c.table_name not in ('hotels', 'users')   -- handled separately below
  loop
    execute format('alter table public.%I enable row level security', t.table_name);
    execute format('drop policy if exists %I_select on public.%I', t.table_name, t.table_name);
    execute format('drop policy if exists %I_modify on public.%I', t.table_name, t.table_name);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (hotel_id = public.get_user_hotel_id())',
      t.table_name, t.table_name);
    execute format(
      'create policy %I_modify on public.%I for all to authenticated using (hotel_id = public.get_user_hotel_id()) with check (hotel_id = public.get_user_hotel_id())',
      t.table_name, t.table_name);
  end loop;
end $$;

-- hotels : authenticated user can read THEIR hotel only
drop policy if exists hotels_select on public.hotels;
create policy hotels_select on public.hotels for select to authenticated
  using (id = public.get_user_hotel_id());

-- users : a user can read teammates of their hotel; only managers/direction can write
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (hotel_id = public.get_user_hotel_id());

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

drop policy if exists users_admin_manage on public.users;
create policy users_admin_manage on public.users for all to authenticated
  using (hotel_id = public.get_user_hotel_id() and public.get_user_role() = 'direction')
  with check (hotel_id = public.get_user_hotel_id() and public.get_user_role() = 'direction');

-- documents : has reservation_id link, scope through reservation's hotel
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated
  using (exists (select 1 from public.reservations r
                 where r.id = documents.reservation_id
                   and r.hotel_id = public.get_user_hotel_id()));
