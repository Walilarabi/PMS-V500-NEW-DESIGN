import React, { useState } from 'react';
import { Topbar } from '@/src/components/layout/Topbar';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { PageId } from '@/src/types';

// Pages existantes
import { TodayView }        from '@/src/pages/TodayView';
import { PlanningView }     from '@/src/pages/PlanningViewLive';
import { ReservationsView } from '@/src/pages/ReservationsView';
import { ClientsView }      from '@/src/pages/ClientsView';
import { RevenueDashboard }    from '@/src/pages/revenue/RevenueDashboard';
import { PricingCalendar }     from '@/src/pages/revenue/PricingCalendar';

// RMS ENTERPRISE ULTIMATE (6 pages complètes)
import { RateManager }         from '@/src/pages/revenue/RateManager';
import { DecisionHistory }     from '@/src/pages/revenue/DecisionHistory';
import { CompetitiveIntel }    from '@/src/pages/revenue/CompetitiveIntel';
import { LighthouseMonthlyView } from '@/src/pages/revenue/LighthouseMonthlyView';
import { Channels }            from '@/src/pages/revenue/Channels';
import { Promotions }          from '@/src/pages/revenue/Promotions';
// PricingRules already imported below

// Anciennes versions (deprecated - à supprimer ultérieurement)
import { ChannelsView }        from '@/src/pages/revenue/ChannelsView';
import { MarketIntelligence }  from '@/src/pages/revenue/MarketIntelligence';
import { PricingRules }        from '@/src/pages/revenue/PricingRules';
import { YieldView }           from '@/src/pages/revenue/YieldView';
import { PromotionsView }      from '@/src/pages/revenue/PromotionsView';
import { RMSTableauPro }       from '@/src/pages/revenue/RMSTableauPro';
import { VeilleConcurrentielle } from '@/src/pages/revenue/VeilleConcurrentielle';
import { FinanceView }      from '@/src/pages/FinanceView';
import { AnalysisView }     from '@/src/pages/AnalysisView';
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

