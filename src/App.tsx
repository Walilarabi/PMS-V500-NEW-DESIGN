import React from 'react';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { Topbar } from '@/src/components/layout/Topbar';
import { TodayView } from '@/src/pages/TodayView';
import { PlanningView } from '@/src/pages/PlanningView';
import { ReservationsView } from '@/src/pages/ReservationsView';
import { ClientsView } from '@/src/pages/ClientsView';
import { RevenueView } from '@/src/pages/RevenueView';
import { FinanceView } from '@/src/pages/FinanceView';
import { AnalysisView } from '@/src/pages/AnalysisView';
import { FlowboardView } from '@/src/pages/FlowboardView';
import { SettingsView } from '@/src/pages/SettingsView';
import { PageId } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';

const PlaceholderPage = ({ name }: { name: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
       <span className="text-4xl">🏗️</span>
    </div>
    <h1 className="text-2xl font-bold text-gray-900 mb-2">{name}</h1>
    <p className="text-gray-500 max-w-md">Cette page est actuellement en cours de modernisation. Elle conservera toutes ses fonctionnalités existantes avec un design rafraîchi.</p>
  </div>
);

const App = () => {
  const [activePage, setActivePage] = React.useState<PageId>('today');

  const renderPage = () => {
    switch (activePage) {
      case 'today': return <TodayView />;
      case 'flowboard': return <FlowboardView />;
      case 'planning': return <PlanningView />;
      case 'reservations': 
      case 'calendrier':
      case 'mouvements':
      case 'qr':
      case 'simulation':
      case 'groupes':
      case 'paiements':
      case 'relances':
      case 'anomalies':
        return <ReservationsView />;
      case 'clients': 
      case 'fiches':
      case 'fidelite':
        return <ClientsView />;
      case 'revenue': 
      case 'yield':
      case 'promotions':
        return <RevenueView />;
      case 'analysis': 
      case 'performance':
      case 'forecast':
        return <AnalysisView />;
      case 'finance': 
      case 'facturation':
      case 'caisse':
      case 'impayes':
      case 'cloture':
      case 'proprietaires':
        return <FinanceView activeTab={activePage} />;
      case 'operations': return <PlaceholderPage name="Opérations" />;
      case 'settings': 
      case 'annulations':
      case 'supplements':
      case 'fermatures':
      case 'hotel':
      case 'taxe':
      case 'pms':
      case 'api':
        return <SettingsView activeTab={activePage} />;
      default: return <TodayView />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-gray-900 font-sans overflow-hidden">
      {/* Global Contextual Sidebar */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Topbar activePage={activePage} setActivePage={setActivePage} />
        
        <main className="flex-1 overflow-hidden relative">
           <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="h-full w-full overflow-hidden flex flex-col"
              >
                 {renderPage()}
              </motion.div>
           </AnimatePresence>
        </main>

        {/* Global Footer / Quick Access */}
        <footer className="h-10 bg-white border-t border-[#E5E7EB] flex items-center justify-between px-6 shrink-0 z-50">
           <div className="flex items-center gap-4">
              <button 
                 onClick={() => setActivePage('planning')}
                 className="flex items-center gap-2 text-[10px] font-bold text-gray-500 hover:text-[#8B5CF6] transition-colors uppercase tracking-widest"
              >
                 <span className="p-1 bg-gray-100 rounded">📅</span> Planning
              </button>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-bold text-gray-400">SYSTÈME OK</span>
              </div>
              <div className="text-[9px] font-bold text-gray-400 tracking-tighter">
                 F1 Aide • Ecc Quitter • Fermer
              </div>
           </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
