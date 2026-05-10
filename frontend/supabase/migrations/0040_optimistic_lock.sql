-- ============================================================================
-- FLOWTYM PMS — Migration 0040 : Optimistic locking on reservations
-- ----------------------------------------------------------------------------
-- Adds a `version` column bumped automatically on UPDATE so the Planning
-- drag&drop can detect concurrent edits by another receptionist.
-- ============================================================================

alter table public.reservations
  add column if not exists version integer not null default 1;

create or replace function app.bump_reservation_version()
returns trigger language plpgsql as $$
begin
  if (new.version is null) or (new.version = old.version) then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_reservations_version_bump on public.reservations;
create trigger trg_reservations_version_bump before update on public.reservations
for each row execute function app.bump_reservation_version();