// Placeholder universel
const Placeholder = ({ title, icon }: { title: string; icon?: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F9FAFB]">
    <div className="w-20 h-20 bg-[#8B5CF6]/8 rounded-3xl flex items-center justify-center mb-6">
      <span className="text-4xl">{icon ?? '🏗️'}</span>
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

function renderPage(page: PageId): React.ReactNode {
  switch (page) {
    // ── FLOWDAY ───────────────────────────────────────────────────────────────
    case 'flowboard':   return <FlowboardView />;
    case 'planning':    return <PlanningView />;
    case 'today':       return <TodayView />;
    case 'housekeeping':return <Placeholder title="Housekeeping" icon="🛏️" />;
    case 'maintenance': return <Placeholder title="Maintenance" icon="🔧" />;

    // ── SAS ───────────────────────────────────────────────────────────────────
    case 'sas':
    case 'sas_incoming':       return <Placeholder title="Réservations entrantes OTA" icon="📥" />;
    case 'sas_rie':            return <RevenueIntegrityView />;
    case 'sas_anomalies':      return <Placeholder title="Anomalies détectées" icon="⚠️" />;
    case 'sas_quarantine':     return <Placeholder title="File quarantaine" icon="🔒" />;
    case 'sas_odms':           return <OdmsView />;
    case 'sas_reconciliation': return <ReconciliationView />;
    case 'sas_audit':          return <AuditLogView />;
    case 'sas_partners':       return <Placeholder title="Config. partenaires OTA" icon="⚙️" />;

    // ── RÉSERVATIONS ──────────────────────────────────────────────────────────
    case 'reservations':  return <ReservationsView />;
    case 'res_confirmed': return <Placeholder title="Réservations confirmées" icon="✅" />;
    case 'res_hold':      return <Placeholder title="En option (Hold)" icon="⏸️" />;
    case 'res_pending':   return <Placeholder title="Pending" icon="⏳" />;
    case 'groupes':       return <Placeholder title="Groupes" icon="👥" />;
    case 'res_payments':  return <Placeholder title="Suivi des paiements" icon="💳" />;
    case 'res_anomalies': return <Placeholder title="Anomalies financières" icon="🚨" />;
    case 'res_relances':  return <Placeholder title="Relances" icon="📨" />;

    // ── CLIENTS ───────────────────────────────────────────────────────────────
    case 'clients':           return <ClientsView />;
    case 'clients_cardex':    return <Placeholder title="Particuliers (Cardex)" icon="👤" />;
    case 'clients_companies': return <Placeholder title="Sociétés / Agences" icon="🏢" />;
    case 'clients_segments':  return <Placeholder title="Segments marketing" icon="🎯" />;
    case 'clients_merge':     return <Placeholder title="Fusion / Dédoublonnage" icon="🔀" />;
    case 'clients_documents': return <Placeholder title="Documents & signatures" icon="📄" />;
    case 'clients_blacklist': return <Placeholder title="Blacklist / Watchlist" icon="🚫" />;
    case 'clients_tiers':     return <Placeholder title="Tiers / Prescripteurs" icon="🤝" />;

    // ── REVENUE ───────────────────────────────────────────────────────────────
    case 'revenue':        return <RevenueDashboard />;
    case 'rev_pricing':    return <PricingCalendar />;
    
    // RMS ENTERPRISE ULTIMATE
    case 'rms':            return <RateManager />;
    case 'rms_history':    return <DecisionHistory />;
    case 'rev_compset':    return <LighthouseMonthlyView />;
    case 'rev_channels':   return <Channels />;
    case 'rev_promotions': return <Promotions />;
    case 'rev_rules':      return <PricingRules />;
    
    // Anciennes versions (deprecated)
    case 'rev_market':     return <MarketIntelligence />;
    case 'rev_yield':      return <YieldView />;

    // ── FINANCE ───────────────────────────────────────────────────────────────
    case 'facturation':        return <FacturationView />;
    case 'proforma':           return <Placeholder title="Proforma / Devis" icon="📋" />;
    case 'caisse':             return <Placeholder title="Petite caisse" icon="💰" />;
    case 'impayes':            return <Placeholder title="Impayés / Débiteurs" icon="⚠️" />;
    case 'cloture':            return <Placeholder title="Clôture & Audit" icon="🔐" />;
    case 'fin_reconciliation': return <ReconciliationView />;
    case 'tva2026':            return <Placeholder title="TVA 2026 & e-facture" icon="🧾" />;
    case 'paiements_securises':return <Placeholder title="Paiements sécurisés" icon="🛡️" />;
    case 'comptabilite':       return <Placeholder title="Comptabilité" icon="📒" />;
    case 'cash_management':    return <Placeholder title="Cash Management" icon="💵" />;
    case 'finance':            return <FinanceView activeTab="facturation" />;

    // ── ANALYSE ───────────────────────────────────────────────────────────────
    case 'analysis':
    case 'kpi':                      return <AnalysisView />;
    case 'performance':              return <Placeholder title="Performance" icon="🏆" />;
    case 'forecast':                 return <Placeholder title="Prévisionnel" icon="🔭" />;
    case 'rapports':                 return <Placeholder title="Rapports (93)" icon="📊" />;
    case 'rapports_exploitation':    return <Placeholder title="Rapports Exploitation" icon="🏨" />;
    case 'rapports_reservations':    return <Placeholder title="Rapports Réservations" icon="📅" />;
    case 'rapports_backoffice':      return <Placeholder title="Rapports Back office" icon="🏦" />;
    case 'rapports_comptabilite':    return <Placeholder title="Rapports Comptabilité" icon="📒" />;
    case 'rapports_tva':             return <Placeholder title="Rapports TVA 2026" icon="🧾" />;
    case 'rapports_stats':           return <Placeholder title="Statistiques" icon="📈" />;
    case 'rapports_revenue':         return <Placeholder title="Rapports Revenue" icon="💹" />;
    case 'rapports_housekeeping':    return <Placeholder title="Rapports Housekeeping" icon="🛏️" />;

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F9FAFB]">
      <Topbar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderPage(activePage)}
        </main>
      </div>
      <DebugPanel />
    </div>
  );
}
