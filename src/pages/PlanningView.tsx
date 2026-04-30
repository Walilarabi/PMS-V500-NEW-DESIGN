import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Filter,
  Search,
  LayoutGrid,
  Zap,
  MoreVertical,
  AlertCircle,
  ArrowUpRight,
  Download,
  Bed,
  Target,
  Wallet,
  CheckCircle2,
  Clock,
  Plus,
  Sparkles,
  MousePointer2,
  Lock,
  DoorOpen,
  PieChart as PieIcon,
  Table as TableIcon,
  User,
  ChevronDown,
  Users,
  Grid3X3,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useReservations } from '@/src/contexts/ReservationContext';
import { NewReservationModal } from '@/src/components/modals/NewReservationModal';

export const PlanningView = () => {
  const { reservations } = useReservations();
  const [activeView, setActiveView] = React.useState<'semaine' | 'mois'>('mois');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [showKPIs, setShowKPIs] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(25);

  const stats = [
    { label: 'REVENU PRÉVU', val: '24 850 €', trend: '+ 8.3%', color: 'indigo', type: 'chart' },
    { label: 'TAUX D\'OCCUPATION', val: '78%', trend: '+ 4.2%', color: 'purple', type: 'progress', progress: 78 },
    { label: 'ADR', val: '142 €', trend: '+ 2.1%', color: 'emerald', type: 'progress', progress: 85 },
    { label: 'CHAMBRES OCCUPÉES', val: '32 / 48', trend: '+ 6', color: 'blue', type: 'progress', progress: 66 },
    { label: 'ARRIVÉES', val: '8', sub: 'Aujourd\'hui', trend: '21', subLabel: 'dans les 3 prochains jours', color: 'rose' },
    { label: 'DÉPARTS', val: '14', sub: 'Aujourd\'hui', trend: '18', subLabel: 'dans les 3 prochains jours', color: 'rose' },
    { label: 'CHAMBRES À NETTOYER', val: '6', sub: 'Aujourd\'hui', trend: '1', subLabel: 'en retard', color: 'blue' },
  ];

  const channels = [
    { name: 'Direct', val: 14, color: '#A5B4FC' }, // Pastel Indigo
    { name: 'Booking.com', val: 10, color: '#93C5FD' }, // Pastel Blue
    { name: 'Expedia', val: 6, color: '#FDBA74' }, // Pastel Orange
    { name: 'Airbnb', val: 4, color: '#FDA4AF' }, // Pastel Rose
    { name: 'Autres', val: 2, color: '#CBD5E1' }, // Pastel Gray
  ];

  const days = Array.from({ length: 30 }, (_, i) => {
    const dayDate = i + 27;
    const date = new Date(2026, 3, dayDate);
    return {
      date: date.getDate(),
      day: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      occ: 60 + Math.floor(Math.random() * 30),
      count: 30 + Math.floor(Math.random() * 15)
    };
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FD] overflow-hidden p-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Planning</h1>
            <p className="text-gray-500 text-sm font-medium mt-1">Vision d'ensemble de vos disponibilités</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-gray-100 rounded-xl px-5 py-2.5 shadow-sm gap-4">
              <CalendarIcon size={18} className="text-[#8B5CF6]/60" />
              <span className="text-[13px] font-bold text-gray-900 border-r border-gray-100 pr-4">27 avr. — 26 mai 2026</span>
              <button className="flex items-center gap-2 px-3 py-1 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-lg transition-all hover:bg-[#8B5CF6]/10">
                <PieIcon size={12} fill="currentColor" className="opacity-80" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Aujourd'hui</span>
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 ml-2">
              <button className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl shadow-sm text-gray-400 hover:text-[#8B5CF6] transition-all"><ChevronLeft size={20} /></button>
              <button className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl shadow-sm text-gray-400 hover:text-[#8B5CF6] transition-all"><ChevronRight size={20} /></button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
             onClick={() => setShowKPIs(!showKPIs)}
             className="flex items-center gap-2 px-4 h-11 bg-white border border-gray-100 rounded-xl text-[11px] font-bold text-gray-500 hover:text-[#8B5CF6] transition-all shadow-sm"
          >
             {showKPIs ? <><EyeOff size={14} /> Masquer les KPI</> : <><Eye size={14} /> Afficher les KPI</>}
          </button>
          <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl h-11 px-6 font-bold text-[13px] shadow-lg shadow-[#8B5CF6]/20 transition-all gap-3 active:scale-95">
            <Zap size={16} fill="currentColor" strokeWidth={0} /> Optimiser le planning
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showKPIs && (
          <motion.div 
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-9 grid grid-cols-7 gap-4">
                {stats.map((s, i) => (
                  <Card key={i} className="p-5 border-transparent bg-white shadow-sm flex flex-col justify-between h-[150px] relative overflow-hidden group hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 leading-none mb-1">{s.val}</div>
                      {s.sub && <p className="text-[10px] font-bold text-gray-500">{s.sub}</p>}
                    </div>

                    <div className="mt-auto">
                       <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold text-gray-300">vs N-1</p>
                          {s.trend.includes('+') && <span className="text-emerald-500 font-bold text-[11px]">{s.trend}</span>}
                       </div>
                       
                       {s.type === 'chart' && (
                          <div className="h-6 w-full flex items-end gap-0.5">
                             {[0.3, 0.5, 0.4, 0.7, 0.6, 0.8, 0.5, 0.9, 0.7, 1].map((h, k) => (
                                <div key={k} className="flex-1 rounded-t-sm bg-indigo-50 group-hover:bg-indigo-100 transition-colors" style={{ height: `${h * 100}%` }} />
                             ))}
                          </div>
                       )}
                       {s.type === 'progress' && (
                          <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                             <div 
                               className={cn("h-full rounded-full transition-all duration-1000", 
                                 s.color === 'purple' ? "bg-purple-400/60" : s.color === 'emerald' ? "bg-emerald-400/60" : "bg-blue-400/60"
                               )} 
                               style={{ width: `${s.progress}%` }} 
                             />
                          </div>
                       )}
                       {!s.type && s.color === 'rose' && (
                          <div className="text-xl font-bold text-gray-900 mt-1 leading-none">{s.trend}</div>
                       )}
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="col-span-3 p-5 border-transparent bg-white shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                 <div className="flex-1 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">CANAUX DE RÉSA</p>
                    {channels.map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                         <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                         <span className="text-[10px] font-bold text-gray-500 w-24 truncate">{c.name}</span>
                         <div className="flex-1 h-1 bg-gray-50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(c.val/14)*100}%`, backgroundColor: c.color }} />
                         </div>
                         <span className="text-[11px] font-bold text-gray-900 ml-2">{c.val}</span>
                      </div>
                    ))}
                 </div>
                 
                 <div className="relative w-24 h-24 flex items-center justify-center shrink-0 ml-4">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="42" stroke="#F9FAFB" strokeWidth="6" fill="none" />
                      <circle cx="48" cy="48" r="42" stroke="#8B5CF6" strokeWidth="6" strokeDasharray="264" strokeDashoffset="66" fill="none" strokeLinecap="round" className="opacity-40" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <span className="text-2xl font-bold text-gray-900">36</span>
                       <span className="text-[9px] font-bold text-gray-400 uppercase">Total</span>
                    </div>
                 </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex p-1 bg-white border border-gray-100 rounded-xl gap-1 shadow-sm">
             {['Semaine', 'Mois'].map(t => (
                <button 
                  key={t}
                  onClick={() => setActiveView(t.toLowerCase() as any)}
                  className={cn(
                    "px-6 py-2 rounded-lg text-xs font-bold transition-all",
                    activeView === t.toLowerCase() ? "bg-[#8B5CF6]/5 text-[#8B5CF6] shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {t}
                </button>
             ))}
          </div>
          
          <div className="flex items-center bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
             <button className="p-2 text-[#8B5CF6] bg-[#8B5CF6]/5 rounded-lg"><LayoutGrid size={16} /></button>
             <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><CalendarIcon size={16} /></button>
          </div>

          <div className="flex items-center bg-white border border-gray-100 rounded-xl px-5 h-11 gap-4 shadow-sm cursor-pointer group hover:border-[#8B5CF6]/30 transition-all">
             <CalendarIcon size={16} className="text-[#8B5CF6]/60" />
             <span className="text-xs font-bold text-gray-900 uppercase">27 avr. — 26 mai 2026</span>
             <ChevronDown size={14} className="text-gray-400 group-hover:text-[#8B5CF6]" />
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2">
              <Button variant="outline" className="h-11 rounded-xl bg-white border-gray-100 px-5 gap-2 text-xs font-bold text-gray-600 shadow-sm hover:border-[#8B5CF6]/30">
                 <Filter size={16} className="text-[#8B5CF6]/60" /> Filtres
              </Button>
           </div>

           <div className="w-px h-6 bg-gray-200 mx-2" />

           <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input 
                className="h-11 bg-white border border-gray-100 rounded-xl pl-11 pr-5 text-xs font-medium w-64 outline-none shadow-sm focus:border-[#8B5CF6]/30 focus:ring-4 focus:ring-[#8B5CF6]/5 transition-all text-gray-900 placeholder:text-gray-300" 
                placeholder="Nom, chambre, réservation..." 
              />
           </div>

           <button 
             onClick={() => setIsModalOpen(true)}
             className="w-11 h-11 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#8B5CF6]/20 transition-all group active:scale-95"
           >
              <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
           </button>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex gap-8 min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-[32px] border border-transparent shadow-xl shadow-[#8B5CF6]/5 overflow-hidden relative">
          
          {/* Timeline Header */}
          <div className="flex border-b border-gray-50 bg-white z-10">
            <div className="w-64 p-6 border-r border-gray-50 flex flex-col justify-end bg-gray-50/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]/50" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chambres</span>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-x-auto scrollbar-hide border-b border-gray-50 translate-z-0">
               {days.map((d, i) => (
                  <div key={i} className={cn(
                    "min-w-[70px] flex-1 flex flex-col items-center justify-center py-4 border-r border-gray-50/50 group transition-colors relative",
                    d.isWeekend && "bg-gray-50/20",
                    d.date === 27 && "bg-[#8B5CF6]/5"
                  )}>
                     <div className="text-[9px] font-bold text-emerald-500/80 mb-0.5">{d.occ}%</div>
                     <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-0.5 leading-none">{d.day}</div>
                     <div className={cn("text-base font-bold leading-none", d.date === 27 ? "text-[#8B5CF6]" : "text-gray-900")}>{d.date}</div>
                     {d.date === 27 && <div className="absolute top-0 left-0 right-0 h-1 bg-[#8B5CF6]" />}
                  </div>
               ))}
            </div>
          </div>

          <div className="flex-1 flex min-h-0">
             {/* Left Column Labels */}
             <div className="w-64 border-r border-gray-50 flex flex-col shrink-0">
               <div className="h-14 flex items-center px-6 bg-gray-50/30 border-b border-gray-50/50">
                  <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Disponibilités</span>
               </div>
               <div className="flex-1 overflow-y-auto scrollbar-hide py-2 bg-white">
                  {[101,102,103,104,105,201,202,203,204,301,302,303].map((num, i) => (
                    <div key={i} className="h-14 flex items-center px-6 gap-5 group hover:bg-[#8B5CF6]/5 transition-all border-l-4 border-transparent hover:border-[#8B5CF6] cursor-pointer">
                       <div className={cn("w-2 h-2 rounded-full", i < 11 ? "bg-emerald-300" : "bg-gray-200")} />
                       <div className="flex flex-col">
                          <span className="text-[15px] font-bold text-gray-900 leading-none mb-1">{num}</span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter leading-none">STD / DLX</span>
                       </div>
                       <MoreVertical size={16} className="ml-auto text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
               </div>
             </div>

             {/* Booking Visualization */}
             <div className="flex-1 overflow-auto relative scrollbar-hide bg-white translate-z-0">
                <div className="absolute inset-0 flex flex-col">
                   <div className="h-14" />
                   {Array.from({ length: 12 }).map((_, i) => (
                     <div key={i} className="h-14 border-b border-gray-50/80" />
                   ))}
                </div>
                <div className="absolute inset-0 flex">
                   {days.map((d, i) => (
                     <div key={i} className={cn("min-w-[70px] flex-1 border-r border-gray-50/30", d.isWeekend && "bg-gray-50/10")} />
                   ))}
                </div>

                <div className="relative z-10 pt-1 pointer-events-none">
                  <div className="h-14" />
                  
                  {/* Pastel Booking Bars */}
                  <div className="absolute h-9 bg-blue-50 text-blue-700 rounded-full flex items-center px-4 gap-3 border border-blue-100/50 shadow-sm pointer-events-auto cursor-pointer group transition-all hover:scale-[1.02]" style={{ top: 65, left: 10, width: 340 }}>
                     <Users size={14} className="opacity-60" />
                     <span className="text-[13px] font-bold truncate">Sophie Dubois</span>
                  </div>
                  
                  <div className="absolute h-9 bg-purple-50 text-purple-700 rounded-full flex items-center px-4 gap-3 border border-purple-100/50 shadow-sm pointer-events-auto cursor-pointer transition-all hover:scale-[1.02]" style={{ top: 121, left: 20, width: 220 }}>
                     <Users size={14} className="opacity-60" />
                     <span className="text-[13px] font-bold">Thomas Leroy</span>
                  </div>

                  <div className="absolute h-9 bg-rose-50 text-rose-700 rounded-full flex items-center px-4 gap-3 border border-rose-100/50 shadow-sm pointer-events-auto cursor-pointer transition-all hover:scale-[1.02]" style={{ top: 177, left: 10, width: 380 }}>
                     <Users size={14} className="opacity-60" />
                     <span className="text-[13px] font-bold">Claire Martin</span>
                  </div>

                  <div className="absolute h-9 bg-[#F3E8FF] text-[#7E22CE] rounded-full flex items-center px-4 gap-3 border border-[#E9D5FF] shadow-sm pointer-events-auto cursor-pointer transition-all hover:scale-[1.02]" style={{ top: 233, left: 280, width: 260 }}>
                     <Users size={14} className="opacity-60" />
                     <span className="text-[13px] font-bold">Antoine Dupont</span>
                  </div>

                  <div className="absolute h-9 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center px-5 gap-2 border border-emerald-100 pointer-events-auto cursor-pointer transition-all hover:scale-[1.02]" style={{ left: 580, width: 300, top: 65 }}>
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                     <span className="text-[13px] font-bold">Disponible</span>
                  </div>
                </div>
             </div>
          </div>

          {/* Table Footer / Pagination */}
          <div className="border-t border-gray-50 px-6 py-4 flex items-center justify-between bg-white z-10">
             <div className="flex items-center gap-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Afficher</p>
                <select 
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-900 outline-none focus:border-[#8B5CF6]/30"
                >
                   {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <p className="text-[11px] font-bold text-gray-400">Total : <span className="text-gray-900 font-black">48 chambres</span></p>
             </div>
             
             <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(v => Math.max(1, v - 1))}
                  className="p-2 border border-gray-100 rounded-lg text-gray-400 hover:text-[#8B5CF6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                   <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                   {[1, 2, 3].map(p => (
                      <button 
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                          currentPage === p ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/20" : "text-gray-400 hover:bg-gray-50"
                        )}
                      >
                         {p}
                      </button>
                   ))}
                </div>
                <button 
                  disabled={currentPage === 3}
                  onClick={() => setCurrentPage(v => v + 1)}
                  className="p-2 border border-gray-100 rounded-lg text-gray-400 hover:text-[#8B5CF6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                   <ChevronRight size={16} />
                </button>
             </div>
          </div>
        </div>

        {/* Right Panel */}
        <AnimatePresence>
          {showKPIs && (
            <motion.div 
              initial={{ width: 0, opacity: 0, x: 50 }}
              animate={{ width: 360, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 50 }}
              className="flex flex-col gap-6 shrink-0 h-full overflow-y-auto scrollbar-hide"
            >
               {/* Section: Liste des chambres */}
               <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">ÉTAT DES CHAMBRES</span>
                  </div>
                  
                  <div className="space-y-3">
                     {[
                       { id: '101', type: 'SNO', icon: Users, text: 'Occupation', detail: 'S. Dubois', color: 'indigo-400' },
                       { id: '102', type: 'SNG', icon: User, text: 'Nettoyage', detail: 'À faire', color: 'rose-400' },
                       { id: '103', type: 'TWN', icon: Sparkles, text: 'En cours', detail: 'Ménage', color: 'blue-400' },
                       { id: '104', type: 'SNG', icon: CheckCircle2, text: 'Disponible', detail: 'Prête', color: 'emerald-400' },
                     ].map((r, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-transparent shadow-sm flex items-center gap-5 hover:shadow-md transition-all cursor-pointer group">
                           <div className="flex flex-col items-center shrink-0 w-12 py-1 border-r border-gray-50">
                              <span className="text-lg font-bold text-gray-900">{r.id}</span>
                              <span className="text-[8px] font-bold text-gray-400 uppercase leading-none mt-0.5">{r.type}</span>
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                 <div className="flex items-center gap-2">
                                    <r.icon size={12} className={cn("opacity-60", `text-${r.color.split('-')[0]}-500`)} />
                                    <span className="text-[11px] font-bold text-gray-900">{r.text}</span>
                                 </div>
                                 <span className="text-[10px] font-bold text-gray-400">{r.detail}</span>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
                  <button className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest hover:underline text-center w-full mt-2 transition-all">Consulter toutes les chambres</button>
               </div>

               {/* Section: Alertes */}
               <div className="bg-white rounded-3xl p-6 border border-transparent shadow-sm space-y-5">
                  <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest block mb-2">ALERTES</span>
                  <div className="space-y-4">
                    {[
                      { label: 'Chambre 103 en retard', color: 'bg-rose-400' },
                      { label: 'Check-in imminent (2)', color: 'bg-orange-400' },
                      { label: 'Note client importante', color: 'bg-blue-400' }
                    ].map((a, i) => (
                      <div key={i} className="flex items-center gap-3 cursor-pointer group">
                         <div className={cn("w-1.5 h-1.5 rounded-full", a.color)} />
                         <span className="text-[11px] font-bold text-gray-500 group-hover:text-gray-900 transition-colors uppercase tracking-tight">{a.label}</span>
                      </div>
                    ))}
                  </div>
               </div>

               {/* Section: Quick Actions */}
               <div className="bg-white rounded-3xl p-6 border border-transparent shadow-sm space-y-6">
                  <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest block">ACTIONS RAPIDES</span>
                  <div className="grid grid-cols-4 gap-3">
                     {[
                       { label: 'Resa', icon: Plus, action: () => setIsModalOpen(true) },
                       { label: 'Walk', icon: MousePointer2 },
                       { label: 'Bloc', icon: Lock },
                       { label: 'Vente', icon: DoorOpen },
                     ].map((act, i) => (
                       <button 
                         key={i} 
                         onClick={() => act.action?.()}
                         className="flex flex-col items-center gap-2.5 group"
                       >
                          <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shadow-sm group-hover:scale-110 group-hover:bg-[#8B5CF6]/5 group-hover:text-[#8B5CF6] group-hover:border-[#8B5CF6]/20 transition-all active:scale-95">
                             <act.icon size={18} />
                          </div>
                          <span className="text-[9px] font-bold text-gray-400 text-center uppercase tracking-tighter group-hover:text-[#8B5CF6] transition-colors">{act.label}</span>
                       </button>
                     ))}
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <NewReservationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
