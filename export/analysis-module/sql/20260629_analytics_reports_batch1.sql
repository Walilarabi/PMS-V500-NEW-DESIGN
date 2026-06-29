-- =============================================================================
-- MODULE ANALYSE — RPC analytics_* (Lot 1 : rapports chart prioritaires)
-- =============================================================================
--
-- Le module Analyse charge les données de chaque rapport via la convention :
--   report "21008" → RPC public.analytics_21008(p_start_date, p_end_date,
--                                                p_granularity, p_comparison)
-- (cf. frontend/src/services/analysis/report-data.service.ts).
--
-- Sans ces RPC, les rapports tombaient sur le fallback "mock vide" → écran
-- vide + warning console. Ce lot implémente 4 rapports à fort impact dont les
-- données s'agrègent proprement depuis les tables réelles (reservations,
-- guests, rooms, room_types).
--
-- Contrats de colonnes alignés sur les renderers correspondants
-- (frontend/src/pages/analysis/reports/renderers/Renderer<ID>.tsx).
--
-- Sécurité : SECURITY INVOKER (défaut) → la RLS des tables s'applique.
--            Scoping multi-tenant explicite via public.get_user_hotel_id().
--            Toutes exclues : réservations 'cancelled' / 'no_show'.
--
-- Idempotent : CREATE OR REPLACE. Aucun impact data.
-- NB : DROP préalable car d'anciens stubs analytics_* pouvaient exister avec
--      un type de retour différent (Postgres refuse le changement de RETURNS).
-- =============================================================================

DROP FUNCTION IF EXISTS public.analytics_21008(date, date, text, text);
DROP FUNCTION IF EXISTS public.analytics_51010(date, date, text, text);
DROP FUNCTION IF EXISTS public.analytics_51060(date, date, text, text);
DROP FUNCTION IF EXISTS public.analytics_54002(date, date, text, text);


