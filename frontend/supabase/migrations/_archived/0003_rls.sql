-- ============================================================================
-- FLOWTYM PMS — Migration 0003 : Row Level Security policies
-- ----------------------------------------------------------------------------
-- Strict multi-tenant isolation. Every authenticated request MUST carry a
-- `tenant_id` claim in its JWT. The claim is set by the `provision_tenant`
-- and `attach_user_to_tenant` RPCs (added in 0004) via `auth.users.raw_app_meta_data`.
-- ============================================================================

-- Enable RLS on all business tables
alter table public.tenants     enable row level security;
alter table public.hotels      enable row level security;
alter table public.app_users   enable row level security;
alter table public.room_types  enable row level security;
alter table public.rooms       enable row level security;
alter table public.guests      enable row level security;
alter table public.reservations enable row level security;
alter table public.audit_logs   enable row level security;

-- ----------------------------------------------------------------------------
-- tenants : a user can only see their own tenant
-- ----------------------------------------------------------------------------
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select to authenticated
  using (id = app.current_tenant_id());

-- No insert/update/delete from clients. Only service_role + RPC.
drop policy if exists tenants_no_write on public.tenants;
create policy tenants_no_write on public.tenants
  for all to authenticated
  using (false) with check (false);

-- ----------------------------------------------------------------------------
-- generic helper: build identical 4 policies for a tenant-scoped table
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'hotels', 'app_users', 'room_types', 'rooms', 'guests', 'reservations'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('drop policy if exists %I_tenant_isolation on public.%I', t, t);
    execute format(
      'create policy %I_tenant_isolation on public.%I
         for all to authenticated
         using (tenant_id = app.current_tenant_id())
         with check (tenant_id = app.current_tenant_id())',
      t, t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- audit_logs : read-only for authenticated, scoped by tenant
-- ----------------------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id());
