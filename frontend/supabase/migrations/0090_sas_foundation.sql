-- ============================================================================
-- FLOWTYM PMS — Migration 0090 : SAS Foundation
-- ----------------------------------------------------------------------------
-- SAS = Système d'Acquisition et de Supervision
-- Couvre : Revenue Integrity Engine (RIE) + ODMS + Quarantaine + Partenaires
-- Principe : hotel_id tenant isolation sur toutes les tables
--            Logs immuables, append-only sur validations et disputes
-- ============================================================================

-- ─── PARTENAIRES OTA ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_partners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  code         text NOT NULL,                     -- 'BOOKING', 'EXPEDIA', 'AIRBNB'
  name         text NOT NULL,
  status       text NOT NULL DEFAULT 'active'     -- 'active' | 'suspended' | 'inactive'
               CHECK (status IN ('active', 'suspended', 'inactive')),
  timezone     text NOT NULL DEFAULT 'Europe/Paris',
  currency     char(3) NOT NULL DEFAULT 'EUR',
  country      char(2),
  api_provider text,                              -- 'channel_manager' | 'webhook' | 'manual'
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sas_partners_hotel ON public.sas_partners(hotel_id);

DROP TRIGGER IF EXISTS trg_sas_partners_updated ON public.sas_partners;
CREATE TRIGGER trg_sas_partners_updated
  BEFORE UPDATE ON public.sas_partners
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.sas_partners ENABLE ROW LEVEL SECURITY;

-- ─── MODÈLES DE COLLECTE PAR PARTENAIRE ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_partner_payment_models (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id       uuid NOT NULL REFERENCES public.sas_partners(id) ON DELETE CASCADE,
  collection_type  text NOT NULL   -- 'HOTEL_COLLECT'|'OTA_COLLECT'|'VIRTUAL_CARD'|'HYBRID'|'PAY_AT_PROPERTY'
                   CHECK (collection_type IN ('HOTEL_COLLECT','OTA_COLLECT','VIRTUAL_CARD','HYBRID_COLLECT','PAY_AT_PROPERTY')),
  commission_mode  text            -- 'PERCENTAGE' | 'FIXED' | 'HYBRID'
                   CHECK (commission_mode IN ('PERCENTAGE','FIXED','HYBRID')),
  commission_value numeric(5,2),
  payout_mode      text DEFAULT 'POST_PAID'
                   CHECK (payout_mode IN ('POST_PAID','PRE_DEDUCTED')),
  detection_rules  jsonb DEFAULT '[]',  -- règles configurables pour détection auto
  is_default       boolean NOT NULL DEFAULT false,
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sas_payment_models_partner ON public.sas_partner_payment_models(partner_id);

ALTER TABLE public.sas_partner_payment_models ENABLE ROW LEVEL SECURITY;

-- ─── COMMISSIONS PAR PARTENAIRE (versionnées) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_partner_commissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id    uuid NOT NULL REFERENCES public.sas_partners(id) ON DELETE CASCADE,
  rate          numeric(5,2) NOT NULL,             -- ex: 15.00 pour 15%
  fixed_amount  numeric(10,2),                     -- pour mode FIXED
  valid_from    date NOT NULL,
  valid_to      date,                              -- NULL = illimité
  applies_to    text DEFAULT 'GROSS'               -- 'GROSS' | 'NET' | 'AFTER_PROMO'
                CHECK (applies_to IN ('GROSS','NET','AFTER_PROMO')),
  notes         text,
  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sas_commissions_partner ON public.sas_partner_commissions(partner_id, valid_from DESC);

ALTER TABLE public.sas_partner_commissions ENABLE ROW LEVEL SECURITY;

-- ─── PROMOTIONS OTA ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_partner_promotions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id               uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id             uuid NOT NULL REFERENCES public.sas_partners(id) ON DELETE CASCADE,
  code                   text NOT NULL,
  name                   text NOT NULL,
  promo_type             text NOT NULL   -- 'MOBILE_RATE'|'GENIUS'|'EARLY_BOOKING'|'LAST_MINUTE'|'COUPON'|'MEMBER_RATE'|'PREFERRED'
                         CHECK (promo_type IN ('MOBILE_RATE','GENIUS','EARLY_BOOKING','LAST_MINUTE','COUPON','MEMBER_RATE','PREFERRED','PRIVATE','GEO')),
  discount_type          text NOT NULL   -- 'PERCENTAGE' | 'FIXED'
                         CHECK (discount_type IN ('PERCENTAGE','FIXED')),
  discount_value         numeric(10,2) NOT NULL,
  cumulative             boolean NOT NULL DEFAULT false,
  priority               int NOT NULL DEFAULT 0,
  valid_from             date,
  valid_to               date,
  applies_to_room_types  jsonb DEFAULT '[]',
  applies_to_rate_plans  jsonb DEFAULT '[]',
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sas_promotions_partner ON public.sas_partner_promotions(partner_id);

ALTER TABLE public.sas_partner_promotions ENABLE ROW LEVEL SECURITY;

-- ─── RÉSERVATIONS ENTRANTES (avant validation RIE) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_incoming_reservations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id        uuid REFERENCES public.sas_partners(id) ON DELETE SET NULL,
  -- Données brutes de l'OTA
  ota_reference     text NOT NULL,               -- ref OTA (ex: BDC-12345678)
  raw_payload       jsonb NOT NULL,              -- payload brut OTA reçu
  -- Données extraites
  guest_name        text,
  check_in          date,
  check_out         date,
  room_type         text,
  adults            int DEFAULT 1,
  children          int DEFAULT 0,
  ota_amount        numeric(12,2),               -- montant transmis par l'OTA
  ota_currency      char(3) DEFAULT 'EUR',
  ota_commission    numeric(5,2),                -- commission déclarée par l'OTA
  collection_type   text,                        -- détecté automatiquement
  -- Statut de traitement
  rie_status        text NOT NULL DEFAULT 'pending'
                    CHECK (rie_status IN ('pending','validating','approved','warning','manual_review','quarantined','rejected')),
  rie_score         numeric(5,2),               -- 0-100
  -- Lien vers la réservation PMS si intégrée
  reservation_id    uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  -- Meta
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, ota_reference)
);

