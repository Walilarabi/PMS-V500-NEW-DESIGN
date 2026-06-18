-- =============================================================================
-- 20260651_security_sprint1_v1_views_invoker.sql
-- =============================================================================
-- V1 SECURITY SPRINT 1 — 8 vues SECURITY DEFINER → SECURITY INVOKER + filtre
-- hotel_id obligatoire.
--
-- VULNÉRABILITÉ (audit pentest 2026-06-17 + Supabase Advisors 8× ERROR) :
--   Les vues suivantes étaient marquées SECURITY DEFINER (= s'exécutent avec
--   les droits du créateur `postgres` → bypass RLS du caller) et accessibles
--   à `authenticated` ET `anon`. Aucune ne filtrait par hotel_id.
--
--   PREUVE reproductible :
--     SELECT COUNT(DISTINCT hotel_id), COUNT(*) FROM financial_timeline;
--     → 3 hôtels distincts / 42 transactions retournés sans aucun filtre.
--
--   Vues impactées :
--     - financial_timeline       (UNION invoices/payments/credit_notes/deposits)
--     - debtors_aged             (PII + montants débiteurs)
--     - competitor_rates_latest  (tarifs concurrents)
--     - v_hr_monthly_cost        (coûts RH)
--     - v_employee_documents_alerts (PII employés)
--     - v_employee_replacement_missions (RH)
--     - portal_leave_balances    (congés employés)
--     - scaling_health           (métriques infra globales)
--
-- CORRECTIF :
--   1. DROP puis CREATE avec `WITH (security_invoker = true)` (PG 15+, on est
--      sur PG 17). Les RLS des tables sous-jacentes s'appliquent désormais.
--   2. Filtre WHERE `hotel_id = get_user_hotel_id() OR is_platform_admin()`
--      ajouté dans chaque vue (ceinture + bretelles).
--   3. `scaling_health` est une métrique GLOBALE infra → restreinte aux
--      platform_admins uniquement.
--   4. REVOKE des droits SELECT à `anon` partout.
-- =============================================================================

-- ─── 1. financial_timeline ──────────────────────────────────────────────────
DROP VIEW IF EXISTS public.financial_timeline CASCADE;
CREATE VIEW public.financial_timeline
  WITH (security_invoker = true) AS
SELECT 'invoice'::text AS event_type, invoices.id AS entity_id, invoices.hotel_id,
       invoices.reservation_id, invoices.invoice_number AS reference,
       invoices.status, invoices.total_ttc AS amount, 'EUR'::text AS currency,
       COALESCE(invoices.issued_at, invoices.created_at) AS event_at,
       invoices.notes AS description
  FROM public.invoices
 WHERE invoices.hotel_id = public.get_user_hotel_id() OR public.is_platform_admin()
UNION ALL
SELECT 'payment'::text, payments.id, payments.hotel_id, payments.reservation_id,
       COALESCE(payments.reference, payments.id::text), payments.status,
       payments.amount, payments.currency,
       COALESCE(payments.collected_at, payments.created_at), NULL::text
  FROM public.payments
 WHERE payments.hotel_id = public.get_user_hotel_id() OR public.is_platform_admin()
UNION ALL
SELECT 'credit_note'::text, credit_notes.id, credit_notes.hotel_id,
       credit_notes.reservation_id, credit_notes.credit_note_number,
       credit_notes.status, -credit_notes.total_ttc, 'EUR'::text,
       COALESCE(credit_notes.issued_at, credit_notes.created_at),
       credit_notes.reason
  FROM public.credit_notes
 WHERE credit_notes.hotel_id = public.get_user_hotel_id() OR public.is_platform_admin()
UNION ALL
SELECT 'deposit'::text, deposits.id, deposits.hotel_id, deposits.reservation_id,
       deposits.id::text, deposits.status, deposits.amount, deposits.currency,
       deposits.created_at, deposits.notes
  FROM public.deposits
 WHERE deposits.hotel_id = public.get_user_hotel_id() OR public.is_platform_admin();

REVOKE ALL ON public.financial_timeline FROM anon;
GRANT SELECT ON public.financial_timeline TO authenticated;

-- ─── 2. debtors_aged ────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.debtors_aged CASCADE;
CREATE VIEW public.debtors_aged
  WITH (security_invoker = true) AS
