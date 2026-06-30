-- =============================================================================
-- 20260627_communication_and_badges.sql
-- =============================================================================
-- OBJECTIF :
--   Donner une existence RÉELLE (base + RLS + historique) aux 3 actions du menu
--   "⋮" de Flowday / Vue du jour :
--     1. Envoyer un email au client       → hotel_email_settings + communication_logs
--     2. Envoyer un message WhatsApp       → hotel_whatsapp_settings + communication_logs
--     3. Modifier le badge client          → guests.badges + guest_badge_history
--
-- PRINCIPES DE SÉCURITÉ :
--   * Isolation stricte par hotel_id via public.get_user_hotel_id() (RLS).
--   * AUCUN secret (token Meta, mot de passe SMTP, refresh token OAuth) n'est
--     stocké dans une table lisible par le frontend. Les secrets vivent dans
--     public._hotel_communication_secrets : RLS activée + aucune policy +
--     REVOKE pour public/anon/authenticated → seul service_role (edge functions)
--     y accède. L'écriture passe par la RPC SECURITY DEFINER set_communication_secret().
--   * Le frontend ne sait que "secret présent : oui/non" via has_communication_secret().
--
-- IDEMPOTENT : peut être relancée sans dommage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper updated_at (réutilisé par toutes les tables de cette migration)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comm_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. guests.badges — badges opérationnels persistés (visibles partout)
-- -----------------------------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS badges text[] NOT NULL DEFAULT '{}';

-- guests.vip est dérivée des badges par set_guest_badges(). Certains schémas
-- legacy ne l'ont pas → on la garantit ici pour que la RPC ne casse jamais.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS vip boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.guests.badges IS
  'Badges opérationnels du client (vip, habitue, corporate, attention, pmr, blacklist, litige, preference). Source de vérité affichée dans Flowday, Planning, fiche réservation, CRM.';

