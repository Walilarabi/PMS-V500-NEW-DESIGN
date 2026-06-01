-- S2-4 correctif : 'checkout_cleaning' n'est pas dans hk_tasks_task_type_check.
-- La valeur autorisée est 'checkout'. On recrée l'index et la fonction trigger.

DROP INDEX IF EXISTS public.hk_tasks_checkout_reservation_unique;

CREATE UNIQUE INDEX hk_tasks_checkout_reservation_unique
  ON public.hk_tasks (reservation_id)
  WHERE task_type = 'checkout' AND reservation_id IS NOT NULL;

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
  IF NOT (OLD.status <> 'checked_out' AND NEW.status = 'checked_out') THEN
    RETURN NEW;
  END IF;

  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_hotel_id := NEW.hotel_id;
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  SELECT number INTO v_room_num FROM public.rooms WHERE id = NEW.room_id;

  IF v_room_num IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.rooms
  SET housekeeping_status = 'dirty'
  WHERE id = NEW.room_id;

  INSERT INTO public.hk_tasks (
    hotel_id, room_id, room_number, task_type, status, priority, reservation_id, scheduled_for
  ) VALUES (
    v_hotel_id, NEW.room_id, v_room_num, 'checkout', 'pending', 'normal', NEW.id, CURRENT_DATE
  )
  ON CONFLICT (reservation_id)
    WHERE task_type = 'checkout' AND reservation_id IS NOT NULL
  DO NOTHING;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    v_hotel_id, v_actor_id, 'reservation', NEW.id, 'CHECKOUT_HK_CREATED',
    jsonb_build_object('room_id', NEW.room_id, 'room_number', v_room_num, 'triggered_at', now())
  );

  RETURN NEW;
END;
$$;
