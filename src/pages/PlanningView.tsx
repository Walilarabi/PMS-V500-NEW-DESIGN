import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Filter,
  Maximize2,
  Table as TableIcon,
  LayoutGrid,
  Zap,
  MoreVertical,
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';

export const PlanningView = () => {
  const rooms = [
    { id: '101', type: 'SNG/STD' },
    { id: '102', type: 'SNG/STD' },
    { id: '103', type: 'TWN/DLX' },
    { id: '104', type: 'TWN/DLX' },
    { id: '105', type: 'DBL/SUP' },
    { id: '201', type: 'DBL/DLX' },
    { id: '202', type: 'DBL/DLX' },
    { id: '203', type: 'STE/PRM' },
  ];

  const days = Array.from({ length: 14 }, (_, i) => ({
    date: i + 12,
    day: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i % 7],
    isToday: i === 2
  }));

  const bookings = [
    { room: '101', start: 1, duration: 4, client: 'J. Aubert', status: 'confirmed' },
    { room: '103', start: 0, duration: 2, client: 'S. Miller', status: 'checkout' },
    { room: '103', start: 4, duration: 3, client: 'M. Viau', status: 'confirmed' },
    { room: '105', start: 2, duration: 6, client: 'C. Martin', status: 'confirmed' },
    { room: '202', start: 0, duration: 4, client: 'H. Smith', status: 'confirmed' },
    { room: '203', start: 8, duration: 4, client: 'L. Gomez', status: 'confirmed' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F9FAFB] overflow-hidden">
      {/* Sub Header */}
      <div className="p-6 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-6">
           <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Planning</h1>
              <p className="text-gray-500 text-sm font-medium mt-1">Organisez votre établissement</p>
           </div>
           
           <div className="flex items-center bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
              <button className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"><ChevronLeft size={16} /></button>
              <div className="flex items-center gap-2 px-3">
                 <CalendarIcon size={14} className="text-[#8B5CF6]" />
                 <span className="text-[13px] font-bold text-gray-900">27 avr. - 26 mai 2026</span>
              </div>
              <button className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"><ChevronRight size={16} /></button>
           </div>
        </div>

        <div className="flex items-center gap-2">
           <div className="flex bg-white border border-gray-100 rounded-xl p-1 shadow-sm mr-2">
              <button className="p-1.5 px-3 text-xs font-bold bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg">Semaine</button>
              <button className="p-1.5 px-3 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg">Mois</button>
           </div>
           <Button variant="outline" size="sm" className="gap-2 shadow-sm bg-white font-bold"><Filter size={14} /> Filtres</Button>
           <Button variant="outline" size="sm" className="shadow-sm bg-white"><Maximize2 size={14} /></Button>
           <Button variant="primary" size="sm" className="gap-2 shadow-lg shadow-[#8B5CF6]/20">
              <Zap size={14} fill="currentColor" /> Optimiser le planning
           </Button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
         <Card className="p-4 py-3 border-l-4 border-l-[#8B5CF6]">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Revenu Prévu</div>
            <div className="text-lg font-bold text-gray-900 leading-none tracking-tight">24 850 €</div>
            <div className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
               <ArrowUpRight size={10} /> +8.3%
            </div>
         </Card>
         <Card className="p-4 py-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Taux Occ.</div>
            <div className="text-lg font-bold text-gray-900 leading-none tracking-tight">78%</div>
            <div className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
               <ArrowUpRight size={10} /> +4.2%
            </div>
         </Card>
         <Card className="p-4 py-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ADR</div>
            <div className="text-lg font-bold text-gray-900 leading-none tracking-tight">142 €</div>
            <div className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
               <ArrowUpRight size={10} /> +2.1%
            </div>
         </Card>
         <Card className="p-4 py-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">C. Occasées</div>
            <div className="text-lg font-bold text-gray-900 leading-none tracking-tight">32 / 48</div>
            <div className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
               <span className="bg-emerald-100 px-1 rounded">+6</span>
            </div>
         </Card>
         <Card className="p-4 py-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Arrivées</div>
            <div className="text-lg font-bold text-gray-900 leading-none tracking-tight">8</div>
            <div className="text-[10px] font-bold text-gray-400 mt-1">21 prochaines</div>
         </Card>
          <Card className="p-4 py-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Retards Men.</div>
            <div className="text-lg font-bold text-red-500 leading-none tracking-tight">2</div>
            <div className="text-[10px] font-bold text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={10} /> 1 critique</div>
         </Card>
         <div className="flex flex-col gap-2">
            <div className="h-full bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] font-bold text-gray-400 tracking-tighter">Occ. Totale</div>
                <div className="w-10 h-10 rounded-full border-4 border-[#8B5CF6] flex items-center justify-center text-[10px] font-bold">36</div>
            </div>
         </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="h-full bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex">
           {/* Room Column */}
           <div className="w-48 border-r border-gray-100 flex flex-col shrink-0">
              <div className="h-16 border-b border-gray-100 flex items-center px-6">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chambres</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50 scrollbar-hide">
                 <div className="h-14 flex items-center px-6 bg-gray-50/50">
                    <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Chambres Libres</span>
                 </div>
                 {rooms.map((room) => (
                    <div key={room.id} className="h-14 flex items-center px-6 gap-3 group hover:bg-gray-50 transition-colors">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                       <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-gray-900 leading-none">{room.id}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">{room.type}</span>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Timeline & Grid Wrapper */}
           <div className="flex-1 flex flex-col min-w-0">
              <div className="h-16 flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
                 {days.map((day, i) => (
                    <div key={i} className={cn(
                       "flex-1 min-w-[100px] border-r border-gray-100 flex flex-col items-center justify-center relative",
                       day.isToday && "bg-[#8B5CF6]/5"
                    )}>
                       <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">{day.day}</span>
                       <span className={cn(
                          "text-[13px] font-bold",
                          day.isToday ? "text-[#8B5CF6]" : "text-gray-900"
                       )}>{day.date}</span>
                       {day.isToday && <div className="absolute top-0 left-0 right-0 h-1 bg-[#8B5CF6]" />}
                    </div>
                 ))}
              </div>

              <div className="flex-1 overflow-auto relative bg-[#F9FAFB]/30">
                 {/* Booking Bars Overlay */}
                 <div className="absolute inset-0 z-10 pointer-events-none">
                    {bookings.map((booking, i) => {
                       const rowIndex = rooms.findIndex(r => r.id === booking.room) + 1; // +1 because of free rooms row
                       return (
                          <div 
                             key={i}
                             className={cn(
                                "absolute h-10 mt-2 pointer-events-auto cursor-pointer rounded-lg border-l-4 shadow-md flex items-center px-3 transition-transform hover:scale-[1.01]",
                                booking.status === 'confirmed' ? "bg-white border-l-[#8B5CF6] text-gray-700" :
                                booking.status === 'checkout' ? "bg-red-50 border-l-red-400 text-red-700" :
                                "bg-amber-50 border-l-amber-400 text-amber-700"
                             )}
                             style={{
                                top: `${rowIndex * 3.5}rem`,
                                left: `${booking.start * 100}px`,
                                width: `${booking.duration * 100 - 8}px`
                             }}
                          >
                             <div className="flex flex-col">
                                <span className="text-[11px] font-bold leading-none">{booking.client}</span>
                                {booking.duration > 2 && <span className="text-[9px] font-medium opacity-60 mt-1 tracking-wider">{booking.duration} nuits • Confirmed</span>}
                             </div>
                             <MoreVertical size={14} className="ml-auto opacity-30" />
                          </div>
                       );
                    })}
                 </div>

                 {/* Vertical Timeline Left Line */}
                 <div className="absolute h-full w-[2px] bg-[#8B5CF6] left-0 z-20 opacity-20" />

                 <div className="divide-y divide-gray-50">
                    <div className="h-14 flex items-center bg-gray-50/20">
                       {days.map((_, i) => (
                          <div key={i} className="flex-1 min-w-[100px] h-full border-r border-gray-100 flex items-center justify-center">
                             <Badge variant="success" className="text-[10px] py-0.5">14 lib.</Badge>
                          </div>
                       ))}
                    </div>
                    {rooms.map((room) => (
                       <div key={room.id} className="h-14 flex items-center group relative">
                          {days.map((day, i) => (
                             <div key={i} className={cn(
                                "flex-1 min-w-[100px] h-full border-r border-gray-100 relative group-hover:bg-gray-50/50 transition-colors",
                                day.isToday && "bg-[#8B5CF6]/[0.02]"
                             )}>
                             </div>
                          ))}
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Right Panel: List view */}
           <div className="w-[280px] border-l border-gray-100 flex flex-col shrink-0 bg-gray-50/30">
              <div className="p-6">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Liste des chambres</h3>
                    <div className="flex gap-1">
                       <button className="p-1 rounded-md bg-white border border-gray-100 text-[#8B5CF6] shadow-sm"><TableIcon size={12} /></button>
                       <button className="p-1 rounded-md text-gray-400"><LayoutGrid size={12} /></button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                       <div className="w-10 h-10 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-xl flex items-center justify-center font-bold text-xs">101</div>
                       <div className="flex-1">
                          <div className="flex justify-between items-center px-1">
                             <span className="text-[11px] font-bold text-gray-900">A. Dubois</span>
                             <Badge variant="warning" className="text-[8px] px-1 py-0">Départ: 12/05</Badge>
                          </div>
                          <div className="w-full bg-gray-100 h-1 rounded-full mt-2 overflow-hidden">
                             <div className="w-3/4 h-full bg-[#8B5CF6]" />
                          </div>
                       </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                       <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-xs">102</div>
                       <div className="flex-1">
                          <div className="flex justify-between items-center px-1">
                             <span className="text-[11px] font-bold text-gray-400">Libre</span>
                             <Badge variant="success" className="text-[8px] px-1 py-0">Prête</Badge>
                          </div>
                          <div className="w-full bg-gray-100 h-1 rounded-full mt-2" />
                       </div>
                    </div>
                 </div>

                 <div className="mt-8">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Alertes Rapides</h3>
                    <div className="space-y-2">
                       <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-[11px] font-medium text-red-700 flex items-center gap-2">
                          <AlertCircle size={14} /> 1 départ tardif non réglé 103
                       </div>
                       <div className="p-3 bg-[#8B5CF6]/5 border border-[#8B5CF6]/10 rounded-2xl text-[11px] font-medium text-[#8B5CF6] flex items-center gap-2">
                          <Zap size={14} fill="currentColor" /> 2 VIP arrivent dans 3h
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