-- -----------------------------------------------------------------------------
-- 2. hotel_email_settings — config email PAR HÔTEL (sans secret)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hotel_email_settings (
  hotel_id          uuid PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  provider          text NOT NULL DEFAULT 'smtp'
                      CHECK (provider IN ('smtp', 'resend', 'gmail_oauth', 'microsoft_graph')),
  from_email        text,
  from_name         text,
  reply_to          text,
  -- SMTP (le mot de passe est un secret → table privée, jamais ici)
  smtp_host         text,
  smtp_port         integer,
  smtp_username     text,
  smtp_secure       boolean NOT NULL DEFAULT true,
  -- OAuth (account email mappé ; tokens = secrets → table privée)
  oauth_account     text,
  is_active         boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'disconnected'
                      CHECK (connection_status IN ('disconnected', 'connected', 'error')),
  last_tested_at    timestamptz,
  last_error        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hotel_email_settings IS
  'Configuration email par hôtel. Les emails partent de l''adresse de l''hôtel (from_email), jamais d''une adresse Flowtym générique. Aucun secret ici.';

ALTER TABLE public.hotel_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_email_settings_select ON public.hotel_email_settings;
CREATE POLICY hotel_email_settings_select ON public.hotel_email_settings
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS hotel_email_settings_insert ON public.hotel_email_settings;
CREATE POLICY hotel_email_settings_insert ON public.hotel_email_settings
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS hotel_email_settings_update ON public.hotel_email_settings;
CREATE POLICY hotel_email_settings_update ON public.hotel_email_settings
  FOR UPDATE TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP TRIGGER IF EXISTS trg_hotel_email_settings_updated ON public.hotel_email_settings;
CREATE TRIGGER trg_hotel_email_settings_updated
  BEFORE UPDATE ON public.hotel_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.comm_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. hotel_whatsapp_settings — config WhatsApp Business PAR HÔTEL (sans secret)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hotel_whatsapp_settings (
  hotel_id             uuid PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  meta_business_id     text,
  waba_id              text,          -- WhatsApp Business Account ID
  phone_number_id      text,
  display_phone_number text,
  -- access_token + webhook_verify_token = secrets → table privée
  is_active            boolean NOT NULL DEFAULT false,
  connection_status    text NOT NULL DEFAULT 'disconnected'
                         CHECK (connection_status IN ('disconnected', 'connected', 'error')),
  last_tested_at       timestamptz,
  last_error           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hotel_whatsapp_settings IS
  'Configuration WhatsApp Business par hôtel. Chaque hôtel connecte son PROPRE WhatsApp Business Account — jamais un compte Flowtym commun. Le token Meta est un secret stocké côté serveur.';

ALTER TABLE public.hotel_whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_whatsapp_settings_select ON public.hotel_whatsapp_settings;
CREATE POLICY hotel_whatsapp_settings_select ON public.hotel_whatsapp_settings
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS hotel_whatsapp_settings_insert ON public.hotel_whatsapp_settings;
CREATE POLICY hotel_whatsapp_settings_insert ON public.hotel_whatsapp_settings
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS hotel_whatsapp_settings_update ON public.hotel_whatsapp_settings;
CREATE POLICY hotel_whatsapp_settings_update ON public.hotel_whatsapp_settings
  FOR UPDATE TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP TRIGGER IF EXISTS trg_hotel_whatsapp_settings_updated ON public.hotel_whatsapp_settings;
CREATE TRIGGER trg_hotel_whatsapp_settings_updated
  BEFORE UPDATE ON public.hotel_whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.comm_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 4. communication_templates — modèles email / WhatsApp PAR HÔTEL
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  kind        text NOT NULL CHECK (kind IN (
                'confirmation', 'pre_arrival', 'checkin', 'invoice', 'reminder', 'free')),
  name        text NOT NULL,
  subject     text,             -- email uniquement
  body        text NOT NULL,
  language    text NOT NULL DEFAULT 'fr',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communication_templates_hotel_idx
  ON public.communication_templates (hotel_id, channel, kind);

COMMENT ON TABLE public.communication_templates IS
  'Modèles de message par hôtel et par canal. Variables supportées dans body/subject : {{guest}}, {{room}}, {{reservation}}, {{checkin}}, {{checkout}}, {{hotel}}.';

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_templates_select ON public.communication_templates;
CREATE POLICY communication_templates_select ON public.communication_templates
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

DROP POLICY IF EXISTS communication_templates_modify ON public.communication_templates;
CREATE POLICY communication_templates_modify ON public.communication_templates
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

DROP TRIGGER IF EXISTS trg_communication_templates_updated ON public.communication_templates;
CREATE TRIGGER trg_communication_templates_updated
  BEFORE UPDATE ON public.communication_templates
  FOR EACH ROW EXECUTE FUNCTION public.comm_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 5. communication_logs — journal de TOUS les envois (email + WhatsApp)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  channel             text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  direction           text NOT NULL DEFAULT 'outbound'
                        CHECK (direction IN ('outbound', 'inbound')),
  guest_id            uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_id      uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  to_address          text,            -- email destinataire OU numéro WhatsApp
  from_address        text,
  subject             text,
  body                text,
  template_kind       text,
  status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'sent', 'failed')),
  provider            text,            -- 'resend' | 'smtp' | 'gmail_oauth' | 'microsoft_graph' | 'whatsapp_cloud'
  provider_message_id text,
  error_message       text,
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communication_logs_hotel_idx
  ON public.communication_logs (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS communication_logs_reservation_idx
  ON public.communication_logs (reservation_id);
CREATE INDEX IF NOT EXISTS communication_logs_guest_idx
  ON public.communication_logs (guest_id);

COMMENT ON TABLE public.communication_logs IS
  'Journal des communications client (email/WhatsApp), rattaché au guest et à la réservation. Inséré par les edge functions (service_role) après tentative d''envoi.';

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- Lecture hôtel-scopée. L'écriture vient des edge functions (service_role, bypass RLS).
DROP POLICY IF EXISTS communication_logs_select ON public.communication_logs;
CREATE POLICY communication_logs_select ON public.communication_logs
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- -----------------------------------------------------------------------------
-- 6. guest_badge_history — historique des changements de badge
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_badge_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  guest_id       uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  old_badges     text[] NOT NULL DEFAULT '{}',
  new_badges     text[] NOT NULL DEFAULT '{}',
  changed_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source         text NOT NULL DEFAULT 'flowday',
  changed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_badge_history_guest_idx
  ON public.guest_badge_history (guest_id, changed_at DESC);

COMMENT ON TABLE public.guest_badge_history IS
  'Audit des changements de badge client : qui, quand, ancienne valeur, nouvelle valeur.';

ALTER TABLE public.guest_badge_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_badge_history_select ON public.guest_badge_history;
CREATE POLICY guest_badge_history_select ON public.guest_badge_history
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id());
-- Insert se fait via la RPC set_guest_badges (SECURITY DEFINER).

-- -----------------------------------------------------------------------------
-- 7. _hotel_communication_secrets — secrets serveur-only (jamais au frontend)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._hotel_communication_secrets (
  hotel_id    uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  secret_key  text NOT NULL,   -- ex: 'smtp_password', 'access_token', 'refresh_token', 'webhook_verify_token'
  secret_value text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, channel, secret_key)
);

