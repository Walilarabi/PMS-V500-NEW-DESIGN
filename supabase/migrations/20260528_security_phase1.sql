-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1 SÉCURITÉ — FLOWTYM PMS
-- Migration : 20260528_security_phase1
--
-- Périmètre :
--   [CRITIQUE] 1. promo_campaigns  — RLS désactivé + hotel_id manquant
--   [CRITIQUE] 2. room_blocks      — RLS désactivé
--   [OPS]      3-8. Tables RMS globales — RLS activé mais 0 policy (deny-all)
--   [OPS]      9.   guest_history  — RLS activé, 0 policy (deny-all)
--   [OPS]      10.  exchange_rates — RLS activé, 0 policy (deny-all)
--   [OPS]      11-12. invoice_pdp_status, pdp_exchange_logs — deny-all
--   [FONC]     13.  subscription_plans, add_ons — catalog illisible par hôtels
--   [FONC]     14.  hotel_subscriptions — aucune policy SELECT hôtel
--
-- Convention policies :
--   SELECT  → role authenticated, USING(isolation)
--   ALL     → role authenticated, USING(isolation + rôle requis), WITH CHECK(idem)
--   données globales en lecture → USING(true)
--   tables alimentées par service role → write bloqué côté client (USING false)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. promo_campaigns
--    État avant  : RLS désactivé, colonne hotel_id ABSENTE
--    Risque      : toute la liste de campagnes de tous les hôtels est lisible
--                  et modifiable par n'importe qui (clé anon incluse)
--    Correction  : ajout hotel_id + backfill données seed + NOT NULL + RLS + policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.promo_campaigns
  ADD COLUMN IF NOT EXISTS hotel_id uuid
    REFERENCES public.hotels(id) ON DELETE CASCADE;

-- Backfill : les 10 lignes seed insérées sans tenant sont rattachées à
-- Folkestone opera (hôtel principal de développement, id fixe).
-- En production multi-tenant, chaque import devra inclure le bon hotel_id.
UPDATE public.promo_campaigns
  SET hotel_id = '02b9eb0e-89ef-45de-ba8e-20d4b41c500c'
  WHERE hotel_id IS NULL;

-- Contrainte NOT NULL après backfill (aucune ligne résiduelle sans hotel_id)
ALTER TABLE public.promo_campaigns
  ALTER COLUMN hotel_id SET NOT NULL;

-- Index pour les perfs des policies (évaluation rapide de hotel_id)
CREATE INDEX IF NOT EXISTS idx_promo_campaigns_hotel_id
  ON public.promo_campaigns (hotel_id);

-- Activation RLS
ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_campaigns FORCE ROW LEVEL SECURITY;

-- Lecture : propre hôtel uniquement
CREATE POLICY "promo_campaigns_select"
  ON public.promo_campaigns
  FOR SELECT
  TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- Écriture : direction + réception (même logique que rate_prices)
CREATE POLICY "promo_campaigns_modify"
  ON public.promo_campaigns
  FOR ALL
  TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. room_blocks
--    État avant  : RLS désactivé, hotel_id nullable (0 lignes existantes)
--    Risque      : lecture/écriture anonyme de tous les blocages
--    Correction  : NOT NULL + RLS + policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Passer hotel_id NOT NULL (table vide, safe)
ALTER TABLE public.room_blocks
  ALTER COLUMN hotel_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_room_blocks_hotel_id
  ON public.room_blocks (hotel_id);

ALTER TABLE public.room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_blocks FORCE ROW LEVEL SECURITY;

CREATE POLICY "room_blocks_select"
  ON public.room_blocks
  FOR SELECT
  TO authenticated
  USING (hotel_id = public.get_user_hotel_id());

