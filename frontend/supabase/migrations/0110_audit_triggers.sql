-- ============================================================================
-- FLOWTYM PMS — Migration 0110 : Audit log triggers (immutable journal)
-- ----------------------------------------------------------------------------
-- Auto-écrit dans `public.audit_logs` à chaque INSERT/UPDATE/DELETE des tables
-- métier sensibles. Le journal est immutable (triggers BEFORE UPDATE/DELETE
-- déjà en place sur audit_logs).
--
-- entity   : nom logique (snake_case, plural ok) — 'reservation', 'ota_dispute', 'bank_statement', …
-- action   : 'created' | 'updated' | 'deleted'
-- payload  : { before?: row, after?: row, diff?: { col: [old, new] } }
-- actor    : auth.uid() lookup → public.users.id (NULL si action serveur/cron)
-- ============================================================================

create or replace function public.audit_resolve_actor()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid;
  pub_id uuid;
begin
  begin
    uid := auth.uid();
  exception when others then
    return null;
  end;
  if uid is null then return null; end if;
  select id into pub_id from public.users where auth_id = uid limit 1;
  return pub_id;
end;
$$;

-- Compute a JSONB diff between two row representations (only changed keys, omitting noisy fields).
create or replace function public.audit_jsonb_diff(before_row jsonb, after_row jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  k text;
  acc jsonb := '{}'::jsonb;
  ignored text[] := array['updated_at', 'created_at', 'version', 'dispatch_locked_at'];
begin
  if before_row is null or after_row is null then return null; end if;
  for k in select jsonb_object_keys(after_row) loop
    if k = any(ignored) then continue; end if;
    if (before_row->k) is distinct from (after_row->k) then
      acc := acc || jsonb_build_object(k, jsonb_build_array(before_row->k, after_row->k));
    end if;
  end loop;
  return acc;
end;
$$;

-- Generic trigger function. Reads TG_TABLE_NAME and turns it into an `entity` slug.
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity text := tg_argv[0];                      -- e.g. 'reservation'
  v_action text;
  v_entity_id uuid;
  v_hotel_id uuid;
  v_payload jsonb;
  v_before jsonb;
  v_after jsonb;
begin
  if (tg_op = 'INSERT') then
    v_action := 'created';
    v_after := to_jsonb(new);
    v_entity_id := (new).id;
    v_hotel_id := coalesce(((new).hotel_id)::uuid, null);
    v_payload := jsonb_build_object('after', v_after);
  elsif (tg_op = 'UPDATE') then
    v_action := 'updated';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := (new).id;
    v_hotel_id := coalesce(((new).hotel_id)::uuid, null);
    -- Skip if no significant change
    if public.audit_jsonb_diff(v_before, v_after) = '{}'::jsonb then
      return new;
    end if;
    v_payload := jsonb_build_object(
      'diff', public.audit_jsonb_diff(v_before, v_after)
    );
  elsif (tg_op = 'DELETE') then
    v_action := 'deleted';
    v_before := to_jsonb(old);
    v_entity_id := (old).id;
    v_hotel_id := coalesce(((old).hotel_id)::uuid, null);
    v_payload := jsonb_build_object('before', v_before);
  end if;

  if v_hotel_id is null then
    return coalesce(new, old);
  end if;

  insert into public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  values (v_hotel_id, public.audit_resolve_actor(), v_entity, v_entity_id, v_action, v_payload);

  return coalesce(new, old);
exception when others then
  -- Never fail the parent transaction because of audit (best-effort journaling)
  raise notice 'audit_trigger_fn ignored error on % %: %', tg_table_name, tg_op, sqlerrm;
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_trigger_fn() from public, anon;

-- ----------------------------------------------------------------------------
-- Attach triggers to business tables. We pass entity name as TG_ARGV[0].
-- Idempotent : drop + create.
-- ----------------------------------------------------------------------------
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('reservations',        'reservation'),
      ('ota_disputes',        'ota_dispute'),
      ('ota_dispute_reminders','ota_dispute_reminder'),
      ('bank_statements',     'bank_statement'),
      ('rooms',               'room'),
      ('planning_events',     'planning_event'),
      ('planning_channels',   'planning_channel')
    ) as t(table_name, entity)
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=rec.table_name) then
      execute format('drop trigger if exists trg_audit_%I on public.%I', rec.table_name, rec.table_name);
      execute format(
        'create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger_fn(%L)',
        rec.table_name, rec.table_name, rec.entity
      );
    end if;
  end loop;
end $$;

-- Helpful indexes for the UI filters (created_at desc + entity + actor).
create index if not exists idx_audit_logs_hotel_created on public.audit_logs(hotel_id, created_at desc);
create index if not exists idx_audit_logs_entity        on public.audit_logs(hotel_id, entity, created_at desc);
create index if not exists idx_audit_logs_actor         on public.audit_logs(hotel_id, actor_user_id, created_at desc);
