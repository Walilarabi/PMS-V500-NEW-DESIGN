-- ============================================================================
-- AUDIT FLOWTYM — Tests d'isolation multi-hôtel (RLS)
-- Méthode : impersonation JWT via request.jwt.claims, LECTURE SEULE,
--           transaction ROLLBACK => ZÉRO écriture sur la base.
-- Exécuté le 2026-06-05 sur la PRODUCTION (hzrzkvdebaadditvbqis).
-- Hôtel A = Mas Provençal Aix  (00000000-0000-0000-0000-000000000001)
-- Hôtel B = Folkestone Opera   (02b9eb0e-89ef-45de-ba8e-20d4b41c500c)
-- ============================================================================

-- ─── TEST 1 — Utilisateur confiné Hôtel B (non platform-admin) ──────────────
-- Attendu : ne voit QUE Folkestone ; 0 ligne de Mas Provençal.
-- RÉSULTAT OBTENU : res=355/0 leak, guests=276/0, invoices=13/0, staff=69/0,
--                   hotels=1, users=3, is_platform_admin=false. ✅ AUCUNE FUITE
BEGIN;
  SELECT set_config('request.jwt.claims',
    '{"sub":"bc43686e-066c-4aa5-97f2-79b77b83dcbd","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT
    get_user_hotel_id()::text AS resolved_hotel,
    is_platform_admin()       AS is_platform_admin,
    (SELECT count(*) FROM reservations)                                                        AS res_visible,
    (SELECT count(*) FROM reservations WHERE hotel_id='00000000-0000-0000-0000-000000000001')  AS res_A_LEAK,
    (SELECT count(*) FROM guests       WHERE hotel_id='00000000-0000-0000-0000-000000000001')  AS guests_A_LEAK,
    (SELECT count(*) FROM invoices     WHERE hotel_id='00000000-0000-0000-0000-000000000001')  AS invoices_A_LEAK,
    (SELECT count(*) FROM staff_members WHERE hotel_id='00000000-0000-0000-0000-000000000001') AS staff_A_LEAK,
    (SELECT count(*) FROM hotels) AS hotels_visible,
    (SELECT count(*) FROM users)  AS users_visible;
ROLLBACK;

-- ─── TEST 2 — Identité inconnue (aucun profil) => deny-by-default ────────────
-- Attendu : 0 ligne PARTOUT.  RÉSULTAT : tout à 0, resolved_hotel=null. ✅
BEGIN;
  SELECT set_config('request.jwt.claims',
    '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT get_user_hotel_id()::text AS resolved_hotel,
    (SELECT count(*) FROM reservations) AS reservations,
    (SELECT count(*) FROM guests)       AS guests,
    (SELECT count(*) FROM invoices)     AS invoices,
    (SELECT count(*) FROM hotels)       AS hotels,
    (SELECT count(*) FROM employees)    AS employees,
    (SELECT count(*) FROM staff_planning) AS planning;
ROLLBACK;

-- ─── TEST 3 — Utilisateur multi-hôtel légitime (membre A + B) ────────────────
-- Tables RH via pl_my_hotels(). Attendu : voit SES 2 hôtels, rien de plus.
-- RÉSULTAT : employees=89 = 15 (B) + 74 (A) = exactement ses 2 hôtels. ✅
BEGIN;
  SELECT set_config('request.jwt.claims',
    '{"sub":"6cf1d95b-c84a-4946-ab3a-324bd3c3cc01","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT
    (SELECT count(*) FROM employees)                                                        AS emp_visible,
    (SELECT count(*) FROM employees WHERE hotel_id='02b9eb0e-89ef-45de-ba8e-20d4b41c500c')  AS emp_B,
    (SELECT count(*) FROM employees WHERE hotel_id='00000000-0000-0000-0000-000000000001')  AS emp_A;
ROLLBACK;
