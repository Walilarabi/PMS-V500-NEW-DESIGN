-- ═══════════════════════════════════════════════════════════════════════════════
-- TESTS SÉCURITÉ PHASE 1 — FLOWTYM PMS
-- Format : pgTAP (https://pgtap.org/)
--
-- Exécution :
--   pg_prove -U postgres -d postgres supabase/tests/security_phase1.sql
--
-- Ces tests valident que l'isolation multi-tenant est correctement appliquée.
-- Aucun hotel ne doit lire ou modifier les données d'un autre hotel.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;
SELECT plan(52);

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 1 : RLS activé sur toutes les tables critiques
-- ─────────────────────────────────────────────────────────────────────────────

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='promo_campaigns'),
  'RLS activé sur promo_campaigns'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='room_blocks'),
  'RLS activé sur room_blocks'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='reservations'),
  'RLS activé sur reservations'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='guests'),
  'RLS activé sur guests'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='payments'),
  'RLS activé sur payments'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='invoices'),
  'RLS activé sur invoices'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='rooms'),
  'RLS activé sur rooms'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='rate_prices'),
  'RLS activé sur rate_prices'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='rms_events'),
  'RLS activé sur rms_events'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='rms_competitors'),
  'RLS activé sur rms_competitors'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='rms_pricing_recommendations'),
  'RLS activé sur rms_pricing_recommendations'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='guest_history'),
  'RLS activé sur guest_history'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='exchange_rates'),
  'RLS activé sur exchange_rates'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='audit_logs'),
  'RLS activé sur audit_logs'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='competitor_rates'),
  'RLS activé sur competitor_rates'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 2 : Aucune table publique avec RLS désactivé
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT COUNT(*)::int FROM pg_tables WHERE schemaname='public' AND rowsecurity = false),
  0,
  'Aucune table publique avec RLS désactivé'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 3 : hotel_id présent et NOT NULL sur les tables critiques
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='promo_campaigns' AND column_name='hotel_id'),
  'NO',
  'promo_campaigns.hotel_id est NOT NULL'
);

SELECT is(
  (SELECT is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='room_blocks' AND column_name='hotel_id'),
  'NO',
  'room_blocks.hotel_id est NOT NULL'
);

SELECT is(
  (SELECT is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='rate_prices' AND column_name='hotel_id'),
  'NO',
  'rate_prices.hotel_id est NOT NULL'
);

SELECT is(
  (SELECT is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='audit_logs' AND column_name='hotel_id'),
  'NO',
  'audit_logs.hotel_id est NOT NULL'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 4 : Nombre de policies sur les tables précédemment sans policies
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='promo_campaigns'),
  '>',
  0,
  'promo_campaigns a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='room_blocks'),
  '>',
  0,
  'room_blocks a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='rms_events'),
  '>',
  0,
  'rms_events a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='rms_competitors'),
  '>',
  0,
  'rms_competitors a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='rms_competitor_pricing'),
  '>',
  0,
  'rms_competitor_pricing a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='rms_pricing_recommendations'),
  '>',
  0,
  'rms_pricing_recommendations a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='rms_pricing_factors'),
  '>',
  0,
  'rms_pricing_factors a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='rms_pricing_applications'),
  '>',
  0,
  'rms_pricing_applications a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='guest_history'),
  '>',
  0,
  'guest_history a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='exchange_rates'),
  '>',
  0,
  'exchange_rates a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='invoice_pdp_status'),
  '>',
  0,
  'invoice_pdp_status a des policies RLS'
);

SELECT cmp_ok(
  (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='pdp_exchange_logs'),
  '>',
  0,
  'pdp_exchange_logs a des policies RLS'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 5 : Aucune table critique avec 0 policies (deny-all inattendu)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (
    SELECT COUNT(*)::int
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.rowsecurity = true
      AND t.tablename IN (
        'reservations','payments','invoices','guests','rooms',
        'rate_prices','rate_plans','rate_restrictions',
        'promo_campaigns','room_blocks',
        'rms_events','rms_competitors','rms_competitor_pricing',
        'rms_pricing_recommendations','rms_pricing_factors','rms_pricing_applications',
        'guest_history','exchange_rates','audit_logs','competitor_rates',
        'invoice_pdp_status','pdp_exchange_logs',
        'subscription_plans','add_ons','hotel_subscriptions'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
      )
  ),
  0,
  'Aucune table critique en deny-all (0 policies)'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 6 : Isolation multi-tenant — les 10 campagnes seed ont un hotel_id
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT COUNT(*)::int FROM public.promo_campaigns WHERE hotel_id IS NULL),
  0,
  'promo_campaigns : aucune ligne sans hotel_id'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.promo_campaigns),
  10,
  'promo_campaigns : 10 lignes seed présentes'
);

