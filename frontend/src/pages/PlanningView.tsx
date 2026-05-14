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
  Lock,
  LayoutGrid,
  CalendarDays,
  Zap,
  CheckCircle2,
  Clock3,
  AlertCircle,
  HelpCircle,
  Eye,
  Settings2
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReservationFormModal, { ReservationFormData } from '@/src/components/modals/ReservationFormModal';
import { NewReservationModal } from '@/src/components/modals/NewReservationModal';
import { useReservations as useContextReservations, Reservation } from '@/src/contexts/ReservationContext';
import { useReservations, useCreateReservation } from '@/src/domains/reservations/hooks';
import { useRooms } from '@/src/domains/hotel/hooks';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { useConfigStore, HotelEvent } from '@/src/store/configStore';
import { EventManagerModal } from '@/src/components/modals/EventManagerModal';
import type { ReservationRow } from '@/src/domains/reservations/schemas';

// ─── Type interne du Gantt — découplé de ReservationRow et du mock context ───
interface GanttReservation {
  id: string;
  room: string;           // numéro de chambre (ex: "101")
  client: string;         // nom client
  arrival: string;        // ISO datetime ou "YYYY-MM-DD HH:mm"
  departure: string;
  source: string;         // DIRECT | BOOKING | AIRBNB | EXPEDIA
  status: string;         // label UI (ex: "Arrivée < 1h", "Occupée")
  totalAmount: number;
  nights: number;
  payment: string;
  vip: boolean;
  _uuid?: string;         // UUID Supabase pour mutations
  _roomId?: string;
  _version?: number;
}

