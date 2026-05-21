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
  | 'clients_cardex'
  | 'clients_companies'
  | 'clients_segments'
  | 'clients_merge'
  | 'clients_documents'
  | 'clients_blacklist'
  | 'clients_tiers'
  // ── 5. REVENUE ─────────────────────────────────────────────────────────────
  // Pilotage
  | 'revenue'              // Dashboard Revenue
  | 'rev_pricing'          // Calendrier tarifaire (grille de prix)
  // Distribution
  | 'rev_channels'         // Canaux & OTAs
  | 'rev_market'           // Veille concurrentielle (deprecated)
  | 'rev_compset'          // Veille Concurrentielle (nouvelle page dédiée)
  // Automatisation
  | 'rev_rules'            // Règles tarifaires (auto-pricing)
  | 'rev_yield'            // Yield management
  | 'rev_promotions'       // Promotions
  | 'rms'                  // RMS Tableau Pro (Enterprise)
  | 'rms_history'          // Historique horodaté des décisions RMS
  // ── 6. FINANCE ─────────────────────────────────────────────────────────────
  | 'finance'
  | 'facturation'
  | 'proforma'
  | 'caisse'
  | 'impayes'
  | 'cloture'
  | 'fin_reconciliation'
  | 'tva2026'
  | 'paiements_securises'
  | 'comptabilite'
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
