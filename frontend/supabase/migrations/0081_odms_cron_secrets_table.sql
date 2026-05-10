-- ============================================================================
-- FLOWTYM PMS — Migration 0081 : Stockage des secrets ODMS cron en table privée
-- ----------------------------------------------------------------------------
-- Supabase managed Postgres ne permet pas d'utiliser `ALTER DATABASE … SET …`.
-- On utilise donc une table dédiée (`_odms_cron_config`) lisible uniquement
-- par les fonctions security definer (révoquée pour public/authenticated).
-- ============================================================================

create table if not exists public._odms_cron_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public._odms_cron_config enable row level security;
-- No policies = no row visible to authenticated/anon. Only service_role bypasses RLS.
revoke all on table public._odms_cron_config from public, anon, authenticated;
grant all on table public._odms_cron_config to service_role;

-- Re-create dispatch function reading config from the private table.
create or replace function public.odms_dispatch_reminders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reminder_row record;
  backend_url text;
  cron_secret text;
begin
  select value into backend_url from public._odms_cron_config where key = 'backend_url';
  select value into cron_secret from public._odms_cron_config where key = 'cron_secret';

  if backend_url is null or cron_secret is null or backend_url = '' or cron_secret = '' then
    raise notice 'odms_dispatch_reminders: backend_url/cron_secret not configured — skipped';
    return;
  end if;

  for reminder_row in
    select id
    from public.ota_dispute_reminders
    where status = 'PENDING'
      and due_at <= now()
      and (dispatch_locked_at is null or dispatch_locked_at < now() - interval '10 minutes')
    order by due_at asc
    limit 25
  loop
    update public.ota_dispute_reminders
       set dispatch_locked_at = now()
     where id = reminder_row.id;

    perform net.http_post(
      url     := backend_url || '/api/odms/send-reminder-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', cron_secret
      ),
      body    := jsonb_build_object('reminder_id', reminder_row.id)
    );
  end loop;
end;
$$;

revoke all on function public.odms_dispatch_reminders() from public, anon, authenticated;