/** Convertit un ReservationRow Supabase → GanttReservation */
function adaptToGantt(r: ReservationRow): GanttReservation {
  const statusMap: Record<string, string> = {
    confirmed: 'Arrivée < 1h',
    checked_in: 'Occupée',
    checked_out: 'Départ',
    cancelled: 'Annulée',
    pending: 'Non confirmée',
    hold: 'Option',
  };

  const paid = r.paid_amount ?? 0;
  const total = r.total_amount ?? 0;

  return {
    id: r.id,
    room: r.room_number ?? '—',
    client: r.guest_name ?? 'Client inconnu',
    arrival: r.check_in.includes('T') ? r.check_in : `${r.check_in} 16:00`,
    departure: r.check_out.includes('T') ? r.check_out : `${r.check_out} 11:00`,
    source: r.source?.toUpperCase() ?? 'DIRECT',
    status: statusMap[r.status ?? 'pending'] ?? 'Confirmée',
    totalAmount: total,
    nights: r.nights ?? Math.max(1, Math.round(
      (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86_400_000
    )),
    payment: paid >= total && total > 0 ? 'Payé' : paid > 0 ? 'Partiel' : 'En attente',
    vip: false,
    _uuid: r.id,
    _roomId: r.room_id ?? undefined,
    _version: (r as any).version ?? 1,
  };
}

/** Convertit un mock Reservation (context) → GanttReservation (fallback) */
function adaptMockToGantt(r: Reservation): GanttReservation {
  return {
    id: r.id,
    room: r.room,
    client: r.client,
    arrival: r.arrival,
    departure: r.departure,
    source: r.source,
    status: r.status,
    totalAmount: r.totalAmount,
    nights: 1,
    payment: r.payment,
    vip: r.vip,
  };
}

function reservationMatchesRoom(
  reservation: GanttReservation,
  room: { id: string; number: string },
): boolean {
  return reservation.room === room.number || reservation._roomId === room.id;
}

export const PlanningView = () => {
  // ── Données réelles Supabase ──────────────────────────────────────────────
  const { session } = useAuth();
  const { data: supabaseData } = useReservations({ limit: 500 });
  const { data: supabaseRooms = [] } = useRooms();
  const createReservation = useCreateReservation();

  // Context mock — gardé uniquement comme fallback si DB vide
  const { addReservation, reservations: contextReservations } = useContextReservations();

  // ── Source unifiée pour le Gantt ──────────────────────────────────────────
  // Priorité : Supabase si données disponibles, mock sinon
  const ganttReservations = React.useMemo<GanttReservation[]>(() => {
    const rows = supabaseData?.rows ?? [];
    if (rows.length > 0) return rows.map(adaptToGantt);
    return contextReservations.map(adaptMockToGantt);
  }, [supabaseData, contextReservations]);

  // ── Rooms : Supabase prioritaire, store mock sinon ────────────────────────
  const { rooms: storeRooms, events: storeEvents } = useConfigStore();

  const effectiveRooms = React.useMemo(() => {
    if (supabaseRooms.length > 0) {
      return supabaseRooms.map((r) => ({
        id: r.id,
        number: r.number,
        type: r.type ?? 'DBL',
        category: r.category ?? 'STD',
        floor: String(r.floor ?? '1'),
        status: (r.housekeeping_status ?? r.status ?? 'clean') as
          'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance',
      }));
    }
    return storeRooms;
  }, [supabaseRooms, storeRooms]);
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);
  const [hoveredRes, setHoveredRes] = useState<GanttReservation | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeView, setActiveView] = useState<'7J' | '15J' | 'Mois'>('15J');
  const [displayMode, setDisplayMode] = useState<'Gantt' | 'Calendar'>('Gantt');
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [floorFilter, setFloorFilter] = useState<string>('Tous');
  const [typeFilter, setTypeFilter] = useState<string>('Tous Types');
  const [statusFilter, setStatusFilter] = useState<string>('Tous Statuts');
  const [channelFilter, setChannelFilter] = useState<string>('Tous Canaux');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredEvents, setHoveredEvents] = useState<HotelEvent[] | null>(null);

  // ── Drag-to-create state ──────────────────────────────────────────────────
  const [dragState, setDragState] = useState<{
    active: boolean;
    roomId: string;
    roomNumber: string;
    startDayIndex: number;
    endDayIndex: number;
    cursorX: number;
    cursorY: number;
  } | null>(null);
  const [dragConflict, setDragConflict] = useState(false);
  const [newResModal, setNewResModal] = useState<{
    roomId: string;
    roomNumber: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);

  // Constants for filters
  const roomTypes = Array.from(new Set(effectiveRooms.map(r => r.type))).sort();
  const roomScales = Array.from(new Set(effectiveRooms.map(r => r.category))).sort();
  const channels = ['DIRECT', 'BOOKING', 'AIRBNB', 'EXPEDIA', 'AGODA', 'HOTELBEDS', 'CTRIP'];
  const statuses = ['Arrivées', 'Départs', 'Occupées', 'Libres', 'Ménage'];

  // Filter Rooms
  const rooms = effectiveRooms.filter(r => {
    const passFloor = floorFilter === 'Tous' || r.floor.toString() === floorFilter;
    const passType = typeFilter === 'Tous Types' || r.type === typeFilter || r.category === typeFilter;
    const passSearch = searchQuery === '' || 
      r.number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter for rooms
    let passStatus = true;
    if (statusFilter === 'Libres') passStatus = r.status === 'clean';
    if (statusFilter === 'Ménage') passStatus = r.status === 'dirty';
    if (statusFilter === 'Occupées') {
       const todayStr = new Date().toISOString().split('T')[0];
       passStatus = ganttReservations.some(res => 
         reservationMatchesRoom(res, r) &&
         todayStr >= res.arrival.split(' ')[0] &&
         todayStr < res.departure.split(' ')[0]
       );
    }
    
    return passFloor && passType && passSearch && passStatus;
  });

  const floors = Array.from(new Set(effectiveRooms.map(r => r.floor.toString()))).sort();

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() - (activeView === '7J' ? 7 : activeView === '15J' ? 15 : 30));
    setCurrentDate(next);
  };
  const handleNext = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + (activeView === '7J' ? 7 : activeView === '15J' ? 15 : 30));
    setCurrentDate(next);
  };
  const handleToday = () => {
    setCurrentDate(new Date(2026, 4, 1)); // Anchor at May 1st 2026 for demo data visibility
  };

  const viewLength = activeView === '7J' ? 7 : activeView === '15J' ? 15 : 31;
  const colWidth = 100 / viewLength; // percentage
  
  const days = React.useMemo(() => {
    return Array.from({ length: viewLength }, (_, i) => {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const occupiedCount = ganttReservations.filter(res => {
        try {
          const start = new Date(res.arrival).getTime();
          const end = new Date(res.departure).getTime();
          const current = date.getTime();
          return !isNaN(start) && current >= start && current < end;
        } catch { return false; }
      }).length;

      const blockedCount = rooms.filter(r => r.status === 'out_of_order' || r.status === 'maintenance').length;
      const availableTotal = rooms.length - occupiedCount - blockedCount;

      const dayEvents = storeEvents.filter(e => {
          return dateStr >= e.startDate && dateStr <= e.endDate;
      });

      return {
        id: `day-${date.getTime()}`,
        dateStr,
        dateNum: date.getDate(),
        dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
        monthName: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'][date.getMonth()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        occ: rooms.length > 0 ? Math.round((occupiedCount / rooms.length) * 100) : 0,
        available: Math.max(0, availableTotal),
        events: dayEvents,
        adr: 120 + Math.floor(Math.random() * 40)
      };
    });
  }, [ganttReservations, storeEvents, rooms, currentDate, viewLength]);

  const checkDragConflict = (roomId: string, roomNumber: string, startIdx: number, endIdx: number): boolean => {
    const start = Math.min(startIdx, endIdx);
    const end = Math.max(startIdx, endIdx);
    const dragStart = new Date(currentDate.getTime() + start * 86_400_000);
    const dragEnd = new Date(currentDate.getTime() + (end + 1) * 86_400_000);
    return ganttReservations.some(res => {
      if (res.room !== roomNumber && res._roomId !== roomId) return false;
      const resStart = new Date(res.arrival).getTime();
      const resEnd = new Date(res.departure).getTime();
      return dragStart.getTime() < resEnd && dragEnd.getTime() > resStart;
    });
  };

  const handleDragStart = (e: React.MouseEvent, roomId: string, roomNumber: string, dayIndex: number) => {
    e.preventDefault();
    setDragState({ active: true, roomId, roomNumber, startDayIndex: dayIndex, endDayIndex: dayIndex, cursorX: e.clientX, cursorY: e.clientY });
    setDragConflict(false);
  };

  const handleDragEnd = () => {
    if (!dragState?.active) return;
    const start = Math.min(dragState.startDayIndex, dragState.endDayIndex);
    const end = Math.max(dragState.startDayIndex, dragState.endDayIndex);
    if (!dragConflict) {
      const checkIn = new Date(currentDate.getTime() + start * 86_400_000);
      const checkOut = new Date(currentDate.getTime() + (end + 1) * 86_400_000);
      setNewResModal({ roomId: dragState.roomId, roomNumber: dragState.roomNumber, checkIn: checkIn.toISOString().split('T')[0], checkOut: checkOut.toISOString().split('T')[0] });
    }
    setDragState(null);
    setDragConflict(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredRes) setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 });
    if (dragState?.active && gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const dayIndex = Math.max(0, Math.min(viewLength - 1, Math.floor((relX / rect.width) * viewLength)));
      const hasConflict = checkDragConflict(dragState.roomId, dragState.roomNumber, dragState.startDayIndex, dayIndex);
      setDragConflict(hasConflict);
      setDragState(prev => prev ? { ...prev, endDayIndex: dayIndex, cursorX: e.clientX, cursorY: e.clientY } : null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden font-sans select-none" onMouseMove={handleMouseMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>

      {/* Drag-to-create floating popup */}
      {dragState?.active && (
        <div
          className="fixed z-[999] pointer-events-none"
          style={{ left: dragState.cursorX + 16, top: dragState.cursorY - 60 }}
        >
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold backdrop-blur-sm ${
            dragConflict
              ? 'bg-red-500 border-red-400 text-white'
              : 'bg-violet-600 border-violet-500 text-white'
          }`}>
            {dragConflict ? (
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>Conflit de réservation</span>
              </div>
            ) : (() => {
              const s = Math.min(dragState.startDayIndex, dragState.endDayIndex);
              const e = Math.max(dragState.startDayIndex, dragState.endDayIndex);
              const nights = e - s + 1;
              const ci = new Date(currentDate.getTime() + s * 86_400_000);
              const co = new Date(currentDate.getTime() + (e + 1) * 86_400_000);
              return (
                <div className="space-y-1">
                  <div className="text-xs font-black uppercase tracking-widest text-violet-200">Chambre {dragState.roomNumber}</div>
                  <div className="flex items-center gap-3">
                    <span>{ci.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                    <span className="text-violet-300">→</span>
                    <span>{co.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                  </div>
                  <div className="text-xs text-violet-200">{nights} nuit{nights > 1 ? 's' : ''}</div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Drag selection overlay on grid */}
      {dragState?.active && !dragConflict && (() => {
        const s = Math.min(dragState.startDayIndex, dragState.endDayIndex);
        const e = Math.max(dragState.startDayIndex, dragState.endDayIndex);
        return (
          <div
            className="fixed pointer-events-none z-[100] bg-violet-500/20 border-2 border-violet-500 rounded-xl"
            style={{
              left: `calc(${s * colWidth}% + 4px)`,
              width: `calc(${(e - s + 1) * colWidth}% - 8px)`,
            }}
          />
        );
      })()}
      {/* Top Header Bar */}
      <div className="h-[72px] shrink-0 border-b border-gray-100 flex items-center justify-between px-6 bg-white z-[60]">
        <div className="flex items-center gap-6">
          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button onClick={() => setActiveView('7J')} className={cn("px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", activeView === '7J' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>Semaine</button>
            <button onClick={() => setActiveView('15J')} className={cn("px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", activeView === '15J' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>15J</button>
            <button onClick={() => setActiveView('Mois')} className={cn("px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", activeView === 'Mois' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>Mois</button>
          </div>

          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 ml-4">
            <button onClick={() => setDisplayMode('Gantt')} className={cn("flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", displayMode === 'Gantt' ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>
              <LayoutGrid size={14} /> Gantt
            </button>
            <button onClick={() => setDisplayMode('Calendar')} className={cn("flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", displayMode === 'Calendar' ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>
              <CalendarDays size={14} /> Calendrier
            </button>
          </div>

          <div className="flex items-center gap-3 px-4 py-1.5 bg-white rounded-xl border border-gray-100 ml-4">
            <button onClick={handlePrev} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"><ChevronLeft size={16} /></button>
            <button 
              onClick={handleToday}
              className="w-8 h-8 rounded-full border-2 border-indigo-100 flex items-center justify-center hover:bg-indigo-50 transition-all group"
            >
               <div className="w-2 h-2 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform" />
            </button>
            <button onClick={handleNext} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"><ChevronRight size={16} /></button>
          </div>

          <div className="px-6 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3 cursor-pointer group">
             <CalendarIcon className="text-indigo-500" size={16} />
             <span className="text-xs font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">
               {days[0]?.dayName.toLowerCase()}. {days[0]?.dateNum} {days[0]?.monthName.toLowerCase()} — {days[days.length-1]?.dayName.toLowerCase()}. {days[days.length-1]?.dateNum} {days[days.length-1]?.monthName.toLowerCase()} {currentDate.getFullYear()}
             </span>
             <Zap className="text-violet-300 group-hover:text-indigo-500 transition-colors" size={14} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-400 transition-colors" size={16} />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, chambre, dates..."
              className="bg-gray-50 border border-gray-100 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-64"
            />
          </div>

          <div className="flex items-center gap-2 px-2 bg-gray-50 border border-gray-100 rounded-2xl">
             <select 
               value={typeFilter}
               onChange={(e) => setTypeFilter(e.target.value)}
               className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-2.5 px-3 focus:ring-0 cursor-pointer"
             >
                <option>Tous Types</option>
                <optgroup label="Catégories">
                  {roomScales.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
                <optgroup label="Modèles">
                  {roomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
             </select>
             <div className="w-px h-6 bg-gray-200" />
             <select 
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value)}
               className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-2.5 px-1 focus:ring-0 cursor-pointer"
             >
                <option>Tous Statuts</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
             <div className="w-px h-6 bg-gray-200" />
             <select 
               value={channelFilter}
               onChange={(e) => setChannelFilter(e.target.value)}
               className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-2.5 px-3 focus:ring-0 cursor-pointer"
             >
                <option>Tous Canaux</option>
                {channels.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>

          <div className="flex items-center gap-1">
             <button 
               onClick={() => setShowRightSidebar(!showRightSidebar)}
               className={cn("p-2.5 rounded-xl transition-all", showRightSidebar ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50")}
             >
               <Eye size={18} />
             </button>
             <button className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Settings2 size={18} /></button>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-xl shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="h-12 shrink-0 border-b border-gray-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-6">
           {[
             { label: 'Direct', color: 'bg-indigo-200' },
             { label: 'Booking', color: 'bg-blue-300 font-black' },
             { label: 'Expedia', color: 'bg-orange-200' },
             { label: 'Airbnb', color: 'bg-rose-200' },
             { label: 'Walk-in', color: 'bg-emerald-200' }
           ].map(item => (
             <div key={item.label} className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-sm opacity-80", item.color)} />
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{item.label}</span>
             </div>
           ))}
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Arrivée</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400" />
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Séjour</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-200" />
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Départ</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-200 rotate-45" />
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Fictive</span>
           </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Unit Sidebar */}
        <div className="w-[170px] flex flex-col bg-white border-r border-gray-100 shrink-0 z-40">
           <div className="flex flex-col border-b border-gray-100">
              <div className="h-10 flex items-center px-4 gap-2 text-gray-400 group cursor-default">
                 <TrendingUp size={14} className="group-hover:text-indigo-400 transition-colors" />
                 <span className="text-[9px] font-black uppercase tracking-widest">TO %</span>
              </div>
              <div className="h-10 flex items-center px-4 gap-2 text-gray-400 group cursor-default">
                 <Lock size={14} className="group-hover:text-indigo-400 transition-colors" />
                 <span className="text-[9px] font-black uppercase tracking-widest">Ch. libres</span>
              </div>
              <div className="h-10 flex items-center px-4 gap-2 text-gray-400 group cursor-default">
                 <Euro size={14} className="group-hover:text-indigo-400 transition-colors" />
                 <span className="text-[9px] font-black uppercase tracking-widest">ADR</span>
              </div>
              <div className="h-10 flex items-center px-4 gap-2 text-gray-400 group cursor-default">
                 <Zap size={14} className="group-hover:text-indigo-400 transition-colors" />
                 <span className="text-[9px] font-black uppercase tracking-widest">Événements</span>
              </div>
           </div>

           <div className="h-20 flex items-center px-4 bg-gray-50/30">
              <div className="relative w-full">
                 <select 
                   value={floorFilter}
                   onChange={(e) => setFloorFilter(e.target.value)}
                   className="w-full bg-white border border-gray-100 rounded-xl shadow-sm pl-9 pr-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest appearance-none focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                 >
                    <option value="Tous">Tous Étages</option>
                    {floors.map(f => (
                      <option key={f} value={f}>Étage {f}</option>
                    ))}
                 </select>
                 <LayoutGrid size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" />
                 <ChevronRight size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none rotate-90" />
              </div>
           </div>

           <div ref={sidebarRef} className="flex-1 overflow-hidden scrollbar-hide pointer-events-none">
              {rooms.map(room => {
                const todayRes = ganttReservations.find(res => {
                  const now = new Date().getTime();
                  return reservationMatchesRoom(res, room) && now >= new Date(res.arrival).getTime() && now <= new Date(res.departure).getTime();
                });

                return (
                  <div key={room.id} className="h-20 flex flex-col justify-center px-4 border-b border-gray-50">
                    <div className="flex items-center gap-[14px]">
                       <span className="text-[14px] font-black text-gray-900 leading-none">{room.number}</span>
                       <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">{room.category}/{room.type}</span>
                       <div className={cn(
                         "w-5 h-5 rounded-full ml-auto shadow-[0_0_12px] transition-all border-2 border-white", 
                         todayRes ? "bg-blue-400 shadow-blue-100" :
                         room.status === 'clean' ? "bg-emerald-300 shadow-emerald-50" : 
                         room.status === 'dirty' ? "bg-rose-300 shadow-rose-50" : 
                         "bg-orange-300 shadow-orange-50"
                       )} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-[10px] font-black text-gray-300">€</span>
                    </div>
                  </div>
                );
              })}
           </div>
           
           <div className="bg-gray-50/50 border-t border-gray-100 pb-20">
              {['Simple', 'Double', 'Suite'].map(cat => (
                <div key={cat} className="h-10 flex items-center px-4 border-b border-gray-50 last:border-0">
                   <span className="text-[10px] font-black text-gray-400 italic uppercase">{cat}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Main Timeline Grid */}
        <div className="flex-1 flex flex-col min-w-0" ref={gridRef}>
           <div className="flex-1 overflow-auto custom-scrollbar flex flex-col" onScroll={handleScroll}>
               {/* Header Stats & Dates (Sticky) */}
              <div className="sticky top-0 z-30 bg-white border-b border-gray-100 w-full overflow-hidden">
                 {/* KPI Rows */}
                 <div className="flex text-center flex-nowrap w-full">
                    {days.map(d => (
                      <div 
                        key={`occ-${d.id}`} 
                        className={cn("h-10 border-r border-b border-gray-50 flex items-center justify-center transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")}
                        style={{ width: `${colWidth}%` }}
                      >
                         <span className={cn("text-[11px] font-black", d.occ > 80 ? "text-emerald-400" : d.occ > 50 ? "text-orange-300" : "text-gray-400")}>{d.occ}%</span>
                      </div>
                    ))}
                 </div>
                 <div className="flex text-center bg-gray-50/30 w-full flex-nowrap">
                    {days.map(d => (
                      <div 
                        key={`avail-${d.id}`} 
                        className={cn("h-10 border-r border-b border-gray-50 flex items-center justify-center transition-colors font-sans shrink-0", d.isWeekend && "bg-gray-50/10")}
                        style={{ width: `${colWidth}%` }}
                      >
                         <span className="text-[13px] font-black text-indigo-400">{d.available}</span>
                      </div>
                    ))}
                 </div>
                 <div className="flex text-center w-full flex-nowrap">
                    {days.map(d => (
                      <div 
                        key={`adr-${d.id}`} 
                        className={cn("h-10 border-r border-b border-gray-50 flex items-center justify-center transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")}
                        style={{ width: `${colWidth}%` }}
                      >
                         <span className="text-[11px] font-black text-violet-300">{d.adr}€</span>
                      </div>
                    ))}
                 </div>
                 <div className="flex text-center bg-gray-50/30 w-full flex-nowrap">
                    {days.map(d => {
                      const highestImpact = d.events.length > 0 ? d.events.reduce((acc, curr) => {
                        const weights = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
                        return weights[curr.impact as keyof typeof weights] > weights[acc.impact as keyof typeof weights] ? curr : acc;
                      }, d.events[0]) : null;

                      const impactColor = (highestImpact?.impact === 'high' || highestImpact?.impact === 'critical') ? 'bg-rose-300 text-white shadow-rose-50' : 
                                        highestImpact?.impact === 'medium' ? 'bg-orange-300 text-white shadow-orange-50' : 
                                        'bg-emerald-300 text-white shadow-emerald-50';

                      return (
                        <div 
                          key={`ev-${d.id}`} 
                          onClick={() => {
                            setSelectedEventDate(d.dateStr);
                            setIsEventModalOpen(true);
                          }}
                          onMouseEnter={(e) => {
                            if (d.events.length > 0) {
                              setHoveredEvents(d.events);
                              setTooltipPos({ x: e.clientX, y: e.clientY + 20 });
                            }
                          }}
                          onMouseLeave={() => setHoveredEvents(null)}
                          className={cn("h-10 border-r border-b border-gray-50 flex items-center justify-center transition-colors cursor-pointer hover:bg-indigo-50/50 shrink-0", d.isWeekend && "bg-gray-50/10")}
                          style={{ width: `${colWidth}%` }}
                        >
                           {d.events.length > 0 && (
                             <Badge className={cn("text-[10px] font-black h-6 w-6 flex items-center justify-center rounded-full p-0 border-none shadow-sm", impactColor)}>
                               {d.events.length}
                             </Badge>
                           )}
                        </div>
                      );
                    })}
                 </div>

                 {/* Date Row Header */}
                 <div className="flex bg-white w-full flex-nowrap">
                    {days.map((d, i) => (
                      <div 
                        key={`date-${d.id}`} 
                        className={cn(
                          "shrink-0 h-20 flex flex-col items-center justify-center border-r border-gray-100 transition-all",
                          d.isWeekend ? "bg-[#FFF9F5]/50" : "bg-white",
                          i === 0 && "bg-indigo-50/30 ring-2 ring-inset ring-indigo-100/50"
                        )}
                        style={{ width: `${colWidth}%` }}
                      >
                        <span className={cn("text-[10px] font-black uppercase tracking-widest mb-1", d.isWeekend ? "text-orange-300" : "text-gray-400")}>{d.dayName}</span>
                        <div className="flex items-baseline gap-1.5 leading-none">
                           <span className={cn("text-[17px] font-black", i === 0 ? "text-indigo-400" : d.isWeekend ? "text-orange-400" : "text-gray-900")}>{d.dateNum}</span>
                           <span className={cn("text-[11px] font-black uppercase tracking-tighter opacity-70", i === 0 ? "text-violet-300" : d.isWeekend ? "text-orange-300" : "text-gray-400")}>{d.monthName}</span>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Main Grid Body */}
              <div className="relative w-full bg-white flex-1 min-h-[500px]">
                 <div className="absolute inset-0 flex pointer-events-none z-0">
                    {days.map((d) => (
                       <div 
                         key={`col-${d.id}`} 
                         className={cn("shrink-0 border-r border-gray-50/50", d.isWeekend && "bg-gray-50/5")}
                         style={{ width: `${colWidth}%` }}
                       />
                    ))}
                 </div>

                 <div className="relative z-10 pb-20 w-full">
                    {rooms.map((room) => (
                      <div key={`row-${room.id}`} className="h-20 border-b border-gray-50/60 relative hover:bg-indigo-50/5 transition-colors w-full">
                        {/* Drag-to-create zones — one per day */}
                        <div className="absolute inset-0 flex z-10">
                          {days.map((d, dayIdx) => (
                            <div
                              key={`drag-${room.id}-${dayIdx}`}
                              className={`h-full shrink-0 cursor-crosshair ${dragState?.active && dragState.roomId === room.id ? '' : 'hover:bg-indigo-50/20'}`}
                              style={{ width: `${colWidth}%` }}
                              onMouseDown={(e) => handleDragStart(e, room.id, room.number, dayIdx)}
                            />
                          ))}
                        </div>
                        {/* Drag selection highlight for this room */}
                        {dragState?.active && dragState.roomId === room.id && !dragConflict && (() => {
                          const s = Math.min(dragState.startDayIndex, dragState.endDayIndex);
                          const e = Math.max(dragState.startDayIndex, dragState.endDayIndex);
                          return (
                            <div
                              className="absolute top-2 bottom-2 bg-violet-500/20 border-2 border-violet-500 rounded-xl z-20 pointer-events-none"
                              style={{ left: `calc(${s * colWidth}% + 4px)`, width: `calc(${(e - s + 1) * colWidth}% - 8px)` }}
                            />
                          );
                        })()}
                        {/* Conflict highlight */}
                        {dragState?.active && dragState.roomId === room.id && dragConflict && (() => {
                          const s = Math.min(dragState.startDayIndex, dragState.endDayIndex);
                          const e = Math.max(dragState.startDayIndex, dragState.endDayIndex);
                          return (
                            <div
                              className="absolute top-2 bottom-2 bg-red-500/20 border-2 border-red-500 rounded-xl z-20 pointer-events-none"
                              style={{ left: `calc(${s * colWidth}% + 4px)`, width: `calc(${(e - s + 1) * colWidth}% - 8px)` }}
                            />
                          );
                        })()}
                        {ganttReservations.filter(res => reservationMatchesRoom(res, room)).map((res, idx) => {
                          const arrivalDate = new Date(res.arrival);
                          const departureDate = new Date(res.departure);
                          const arrivalTime = arrivalDate.getTime();
                          const departureTime = departureDate.getTime();
                           const baseTime = currentDate.getTime();

                           const startIndex = isNaN(arrivalTime) || isNaN(baseTime) ? 0 : Math.max(0, Math.floor((arrivalTime - baseTime) / (1000 * 60 * 60 * 24)));
                           const dayCount = isNaN(departureTime) || isNaN(arrivalTime) ? 0 : Math.ceil((departureTime - arrivalTime) / (1000 * 60 * 60 * 24));
                           
                           if (isNaN(startIndex) || isNaN(dayCount) || startIndex >= viewLength || dayCount <= 0) return null;

                           if (channelFilter !== 'Tous Canaux' && res.source.toUpperCase() !== channelFilter.toUpperCase()) return null;
                           if (statusFilter !== 'Tous Statuts') {
                             if (statusFilter === 'Arrivées' && !res.status.includes('Arrivée')) return null;
                             if (statusFilter === 'Départs' && !res.status.includes('Départ')) return null;
                             if (statusFilter === 'Occupées' && !res.status.includes('Occupée')) return null;
                           }

                          return (
                            <div 
                              key={`planning-res-${res.id}-${idx}`}
                              onMouseEnter={(e) => {
                                setHoveredRes(res);
                                setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 });
                              }}
                              onMouseLeave={() => setHoveredRes(null)}
                              className={cn(
                                "absolute h-[48px] top-4 rounded-[14px] border flex items-center px-4 gap-3 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg z-20 group",
                                res.source === 'DIRECT' ? "bg-indigo-100/80 border-indigo-200 text-indigo-700" : 
                                res.source === 'BOOKING' ? "bg-blue-100/80 border-blue-200 text-blue-800" :
                                res.source === 'AIRBNB' ? "bg-rose-100/80 border-rose-200 text-rose-700" :
                                "bg-emerald-100/80 border-emerald-200 text-emerald-700"
                              )}
                              style={{ 
                                left: `calc(${startIndex * colWidth}% + 4px)`,
                                width: `calc(${Math.min(viewLength - startIndex, dayCount) * colWidth}% - 8px)`
                              }}
                            >
                               <div className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                  <Users size={14} />
                                </div>
                                <span className={cn("text-[12px] font-black truncate", viewLength > 15 ? "hidden lg:block" : "")}>{res.client}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    
                    {/* Summary Rows */}
                    <div className="bg-gray-50/10">
                       {['Simple', 'Double', 'Suite'].map((cat, idx) => (
                          <div key={`sum-row-${cat}`} className="flex h-10 border-b border-gray-50 italic w-full flex-nowrap">
                             {days.map(d => (
                                <div 
                                  key={`sum-${cat}-${d.id}`} 
                                  className={cn("shrink-0 border-r border-gray-50 flex items-center justify-center text-[11px] font-black text-gray-300", d.isWeekend ? "text-violet-200" : "")}
                                  style={{ width: `${colWidth}%` }}
                                >
                                   {idx === 2 ? 2 : 1}
                                </div>
                             ))}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Status Panel */}
        <AnimatePresence>
          {showRightSidebar && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col bg-white border-l border-gray-100 shrink-0 z-40 p-6 overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.02)]"
            >
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Détails Chambres</h3>
                  <button onClick={() => setShowRightSidebar(false)} className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors">
                     <Plus className="rotate-45" size={16} />
                  </button>
               </div>

               <div className="flex flex-wrap gap-x-4 gap-y-2 mb-8">
                  {[
                    { label: 'Occupée', color: 'bg-blue-300' },
                    { label: 'Propre', color: 'bg-emerald-300' },
                    { label: 'En cours', color: 'bg-orange-200' },
                    { label: 'À nettoyer', color: 'bg-rose-200' },
                    { label: 'Hors service', color: 'bg-gray-200' }
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                       <div className={cn("w-2 h-2 rounded-full", item.color)} />
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{item.label}</span>
                    </div>
                  ))}
               </div>

               <div className="space-y-4">
                  {rooms.slice(0, 4).map((room, i) => (
                    <div 
                      key={`stat-card-${room.id}`} 
                      className={cn(
                        "p-5 rounded-[24px] border transition-all hover:scale-[1.02] cursor-pointer",
                        i % 2 === 0 ? "bg-indigo-50/20 border-indigo-100" : "bg-white border-gray-100 shadow-sm"
                      )}
                    >
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className={cn(
                               "w-10 h-10 rounded-2xl flex items-center justify-center text-[13px] font-black",
                               i % 2 === 0 ? "bg-white text-indigo-400 shadow-sm" : 
                               i === 1 ? "bg-rose-50 text-rose-400" : "bg-emerald-50 text-emerald-400"
                             )}>
                                {room.number}
                             </div>
                             <div>
                                <h4 className="text-[14px] font-black text-gray-900">{room.type}</h4>
                                <div className="flex items-center gap-1.5">
                                   {i % 2 === 0 ? <Users size={10} className="text-violet-300" /> : <CheckCircle2 size={10} className="text-emerald-300" />}
                                   <span className="text-[10px] font-bold text-gray-400 italic">
                                      {i % 2 === 0 ? 'Occupée' : 'Propre / Libre'}
                                   </span>
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className="text-[14px] font-black text-gray-900">€</div>
                             <div className="text-[8px] font-black text-gray-200 uppercase italic">/ Nuit</div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                     <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Total Chambres</span>
                     <span className="text-base font-black text-gray-900">{rooms.length}</span>
                  </div>
                  <div className="bg-orange-50/30 rounded-2xl p-4 border border-orange-100/50">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-orange-100/50 flex items-center justify-center text-orange-400">
                           <Clock3 size={16} />
                        </div>
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Rappel Hygiène</span>
                     </div>
                     <p className="text-[11px] font-bold text-orange-600/70 italic leading-snug">1 chambres en attente de ménage.</p>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

    {/* Tooltip Overlay */}
      <AnimatePresence>
        {hoveredRes && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{ 
              position: 'fixed', 
              left: tooltipPos.x, 
              top: tooltipPos.y,
            }}
            className="z-[9999] pointer-events-none w-80 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 p-6 space-y-4"
          >
             <div className="flex items-center justify-between gap-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-100">{hoveredRes.client[0]}</div>
                   <div>
                      <h4 className="text-[15px] font-black text-gray-900 leading-tight">{hoveredRes.client}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="neutral" className="text-[9px] font-black py-0 px-2 bg-white/80">{hoveredRes.source}</Badge>
                        <span className="text-[10px] font-bold text-gray-400 italic">#{hoveredRes.id}</span>
                      </div>
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-[16px] font-black text-indigo-600">{(hoveredRes.totalAmount || 0).toLocaleString()}€</div>
                   <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Total TTC</div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 py-1">
                <div className="p-3 bg-indigo-50/30 rounded-2xl border border-indigo-50">
                   <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Arrivée</p>
                   <p className="text-[12px] font-bold text-indigo-900">{hoveredRes.arrival.split(' ')[0]}</p>
                </div>
                <div className="p-3 bg-orange-50/30 rounded-2xl border border-orange-50">
                   <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">Départ</p>
                   <p className="text-[12px] font-bold text-orange-900">{hoveredRes.departure.split(' ')[0]}</p>
                </div>
             </div>

             <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-2 text-gray-500">
                      <Users size={12} className="text-indigo-400" />
                      <span className="text-[11px] font-bold">Occupants</span>
                   </div>
                   <span className="text-[11px] font-black text-gray-900">
                      {hoveredRes.nights} nuit{hoveredRes.nights > 1 ? 's' : ''}
                   </span>
                </div>
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-2 text-gray-500">
                      <CreditCard size={12} className="text-emerald-400" />
                      <span className="text-[11px] font-bold">Paiement</span>
                   </div>
                   <Badge variant={hoveredRes.payment === 'Payé' ? 'success' : 'warning'} className="text-[9px] font-black">
                      {hoveredRes.payment || 'En attente'}
                   </Badge>
                </div>
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-2 text-gray-500">
                      <Clock size={12} className="text-indigo-400" />
                      <span className="text-[11px] font-bold">Séjour</span>
                   </div>
                   <span className="text-[11px] font-black text-gray-900">
                      {(() => {
                        const start = new Date(hoveredRes.arrival);
                        const end = new Date(hoveredRes.departure);
                        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        return isNaN(diff) ? '3' : diff;
                      })()} Nuitées
                   </span>
                </div>
             </div>
          </motion.div>
        )}

        {hoveredEvents && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{ 
              position: 'fixed', 
              left: tooltipPos.x, 
              top: tooltipPos.y,
            }}
            className="z-[9999] pointer-events-none w-80 bg-white rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.2)] border border-gray-50 p-6 space-y-4 overflow-hidden"
          >
             <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                   <Zap size={16} />
                </div>
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Événements sur la période</span>
             </div>
             
             <div className="space-y-3">
                {hoveredEvents
                   .sort((a, b) => {
                      const weights = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
                      return (weights[b.impact as keyof typeof weights] || 0) - (weights[a.impact as keyof typeof weights] || 0);
                   })
                   .map((evt, idx) => (
                   <div key={idx} className="p-4 rounded-2xl bg-gray-50 border border-gray-100/50">
                      <div className="flex items-center justify-between mb-1">
                         <h5 className="text-[13px] font-black text-gray-900">{evt.title}</h5>
                         <div className={cn(
                            "px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm",
                            evt.impact === 'critical' ? "bg-rose-500 text-white" : 
                            evt.impact === 'high' ? "bg-rose-100 text-rose-600" : 
                            evt.impact === 'medium' ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
                         )}>
                           {evt.impact === 'critical' ? 'Critique' : evt.impact === 'high' ? 'Fort' : evt.impact === 'medium' ? 'Moyen' : 'Faible'}
                         </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                         <Clock size={10} />
                         <span className="text-[10px] font-bold">{evt.startDate} — {evt.endDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-indigo-500 bg-indigo-50/50 px-2 py-1 rounded-lg w-fit">
                         <ExternalLink size={10} />
                         <span className="text-[10px] font-black">{evt.location}</span>
                      </div>
                   </div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReservationFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={async (data: ReservationFormData) => {
          if (!session?.tenantId) return;
          const matchedRoom = effectiveRooms.find(r => r.number === data.roomNumber);
          try {
            await createReservation.mutateAsync({
              reference: data.reference,
              guestName: data.guestName || null,
              guestEmail: data.email || null,
              guestPhone: data.phone || null,
              checkIn: data.checkIn,
              checkOut: data.checkOut,
              adults: data.adults,
              children: data.children,
              source: data.channel,
              totalAmount: data.totalTTC,
              notes: data.notes || null,
              roomId: matchedRoom?.id ?? null,
              roomNumber: data.roomNumber || matchedRoom?.number || null,
              roomType: data.roomType || matchedRoom?.type || null,
              roomCategory: matchedRoom?.category ?? null,
              guestId: null,
            });
          } catch (err) {
            console.error('[PlanningView] createReservation failed:', err);
            throw err;
          }
          setIsModalOpen(false);
        }} 
      />

      {/* New Reservation Modal — from drag-to-create */}
      <NewReservationModal
        isOpen={!!newResModal}
        onClose={() => setNewResModal(null)}
        prefill={newResModal ?? undefined}
        onSave={async (data) => {
          try {
            const roomId = data.roomIds?.[0] ?? data.roomId ?? newResModal?.roomId ?? null;
            const roomNumber = data.roomNumbers?.[0] ?? data.roomNumber ?? newResModal?.roomNumber ?? null;
            const matchedRoom = effectiveRooms.find((room) =>
              (roomId && room.id === roomId) || (roomNumber && room.number === roomNumber)
            );
            await createReservation.mutateAsync({
              reference: data.reference ?? `RES-${Date.now().toString().slice(-6)}`,
              guestName: data.guestName || null,
              guestEmail: data.email || null,
              guestPhone: data.phone || null,
              checkIn: data.checkIn,
              checkOut: data.checkOut,
              adults: data.adults ?? 1,
              children: data.children ?? 0,
              source: data.source ?? 'DIRECT',
              totalAmount: data.totalTTC ?? 0,
              notes: data.notes || null,
              roomId,
              roomNumber,
              roomType: data.roomSelections?.[0]?.type || matchedRoom?.type || null,
              roomCategory: matchedRoom?.category ?? null,
              guestId: null,
            });
            setNewResModal(null);
          } catch (err) {
            console.error('[PlanningView] drag-create failed:', err);
            throw err;
          }
        }}
      />
      <EventManagerModal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)}
        initialDate={selectedEventDate || undefined}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #ffffff; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #EEF2F7; border-radius: 10px; border: 2px solid white; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #E2E8F0; }
      `}} />
      </div>
    </div>
  );
};
