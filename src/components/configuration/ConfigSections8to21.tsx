import React from 'react';
import { 
  Zap, Bell, Globe, Database, History, 
  Settings2, Share2, ShieldAlert
} from 'lucide-react';
import { ConfigCard, ConfigInput } from './ConfigUtils';

export const ConfigSections8to21: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  if (activeTab === 'connectivity') {
    return (
      <div className="space-y-6">
        <ConfigCard title="Channel Manager" subtitle="Synchronisation OTA (Booking, Airbnb...)" icon={<Share2 />}>
          <div className="grid grid-cols-12 gap-5">
             {['Booking.com', 'Airbnb', 'Expedia', 'Hôtel.com'].map(ota => (
               <div key={ota} className="col-span-12 md:col-span-6 bg-[#F9FAFB] p-4 rounded-2xl border border-[#E8EDF5] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E8EDF5] flex items-center justify-center text-[10px] font-black uppercase">
                       {ota.substring(0, 3)}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{ota}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-emerald-500" />
                     <span className="text-[9px] font-black text-emerald-600 uppercase">Actif</span>
                  </div>
               </div>
             ))}
          </div>
        </ConfigCard>
        
        <ConfigCard title="Webhooks & API" subtitle="Intégrations tierces" icon={<Zap />}>
           <div className="space-y-4">
              <ConfigInput label="API Key (v2)" icon={Settings2} value="**********" readOnly />
              <button className="text-[10px] font-black text-[#8B5CF6] uppercase tracking-widest flex items-center gap-2">
                 <Zap size={12} /> Régénérer la clé
              </button>
           </div>
        </ConfigCard>
      </div>
    );
  }

  if (activeTab === 'logs') {
    return (
      <ConfigCard title="Journal d'audit" subtitle="Historique des modifications" icon={<History />}>
         <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                 <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                    <Database size={14} />
                 </div>
                 <div className="flex-1">
                    <p className="text-[12px] font-bold text-gray-900">Mise à jour des tarifs - Rack Rate</p>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-0.5">Aujourd'hui à 14:32 · Wali LARABI</p>
                 </div>
              </div>
            ))}
         </div>
      </ConfigCard>
    );
  }

  return null;
};