-- Écriture : direction + réception
CREATE POLICY "room_blocks_modify"
  ON public.room_blocks
  FOR ALL
  TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. rms_events  (catalog global d'événements, partagé entre tous les hôtels)
--    État avant  : RLS activé, AUCUNE policy → deny-all (module cassé)
--    Décision    : lecture libre pour tout utilisateur authentifié
--                  écriture : platform admins uniquement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "rms_events_select"
  ON public.rms_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rms_events_admin_write"
  ON public.rms_events
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. rms_competitors  (compset global partagé)
--    État avant  : RLS activé, AUCUNE policy → deny-all
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "rms_competitors_select"
  ON public.rms_competitors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rms_competitors_admin_write"
  ON public.rms_competitors
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. rms_competitor_pricing  (historique prix scraping, lecture seule côté client)
--    État avant  : RLS activé, AUCUNE policy → deny-all
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "rms_competitor_pricing_select"
  ON public.rms_competitor_pricing
  FOR SELECT
  TO authenticated
  USING (true);

-- Pas d'écriture client : alimenté exclusivement par le service role (scraper)
CREATE POLICY "rms_competitor_pricing_no_write"
  ON public.rms_competitor_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "rms_competitor_pricing_no_update"
  ON public.rms_competitor_pricing
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "rms_competitor_pricing_no_delete"
  ON public.rms_competitor_pricing
  FOR DELETE
  TO authenticated
  USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. rms_pricing_recommendations  (scopé via rate_plan_id → rate_plans → hotel)
--    État avant  : RLS activé, AUCUNE policy → deny-all
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "rms_pricing_recommendations_select"
  ON public.rms_pricing_recommendations
  FOR SELECT
  TO authenticated
  USING (
    -- Recommandation rattachée au propre plan tarifaire de l'hôtel
    rate_plan_id IN (
      SELECT id FROM public.rate_plans
      WHERE hotel_id = public.get_user_hotel_id()
    )
    -- Ou recommandation transversale (sans plan spécifique)
    OR rate_plan_id IS NULL
  );

-- Mise à jour du statut (accept / reject) : direction + réception
CREATE POLICY "rms_pricing_recommendations_modify"
  ON public.rms_pricing_recommendations
  FOR UPDATE
  TO authenticated
  USING (
    rate_plan_id IN (
      SELECT id FROM public.rate_plans
      WHERE hotel_id = public.get_user_hotel_id()
    )
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  )
  WITH CHECK (
    rate_plan_id IN (
      SELECT id FROM public.rate_plans
      WHERE hotel_id = public.get_user_hotel_id()
    )
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  );

-- Insertion : service role / platform admin uniquement
CREATE POLICY "rms_pricing_recommendations_insert"
  ON public.rms_pricing_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. rms_pricing_factors  (scopé via recommendation_id → recommandation → hotel)
--    État avant  : RLS activé, AUCUNE policy → deny-all
--    Lecture seule côté client (créés par le moteur RMS)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "rms_pricing_factors_select"
  ON public.rms_pricing_factors
  FOR SELECT
  TO authenticated
  USING (
    recommendation_id IN (
      SELECT r.id FROM public.rms_pricing_recommendations r
      WHERE
        r.rate_plan_id IN (
          SELECT id FROM public.rate_plans
          WHERE hotel_id = public.get_user_hotel_id()
        )
        OR r.rate_plan_id IS NULL
    )
  );

CREATE POLICY "rms_pricing_factors_no_write"
  ON public.rms_pricing_factors
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "rms_pricing_factors_no_update"
  ON public.rms_pricing_factors
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "rms_pricing_factors_no_delete"
  ON public.rms_pricing_factors
  FOR DELETE
  TO authenticated
  USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. rms_pricing_applications  (journal des applications de recommandations)
--    État avant  : RLS activé, AUCUNE policy → deny-all
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "rms_pricing_applications_select"
  ON public.rms_pricing_applications
  FOR SELECT
  TO authenticated
  USING (
    recommendation_id IN (
      SELECT r.id FROM public.rms_pricing_recommendations r
      WHERE
        r.rate_plan_id IN (
          SELECT id FROM public.rate_plans
          WHERE hotel_id = public.get_user_hotel_id()
        )
        OR r.rate_plan_id IS NULL
    )
  );

CREATE POLICY "rms_pricing_applications_modify"
  ON public.rms_pricing_applications
  FOR ALL
  TO authenticated
  USING (
    recommendation_id IN (
      SELECT r.id FROM public.rms_pricing_recommendations r
      WHERE r.rate_plan_id IN (
        SELECT id FROM public.rate_plans
        WHERE hotel_id = public.get_user_hotel_id()
      )
    )
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  )
  WITH CHECK (
    recommendation_id IN (
      SELECT r.id FROM public.rms_pricing_recommendations r
      WHERE r.rate_plan_id IN (
        SELECT id FROM public.rate_plans
        WHERE hotel_id = public.get_user_hotel_id()
      )
    )
    AND public.get_user_role() = ANY (
      ARRAY['direction'::admin_user_role, 'reception'::admin_user_role]
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. guest_history  (historique séjours, scopé via guest_id → guests → hotel)
--    État avant  : RLS activé, AUCUNE policy → deny-all
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "guest_history_select"
  ON public.guest_history
  FOR SELECT
  TO authenticated
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE hotel_id = public.get_user_hotel_id()
    )
  );

CREATE POLICY "guest_history_modify"
  ON public.guest_history
  FOR ALL
  TO authenticated
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE hotel_id = public.get_user_hotel_id()
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE hotel_id = public.get_user_hotel_id()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. exchange_rates  (taux de change globaux, référentiel partagé)
--     État avant  : RLS activé, AUCUNE policy → deny-all (financement cassé)
--     Lecture libre pour tout authentifié — écriture service role uniquement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "exchange_rates_select"
  ON public.exchange_rates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "exchange_rates_no_write"
  ON public.exchange_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "exchange_rates_no_update"
  ON public.exchange_rates
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "exchange_rates_no_delete"
  ON public.exchange_rates
  FOR DELETE
  TO authenticated
  USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. invoice_pdp_status  (scopé via invoice_id → invoices → hotel)
--     État avant  : RLS activé, AUCUNE policy → deny-all
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "invoice_pdp_status_select"
  ON public.invoice_pdp_status
  FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE hotel_id = public.get_user_hotel_id()
    )
  );

