-- S2-5: Maintenance → blocage automatique chambre
-- Quand un ticket maintenance priority=critical est créé ou mis à jour :
--   1. rooms.status → out_of_order
--   2. room_blocks créé et lié via maintenance_ticket_id
-- Quand résolu/clôturé/annulé : blocage levé, rooms.status → available
-- Guard BEFORE INSERT sur reservations : refuse si room.status = out_of_order
-- Idempotent : index UNIQUE partiel sur maintenance_ticket_id WHERE closed_at IS NULL

-- ─── Schema additions ─────────────────────────────────────────────────────────

ALTER TABLE public.room_blocks
  ADD COLUMN IF NOT EXISTS maintenance_ticket_id uuid REFERENCES public.maintenance_tickets(id),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Un seul bloc actif par ticket (idempotence T7 ; laisse coexister les blocs fermés T8)
CREATE UNIQUE INDEX IF NOT EXISTS room_blocks_ticket_active_unique
  ON public.room_blocks (maintenance_ticket_id)
  WHERE maintenance_ticket_id IS NOT NULL AND closed_at IS NULL;

-- ─── Trigger: maintenance_ticket → room_block ─────────────────────────────────
-- AFTER INSERT OR UPDATE SECURITY DEFINER.
-- Cas couverts :
--   A) Devient critique (INSERT critique ou UPDATE priority→critical) → bloquer
--   B) Était critique, ne l'est plus (résolu/annulé/déprioritisé) → débloquer
--   C) Était critique, chambre changée → fermer ancien bloc, créer nouveau
--   D) Déjà critique, aucun changement pertinent → DO NOTHING (idempotent)

CREATE OR REPLACE FUNCTION public.trg_fn_maintenance_ticket_room_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id     uuid;
  v_actor_id     uuid;
  v_should_block boolean;
  v_was_block    boolean;
  v_room_changed boolean;
  v_old_room_id  uuid;
BEGIN
  v_hotel_id := NEW.hotel_id;
  SELECT id INTO v_actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  -- Détermine l'état cible : doit-on bloquer la chambre ?
  v_should_block := (
    NEW.priority = 'critical'
    AND NEW.room_id IS NOT NULL
    AND NEW.status NOT IN ('resolved', 'closed', 'cancelled')
  );

  -- État précédent (false pour INSERT — OLD n'existe pas)
  IF TG_OP = 'UPDATE' THEN
    v_was_block := (
      OLD.priority = 'critical'
      AND OLD.room_id IS NOT NULL
      AND OLD.status NOT IN ('resolved', 'closed', 'cancelled')
    );
    v_room_changed := (OLD.room_id IS DISTINCT FROM NEW.room_id);
    v_old_room_id  := OLD.room_id;
  ELSE
    v_was_block    := false;
    v_room_changed := false;
    v_old_room_id  := NULL;
  END IF;

  -- ── Cas B : était bloqué → ne doit plus l'être (résolu/annulé/déprioritisé) ──
  IF v_was_block AND NOT v_should_block THEN
    UPDATE public.room_blocks
    SET closed_at = now()
    WHERE maintenance_ticket_id = NEW.id AND closed_at IS NULL;

    -- Restaurer la chambre si aucun autre ticket critique actif
    IF NOT EXISTS (
      SELECT 1 FROM public.maintenance_tickets
      WHERE room_id = v_old_room_id
        AND id <> NEW.id
        AND priority = 'critical'
        AND status NOT IN ('resolved', 'closed', 'cancelled')
    ) THEN
      UPDATE public.rooms SET status = 'available' WHERE id = v_old_room_id;
    END IF;

    INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
    VALUES (v_hotel_id, v_actor_id, 'maintenance_ticket', NEW.id, 'ROOM_UNBLOCKED',
      jsonb_build_object('room_id', v_old_room_id, 'new_ticket_status', NEW.status));

    RETURN NEW;
  END IF;

  -- ── Cas C : toujours bloqué, chambre changée → déplacer le blocage ──
  IF v_was_block AND v_should_block AND v_room_changed THEN
    -- Fermer l'ancien bloc
    UPDATE public.room_blocks
    SET closed_at = now()
    WHERE maintenance_ticket_id = NEW.id AND closed_at IS NULL;

    -- Restaurer ancienne chambre si aucun autre ticket critique actif
    IF v_old_room_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.maintenance_tickets
      WHERE room_id = v_old_room_id
        AND id <> NEW.id
        AND priority = 'critical'
        AND status NOT IN ('resolved', 'closed', 'cancelled')
    ) THEN
      UPDATE public.rooms SET status = 'available' WHERE id = v_old_room_id;
    END IF;

    -- Bloquer la nouvelle chambre
    UPDATE public.rooms SET status = 'out_of_order' WHERE id = NEW.room_id;

    INSERT INTO public.room_blocks
      (hotel_id, room_id, start_date, end_date, reason, maintenance_ticket_id, notes, blocked_by)
    VALUES
      (v_hotel_id, NEW.room_id, CURRENT_DATE, CURRENT_DATE + 30, 'maintenance',
       NEW.id, 'Blocage auto — chambre changée sur ticket critique', auth.uid());

    INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
    VALUES (v_hotel_id, v_actor_id, 'maintenance_ticket', NEW.id, 'ROOM_BLOCK_MOVED',
      jsonb_build_object('old_room_id', v_old_room_id, 'new_room_id', NEW.room_id));

    RETURN NEW;
  END IF;

  -- ── Cas A : doit être bloqué, ne l'était pas → créer le blocage ──
  IF v_should_block AND NOT v_was_block THEN
    UPDATE public.rooms SET status = 'out_of_order' WHERE id = NEW.room_id;

    INSERT INTO public.room_blocks
      (hotel_id, room_id, start_date, end_date, reason, maintenance_ticket_id, notes, blocked_by)
    VALUES
      (v_hotel_id, NEW.room_id, CURRENT_DATE, CURRENT_DATE + 30, 'maintenance',
       NEW.id, 'Blocage auto — ticket maintenance critique', auth.uid())
    ON CONFLICT (maintenance_ticket_id)
      WHERE maintenance_ticket_id IS NOT NULL AND closed_at IS NULL
    DO NOTHING;

    INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
    VALUES (v_hotel_id, v_actor_id, 'maintenance_ticket', NEW.id, 'ROOM_BLOCKED',
      jsonb_build_object('room_id', NEW.room_id, 'priority', NEW.priority, 'ticket_status', NEW.status));
  END IF;

  -- Cas D : aucun changement pertinent → RETURN NEW silencieux
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_ticket_room_block ON public.maintenance_tickets;
CREATE TRIGGER trg_maintenance_ticket_room_block
  AFTER INSERT OR UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_maintenance_ticket_room_block();

-- ─── Guard : réservation sur chambre out_of_order → refus ────────────────────
-- BEFORE INSERT (pas UPDATE — une résa existante n'est pas impactée).

CREATE OR REPLACE FUNCTION public.trg_fn_reservation_room_availability_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_status text;
  v_room_number text;
BEGIN
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT status, number INTO v_room_status, v_room_number
  FROM public.rooms WHERE id = NEW.room_id;

  IF v_room_status IN ('out_of_order', 'maintenance') THEN
    RAISE EXCEPTION 'ROOM_UNAVAILABLE:out_of_order:La chambre % est hors service ou en maintenance. Ticket de maintenance en cours.',
      COALESCE(v_room_number, NEW.room_id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_room_availability_guard ON public.reservations;
CREATE TRIGGER trg_reservation_room_availability_guard
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_reservation_room_availability_guard();
