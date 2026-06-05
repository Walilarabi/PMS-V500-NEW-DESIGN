-- ============================================================================
-- FLOWTYM SaaS — hotels : champs "société" + "statut" (PHASE 1)
-- Additif/non destructif. Ajoute company + status (draft/active/suspended/archived)
-- et synchronise status <-> active (compat ascendante avec le PMS qui lit `active`).
-- APPLIQUÉE EN PROD (migration saas_11). Prouvée : 5 hôtels -> status='active',
-- synchro testée (active=false -> status='suspended').
-- ============================================================================
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS status  text;

UPDATE public.hotels SET status = CASE WHEN active THEN 'active' ELSE 'suspended' END WHERE status IS NULL;
ALTER TABLE public.hotels ALTER COLUMN status SET DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='hotels_status_check' AND conrelid='public.hotels'::regclass) THEN
    ALTER TABLE public.hotels ADD CONSTRAINT hotels_status_check
      CHECK (status IN ('draft','active','suspended','archived'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.hotels_sync_status_active()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_catalog' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN
      NEW.status := CASE WHEN COALESCE(NEW.active, true) THEN 'active' ELSE 'suspended' END;
    END IF;
    NEW.active := (NEW.status = 'active');
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.active := (NEW.status = 'active');
    ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
      NEW.status := CASE WHEN NEW.active THEN 'active' ELSE 'suspended' END;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_hotels_sync_status_active ON public.hotels;
CREATE TRIGGER trg_hotels_sync_status_active
  BEFORE INSERT OR UPDATE ON public.hotels
  FOR EACH ROW EXECUTE FUNCTION public.hotels_sync_status_active();
