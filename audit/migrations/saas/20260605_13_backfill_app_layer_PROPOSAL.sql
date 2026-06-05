-- ============================================================================
-- FLOWTYM SaaS — BACKFILL couche applications (PROPOSITION — NON APPLIQUÉE)
-- À VALIDER avant exécution. Idempotent (ON CONFLICT DO NOTHING), non destructif.
--
-- Contexte : hotel_app_subscriptions / user_app_access ont été créées vides.
-- Sans backfill, les 5 hôtels existants apparaissent en PMS/RH = "inactive"
-- dans l'onglet Applications, et les utilisateurs existants n'ont aucun
-- user_app_access (sans impact tant que le gating n'est pas activé — étape 4).
--
-- Règle proposée :
--   • PMS = active pour tous les hôtels actifs (ils utilisent déjà le PMS).
--   • RH  = active pour les hôtels ayant des employés (données RH réelles).
--   • user_app_access : chaque membre d'un hôtel reçoit l'accès aux apps
--     actives de cet hôtel (préserve l'accès actuel avant le gating).
-- ============================================================================

-- ── AUDIT (à lancer d'abord, lecture seule) ────────────────────────────────
-- SELECT h.name, h.status,
--   (SELECT count(*) FROM employees e WHERE e.hotel_id=h.id)        AS employes,
--   (SELECT string_agg(pa.code||':'||has.status, ', ')
--      FROM hotel_app_subscriptions has JOIN platform_apps pa ON pa.id=has.app_id
--     WHERE has.hotel_id=h.id)                                      AS apps_actuelles
-- FROM hotels h ORDER BY h.created_at;

-- ── 1) PMS actif pour tous les hôtels actifs ───────────────────────────────
INSERT INTO public.hotel_app_subscriptions (hotel_id, app_id, status, started_at)
SELECT h.id, (SELECT id FROM public.platform_apps WHERE code = 'PMS'), 'active', now()
FROM public.hotels h
WHERE h.status = 'active'
ON CONFLICT (hotel_id, app_id) DO NOTHING;

-- ── 2) RH actif pour les hôtels ayant des employés ─────────────────────────
INSERT INTO public.hotel_app_subscriptions (hotel_id, app_id, status, started_at)
SELECT DISTINCT e.hotel_id, (SELECT id FROM public.platform_apps WHERE code = 'RH'), 'active', now()
FROM public.employees e
WHERE e.hotel_id IS NOT NULL
ON CONFLICT (hotel_id, app_id) DO NOTHING;

-- ── 3) Accès applicatifs des utilisateurs existants ────────────────────────
INSERT INTO public.user_app_access (user_id, hotel_id, app_id)
SELECT uh.user_id, uh.hotel_id, has.app_id
FROM public.user_hotels uh
JOIN public.hotel_app_subscriptions has
  ON has.hotel_id = uh.hotel_id AND has.status IN ('trial', 'active')
ON CONFLICT (user_id, hotel_id, app_id) DO NOTHING;
