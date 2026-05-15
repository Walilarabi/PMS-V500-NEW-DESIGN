-- ============================================================================
-- FLOWTYM PMS — Migration 0120 : Audit étendu (actor_label + payments/invoices)
-- ----------------------------------------------------------------------------
-- 1) Ajoute `actor_label` text nullable à `audit_logs` pour étiqueter les
--    écritures non-utilisateur (cron, service_role, anonymous, …).
-- 2) Étend `audit_trigger_fn` pour calculer ce label automatiquement.
-- 3) Attache les triggers aux nouvelles tables sensibles :
--    `payments`, `invoices`, `invoice_pdp_status`.
-- ============================================================================

alter table public.audit_logs
  add column if not exists actor_label text;

comment on column public.audit_logs.actor_label is
  'Étiquette humainement lisible de l''acteur quand actor_user_id est NULL (ex: "Cron", "Service Role", "Anonymous").';

create or replace function public.audit_resolve_actor_label()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  begin
    -- Supabase exposes the JWT role via current_setting('request.jwt.claim.role').
    v_role := nullif(current_setting('request.jwt.claim.role', true), '');
    if v_role is null then
      v_role := nullif(current_setting('request.jwt.claims', true), '');
      if v_role is not null then
        v_role := (v_role::jsonb)->>'role';
      end if;
    end if;
  exception when others then
    v_role := null;
  end;

  if v_role is null then
    -- Trigger fired from a direct SQL session (pg_cron, psql, scripts)
    return 'Système (DB)';
  end if;

  case v_role
    when 'service_role' then return 'Service Role (backend)';
    when 'anon'         then return 'Anonyme';
    when 'authenticated' then return null; -- the auth.uid() lookup should produce the real user
    else return v_role;
  end case;
end;
$$;

revoke all on function public.audit_resolve_actor_label() from public, anon;

create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity text := tg_argv[0];
  v_action text;
  v_entity_id uuid;
  v_hotel_id uuid;
  v_payload jsonb;
  v_before jsonb;
  v_after jsonb;
  v_actor uuid;
  v_actor_label text;
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
    if public.audit_jsonb_diff(v_before, v_after) = '{}'::jsonb then
      return new;
    end if;
    v_payload := jsonb_build_object('diff', public.audit_jsonb_diff(v_before, v_after));
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

  v_actor := public.audit_resolve_actor();
  if v_actor is null then
    v_actor_label := public.audit_resolve_actor_label();
  end if;

  insert into public.audit_logs (hotel_id, actor_user_id, actor_label, entity, entity_id, action, payload)
  values (v_hotel_id, v_actor, v_actor_label, v_entity, v_entity_id, v_action, v_payload);

  return coalesce(new, old);
exception when others then
  raise notice 'audit_trigger_fn ignored error on % %: %', tg_table_name, tg_op, sqlerrm;
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_trigger_fn() from public, anon;

-- Attach to payments / invoices / invoice_pdp_status (idempotent).
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('payments',             'payment'),
      ('invoices',             'invoice'),
      ('invoice_pdp_status',   'invoice_pdp_status')
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