ALTER TABLE public._hotel_communication_secrets ENABLE ROW LEVEL SECURITY;
-- Aucune policy = aucune ligne visible pour authenticated/anon. Seul service_role bypasse RLS.
REVOKE ALL ON TABLE public._hotel_communication_secrets FROM public, anon, authenticated;
GRANT ALL ON TABLE public._hotel_communication_secrets TO service_role;

COMMENT ON TABLE public._hotel_communication_secrets IS
  'Secrets de communication (tokens Meta, mot de passe SMTP, refresh tokens OAuth). Lisible UNIQUEMENT par service_role (edge functions). Écriture via RPC set_communication_secret().';

-- -----------------------------------------------------------------------------
-- 8. RPC set_communication_secret — écrit un secret sans jamais le relire au front
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_communication_secret(
  p_channel    text,
  p_secret_key text,
  p_value      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hotel uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN
    RAISE EXCEPTION 'Aucun hôtel actif pour l''utilisateur courant';
  END IF;
  IF p_channel NOT IN ('email', 'whatsapp') THEN
    RAISE EXCEPTION 'Canal invalide: %', p_channel;
  END IF;

  IF p_value IS NULL OR length(trim(p_value)) = 0 THEN
    -- Valeur vide = suppression du secret
    DELETE FROM public._hotel_communication_secrets
     WHERE hotel_id = v_hotel AND channel = p_channel AND secret_key = p_secret_key;
    RETURN;
  END IF;

  INSERT INTO public._hotel_communication_secrets (hotel_id, channel, secret_key, secret_value, updated_at)
  VALUES (v_hotel, p_channel, p_secret_key, p_value, now())
  ON CONFLICT (hotel_id, channel, secret_key)
  DO UPDATE SET secret_value = EXCLUDED.secret_value, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_communication_secret(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_communication_secret(text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. RPC has_communication_secret — le front sait juste "présent: oui/non"
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_communication_secret(
  p_channel    text,
  p_secret_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hotel uuid;
  v_exists boolean;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public._hotel_communication_secrets
     WHERE hotel_id = v_hotel AND channel = p_channel AND secret_key = p_secret_key
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;

REVOKE ALL ON FUNCTION public.has_communication_secret(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_communication_secret(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. RPC set_guest_badges — met à jour les badges + historise + dérive vip/blacklist
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_guest_badges(
  p_guest_id       uuid,
  p_badges         text[],
  p_reservation_id uuid DEFAULT NULL,
  p_source         text DEFAULT 'flowday'
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hotel    uuid;
  v_old      text[];
  v_guest_hotel uuid;
  v_actor    uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN
    RAISE EXCEPTION 'Aucun hôtel actif pour l''utilisateur courant';
  END IF;

  -- Vérifier que le guest appartient bien à l'hôtel actif (isolation)
  SELECT hotel_id, COALESCE(badges, '{}') INTO v_guest_hotel, v_old
    FROM public.guests WHERE id = p_guest_id;
  IF v_guest_hotel IS NULL THEN
    RAISE EXCEPTION 'Client introuvable: %', p_guest_id;
  END IF;
  IF v_guest_hotel <> v_hotel THEN
    RAISE EXCEPTION 'Accès refusé : le client n''appartient pas à l''hôtel actif';
  END IF;

  -- Acteur (id interne users) si résoluble
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid();

  UPDATE public.guests
     SET badges      = COALESCE(p_badges, '{}'),
         vip         = ('vip' = ANY(COALESCE(p_badges, '{}'))),
         blacklisted = ('blacklist' = ANY(COALESCE(p_badges, '{}'))),
         updated_at  = now()
   WHERE id = p_guest_id;

  -- Historiser uniquement si changement réel
  IF v_old IS DISTINCT FROM COALESCE(p_badges, '{}') THEN
    INSERT INTO public.guest_badge_history
      (hotel_id, guest_id, reservation_id, old_badges, new_badges, changed_by, source)
    VALUES
      (v_hotel, p_guest_id, p_reservation_id, v_old, COALESCE(p_badges, '{}'), v_actor, COALESCE(p_source, 'flowday'));
  END IF;

  RETURN COALESCE(p_badges, '{}');
END;
$$;

REVOKE ALL ON FUNCTION public.set_guest_badges(uuid, text[], uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_guest_badges(uuid, text[], uuid, text) TO authenticated;

-- =============================================================================
-- FIN 20260627_communication_and_badges.sql
-- =============================================================================
