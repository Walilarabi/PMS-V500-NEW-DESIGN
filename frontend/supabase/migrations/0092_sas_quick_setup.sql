-- ============================================================================
-- FLOWTYM — SQL rapide pour débloquer le module SAS ODMS
-- À coller dans le Supabase SQL Editor
-- ============================================================================

-- 1. Table sas_disputes (minimale)
CREATE TABLE IF NOT EXISTS public.sas_disputes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid NOT NULL,
  reference        text NOT NULL,
  incoming_id      uuid,
  validation_id    uuid,
  partner_id       uuid,
  expected_amount  numeric(12,2),
  received_amount  numeric(12,2),
  claimed_amount   numeric(12,2),
  recovered_amount numeric(12,2) DEFAULT 0,
  subject          text,
  explanation      text,
  email_subject    text,
  email_body       text,
  recipients       jsonb DEFAULT '[]',
  status           text NOT NULL DEFAULT 'DRAFT',
  sent_at          timestamptz,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz,
  next_followup_at timestamptz,
  followup_count   int NOT NULL DEFAULT 0,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, reference)
);

-- 2. Table sas_dispute_status_history (pour la timeline)
CREATE TABLE IF NOT EXISTS public.sas_dispute_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL,
  dispute_id  uuid NOT NULL REFERENCES public.sas_disputes(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text NOT NULL,
  reason      text,
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Table sas_dispute_messages (pour la timeline)
CREATE TABLE IF NOT EXISTS public.sas_dispute_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL,
  dispute_id  uuid NOT NULL REFERENCES public.sas_disputes(id) ON DELETE CASCADE,
  direction   text NOT NULL DEFAULT 'INTERNAL',
  content     text NOT NULL,
  attachments jsonb DEFAULT '[]',
  sent_at     timestamptz,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. Table sas_partners (minimale)
CREATE TABLE IF NOT EXISTS public.sas_partners (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              uuid NOT NULL,
  code                  text NOT NULL,
  name                  text NOT NULL,
  status                text NOT NULL DEFAULT 'active',
  timezone              text NOT NULL DEFAULT 'Europe/Paris',
  currency              char(3) NOT NULL DEFAULT 'EUR',
  country               char(2),
  api_provider          text,
  metadata              jsonb DEFAULT '{}',
  account_manager_name  text,
  account_manager_email text,
  support_email         text,
  dispute_email         text,
  phone                 text,
  contract_reference    text,
  commission_rate       numeric(5,2),
  auto_send_disputes    boolean NOT NULL DEFAULT false,
  dispute_sla_days      int NOT NULL DEFAULT 7,
  followup_days         int[] NOT NULL DEFAULT '{2,5,10}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, code)
);

-- 5. Table sas_email_logs
CREATE TABLE IF NOT EXISTS public.sas_email_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid NOT NULL,
  dispute_id   uuid REFERENCES public.sas_disputes(id) ON DELETE SET NULL,
  followup_id  uuid,
  resend_id    text UNIQUE,
  from_email   text NOT NULL,
  to_emails    jsonb NOT NULL DEFAULT '[]',
  subject      text NOT NULL,
  status       text NOT NULL DEFAULT 'queued',
  sent_at      timestamptz,
  error_msg    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 6. RLS - isolement par hotel_id
ALTER TABLE public.sas_disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_disputes_rls ON public.sas_disputes;
CREATE POLICY sas_disputes_rls ON public.sas_disputes
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

ALTER TABLE public.sas_dispute_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_messages_rls ON public.sas_dispute_messages;
CREATE POLICY sas_messages_rls ON public.sas_dispute_messages
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

ALTER TABLE public.sas_dispute_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_history_rls ON public.sas_dispute_status_history;
CREATE POLICY sas_history_rls ON public.sas_dispute_status_history
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

ALTER TABLE public.sas_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_partners_rls ON public.sas_partners;
CREATE POLICY sas_partners_rls ON public.sas_partners
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

ALTER TABLE public.sas_email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_email_logs_rls ON public.sas_email_logs;
CREATE POLICY sas_email_logs_rls ON public.sas_email_logs
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- 7. Trigger updated_at sur sas_disputes
DROP TRIGGER IF EXISTS trg_sas_disputes_updated ON public.sas_disputes;
CREATE TRIGGER trg_sas_disputes_updated
  BEFORE UPDATE ON public.sas_disputes
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- 8. Seed partenaires OTA (Booking + Expedia) pour l'hôtel demo
-- Récupérer l'hotel_id du user connecté
DO $$
DECLARE v_hotel_id uuid := public.get_user_hotel_id();
BEGIN
  IF v_hotel_id IS NOT NULL THEN
    INSERT INTO public.sas_partners
      (hotel_id, code, name, currency, dispute_email, account_manager_email, commission_rate, dispute_sla_days)
    VALUES
      (v_hotel_id, 'BOOKING',  'Booking.com',   'EUR', 'disputes@booking.com',  'partner@booking.com',  15.00, 7),
      (v_hotel_id, 'EXPEDIA',  'Expedia Group', 'USD', 'disputes@expedia.com',  'partner@expedia.com',  18.00, 7),
      (v_hotel_id, 'AIRBNB',   'Airbnb',        'EUR', 'disputes@airbnb.com',   'partner@airbnb.com',   14.00, 10),
      (v_hotel_id, 'DIRECT',   'Direct',        'EUR', NULL,                    NULL,                    0.00, 0)
    ON CONFLICT (hotel_id, code) DO NOTHING;
    RAISE NOTICE 'Partenaires OTA créés pour hotel_id %', v_hotel_id;
  ELSE
    RAISE NOTICE 'Aucun hotel_id trouvé pour cet utilisateur';
  END IF;
END $$;

SELECT 'SAS ODMS prêt ✅' as status;
