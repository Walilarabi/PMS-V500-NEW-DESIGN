import React from 'react';
import { Printer, Scan, Monitor, Wifi, Settings } from 'lucide-react';
import { ConfigCard } from './ConfigUtils';

export const ConfigPeripherals: React.FC<{ toast: any }> = ({ toast }) => {
  const handleTest = (device: string) => {
    toast(`Test de connexion réussi : ${device}`, 'success');
  };

  return (
    <div className="space-y-6">
      <ConfigCard title="Imprimantes & Facturation" subtitle="Configuration des sorties physiques" icon={<Printer />}>
        <div className="grid grid-cols-12 gap-5">
           {[
             { name: 'Imprimante Réception', status: 'En ligne', icon: Printer, type: 'Ethernet' },
             { name: 'Facturation Auto', status: 'Prêt', icon: Monitor, type: 'Cloud' },
             { name: 'Backup Office', status: 'Hors-ligne', icon: Printer, type: 'USB' }
           ].map((dev, i) => (
             <div key={i} className="col-span-12 md:col-span-4 bg-[#F9FAFB] p-5 rounded-3xl border border-[#E8EDF5] space-y-4">
                <div className="flex items-center justify-between">
                   <div className={`p-2 rounded-xl ${dev.status === 'En ligne' || dev.status === 'Prêt' ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-400'}`}>
                      <dev.icon size={20} />
                   </div>
                   <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${dev.status === 'En ligne' || dev.status === 'Prêt' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">{dev.status}</span>
                   </div>
                </div>
                <div>
                   <p className="text-sm font-bold text-gray-900">{dev.name}</p>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{dev.type}</p>
                </div>
                <button 
                  onClick={() => handleTest(dev.name)}
                  className="w-full py-2.5 bg-white border border-[#E8EDF5] rounded-xl text-[10px] font-black uppercase text-[#8B5CF6] hover:bg-violet-50 transition-all"
                >
                   Tester la connexion
                </button>
             </div>
           ))}
        </div>
      </ConfigCard>

      <ConfigCard title="Scanners de passeports" subtitle="Intégration Web MediaDevices" icon={<Scan />}>
         <div className="bg-slate-900 aspect-video rounded-[32px] overflow-hidden relative group cursor-pointer">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 group-hover:text-white transition-colors">
               <Scan size={48} className="mb-4" />
               <p className="text-sm font-black uppercase tracking-widest">Activer la caméra pour calibrer</p>
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
               <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <Wifi size={12} className="text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-tight text-white">Prêt pour lecture MRZ</span>
               </div>
               <button className="p-3 bg-[#8B5CF6] text-white rounded-2xl shadow-xl">
                  <Settings size={20} />
               </button>
            </div>
         </div>
      </ConfigCard>
    </div>
  );
};
