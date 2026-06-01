-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM RMS — Module Événements : persistance multi-hôtel
--
-- Remplace la persistance localStorage du module Événements par une table
-- Supabase isolée par hôtel (hotel_id = get_user_hotel_id()).
--
-- Stratégie JSONB :
--   • Le payload RMSMarketEvent complet est stocké en JSONB pour absorber
--     l'évolution du schéma front sans migration SQL à chaque sprint.
--   • Les colonnes dénormalisées (start_date, end_date, status) sont peuplées
--     par trigger avant insert/update pour éviter les GENERATED ALWAYS
--     non-immutable sur JSONB.
--   • La table hotel_rms_events_audit capture chaque INSERT/UPDATE/DELETE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table principale ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hotel_rms_events (
  id           TEXT        PRIMARY KEY,
  hotel_id     UUID        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  payload      JSONB       NOT NULL,
  -- colonnes dénormalisées pour index (peuplées par trigger)
  start_date   DATE,
  end_date     DATE,
  status       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Trigger dénormalisation start_date / end_date / status depuis JSONB.
CREATE OR REPLACE FUNCTION public.hotel_rms_events_denormalize()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.start_date := (NEW.payload->>'startDate')::DATE;
  NEW.end_date   := (NEW.payload->>'endDate')::DATE;
  NEW.status     := NEW.payload->>'status';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER hotel_rms_events_before_upsert
  BEFORE INSERT OR UPDATE ON public.hotel_rms_events
  FOR EACH ROW EXECUTE FUNCTION public.hotel_rms_events_denormalize();

CREATE OR REPLACE TRIGGER hotel_rms_events_set_updated_at
  BEFORE UPDATE ON public.hotel_rms_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_hotel_rms_events_hotel_dates
  ON public.hotel_rms_events(hotel_id, start_date, end_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_rms_events_hotel_status
  ON public.hotel_rms_events(hotel_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_rms_events_hotel_updated
  ON public.hotel_rms_events(hotel_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- ─── 2. RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.hotel_rms_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY hotel_rms_events_select ON public.hotel_rms_events
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY hotel_rms_events_insert ON public.hotel_rms_events
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY hotel_rms_events_update ON public.hotel_rms_events
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY hotel_rms_events_delete ON public.hotel_rms_events
  FOR DELETE USING (hotel_id = public.get_user_hotel_id());

-- ─── 3. Audit trail ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hotel_rms_events_audit (
  id           BIGSERIAL   PRIMARY KEY,
  event_id     TEXT        NOT NULL,
  hotel_id     UUID        NOT NULL,
  action       TEXT        NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  performed_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_payload  JSONB,
  new_payload  JSONB
);

CREATE INDEX IF NOT EXISTS idx_hotel_rms_events_audit_event
  ON public.hotel_rms_events_audit(event_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_hotel_rms_events_audit_hotel
  ON public.hotel_rms_events_audit(hotel_id, performed_at DESC);

ALTER TABLE public.hotel_rms_events_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY hotel_rms_events_audit_select ON public.hotel_rms_events_audit
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

-- ─── 4. Trigger audit automatique ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_hotel_rms_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hotel_rms_events_audit
      (event_id, hotel_id, action, performed_by, new_payload)
    VALUES (NEW.id, NEW.hotel_id, 'created', auth.uid(), NEW.payload);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.hotel_rms_events_audit
      (event_id, hotel_id, action, performed_by, old_payload, new_payload)
    VALUES (NEW.id, NEW.hotel_id, 'updated', auth.uid(), OLD.payload, NEW.payload);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.hotel_rms_events_audit
      (event_id, hotel_id, action, performed_by, old_payload)
    VALUES (OLD.id, OLD.hotel_id, 'deleted', auth.uid(), OLD.payload);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER hotel_rms_events_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.hotel_rms_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_hotel_rms_events();

-- ─── 5. RPC upsert batch ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_hotel_rms_events(
  p_hotel_id UUID,
  p_events   JSONB
)
RETURNS TABLE(upserted_count INT, skipped_count INT) LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_upserted   INT := 0;
  v_skipped    INT := 0;
  v_item       JSONB;
  v_user_id    UUID;
  v_user_hotel UUID;
BEGIN
  v_user_hotel := public.get_user_hotel_id();
  IF v_user_hotel IS DISTINCT FROM p_hotel_id THEN
    RAISE EXCEPTION 'Accès refusé : hotel_id invalide';
  END IF;
  v_user_id := auth.uid();
  FOR v_item IN SELECT jsonb_array_elements(p_events)
  LOOP
    INSERT INTO public.hotel_rms_events
      (id, hotel_id, payload, created_by, updated_by)
    VALUES (
      v_item->>'id',
      p_hotel_id,
      v_item->'payload',
      v_user_id,
      v_user_id
    )
    ON CONFLICT (id) DO UPDATE
      SET payload    = EXCLUDED.payload,
          updated_at = NOW(),
          updated_by = v_user_id
    WHERE hotel_rms_events.hotel_id = p_hotel_id;
    v_upserted := v_upserted + 1;
  END LOOP;
  RETURN QUERY SELECT v_upserted, v_skipped;
END;
$$;

COMMENT ON TABLE public.hotel_rms_events      IS 'Événements marché RMS isolés par hôtel — source de vérité persistante.';
COMMENT ON TABLE public.hotel_rms_events_audit IS 'Audit trail complet sur hotel_rms_events.';
COMMENT ON COLUMN public.hotel_rms_events.payload    IS 'RMSMarketEvent complet en JSON.';
COMMENT ON COLUMN public.hotel_rms_events.deleted_at IS 'NULL = actif. Non-NULL = soft-deleted.';
