import React from 'react';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  Menu, 
  ChevronRight,
  HelpCircle,
  Calendar,
  CreditCard,
  Users,
  TrendingUp,
  BarChart2,
  Zap,
  RefreshCcw,
  LayoutGrid,
  Settings
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { PageId } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { LogOut } from 'lucide-react';

interface TopbarProps {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
}

import { useConfigStore } from '@/src/store/configStore';

export const Topbar = ({ activePage, setActivePage }: TopbarProps) => {
  const hotel = useConfigStore(s => s.hotel);
  const user = useConfigStore(s => s.users[0]); // Mock getting first user
  const { session, logout } = useAuth();
  const getCategory = (page: PageId): string => {
    if (['today', 'flowboard', 'planning'].includes(page)) return 'today';
    if (['reservations', 'calendrier', 'mouvements', 'qr', 'simulation', 'groupes', 'paiements', 'relances', 'anomalies'].includes(page)) return 'reservations';
    if (['revenue', 'yield', 'promotions'].includes(page)) return 'revenue';
    if (['finance', 'facturation', 'caisse', 'impayes', 'cloture', 'proprietaires'].includes(page)) return 'finance';
    if (['analysis', 'performance', 'forecast'].includes(page)) return 'analysis';
    if (['clients', 'fiches', 'fidelite'].includes(page)) return 'clients';
    if (['settings', 'annulations', 'supplements', 'hotel', 'taxe', 'pms', 'api'].includes(page)) return 'settings';
    return 'today';
  };

  const activeCategory = getCategory(activePage);

  const mainNavItems = [
    { id: 'today', label: 'Flowday', icon: Zap },
    { id: 'reservations', label: 'Reservation', icon: Calendar },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: TrendingUp },
    { id: 'finance', label: 'Finance', icon: CreditCard },
    { id: 'analysis', label: 'Analyse', icon: BarChart2 },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-[#E5E7EB] shrink-0 z-40 relative">
      <div className="flex items-center gap-8">
        <div 
          onClick={() => setActivePage('today')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#8B5CF6]/20 group-hover:scale-105 transition-transform">
             <span className="text-xl font-black italic tracking-tighter">F</span>
          </div>
          <div className="hidden sm:block">
             <h1 className="text-gray-900 font-black text-base leading-none tracking-tight">{hotel.name}</h1>
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{hotel.city || 'Edition Pro'}</p>
          </div>
        </div>
        
        <div className="w-px h-6 bg-gray-100 hidden xl:block" />
        
        {/* Main Navigation */}
        <nav className="hidden xl:flex items-center gap-1 bg-gray-50/50 p-1 rounded-2xl border border-gray-100">
          {mainNavItems.map((item) => {
            const isActive = activeCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id as PageId)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300",
                  isActive 
                    ? "bg-white text-[#8B5CF6] shadow-sm shadow-[#8B5CF6]/10 ring-1 ring-gray-100" 
                    : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
                )}
              >
                <item.icon size={14} className={isActive ? "text-[#8B5CF6]" : "text-gray-400"} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-[#8B5CF6]/30 transition-all">
           <Search size={14} className="text-gray-400" />
           <input 
              type="text" 
              placeholder="Rechercher..." 
              className="bg-transparent border-none outline-none text-[11px] font-bold text-gray-900 w-40 placeholder:text-gray-300"
           />
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
           <div className="flex items-center gap-1 pr-4 border-r border-gray-100 hidden sm:flex">
              <button className="p-2 text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-xl transition-all relative">
                 <Bell size={18} />
                 <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white" />
              </button>
              <button className="p-2 text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-xl transition-all">
                 <LayoutGrid size={18} />
              </button>
           </div>
           
           <div className="flex items-center gap-3 pl-2 group cursor-pointer" data-testid="topbar-user">
              <div className="w-9 h-9 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-all p-0.5 bg-gradient-to-br from-[#8B5CF6] to-[#C084FC]">
                 <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[10px] font-black text-[#8B5CF6]">
                    {(session?.fullName ?? user.name).split(' ').map(n => n[0]).join('').slice(0, 2)}
                 </div>
              </div>
              <div className="hidden lg:block">
                <ChevronDown size={14} className="text-gray-400" />
              </div>
           </div>

           <button
              type="button"
              onClick={() => { void logout(); }}
              data-testid="logout-button"
              title="Se déconnecter"
              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
           >
              <LogOut size={18} />
           </button>

           <button className="xl:hidden p-2 text-gray-400">
              <Menu size={20} />
           </button>
        </div>
      </div>
    </header>
  );
};
