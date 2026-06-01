-- Add EXCLUDE constraint preventing room overbooking.
-- Sprint 1 smoke test T4: anti-surbooking P0-2.
-- Requires btree_gist extension (enabled).
-- Only active statuses participate; cancelled/no_show are excluded.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_room_overlap
  EXCLUDE USING gist (
    room_id  WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));
