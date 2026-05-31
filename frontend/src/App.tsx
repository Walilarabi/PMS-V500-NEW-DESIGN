import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Bed, Wrench, Inbox, AlertTriangle, Lock, Settings, CheckCircle2, Clock,
  Hourglass, Users, CreditCard, AlertOctagon, Send, Construction,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Topbar } from '@/src/components/layout/Topbar';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { useAppShellStore } from '@/src/store/appShellStore';
import { PageId } from '@/src/types';
import type { ClientsPage } from '@/src/pages/clients/ClientsLayout';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────
// Each module is a separate async chunk. Vite splits them at build time.
// The helper below handles named-export modules gracefully.
const lz = <T extends Record<string, unknown>>(loader: () => Promise<T>, key: keyof T) =>
  lazy(() => loader().then(m => ({ default: m[key] as React.ComponentType<any> })));

// Core pages (most frequently visited — loaded first by browser hint)
const FlowboardView    = lz(() => import('@/src/pages/FlowboardView'),              'FlowboardView');
const TodayView        = lz(() => import('@/src/pages/TodayView'),                  'TodayView');
const PlanningView     = lz(() => import('@/src/pages/PlanningViewLive'),            'PlanningView');
const ReservationsView = lz(() => import('@/src/pages/ReservationsView'),            'ReservationsView');

// Réservations sub-pages
const ResFilteredView  = lz(() => import('@/src/pages/reservations/ResFilteredView'), 'ResFilteredView');
const GroupesView      = lz(() => import('@/src/pages/reservations/GroupesView'),      'GroupesView');
const ResPaymentsView  = lz(() => import('@/src/pages/reservations/ResPaymentsView'),  'ResPaymentsView');
const ResAnomaliesView = lz(() => import('@/src/pages/reservations/ResAnomaliesView'), 'ResAnomaliesView');
const ResRelancesView  = lz(() => import('@/src/pages/reservations/ResRelancesView'),  'ResRelancesView');

// Clients
const ClientsLayout    = lz(() => import('@/src/pages/clients/ClientsLayout'),       'ClientsLayout');

// Revenue / RMS
const RevenueDashboard    = lz(() => import('@/src/pages/revenue/RevenueDashboard'),       'RevenueDashboard');
const PricingCalendar     = lz(() => import('@/src/pages/revenue/PricingCalendar'),        'PricingCalendar');
const EventsView          = lz(() => import('@/src/pages/revenue/EventsView'),             'EventsView');
const DecisionHistoryPage = lz(() => import('@/src/pages/revenue/DecisionHistoryPage'),    'DecisionHistoryPage');
const CompetitiveWatchPage= lz(() => import('@/src/pages/rms/CompetitiveWatchPage'),       'CompetitiveWatchPage');
const PromotionsCompact   = lz(() => import('@/src/pages/revenue/PromotionsCompact'),      'PromotionsCompact');
const DistributionAnalytics=lz(() => import('@/src/pages/revenue/DistributionAnalytics'),  'DistributionAnalytics');
const YieldAndRules       = lz(() => import('@/src/pages/revenue/YieldAndRules'),          'YieldAndRules');
const RMSTableauPro       = lz(() => import('@/src/pages/revenue/RMSTableauPro'),          'RMSTableauPro');
const StrategiesPage      = lz(() => import('@/src/pages/revenue/StrategiesPage'),         'StrategiesPage');
const AutopilotPage       = lz(() => import('@/src/pages/revenue/AutopilotPage'),          'AutopilotPage');
const SimulationPage      = lz(() => import('@/src/pages/revenue/SimulationPage'),         'SimulationPage');
const AlertsPage          = lz(() => import('@/src/pages/revenue/AlertsPage'),             'AlertsPage');

// Finance
const FinanceLayout       = lz(() => import('@/src/pages/finance/FinanceLayout'),          'FinanceLayout');
const FacturationView     = lz(() => import('@/src/pages/finance/FacturationView'),        'FacturationView');
const AuditLogView        = lz(() => import('@/src/pages/finance/AuditLogView'),           'AuditLogView');
const ReconciliationView  = lz(() => import('@/src/pages/finance/ReconciliationView'),     'ReconciliationView');
const RevenueIntegrityView= lz(() => import('@/src/pages/finance/RevenueIntegrityView'),   'RevenueIntegrityView');

