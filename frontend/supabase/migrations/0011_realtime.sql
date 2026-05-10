-- ============================================================================
-- FLOWTYM PMS — Migration 0011 : enable realtime for live operations
-- ----------------------------------------------------------------------------
-- Adds the operational tables to Supabase's `supabase_realtime` publication
-- so that frontend WebSocket subscriptions (`postgres_changes`) receive
-- INSERT/UPDATE/DELETE events. RLS still applies — clients only receive
-- events for rows they are allowed to read.
-- ============================================================================

do $$
declare
  t text;
  realtime_tables text[] := array['reservations', 'rooms', 'guests', 'invoices', 'payments'];
begin
  for t in select unnest(realtime_tables) loop
    if to_regclass('public.'||t) is not null then
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end if;
  end loop;
end $$;
