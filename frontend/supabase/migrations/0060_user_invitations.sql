-- ============================================================================
-- FLOWTYM PMS — Migration 0060 : User invitations (Direction module)
-- ----------------------------------------------------------------------------
-- Adds an `invitations` table that lets the direction add a collaborator
-- by email, set the role, and track acceptance. The actual auth user is
-- created when the invitee clicks the unique link (out of scope here —
-- bridged via Resend later). For now, invitations are persisted; on accept
-- the receptionist row in public.users gets created via the existing
-- provision_user_for_hotel RPC.
-- ============================================================================

create table if not exists public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  email text not null,
  full_name text,
  role admin_user_role not null default 'reception',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REVOKED')),
  invited_by uuid references public.users(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  token uuid not null default gen_random_uuid()
);

create index if not exists idx_user_invitations_hotel on public.user_invitations(hotel_id, status);
create unique index if not exists idx_user_invitations_token on public.user_invitations(token);

alter table public.user_invitations enable row level security;
drop policy if exists user_invitations_select on public.user_invitations;
drop policy if exists user_invitations_modify on public.user_invitations;
create policy user_invitations_select on public.user_invitations for select to authenticated
  using (hotel_id = public.get_user_hotel_id());
create policy user_invitations_modify on public.user_invitations for all to authenticated
  using (hotel_id = public.get_user_hotel_id())
  with check (hotel_id = public.get_user_hotel_id());

-- Allow direction to deactivate users (toggles is_active on public.users).
-- (Direction = role IN ('owner','direction','admin') — fall back via RLS.)
drop policy if exists users_self_select on public.users;
drop policy if exists users_hotel_select on public.users;
create policy users_hotel_select on public.users for select to authenticated
  using (hotel_id = public.get_user_hotel_id());

drop policy if exists users_hotel_update on public.users;
create policy users_hotel_update on public.users for update to authenticated
  using (hotel_id = public.get_user_hotel_id())
  with check (hotel_id = public.get_user_hotel_id());
