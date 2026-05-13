-- ============================================================================
-- FLOWTYM — Migration bundle : applique 0020 + 0030 + 0040 + 0050 en séquence
-- À coller dans le Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- URL : https://supabase.com/dashboard/project/hzrzkvdebaadditvbqis/sql/new
-- ============================================================================
-- ============================================================================
-- FLOWTYM PMS — Migration 0020 : Finance Modules
-- ----------------------------------------------------------------------------
-- Adds:
--   * reconciliation_lines  — lignes bancaires OTA importées + rapprochement
--   * fec_exports           — historique des exports FEC (immutable)
--   * revenue_anomalies     — anomalies détectées par le moteur Revenue Integrity
--   * csv_import_templates  — templates de mapping CSV par source OTA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- reconciliation_lines — Lignes bancaires à rapprocher (Booking, Expedia, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  source          text NOT NULL,                          -- 'BOOKING' | 'EXPEDIA' | 'AIRBNB' | 'BANK_HOTEL'
  reference       text NOT NULL,
  description     text,
  amount          numeric(12,2) NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'EUR',
  line_date       date NOT NULL,
  status          text NOT NULL DEFAULT 'pending',        -- 'pending' | 'matched' | 'disputed' | 'ignored'
  reservation_id  uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  match_score     numeric(5,2),                           -- 0–100 score de confiance du rapprochement auto
  match_delta     numeric(12,2),                          -- écart en € entre la ligne et la réservation
  matched_at      timestamptz,
  matched_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes           text,
  raw_payload     jsonb,                                  -- payload CSV brut
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_hotel_date   ON public.reconciliation_lines(hotel_id, line_date DESC);
CREATE INDEX IF NOT EXISTS idx_recon_status        ON public.reconciliation_lines(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_recon_source        ON public.reconciliation_lines(hotel_id, source);

DROP TRIGGER IF EXISTS trg_recon_updated_at ON public.reconciliation_lines;
CREATE TRIGGER trg_recon_updated_at
  BEFORE UPDATE ON public.reconciliation_lines
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.reconciliation_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recon_hotel_isolation ON public.reconciliation_lines;
CREATE POLICY recon_hotel_isolation ON public.reconciliation_lines
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- fec_exports — Historique immutable des exports FEC (DGFiP)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fec_exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  period_from     date NOT NULL,
  period_to       date NOT NULL,
  siren           text,
  filename        text NOT NULL,                          -- ex: 000000000FEC20260511.txt
  entries_count   int NOT NULL DEFAULT 0,
  total_debit     numeric(14,2) NOT NULL DEFAULT 0,
  total_credit    numeric(14,2) NOT NULL DEFAULT 0,
  is_balanced     boolean NOT NULL DEFAULT false,
  sha256_hash     text,                                   -- hash du fichier pour preuve d'intégrité
  generated_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- FEC immutable : ni UPDATE ni DELETE
CREATE OR REPLACE FUNCTION app.fec_exports_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'fec_exports are immutable — create a new export instead'; END;
$$;

DROP TRIGGER IF EXISTS trg_fec_no_update ON public.fec_exports;
CREATE TRIGGER trg_fec_no_update
  BEFORE UPDATE ON public.fec_exports FOR EACH ROW
  EXECUTE FUNCTION app.fec_exports_immutable();

DROP TRIGGER IF EXISTS trg_fec_no_delete ON public.fec_exports;
CREATE TRIGGER trg_fec_no_delete
  BEFORE DELETE ON public.fec_exports FOR EACH ROW
  EXECUTE FUNCTION app.fec_exports_immutable();

CREATE INDEX IF NOT EXISTS idx_fec_hotel_date ON public.fec_exports(hotel_id, created_at DESC);

ALTER TABLE public.fec_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fec_hotel_isolation ON public.fec_exports;
CREATE POLICY fec_hotel_isolation ON public.fec_exports
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- revenue_anomalies — Anomalies tarifaires / financières détectées (Revenue Integrity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revenue_anomalies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  reservation_id  uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  recon_line_id   uuid REFERENCES public.reconciliation_lines(id) ON DELETE SET NULL,
  anomaly_type    text NOT NULL,  -- 'PRICE_MISMATCH' | 'COMMISSION_ERROR' | 'TAX_ERROR' | 'PAYOUT_ERROR' | 'CURRENCY_ERROR'
  source          text,           -- OTA source
  severity        text NOT NULL DEFAULT 'warning',  -- 'info' | 'warning' | 'critical'
  score           numeric(5,2),   -- 0–100 (100 = parfait)
  expected_amount numeric(12,2),
  actual_amount   numeric(12,2),
  delta           numeric(12,2),  -- actual - expected
  description     text NOT NULL,
  details         jsonb,          -- calcul détaillé, règles utilisées
  status          text NOT NULL DEFAULT 'open',  -- 'open' | 'resolved' | 'ignored'
  resolved_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_hotel_date   ON public.revenue_anomalies(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_status        ON public.revenue_anomalies(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_anomaly_type          ON public.revenue_anomalies(hotel_id, anomaly_type);

DROP TRIGGER IF EXISTS trg_anomaly_updated_at ON public.revenue_anomalies;
CREATE TRIGGER trg_anomaly_updated_at
  BEFORE UPDATE ON public.revenue_anomalies
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.revenue_anomalies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anomaly_hotel_isolation ON public.revenue_anomalies;
CREATE POLICY anomaly_hotel_isolation ON public.revenue_anomalies
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- csv_import_templates — Templates de mapping CSV par source OTA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.csv_import_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name            text NOT NULL,
  source          text NOT NULL,  -- 'BOOKING' | 'EXPEDIA' | 'AIRBNB' | 'BANK_HOTEL'
  mapping         jsonb NOT NULL DEFAULT '{}',  -- { amount: "Montant", date: "Date", reference: "Référence" }
  default_currency char(3) NOT NULL DEFAULT 'EUR',
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, name)
);

CREATE INDEX IF NOT EXISTS idx_csv_tpl_hotel_source ON public.csv_import_templates(hotel_id, source);

DROP TRIGGER IF EXISTS trg_csv_tpl_updated_at ON public.csv_import_templates;
CREATE TRIGGER trg_csv_tpl_updated_at
  BEFORE UPDATE ON public.csv_import_templates
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.csv_import_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS csv_tpl_hotel_isolation ON public.csv_import_templates;
CREATE POLICY csv_tpl_hotel_isolation ON public.csv_import_templates
  USING (hotel_id = public.get_user_hotel_id());

-- ----------------------------------------------------------------------------
-- Extend audit_logs RLS to include SELECT for direction role
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_hotel_read ON public.audit_logs;
CREATE POLICY audit_hotel_read ON public.audit_logs
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

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

-- ============================================================================
-- FLOWTYM PMS — Migration 0040 : Anti-overbooking constraint
-- ----------------------------------------------------------------------------
-- Ajoute une contrainte d'exclusion PostgreSQL sur (room_id, période)
-- pour rendre l'overbooking structurellement impossible au niveau DB.
--
-- REQUIRES: extension btree_gist (disponible sur Supabase par défaut).
-- ============================================================================

-- Activation de l'extension (idempotent)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- Contrainte d'exclusion :
-- Deux réservations ne peuvent pas partager le même room_id
-- sur une période chevauchante (check_in, check_out) excluant les annulées.
--
-- Condition : uniquement sur statuts actifs (pas cancelled / checked_out)
-- Utilise un index partiel via WHERE dans la définition de la contrainte.
-- ----------------------------------------------------------------------------

-- On utilise une fonction pour éviter l'overbooking via un trigger
-- (la contrainte EXCLUDE ne supporte pas de WHERE sur d'autres colonnes).
CREATE OR REPLACE FUNCTION app.check_no_overbooking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ignorer les réservations annulées ou terminées
  IF NEW.status IN ('cancelled', 'checked_out', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Vérifier qu'il n'y a pas de réservation active chevauchante sur la même chambre
  IF NEW.room_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.room_id = NEW.room_id
      AND r.id <> NEW.id  -- exclure la réservation elle-même (UPDATE)
      AND r.status NOT IN ('cancelled', 'checked_out', 'no_show')
      -- Chevauchement : [new.check_in, new.check_out) ∩ [r.check_in, r.check_out) ≠ ∅
      AND NEW.check_in  < r.check_out
      AND NEW.check_out > r.check_in
  ) THEN
    RAISE EXCEPTION
      'OVERBOOKING_CONFLICT: La chambre % est déjà réservée du % au % pour cette période.',
      NEW.room_id,
      NEW.check_in,
      NEW.check_out
      USING ERRCODE = '23P01';  -- exclusion_violation
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT OR UPDATE pour attraper les conflits avant écriture
DROP TRIGGER IF EXISTS trg_no_overbooking ON public.reservations;
CREATE TRIGGER trg_no_overbooking
  BEFORE INSERT OR UPDATE OF room_id, check_in, check_out, status
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION app.check_no_overbooking();

-- ----------------------------------------------------------------------------
-- Index de performance pour la requête de détection de conflit
-- (room_id, check_in, check_out) — utilisé par le trigger ci-dessus
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reservations_room_dates
  ON public.reservations(room_id, check_in, check_out)
  WHERE status NOT IN ('cancelled', 'checked_out', 'no_show');

-- ----------------------------------------------------------------------------
-- Commentaire documentaire
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION app.check_no_overbooking IS
  'Empêche l overbooking : lève une exclusion_violation si room_id + période chevauche une réservation active existante.';

-- ============================================================================
-- FLOWTYM PMS — Seed 0050 : Données de démo Mas Provencal Aix
-- Hôtel ID : 00000000-0000-0000-0000-000000000001
-- Date de référence : 2026-05-13 (aujourd'hui)
-- ============================================================================

DO $$
DECLARE
  v_hotel_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_today     date := '2026-05-13';

  -- Room IDs
  r101 uuid := gen_random_uuid();
  r102 uuid := gen_random_uuid();
  r103 uuid := gen_random_uuid();
  r104 uuid := gen_random_uuid();
  r201 uuid := gen_random_uuid();
  r202 uuid := gen_random_uuid();
  r203 uuid := gen_random_uuid();
  r204 uuid := gen_random_uuid();
  r301 uuid := gen_random_uuid();
  r302 uuid := gen_random_uuid();
  r401 uuid := gen_random_uuid();
  r402 uuid := gen_random_uuid();

  -- Guest IDs
  g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
  g3 uuid := gen_random_uuid();
  g4 uuid := gen_random_uuid();
  g5 uuid := gen_random_uuid();
  g6 uuid := gen_random_uuid();
  g7 uuid := gen_random_uuid();
  g8 uuid := gen_random_uuid();
  g9 uuid := gen_random_uuid();
  g10 uuid := gen_random_uuid();

BEGIN

-- ─── 1. Chambres ─────────────────────────────────────────────────────────────
-- Nettoyage préalable pour idempotence
DELETE FROM public.rooms WHERE hotel_id = v_hotel_id;

INSERT INTO public.rooms (id, hotel_id, number, type, category, floor, status, housekeeping_status, capacity, base_rate, description) VALUES
  -- Étage 1 — Classiques
  (r101, v_hotel_id, '101', 'DBL', 'CL',  1, 'occupied', 'dirty',     2, 180.00, 'Chambre double classique, vue jardin'),
  (r102, v_hotel_id, '102', 'DBL', 'CL',  1, 'occupied', 'occupied',  2, 180.00, 'Chambre double classique, vue jardin'),
  (r103, v_hotel_id, '103', 'SGL', 'CL',  1, 'clean',    'clean',     1, 120.00, 'Chambre simple classique'),
  (r104, v_hotel_id, '104', 'TWN', 'CL',  1, 'dirty',    'dirty',     2, 190.00, 'Chambre twin classique'),
  -- Étage 2 — Supérieures
  (r201, v_hotel_id, '201', 'DBL', 'SUP', 2, 'clean',    'clean',     2, 220.00, 'Chambre double supérieure, vue piscine'),
  (r202, v_hotel_id, '202', 'DBL', 'SUP', 2, 'occupied', 'occupied',  2, 220.00, 'Chambre double supérieure, balcon'),
  (r203, v_hotel_id, '203', 'TWN', 'SUP', 2, 'clean',    'inspected', 2, 230.00, 'Chambre twin supérieure'),
  (r204, v_hotel_id, '204', 'DBL', 'SUP', 2, 'dirty',    'dirty',     2, 220.00, 'Chambre double supérieure'),
  -- Étage 3 — Deluxe
  (r301, v_hotel_id, '301', 'DBL', 'DLX', 3, 'occupied', 'occupied',  2, 280.00, 'Chambre double deluxe, terrasse'),
  (r302, v_hotel_id, '302', 'DBL', 'DLX', 3, 'clean',    'clean',     2, 280.00, 'Chambre double deluxe, terrasse'),
  -- Étage 4 — Suites
  (r401, v_hotel_id, '401', 'STE', 'JS',  4, 'occupied', 'occupied',  4, 420.00, 'Junior Suite avec salon et baignoire'),
  (r402, v_hotel_id, '402', 'STE', 'PS',  4, 'clean',    'clean',     4, 680.00, 'Suite Prestige avec jacuzzi et terrasse panoramique')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Guests ───────────────────────────────────────────────────────────────
DELETE FROM public.guests WHERE hotel_id = v_hotel_id;

INSERT INTO public.guests (id, hotel_id, first_name, last_name, email, phone, nationality, vip_level, total_stays, notes) VALUES
  (g1,  v_hotel_id, 'Sophie',    'Dubois',     'sophie.dubois@email.fr',    '+33 6 12 34 56 78', 'FR', 0, 3,  NULL),
  (g2,  v_hotel_id, 'Marc',      'Laurent',    'marc.laurent@company.com',  '+33 6 23 45 67 89', 'FR', 1, 8,  'Client fidèle — demande chambre calme'),
  (g3,  v_hotel_id, 'Emma',      'Wilson',     'emma.wilson@gmail.com',     '+44 7911 123456',   'GB', 0, 1,  NULL),
  (g4,  v_hotel_id, 'Thomas',    'Müller',     'thomas.muller@web.de',      '+49 170 1234567',   'DE', 0, 2,  'Allergie aux plumes'),
  (g5,  v_hotel_id, 'Isabella',  'Rossi',      'i.rossi@mail.it',           '+39 333 1234567',   'IT', 2, 12, 'VIP — Champagne offert à l arrivée'),
  (g6,  v_hotel_id, 'Jean-Paul', 'Bertrand',   'jpbertrand@groupe.fr',      '+33 6 45 67 89 01', 'FR', 0, 1,  'Groupe Bertrand & Associés — 4 chambres'),
  (g7,  v_hotel_id, 'Yuki',      'Tanaka',     'y.tanaka@softbank.jp',      '+81 90 1234 5678',  'JP', 1, 5,  'Préfère oreiller ferme'),
  (g8,  v_hotel_id, 'Chloé',     'Martin',     'chloe.martin@outlook.fr',   '+33 6 56 78 90 12', 'FR', 0, 2,  NULL),
  (g9,  v_hotel_id, 'Ahmad',     'Al-Rashidi', 'a.rashidi@invest.ae',       '+971 50 123 4567',  'AE', 2, 7,  'VIP — Suite uniquement. Transfert aéroport.'),
  (g10, v_hotel_id, 'Léa',       'Fontaine',   'lea.fontaine@media.fr',     '+33 6 67 89 01 23', 'FR', 0, 1,  NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Réservations ─────────────────────────────────────────────────────────
-- Couvre : arrivées du jour, départs du jour, in-house, demain, J+7

DELETE FROM public.reservations WHERE hotel_id = v_hotel_id;

INSERT INTO public.reservations (
  id, hotel_id, room_id, guest_id,
  reference, guest_name, guest_email, guest_phone,
  room_number, room_type, room_category,
  check_in, check_out, nights,
  adults, children, pax,
  status, checkin_status, payment_status,
  total_amount, paid_amount, solde,
  source, segment, notes, version
) VALUES

-- ── Arrivées aujourd'hui (check_in = today) ──────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r103, g3,
  'RES-001', 'Emma Wilson', 'emma.wilson@gmail.com', '+44 7911 123456',
  '103', 'SGL', 'CL', v_today, v_today + 3, 3,
  1, 0, 1, 'confirmed', 'expected', 'unpaid',
  360.00, 0.00, 360.00, 'BOOKING', 'loisir',
  'Arrivée vers 15h. Vue jardin demandée.', 1
),
(
  gen_random_uuid(), v_hotel_id, r201, g4,
  'RES-002', 'Thomas Müller', 'thomas.muller@web.de', '+49 170 1234567',
  '201', 'DBL', 'SUP', v_today, v_today + 2, 2,
  2, 0, 2, 'confirmed', 'expected', 'partial',
  440.00, 220.00, 220.00, 'EXPEDIA', 'loisir',
  'Allergie aux plumes — prévoir oreillers synthétiques.', 1
),
(
  gen_random_uuid(), v_hotel_id, r402, g9,
  'RES-003', 'Ahmad Al-Rashidi', 'a.rashidi@invest.ae', '+971 50 123 4567',
  '402', 'STE', 'PS', v_today, v_today + 5, 5,
  2, 0, 2, 'confirmed', 'expected', 'paid',
  3400.00, 3400.00, 0.00, 'DIRECT', 'affaires',
  'VIP Suite Prestige. Transfert aéroport 14h. Champagne Billecart-Salmon.', 1
),

-- ── Départs aujourd'hui (check_out = today) ───────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r101, g1,
  'RES-004', 'Sophie Dubois', 'sophie.dubois@email.fr', '+33 6 12 34 56 78',
  '101', 'DBL', 'CL', v_today - 2, v_today, 2,
  2, 0, 2, 'checked_in', 'checked_in', 'paid',
  360.00, 360.00, 0.00, 'DIRECT', 'loisir',
  'Départ prévu avant 11h.', 1
),
(
  gen_random_uuid(), v_hotel_id, r301, g5,
  'RES-005', 'Isabella Rossi', 'i.rossi@mail.it', '+39 333 1234567',
  '301', 'DBL', 'DLX', v_today - 4, v_today, 4,
  2, 1, 3, 'checked_in', 'checked_in', 'paid',
  1120.00, 1120.00, 0.00, 'BOOKING', 'loisir',
  'VIP — Champagne offert servi hier soir. Excellent séjour.', 1
),

-- ── In-house (check_in < today < check_out) ───────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r102, g2,
  'RES-006', 'Marc Laurent', 'marc.laurent@company.com', '+33 6 23 45 67 89',
  '102', 'DBL', 'CL', v_today - 1, v_today + 2, 3,
  1, 0, 1, 'checked_in', 'checked_in', 'partial',
  540.00, 270.00, 270.00, 'DIRECT', 'affaires',
  'Client fidèle. Chambre calme demandée côté jardin.', 1
),
(
  gen_random_uuid(), v_hotel_id, r202, g7,
  'RES-007', 'Yuki Tanaka', 'y.tanaka@softbank.jp', '+81 90 1234 5678',
  '202', 'DBL', 'SUP', v_today - 2, v_today + 1, 3,
  2, 0, 2, 'checked_in', 'checked_in', 'paid',
  660.00, 660.00, 0.00, 'EXPEDIA', 'affaires',
  'Préfère oreiller ferme. Petit-déjeuner en chambre à 7h30.', 1
),
(
  gen_random_uuid(), v_hotel_id, r401, g6,
  'RES-008', 'Jean-Paul Bertrand', 'jpbertrand@groupe.fr', '+33 6 45 67 89 01',
  '401', 'STE', 'JS', v_today - 1, v_today + 3, 4,
  3, 1, 4, 'checked_in', 'checked_in', 'unpaid',
  1680.00, 0.00, 1680.00, 'DIRECT', 'groupe',
  'Séminaire Bertrand & Associés. Facturation société.', 1
),

-- ── Arrivées demain ───────────────────────────────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r203, g8,
  'RES-009', 'Chloé Martin', 'chloe.martin@outlook.fr', '+33 6 56 78 90 12',
  '203', 'TWN', 'SUP', v_today + 1, v_today + 4, 3,
  2, 0, 2, 'confirmed', 'expected', 'paid',
  690.00, 690.00, 0.00, 'AIRBNB', 'loisir',
  NULL, 1
),
(
  gen_random_uuid(), v_hotel_id, r302, g10,
  'RES-010', 'Léa Fontaine', 'lea.fontaine@media.fr', '+33 6 67 89 01 23',
  '302', 'DBL', 'DLX', v_today + 1, v_today + 3, 2,
  2, 0, 2, 'confirmed', 'expected', 'unpaid',
  560.00, 0.00, 560.00, 'BOOKING', 'loisir',
  NULL, 1
),

-- ── Réservations futures J+3 à J+10 ──────────────────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r101, g1,
  'RES-011', 'Sophie Dubois', 'sophie.dubois@email.fr', '+33 6 12 34 56 78',
  '101', 'DBL', 'CL', v_today + 7, v_today + 10, 3,
  2, 0, 2, 'confirmed', 'expected', 'partial',
  540.00, 270.00, 270.00, 'DIRECT', 'loisir',
  'Retour client — même chambre demandée.', 1
),
(
  gen_random_uuid(), v_hotel_id, r104, g4,
  'RES-012', 'Thomas Müller', 'thomas.muller@web.de', '+49 170 1234567',
  '104', 'TWN', 'CL', v_today + 5, v_today + 8, 3,
  2, 1, 3, 'confirmed', 'expected', 'unpaid',
  570.00, 0.00, 570.00, 'EXPEDIA', 'loisir',
  NULL, 1
),

-- ── Réservation annulée (pour tester le filtre) ───────────────────────────────
(
  gen_random_uuid(), v_hotel_id, r204, NULL,
  'RES-013', 'Client Annulé', NULL, NULL,
  '204', 'DBL', 'SUP', v_today, v_today + 2, 2,
  2, 0, 2, 'cancelled', NULL, 'unpaid',
  440.00, 0.00, 440.00, 'BOOKING', 'loisir',
  'Annulation J-1 — pénalité applicable.', 1
)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Données reconciliation (pour Reconciliation Center) ──────────────────
DELETE FROM public.reconciliation_lines WHERE hotel_id = v_hotel_id;

INSERT INTO public.reconciliation_lines (
  hotel_id, source, reference, description,
  amount, currency, line_date, status, match_score, match_delta
) VALUES
  (v_hotel_id, 'BOOKING',    'BK-PAYOUT-2026-04-15', 'Booking.com — Payout mid-Apr',   707.20, 'EUR', '2026-04-15', 'pending', 60.40, 4.80),
  (v_hotel_id, 'EXPEDIA',    'EX-PAYOUT-2026-04-29', 'Expedia — Payout Apr',            244.32, 'EUR', '2026-04-29', 'pending', 84.00, 0.00),
  (v_hotel_id, 'BOOKING',    'BK-PAYOUT-2026-04-30', 'Booking.com — Payout Apr',       1862.50, 'EUR', '2026-05-03', 'pending', NULL,  NULL),
  (v_hotel_id, 'BANK_HOTEL', 'CB-2026-05-01',        'Encaissement CB direct',          1750.00, 'EUR', '2026-05-05', 'pending', 80.00, 0.00),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-001',      'Test CSV import 1',                250.00, 'EUR', '2026-05-10', 'pending', 87.64, 5.68),
  (v_hotel_id, 'BOOKING',    'TEST-RECON-001',       NULL,                               100.00, 'EUR', '2026-05-10', 'pending', 49.00, 193.40),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-002',      'Test CSV import 2',                375.50, 'EUR', '2026-05-11', 'pending', 49.00, 82.10),
  (v_hotel_id, 'BOOKING',    'BK-CSV-TEST-003',      'Test CSV import 3',                118.75, 'EUR', '2026-05-12', 'pending', 47.00, 174.65),
  -- 1 ligne rapprochée
  (v_hotel_id, 'BOOKING',    'BK-MATCHED-001',       'Booking.com — RES-006',            540.00, 'EUR', '2026-05-12', 'matched', 99.00, 0.00);

-- ─── 5. Anomalies Revenue Integrity (pour Revenue Integrity SAS) ──────────────
DELETE FROM public.revenue_anomalies WHERE hotel_id = v_hotel_id;

INSERT INTO public.revenue_anomalies (
  hotel_id, anomaly_type, source, severity, score,
  expected_amount, actual_amount, delta,
  description, status, details
) VALUES
  (
    v_hotel_id, 'COMMISSION_ERROR', 'BOOKING', 'critical', 42.00,
    89.00, 53.00, -36.00,
    'Commission Booking.com incorrecte sur RES-002 : 15% appliqués au lieu de 12% contractuels.',
    'open',
    '{"rule": "commission_rate", "contracted": 0.12, "applied": 0.15, "reservation": "RES-002"}'::jsonb
  ),
  (
    v_hotel_id, 'PAYOUT_ERROR', 'EXPEDIA', 'warning', 68.00,
    244.32, 208.10, -36.22,
    'Payout Expedia avril : écart de 36,22€ non justifié par les frais de service.',
    'open',
    '{"payout_ref": "EX-PAYOUT-2026-04-29", "expected_net": 244.32, "received": 208.10}'::jsonb
  ),
  (
    v_hotel_id, 'PRICE_MISMATCH', 'BOOKING', 'warning', 75.00,
    360.00, 342.00, -18.00,
    'Tarif transmis par Booking pour RES-001 inférieur au tarif PMS : 114€/nuit vs 120€/nuit.',
    'open',
    '{"reservation": "RES-001", "pms_rate": 120, "ota_rate": 114, "nights": 3}'::jsonb
  ),
  (
    v_hotel_id, 'TAX_ERROR', 'AIRBNB', 'info', 88.00,
    690.00, 689.60, -0.40,
    'Arrondi taxe de séjour Airbnb sur RES-009 : écart de 0,40€ en défaveur de l hôtel.',
    'open',
    '{"reservation": "RES-009", "tax_expected": 4.60, "tax_applied": 4.20}'::jsonb
  ),
  (
    v_hotel_id, 'COMMISSION_ERROR', 'EXPEDIA', 'critical', 38.00,
    55.00, 82.50, 27.50,
    'Sur-commission Expedia sur RES-007 : 12,5% prélevés au lieu de 10% contractuels.',
    'resolved',
    '{"rule": "commission_rate", "contracted": 0.10, "applied": 0.125, "reservation": "RES-007"}'::jsonb
  );

RAISE NOTICE 'Seed 0050 terminé : 12 chambres, 10 guests, 13 réservations, 9 lignes bancaires, 5 anomalies Revenue Integrity.';

END $$;
