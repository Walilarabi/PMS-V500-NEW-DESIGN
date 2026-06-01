-- S2-4: Checkout → Housekeeping automatique
-- Quand une réservation passe checked_in → checked_out :
--   1. rooms.housekeeping_status → dirty
--   2. hk_tasks (type=checkout_cleaning) créée et liée via reservation_id
-- Idempotent : index UNIQUE partiel sur reservation_id (task_type='checkout_cleaning').
-- Gracieux : pas de crash si room_id IS NULL (réservation sans chambre assignée).

-- ─── Schema addition ──────────────────────────────────────────────────────────

ALTER TABLE public.hk_tasks
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.reservations(id);

-- Un seul checkout (type HK) par réservation — garde idempotence (T4/T7)
-- Note: 'checkout' est la valeur correcte dans hk_tasks_task_type_check
CREATE UNIQUE INDEX IF NOT EXISTS hk_tasks_checkout_reservation_unique
  ON public.hk_tasks (reservation_id)
  WHERE task_type = 'checkout' AND reservation_id IS NOT NULL;

-- ─── Trigger function ─────────────────────────────────────────────────────────
-- AFTER UPDATE : ne modifie pas la ligne en cours (RETURN NEW, pas de conflit
-- avec le BEFORE checkout_guard de S2-3 qui s'exécute avant).
-- SECURITY DEFINER : lit rooms et insère dans hk_tasks/audit_logs sans RLS.

CREATE OR REPLACE FUNCTION public.trg_fn_reservation_checkout_housekeeping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id  uuid;
  v_actor_id  uuid;
  v_room_num  text;
BEGIN
  -- Intercepte uniquement la transition → checked_out
  IF NOT (OLD.status <> 'checked_out' AND NEW.status = 'checked_out') THEN
    RETURN NEW;
  END IF;

  -- Règle 5 : pas de chambre assignée → sortie propre, aucun crash
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_hotel_id := NEW.hotel_id;
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  -- Récupère room_number (NOT NULL dans hk_tasks)
  SELECT number INTO v_room_num FROM public.rooms WHERE id = NEW.room_id;

  -- Chambre supprimée en cours de séjour → sortie propre
  IF v_room_num IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Marque la chambre dirty (idempotent si déjà dirty)
  UPDATE public.rooms
  SET housekeeping_status = 'dirty'
  WHERE id = NEW.room_id;

  -- 2. Crée la tâche HK — ON CONFLICT DO NOTHING pour idempotence (T4/T6/T7)
  INSERT INTO public.hk_tasks (
    hotel_id,
    room_id,
    room_number,
    task_type,
    status,
    priority,
    reservation_id,
    scheduled_for
  ) VALUES (
    v_hotel_id,
    NEW.room_id,
    v_room_num,
    'checkout',
    'pending',
    'normal',
    NEW.id,
    CURRENT_DATE
  )
  ON CONFLICT (reservation_id)
    WHERE task_type = 'checkout' AND reservation_id IS NOT NULL
  DO NOTHING;

  -- 3. Audit trail
  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    v_hotel_id,
    v_actor_id,
    'reservation',
    NEW.id,
    'CHECKOUT_HK_CREATED',
    jsonb_build_object(
      'room_id',      NEW.room_id,
      'room_number',  v_room_num,
      'triggered_at', now()
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_checkout_housekeeping ON public.reservations;
CREATE TRIGGER trg_reservation_checkout_housekeeping
  AFTER UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_reservation_checkout_housekeeping();
