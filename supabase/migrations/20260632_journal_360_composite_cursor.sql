-- =============================================================================
-- 20260632_journal_360_composite_cursor.sql  (P1 — pagination déterministe)
-- =============================================================================
-- OBJECTIF : remplacer le curseur de pagination basé sur le seul `occurred_at`
--   par un CURSEUR COMPOSITE (occurred_at, entry_id). Plusieurs événements
--   peuvent partager le même instant (check-in + paiement + email + note + badge
--   à la même seconde) ; l'ancien curseur `occurred_at < p_before` pouvait alors
--   sauter ou dupliquer des lignes. Le curseur composite garantit : aucun
--   doublon, aucune perte, ordre stable, pagination déterministe.
--
-- CHANGEMENT DE SIGNATURE : le paramètre `p_before timestamptz` est remplacé par
--   `p_before_at timestamptz` + `p_before_id uuid`. (Aligné sur la production.)
-- =============================================================================

DROP FUNCTION IF EXISTS public.communication_timeline_v2(uuid,uuid,text[],text[],uuid,timestamptz,timestamptz,text,integer,timestamptz);

CREATE OR REPLACE FUNCTION public.communication_timeline_v2(
  p_guest_id uuid DEFAULT NULL, p_reservation_id uuid DEFAULT NULL,
  p_categories text[] DEFAULT NULL, p_channels text[] DEFAULT NULL, p_actor uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50, p_before_at timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL)
