-- =============================================================================
-- 20260650_security_sprint1_v2_dunning_guard.sql
-- =============================================================================
-- V2 SECURITY SPRINT 1 — `_dunning_send_one` cross-tenant guard
--
-- VULNÉRABILITÉ (audit pentest 2026-06-17, vue 5 de la phase 2) :
--   La RPC SECURITY DEFINER `_dunning_send_one(p_hotel_id, p_debtor_id, p_level)`
--   acceptait n'importe quel `p_hotel_id` passé par le client. Un user
--   authentifié de l'hôtel A pouvait donc :
--     1. envoyer une relance de dunning au nom de l'hôtel B (spam, fraude)
--     2. modifier `debtors.reminder_count` / `last_reminder_at` de B
--     3. insérer une ligne `audit_logs(hotel_id=B, actor_user_id=auth.uid())`
--
-- CORRECTIF :
--   Récupérer le hotel_id du caller via `public.get_user_hotel_id()` et lever
--   une exception 42501 (insufficient_privilege) si mismatch.
--   `is_platform_admin()` est exempté (admins peuvent relancer pour tout hôtel).
-- =============================================================================

CREATE OR REPLACE FUNCTION public._dunning_send_one(
  p_hotel_id uuid,
  p_debtor_id uuid,
  p_level integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_debtor        public.debtors;
  v_tpl           public.dunning_templates;
  v_hotel         text;
  v_log_id        uuid;
  v_caller_hotel  uuid;
BEGIN
  -- ── V2 GUARD : isolation tenant ──────────────────────────────────────────
  v_caller_hotel := public.get_user_hotel_id();
  IF v_caller_hotel IS NULL THEN
    RAISE EXCEPTION 'No active hotel for caller' USING ERRCODE = '42501';
  END IF;
  IF v_caller_hotel <> p_hotel_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden: cannot send dunning for another hotel'
      USING ERRCODE = '42501';
  END IF;

  -- ── Logique métier inchangée ─────────────────────────────────────────────
  SELECT * INTO v_debtor FROM public.debtors
    WHERE id = p_debtor_id AND hotel_id = p_hotel_id;
  IF v_debtor IS NULL THEN
    RAISE EXCEPTION 'Débiteur introuvable';
  END IF;

  SELECT * INTO v_tpl FROM public.dunning_templates
    WHERE hotel_id = p_hotel_id AND level = p_level;
  IF v_tpl IS NULL THEN
    RAISE EXCEPTION 'Aucun modèle pour le niveau %', p_level;
  END IF;

  SELECT name INTO v_hotel FROM public.hotels WHERE id = p_hotel_id;

  INSERT INTO public.dunning_logs (
    hotel_id, debtor_id, level, channel, subject, body, sent_at,
    delivered, opened, responded
  ) VALUES (
    p_hotel_id, p_debtor_id, p_level, v_tpl.channel,
    public._dunning_render(v_tpl.subject, v_debtor, v_hotel),
    public._dunning_render(v_tpl.body,    v_debtor, v_hotel),
    now(), true, false, false
  )
  RETURNING id INTO v_log_id;

  UPDATE public.debtors SET
    reminder_count   = GREATEST(reminder_count, p_level),
    last_reminder_at = now(),
    updated_at       = now()
  WHERE id = p_debtor_id;

  INSERT INTO public.audit_logs (
    hotel_id, actor_user_id, entity, entity_id, action, payload
  ) VALUES (
    p_hotel_id, auth.uid(), 'debtor', p_debtor_id, 'dunning_sent',
    jsonb_build_object('level', p_level, 'channel', v_tpl.channel, 'log_id', v_log_id)
  );

  RETURN v_log_id;
END
$function$;

-- =============================================================================
-- FIN 20260650_security_sprint1_v2_dunning_guard.sql
-- =============================================================================
