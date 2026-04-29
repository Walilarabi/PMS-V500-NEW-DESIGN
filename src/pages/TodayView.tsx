import React from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MousePointer2,
  Calendar,
  Building2,
  FileText,
  Mail,
  Zap as SparkleIcon,
  Crown,
  Heart,
  Users as UsersIcon,
  MessageSquare,
  Repeat,
  Download,
  Upload,
  CreditCard,
  History,
  Lock,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';

export const TodayView = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('Toutes');
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const calculateNowPosition = () => {
    const startHour = 7;
    const endHour = 21;
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    
    if (currentHour < startHour) return '0%';
    if (currentHour >= endHour) return '100%';
    
    const totalMinutes = (endHour - startHour) * 60;
    const elapsedMinutes = (currentHour - startHour) * 60 + currentMinutes;
    return `${(elapsedMinutes / totalMinutes) * 100}%`;
  };

  const priorities = [
    { label: '3 Chambres non prêtes', meta: 'Perte estimée 420 €', color: 'danger', val: '420 €' },
    { label: '2 Arrivées dans < 1h', meta: 'Non assignées', color: 'warning', val: '—' },
    { label: '1 Ménage en retard', meta: 'Retard estimé 35 min', color: 'warning', val: '35 min' },
    { label: '4 Check-outs terminés', meta: 'Prêts à la vente', color: 'success', val: '—' },
  ];

  const items = [
    { 
      priority: 'Critique', 
      room: '101', 
      type: 'SGL/CLA', 
      status: 'Libre', 
      statusColor: 'emerald',
      vip: true,
      liked: true,
      client: 'Arathew Smith', 
      guests: 2,
      arrival: '2026-04-15', 
      departure: '2026-04-19', 
      payment: 'Payé',
      source: 'Booking.com',
      sourceInitial: 'B',
      sourceColor: 'indigo',
    },
    { 
      priority: 'Critique', 
      room: '103', 
      type: 'STE/DLX', 
      status: 'Propre', 
      statusColor: 'emerald',
      vip: true,
      client: 'Sophie Dubois', 
      guests: 2,
      arrival: '2026-04-07', 
      departure: '2026-04-10', 
      payment: 'En attente',
      source: 'Airbnb',
      sourceInitial: 'A',
      sourceColor: 'rose',
      action: 'Validé'
    },
    { 
      priority: 'Élevée', 
      room: '102', 
      type: 'DBL/CLA', 
      status: 'Occupée', 
      statusColor: 'indigo',
      vip: true,
      flag: true,
      client: 'Claire Martin', 
      guests: 2,
      arrival: '2026-04-07', 
      departure: '2026-04-09', 
      payment: 'Partiel',
      source: 'Direct',
      sourceInitial: 'D',
      sourceColor: 'emerald',
      clientAvatar: 'NB',
      clientAvatarName: 'Nathalie B.'
    },
    { 
      priority: 'Moyenne', 
      room: '201', 
      type: 'STE/ROY', 
      status: 'Occupée', 
      statusColor: 'indigo',
      client: 'Ali Larabi', 
      guests: 2,
      arrival: '2026-04-06', 
      departure: '2026-04-12', 
    },
  ];

  const hours = Array.from({ length: 15 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.client.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.room.includes(searchQuery);
    if (activeFilter === 'Toutes') return matchesSearch;
    return matchesSearch;
  });

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#F9FAFB] font-sans">
      <header className="px-8 py-6 flex items-center justify-between bg-white/50 backdrop-blur-md border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Flowday</h1>
            <div className="flex items-center gap-2 text-gray-400 mt-1">
              <Calendar size={14} />
              <span className="text-[11px] font-bold tracking-wide">Dimanche 27 Avril 2026</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl bg-white gap-2 text-[11px] font-bold h-9 px-4 border-gray-200">
            <RefreshCw size={14} className="text-[#8B5CF6]" /> Actualiser
          </Button>
        </div>
        <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] shadow-lg shadow-[#8B5CF6]/20 rounded-xl gap-2 text-[11px] font-black h-10 px-6">
          <SparkleIcon size={14} /> Optimiser la journée
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-[1700px] mx-auto grid grid-cols-12 gap-8">
          
          <div className="col-span-10 space-y-8">
            <div>
              <h2 className="text-[10px] font-black text-gray-400 tracking-wider mb-4">Priorités du jour</h2>
              <div className="grid grid-cols-4 gap-4">
                {priorities.map((p, i) => (
                  <Card key={i} className="p-4 rounded-3xl border-gray-100 shadow-sm relative overflow-hidden group hover:border-[#8B5CF6]/30 transition-all duration-300">
                     <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                          p.color === 'danger' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" :
                          p.color === 'warning' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" :
                          "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        )}>
                          {p.color === 'danger' ? <AlertCircle size={20} /> : p.color === 'warning' ? <Clock size={20} /> : <CheckCircle2 size={20} />}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[13px] font-bold text-gray-900 leading-tight">{p.label}</h3>
                          <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">{p.meta}</p>
                        </div>
                     </div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-[10px] font-black text-gray-400 tracking-wider mb-4">Timeline du jour</h2>
              <Card className="rounded-[32px] border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="relative">
                  <div className="flex border-b border-gray-50">
                    <div className="w-40 border-r border-gray-50 bg-gray-50/50" />
                    <div className="flex-1 flex overflow-x-auto scrollbar-hide py-3">
                      {hours.map((h) => (
                        <div key={h} className="min-w-[80px] flex-1 text-center">
                          <span className="text-[10px] font-bold text-gray-400">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                     <div className="absolute top-0 bottom-0 w-px bg-[#8B5CF6] z-10" style={{ left: `calc(10rem + (100% - 10rem) * ${calculateNowPosition().split('%')[0]} / 100)` }}>
                        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#8B5CF6] text-white text-[8px] font-black rounded shadow-sm">Maintenant</div>
                     </div>
                     <div className="flex h-12 border-b border-gray-50 group hover:bg-gray-50/50 transition-colors">
                        <div className="w-40 border-r border-gray-50 flex items-center gap-3 px-6 shrink-0">
                           <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><Download size={12} className="rotate-180" /></div>
                           <span className="text-[11px] font-bold text-gray-900">Arrivées</span>
                        </div>
                        <div className="flex-1 flex px-10 relative items-center">
                           <div className="absolute left-[20%] w-6 h-6 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center text-[10px] font-black text-emerald-500 shadow-sm">2</div>
                        </div>
                     </div>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-4">
                    <h2 className="text-[10px] font-black text-gray-400 tracking-wider">Chambres & actions priorisées</h2>
                 </div>
              </div>
              <Card className="rounded-[32px] overflow-hidden border-gray-100 shadow-sm bg-white">
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-[#8B5CF6] text-white">
                                <th className="px-4 py-3 text-[10px] font-black tracking-wider text-center w-16">Room</th>
                                <th className="px-4 py-3 text-[10px] font-black tracking-wider">Client</th>
                                <th className="px-4 py-3 text-[10px] font-black tracking-wider">Status</th>
                                <th className="px-4 py-3 text-[10px] font-black tracking-wider">Arrivée</th>
                                <th className="px-4 py-3 text-[10px] font-black tracking-wider">Départ</th>
                                <th className="px-4 py-3 text-[10px] font-black tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredItems.map((item, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors h-14">
                                    <td className="px-4 py-2 text-center">
                                        <span className="text-[13px] font-black text-gray-900">{item.room}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="text-[12px] font-black text-gray-900">{item.client}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                                            item.statusColor === 'emerald' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-indigo-50 border-indigo-100 text-indigo-600"
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full", item.statusColor === 'emerald' ? "bg-emerald-500" : "bg-indigo-500")} />
                                            <span className="text-[10px] font-bold">{item.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="text-[10px] font-bold text-gray-500">{item.arrival}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="text-[10px] font-bold text-gray-500">{item.departure}</span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold">Détails</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </Card>
            </div>
          </div>

          <div className="col-span-2 space-y-8">
            <Card className="p-5 bg-white rounded-[32px] border-gray-100 shadow-sm relative overflow-hidden">
               <h3 className="text-[10px] font-black text-gray-400 tracking-wider mb-6">Flow Score</h3>
               <div className="flex flex-col items-center gap-4">
                  <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                     <span className="text-xl font-black text-gray-900">78</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-[13px] font-black text-gray-900 leading-tight">Journée fluide</h4>
                  </div>
               </div>
            </Card>

            <Card className="p-5 bg-white rounded-[32px] border-gray-100 shadow-sm">
               <h3 className="text-[10px] font-black text-gray-400 tracking-wider mb-6">Performance</h3>
               <div className="space-y-4">
                  {[
                    { label: 'Occupation', val: '75.4%' },
                    { label: 'ADR', val: '189 €' },
                    { label: 'RevPAR', val: '142 €' }
                  ].map((p, i) => (
                    <div key={i} className="flex flex-col gap-1">
                       <span className="text-[10px] font-bold text-gray-400 uppercase">{p.label}</span>
                       <span className="text-sm font-black text-gray-900">{p.val}</span>
                    </div>
                  ))}
               </div>
            </Card>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 tracking-wider px-2">Actions Rapides</h3>
              <div className="space-y-2">
                {[
                  { label: 'Nouvelle résa', icon: Plus },
                  { label: 'Walk-in', icon: MousePointer2 },
                  { label: 'Note interne', icon: FileText },
                ].map((act, i) => (
                  <button key={i} className="w-full p-3 bg-white hover:bg-gray-50 rounded-2xl border border-gray-50 flex items-center gap-3 transition-all">
                     <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                        <act.icon size={14} />
                     </div>
                     <span className="text-[11px] font-bold text-gray-900">{act.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
