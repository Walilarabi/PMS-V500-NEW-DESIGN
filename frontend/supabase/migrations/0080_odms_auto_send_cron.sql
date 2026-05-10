-- ============================================================================
-- FLOWTYM PMS — Migration 0080 : ODMS auto-send relances via pg_cron
-- ----------------------------------------------------------------------------
-- Objectif : déclencher l'envoi des emails de relance ODMS dès que `due_at`
-- est dépassé. Au lieu d'embarquer une logique d'envoi côté SQL (impossible
-- car Resend nécessite un secret), on appelle l'endpoint FastAPI exposé par le
-- backend `/api/odms/send-reminder-cron` via `net.http_post` (extension `pg_net`).
--
--   * pg_cron exécute toutes les 5 minutes la fonction `odms_dispatch_reminders()`
--   * Cette fonction sélectionne les rappels PENDING dont `due_at < now()` et
--     n'ont pas déjà été tagués `dispatch_in_progress` dans les 10 dernières
--     minutes (idempotence anti-double-envoi côté DB).
--   * Pour chacun, elle pose un POST async via `pg_net` vers le backend.
--   * Le backend valide via service-role et envoie via Resend, puis met à jour
--     le rappel via PATCH classique.
--
-- Pré-requis backend :
--   * Endpoint `POST /api/odms/send-reminder-cron` qui accepte un secret
--     partagé (`X-Cron-Secret`) au lieu d'un JWT utilisateur.
--   * Variables `CRON_SECRET` et `BACKEND_URL` injectées dans Postgres via :
--       alter database postgres set "app.cron_secret"     to 'XXXX';
--       alter database postgres set "app.backend_url"     to 'https://...';
--     (les secrets ne sont pas dans le SQL versionné).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- Marker column to deduplicate dispatches on the same row.
-- ----------------------------------------------------------------------------
alter table public.ota_dispute_reminders
  add column if not exists dispatch_locked_at timestamptz;

-- ----------------------------------------------------------------------------
-- Dispatcher function — runs every 5 minutes via pg_cron.
-- ----------------------------------------------------------------------------
create or replace function public.odms_dispatch_reminders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reminder_row record;
  backend_url text := coalesce(current_setting('app.backend_url', true), '');
  cron_secret text := coalesce(current_setting('app.cron_secret', true), '');
begin
  if backend_url = '' or cron_secret = '' then
    raise notice 'odms_dispatch_reminders: app.backend_url or app.cron_secret missing — skipped';
    return;
  end if;

  for reminder_row in
    select id, dispute_id, hotel_id
    from public.ota_dispute_reminders
    where status = 'PENDING'
      and due_at <= now()
      and (dispatch_locked_at is null or dispatch_locked_at < now() - interval '10 minutes')
    order by due_at asc
    limit 25
  loop
    -- Mark as locked to prevent next cron tick from re-dispatching the same row
    update public.ota_dispute_reminders
       set dispatch_locked_at = now()
     where id = reminder_row.id;

    -- Fire async POST to the backend; pg_net returns immediately.
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

revoke all on function public.odms_dispatch_reminders() from public;

-- ----------------------------------------------------------------------------
-- Schedule: every 5 minutes
-- ----------------------------------------------------------------------------
do $$
begin
  -- unschedule existing job if present (idempotent)
  perform cron.unschedule(jobname)
  from cron.job
  where jobname = 'odms_dispatch_reminders';
exception when others then
  null;
end $$;

select cron.schedule(
  'odms_dispatch_reminders',
  '*/5 * * * *',
  $$select public.odms_dispatch_reminders();$$
);