SELECT is(
  (SELECT COUNT(DISTINCT hotel_id)::int FROM public.promo_campaigns),
  1,
  'promo_campaigns : toutes rattachées au même hotel (seed mono-tenant)'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 7 : Fonctions d'isolation — présence et SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────

SELECT ok(
  (SELECT prosecdef FROM pg_proc
   WHERE proname='get_user_hotel_id' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')),
  'get_user_hotel_id() est SECURITY DEFINER'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc
   WHERE proname='is_platform_admin' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')),
  'is_platform_admin() est SECURITY DEFINER'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc
   WHERE proname='get_user_role' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')),
  'get_user_role() est SECURITY DEFINER'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 8 : Policies critique — isolation sur le bon champ
-- ─────────────────────────────────────────────────────────────────────────────

-- reservations : policy SELECT doit utiliser hotel_id
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reservations'
      AND cmd='SELECT'
      AND qual LIKE '%hotel_id%'
      AND qual LIKE '%get_user_hotel_id%'
  ),
  'reservations : policy SELECT isole sur hotel_id = get_user_hotel_id()'
);

-- reservations : policy ALL (modification) doit avoir WITH CHECK
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reservations'
      AND cmd='ALL'
      AND with_check LIKE '%hotel_id%'
      AND with_check LIKE '%get_user_hotel_id%'
  ),
  'reservations : policy ALL avec WITH CHECK sur hotel_id'
);

-- promo_campaigns : même vérification
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='promo_campaigns'
      AND cmd='SELECT'
      AND qual LIKE '%hotel_id%'
      AND qual LIKE '%get_user_hotel_id%'
  ),
  'promo_campaigns : policy SELECT isole sur hotel_id = get_user_hotel_id()'
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='promo_campaigns'
      AND cmd='ALL'
      AND with_check LIKE '%hotel_id%'
  ),
  'promo_campaigns : policy ALL avec WITH CHECK'
);

-- room_blocks : même vérification
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='room_blocks'
      AND cmd='SELECT'
      AND qual LIKE '%hotel_id%'
      AND qual LIKE '%get_user_hotel_id%'
  ),
  'room_blocks : policy SELECT isole sur hotel_id = get_user_hotel_id()'
);

-- guests : policy avec hotel_id
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='guests'
      AND cmd='SELECT'
      AND qual LIKE '%hotel_id%'
  ),
  'guests : policy SELECT isole sur hotel_id'
);

-- competitor_rates : SELECT permis, ALL bloqué côté client
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='competitor_rates'
      AND cmd='ALL'
      AND qual = 'false'
  ),
  'competitor_rates : policy ALL bloquante (écriture client interdite)'
);

-- rms_competitor_pricing : pas d'INSERT côté client
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rms_competitor_pricing'
      AND cmd='INSERT'
      AND with_check = 'false'
  ),
  'rms_competitor_pricing : INSERT client bloqué (alimenté par service role)'
);

-- exchange_rates : pas d'écriture client
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='exchange_rates'
      AND cmd='INSERT'
      AND with_check = 'false'
  ),
  'exchange_rates : INSERT client bloqué'
);

-- audit_logs : policy SELECT bien présente
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='audit_logs'
      AND cmd='SELECT'
      AND qual LIKE '%hotel_id%'
  ),
  'audit_logs : lecture isolée par hotel_id'
);

-- hotels : un hôtel ne peut lire que sa propre fiche
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='hotels'
      AND cmd='SELECT'
      AND qual LIKE '%get_user_hotel_id%'
  ),
  'hotels : SELECT isolé par get_user_hotel_id()'
);

-- platform_admins : lecture réservée aux admins plateforme
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='platform_admins'
      AND cmd='SELECT'
      AND qual LIKE '%is_platform_admin%'
  ),
  'platform_admins : SELECT réservé aux admins plateforme'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC 9 : Catalog plateforme lisible par les hôtels
-- ─────────────────────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subscription_plans'
      AND cmd='SELECT'
      AND roles && ARRAY['authenticated']::name[]
      AND qual = 'true'
  ),
  'subscription_plans : lisible par tous les utilisateurs authentifiés'
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='add_ons'
      AND cmd='SELECT'
      AND roles && ARRAY['authenticated']::name[]
      AND qual = 'true'
  ),
  'add_ons : lisible par tous les utilisateurs authentifiés'
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='hotel_subscriptions'
      AND cmd='SELECT'
      AND qual LIKE '%hotel_id%'
  ),
  'hotel_subscriptions : SELECT isolé par hotel_id'
);


SELECT * FROM finish();
ROLLBACK;
