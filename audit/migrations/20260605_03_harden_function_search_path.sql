-- ============================================================================
-- AUDIT FLOWTYM — Correctif Sécurité #3
-- Problème : 40 fonctions (dont plusieurs SECURITY DEFINER) sans search_path
--            fixe => vulnérables au "search_path hijacking" (advisor 0011
--            `function_search_path_mutable`). Critique combiné à SECURITY DEFINER.
-- Correctif : fixer search_path = pg_catalog, public sur chaque fonction listée.
--            Boucle dynamique => robuste aux surcharges / signatures.
-- Statut : PRÊT À APPLIQUER (sans risque fonctionnel).
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE
      (n.nspname = 'app' AND p.proname IN (
        'audit_reservations','ensure_user_profile','fec_exports_immutable',
        'log_reservation_change','resolve_actor_user_id','set_updated_at_flowday',
        'set_updated_at_sas'
      ))
      OR (n.nspname = 'public' AND p.proname IN (
        '_folio_transfers_immutable','_tva_snapshot_immutable',
        'attachment_access_log_immutable','audit_hotel_rms_events',
        'comm_touch_updated_at','conversations_bump_thread',
        'get_active_lighthouse_import','get_rms_push_markup',
        'grant_superadmin_on_new_hotel','guests_sync_badges_flags',
        'hotel_rms_events_denormalize','house_account_lines_immutable',
        'next_credit_note_number','next_invoice_number','pl_touch_updated_at',
        'platform_admin_role','rms_audit_log_immutable_check',
        'rms_decisions_immutable_check','rms_get_compset_stats',
        'rms_get_event_impact_score','rms_touch_updated_at',
        'salon_events_block_delete','salon_events_bump_version','set_updated_at',
        'support_set_ticket_number','support_set_updated_at',
        'sync_house_account_balance','sync_invoice_totals',
        'trg_fn_credit_notes_immutable','trg_fn_set_updated_at',
        'trg_help_articles_updated_at','update_updated_at_column',
        'upsert_hotel_rms_events'
      ))
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public',
      r.nspname, r.proname, r.args
    );
  END LOOP;
END $$;
