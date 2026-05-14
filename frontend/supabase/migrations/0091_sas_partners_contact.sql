-- ============================================================================
-- FLOWTYM PMS — Migration 0091 : Extension partenaires + suivi litiges
-- ----------------------------------------------------------------------------
-- Ajoute :
--   * Champs contact OTA sur sas_partners (email dispute, chargé de compte...)
--   * sas_dispute_proofs — pièces jointes / preuves par litige
--   * sas_dispute_followups — suivi des relances planifiées
-- ============================================================================

-- ─── Extension sas_partners avec champs contact ──────────────────────────────

ALTER TABLE public.sas_partners
  ADD COLUMN IF NOT EXISTS account_manager_name  text,
  ADD COLUMN IF NOT EXISTS account_manager_email text,
  ADD COLUMN IF NOT EXISTS support_email         text,
  ADD COLUMN IF NOT EXISTS dispute_email         text,    -- email principal réclamations
  ADD COLUMN IF NOT EXISTS phone                 text,
  ADD COLUMN IF NOT EXISTS contract_reference    text,
  ADD COLUMN IF NOT EXISTS commission_rate       numeric(5,2),   -- taux global (raccourci)
  ADD COLUMN IF NOT EXISTS auto_send_disputes    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_sla_days      int NOT NULL DEFAULT 7,   -- SLA réponse en jours
  ADD COLUMN IF NOT EXISTS followup_days         int[] NOT NULL DEFAULT '{2,5,10}'; -- J+2, J+5, J+10

-- ─── Preuves / pièces jointes par litige ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_dispute_proofs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  dispute_id  uuid NOT NULL REFERENCES public.sas_disputes(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  file_type   text NOT NULL DEFAULT 'application/pdf',  -- MIME type
  file_size   int,                                       -- bytes
  storage_url text,                                      -- Supabase Storage URL
  description text,
  proof_type  text NOT NULL DEFAULT 'calculation'        -- 'calculation'|'screenshot'|'email'|'contract'|'other'
              CHECK (proof_type IN ('calculation','screenshot','email','contract','pms_export','other')),
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sas_proofs_dispute ON public.sas_dispute_proofs(dispute_id);

ALTER TABLE public.sas_dispute_proofs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_proofs_all ON public.sas_dispute_proofs;
CREATE POLICY sas_proofs_all ON public.sas_dispute_proofs
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─── Relances planifiées (ODMS followup scheduler) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_dispute_followups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  dispute_id    uuid NOT NULL REFERENCES public.sas_disputes(id) ON DELETE CASCADE,
  scheduled_at  timestamptz NOT NULL,               -- quand envoyer la relance
  followup_day  int NOT NULL,                        -- J+2, J+5, J+10
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','cancelled','skipped')),
  sent_at       timestamptz,
  email_id      text,                               -- ID email Resend (pour tracking)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sas_followups_dispute ON public.sas_dispute_followups(dispute_id);
CREATE INDEX IF NOT EXISTS idx_sas_followups_scheduled ON public.sas_dispute_followups(scheduled_at, status)
  WHERE status = 'pending';

ALTER TABLE public.sas_dispute_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_followups_all ON public.sas_dispute_followups;
CREATE POLICY sas_followups_all ON public.sas_dispute_followups
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─── Email logs (tracking envois Resend) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sas_email_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  dispute_id   uuid REFERENCES public.sas_disputes(id) ON DELETE SET NULL,
  followup_id  uuid REFERENCES public.sas_dispute_followups(id) ON DELETE SET NULL,
  resend_id    text UNIQUE,                         -- ID retourné par Resend API
  from_email   text NOT NULL,
  to_emails    jsonb NOT NULL DEFAULT '[]',
  subject      text NOT NULL,
  status       text NOT NULL DEFAULT 'queued'       -- 'queued'|'sent'|'delivered'|'bounced'|'failed'
               CHECK (status IN ('queued','sent','delivered','bounced','failed')),
  sent_at      timestamptz,
  error_msg    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sas_email_logs_dispute ON public.sas_email_logs(dispute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sas_email_logs_resend  ON public.sas_email_logs(resend_id);

ALTER TABLE public.sas_email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sas_email_logs_all ON public.sas_email_logs;
CREATE POLICY sas_email_logs_all ON public.sas_email_logs
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());
