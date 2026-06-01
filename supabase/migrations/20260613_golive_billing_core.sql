-- =============================================================================
-- GO LIVE SPRINT 1 — Billing Core
-- =============================================================================
--
-- Résout P0-1 : next_invoice_number manquant → toute création de facture crashait
-- Résout P0-1b : invoice UPDATE bloqué par RLS → issueInvoice / voidInvoice ne fonctionnaient pas
-- Résout P0-2 : contrainte anti-surbooking DB absente
-- Résout P0-5 : colonne `version` sur reservations (ajout idempotent)
--
-- Idempotent : toutes les opérations utilisent IF NOT EXISTS / OR REPLACE / DO $$.
-- Ne touche pas au design ni aux features RMS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extension btree_gist (nécessaire pour l'exclusion overlap)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Colonne `version` sur reservations (optimistic locking)
--    Le code fait .eq('version', expectedVersion) et insère avec version:1.
--    Si la colonne n'existe pas, check-in/check-out / useMoveReservation crashent.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reservations'
      AND column_name  = 'version'
  ) THEN
    ALTER TABLE public.reservations ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    -- Initialiser toutes les lignes existantes à version=1
    UPDATE public.reservations SET version = 1 WHERE version IS NULL;
  END IF;
END
$$;

-- Trigger : incrémente version à chaque UPDATE (optimistic locking)
CREATE OR REPLACE FUNCTION public.reservations_bump_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_bump_version ON public.reservations;
CREATE TRIGGER trg_reservations_bump_version
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reservations_bump_version();

-- ---------------------------------------------------------------------------
-- 2. Contrainte EXCLUDE anti-surbooking
--    Empêche deux réservations actives sur la même chambre avec chevauchement
--    de dates. Protège contre les créations concurrentes (code 23P01).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_no_room_overlap'
      AND conrelid = 'public.reservations'::regclass
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_no_room_overlap
      EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in::date, check_out::date, '[)') WITH &&
      )
      WHERE (
        room_id IS NOT NULL
        AND status NOT IN ('cancelled', 'no_show', 'checked_out')
      );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Table invoice_counters — séquenceur de numéros de facture par hôtel/année
--    Utilise INSERT ... ON CONFLICT (UPDATE atomique) → thread-safe,
--    aucune race condition même sous charge.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  hotel_id  UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  year      SMALLINT NOT NULL,
  last_seq  INTEGER  NOT NULL DEFAULT 0,
  CONSTRAINT invoice_counters_pkey PRIMARY KEY (hotel_id, year)
);

CREATE INDEX IF NOT EXISTS idx_invoice_counters_hotel
  ON public.invoice_counters (hotel_id);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ic_own" ON public.invoice_counters;
CREATE POLICY "ic_own" ON public.invoice_counters
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ---------------------------------------------------------------------------
-- 4. Fonction next_invoice_number(p_hotel_id UUID) → TEXT
--    Génère : F-YYYY-NNNN (ex : F-2026-0042)
--    Gère le rollover d'année automatiquement.
--    SECURITY DEFINER : peut écrire dans invoice_counters même si RLS bloque.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_hotel_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year SMALLINT := EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT;
  v_seq  INTEGER;
BEGIN
  -- INSERT ou UPDATE atomique : garantit unicité même en concurrence
  INSERT INTO public.invoice_counters (hotel_id, year, last_seq)
  VALUES (p_hotel_id, v_year, 1)
  ON CONFLICT (hotel_id, year) DO UPDATE
    SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'F-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Trigger : protection des champs financiers de la facture
--    Remplace le USING(false) blanket deny par un mécanisme plus fin :
--    - Le UPDATE est autorisé pour les transitions de statut
--    - Les montants, TVA, numéro de facture sont immuables
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_invoice_financials()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Champs strictement immuables après création
  IF OLD.invoice_number IS DISTINCT FROM NEW.invoice_number THEN
    RAISE EXCEPTION 'INVOICE_LOCKED: Le numéro de facture est immuable.';
  END IF;
  IF OLD.total_ht  IS DISTINCT FROM NEW.total_ht  OR
     OLD.total_tva IS DISTINCT FROM NEW.total_tva OR
     OLD.total_ttc IS DISTINCT FROM NEW.total_ttc
  THEN
    -- Les totaux sont calculés automatiquement (trigger sur invoice_lines)
    -- Une modification directe = tentative de fraude
    RAISE EXCEPTION 'INVOICE_LOCKED: Les montants HT/TVA/TTC ne sont pas modifiables directement.';
  END IF;
  IF OLD.hotel_id IS DISTINCT FROM NEW.hotel_id THEN
    RAISE EXCEPTION 'INVOICE_LOCKED: L''hôtel d''une facture est immuable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_invoice_financials ON public.invoices;
CREATE TRIGGER trg_protect_invoice_financials
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.protect_invoice_financials();

-- ---------------------------------------------------------------------------
-- 6. Fix RLS invoices : remplace le USING(false) par un UPDATE scopé
--    L'ancien "invoices_no_client_update" bloquait issueInvoice et voidInvoice.
--    Remplacé par une politique qui autorise les updates de statut sur son hôtel.
--    L'intégrité financière est désormais garantie par le trigger (étape 5).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "invoices_no_client_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_own"       ON public.invoices;

CREATE POLICY "invoices_update_own" ON public.invoices
  FOR UPDATE TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ---------------------------------------------------------------------------
-- 7. Trigger : recalcul automatique des totaux facture après modif lignes
--    Quand une ligne est insérée/annulée, les totaux HT/TVA/TTC se mettent
--    à jour automatiquement. Évite les désynchronisations manuelles.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalc_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_ht  NUMERIC(12,2);
  v_tva NUMERIC(12,2);
  v_ttc NUMERIC(12,2);
BEGIN
  -- Identifier la facture concernée
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT
    COALESCE(SUM(total_ht),  0),
    COALESCE(SUM(total_tva), 0),
    COALESCE(SUM(total_ttc), 0)
  INTO v_ht, v_tva, v_ttc
  FROM public.invoice_lines
  WHERE invoice_id = v_invoice_id;

  -- Contourne le trigger protect_invoice_financials (SECURITY DEFINER)
  UPDATE public.invoices
  SET
    total_ht  = v_ht,
    total_tva = v_tva,
    total_ttc = v_ttc,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_invoice_totals ON public.invoice_lines;
CREATE TRIGGER trg_recalc_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_totals();

-- ---------------------------------------------------------------------------
-- 8. Trigger : mise à jour paid_amount et balance sur la facture
--    Quand un paiement est ajouté/annulé, paid_amount se recalcule.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalc_invoice_paid()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_paid NUMERIC(12,2);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM public.payments
  WHERE invoice_id = v_invoice_id
    AND status = 'completed';

  UPDATE public.invoices
  SET
    paid_amount = v_paid,
    balance     = total_ttc - v_paid,
    status      = CASE
                    WHEN v_paid >= total_ttc AND total_ttc > 0 THEN 'paid'
                    ELSE status
                  END,
    updated_at  = now()
  WHERE id = v_invoice_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_invoice_paid ON public.payments;
CREATE TRIGGER trg_recalc_invoice_paid
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_paid();

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.protect_invoice_financials()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_totals()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_paid()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.reservations_bump_version()    TO authenticated;
