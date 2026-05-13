-- ============================================================================
-- FLOWTYM PMS — Migration 0080 : Module Billing
-- ----------------------------------------------------------------------------
-- Principes :
--   * invoices      — immuables après émission (status = 'issued')
--   * invoice_lines — append-only (corrections via lignes négatives)
--   * payments      — immuables (annulation via reversal entry)
--   * folios        — regroupement logique des lignes (hébergement, extras…)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- invoices — Factures (draft → issued → paid | voided)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  reservation_id   uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  guest_id         uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  invoice_number   text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'issued', 'paid', 'voided')),
  -- Totaux calculés (dénormalisés pour performance)
  total_ht         numeric(14,2) NOT NULL DEFAULT 0,
  total_tva        numeric(14,2) NOT NULL DEFAULT 0,
  total_ttc        numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount      numeric(14,2) NOT NULL DEFAULT 0,
  balance          numeric(14,2) GENERATED ALWAYS AS (total_ttc - paid_amount) STORED,
  -- Dates
  issued_at        timestamptz,
  due_date         date,
  -- Infos client (snapshot au moment de l'émission)
  bill_to_name     text,
  bill_to_address  text,
  bill_to_vat      text,
  -- Meta
  notes            text,
  created_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_hotel      ON public.invoices(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_reservation ON public.invoices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON public.invoices(hotel_id, status);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Immutabilité après émission
CREATE OR REPLACE FUNCTION app.invoices_immutable_after_issue()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('issued', 'paid') AND NEW.status NOT IN ('paid', 'voided') THEN
    RAISE EXCEPTION 'INVOICE_LOCKED: facture % ne peut plus être modifiée après émission.', OLD.invoice_number
      USING ERRCODE = '23514';
  END IF;
  -- Interdire la modification des montants après émission
  IF OLD.status IN ('issued', 'paid') AND (
    NEW.total_ht  <> OLD.total_ht  OR
    NEW.total_tva <> OLD.total_tva OR
    NEW.total_ttc <> OLD.total_ttc
  ) THEN
    RAISE EXCEPTION 'INVOICE_LOCKED: les montants de la facture % sont figés.', OLD.invoice_number
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_immutable ON public.invoices;
CREATE TRIGGER trg_invoices_immutable
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION app.invoices_immutable_after_issue();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_hotel_isolation ON public.invoices;
CREATE POLICY invoices_hotel_isolation ON public.invoices
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- folios — Regroupement de lignes (ex: Hébergement, Bar, Extras)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.folios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  invoice_id   uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT 'Principal',
  folio_order  int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folios_invoice ON public.folios(invoice_id);

ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS folios_hotel_isolation ON public.folios;
CREATE POLICY folios_hotel_isolation ON public.folios
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- invoice_lines — Lignes de facturation (append-only)
-- Correction via ligne négative (pas de DELETE/UPDATE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  folio_id       uuid NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  invoice_id     uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  -- Produit
  product_code   text,
  description    text NOT NULL,
  service_date   date NOT NULL DEFAULT CURRENT_DATE,
  -- Quantité & prix
  quantity       numeric(10,3) NOT NULL DEFAULT 1,
  unit_price_ht  numeric(12,2) NOT NULL,
  tva_rate       numeric(5,2)  NOT NULL DEFAULT 10.00,
  total_ht       numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price_ht) STORED,
  total_tva      numeric(14,2) GENERATED ALWAYS AS (
    ROUND(quantity * unit_price_ht * tva_rate / 100, 2)
  ) STORED,
  total_ttc      numeric(14,2) GENERATED ALWAYS AS (
    ROUND(quantity * unit_price_ht * (1 + tva_rate / 100), 2)
  ) STORED,
  -- Origine
  source         text NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual', 'night_audit', 'pos', 'reversal')),
  -- Référence à la ligne corrigée (pour reversals)
  reversal_of    uuid REFERENCES public.invoice_lines(id) ON DELETE SET NULL,
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_folio   ON public.invoice_lines(folio_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_date    ON public.invoice_lines(hotel_id, service_date DESC);

-- Append-only : pas de UPDATE ni DELETE
CREATE OR REPLACE FUNCTION app.invoice_lines_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: les lignes de facturation sont immuables. Créez une ligne de correction (reversal).';
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_lines_no_update ON public.invoice_lines;
CREATE TRIGGER trg_invoice_lines_no_update
  BEFORE UPDATE ON public.invoice_lines FOR EACH ROW
  EXECUTE FUNCTION app.invoice_lines_append_only();

DROP TRIGGER IF EXISTS trg_invoice_lines_no_delete ON public.invoice_lines;
CREATE TRIGGER trg_invoice_lines_no_delete
  BEFORE DELETE ON public.invoice_lines FOR EACH ROW
  EXECUTE FUNCTION app.invoice_lines_append_only();

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_lines_hotel_isolation ON public.invoice_lines;
CREATE POLICY invoice_lines_hotel_isolation ON public.invoice_lines
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- payments — Paiements (immuables — annulation via reversal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  invoice_id     uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  -- Montant (positif = encaissement, négatif = remboursement/reversal)
  amount         numeric(14,2) NOT NULL,
  currency       char(3) NOT NULL DEFAULT 'EUR',
  method         text NOT NULL DEFAULT 'cash'
                 CHECK (method IN ('cash', 'card', 'transfer', 'cheque', 'ota', 'other')),
  -- Statut
  status         text NOT NULL DEFAULT 'completed'
                 CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  -- Reversal
  reversal_of    uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  reversal_reason text,
  -- Références
  reference      text,    -- ex: numéro de transaction CB
  collected_at   timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_hotel   ON public.payments(hotel_id, created_at DESC);

-- Immutabilité des paiements complétés
CREATE OR REPLACE FUNCTION app.payments_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status NOT IN ('reversed') THEN
    RAISE EXCEPTION 'PAYMENT_LOCKED: le paiement % est finalisé. Créez un reversal.', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_immutable ON public.payments;
CREATE TRIGGER trg_payments_immutable
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION app.payments_immutable();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_hotel_isolation ON public.payments;
CREATE POLICY payments_hotel_isolation ON public.payments
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- Trigger : mise à jour automatique des totaux invoice après insertion de ligne
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.sync_invoice_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.invoices SET
    total_ht  = (SELECT COALESCE(SUM(total_ht),  0) FROM public.invoice_lines WHERE invoice_id = NEW.invoice_id),
    total_tva = (SELECT COALESCE(SUM(total_tva), 0) FROM public.invoice_lines WHERE invoice_id = NEW.invoice_id),
    total_ttc = (SELECT COALESCE(SUM(total_ttc), 0) FROM public.invoice_lines WHERE invoice_id = NEW.invoice_id)
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_totals ON public.invoice_lines;
CREATE TRIGGER trg_sync_invoice_totals
  AFTER INSERT ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION app.sync_invoice_totals();

-- ----------------------------------------------------------------------------
-- Trigger : mise à jour paid_amount invoice après paiement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.sync_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_invoice_id uuid;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices SET
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.payments
      WHERE invoice_id = v_invoice_id AND status = 'completed'
    )
  WHERE id = v_invoice_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_paid ON public.payments;
CREATE TRIGGER trg_sync_invoice_paid
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION app.sync_invoice_paid();

-- ----------------------------------------------------------------------------
-- Numérotation automatique des factures (hotel_id + année + séquence)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  hotel_id  uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  year      int  NOT NULL,
  last_seq  int  NOT NULL DEFAULT 0,
  PRIMARY KEY (hotel_id, year)
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_seq_hotel ON public.invoice_sequences;
CREATE POLICY invoice_seq_hotel ON public.invoice_sequences
  USING (hotel_id = public.get_user_hotel_id());

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_hotel_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM now());
  v_seq  int;
BEGIN
  INSERT INTO public.invoice_sequences (hotel_id, year, last_seq)
  VALUES (p_hotel_id, v_year, 1)
  ON CONFLICT (hotel_id, year) DO UPDATE
    SET last_seq = invoice_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'F' || v_year || '-' || LPAD(v_seq::text, 5, '0');
END;
$$;