// Analysis
const AnalysisLayout      = lz(() => import('@/src/pages/analysis/AnalysisLayout'),        'AnalysisLayout');

// Flowday
const HousekeepingView    = lz(() => import('@/src/pages/flowday/HousekeepingView'),       'HousekeepingView');
const MaintenanceView     = lz(() => import('@/src/pages/flowday/MaintenanceView'),        'MaintenanceView');

// SAS
const OdmsView            = lz(() => import('@/src/pages/sas/OdmsView'),                  'OdmsView');
const SasIncomingView     = lz(() => import('@/src/pages/sas/SasIncomingView'),            'SasIncomingView');
const SasAnomaliesView    = lz(() => import('@/src/pages/sas/SasAnomaliesView'),           'SasAnomaliesView');
const SasQuarantineView   = lz(() => import('@/src/pages/sas/SasQuarantineView'),          'SasQuarantineView');
const SasPartnersView     = lz(() => import('@/src/pages/sas/SasPartnersView'),            'SasPartnersView');

// Settings
const SettingsView        = lz(() => import('@/src/pages/SettingsView'),                   'SettingsView');

// Support / Aide
const SupportView         = lz(() => import('@/src/pages/support/SupportView'),            'SupportView');

// ── Page-transition skeleton ───────────────────────────────────────────────
const PageSkeleton = () => (
  <div className="flex-1 flex flex-col p-6 gap-4 bg-[#F9FAFB] animate-pulse">
    <div className="h-8 w-48 bg-gray-200 rounded-xl" />
    <div className="h-4 w-80 bg-gray-100 rounded-lg" />
    <div className="flex gap-4 mt-2">
      {[1,2,3,4].map(i => <div key={i} className="h-24 flex-1 bg-gray-100 rounded-2xl" />)}
    </div>
    <div className="flex-1 bg-gray-100 rounded-2xl mt-2" />
  </div>
);

// Realtime hooks
import {
  useReservationsRealtime,
  useReconciliationRealtime,
  useRevenueAnomaliesRealtime,
  useSasIncomingRealtime,
} from '@/src/hooks/useRealtimeChannels';
import { useSupabaseSync } from '@/src/hooks/useSupabaseSync';
import { useCentralPricingSync } from '@/src/hooks/useCentralPricingSync';

// Placeholder universel — icône Lucide (épuré, minimaliste)
const Placeholder = ({ title, icon: Icon = Construction }: { title: string; icon?: LucideIcon }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F9FAFB]">
    <div className="w-20 h-20 bg-[#8B5CF6]/10 rounded-3xl flex items-center justify-center mb-6">
      <Icon className="w-9 h-9 text-[#8B5CF6]" strokeWidth={1.75} />
    </div>
    <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
    <p className="text-sm text-gray-400 max-w-sm">
      Ce module est en cours de développement et sera disponible prochainement.
    </p>
    <div className="mt-6 px-4 py-2 bg-[#8B5CF6]/8 rounded-xl text-xs font-bold text-[#8B5CF6] uppercase tracking-widest">
      Coming soon
    </div>
  </div>
);

// Anciennes clés de page Revenue → nouvelles clés (redirections propres)
const LEGACY_REVENUE_ALIASES: Record<string, PageId> = {
  revenue: 'rev_dashboard',
  rev_compset: 'rev_market',
  rev_pricing: 'rev_calendar',
  rms: 'rev_pricing_reco',
  rms_history: 'rev_audit',
  rev_channels: 'rev_distribution',
  rev_rules: 'rev_automation',
  rev_yield: 'rev_automation',
};

/** Normalise une clé de page : redirige proprement les anciennes routes Revenue. */
function normalizePage(page: string): PageId {
  return (LEGACY_REVENUE_ALIASES[page] ?? page) as PageId;
}

/** Détermine si une PageId appartient au module Paramètres. */
function isSettingsPage(page: PageId): boolean {
  return typeof page === 'string' && page.startsWith('settings');
}