RETURNS TABLE (
  entry_type text, entry_id uuid, occurred_at timestamptz, category text, channel text, direction text, status text,
  actor_user_id uuid, actor_name text, subject text, body text, contact_address text, attachments jsonb, metadata jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hotel uuid; v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL OR (p_guest_id IS NULL AND p_reservation_id IS NULL) THEN RETURN; END IF;
  RETURN QUERY
  WITH unified(entry_type, entry_id, occurred_at, category, channel, direction, status,
               actor_user_id, actor_name, subject, body, contact_address, attachments, metadata) AS (
    SELECT 'message'::text, m.id, COALESCE(m.sent_at, m.created_at), 'communication'::text, m.channel::text, m.direction::text, m.status::text,
           m.created_by, COALESCE(u.full_name, u.email), m.subject, m.body, COALESCE(m.to_address, m.from_address),
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.original_filename, 'mime', a.mime_type, 'size', a.size_bytes, 'path', a.storage_path)), '[]'::jsonb)
              FROM public.communication_attachments a WHERE a.message_id = m.id), m.metadata
      FROM public.conversation_messages m LEFT JOIN public.users u ON u.id = m.created_by
     WHERE m.hotel_id = v_hotel AND ((p_guest_id IS NOT NULL AND m.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND m.reservation_id = p_reservation_id))
    UNION ALL
    SELECT 'message'::text, cl.id, COALESCE(cl.sent_at, cl.created_at), 'communication'::text, cl.channel::text, cl.direction::text, cl.status::text,
           cl.created_by, COALESCE(u.full_name, u.email), cl.subject, cl.body, COALESCE(cl.to_address, cl.from_address),
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.original_filename, 'mime', a.mime_type, 'size', a.size_bytes, 'path', a.storage_path)), '[]'::jsonb)
              FROM public.communication_attachments a WHERE a.communication_log_id = cl.id), '{}'::jsonb
      FROM public.communication_logs cl LEFT JOIN public.users u ON u.id = cl.created_by
     WHERE cl.hotel_id = v_hotel AND NOT EXISTS (SELECT 1 FROM public.conversation_messages cm WHERE cm.communication_log_id = cl.id)
       AND ((p_guest_id IS NOT NULL AND cl.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND cl.reservation_id = p_reservation_id))
    UNION ALL
    SELECT 'badge'::text, h.id, h.changed_at, 'crm'::text, 'crm'::text, NULL::text, 'updated'::text, h.changed_by, COALESCE(u.full_name, u.email), 'Badges'::text,
           trim(both ' ·' FROM
             CASE WHEN (SELECT count(*) FROM (SELECT unnest(h.new_badges) EXCEPT SELECT unnest(h.old_badges)) a) > 0
                  THEN 'Ajouté : ' || (SELECT string_agg(x, ', ') FROM (SELECT unnest(h.new_badges) EXCEPT SELECT unnest(h.old_badges)) AS t(x)) ELSE '' END
             || CASE WHEN (SELECT count(*) FROM (SELECT unnest(h.old_badges) EXCEPT SELECT unnest(h.new_badges)) r) > 0
                  THEN ' · Retiré : ' || (SELECT string_agg(x, ', ') FROM (SELECT unnest(h.old_badges) EXCEPT SELECT unnest(h.new_badges)) AS t(x)) ELSE '' END),
           NULL::text, '[]'::jsonb, jsonb_build_object('source', h.source)
      FROM public.guest_badge_history h LEFT JOIN public.users u ON u.id = h.changed_by
     WHERE h.hotel_id = v_hotel AND ((p_guest_id IS NOT NULL AND h.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND h.reservation_id = p_reservation_id))
    UNION ALL
    SELECT 'note'::text, n.id, n.created_at, 'note'::text, 'internal'::text, NULL::text, 'note'::text, n.author_user_id, COALESCE(u.full_name, u.email), 'Note interne'::text, n.body,
           NULL::text, '[]'::jsonb, '{}'::jsonb
      FROM public.communication_internal_notes n LEFT JOIN public.users u ON u.id = n.author_user_id
     WHERE n.hotel_id = v_hotel AND ((p_guest_id IS NOT NULL AND n.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND n.reservation_id = p_reservation_id))
    UNION ALL
    SELECT 'incident'::text, i.id, i.incident_date::timestamptz, 'incident'::text, 'crm'::text, NULL::text, i.type, i.created_by, COALESCE(u.full_name, u.email), 'Incident'::text, i.description,
           NULL::text, '[]'::jsonb, jsonb_build_object('type', i.type)
      FROM public.guest_incidents i LEFT JOIN public.users u ON u.id = i.created_by
     WHERE i.hotel_id = v_hotel AND p_guest_id IS NOT NULL AND i.guest_id = p_guest_id
    UNION ALL
    SELECT 'reservation'::text, al.id, al.created_at, 'reservation'::text, NULL::text, NULL::text,
           CASE WHEN al.action = 'updated' AND (al.payload->'diff') ? 'status' THEN al.payload->'diff'->'status'->>1 ELSE lower(al.action) END,
           ua.id, COALESCE(ua.full_name, ua.email),
           CASE
             WHEN al.action IN ('created','INSERT') THEN 'Réservation créée'
             WHEN al.action = 'deleted' THEN 'Réservation supprimée'
             WHEN al.action = 'CHECKOUT' THEN 'Check-out'
             WHEN al.action = 'CHECKOUT_HK_CREATED' THEN 'Check-out · ménage planifié'
             WHEN al.action = 'updated' THEN
               CASE
                 WHEN (al.payload->'diff') ? 'status' THEN
                   CASE al.payload->'diff'->'status'->>1
                     WHEN 'checked_in' THEN 'Check-in' WHEN 'checked_out' THEN 'Check-out'
                     WHEN 'cancelled' THEN 'Annulation' WHEN 'no_show' THEN 'No-show'
                     WHEN 'confirmed' THEN 'Réservation confirmée' ELSE 'Réservation modifiée' END
                 WHEN (al.payload->'diff') ? 'total_amount' THEN 'Modification tarifaire'
                 WHEN (al.payload->'diff') ? 'guest_id' THEN 'Réservation modifiée (client)'
                 ELSE 'Réservation modifiée' END
             ELSE 'Événement réservation' END,
           CASE
             WHEN al.action = 'updated' AND (al.payload->'diff') ? 'status'
               THEN (al.payload->'diff'->'status'->>0) || ' → ' || (al.payload->'diff'->'status'->>1)
             WHEN al.action = 'updated' AND (al.payload->'diff') ? 'total_amount'
               THEN (al.payload->'diff'->'total_amount'->>0) || ' € → ' || (al.payload->'diff'->'total_amount'->>1) || ' €'
             ELSE NULL END,
           NULL::text, '[]'::jsonb, al.payload
      FROM public.audit_logs al
      JOIN public.reservations r ON r.id = al.entity_id
      LEFT JOIN public.users ua ON ua.id = al.actor_user_id
     WHERE al.hotel_id = v_hotel AND al.entity = 'reservation'
       AND ((p_guest_id IS NOT NULL AND r.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND r.id = p_reservation_id))
    UNION ALL
    SELECT 'finance'::text, p.id, COALESCE(p.collected_at, p.created_at), 'finance'::text, NULL::text, NULL::text, p.status, p.created_by, COALESCE(u.full_name, u.email),
           CASE WHEN p.status = 'reversed' OR p.reversal_of IS NOT NULL OR p.amount < 0 THEN 'Remboursement' ELSE 'Paiement enregistré' END,
           (p.amount::text || ' ' || COALESCE(p.currency, 'EUR') || ' · ' || COALESCE(p.method, p.payment_method, '')),
           NULL::text, '[]'::jsonb, jsonb_build_object('method', COALESCE(p.method, p.payment_method))
      FROM public.payments p
      LEFT JOIN public.invoices i2 ON i2.id = p.invoice_id
      LEFT JOIN public.users u ON u.id = p.created_by
     WHERE p.hotel_id = v_hotel
       AND ((p_reservation_id IS NOT NULL AND (p.reservation_id = p_reservation_id OR i2.reservation_id = p_reservation_id))
         OR (p_guest_id IS NOT NULL AND i2.guest_id = p_guest_id))
    UNION ALL
    SELECT 'finance'::text, inv.id, COALESCE(inv.issued_at, inv.created_at), 'finance'::text, NULL::text, NULL::text, inv.status, NULL::uuid, NULL::text,
           CASE WHEN inv.credit_note_of IS NOT NULL THEN 'Avoir ' || COALESCE(inv.invoice_number,'')
                ELSE (CASE inv.status WHEN 'issued' THEN 'Facture émise' WHEN 'paid' THEN 'Facture payée' WHEN 'voided' THEN 'Facture annulée' ELSE 'Facture (brouillon)' END) || ' ' || COALESCE(inv.invoice_number,'') END,
           (COALESCE(inv.total_ttc, 0)::text || ' €'), NULL::text, '[]'::jsonb, jsonb_build_object('invoice_number', inv.invoice_number)
      FROM public.invoices inv
     WHERE inv.hotel_id = v_hotel
       AND ((p_guest_id IS NOT NULL AND inv.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND inv.reservation_id = p_reservation_id))
    UNION ALL
    SELECT 'finance'::text, il.id, il.created_at, 'finance'::text, NULL::text, NULL::text, il.source, il.created_by, COALESCE(u.full_name, u.email),
           CASE WHEN il.source = 'reversal' THEN 'Suppression prestation' ELSE 'Ajout prestation' END,
           (COALESCE(il.description, '') || ' ×' || COALESCE(il.quantity, 1)::text), NULL::text, '[]'::jsonb, '{}'::jsonb
      FROM public.invoice_lines il JOIN public.invoices i3 ON i3.id = il.invoice_id LEFT JOIN public.users u ON u.id = il.created_by
     WHERE il.hotel_id = v_hotel AND ((p_guest_id IS NOT NULL AND i3.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND i3.reservation_id = p_reservation_id))
    UNION ALL
    SELECT 'attachment'::text, at.id, at.created_at, 'communication'::text, NULL::text, at.direction, at.kind, at.uploaded_by, COALESCE(u.full_name, u.email),
           at.original_filename, NULL::text, NULL::text,
           jsonb_build_array(jsonb_build_object('id', at.id, 'name', at.original_filename, 'mime', at.mime_type, 'size', at.size_bytes, 'path', at.storage_path)), '{}'::jsonb
      FROM public.communication_attachments at LEFT JOIN public.users u ON u.id = at.uploaded_by
     WHERE at.hotel_id = v_hotel AND at.message_id IS NULL AND at.communication_log_id IS NULL
       AND ((p_guest_id IS NOT NULL AND at.guest_id = p_guest_id) OR (p_reservation_id IS NOT NULL AND at.reservation_id = p_reservation_id))
  )
  SELECT u.entry_type, u.entry_id, u.occurred_at, u.category, u.channel, u.direction, u.status,
         u.actor_user_id, u.actor_name, u.subject, u.body, u.contact_address, u.attachments, u.metadata
  FROM unified u
  WHERE
    (p_before_at IS NULL
      OR u.occurred_at < p_before_at
      OR (u.occurred_at = p_before_at AND (p_before_id IS NULL OR u.entry_id < p_before_id)))
    AND (p_categories IS NULL OR u.category = ANY(p_categories))
    AND (p_channels   IS NULL OR u.channel  = ANY(p_channels))
    AND (p_actor      IS NULL OR u.actor_user_id = p_actor)
    AND (p_from       IS NULL OR u.occurred_at >= p_from)
    AND (p_to         IS NULL OR u.occurred_at <= p_to)
    AND (p_search     IS NULL OR p_search = '' OR u.subject ILIKE '%'||p_search||'%' OR u.body ILIKE '%'||p_search||'%' OR u.actor_name ILIKE '%'||p_search||'%')
  ORDER BY u.occurred_at DESC, u.entry_id DESC
  LIMIT v_limit;
END; $$;
REVOKE ALL ON FUNCTION public.communication_timeline_v2(uuid,uuid,text[],text[],uuid,timestamptz,timestamptz,text,integer,timestamptz,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.communication_timeline_v2(uuid,uuid,text[],text[],uuid,timestamptz,timestamptz,text,integer,timestamptz,uuid) TO authenticated;

-- =============================================================================
-- FIN 20260632_journal_360_composite_cursor.sql
-- =============================================================================
