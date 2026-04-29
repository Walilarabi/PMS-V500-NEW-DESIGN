import React from 'react';
import { 
  Calendar,
  RefreshCcw,
  Hash,
  Monitor,
  Users,
  CreditCard,
  Send,
  AlertCircle,
  FileText,
  Banknote,
  Lock,
  History,
  TrendingUp,
  Percent,
  XCircle,
  PlusCircle,
  Building2,
  Database,
  Cloud,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PageId } from '@/src/types';

interface SidebarProps {
  activePage: PageId;
  setActivePage: (id: PageId) => void;
}

export const Sidebar = ({ activePage, setActivePage }: SidebarProps) => {
  // Determine the "parent" category to show the right sub-menu
  const getCategory = (page: PageId) => {
    if (['reservations', 'calendrier', 'mouvements', 'qr', 'simulation', 'groupes', 'paiements', 'relances', 'anomalies'].includes(page)) return 'reservations';
    if (['revenue', 'yield', 'promotions'].includes(page)) return 'revenue';
    if (['finance', 'facturation', 'caisse', 'impayes', 'cloture'].includes(page)) return 'finance';
    if (['settings', 'annulations', 'supplements', 'fermatures', 'hotel', 'taxe', 'pms', 'api'].includes(page)) return 'settings';
    if (page === 'clients') return 'clients';
    if (page === 'analysis') return 'analysis';
    return 'general';
  };

  const category = getCategory(activePage);

  const subMenus: Record<string, { label: string; items: { id: string; label: string; icon: any }[] }> = {
    reservations: {
      label: 'Réservations',
      items: [
        { id: 'reservations', label: 'Dashboard', icon: Calendar },
        { id: 'mouvements', label: 'Arrivées / Départs', icon: RefreshCcw },
        { id: 'qr', label: 'QR Check-in', icon: Hash },
        { id: 'simulation', label: 'Simulation', icon: Monitor },
        { id: 'groupes', label: 'Groupes', icon: Users },
        { id: 'paiements', label: 'Paiements', icon: CreditCard },
        { id: 'relances', label: 'Relances', icon: Send },
        { id: 'anomalies', label: 'Anomalies', icon: AlertCircle },
      ]
    },
    finance: {
      label: 'Finance',
      items: [
        { id: 'finance', label: 'Facturation', icon: FileText },
        { id: 'caisse', label: 'Caisse', icon: Banknote },
        { id: 'impayes', label: 'Impayés / Débiteurs', icon: AlertCircle },
        { id: 'cloture', label: 'Clôture & Audit', icon: Lock },
        { id: 'finance_history', label: 'Historique', icon: History },
      ]
    },
    revenue: {
      label: 'Revenue Management',
      items: [
        { id: 'revenue', label: 'Dashboard', icon: TrendingUp },
        { id: 'yield', label: 'Yield Management', icon: Percent },
        { id: 'promotions', label: 'Offres & Promos', icon: PlusCircle },
      ]
    },
    clients: {
      label: 'Clients',
      items: [
        { id: 'clients', label: 'Base Clients', icon: Users },
        { id: 'fiches', label: 'Fiches de Police', icon: FileText },
        { id: 'fidelite', label: 'Fidélité', icon: Sparkles },
      ]
    },
    analysis: {
      label: 'Analyse & Rapports',
      items: [
        { id: 'analysis', label: 'Dashboard KPI', icon: TrendingUp },
        { id: 'performance', label: 'Performance', icon: Percent },
        { id: 'forecast', label: 'Prévisionnel', icon: Cloud },
      ]
    },
    settings: {
      label: 'Configuration',
      items: [
        { id: 'settings', label: 'Paramètres Généraux', icon: Building2 },
        { id: 'annulations', label: 'Politiques Annulation', icon: XCircle },
        { id: 'supplements', label: 'Suppléments & Packs', icon: PlusCircle },
        { id: 'hotel', label: 'Fiche Établissement', icon: Building2 },
        { id: 'taxe', label: 'Taxe de Séjour', icon: Database },
        { id: 'pms', label: 'Connectivité PMS', icon: Cloud },
        { id: 'api', label: 'Intégrations API', icon: Database },
      ]
    },
    general: {
      label: 'Navigation',
      items: [
        { id: 'flowboard', label: 'Flowboard', icon: TrendingUp },
        { id: 'planning', label: 'Planning', icon: Calendar },
        { id: 'today', label: 'Flowday', icon: RefreshCcw },
      ]
    }
  };

  const currentMenu = subMenus[category] || subMenus.general;

  return (
    <aside className="w-64 bg-white border-r border-[#E5E7EB] flex flex-col shrink-0 overflow-y-auto animate-in slide-in-from-left duration-500">
      <div className="p-6">
        <div className="mb-8 px-2 flex items-center justify-between">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{currentMenu.label}</h2>
          <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
        </div>

        <nav className="space-y-1">
          {currentMenu.items.map((item) => {
            const isActive = activePage === item.id || (item.id === 'finance' && activePage === 'finance'); // Simplify active check
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id as PageId)}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-between transition-all duration-300 rounded-2xl group relative overflow-hidden",
                  isActive
                    ? "bg-[#8B5CF6]/[0.08] text-[#8B5CF6]"
                    : "text-gray-500 hover:text-[#8B5CF6] hover:bg-gray-50/80"
                )}
              >
                <div className="flex items-center gap-3.5 z-10">
                  <div className={cn(
                    "p-2 rounded-xl transition-all duration-300",
                    isActive ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20 rotate-3" : "bg-gray-100 group-hover:bg-white text-gray-400 group-hover:text-[#8B5CF6]"
                  )}>
                    <item.icon size={16} />
                  </div>
                  <span className="text-[12px] font-bold tracking-tight text-left">{item.label}</span>
                </div>
                <ChevronRight size={14} className={cn(
                  "opacity-30 transition-all duration-300 transform",
                  isActive ? "opacity-100 translate-x-0" : "-translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                )} />
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6">
        <div className="p-5 bg-gradient-to-br from-[#8B5CF6]/5 to-transparent rounded-3xl border border-[#8B5CF6]/10 relative overflow-hidden">
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <Sparkles size={12} className="text-[#F59E0B]" />
                 </div>
                 <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Flowtym Pro</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                 Optimisez votre revenue management avec nos algorithmes IA.
              </p>
              <button className="w-full mt-4 py-2 bg-[#8B5CF6] rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-[#7C3AED] transition-colors shadow-lg shadow-[#8B5CF6]/20">
                 En savoir plus
              </button>
           </div>
           <div className="absolute top-0 right-0 w-24 h-24 bg-[#8B5CF6]/5 rounded-full -mr-12 -mt-12" />
        </div>
      </div>
    </aside>
  );
};