function renderPage(page: PageId, setActivePage: (p: PageId) => void): React.ReactNode {
  switch (page) {
    // ── FLOWDAY ───────────────────────────────────────────────────────────────
    case 'flowboard':   return <FlowboardView />;
    case 'planning':    return <PlanningView />;
    case 'today':       return <TodayView />;
    case 'housekeeping':return <HousekeepingView />;
    case 'maintenance': return <MaintenanceView />;

    // ── SAS ───────────────────────────────────────────────────────────────────
    case 'sas':
    case 'sas_incoming':       return <SasIncomingView />;
    case 'sas_rie':            return <RevenueIntegrityView />;
    case 'sas_anomalies':      return <SasAnomaliesView />;
    case 'sas_quarantine':     return <SasQuarantineView />;
    case 'sas_odms':           return <OdmsView />;
    case 'sas_reconciliation': return <ReconciliationView />;
    case 'sas_audit':          return <AuditLogView />;
    case 'sas_partners':       return <SasPartnersView />;

    // ── RÉSERVATIONS ──────────────────────────────────────────────────────────
    case 'reservations':  return <ReservationsView />;
    case 'res_confirmed': return <ResFilteredView statuses={['confirmed']} title="Réservations confirmées" subtitle="Réservations validées en attente d'arrivée" icon={CheckCircle2} accentColor="#10B981" />;
    case 'res_hold':      return <ResFilteredView statuses={['hold']} title="En option (Hold)" subtitle="Options temporaires — expiration automatique sous 48 h d'arrivée" icon={Clock} accentColor="#F59E0B" showCountdown />;
    case 'res_pending':   return <ResFilteredView statuses={['pending']} title="En attente de confirmation" subtitle="Demandes reçues sans confirmation" icon={Hourglass} accentColor="#64748B" />;
    case 'groupes':       return <GroupesView />;
    case 'res_payments':  return <ResPaymentsView />;
    case 'res_anomalies': return <ResAnomaliesView />;
    case 'res_relances':  return <ResRelancesView />;

    // ── CLIENTS (routé via ClientsLayout — Wave C1) ───────────────────────────
    case 'clients':
    case 'clients_companies':
    case 'clients_segments':
    case 'clients_merge':
    case 'clients_documents':
    case 'clients_blacklist':
    case 'clients_tiers':
    case 'clients_automation':
      return <ClientsLayout activePage={page as ClientsPage} />;

    // ── REVENUE / RMS ─────────────────────────────────────────────────────────
    // Pilotage
    case 'revenue':
    case 'rev_dashboard':       return <RevenueDashboard />;
    case 'rev_compset':
    case 'rev_market':          return <CompetitiveWatchPage />;
    case 'rms':
    case 'rev_pricing_reco':    return <RMSTableauPro />;
    case 'rev_pricing':
    case 'rev_calendar':        return <PricingCalendar />;
    case 'rev_events':          return <EventsView />;
    // Automatisation
    case 'rev_rules':
    case 'rev_yield':
    case 'rev_automation':      return <YieldAndRules />;
    case 'rev_strategies':      return <StrategiesPage />;
    case 'rev_autopilot':       return <AutopilotPage />;
    case 'rev_simulation':      return <SimulationPage />;
    case 'rev_alerts':          return <AlertsPage />;
    // Distribution
    case 'rev_channels':
    case 'rev_distribution':    return <DistributionAnalytics />;
    case 'rev_promotions':      return <PromotionsCompact />;
    // Contrôle
    case 'rms_history':
    case 'rev_audit':           return <DecisionHistoryPage />;

    // ── FINANCE ───────────────────────────────────────────────────────────────
    case 'finance':
    case 'facturation':
    case 'fin_folios':
    case 'proforma':
    case 'caisse':
    case 'impayes':
    case 'fin_dunning':
    case 'cloture':
    case 'fin_reconciliation':
    case 'fin_bank_reco':
    case 'fin_einvoice':
    case 'tva2026':
    case 'paiements_securises':
    case 'comptabilite':
    case 'fin_audit_chain':
    case 'cash_management':
    case 'fin_house_accounts':
    case 'fin_deposits':
    case 'fin_timeline':
    case 'fin_group_billing':
      return <FinanceLayout activePage={page as any} />;

    // ── ANALYSE ───────────────────────────────────────────────────────────────
    case 'analysis':
    case 'analysis_library':
    case 'analysis_favorites':
    case 'analysis_recent':
    case 'analysis_saved':
    case 'analysis_alerts':
      return <AnalysisLayout activePage={page} onNavigateSubPage={(p) => setActivePage(p)} />;
    // Legacy redirections (anciennes PageIds → nouvelle vue d'ensemble)
    case 'kpi':
    case 'performance':
    case 'forecast':
    case 'rapports':
    case 'rapports_exploitation':
    case 'rapports_reservations':
    case 'rapports_backoffice':
    case 'rapports_comptabilite':
    case 'rapports_tva':
    case 'rapports_stats':
    case 'rapports_revenue':
    case 'rapports_housekeeping':
      return <AnalysisLayout activePage="analysis" onNavigateSubPage={(p) => setActivePage(p)} />;

    // ── PARAMÈTRES ────────────────────────────────────────────────────────────
    // ── AIDE & SUPPORT ────────────────────────────────────────────────────────
    case 'support': return <SupportView />;

    // ── PARAMÈTRES ────────────────────────────────────────────────────────────
    case 'settings':
    case 'settings_hotel':
    case 'settings_multihotel':
    case 'settings_room_types':
    case 'settings_rooms':
    case 'settings_floors':
    case 'settings_room_status':
    case 'settings_preferences':
    case 'settings_products':
    case 'settings_rate_plans':
    case 'settings_conditions':
    case 'settings_seasons':
    case 'settings_age_categories':
    case 'settings_invoice':
    case 'settings_numbering':
    case 'settings_payment_modes':
    case 'settings_accounting':
    case 'settings_debtors':
    case 'settings_fiscal':
    case 'settings_hk_status':
    case 'settings_hk_checklists':
    case 'settings_hk_staff':
    case 'settings_hk_distribution':
    case 'settings_maintenance':
    case 'settings_lost_found':
    case 'settings_breakfast':
    case 'settings_pms_sync':
    case 'settings_api':
    case 'settings_connectors':
    case 'settings_users':
    case 'settings_automations':
    case 'settings_notifications':
    case 'settings_rgpd':
    case 'settings_import_export':
    case 'settings_audit':
    case 'settings_backups':
    default:                         return <SettingsView activePage={page} onNavigate={setActivePage} />;
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('flowboard');
  // Sidebar de navigation principale — état partagé (persisté) pour que le
  // bouton Collapse du Planning puisse la piloter sans casser la colonne Chambre.
  const sidebarCollapsed = useAppShellStore((s) => s.navCollapsed);
  const setSidebarCollapsed = useAppShellStore((s) => s.setNavCollapsed);

  useReservationsRealtime();
  useReconciliationRealtime();
  useRevenueAnomaliesRealtime();
  useSasIncomingRealtime();
  useSupabaseSync();  // Synchronise les rooms et réservations depuis Supabase vers les stores locaux
  useCentralPricingSync();  // Propage les décisions du Central Pricing Engine → Calendrier tarifaire (chambre/plan de référence)

  // Navigation normalisée — redirige les anciennes routes Revenue vers les nouvelles
  const navigate = useCallback((page: PageId) => {
    setActivePage(normalizePage(page));
  }, []);

  // Écouteur global pour la navigation par CustomEvent (utilisé par les CTA des pages)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ page?: string }>).detail;
      if (detail?.page) {
        setActivePage(normalizePage(detail.page));
      }
    };
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F9FAFB]">
      <Topbar activePage={activePage} setActivePage={navigate} />
      <div className="flex flex-1 overflow-hidden">
        {/*
          Le module Paramètres remplace la sidebar globale par sa propre
          chrome interne (top-tabs horizontaux + sub-nav vertical) afin
          d'éviter deux navigations concurrentes (cf. brief Control Center).
        */}
        {!isSettingsPage(activePage) && (
          <Sidebar
            activePage={activePage}
            setActivePage={navigate}
            isCollapsed={sidebarCollapsed}
            setIsCollapsed={setSidebarCollapsed}
          />
        )}
        <main className="flex-1 overflow-hidden flex flex-col">
          <Suspense fallback={<PageSkeleton />}>
            {renderPage(activePage, navigate)}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
