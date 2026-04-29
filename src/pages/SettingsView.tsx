import React from 'react';
import { 
  ArrowLeft, 
  Save, 
  Bed, 
  Star, 
  FileText, 
  Link as LinkIcon, 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  Target, 
  Layers, 
  Table as TableIcon, 
  LayoutGrid, 
  AlertCircle,
  FileDown,
  ChevronRight,
  ShieldCheck,
  Building2,
  Clock,
  HelpCircle,
  ChevronDown,
  Lock as LockIcon,
  Eye,
  Zap
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

const CATEGORY_DISTRIBUTION = [
  { name: 'Classique', value: 20, count: 10, color: '#94A3B8' },
  { name: 'Supérieur', value: 30, count: 15, color: '#3B82F6' },
  { name: 'Deluxe', value: 30, count: 15, color: '#FCD34D' },
  { name: 'Présidentielle', value: 20, count: 10, color: '#F472B6' },
];

interface SettingsViewProps {
  activeTab?: string;
}

export const SettingsView = ({ activeTab = 'settings' }: SettingsViewProps) => {
  const [sidebarItem, setSidebarItem] = React.useState('chambres');

  // Synchronize internal state with prop
  React.useEffect(() => {
    if (['annulations', 'supplements', 'fermatures', 'hotel', 'taxe', 'pms', 'api'].includes(activeTab)) {
      setSidebarItem(activeTab as any);
    } else {
      setSidebarItem('chambres');
    }
  }, [activeTab]);

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FD] overflow-hidden">
      {/* Header Bar */}
      <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-6">
          <button className="p-2.5 bg-gray-50 text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 rounded-2xl transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight capitalize">{sidebarItem.replace('_', ' ')}</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              CONFIGURATION • PARC & TARIFS
            </p>
          </div>
        </div>
        <Button className="bg-[#5C4FE5] hover:bg-[#4B3DBB] text-white font-bold gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-[#5C4FE5]/20">
          <Save size={18} /> Sauvegarder
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Typologies', value: '4', sub: 'actives', icon: Bed },
              { label: 'Catégories', value: '5', sub: 'configurées', icon: Star },
              { label: 'Plans tarifaires', value: '8', sub: 'créés', icon: FileText },
              { label: 'Liens tarifaires', value: '12', sub: 'actifs', icon: LinkIcon },
              { label: 'Sync RMS', value: 'Actif', sub: 'Dernière sync : 10:42', icon: RefreshCw, accent: 'text-emerald-500' },
            ].map((kpi, i) => (
              <Card key={i} className={cn(
                "p-6 border-transparent bg-white shadow-sm hover:shadow-md transition-all group cursor-pointer flex items-center justify-between",
                kpi.label === 'Typologies' && "ring-1 ring-[#8B5CF6]/20"
              )}>
                <div className="flex gap-4 items-center">
                  <div className="p-3 bg-gray-50 text-gray-400 rounded-2xl group-hover:scale-110 group-hover:text-[#8B5CF6] group-hover:bg-[#8B5CF6]/5 transition-all">
                    <kpi.icon size={22} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{kpi.label}</h4>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className={cn("text-xl font-bold text-gray-900 leading-none", kpi.accent)}>{kpi.value}</span>
                      <span className="text-[9px] font-bold text-gray-400">{kpi.sub}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Typologies Table */}
            <Card className="border-transparent bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between p-6">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-xl"><Bed size={18} /></div>
                   <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Typologies</h3>
                </div>
                <Button variant="outline" size="sm" className="bg-gray-50 border-gray-100 text-[10px] font-bold gap-2 px-4">
                  <Plus size={14} /> Ajouter
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F9FAFB] border-y border-gray-50">
                    <tr className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Nom</th>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Capacité</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { name: 'Double', code: 'DBL', capacity: '2 pers.' },
                      { name: 'Single', code: 'SGL', capacity: '1 pers.' },
                      { name: 'Twin', code: 'TWN', capacity: '2 pers.' },
                      { name: 'Suite', code: 'STE', capacity: '4 pers.' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors text-[12px]">
                        <td className="px-6 py-4 font-bold text-gray-900">{row.name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-[#8B5CF6]/5 text-[#8B5CF6] font-bold rounded text-[9px]">{row.code}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-medium">{row.capacity}</td>
                        <td className="px-6 py-4">
                           <div className="flex items-center justify-center gap-2">
                             <button className="p-2 text-gray-300 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"><Edit2 size={14} /></button>
                             <button className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Categories & Chart Row */}
            <div className="grid grid-cols-2 gap-8">
               <Card className="border-transparent bg-white shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Star size={18} /></div>
                       <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Catégories</h3>
                    </div>
                    <button className="p-2 bg-gray-50 text-gray-400 hover:text-[#8B5CF6] rounded-lg transition-all">
                       <Plus size={14} />
                    </button>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#F9FAFB] border-y border-gray-50">
                        <tr className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="px-4 py-4">Nom</th>
                          <th className="px-4 py-4">Multipli.</th>
                          <th className="px-4 py-4 text-center">Couleur</th>
                          <th className="px-4 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[
                          { name: 'Classique', mult: '1,0', color: 'bg-gray-200' },
                          { name: 'Supérieur', mult: '1,3', color: 'bg-blue-200' },
                          { name: 'Deluxe', mult: '1,8', color: 'bg-amber-200' },
                          { name: 'Prési.', mult: '2,5', color: 'bg-pink-100' },
                        ].map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors text-[11px]">
                            <td className="px-4 py-4 font-bold text-gray-900">{row.name}</td>
                            <td className="px-4 py-4 text-gray-500 font-medium">{row.mult}</td>
                            <td className="px-4 py-4 flex justify-center">
                               <div className={cn("w-6 h-4 rounded border border-gray-100", row.color)} />
                            </td>
                            <td className="px-4 py-4">
                               <div className="flex items-center justify-center gap-1">
                                 <button className="p-1 text-gray-300 hover:text-gray-900 rounded transition-all"><Edit2 size={12} /></button>
                                 <button className="p-1 text-gray-300 hover:text-red-500 rounded transition-all"><Trash2 size={12} /></button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </Card>

               <Card className="border-transparent bg-white shadow-sm p-6 flex flex-col items-center justify-center text-center">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-6">Distribution des catégories</h3>
                  <div className="h-48 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={CATEGORY_DISTRIBUTION}
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                          >
                             {CATEGORY_DISTRIBUTION.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <span className="text-xl font-bold text-gray-900 leading-none">50</span>
                       <span className="text-[9px] font-bold text-gray-400 uppercase">Chambres</span>
                    </div>
                  </div>
                  <div className="w-full mt-6 space-y-2">
                     {CATEGORY_DISTRIBUTION.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="font-bold text-gray-600">{item.name}</span>
                           </div>
                           <span className="text-gray-400 font-medium">{item.value}% ({item.count})</span>
                        </div>
                     ))}
                  </div>
               </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <Card className="xl:col-span-2 p-6 border-transparent bg-white shadow-sm">
               <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gray-50 text-gray-400 rounded-xl"><Layers size={18} /></div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Génération automatique du parc</h3>
               </div>
               <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="space-y-2">
                     <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">NB CHAMBRES</label>
                     <input type="text" placeholder="50" className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none focus:border-[#8B5CF6]/20 transition-all" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">NB ÉTAGES</label>
                     <input type="text" placeholder="5" className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none focus:border-[#8B5CF6]/20 transition-all" />
                  </div>
                  <div className="space-y-2 col-span-1">
                     <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">FORMAT CHAMBRE</label>
                     <div className="relative">
                        <input type="text" placeholder="Ex: 101, 203, 305" className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none focus:border-[#8B5CF6]/20 transition-all" />
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">1ÈRE CHAMBRE</label>
                     <input type="text" placeholder="01" className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none focus:border-[#8B5CF6]/20 transition-all" />
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <Button className="bg-[#8B5CF6] text-white font-bold gap-2 px-6 rounded-xl">
                     <Zap size={16} /> Générer automatiquement
                  </Button>
                  <Button variant="outline" className="bg-[#10B981]/5 border-transparent text-[#10B981] font-bold gap-2 px-6 rounded-xl hover:bg-[#10B981]/10">
                     <FileDown size={16} /> Import Excel
                  </Button>
               </div>
            </Card>

            <Card className="xl:col-span-1 bg-[#5C4FE5] text-white p-6 rounded-3xl relative overflow-hidden shadow-xl shadow-[#5C4FE5]/30">
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="p-2 bg-white/10 rounded-xl"><LinkIcon size={18} /></div>
                     <h3 className="text-sm font-bold uppercase tracking-widest">Cascade Tarif</h3>
                  </div>
                  <p className="text-[11px] font-medium text-white/70 max-w-[200px] mb-8">Liez un tarif référent à un plan enfant avec variation automatique.</p>
                  
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[9px] font-bold text-white/50 uppercase tracking-widest">TARIF RÉFÉRENT</label>
                           <div className="p-3 bg-white/10 rounded-xl border border-white/10 flex items-center justify-between text-[10px] font-bold">
                              <span>RACK-RO-FLEX</span>
                              <ChevronDown size={12} />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-bold text-white/50 uppercase tracking-widest">TARIF CIBLE</label>
                           <div className="p-3 bg-white/10 rounded-xl border border-white/10 flex items-center justify-between text-[10px] font-bold">
                              <span>OTA-RO-NANR</span>
                              <ChevronDown size={12} />
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <LinkIcon size={120} className="absolute -bottom-10 -right-10 text-white/5 rotate-12" />
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <Card className="xl:col-span-2 border-transparent bg-white shadow-sm">
               <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-gray-50 text-gray-400 rounded-xl"><FileText size={18} /></div>
                     <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Plans tarifaires</h3>
                  </div>
               </CardHeader>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-[#F9FAFB] border-y border-gray-50">
                       <tr className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="px-6 py-4">CODE & NOM</th>
                          <th className="px-6 py-4">PRIX</th>
                          <th className="px-6 py-4">PENSION</th>
                          <th className="px-6 py-4">ANNULATION</th>
                          <th className="px-6 py-4 text-center">ACTIONS</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {[
                         { code: 'RACK-RO-FLEX', name: 'Rack Public Flex', price: '150 €', pension: 'Room Only', cancel: 'Flexible (J-3)' },
                         { code: 'CORP-BB-NONREF', name: 'Corporate B&B', price: '120 €', pension: 'BB', cancel: 'Non remboursable' },
                         { code: 'OTA-RO-FLEX', name: 'OTA Room Only Flex', price: '110 €', pension: 'Room Only', cancel: 'Flexible (J-1)' },
                       ].map((row, i) => (
                         <tr key={i} className="hover:bg-gray-50 transition-colors text-[11px]">
                            <td className="px-6 py-5">
                               <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-bold text-[#8B5CF6] uppercase">{row.code}</span>
                                  <span className="font-bold text-gray-900">{row.name}</span>
                               </div>
                            </td>
                            <td className="px-6 py-5 font-bold text-emerald-500">{row.price}</td>
                            <td className="px-6 py-5 text-gray-500 font-medium">{row.pension}</td>
                            <td className="px-6 py-5 text-gray-400 text-[10px]">{row.cancel}</td>
                            <td className="px-6 py-5">
                               <div className="flex items-center justify-center gap-2">
                                  <button className="p-1.5 text-gray-300 hover:text-gray-900 rounded-lg"><Edit2 size={12} /></button>
                                  <button className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg"><Trash2 size={12} /></button>
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
               </div>
            </Card>

            <Card className="xl:col-span-1 p-6 border-transparent bg-white shadow-sm flex flex-col">
               <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-gray-50 text-gray-400 rounded-xl"><TableIcon size={18} /></div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Aperçu du parc</h3>
               </div>
               
               <div className="grid grid-cols-2 gap-4 flex-1">
                  {[
                    { label: '50', sub: 'Chambres', icon: Bed, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/5' },
                    { label: '5', sub: 'Étages', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: '10', sub: 'Par étage', icon: LayoutGrid, color: 'text-amber-500', bg: 'bg-amber-50' },
                    { label: '100%', sub: 'Configuré', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center gap-4 group hover:bg-white hover:border-[#8B5CF6]/20 transition-all cursor-pointer">
                       <div className={cn("p-2 rounded-xl transition-transform group-hover:scale-110", item.bg, item.color)}>
                          <item.icon size={18} />
                       </div>
                       <div>
                          <p className="text-lg font-bold text-gray-900 leading-none">{item.label}</p>
                          <p className="text-[10px] font-medium text-gray-400 mt-1">{item.sub}</p>
                       </div>
                    </div>
                  ))}
               </div>

               <button className="w-full mt-8 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-gray-500 transition-all tracking-tight">
                  <Eye size={14} className="text-[#8B5CF6]" /> Voir le plan du parc
               </button>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};