CREATE INDEX IF NOT EXISTS idx_sas_incoming_hotel_status ON public.sas_incoming_reservations(hotel_id, rie_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sas_incoming_partner      ON public.sas_incoming_reservations(partner_id);

DROP TRIGGER IF EXISTS trg_sas_incoming_updated ON public.sas_incoming_reservations;
CREATE TRIGGER trg_sas_incoming_updated
  BEFORE UPDATE ON public.sas_incoming_reservations
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.sas_incoming_reservations ENABLE ROW LEVEL SECURITY;

-- ─── VALIDATIONS RIE (immutables) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_validations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  incoming_id         uuid NOT NULL REFERENCES public.sas_incoming_reservations(id) ON DELETE CASCADE,
  partner_id          uuid REFERENCES public.sas_partners(id) ON DELETE SET NULL,
  -- Calcul RIE
  pms_base_rate       numeric(12,2),             -- tarif PMS pour la période
  promo_deduction     numeric(12,2) DEFAULT 0,   -- déduction promotions
  tax_amount          numeric(12,2) DEFAULT 0,   -- taxes applicables
  commission_rate     numeric(5,2),              -- taux commission contractuel
  commission_amount   numeric(12,2),             -- montant commission calculé
  expected_amount     numeric(12,2),             -- montant attendu final
  received_amount     numeric(12,2),             -- montant reçu de l'OTA
  deviation           numeric(12,2),             -- écart €
  deviation_pct       numeric(5,2),              -- écart %
  -- Score et décision
  score               numeric(5,2) NOT NULL DEFAULT 0,
  decision            text NOT NULL              -- 'AUTO_APPROVED'|'WARNING'|'MANUAL_REVIEW'|'QUARANTINED'|'BLOCKED'
                      CHECK (decision IN ('AUTO_APPROVED','WARNING','MANUAL_REVIEW','QUARANTINED','BLOCKED')),
  -- Détail audit
  anomalies           jsonb DEFAULT '[]',         -- [{ type, severity, description, deviation }]
  calculation_detail  jsonb DEFAULT '{}',         -- calcul step-by-step
  promotions_applied  jsonb DEFAULT '[]',         -- promotions détectées
  collection_type     text,                       -- modèle de collecte détecté
  -- Immutabilité
  validated_at        timestamptz NOT NULL DEFAULT now(),
  validated_by        text DEFAULT 'RIE_ENGINE'  -- 'RIE_ENGINE' ou user_id si manuel
);

-- Immutable : pas de UPDATE ni DELETE
CREATE OR REPLACE FUNCTION app.sas_validations_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'sas_validations are immutable — audit trail cannot be modified.';
END;
$$;

DROP TRIGGER IF EXISTS trg_sas_validations_no_update ON public.sas_validations;
CREATE TRIGGER trg_sas_validations_no_update
  BEFORE UPDATE ON public.sas_validations FOR EACH ROW
  EXECUTE FUNCTION app.sas_validations_immutable();

DROP TRIGGER IF EXISTS trg_sas_validations_no_delete ON public.sas_validations;
CREATE TRIGGER trg_sas_validations_no_delete
  BEFORE DELETE ON public.sas_validations FOR EACH ROW
  EXECUTE FUNCTION app.sas_validations_immutable();

