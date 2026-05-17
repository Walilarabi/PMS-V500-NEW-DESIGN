import React from 'react';
import {
  Zap, Calendar, Users, TrendingUp, CreditCard,
  BarChart2, Settings, Shield, LogOut,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PageId } from '@/src/types';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { useSasNavBadges } from '@/src/domains/sas/hooks';
import { HotelSelector } from './HotelSelector';

interface TopbarProps {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
}

const PAGE_TO_NAV: Record<string, string> = {
  // Flowday
  flowboard: 'flowday', planning: 'flowday', today: 'flowday',
  housekeeping: 'flowday', maintenance: 'flowday',
  // SAS
  sas: 'sas', sas_incoming: 'sas', sas_rie: 'sas',
  sas_anomalies: 'sas', sas_quarantine: 'sas', sas_odms: 'sas',
  sas_reconciliation: 'sas', sas_audit: 'sas', sas_partners: 'sas',
  // Réservations
  reservations: 'reservations', res_confirmed: 'reservations',
  res_hold: 'reservations', res_pending: 'reservations',
  groupes: 'reservations', res_payments: 'reservations',
  res_anomalies: 'reservations', res_relances: 'reservations',
  // Clients
  clients: 'clients', clients_cardex: 'clients', clients_companies: 'clients',
  clients_segments: 'clients', clients_merge: 'clients',
  clients_documents: 'clients', clients_blacklist: 'clients', clients_tiers: 'clients',
  // Revenue
  revenue: 'revenue', rev_pricing: 'revenue', rev_channels: 'revenue',
  rev_market: 'revenue', rev_rules: 'revenue', rev_yield: 'revenue',
  rev_promotions: 'revenue',
  // Finance
  finance: 'finance', facturation: 'finance', proforma: 'finance',
  caisse: 'finance', impayes: 'finance', cloture: 'finance',
  fin_reconciliation: 'finance', tva2026: 'finance',
  paiements_securises: 'finance', comptabilite: 'finance', cash_management: 'finance',
  // Analyse
  analysis: 'analysis', kpi: 'analysis', performance: 'analysis',
  forecast: 'analysis', rapports: 'analysis',
  // Paramètres
  settings: 'settings',
};

const NAV_ITEMS = [
  { id: 'flowday',      label: 'Flowday',       icon: Zap,        defaultPage: 'flowboard' as PageId },
  { id: 'sas',         label: 'SAS',            icon: Shield,     defaultPage: 'sas_incoming' as PageId, hasBadge: true },
  { id: 'reservations', label: 'Réservations',  icon: Calendar,   defaultPage: 'reservations' as PageId },
  { id: 'clients',      label: 'Clients',       icon: Users,      defaultPage: 'clients' as PageId },
  { id: 'revenue',      label: 'Revenue',       icon: TrendingUp, defaultPage: 'revenue' as PageId },
  { id: 'finance',      label: 'Finance',       icon: CreditCard, defaultPage: 'facturation' as PageId },
  { id: 'analysis',     label: 'Analyse',       icon: BarChart2,  defaultPage: 'analysis' as PageId },
  { id: 'settings',     label: 'Paramètres',    icon: Settings,   defaultPage: 'settings' as PageId },
];

export const Topbar = ({ activePage, setActivePage }: TopbarProps) => {
  const { logout } = useAuth();
  const { data: sasBadges } = useSasNavBadges();

  const activeNav = activePage.startsWith('settings') ? 'settings' : PAGE_TO_NAV[activePage] ?? 'flowday';
  const pendingCount = sasBadges?.pending_count ?? 0;
  const anomalyCount = sasBadges?.anomaly_count ?? 0;

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-4 shrink-0 z-40">
      {/* Logo + Hotel Selector */}
      <div className="flex items-center gap-2.5 w-60 shrink-0">
        <div className="w-8 h-8 bg-[#8B5CF6] rounded-xl flex items-center justify-center shadow-lg shadow-[#8B5CF6]/30 shrink-0">
          <span className="text-white font-black text-sm">F</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-gray-900 leading-none tracking-tight">FLOWTYM</p>
          <div className="mt-0.5">
            <HotelSelector />
          </div>
        </div>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-0.5 bg-gray-50 p-1 rounded-2xl border border-gray-100">
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            const isSas = item.id === 'sas';

            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.defaultPage)}
                className={cn(
                  'relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[13px] font-semibold uppercase tracking-wide transition-all duration-200',
                  isActive
                    ? 'bg-white text-[#8B5CF6] shadow-sm ring-1 ring-gray-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/60',
                )}
              >
                <item.icon size={15} />
                {item.label}

                {/* Bulles SAS dans le bouton Flowday */}
                {isSas && (pendingCount > 0 || anomalyCount > 0) && (
                  <span className="flex items-center gap-0.5">
                    {pendingCount > 0 && (
                      <span className="min-w-[15px] h-[15px] px-1 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                    {anomalyCount > 0 && (
                      <span className="min-w-[15px] h-[15px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                        {anomalyCount > 99 ? '99+' : anomalyCount}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* User menu */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut size={13} />
          Déconnexion
        </button>
      </div>
    </header>
  );
};
