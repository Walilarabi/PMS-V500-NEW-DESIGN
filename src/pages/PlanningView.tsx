import React, { useRef, useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Filter,
  Search,
  Plus,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  CreditCard,
  History,
  ShieldCheck,
  TrendingUp,
  ExternalLink,
  Clock,
  Euro,
  MoreVertical,
  Lock
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReservationFormModal, { ReservationFormData } from '@/src/components/modals/ReservationFormModal';
import { useReservations, Reservation } from '@/src/contexts/ReservationContext';

export const PlanningView = () => {
  const { addReservation, reservations: contextReservations } = useReservations();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredRes, setHoveredRes] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const sidebarRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate 30 days of data
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(2026, 3, 27 + i);
    return {
      id: `day-${date.getTime()}`,
      date: date.getDate(),
      day: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      occ: 70 + Math.floor(Math.random() * 25),
      count: 32 + Math.floor(Math.random() * 12),
      adr: 135 + Math.floor(Math.random() * 50)
    };
  });

  // Mock rooms
  const rooms = Array.from({ length: 40 }, (_, i) => ({
    num: 101 + i,
    type: i % 4 === 0 ? 'SUITE' : i % 2 === 0 ? 'DLX' : 'STD',
    status: i % 7 === 0 ? 'cleanup' : 'ready'
  }));

  // Mock reservations
  const reservations = [
    { 
      id: 'r1', client: 'Sophie Dubois', room: 101, start: 0, length: 4, 
      details: { checkIn: '27 Avr', checkOut: '01 Mai', amount: 540, guests: 2, status: 'Payé', channel: 'Direct', policy: 'Flexible' } 
    },
    { 
      id: 'r2', client: 'Thomas Leroy', room: 102, start: 1, length: 2,
      details: { checkIn: '28 Avr', checkOut: '30 Avr', amount: 280, guests: 1, status: 'Garantie', channel: 'Booking.com', policy: 'Non-Remb' }
    },
    { 
      id: 'r3', client: 'Marc Aurele', room: 105, start: 3, length: 5,
      details: { checkIn: '30 Avr', checkOut: '05 Mai', amount: 890, guests: 2, status: 'Payé', channel: 'Expedia', policy: 'Strict' }
    },
    {
      id: 'r4', client: 'Claire Martin', room: 103, start: 5, length: 3,
      details: { checkIn: '02 Mai', checkOut: '05 Mai', amount: 420, guests: 1, status: 'Partiel', channel: 'Airbnb', policy: 'Flexible' }
    }
  ];

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredRes) {
      setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden font-sans select-none" onMouseMove={handleMouseMove}>
      {/* Header Bar */}
      <div className="h-20 shrink-0 border-b border-gray-100 flex items-center justify-between px-8 bg-white z-50">
        <div className="flex items-center gap-10">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Planning de l'Hôtel</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Vue temps réel • Mai 2026</p>
          </div>
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100/50">
            <button className="p-1 hover:text-violet-600 transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-[13px] font-bold px-4 text-gray-700 min-w-[140px] text-center italic">27 Avril — 26 Mai</span>
            <button className="p-1 hover:text-violet-600 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-5 border-gray-100 font-bold gap-2 text-xs">
            <Filter size={14} /> Filtres
          </Button>
          <Button variant="primary" size="sm" className="h-10 rounded-xl px-6 bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20 font-bold gap-2 text-xs" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Nouvelle Résa
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Unit Sidebar */}
        <motion.div 
          animate={{ width: isSidebarCollapsed ? 80 : 240 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex flex-col bg-white border-r border-gray-100 shrink-0 z-40 relative"
        >
          {/* Sidebar Header */}
          <div className="h-[130px] border-b border-gray-100 bg-gray-50/20 flex flex-col justify-end p-6 relative">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-8 w-6 h-6 bg-white border border-gray-100 rounded-full shadow-sm flex items-center justify-center text-gray-400 hover:text-violet-600 hover:border-violet-200 transition-all z-50"
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
            </button>
            {!isSidebarCollapsed && (
              <>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Chambres</span>
                <div className="text-xl font-black text-gray-900">{rooms.length} Unités</div>
              </>
            )}
            {isSidebarCollapsed && <div className="text-center font-black text-gray-300 text-[10px]">UNITES</div>}
          </div>

          {/* Sidebar Rooms List */}
          <div 
            ref={sidebarRef}
            className="flex-1 overflow-hidden scrollbar-hide pointer-events-none"
          >
            {rooms.map((room) => (
              <div key={room.num} className="h-14 flex items-center px-6 gap-4 border-b border-gray-50/50">
                <div className={cn("w-2 h-2 rounded-full shrink-0 shadow-sm", room.status === 'ready' ? "bg-emerald-400 ring-4 ring-emerald-50" : "bg-orange-300 ring-4 ring-orange-50")} />
                {!isSidebarCollapsed && (
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-gray-900 leading-none">{room.num}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5 tracking-tighter">{room.type}</span>
                  </div>
                )}
                {isSidebarCollapsed && <span className="text-[12px] font-black text-gray-400">{room.num}</span>}
                {!isSidebarCollapsed && (
                  <button 
                    title="Verrouiller chambre"
                    className="ml-auto p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Lock size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Calendar Grid Container */}
        <div className="flex-1 flex flex-col min-w-0" ref={gridRef}>
           {/* Horizontal Scroll Header (Sticky) */}
           <div className="flex-1 overflow-auto custom-scrollbar flex flex-col" onScroll={handleScroll}>
              
              {/* Dates Header - Sticky behavior via container */}
              <div className="sticky top-0 z-30 flex bg-white whitespace-nowrap min-w-max border-b border-gray-100 shadow-sm">
                {days.map((d, i) => (
                  <div key={d.id} className={cn(
                    "w-[120px] shrink-0 flex flex-col items-center justify-center pt-6 pb-4 border-r border-gray-100 transition-colors",
                    d.isWeekend && "bg-gray-50/20",
                    i === 3 && "bg-violet-50/30 ring-1 ring-inset ring-violet-100"
                  )}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{d.day}</span>
                    <span className={cn("text-base font-black leading-none mb-3", i === 3 ? "text-violet-600" : "text-gray-900")}>{d.date}</span>
                    
                    {/* Indicators */}
                    <div className="flex flex-col items-center gap-1.5">
                       <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-violet-500/80">{d.occ}% TO</span>
                          <div className="w-10 h-1 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                             <div className="h-full bg-violet-400/70" style={{ width: `${d.occ}%` }} />
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-0.5 opacity-60">
                             <Users size={8} /> <span className="text-[9px] font-bold">{d.count}</span>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-80">
                             <Euro size={8} /> <span className="text-[9px] font-bold">{d.adr}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid with background patterns and reservations */}
              <div className="relative min-w-max">
                 {/* Visual Grid Lines */}
                 <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((d) => (
                       <div key={`col-${d.id}`} className={cn("w-[120px] shrink-0 border-r border-gray-50/50", d.isWeekend && "bg-gray-50/10")} />
                    ))}
                 </div>

                 <div className="relative">
                    {rooms.map((room) => (
                      <div key={`row-${room.num}`} className="h-14 border-b border-gray-50/40 relative hover:bg-gray-50/20 transition-colors">
                        {/* Render Reservations for this room */}
                        {reservations.filter(res => res.room === room.num).map(res => (
                          <div 
                            key={res.id}
                            onMouseEnter={(e) => setHoveredRes(res)}
                            onMouseLeave={() => setHoveredRes(null)}
                            className={cn(
                              "absolute h-[42px] top-1.5 rounded-2xl border flex items-center px-4 gap-3 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg z-20 group",
                              res.id === 'r1' ? "bg-indigo-50 border-indigo-100 text-indigo-700 shadow-indigo-100/30" : 
                              res.id === 'r2' ? "bg-violet-50 border-violet-100 text-violet-700 shadow-violet-100/30" :
                              res.id === 'r3' ? "bg-emerald-50 border-emerald-100 text-emerald-700 shadow-emerald-100/30" :
                              "bg-rose-50 border-rose-100 text-rose-700 shadow-rose-100/30"
                            )}
                            style={{ 
                              left: res.start * 120 + 8,
                              width: res.length * 120 - 16
                            }}
                          >
                             <div className="w-6 h-6 rounded-lg bg-white/60 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Users size={12} />
                             </div>
                             <span className="text-[13px] font-black truncate">{res.client}</span>
                             <MoreVertical size={14} className="ml-auto opacity-30 hover:opacity-100" />
                          </div>
                        ))}
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Modern Tooltip Overlay */}
      <AnimatePresence>
        {hoveredRes && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ 
              position: 'fixed', 
              left: tooltipPos.x, 
              top: tooltipPos.y,
            }}
            className="z-[9999] pointer-events-none w-80 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden"
          >
             {/* Tooltip Content */}
             <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-violet-200">
                         {hoveredRes.client.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                         <h4 className="text-[15px] font-black text-gray-900 leading-tight">{hoveredRes.client}</h4>
                         <div className="flex items-center gap-2 mt-1">
                            <Badge variant="neutral" className="text-[9px] font-black py-0 px-2 bg-gray-50 border-gray-100 uppercase">{hoveredRes.details.channel}</Badge>
                            <span className="text-[10px] font-bold text-gray-400">#{hoveredRes.id.toUpperCase()}</span>
                         </div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{hoveredRes.details.status}</div>
                      <div className="flex items-center gap-1 justify-end mt-1 text-gray-400">
                         <ShieldCheck size={12} />
                         <span className="text-[10px] font-bold">Sécurisé</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-[20px] border border-gray-100/50">
                   <div className="space-y-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Clock size={9} /> Arrivée</span>
                      <p className="text-[13px] font-black text-gray-900">{hoveredRes.details.checkIn}</p>
                   </div>
                   <div className="space-y-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><ExternalLink size={9} /> Départ</span>
                      <p className="text-[13px] font-black text-gray-900">{hoveredRes.details.checkOut}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-y-4">
                   <div className="flex items-center gap-3">
                      <History size={16} className="text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-600">{hoveredRes.length} Nuits</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <Users size={16} className="text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-600">{hoveredRes.details.guests} Personnes</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <Euro size={16} className="text-gray-300" />
                      <span className="text-[11px] font-black text-gray-900">{hoveredRes.details.amount} € Total</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <CreditCard size={16} className="text-[#8B5CF6]" />
                      <span className="text-[11px] font-bold text-[#8B5CF6] uppercase tracking-tighter">Statut: {hoveredRes.details.status}</span>
                   </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                   <span className="text-[10px] font-bold text-gray-400 italic">Politique : {hoveredRes.details.policy}</span>
                   <button className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:underline">Détails complète</button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReservationFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(data: ReservationFormData) => {
          const newRes: Reservation = {
            id: data.reference,
            priority: 'Moyenne',
            room: data.roomNumber,
            roomType: 'STD/DLX', // fallback
            status: 'Arrivée < 1h',
            statusColor: 'text-orange-500/80',
            dotColor: 'bg-orange-400',
            client: data.guestName,
            arrival: `${data.checkIn} 16:00`,
            departure: `${data.checkOut} 11:00`,
            source: data.channel.toUpperCase(),
            sourceColor: data.channel === 'Direct' ? 'bg-green-400' : 'bg-indigo-400',
            action: 'Check-in',
            governess: 'À faire',
            vip: data.segment === 'VIP',
            payment: data.paymentStatus === 'Payé' ? 'Payé' : 'Partiel',
            totalAmount: data.totalTTC,
            ownerFeeRate: 0.20,
            pmsFeeRate: 0.15,
            cleaningFee: 50,
            email: data.email,
            phone: data.phone,
            nationality: data.nationality,
            guests: { adults: data.adults, children: data.children },
            notes: data.notes
          };
          addReservation(newRes);
        }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #ffffff;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f1f5f9;
          border-radius: 10px;
          border: 2px solid white;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e2e8f0;
        }
      `}} />
    </div>
  );
};