SELECT d.id, d.hotel_id, d.reservation_id, d.guest_name, d.guest_email, d.guest_phone,
       d.company_name, d.reference, d.amount_due, d.amount_paid, d.balance, d.due_date,
       d.status, d.last_reminder_at, d.reminder_count, d.notes, d.created_at, d.updated_at,
       GREATEST(0, CURRENT_DATE - d.due_date) AS days_overdue,
       CASE
         WHEN d.status = 'paid'::text THEN 'paid'::text
         WHEN CURRENT_DATE <= d.due_date THEN 'current'::text
         WHEN (CURRENT_DATE - d.due_date) <= 30 THEN 'overdue_30'::text
         WHEN (CURRENT_DATE - d.due_date) <= 60 THEN 'overdue_60'::text
         WHEN (CURRENT_DATE - d.due_date) <= 90 THEN 'overdue_90'::text
         ELSE 'overdue_90_plus'::text
       END AS aging_bucket
  FROM public.debtors d
 WHERE d.hotel_id = public.get_user_hotel_id() OR public.is_platform_admin();

REVOKE ALL ON public.debtors_aged FROM anon;
GRANT SELECT ON public.debtors_aged TO authenticated;

-- ─── 3. competitor_rates_latest ─────────────────────────────────────────────
DROP VIEW IF EXISTS public.competitor_rates_latest CASCADE;
CREATE VIEW public.competitor_rates_latest
  WITH (security_invoker = true) AS
SELECT DISTINCT ON (hotel_id, competitor_id, ota, stay_date, los)
       hotel_id, competitor_id, competitor_name, ota, stay_date, los, price, currency,
       available, meal_type, room_type_label, is_refundable, "position", shopped_at, fetched_at
  FROM public.competitor_rates
 WHERE hotel_id = public.get_user_hotel_id() OR public.is_platform_admin()
 ORDER BY hotel_id, competitor_id, ota, stay_date, los, shopped_at DESC;

REVOKE ALL ON public.competitor_rates_latest FROM anon;
GRANT SELECT ON public.competitor_rates_latest TO authenticated;

-- ─── 4. v_hr_monthly_cost ───────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_hr_monthly_cost CASCADE;
CREATE VIEW public.v_hr_monthly_cost
  WITH (security_invoker = true) AS
SELECT hotel_id,
       COUNT(DISTINCT employee_id) AS employees_with_contract,
       COALESCE(SUM(gross_monthly_salary), 0::numeric) AS total_gross_monthly,
       COALESCE(SUM(gross_monthly_salary * 1.42), 0::numeric) AS total_full_cost,
       COALESCE(AVG(gross_monthly_salary), 0::numeric) AS avg_gross_monthly
  FROM public.employee_contracts ec
 WHERE (end_date IS NULL OR end_date > CURRENT_DATE)
   AND (hotel_id = public.get_user_hotel_id() OR public.is_platform_admin())
 GROUP BY hotel_id;

REVOKE ALL ON public.v_hr_monthly_cost FROM anon;
GRANT SELECT ON public.v_hr_monthly_cost TO authenticated;

-- ─── 5. v_employee_documents_alerts ─────────────────────────────────────────
DROP VIEW IF EXISTS public.v_employee_documents_alerts CASCADE;
CREATE VIEW public.v_employee_documents_alerts
  WITH (security_invoker = true) AS
SELECT ed.hotel_id, ed.employee_id, e.first_name, e.last_name,
       ed.doc_type AS doc_type_code, ed.doc_type AS doc_label,
       ed.expires_at, ed.status,
       CASE
         WHEN ed.expires_at IS NULL THEN NULL::text
         WHEN ed.expires_at < CURRENT_DATE THEN 'expired'::text
         WHEN ed.expires_at < (CURRENT_DATE + INTERVAL '30 days') THEN 'expiring_soon'::text
         ELSE NULL::text
       END AS alert_kind,
       (ed.expires_at - CURRENT_DATE) AS days_until_expiry
  FROM public.employee_documents ed
  JOIN public.employees e ON e.id = ed.employee_id
 WHERE ed.status = 'provided'::text AND ed.expires_at IS NOT NULL
   AND (ed.hotel_id = public.get_user_hotel_id() OR public.is_platform_admin());

