import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, Save, Building2, Users, Share2, 
  ShieldCheck, History, Mail, Laptop, Zap, Bell, 
  CreditCard, Layout, Globe, Search
} from 'lucide-react';
import { useToast, ToastContainer } from './configuration/ConfigUtils';
import { ConfigSections1to7 } from './configuration/ConfigSections1to7';
import { ConfigSections8to21 } from './configuration/ConfigSections8to21';
import { ConfigTemplates } from './configuration/ConfigTemplates';
import { ConfigPeripherals } from './configuration/ConfigPeripherals';
import { useConfigStore } from '@/src/store/configStore';

interface Props {
  onBack?: () => void;
}

export const Configuration: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('hotel');
  const { toasts, toast } = useToast();
  const hotelName = useConfigStore(s => s.hotel.name);

  const configGroups = [
    { 
      id: 'general', 
      label: 'Général', 
      icon: Building2, 
      sub: [
        { id: 'hotel', label: 'Profil Hôtel', icon: Building2 },
        { id: 'users', label: 'Utilisateurs', icon: Users },
        { id: 'templates', label: 'Modèles Emails', icon: Mail },
      ] 
    },
    { 
      id: 'connectivity', 
      label: 'Connectivité', 
      icon: Share2, 
      sub: [
        { id: 'connectivity', label: 'Channel Manager', icon: Globe },
        { id: 'peripherals', label: 'Périphériques', icon: Laptop },
        { id: 'logs', label: 'Audit & Logs', icon: History },
      ] 
    },
  ];

  const handleSave = () => {
    toast('✅ Configuration sauvegardée avec succès', 'success');
  };

  return (
    <div className="flex flex-col bg-slate-50 min-h-screen h-full overflow-hidden">
       {/* Header */}
       <header className="bg-white/80 backdrop-blur-md border-b border-[#E8EDF5] px-8 py-5 flex justify-between items-center sticky top-0 z-[100] shrink-0">
          <div className="flex items-center gap-6">
             <button 
                onClick={onBack}
                className="w-10 h-10 rounded-2xl bg-slate-50 border border-[#E8EDF5] flex items-center justify-center text-slate-400 hover:text-[#8B5CF6] hover:border-[#8B5CF6] transition-all"
             >
                <ChevronLeft size={20} />
             </button>
             <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Paramètres du Système</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{hotelName} — Version 2.0.4</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative hidden md:block">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                   placeholder="Rechercher un réglage..." 
                   className="bg-slate-50 border border-[#E8EDF5] rounded-2xl px-12 py-3 text-sm font-bold outline-none focus:border-[#8B5CF6] transition-all w-64"
                />
             </div>
             <button 
                onClick={handleSave}
                className="px-8 py-3 bg-[#8B5CF6] text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl shadow-[#8B5CF6]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
             >
                <Save size={18} /> Sauvegarder
             </button>
          </div>
       </header>

       <div className="flex flex-1 overflow-hidden">
          {/* Navigation latérale */}
          <aside className="w-72 bg-white border-r border-[#E8EDF5] overflow-y-auto p-6 shrink-0">
             {configGroups.map(group => (
               <div key={group.id} className="mb-8">
                  <div className="flex items-center gap-2 px-4 mb-4">
                     <group.icon size={14} className="text-slate-300" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.label}</span>
                  </div>
                  <div className="space-y-1">
                     {group.sub.map(item => (
                       <button
                         key={item.id}
                         onClick={() => setActiveTab(item.id)}
                         className={`
                           w-full px-4 py-3.5 rounded-2xl flex items-center gap-3 transition-all group
                           ${activeTab === item.id ? 'bg-[#F5F3FF] text-[#8B5CF6] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}
                         `}
                       >
                          <item.icon size={18} className={activeTab === item.id ? 'text-[#8B5CF6]' : 'text-slate-300 group-hover:text-slate-400'} />
                          <span className="text-[13px] font-bold tracking-tight">{item.label}</span>
                          {activeTab === item.id && (
                             <motion.div layoutId="tab-indicator" className="w-1 h-4 bg-[#8B5CF6] rounded-full ml-auto" />
                          )}
                       </button>
                     ))}
                  </div>
               </div>
             ))}
          </aside>

          {/* Zone de contenu principale */}
          <main className="flex-1 overflow-y-auto p-10 bg-[#F9FAFB]">
             <div className="max-w-4xl mx-auto">
                <AnimatePresence mode="wait">
                   <motion.div
                     key={activeTab}
                     initial={{ opacity: 0, y: 15 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -15 }}
                     transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                   >
                      <ConfigSections1to7 activeTab={activeTab} />
                      <ConfigSections8to21 activeTab={activeTab} />
                      {activeTab === 'templates' && <ConfigTemplates toast={toast} />}
                      {activeTab === 'peripherals' && <ConfigPeripherals toast={toast} />}
                   </motion.div>
                </AnimatePresence>
             </div>
          </main>
       </div>

       <ToastContainer toasts={toasts} />
    </div>
  );
};