-- Insertion / mise à jour : service role (PDPi flux technique)
CREATE POLICY "invoice_pdp_status_no_client_write"
  ON public.invoice_pdp_status
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "invoice_pdp_status_no_client_update"
  ON public.invoice_pdp_status
  FOR UPDATE
  TO authenticated
  USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. pdp_exchange_logs  (scopé via invoice_id → invoices → hotel)
--     État avant  : RLS activé, AUCUNE policy → deny-all
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "pdp_exchange_logs_select"
  ON public.pdp_exchange_logs
  FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE hotel_id = public.get_user_hotel_id()
    )
  );

-- Logs techniques : écriture service role uniquement
CREATE POLICY "pdp_exchange_logs_no_write"
  ON public.pdp_exchange_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. subscription_plans & add_ons  (catalog plateforme en lecture libre)
--     État avant  : platform_admin_all uniquement — les hôtels ne peuvent pas
--                   lire leur plan d'abonnement ni les add-ons disponibles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "subscription_plans_select_authenticated"
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "add_ons_select_authenticated"
  ON public.add_ons
  FOR SELECT
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. hotel_subscriptions  (abonnement hôtel)
--     État avant  : platform_admin_all uniquement — l'hôtel ne peut pas lire
--                   son propre abonnement actif
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "hotel_subscriptions_select_own"
  ON public.hotel_subscriptions
  FOR SELECT
  TO authenticated
  USING (hotel_id = public.get_user_hotel_id());


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION 20260528_security_phase1
-- ═══════════════════════════════════════════════════════════════════════════════
