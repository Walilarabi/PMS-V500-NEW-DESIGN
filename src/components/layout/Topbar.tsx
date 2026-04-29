import React from 'react';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  MapPin,
  Circle,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Activity,
  Wallet,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { PageId } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface TopbarProps {
  activePage: PageId;
  setActivePage: (id: PageId) => void;
}

export const Topbar = ({ activePage, setActivePage }: TopbarProps) => {
  const mainNavItems = [
    { id: 'flowboard', label: 'Flowboard', icon: LayoutDashboard },
    { id: 'planning', label: 'Planning', icon: Calendar },
    { id: 'today', label: 'Flowday', icon: Clock },
    { id: 'reservations', label: 'Réservations', icon: BookOpen },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'finance', label: 'Finance', icon: Wallet },
    { id: 'analysis', label: 'Analyse', icon: Activity },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  const isSettingsActive = activePage === 'settings' || ['annulations', 'supplements', 'fermatures', 'hotel', 'taxe', 'pms', 'api'].includes(activePage);
  const isFinanceActive = activePage === 'finance' || ['facturation', 'caisse', 'impayes', 'cloture'].includes(activePage);
  const isReservationsActive = activePage === 'reservations' || ['mouvements', 'qr', 'simulation', 'groupes', 'paiements', 'relances', 'anomalies'].includes(activePage);

  return (
    <header className="flex flex-col bg-white border-b border-[#E5E7EB] shrink-0 z-[60]">
      <div className="h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 mr-4">
            <div className="p-1.5 bg-[#8B5CF6] rounded-lg text-white">
              <LayoutDashboard size={16} />
            </div>
            <span className="font-bold text-gray-900 text-sm">Flowtym</span>
          </div>

          <nav className="flex items-center gap-1">
            {mainNavItems.map((item) => {
              let isActive = activePage === item.id;
              if (item.id === 'settings') isActive = isSettingsActive;
              if (item.id === 'finance') isActive = isFinanceActive;
              if (item.id === 'reservations') isActive = isReservationsActive;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id as PageId)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2",
                    isActive 
                      ? "bg-[#5C4FE5] text-white shadow-md shadow-[#5C4FE5]/20" 
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <item.icon size={14} className={cn(isActive ? "text-white" : "text-gray-400")} />
                  {item.label}
                  {['reservations', 'revenue', 'finance'].includes(item.id) && <ChevronDown size={12} className="opacity-50" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
             <MapPin size={14} className="text-gray-400" />
             <span className="text-[11px] font-bold text-gray-900 select-none">Aix-en-Provence</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#ECFDF5] text-emerald-600 rounded-full border border-emerald-100">
             <Circle size={8} fill="currentColor" />
             <span className="text-[11px] font-bold uppercase tracking-wider">Sync PMS OK</span>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <div className="text-right hidden sm:block">
              <div className="text-[12px] font-bold text-gray-900 leading-none">Ali Larabi</div>
              <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Admin</div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center font-bold text-[10px] shadow-lg shadow-[#8B5CF6]/10">
               AL
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
