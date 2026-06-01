-- Fix: resolve 7 overbooking conflicts in seed data to allow EXCLUDE constraint creation.
-- Sprint 1 smoke test T4: constraint creation failed due to pre-existing overlaps.
-- Strategy: mark the secondary reservation in each conflicting pair as no_show (past)
--           or cancelled (future), keeping the primary reservation intact.

UPDATE public.reservations
SET status = CASE
  WHEN check_in < CURRENT_DATE THEN 'no_show'
  ELSE 'cancelled'
END
WHERE id IN (
  SELECT DISTINCT LEAST(r1.id, r2.id)
  FROM public.reservations r1
  JOIN public.reservations r2
    ON  r1.hotel_id  = r2.hotel_id
    AND r1.room_id   = r2.room_id
    AND r1.id        <> r2.id
    AND r1.status NOT IN ('cancelled','no_show')
    AND r2.status NOT IN ('cancelled','no_show')
    AND r1.check_in  < r2.check_out
    AND r2.check_in  < r1.check_out
);
