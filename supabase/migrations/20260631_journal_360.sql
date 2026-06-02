-- =============================================================================
-- 20260631_journal_360.sql  (Lot L3.1 — Journal Client 360°)
-- =============================================================================
-- OBJECTIF :
--   1. Pièces jointes : table communication_attachments + bucket Storage privé
--      + policies hôtel-scopées + RPC register/delete.
--   2. RPC communication_timeline_v2 : agrégateur UNIQUE et chronologique qui
--      étend la v1 (communication) avec les ÉVÉNEMENTS PMS (cycle de vie
--      réservation via audit_logs) et FINANCE (payments, invoices,
--      invoice_lines), catégorise chaque entrée et applique des filtres serveur
--      (catégorie, canal, utilisateur, période, recherche) + pagination keyset.
--
-- COMPATIBILITÉ :
--   * communication_timeline (v1) CONSERVÉE (aucune rupture L3).
--   * Aucune table existante modifiée ni supprimée.
--   * Événements couverts par des tables VÉRIFIÉES uniquement (audit_logs,
--     payments, invoices, invoice_lines) → aucune dépendance incertaine.
--
-- ROLLBACK : supabase/rollback/20260631_journal_360_rollback.sql
-- IDEMPOTENT.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. communication_attachments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_attachments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  message_id           uuid REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  communication_log_id uuid REFERENCES public.communication_logs(id)    ON DELETE SET NULL,
  guest_id             uuid REFERENCES public.guests(id)        ON DELETE SET NULL,
  reservation_id       uuid REFERENCES public.reservations(id)  ON DELETE SET NULL,
  storage_bucket       text NOT NULL DEFAULT 'communication-attachments',
  storage_path         text NOT NULL,
  original_filename    text NOT NULL,
  mime_type            text NOT NULL,
  size_bytes           bigint NOT NULL DEFAULT 0,
  kind                 text,        -- invoice|contract|quote|id_doc|email_in|email_out|other
  direction            text,        -- inbound|outbound|internal
  uploaded_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communication_attachments_path_uniq UNIQUE (hotel_id, storage_path)
);

CREATE INDEX IF NOT EXISTS communication_attachments_hotel_idx   ON public.communication_attachments (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS communication_attachments_guest_idx   ON public.communication_attachments (guest_id);
CREATE INDEX IF NOT EXISTS communication_attachments_resa_idx    ON public.communication_attachments (reservation_id);
CREATE INDEX IF NOT EXISTS communication_attachments_message_idx ON public.communication_attachments (message_id);
CREATE INDEX IF NOT EXISTS communication_attachments_log_idx     ON public.communication_attachments (communication_log_id);

COMMENT ON TABLE public.communication_attachments IS
  'Pièces jointes (PDF, factures, contrats, devis, pièces d''identité, fichiers email in/out) stockées sur Supabase Storage. Visibles dans le Journal 360.';

ALTER TABLE public.communication_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS communication_attachments_select ON public.communication_attachments;
CREATE POLICY communication_attachments_select ON public.communication_attachments
  FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id());
-- Écriture via RPC register_attachment / delete_attachment (SECURITY DEFINER).

-- -----------------------------------------------------------------------------
-- 2. Bucket Storage privé + policies hôtel-scopées
--    Convention de chemin : {hotel_id}/{guest_id|reservation_id}/{uuid}/{nom}
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-attachments', 'communication-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS comm_attach_read   ON storage.objects;
DROP POLICY IF EXISTS comm_attach_insert ON storage.objects;
DROP POLICY IF EXISTS comm_attach_delete ON storage.objects;

CREATE POLICY comm_attach_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[1] = public.get_user_hotel_id()::text
  );

CREATE POLICY comm_attach_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[1] = public.get_user_hotel_id()::text
  );

CREATE POLICY comm_attach_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[1] = public.get_user_hotel_id()::text
  );

