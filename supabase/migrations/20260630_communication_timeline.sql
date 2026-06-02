-- =============================================================================
-- 20260630_communication_timeline.sql  (Lot L3 — Journal Unifié)
-- =============================================================================
-- OBJECTIF :
--   Fournir une TIMELINE UNIFIÉE chronologique des communications, agrégeant
--   en une seule liste normalisée 5 sources RÉELLES :
--     1. conversation_messages   (socle L2 ; email/sms/whatsapp/internal, in/out,
--        + delivered/read pour l'inbound futur)
--     2. communication_logs      EN ANTI-JOINTURE (historique non encore
--        dual-écrit) → l'historique apparaît sans backfill ni doublon
--     3. guest_badge_history     (actions CRM : badges VIP/blacklist… ajout/retrait)
--     4. communication_internal_notes (NOUVEAU ; notes internes créables)
--     5. guest_incidents         (actions CRM : réclamations, no-show…)
--
-- PRINCIPES :
--   * communication_logs / communication_templates / settings : INTACTS.
--   * Réutilise le socle Conversations (L2). Prépare l'inbound (L7).
--   * Données réelles uniquement — aucun mock.
--   * Isolation stricte par hotel_id (RPC SECURITY DEFINER ; filtrage explicite).
--
-- ROLLBACK : supabase/rollback/20260630_communication_timeline_rollback.sql
-- IDEMPOTENT : peut être relancée sans dommage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. communication_internal_notes — notes internes (timeline)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_internal_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  guest_id       uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  body           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communication_internal_notes_guest_idx
  ON public.communication_internal_notes (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS communication_internal_notes_reservation_idx
  ON public.communication_internal_notes (reservation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS communication_internal_notes_hotel_idx
  ON public.communication_internal_notes (hotel_id, created_at DESC);

COMMENT ON TABLE public.communication_internal_notes IS
  'Notes internes rattachées à un client et/ou une réservation, affichées dans le Journal Unifié des communications (L3).';

ALTER TABLE public.communication_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_internal_notes_select ON public.communication_internal_notes;
CREATE POLICY communication_internal_notes_select ON public.communication_internal_notes
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());
-- L'écriture passe par la RPC add_internal_note (SECURITY DEFINER).

-- -----------------------------------------------------------------------------
-- 2. guest_incidents — table d'incidents CRM (idempotente).
--    Forme alignée sur frontend/src/services/crm/risk.service.ts (GuestIncident).
--    CREATE IF NOT EXISTS : no-op si la table existe déjà sur le projet cible.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  guest_id      uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  type          text NOT NULL,
  description   text,
  incident_date date NOT NULL DEFAULT current_date,
  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_incidents_guest_idx
  ON public.guest_incidents (guest_id, incident_date DESC);

ALTER TABLE public.guest_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_incidents_select ON public.guest_incidents;
CREATE POLICY guest_incidents_select ON public.guest_incidents
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- -----------------------------------------------------------------------------
-- 3. RPC add_internal_note — créer une note interne (hôtel-scopé, audité)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_internal_note(
  p_guest_id       uuid,
  p_reservation_id uuid,
  p_body           text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hotel uuid;
  v_actor uuid;
  v_id    uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN
    RAISE EXCEPTION 'Aucun hôtel actif pour l''utilisateur courant';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Le contenu de la note est vide';
  END IF;

  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  INSERT INTO public.communication_internal_notes
    (hotel_id, guest_id, reservation_id, author_user_id, body)
  VALUES
    (v_hotel, p_guest_id, p_reservation_id, v_actor, trim(p_body))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_internal_note(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_internal_note(uuid, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC communication_timeline — agrégateur normalisé, chronologique
-- -----------------------------------------------------------------------------
--   Paramètres :
--     p_guest_id        — scoper sur un client (toutes réservations)
--     p_reservation_id  — scoper sur une réservation
--     p_limit           — taille de page (défaut 50, max 200)
--     p_before          — keyset : ne renvoyer que les entrées AVANT cet instant
--   Sémantique de filtrage : une entrée est retenue si elle correspond au client
--   OU à la réservation fournis (au moins un des deux requis).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.communication_timeline(
  p_guest_id       uuid DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL,
  p_limit          integer DEFAULT 50,
  p_before         timestamptz DEFAULT NULL
)
RETURNS TABLE (
  entry_type      text,
  entry_id        uuid,
  occurred_at     timestamptz,
  channel         text,
  direction       text,
  status          text,
  actor_user_id   uuid,
  actor_name      text,
  subject         text,
  body            text,
  contact_address text,
  attachments     jsonb,
  metadata        jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hotel uuid;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL OR (p_guest_id IS NULL AND p_reservation_id IS NULL) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH unified AS (
    -- (1) Messages du socle Conversations (L2)
    SELECT
      'message'::text                              AS entry_type,
      m.id                                         AS entry_id,
      COALESCE(m.sent_at, m.created_at)            AS occurred_at,
      m.channel::text                              AS channel,
      m.direction::text                            AS direction,
      m.status::text                               AS status,
      m.created_by                                 AS actor_user_id,
      COALESCE(u.full_name, u.email)               AS actor_name,
      m.subject                                    AS subject,
      m.body                                       AS body,
      COALESCE(m.to_address, m.from_address)       AS contact_address,
      COALESCE(m.metadata -> 'attachments', '[]'::jsonb) AS attachments,
      m.metadata                                   AS metadata
    FROM public.conversation_messages m
    LEFT JOIN public.users u ON u.id = m.created_by
    WHERE m.hotel_id = v_hotel
      AND (
        (p_guest_id       IS NOT NULL AND m.guest_id       = p_guest_id) OR
        (p_reservation_id IS NOT NULL AND m.reservation_id = p_reservation_id)
      )

    UNION ALL

    -- (2) Historique communication_logs NON dual-écrit (anti-jointure)
    SELECT
      'message'::text,
      cl.id,
      COALESCE(cl.sent_at, cl.created_at),
      cl.channel::text,
      cl.direction::text,
      cl.status::text,
      cl.created_by,
      COALESCE(u.full_name, u.email),
      cl.subject,
      cl.body,
      COALESCE(cl.to_address, cl.from_address),
      '[]'::jsonb,
      '{}'::jsonb
    FROM public.communication_logs cl
    LEFT JOIN public.users u ON u.id = cl.created_by
    WHERE cl.hotel_id = v_hotel
      AND NOT EXISTS (
        SELECT 1 FROM public.conversation_messages cm
        WHERE cm.communication_log_id = cl.id
      )
      AND (
        (p_guest_id       IS NOT NULL AND cl.guest_id       = p_guest_id) OR
        (p_reservation_id IS NOT NULL AND cl.reservation_id = p_reservation_id)
      )

    UNION ALL

    -- (3) Actions CRM : changements de badge
    SELECT
      'badge'::text,
      h.id,
      h.changed_at,
      'crm'::text,
      NULL::text,
      'updated'::text,
      h.changed_by,
      COALESCE(u.full_name, u.email),
      'Badges'::text,
      trim(both ' ·' FROM
        CASE WHEN (SELECT count(*) FROM (SELECT unnest(h.new_badges) EXCEPT SELECT unnest(h.old_badges)) a) > 0
             THEN 'Ajouté : ' || (SELECT string_agg(x, ', ') FROM (SELECT unnest(h.new_badges) EXCEPT SELECT unnest(h.old_badges)) AS t(x))
             ELSE '' END
        || CASE WHEN (SELECT count(*) FROM (SELECT unnest(h.old_badges) EXCEPT SELECT unnest(h.new_badges)) r) > 0
             THEN ' · Retiré : ' || (SELECT string_agg(x, ', ') FROM (SELECT unnest(h.old_badges) EXCEPT SELECT unnest(h.new_badges)) AS t(x))
             ELSE '' END
      ),
      NULL::text,
      '[]'::jsonb,
      jsonb_build_object('source', h.source, 'old', to_jsonb(h.old_badges), 'new', to_jsonb(h.new_badges))
    FROM public.guest_badge_history h
    LEFT JOIN public.users u ON u.id = h.changed_by
    WHERE h.hotel_id = v_hotel
      AND (
        (p_guest_id       IS NOT NULL AND h.guest_id       = p_guest_id) OR
        (p_reservation_id IS NOT NULL AND h.reservation_id = p_reservation_id)
      )

    UNION ALL

    -- (4) Notes internes
    SELECT
      'note'::text,
      n.id,
      n.created_at,
      'internal'::text,
      NULL::text,
      'note'::text,
      n.author_user_id,
      COALESCE(u.full_name, u.email),
      'Note interne'::text,
      n.body,
      NULL::text,
      '[]'::jsonb,
      '{}'::jsonb
    FROM public.communication_internal_notes n
    LEFT JOIN public.users u ON u.id = n.author_user_id
    WHERE n.hotel_id = v_hotel
      AND (
        (p_guest_id       IS NOT NULL AND n.guest_id       = p_guest_id) OR
        (p_reservation_id IS NOT NULL AND n.reservation_id = p_reservation_id)
      )

    UNION ALL

    -- (5) Actions CRM : incidents (scope client uniquement — pas de reservation_id)
    SELECT
      'incident'::text,
      i.id,
      i.incident_date::timestamptz,
      'crm'::text,
      NULL::text,
      i.type,
      i.created_by,
      COALESCE(u.full_name, u.email),
      'Incident'::text,
      i.description,
      NULL::text,
      '[]'::jsonb,
      jsonb_build_object('type', i.type)
    FROM public.guest_incidents i
    LEFT JOIN public.users u ON u.id = i.created_by
    WHERE i.hotel_id = v_hotel
      AND p_guest_id IS NOT NULL AND i.guest_id = p_guest_id
  )
  SELECT *
  FROM unified
  WHERE (p_before IS NULL OR unified.occurred_at < p_before)
  ORDER BY unified.occurred_at DESC, unified.entry_id DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.communication_timeline(uuid, uuid, integer, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.communication_timeline(uuid, uuid, integer, timestamptz) TO authenticated;

-- =============================================================================
-- FIN 20260630_communication_timeline.sql
-- =============================================================================
