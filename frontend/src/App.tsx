import React, { useState, useEffect, useCallback } from 'react';
import {
  Bed, Wrench, Inbox, AlertTriangle, Lock, Settings, CheckCircle2, Clock,
  Hourglass, Users, CreditCard, AlertOctagon, Send, Construction,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Topbar } from '@/src/components/layout/Topbar';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { PageId } from '@/src/types';

// Pages existantes
import { TodayView }        from '@/src/pages/TodayView';
import { PlanningView }     from '@/src/pages/PlanningViewLive';
import { ReservationsView } from '@/src/pages/ReservationsView';
import { ClientsLayout }    from '@/src/pages/clients/ClientsLayout';
import type { ClientsPage }  from '@/src/pages/clients/ClientsLayout';
import { RevenueDashboard }    from '@/src/pages/revenue/RevenueDashboard';
import { PricingCalendar }     from '@/src/pages/revenue/PricingCalendar';
import { EventsView }          from '@/src/pages/revenue/EventsView';

// RMS ENTERPRISE ULTIMATE
import { DecisionHistoryPage } from '@/src/pages/revenue/DecisionHistoryPage';
import { CompetitiveWatchPage } from '@/src/pages/rms/CompetitiveWatchPage';
import { PromotionsCompact }   from '@/src/pages/revenue/PromotionsCompact';
import { DistributionAnalytics } from '@/src/pages/revenue/DistributionAnalytics';
import { YieldAndRules }       from '@/src/pages/revenue/YieldAndRules';
import { RMSTableauPro }       from '@/src/pages/revenue/RMSTableauPro';
import { StrategiesPage }      from '@/src/pages/revenue/StrategiesPage';
import { AutopilotPage }       from '@/src/pages/revenue/AutopilotPage';
import { SimulationPage }      from '@/src/pages/revenue/SimulationPage';
import { AlertsPage }          from '@/src/pages/revenue/AlertsPage';
import { FinanceView }      from '@/src/pages/FinanceView';
import { FinanceLayout }    from '@/src/pages/finance/FinanceLayout';
import { AnalysisLayout }   from '@/src/pages/analysis/AnalysisLayout';
import { FlowboardView }    from '@/src/pages/FlowboardView';
import { SettingsView }     from '@/src/pages/SettingsView';
import { FacturationView }  from '@/src/pages/finance/FacturationView';
import { AuditLogView }     from '@/src/pages/finance/AuditLogView';
import { ReconciliationView } from '@/src/pages/finance/ReconciliationView';
import { RevenueIntegrityView } from '@/src/pages/finance/RevenueIntegrityView';
import { OdmsView }         from '@/src/pages/sas/OdmsView';

// Realtime hooks
import {
  useReservationsRealtime,
  useReconciliationRealtime,
  useRevenueAnomaliesRealtime,
  useSasIncomingRealtime,
} from '@/src/hooks/useRealtimeChannels';
import { useSupabaseSync } from '@/src/hooks/useSupabaseSync';
import { DebugPanel } from '@/src/components/DebugPanel';

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

function renderPage(page: PageId, setActivePage: (p: PageId) => void): React.ReactNode {
  switch (page) {
    // ── FLOWDAY ───────────────────────────────────────────────────────────────
    case 'flowboard':   return <FlowboardView />;
    case 'planning':    return <PlanningView />;
    case 'today':       return <TodayView />;
    case 'housekeeping':return <Placeholder title="Housekeeping" icon={Bed} />;
    case 'maintenance': return <Placeholder title="Maintenance" icon={Wrench} />;

    // ── SAS ───────────────────────────────────────────────────────────────────
    case 'sas':
    case 'sas_incoming':       return <Placeholder title="Réservations entrantes OTA" icon={Inbox} />;
    case 'sas_rie':            return <RevenueIntegrityView />;
    case 'sas_anomalies':      return <Placeholder title="Anomalies détectées" icon={AlertTriangle} />;
    case 'sas_quarantine':     return <Placeholder title="File quarantaine" icon={Lock} />;
    case 'sas_odms':           return <OdmsView />;
    case 'sas_reconciliation': return <ReconciliationView />;
    case 'sas_audit':          return <AuditLogView />;
    case 'sas_partners':       return <Placeholder title="Config. partenaires OTA" icon={Settings} />;

    // ── RÉSERVATIONS ──────────────────────────────────────────────────────────
    case 'reservations':  return <ReservationsView />;
    case 'res_confirmed': return <Placeholder title="Réservations confirmées" icon={CheckCircle2} />;
    case 'res_hold':      return <Placeholder title="En option (Hold)" icon={Clock} />;
    case 'res_pending':   return <Placeholder title="Pending" icon={Hourglass} />;
    case 'groupes':       return <Placeholder title="Groupes" icon={Users} />;
    case 'res_payments':  return <Placeholder title="Suivi des paiements" icon={CreditCard} />;
    case 'res_anomalies': return <Placeholder title="Anomalies financières" icon={AlertOctagon} />;
    case 'res_relances':  return <Placeholder title="Relances" icon={Send} />;

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
    default:                         return <SettingsView activePage={page} />;
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('flowboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useReservationsRealtime();
  useReconciliationRealtime();
  useRevenueAnomaliesRealtime();
  useSasIncomingRealtime();
  useSupabaseSync();  // Synchronise les rooms et réservations depuis Supabase vers les stores locaux

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
        <Sidebar
          activePage={activePage}
          setActivePage={navigate}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderPage(activePage, navigate)}
        </main>
      </div>
      <DebugPanel />
    </div>
  );
}