REVOKE ALL ON public.v_employee_documents_alerts FROM anon;
GRANT SELECT ON public.v_employee_documents_alerts TO authenticated;

-- ─── 6. v_employee_replacement_missions ─────────────────────────────────────
DROP VIEW IF EXISTS public.v_employee_replacement_missions CASCADE;
CREATE VIEW public.v_employee_replacement_missions
  WITH (security_invoker = true) AS
SELECT ra.id, ra.hotel_id, ra.replacement_employee_id AS employee_id,
       ra.absent_employee_id, ra.assignment_date, ra.status, ra.shift_label,
       ra.shift_start, ra.shift_end, ra.assigned_by_email, ra.confirmed_at,
       ra.proposed_at, ra.refused_reason, ra.creates_planning,
       h.name AS target_hotel_name,
       ae.first_name AS absent_first_name, ae.last_name AS absent_last_name,
       ae.role AS absent_role, ae.department AS absent_department
  FROM public.replacement_assignments ra
  JOIN public.hotels h ON h.id = ra.hotel_id
  JOIN public.employees ae ON ae.id = ra.absent_employee_id
 WHERE ra.hotel_id = public.get_user_hotel_id() OR public.is_platform_admin();

REVOKE ALL ON public.v_employee_replacement_missions FROM anon;
GRANT SELECT ON public.v_employee_replacement_missions TO authenticated;

-- ─── 7. portal_leave_balances ───────────────────────────────────────────────
DROP VIEW IF EXISTS public.portal_leave_balances CASCADE;
CREATE VIEW public.portal_leave_balances
  WITH (security_invoker = true) AS
SELECT hotel_id, employee_id,
       (date_trunc('year'::text, day::timestamp with time zone))::date AS year_start,
       COUNT(*) FILTER (WHERE status = 'CP'::text)  AS cp_taken,
       COUNT(*) FILTER (WHERE status = 'RTT'::text) AS rtt_taken
  FROM public.staff_planning sp
 WHERE hotel_id = public.get_user_hotel_id() OR public.is_platform_admin()
 GROUP BY hotel_id, employee_id, (date_trunc('year'::text, day::timestamp with time zone))::date;

REVOKE ALL ON public.portal_leave_balances FROM anon;
GRANT SELECT ON public.portal_leave_balances TO authenticated;

-- ─── 8. scaling_health (métrique globale infra) ─────────────────────────────
-- Pas de hotel_id sur worker_runs. Restreint aux platform_admins uniquement.
DROP VIEW IF EXISTS public.scaling_health CASCADE;
CREATE VIEW public.scaling_health
  WITH (security_invoker = true) AS
SELECT worker_name,
       COUNT(*) FILTER (WHERE started_at > now() - INTERVAL '7 days') AS runs_last_7d,
       AVG(duration_seconds) FILTER (WHERE started_at > now() - INTERVAL '7 days') AS avg_duration_7d,
       MAX(duration_seconds) FILTER (WHERE started_at > now() - INTERVAL '7 days') AS max_duration_7d,
       SUM(hotels_processed) FILTER (WHERE started_at > now() - INTERVAL '7 days') AS hotels_processed_7d,
       SUM(rows_ingested) FILTER (WHERE started_at > now() - INTERVAL '7 days') AS rows_ingested_7d,
       COUNT(*) FILTER (WHERE status = 'failed'::text AND started_at > now() - INTERVAL '7 days') AS failed_runs_7d,
       CASE
         WHEN AVG(duration_seconds) FILTER (WHERE started_at > now() - INTERVAL '7 days') > 480::numeric THEN 'upgrade_recommended'::text
         WHEN AVG(duration_seconds) FILTER (WHERE started_at > now() - INTERVAL '7 days') > 300::numeric THEN 'watch_closely'::text
         ELSE 'healthy'::text
       END AS tier_status
  FROM public.worker_runs
 WHERE finished_at IS NOT NULL AND public.is_platform_admin()
 GROUP BY worker_name;

REVOKE ALL ON public.scaling_health FROM anon;
GRANT SELECT ON public.scaling_health TO authenticated;

-- =============================================================================
-- FIN 20260651_security_sprint1_v1_views_invoker.sql
-- =============================================================================
