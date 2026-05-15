-- ============================================================================
-- FLOWTYM PMS — Migration 0100 : Mode brouillon (auto_send_paused) pour disputes
-- ----------------------------------------------------------------------------
-- Permet de suspendre l'envoi automatique des relances ODMS au niveau d'une
-- dispute. Tant que `auto_send_paused = true`, la fonction `odms_dispatch_reminders`
-- ignore tous les rappels rattachés à cette dispute. L'envoi manuel via le
-- bouton "Envoyer email" du Dispute Center reste possible.
-- ============================================================================

alter table public.ota_disputes
  add column if not exists auto_send_paused boolean not null default false;

comment on column public.ota_disputes.auto_send_paused is
  'Si true, le cron pg_cron ne dispatch pas les relances de cette dispute (envoi manuel uniquement).';

-- Re-create the dispatcher so it joins on the parent dispute and respects the pause flag.
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
    select r.id
    from public.ota_dispute_reminders r
    join public.ota_disputes d on d.id = r.dispute_id
    where r.status = 'PENDING'
      and r.due_at <= now()
      and (r.dispatch_locked_at is null or r.dispatch_locked_at < now() - interval '10 minutes')
      and coalesce(d.auto_send_paused, false) = false
    order by r.due_at asc
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
