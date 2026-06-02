-- =============================================================================
-- 20260629_conversations_socle.sql  (Lot L2 — socle Conversations, EN PARALLÈLE)
-- =============================================================================
-- OBJECTIF :
--   Construire la nouvelle architecture "Conversations" SANS rien casser :
--     * conversation_threads      — une conversation (par hôtel/canal/contact)
--     * conversation_messages     — messages in/out (miroir de communication_logs)
--     * conversation_participants — acteurs (guest, staff, system, external)
--
--   Prépare dès maintenant : Email / SMS / WhatsApp / futur chat interne, les
--   messages ENTRANTS (direction inbound) et les états delivered/read pour les
--   webhooks futurs (NON implémentés ici).
--
-- COMPATIBILITÉ (impératif) :
--   * communication_logs / communication_templates / hotel_*_settings : INTACTS.
--   * communication_logs reste la source de vérité ; conversations est peuplée
--     EN PLUS par dual-write guardé dans les edge functions.
--   * Aucun écran existant n'est modifié.
--
-- SÉCURITÉ : isolation par hotel_id via public.get_user_hotel_id() (RLS SELECT).
--   Écriture par service_role (edge functions) ou via RPC SECURITY DEFINER.
--
-- ROLLBACK : voir 20260629_conversations_socle_rollback.sql.
-- IDEMPOTENT : peut être relancée sans dommage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Types ENUM (idempotents) — extensibles via ALTER TYPE ... ADD VALUE
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conv_channel') THEN
    CREATE TYPE public.conv_channel AS ENUM ('email', 'sms', 'whatsapp', 'internal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conv_direction') THEN
    CREATE TYPE public.conv_direction AS ENUM ('inbound', 'outbound');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conv_message_status') THEN
    CREATE TYPE public.conv_message_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. conversation_threads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_threads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  channel              public.conv_channel NOT NULL,
  contact_address      text NOT NULL DEFAULT '',     -- email / numéro du client (clé naturelle)
  guest_id             uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_id       uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  subject              text,
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'closed')),
  assigned_to          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at      timestamptz,
  last_message_preview text,
  last_direction       public.conv_direction,
  unread_count         integer NOT NULL DEFAULT 0,
  external_id          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_threads_natural_key
  ON public.conversation_threads (hotel_id, channel, contact_address);
CREATE INDEX IF NOT EXISTS conversation_threads_hotel_idx
  ON public.conversation_threads (hotel_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS conversation_threads_guest_idx
  ON public.conversation_threads (guest_id);
CREATE INDEX IF NOT EXISTS conversation_threads_reservation_idx
  ON public.conversation_threads (reservation_id);

COMMENT ON TABLE public.conversation_threads IS
  'Une conversation (par hôtel/canal/contact). Rattachée quand connu à guest_id et reservation_id. Architecture L2 construite en parallèle de communication_logs.';

ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_threads_select ON public.conversation_threads;
CREATE POLICY conversation_threads_select ON public.conversation_threads
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());

