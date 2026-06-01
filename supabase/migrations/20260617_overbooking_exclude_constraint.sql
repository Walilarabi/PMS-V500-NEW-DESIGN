-- Add EXCLUDE constraint preventing room overbooking.
-- Sprint 1 smoke test T4: anti-surbooking P0-2.
-- Requires btree_gist extension (enabled).
-- Excludes: cancelled, no_show, checked_out, deleted; also guards room_id IS NOT NULL.
-- Definition matches production DB constraint exactly.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_no_room_overlap;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_room_overlap
  EXCLUDE USING gist (
    room_id  WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (
    room_id IS NOT NULL
    AND status <> ALL (ARRAY['cancelled','no_show','checked_out','deleted'])
  );
