// ============================================================================
// FLOWTYM PMS — Navigation types (arborescence officielle)
// ============================================================================

export type PageId =
  // ── 1. FLOWDAY ─────────────────────────────────────────────────────────────
  | 'flowboard'
  | 'planning'
  | 'today'
  | 'housekeeping'
  | 'maintenance'
  // ── 2. SAS (sous-menu de Flowday dans la sidebar, module principal dans nav)
  | 'sas'
  | 'sas_incoming'
  | 'sas_rie'
  | 'sas_anomalies'
  | 'sas_quarantine'
  | 'sas_odms'
  | 'sas_reconciliation'
  | 'sas_audit'
  | 'sas_partners'
  // ── 3. RÉSERVATIONS ────────────────────────────────────────────────────────
  | 'reservations'
  | 'res_confirmed'
  | 'res_hold'
  | 'res_pending'
  | 'groupes'
  | 'res_payments'
  | 'res_anomalies'
  | 'res_relances'
  // ── 4. CLIENTS ─────────────────────────────────────────────────────────────
  | 'clients'
  | 'clients_companies'
  | 'clients_segments'
  | 'clients_merge'
  | 'clients_documents'
  | 'clients_blacklist'
  | 'clients_tiers'
  | 'clients_automation'
  // ── 5. REVENUE / RMS ───────────────────────────────────────────────────────
  // Pilotage
  | 'rev_dashboard'        // Dashboard RMS — cockpit décisionnel
  | 'rev_market'           // Marché & Concurrence
  | 'rev_pricing_reco'     // Pricing & Recommandations
  | 'rev_calendar'         // Calendrier tarifaire
  | 'rev_events'           // Événements — centre intelligent (premium)
  // Automatisation
  | 'rev_automation'       // Automatisation — moteur de règles RMS
  | 'rev_strategies'       // Stratégies tarifaires
  | 'rev_autopilot'        // Autopilote RMS
  | 'rev_simulation'       // Simulation RMS
  | 'rev_alerts'           // Alertes RMS
  // Distribution
  | 'rev_distribution'     // Distribution & OTA
  | 'rev_promotions'       // Promotions
  // Contrôle
  | 'rev_audit'            // Analyse & Audit
  // Legacy — redirigées via normalizePage()
  | 'revenue'
  | 'rev_pricing'
  | 'rev_channels'
  | 'rev_compset'
  | 'rev_rules'
  | 'rev_yield'
  | 'rms'
  | 'rms_history'
  // ── 6. FINANCE ─────────────────────────────────────────────────────────────
  | 'finance'
  | 'facturation'
  | 'fin_folios'
  | 'proforma'
  | 'caisse'
  | 'impayes'
  | 'fin_dunning'
  | 'cloture'
  | 'fin_reconciliation'
  | 'fin_bank_reco'
  | 'fin_einvoice'
  | 'tva2026'
  | 'paiements_securises'
  | 'comptabilite'
  | 'fin_audit_chain'
  | 'cash_management'
  // ── 7. ANALYSE ─────────────────────────────────────────────────────────────
  | 'analysis'
  | 'analysis_library'
  | 'analysis_favorites'
  | 'analysis_recent'
  | 'analysis_saved'
  | 'analysis_alerts'
  | 'kpi'
  | 'performance'
  | 'forecast'
  | 'rapports'
  | 'rapports_exploitation'
  | 'rapports_reservations'
  | 'rapports_backoffice'
  | 'rapports_comptabilite'
  | 'rapports_tva'
  | 'rapports_stats'
  | 'rapports_revenue'
  | 'rapports_housekeeping'
  // ── 8. PARAMÈTRES ──────────────────────────────────────────────────────────
  | 'settings'
  | 'settings_hotel'
  | 'settings_multihotel'
  | 'settings_room_types'
  | 'settings_rooms'
  | 'settings_floors'
  | 'settings_room_status'
  | 'settings_preferences'
  | 'settings_products'
  | 'settings_rate_plans'
  | 'settings_conditions'
  | 'settings_seasons'
  | 'settings_age_categories'
  | 'settings_invoice'
  | 'settings_numbering'
  | 'settings_payment_modes'
  | 'settings_accounting'
  | 'settings_debtors'
  | 'settings_fiscal'
  | 'settings_hk_status'
  | 'settings_hk_checklists'
  | 'settings_hk_staff'
  | 'settings_hk_distribution'
  | 'settings_maintenance'
  | 'settings_lost_found'
  | 'settings_breakfast'
  | 'settings_pms_sync'
  | 'settings_api'
  | 'settings_connectors'
  | 'settings_users'
  | 'settings_automations'
  | 'settings_notifications'
  | 'settings_rgpd'
  | 'settings_import_export'
  | 'settings_audit'
  | 'settings_backups';

export interface Reservation {
  id: string;
  reference: string;
  status: 'confirmed' | 'pending' | 'checkout' | 'cleaning' | 'arriving';
  client: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  channel: string;
  room: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  segment: 'business' | 'leisure' | 'vip' | 'group';
  loyalty: 'none' | 'star' | 'medal' | 'crown' | 'gem';
  lastStay: string;
  totalSpent: number;
}