DROP TRIGGER IF EXISTS trg_conversation_threads_updated ON public.conversation_threads;
CREATE TRIGGER trg_conversation_threads_updated
  BEFORE UPDATE ON public.conversation_threads
  FOR EACH ROW EXECUTE FUNCTION public.comm_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. conversation_messages  (miroir de communication_logs pour backfill 1-1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id            uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  hotel_id             uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  channel              public.conv_channel NOT NULL,
  direction            public.conv_direction NOT NULL,
  status               public.conv_message_status NOT NULL DEFAULT 'queued',
  guest_id             uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_id       uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  from_address         text,
  to_address           text,
  subject              text,
  body                 text,
  template_kind        text,
  provider             text,
  provider_message_id  text,
  error_message        text,
  created_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  communication_log_id uuid REFERENCES public.communication_logs(id) ON DELETE SET NULL,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at              timestamptz,
  delivered_at         timestamptz,
  read_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_thread_idx
  ON public.conversation_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_messages_hotel_idx
  ON public.conversation_messages (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_messages_guest_idx
  ON public.conversation_messages (guest_id);
CREATE INDEX IF NOT EXISTS conversation_messages_reservation_idx
  ON public.conversation_messages (reservation_id);
CREATE INDEX IF NOT EXISTS conversation_messages_log_idx
  ON public.conversation_messages (communication_log_id);

COMMENT ON TABLE public.conversation_messages IS
  'Messages d''une conversation (inbound/outbound). Colonnes alignées sur communication_logs ; communication_log_id trace la ligne legacy correspondante (dual-write).';

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_messages_select ON public.conversation_messages;
CREATE POLICY conversation_messages_select ON public.conversation_messages
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- -----------------------------------------------------------------------------
-- 4. conversation_participants
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  hotel_id     uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('guest', 'staff', 'system', 'external')),
  guest_id     uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  display_name text,
  address      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Dédup robuste (les NULL ne cassent pas l'unicité grâce aux COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS conversation_participants_uniq
  ON public.conversation_participants (
    thread_id, role,
    COALESCE(guest_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(user_id,  '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(address, '')
  );
CREATE INDEX IF NOT EXISTS conversation_participants_thread_idx
  ON public.conversation_participants (thread_id);

COMMENT ON TABLE public.conversation_participants IS
  'Acteurs d''une conversation : guest, staff (user), system, external. Prépare le futur chat interne Flowtym.';

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_participants_select ON public.conversation_participants;
CREATE POLICY conversation_participants_select ON public.conversation_participants
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- -----------------------------------------------------------------------------
-- 5. Trigger : maintenir l'entête du thread à jour à chaque message
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conversations_bump_thread()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.conversation_threads t
     SET last_message_at      = COALESCE(NEW.sent_at, NEW.created_at),
         last_message_preview = left(COALESCE(NEW.subject, NEW.body, ''), 180),
         last_direction       = NEW.direction,
         unread_count         = CASE WHEN NEW.direction = 'inbound'
                                     THEN t.unread_count + 1 ELSE t.unread_count END,
         updated_at           = now()
   WHERE t.id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_bump_thread ON public.conversation_messages;
CREATE TRIGGER trg_conversations_bump_thread
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.conversations_bump_thread();

-- -----------------------------------------------------------------------------
-- 6. RPC conversation_get_or_create_thread — find-or-create hôtel-scopé
--    (utilisable par le frontend/staff ; les edge functions écrivent en direct)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conversation_get_or_create_thread(
  p_channel         public.conv_channel,
  p_contact_address text,
  p_guest_id        uuid DEFAULT NULL,
  p_reservation_id  uuid DEFAULT NULL,
  p_subject         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hotel  uuid;
  v_thread uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN
    RAISE EXCEPTION 'Aucun hôtel actif pour l''utilisateur courant';
  END IF;

  INSERT INTO public.conversation_threads (hotel_id, channel, contact_address, guest_id, reservation_id, subject)
  VALUES (v_hotel, p_channel, COALESCE(p_contact_address, ''), p_guest_id, p_reservation_id, p_subject)
  ON CONFLICT (hotel_id, channel, contact_address) DO UPDATE
    SET guest_id       = COALESCE(public.conversation_threads.guest_id, EXCLUDED.guest_id),
        reservation_id = COALESCE(EXCLUDED.reservation_id, public.conversation_threads.reservation_id),
        updated_at     = now()
  RETURNING id INTO v_thread;

  -- Participant guest (idempotent)
  IF p_guest_id IS NOT NULL THEN
    INSERT INTO public.conversation_participants (thread_id, hotel_id, role, guest_id, address)
    VALUES (v_thread, v_hotel, 'guest', p_guest_id, p_contact_address)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_thread;
END;
$$;

REVOKE ALL ON FUNCTION public.conversation_get_or_create_thread(public.conv_channel, text, uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.conversation_get_or_create_thread(public.conv_channel, text, uuid, uuid, text) TO authenticated;

-- =============================================================================
-- FIN 20260629_conversations_socle.sql
-- =============================================================================
