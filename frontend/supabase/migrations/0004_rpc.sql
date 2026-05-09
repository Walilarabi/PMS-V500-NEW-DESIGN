-- ============================================================================
-- FLOWTYM PMS — Migration 0004 : RPC provisioning + JWT claims
-- ----------------------------------------------------------------------------
-- The signup flow calls `provision_tenant` (SECURITY DEFINER) so that:
--   1. A new tenant + hotel are created.
--   2. The signing-in auth user is linked to it via `app_users`.
--   3. `auth.users.raw_app_meta_data.tenant_id` is set, so the next JWT
--      issued by Supabase carries it as a custom claim consumed by RLS.
--
-- IMPORTANT: any change to user-tenant linkage MUST go through these RPCs;
-- direct INSERTs into app_users from clients are blocked by RLS.
-- ============================================================================

create or replace function public.provision_tenant(
  p_auth_user_id uuid,
  p_email text,
  p_full_name text,
  p_tenant_slug text,
  p_hotel_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_tenant_id uuid;
  v_hotel_id uuid;
begin
  if p_auth_user_id is null then raise exception 'p_auth_user_id required'; end if;

  -- Idempotent: if user is already linked, return existing tenant
  select tenant_id into v_tenant_id from public.app_users where auth_user_id = p_auth_user_id;
  if v_tenant_id is not null then
    return v_tenant_id;
  end if;

  insert into public.tenants (name, slug)
  values (p_hotel_name, p_tenant_slug)
  returning id into v_tenant_id;

  insert into public.hotels (tenant_id, name, slug)
  values (v_tenant_id, p_hotel_name, p_tenant_slug)
  returning id into v_hotel_id;

  insert into public.app_users (tenant_id, auth_user_id, email, full_name, role)
  values (v_tenant_id, p_auth_user_id, p_email, p_full_name, 'owner');

  -- Inject tenant_id into JWT app_metadata so RLS can read it
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                              || jsonb_build_object('tenant_id', v_tenant_id::text,
                                                    'role', 'owner')
   where id = p_auth_user_id;

  return v_tenant_id;
end;
$$;

revoke all on function public.provision_tenant(uuid, text, text, text, text) from public;
grant execute on function public.provision_tenant(uuid, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- attach_existing_user_to_tenant : invite flow (admin only)
-- ----------------------------------------------------------------------------
create or replace function public.attach_user_to_tenant(
  p_auth_user_id uuid,
  p_email text,
  p_full_name text,
  p_role user_role
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_tenant_id uuid := app.current_tenant_id();
  v_caller_role user_role;
begin
  if v_tenant_id is null then raise exception 'no current tenant'; end if;

  select role into v_caller_role from public.app_users
    where auth_user_id = auth.uid() and tenant_id = v_tenant_id;

  if v_caller_role not in ('owner', 'admin') then
    raise exception 'forbidden: only owner/admin can invite users';
  end if;

  insert into public.app_users (tenant_id, auth_user_id, email, full_name, role)
  values (v_tenant_id, p_auth_user_id, p_email, p_full_name, p_role)
  on conflict (auth_user_id) do nothing;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                              || jsonb_build_object('tenant_id', v_tenant_id::text,
                                                    'role', p_role::text)
   where id = p_auth_user_id;
end;
$$;

revoke all on function public.attach_user_to_tenant(uuid, text, text, user_role) from public;
grant execute on function public.attach_user_to_tenant(uuid, text, text, user_role) to authenticated;
