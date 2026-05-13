-- ============================================================================
-- FLOWTYM PMS — Migration 0030 : Optimistic locking + audit triggers
-- ----------------------------------------------------------------------------
-- Adds:
--   * reservations.version     — optimistic locking (increment on each update)
--   * trg_reservations_audit   — auto-write to audit_logs on INSERT/UPDATE/DELETE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colonne version (optimistic locking)
-- ----------------------------------------------------------------------------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- ----------------------------------------------------------------------------
-- Fonction générique d'audit pour les réservations
-- Écrit dans audit_logs à chaque mutation sur reservations.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.audit_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hotel_id  uuid;
  v_entity_id uuid;
  v_action    text;
  v_payload   jsonb;
BEGIN
  -- Résolution hotel_id et action
  IF TG_OP = 'INSERT' THEN
    v_hotel_id  := NEW.hotel_id;
    v_entity_id := NEW.id;
    v_action    := 'INSERT';
    v_payload   := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_hotel_id  := NEW.hotel_id;
    v_entity_id := NEW.id;
    -- Action sémantique selon le changement de statut
    v_action := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN
        'STATUS_' || upper(coalesce(NEW.status, 'UNKNOWN'))
      ELSE 'UPDATE'
    END;
    v_payload := jsonb_build_object(
      'before', jsonb_build_object(
        'status', OLD.status,
        'total_amount', OLD.total_amount,
        'paid_amount', OLD.paid_amount,
        'room_id', OLD.room_id,
        'check_in', OLD.check_in,
        'check_out', OLD.check_out,
        'version', OLD.version
      ),
      'after', jsonb_build_object(
        'status', NEW.status,
        'total_amount', NEW.total_amount,
        'paid_amount', NEW.paid_amount,
        'room_id', NEW.room_id,
        'check_in', NEW.check_in,
        'check_out', NEW.check_out,
        'version', NEW.version
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_hotel_id  := OLD.hotel_id;
    v_entity_id := OLD.id;
    v_action    := 'DELETE';
    v_payload   := to_jsonb(OLD);
  END IF;

  -- Incrément version sur UPDATE
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
  END IF;

  -- Écriture audit (non bloquant si hotel_id est NULL)
  IF v_hotel_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      hotel_id,
      actor_user_id,
      entity,
      entity_id,
      action,
      payload,
      correlation_id
    ) VALUES (
      v_hotel_id,
      auth.uid(),
      'reservation',
      v_entity_id,
      v_action,
      v_payload,
      gen_random_uuid()
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Attacher le trigger
DROP TRIGGER IF EXISTS trg_reservations_audit ON public.reservations;
CREATE TRIGGER trg_reservations_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION app.audit_reservations();

-- ----------------------------------------------------------------------------
-- Même pattern pour payments (si la table existe)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.audit_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
    VALUES (OLD.hotel_id, auth.uid(), 'payment', OLD.id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  INSERT INTO public.audit_logs (hotel_id, actor_user_id, entity, entity_id, action, payload)
  VALUES (
    NEW.hotel_id,
    auth.uid(),
    'payment',
    NEW.id,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
         ELSE jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    END
  );
  RETURN NEW;
END;
$$;

-- Attacher uniquement si la table payments existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    EXECUTE $t$
      DROP TRIGGER IF EXISTS trg_payments_audit ON public.payments;
      CREATE TRIGGER trg_payments_audit
        AFTER INSERT OR UPDATE OR DELETE ON public.payments
        FOR EACH ROW EXECUTE FUNCTION app.audit_payments();
    $t$;
  END IF;
END;
$$;