-- ─────────────────────────────────────────────────────────────────────────────
-- 21008 — Activité journalière (arrivées / départs / présents / occupation %)
-- Renderer attend : { date, arrivees, departs, presents, occupation_pct }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.analytics_21008(
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL,
  p_granularity text DEFAULT 'day',
  p_comparison  text DEFAULT NULL
)
RETURNS TABLE (
  date date,
  arrivees bigint,
  departs bigint,
  presents bigint,
  occupation_pct numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH hid AS (SELECT public.get_user_hotel_id() AS h),
  bounds AS (
    SELECT COALESCE(p_start_date, CURRENT_DATE)        AS a,
           COALESCE(p_end_date,   CURRENT_DATE + 29)   AS b
  ),
  rooms_count AS (
    SELECT GREATEST(COUNT(*), 1) AS n
    FROM public.rooms, hid
    WHERE rooms.hotel_id = hid.h
      AND COALESCE(rooms.active, true) = true
  ),
  days AS (
    SELECT generate_series((SELECT a FROM bounds), (SELECT b FROM bounds), interval '1 day')::date AS d
  )
  SELECT
    days.d AS date,
    COUNT(r.id) FILTER (WHERE r.check_in = days.d)                              AS arrivees,
    COUNT(r.id) FILTER (WHERE r.check_out = days.d)                             AS departs,
    COUNT(r.id) FILTER (WHERE r.check_in <= days.d AND r.check_out > days.d)    AS presents,
    ROUND(
      100.0 * COUNT(r.id) FILTER (WHERE r.check_in <= days.d AND r.check_out > days.d)
      / (SELECT n FROM rooms_count), 1
    ) AS occupation_pct
  FROM days
  LEFT JOIN public.reservations r
    ON r.hotel_id = (SELECT h FROM hid)
   AND COALESCE(r.status, '') NOT IN ('cancelled', 'no_show')
   AND r.check_in <= days.d
   AND r.check_out >= days.d
  GROUP BY days.d
  ORDER BY days.d;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 51010 — Segmentation (CA / nuitées / ADR par segment de marché)
-- Renderer attend : { segment, nuitees, ca_total, adr }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.analytics_51010(
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL,
  p_granularity text DEFAULT NULL,
  p_comparison  text DEFAULT NULL
)
RETURNS TABLE (
  segment text,
  nuitees bigint,
  ca_total numeric,
  adr numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(NULLIF(r.segment, ''), 'Non segmenté')                       AS segment,
    SUM(r.nights)::bigint                                                 AS nuitees,
    ROUND(COALESCE(SUM(r.total_amount), 0), 2)                            AS ca_total,
    CASE WHEN SUM(r.nights) > 0
         THEN ROUND(SUM(r.total_amount) / SUM(r.nights), 2)
         ELSE 0 END                                                       AS adr
  FROM public.reservations r
  WHERE r.hotel_id = public.get_user_hotel_id()
    AND COALESCE(r.status, '') NOT IN ('cancelled', 'no_show')
    AND (p_start_date IS NULL OR r.check_in >= p_start_date)
    AND (p_end_date   IS NULL OR r.check_in <= p_end_date)
  GROUP BY 1
  ORDER BY ca_total DESC;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 51060 — Nationalités (nuitées / CA par pays)
-- Renderer attend : { nationalite, nuitees, ca_total }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.analytics_51060(
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL,
  p_granularity text DEFAULT NULL,
  p_comparison  text DEFAULT NULL
)
RETURNS TABLE (
  nationalite text,
  nuitees bigint,
  ca_total numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(NULLIF(g.country, ''), NULLIF(g.nationality, ''), 'Inconnu') AS nationalite,
    SUM(r.nights)::bigint                                                 AS nuitees,
    ROUND(COALESCE(SUM(r.total_amount), 0), 2)                            AS ca_total
  FROM public.reservations r
  LEFT JOIN public.guests g ON g.id = r.guest_id
  WHERE r.hotel_id = public.get_user_hotel_id()
    AND COALESCE(r.status, '') NOT IN ('cancelled', 'no_show')
    AND (p_start_date IS NULL OR r.check_in >= p_start_date)
    AND (p_end_date   IS NULL OR r.check_in <= p_end_date)
  GROUP BY 1
  ORDER BY ca_total DESC;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 54002 — ADR par type de chambre
-- Type dérivé : reservations.room_type sinon rooms.room_type_code (souvent vide
-- côté réservation). Capacité depuis room_types.
-- Renderer attend : { room_type, reservations, capacity, nuitees, ca_total, adr }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.analytics_54002(
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL,
  p_granularity text DEFAULT NULL,
  p_comparison  text DEFAULT NULL
)
RETURNS TABLE (
  room_type text,
  reservations bigint,
  capacity integer,
  nuitees bigint,
  ca_total numeric,
  adr numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(NULLIF(r.room_type, ''), rm.room_type_code, 'Indéfini')      AS room_type,
    COUNT(r.id)::bigint                                                   AS reservations,
    MAX(rt.capacity)                                                      AS capacity,
    SUM(r.nights)::bigint                                                 AS nuitees,
    ROUND(COALESCE(SUM(r.total_amount), 0), 2)                            AS ca_total,
    CASE WHEN SUM(r.nights) > 0
         THEN ROUND(SUM(r.total_amount) / SUM(r.nights), 2)
         ELSE 0 END                                                       AS adr
  FROM public.reservations r
  LEFT JOIN public.rooms rm ON rm.id = r.room_id
  LEFT JOIN public.room_types rt
    ON rt.hotel_id = r.hotel_id
   AND rt.room_type_code = COALESCE(NULLIF(r.room_type, ''), rm.room_type_code)
  WHERE r.hotel_id = public.get_user_hotel_id()
    AND COALESCE(r.status, '') NOT IN ('cancelled', 'no_show')
    AND (p_start_date IS NULL OR r.check_in >= p_start_date)
    AND (p_end_date   IS NULL OR r.check_in <= p_end_date)
  GROUP BY 1
  ORDER BY ca_total DESC;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Permissions : exécutables par les utilisateurs authentifiés uniquement.
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.analytics_21008(date, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_51010(date, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_51060(date, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_54002(date, date, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.analytics_21008(date, date, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_51010(date, date, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_51060(date, date, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_54002(date, date, text, text) FROM anon;