CREATE INDEX IF NOT EXISTS idx_sas_validations_hotel   ON public.sas_validations(hotel_id, validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sas_validations_partner ON public.sas_validations(partner_id, score);
CREATE INDEX IF NOT EXISTS idx_sas_validations_decision ON public.sas_validations(hotel_id, decision);

ALTER TABLE public.sas_validations ENABLE ROW LEVEL SECURITY;

-- ─── QUARANTAINE ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_quarantine (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  incoming_id     uuid NOT NULL REFERENCES public.sas_incoming_reservations(id) ON DELETE CASCADE,
  validation_id   uuid REFERENCES public.sas_validations(id) ON DELETE SET NULL,
  virtual_room    text,                           -- chambre virtuelle Q-{ref}
  reason          text NOT NULL,
  quarantined_at  timestamptz NOT NULL DEFAULT now(),
  quarantined_by  text DEFAULT 'RIE_ENGINE',
  released_at     timestamptz,
  released_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  release_note    text,
  status          text NOT NULL DEFAULT 'QUARANTINED'
                  CHECK (status IN ('QUARANTINED','RELEASED','DISPUTED','CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_sas_quarantine_hotel  ON public.sas_quarantine(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_sas_quarantine_status ON public.sas_quarantine(status, quarantined_at DESC);

ALTER TABLE public.sas_quarantine ENABLE ROW LEVEL SECURITY;

-- ─── ODMS — LITIGES OTA ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_disputes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  reference        text NOT NULL,                 -- ex: DISP-2026-00001
  incoming_id      uuid REFERENCES public.sas_incoming_reservations(id) ON DELETE SET NULL,
  validation_id    uuid REFERENCES public.sas_validations(id) ON DELETE SET NULL,
  partner_id       uuid REFERENCES public.sas_partners(id) ON DELETE SET NULL,
  -- Montants
  expected_amount  numeric(12,2),
  received_amount  numeric(12,2),
  claimed_amount   numeric(12,2),                 -- montant réclamé à l'OTA
  recovered_amount numeric(12,2) DEFAULT 0,       -- montant récupéré
  -- Contenu
  subject          text,
  explanation      text,
  email_subject    text,
  email_body       text,
  recipients       jsonb DEFAULT '[]',            -- emails OTA à contacter
  -- Statut workflow
  status           text NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','SENT','ACKNOWLEDGED','IN_REVIEW','CORRECTED','REJECTED','CLOSED','ESCALATED')),
  -- Dates clés
  sent_at          timestamptz,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz,
  next_followup_at timestamptz,                   -- J+2, J+5, J+10
  followup_count   int NOT NULL DEFAULT 0,
  -- Meta
  created_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_sas_disputes_hotel  ON public.sas_disputes(hotel_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sas_disputes_partner ON public.sas_disputes(partner_id, status);

DROP TRIGGER IF EXISTS trg_sas_disputes_updated ON public.sas_disputes;
CREATE TRIGGER trg_sas_disputes_updated
  BEFORE UPDATE ON public.sas_disputes
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.sas_disputes ENABLE ROW LEVEL SECURITY;

-- ─── ODMS — MESSAGES / TIMELINE ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_dispute_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  dispute_id  uuid NOT NULL REFERENCES public.sas_disputes(id) ON DELETE CASCADE,
  direction   text NOT NULL CHECK (direction IN ('OUTBOUND','INBOUND','INTERNAL')),
  content     text NOT NULL,
  attachments jsonb DEFAULT '[]',
  sent_at     timestamptz,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sas_dispute_msgs ON public.sas_dispute_messages(dispute_id, created_at ASC);

ALTER TABLE public.sas_dispute_messages ENABLE ROW LEVEL SECURITY;

-- ─── ODMS — HISTORIQUE STATUTS (immutable) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_dispute_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  dispute_id  uuid NOT NULL REFERENCES public.sas_disputes(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text NOT NULL,
  reason      text,
  changed_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- Immutable
CREATE OR REPLACE FUNCTION app.sas_dispute_history_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'dispute status history is immutable'; END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_hist_no_update ON public.sas_dispute_status_history;
CREATE TRIGGER trg_dispute_hist_no_update
  BEFORE UPDATE ON public.sas_dispute_status_history FOR EACH ROW
  EXECUTE FUNCTION app.sas_dispute_history_immutable();

CREATE INDEX IF NOT EXISTS idx_sas_dispute_hist ON public.sas_dispute_status_history(dispute_id, changed_at ASC);

ALTER TABLE public.sas_dispute_status_history ENABLE ROW LEVEL SECURITY;

-- ─── NUMÉROTATION AUTO DISPUTES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_dispute_sequences (
  hotel_id  uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  year      int  NOT NULL,
  last_seq  int  NOT NULL DEFAULT 0,
  PRIMARY KEY (hotel_id, year)
);

CREATE OR REPLACE FUNCTION public.next_dispute_reference(p_hotel_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM now());
  v_seq  int;
BEGIN
  INSERT INTO public.sas_dispute_sequences (hotel_id, year, last_seq)
  VALUES (p_hotel_id, v_year, 1)
  ON CONFLICT (hotel_id, year) DO UPDATE
    SET last_seq = sas_dispute_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN 'DISP-' || v_year || '-' || LPAD(v_seq::text, 5, '0');
END;
$$;

-- ─── RÈGLES DE SCORING (configurables par hotel/partenaire) ──────────────────

CREATE TABLE IF NOT EXISTS public.sas_scoring_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id      uuid REFERENCES public.sas_partners(id) ON DELETE CASCADE, -- NULL = règle globale
  rule_name       text NOT NULL,
  -- Seuils de décision
  auto_approve_min  numeric(5,2) NOT NULL DEFAULT 95,
  warning_min       numeric(5,2) NOT NULL DEFAULT 85,
  manual_review_min numeric(5,2) NOT NULL DEFAULT 70,
  -- Seuils d'anomalies
  price_deviation_pct    numeric(5,2) NOT NULL DEFAULT 5,
  commission_deviation_pct numeric(5,2) NOT NULL DEFAULT 2,
  -- Meta
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, partner_id)
);

ALTER TABLE public.sas_scoring_rules ENABLE ROW LEVEL SECURITY;

-- Règles par défaut globales (seront créées via seed partenaires)

-- ─── FIABILITÉ PARTENAIRE (rolling 30j — rafraîchi périodiquement) ────────────

CREATE TABLE IF NOT EXISTS public.sas_partner_reliability (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  partner_id          uuid NOT NULL REFERENCES public.sas_partners(id) ON DELETE CASCADE,
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  total_validations   int NOT NULL DEFAULT 0,
  avg_score           numeric(5,2),
  auto_rate_pct       numeric(5,2),
  manual_rate_pct     numeric(5,2),
  quarantine_rate_pct numeric(5,2),
  total_deviation     numeric(12,2) DEFAULT 0,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, partner_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_sas_reliability ON public.sas_partner_reliability(hotel_id, partner_id, period_start DESC);

ALTER TABLE public.sas_partner_reliability ENABLE ROW LEVEL SECURITY;

-- ─── VUE MATÉRIALISÉE : compteurs pour les bulles de nav ─────────────────────
-- Refratchie à chaque mutation sur sas_incoming_reservations et sas_validations

CREATE OR REPLACE VIEW public.sas_nav_badges AS
SELECT
  hotel_id,
  COUNT(*) FILTER (
    WHERE rie_status = 'pending'
  ) AS pending_count,
  COUNT(*) FILTER (
    WHERE rie_status IN ('quarantined', 'manual_review')
  ) AS anomaly_count
FROM public.sas_incoming_reservations
GROUP BY hotel_id;

GRANT SELECT ON public.sas_nav_badges TO authenticated;

-- ─── RLS DYNAMIQUE (identique au pattern 0010) ───────────────────────────────
-- Les tables avec hotel_id héritent automatiquement de la RLS policy
-- via le bloc dynamique de 0010 — elles sont déjà couvertes.
-- On ajoute manuellement celles qui ont des contraintes supplémentaires.

-- sas_partner_commissions : édition restreinte à direction
DROP POLICY IF EXISTS sas_commissions_direction ON public.sas_partner_commissions;
CREATE POLICY sas_commissions_direction ON public.sas_partner_commissions
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction')
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction');

-- sas_scoring_rules : édition restreinte à direction
DROP POLICY IF EXISTS sas_scoring_direction ON public.sas_scoring_rules;
CREATE POLICY sas_scoring_direction ON public.sas_scoring_rules
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction')
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction');

-- Lecture universelle pour les tables de consultation RIE
DROP POLICY IF EXISTS sas_validations_read ON public.sas_validations;
CREATE POLICY sas_validations_read ON public.sas_validations
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS sas_quarantine_all ON public.sas_quarantine;
CREATE POLICY sas_quarantine_all ON public.sas_quarantine
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS sas_disputes_all ON public.sas_disputes;
CREATE POLICY sas_disputes_all ON public.sas_disputes
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS sas_incoming_all ON public.sas_incoming_reservations;
CREATE POLICY sas_incoming_all ON public.sas_incoming_reservations
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS sas_partners_read ON public.sas_partners;
CREATE POLICY sas_partners_read ON public.sas_partners
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS sas_partners_write ON public.sas_partners;
CREATE POLICY sas_partners_write ON public.sas_partners
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction')
  WITH CHECK (hotel_id = public.get_user_hotel_id() AND public.get_user_role() = 'direction');