-- -----------------------------------------------------------------------------
-- 3. RPC register_attachment / delete_attachment
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_attachment(
  p_storage_path         text,
  p_filename             text,
  p_mime_type            text,
  p_size_bytes           bigint,
  p_kind                 text DEFAULT 'other',
  p_message_id           uuid DEFAULT NULL,
  p_communication_log_id uuid DEFAULT NULL,
  p_guest_id             uuid DEFAULT NULL,
  p_reservation_id       uuid DEFAULT NULL,
  p_direction            text DEFAULT 'internal'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_hotel uuid; v_actor uuid; v_id uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RAISE EXCEPTION 'storage_path requis';
  END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  INSERT INTO public.communication_attachments
    (hotel_id, message_id, communication_log_id, guest_id, reservation_id,
     storage_path, original_filename, mime_type, size_bytes, kind, direction, uploaded_by)
  VALUES
    (v_hotel, p_message_id, p_communication_log_id, p_guest_id, p_reservation_id,
     p_storage_path, p_filename, p_mime_type, COALESCE(p_size_bytes, 0), p_kind, p_direction, v_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.register_attachment(text,text,text,bigint,text,uuid,uuid,uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_attachment(text,text,text,bigint,text,uuid,uuid,uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_attachment(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_hotel uuid; v_path text;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  DELETE FROM public.communication_attachments
   WHERE id = p_id AND hotel_id = v_hotel
   RETURNING storage_path INTO v_path;
  RETURN v_path;  -- le client supprime l'objet Storage correspondant
END;
$$;
REVOKE ALL ON FUNCTION public.delete_attachment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_attachment(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC communication_timeline_v2 — agrégateur 360° (comm + PMS + finance)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.communication_timeline_v2(
  p_guest_id       uuid DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL,
  p_categories     text[] DEFAULT NULL,   -- communication|crm|reservation|finance|incident|note
  p_channels       text[] DEFAULT NULL,   -- email|sms|whatsapp|internal
  p_actor          uuid DEFAULT NULL,
  p_from           timestamptz DEFAULT NULL,
  p_to             timestamptz DEFAULT NULL,
  p_search         text DEFAULT NULL,
  p_limit          integer DEFAULT 50,
  p_before         timestamptz DEFAULT NULL
)
RETURNS TABLE (
  entry_type      text,
  entry_id        uuid,
  occurred_at     timestamptz,
  category        text,
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
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
    -- (1) Messages (conversation_messages) ----------------------------------
    SELECT 'message'::text, m.id, COALESCE(m.sent_at, m.created_at),
           'communication'::text, m.channel::text, m.direction::text, m.status::text,
           m.created_by, COALESCE(u.full_name, u.email),
           m.subject, m.body, COALESCE(m.to_address, m.from_address),
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.original_filename,
                     'mime', a.mime_type, 'size', a.size_bytes, 'path', a.storage_path)), '[]'::jsonb)
              FROM public.communication_attachments a WHERE a.message_id = m.id),
           m.metadata
      FROM public.conversation_messages m
      LEFT JOIN public.users u ON u.id = m.created_by
     WHERE m.hotel_id = v_hotel
       AND ((p_guest_id IS NOT NULL AND m.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND m.reservation_id = p_reservation_id))

    UNION ALL
    -- (2) Historique communication_logs (anti-jointure) ---------------------
    SELECT 'message'::text, cl.id, COALESCE(cl.sent_at, cl.created_at),
           'communication'::text, cl.channel::text, cl.direction::text, cl.status::text,
           cl.created_by, COALESCE(u.full_name, u.email),
           cl.subject, cl.body, COALESCE(cl.to_address, cl.from_address),
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.original_filename,
                     'mime', a.mime_type, 'size', a.size_bytes, 'path', a.storage_path)), '[]'::jsonb)
              FROM public.communication_attachments a WHERE a.communication_log_id = cl.id),
           '{}'::jsonb
      FROM public.communication_logs cl
      LEFT JOIN public.users u ON u.id = cl.created_by
     WHERE cl.hotel_id = v_hotel
       AND NOT EXISTS (SELECT 1 FROM public.conversation_messages cm WHERE cm.communication_log_id = cl.id)
       AND ((p_guest_id IS NOT NULL AND cl.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND cl.reservation_id = p_reservation_id))

    UNION ALL
    -- (3) CRM — badges -------------------------------------------------------
    SELECT 'badge'::text, h.id, h.changed_at, 'crm'::text, 'crm'::text, NULL::text, 'updated'::text,
           h.changed_by, COALESCE(u.full_name, u.email), 'Badges'::text,
           trim(both ' ·' FROM
             CASE WHEN (SELECT count(*) FROM (SELECT unnest(h.new_badges) EXCEPT SELECT unnest(h.old_badges)) a) > 0
                  THEN 'Ajouté : ' || (SELECT string_agg(x, ', ') FROM (SELECT unnest(h.new_badges) EXCEPT SELECT unnest(h.old_badges)) AS t(x)) ELSE '' END
             || CASE WHEN (SELECT count(*) FROM (SELECT unnest(h.old_badges) EXCEPT SELECT unnest(h.new_badges)) r) > 0
                  THEN ' · Retiré : ' || (SELECT string_agg(x, ', ') FROM (SELECT unnest(h.old_badges) EXCEPT SELECT unnest(h.new_badges)) AS t(x)) ELSE '' END),
           NULL::text, '[]'::jsonb,
           jsonb_build_object('source', h.source)
      FROM public.guest_badge_history h
      LEFT JOIN public.users u ON u.id = h.changed_by
     WHERE h.hotel_id = v_hotel
       AND ((p_guest_id IS NOT NULL AND h.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND h.reservation_id = p_reservation_id))

    UNION ALL
    -- (4) Notes internes -----------------------------------------------------
    SELECT 'note'::text, n.id, n.created_at, 'note'::text, 'internal'::text, NULL::text, 'note'::text,
           n.author_user_id, COALESCE(u.full_name, u.email), 'Note interne'::text, n.body,
           NULL::text, '[]'::jsonb, '{}'::jsonb
      FROM public.communication_internal_notes n
      LEFT JOIN public.users u ON u.id = n.author_user_id
     WHERE n.hotel_id = v_hotel
       AND ((p_guest_id IS NOT NULL AND n.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND n.reservation_id = p_reservation_id))

    UNION ALL
    -- (5) CRM — incidents (scope client) ------------------------------------
    SELECT 'incident'::text, i.id, i.incident_date::timestamptz, 'incident'::text, 'crm'::text, NULL::text,
           i.type, i.created_by, COALESCE(u.full_name, u.email), 'Incident'::text, i.description,
           NULL::text, '[]'::jsonb, jsonb_build_object('type', i.type)
      FROM public.guest_incidents i
      LEFT JOIN public.users u ON u.id = i.created_by
     WHERE i.hotel_id = v_hotel AND p_guest_id IS NOT NULL AND i.guest_id = p_guest_id

    UNION ALL
    -- (6) Cycle de vie réservation (audit_logs) -----------------------------
    --     actor_user_id contient auth.uid() → jointure sur users.auth_id
    SELECT 'reservation'::text, al.id, al.created_at, 'reservation'::text, NULL::text, NULL::text,
           lower(al.action),
           ua.id, COALESCE(ua.full_name, ua.email),
           CASE al.action
             WHEN 'INSERT' THEN 'Réservation créée'
             WHEN 'STATUS_CHECKED_IN' THEN 'Check-in'
             WHEN 'STATUS_CHECKED_OUT' THEN 'Check-out'
             WHEN 'STATUS_CANCELLED' THEN 'Annulation'
             WHEN 'STATUS_NO_SHOW' THEN 'No-show'
             WHEN 'STATUS_CONFIRMED' THEN 'Réservation confirmée'
             WHEN 'DELETE' THEN 'Réservation supprimée'
             WHEN 'UPDATE' THEN
               CASE
                 WHEN (al.payload->'before'->>'room_id') IS DISTINCT FROM (al.payload->'after'->>'room_id') THEN 'Changement de chambre'
                 WHEN (al.payload->'before'->>'total_amount') IS DISTINCT FROM (al.payload->'after'->>'total_amount') THEN 'Modification tarifaire'
                 ELSE 'Réservation modifiée'
               END
             ELSE 'Événement réservation'
           END,
           NULL::text, NULL::text, '[]'::jsonb, al.payload
      FROM public.audit_logs al
      JOIN public.reservations r ON r.id = al.entity_id
      LEFT JOIN public.users ua ON ua.auth_id = al.actor_user_id
     WHERE al.hotel_id = v_hotel AND al.entity = 'reservation'
       AND ((p_guest_id IS NOT NULL AND r.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND r.id = p_reservation_id))

    UNION ALL
    -- (7) Finance — paiements / remboursements ------------------------------
    SELECT 'finance'::text, p.id, COALESCE(p.collected_at, p.created_at), 'finance'::text, NULL::text, NULL::text,
           p.status,
           p.created_by, COALESCE(u.full_name, u.email),
           CASE WHEN p.status = 'reversed' OR p.reversal_of IS NOT NULL OR p.amount < 0 THEN 'Remboursement' ELSE 'Paiement enregistré' END,
           (p.amount::text || ' ' || COALESCE(p.currency, 'EUR') || ' · ' || COALESCE(p.method, '')),
           NULL::text, '[]'::jsonb, jsonb_build_object('method', p.method, 'invoice_id', p.invoice_id)
      FROM public.payments p
      JOIN public.invoices i2 ON i2.id = p.invoice_id
      LEFT JOIN public.users u ON u.id = p.created_by
     WHERE p.hotel_id = v_hotel
       AND ((p_guest_id IS NOT NULL AND i2.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND i2.reservation_id = p_reservation_id))

    UNION ALL
    -- (8) Finance — factures ------------------------------------------------
    SELECT 'finance'::text, inv.id, COALESCE(inv.issued_at, inv.created_at), 'finance'::text, NULL::text, NULL::text,
           inv.status,
           inv.created_by, COALESCE(u.full_name, u.email),
           CASE inv.status
             WHEN 'issued' THEN 'Facture émise'
             WHEN 'paid'   THEN 'Facture payée'
             WHEN 'voided' THEN 'Facture annulée'
             ELSE 'Facture (brouillon)'
           END || ' ' || COALESCE(inv.invoice_number, ''),
           (COALESCE(inv.total_ttc, 0)::text || ' €'),
           NULL::text, '[]'::jsonb, jsonb_build_object('invoice_number', inv.invoice_number)
      FROM public.invoices inv
      LEFT JOIN public.users u ON u.id = inv.created_by
     WHERE inv.hotel_id = v_hotel
       AND ((p_guest_id IS NOT NULL AND inv.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND inv.reservation_id = p_reservation_id))

    UNION ALL
    -- (9) Finance — prestations (ajout / suppression) -----------------------
    SELECT 'finance'::text, il.id, il.created_at, 'finance'::text, NULL::text, NULL::text,
           il.source,
           il.created_by, COALESCE(u.full_name, u.email),
           CASE WHEN il.source = 'reversal' THEN 'Suppression prestation' ELSE 'Ajout prestation' END,
           (COALESCE(il.description, '') || ' ×' || COALESCE(il.quantity, 1)::text),
           NULL::text, '[]'::jsonb, '{}'::jsonb
      FROM public.invoice_lines il
      JOIN public.invoices i3 ON i3.id = il.invoice_id
      LEFT JOIN public.users u ON u.id = il.created_by
     WHERE il.hotel_id = v_hotel
       AND ((p_guest_id IS NOT NULL AND i3.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND i3.reservation_id = p_reservation_id))

    UNION ALL
    -- (10) Pièces jointes autonomes (non liées à un message) -----------------
    SELECT 'attachment'::text, at.id, at.created_at, 'communication'::text, NULL::text, at.direction, at.kind,
           at.uploaded_by, COALESCE(u.full_name, u.email),
           at.original_filename, NULL::text, NULL::text,
           jsonb_build_array(jsonb_build_object('id', at.id, 'name', at.original_filename,
             'mime', at.mime_type, 'size', at.size_bytes, 'path', at.storage_path)),
           '{}'::jsonb
      FROM public.communication_attachments at
      LEFT JOIN public.users u ON u.id = at.uploaded_by
     WHERE at.hotel_id = v_hotel AND at.message_id IS NULL AND at.communication_log_id IS NULL
       AND ((p_guest_id IS NOT NULL AND at.guest_id = p_guest_id)
         OR (p_reservation_id IS NOT NULL AND at.reservation_id = p_reservation_id))
  )
  SELECT u.entry_type, u.entry_id, u.occurred_at, u.category, u.channel, u.direction, u.status,
         u.actor_user_id, u.actor_name, u.subject, u.body, u.contact_address, u.attachments, u.metadata
  FROM unified u
  WHERE (p_before IS NULL OR u.occurred_at < p_before)
    AND (p_categories IS NULL OR u.category = ANY(p_categories))
    AND (p_channels   IS NULL OR u.channel  = ANY(p_channels))
    AND (p_actor      IS NULL OR u.actor_user_id = p_actor)
    AND (p_from       IS NULL OR u.occurred_at >= p_from)
    AND (p_to         IS NULL OR u.occurred_at <= p_to)
    AND (p_search     IS NULL OR p_search = '' OR
         u.subject ILIKE '%'||p_search||'%' OR u.body ILIKE '%'||p_search||'%' OR u.actor_name ILIKE '%'||p_search||'%')
  ORDER BY u.occurred_at DESC, u.entry_id DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.communication_timeline_v2(uuid,uuid,text[],text[],uuid,timestamptz,timestamptz,text,integer,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.communication_timeline_v2(uuid,uuid,text[],text[],uuid,timestamptz,timestamptz,text,integer,timestamptz) TO authenticated;

-- =============================================================================
-- FIN 20260631_journal_360.sql
-- =============================================================================
