import { useEffect, useState } from 'react';
import * as React from 'react';
import {
  Calendar, Users, TrendingUp, BarChart2,
  Search, RefreshCw, Zap, CheckCircle, Clock, AlertTriangle,
  BedDouble, User, CreditCard, ArrowRight, ArrowLeft, FileText,
  Plus, ChevronLeft, ChevronRight, MoreHorizontal, ArrowUpRight, ArrowDownRight,
  Sparkles, X, LogIn, LogOut, Crown, IdCard,
  Mail, Phone, Hash,
  UserRound, Moon, DoorOpen, DoorClosed, Tag, type LucideIcon,
  ArrowRightLeft, Send, Printer, MessageCircle, Layers, Maximize2, Minimize2,
  Smartphone,
} from 'lucide-react';

import { useFlowdayDataset, type FlowdayKpis, type FlowdayRoomRow } from '@/src/domains/flowday/hooks';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import { ReservationModal } from '@/src/components/today/modals/ReservationModal';
import { HousekeepingAssignmentModal } from '@/src/components/today/modals/HousekeepingAssignmentModal';
import { RoomChangeModal } from '@/src/components/today/modals/RoomChangeModal';
import { CommunicationModal } from '@/src/components/today/modals/CommunicationModal';
import { BadgesModal } from '@/src/components/today/modals/BadgesModal';
import { RightSidebar } from '@/src/components/today/RightSidebar';
import type {
  BadgeType, CommunicationChannel, MessageTemplate, ReservationModalState,
  RoomRow, SortKey,
} from '@/src/components/today/types';
import {
  cn, formatReservationDate,
  actionOptions, fillMessageTemplate, getActionSelectValue, getFollowStyle, getSortValue,
  housekeepers, messageTemplates,
} from '@/src/components/today/helpers';

const now = new Date();
const currentDateLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
const currentDateShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
const currentDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const getDateKey = (dateTime: string) => dateTime.split(' ')[0];

// --- MOCK DATA ---
const roomsData: RoomRow[] = [
  {
    id: 1,
    priority: 'Critique',
    room: '101',
    type: 'STD/DLX',
    status: 'Non prête',
    guest: 'Sophie Dubois',
    initials: 'SD',
    reservationId: 'R-10421',
    guestCount: 2,
    etaTime: '14:30',
    etaNote: 'prévu · fenêtre 15h-22h',
    movement: 'arrival',
    nights: 3,
    stayAmount: '1 290 €',
    vip: 'VIP Gold',
    payment: 'Partiel',
    arrival: '2026-04-27 16:00',
    departure: '2026-04-30 11:00',
    source: 'AIRBNB',
    action: 'Lancer ménage',
    taskStatus: 'À faire',
    isGroup: false,
    category: 'Classique',
    adults: 2,
    children: 0,
    nationality: 'FR',
    bookingRef: 'REF: 996363398',
    ratePlan: 'AVBB',
  },
  {
    id: 2,
    priority: 'Élevée',
    room: '105',
    type: 'SUP/SEA',
    status: 'Ménage en cours',
    guest: 'Thomas Leroy',
    initials: 'TL',
    reservationId: 'R-10422',
    guestCount: 1,
    etaTime: '16:45',
    etaNote: 'prévu · fenêtre 15h-22h',
    movement: 'arrival',
    nights: 1,
    stayAmount: '189 €',
    vip: null,
    payment: 'Payé',
    arrival: '2026-04-27 14:00',
    departure: '2026-04-29 11:00',
    source: 'BOOKING.COM',
    action: 'Lancer ménage',
    taskStatus: 'En cours',
    isGroup: true,
    category: 'Vue Mer',
    adults: 1,
    children: 0,
    nationality: 'BE',
    bookingRef: 'REF: 1105457',
    ratePlan: 'RACK',
  },
  {
    id: 3,
    priority: 'Élevée',
    room: '107',
    type: 'STD/DLX',
    status: 'Arrivée < 1h',
    guest: 'Claire Martin',
    initials: 'CM',
    reservationId: 'R-10418',
    guestCount: 2,
    etaTime: '13:00',
    etaNote: 'prévu · fenêtre 15h-22h',
    movement: 'arrival',
    nights: 5,
    stayAmount: '1 450 €',
    vip: 'VIP Gold',
    payment: 'En attente',
    arrival: '2026-04-27 14:30',
    departure: '2026-04-28 11:00',
    source: 'DIRECT',
    action: 'Inspection',
    taskStatus: 'À faire',
    isGroup: false,
  },
  {
    id: 4,
    priority: 'Moyenne',
    room: '102',
    type: 'SUP/SEA',
    status: 'Occupée',
    guest: 'Arathew Smith',
    initials: 'AS',
    reservationId: 'R-10401',
    guestCount: 2,
    etaTime: '10:30',
    etaNote: 'prévu · avant 11h',
    movement: 'inhouse',
    nights: 2,
    stayAmount: '420 €',
    vip: null,
    payment: 'Payé',
    arrival: '2026-04-26 15:00',
    departure: '2026-04-27 11:00',
    source: 'BOOKING.COM',
    action: 'Refus de service',
    taskStatus: 'Validé',
    isGroup: false,
  },
  {
    id: 5,
    priority: 'Faible',
    room: '202',
    type: 'STD/DLX',
    status: 'Check-out fait',
    guest: 'Nathalie B.',
    initials: 'NB',
    reservationId: 'R-10399',
    guestCount: 2,
    etaTime: '11:45',
    etaNote: 'prévu · avant 11h',
    movement: 'departure',
    nights: 4,
    stayAmount: '3 680 €',
    vip: 'VIP Gold',
    payment: 'Payé',
    arrival: '2026-04-27 10:30',
    departure: '2026-04-27 10:30',
    source: 'DIRECT',
    action: 'Inspection',
    taskStatus: 'Validé',
    isGroup: true,
  },
];

// RoomRow type is now imported from '@/src/components/today/types'


// --- COMPONENTS ---
// (Dead `Sidebar` + `Header` inline mocks removed — Real layout lives in /components/layout)

const KpiCard = ({ title, subtitle, highlight, icon: Icon, colorClass, bgColorClass, detailText }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl", bgColorClass, colorClass)}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-md cursor-pointer hover:bg-purple-100 transition-colors">
        DÉTAILS
      </span>
    </div>
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-gray-500">{subtitle}</span>
        {highlight && (
          <>
            <span className="text-gray-300">•</span>
            <span className={cn("font-medium", colorClass)}>{highlight}</span>
          </>
        )}
        {detailText && (
          <>
            <span className="text-gray-300">•</span>
            <span className="font-medium text-gray-700">{detailText}</span>
          </>
        )}
      </div>
    </div>
  </div>
);

const timelineArrivals = [
  { left: '20%', count: 2, items: ['101 - Sophie Dubois', '105 - Thomas Leroy'] },
  { left: '50%', count: 3, items: ['107 - Claire Martin', '203 - Laura Chen', '204 - Pierre Moreau'] },
  { left: '80%', count: 2, items: ['301 - Marco Rinaldi', '302 - Karim Haddad'] },
  { left: '95%', count: 1, items: ['305 - Yuki Tanaka'] },
];

const timelineDepartures = [
  { left: '15%', count: 3, items: ['102 - Arathew Smith', '202 - Nathalie B.', '208 - Emma Petit'] },
  { left: '45%', count: 2, items: ['110 - Robert King', '210 - Ines Morel'] },
  { left: '65%', count: 1, items: ['117 - Luca Rossi'] },
  { left: '80%', count: 2, items: ['401 - Amelia Green', '402 - Hugo Blanc'] },
];

const TimelineBubble: React.FC<{ event: { left: string; count: number; items: string[] }; tone: 'arrival' | 'departure' }> = ({ event, tone }) => (
  <div className="group absolute top-1/2 z-20 -translate-y-1/2" style={{ left: event.left }}>
    <div className={cn(
      'flex h-7 w-7 -translate-x-1/2 cursor-default items-center justify-center rounded-full border-2 bg-white text-xs font-bold shadow-sm transition-transform group-hover:scale-110',
      tone === 'arrival' ? 'border-green-500 text-green-600' : 'border-red-400 text-red-500'
    )}>{event.count}</div>
    <div className="pointer-events-none absolute bottom-10 left-1/2 hidden w-56 -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-2xl group-hover:block">
      <div className={cn('mb-2 text-xs font-bold uppercase tracking-wide', tone === 'arrival' ? 'text-green-600' : 'text-red-500')}>
        {tone === 'arrival' ? 'Arrivées' : 'Départs'}
      </div>
      <div className="space-y-2">
        {event.items.map((item) => {
          const [room, guest] = item.split(' - ');
          return (
            <div key={item} className="flex items-center justify-between gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">Ch. {room}</span>
              <span className="truncate font-medium text-slate-600">{guest}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const Timeline = ({ onHide }: { onHide: () => void }) => {
  const hours = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-x-auto relative">
      <div className="flex justify-between items-center mb-6 sticky left-0">
        <h3 className="text-gray-500 font-medium text-sm">Timeline du jour</h3>
        <button onClick={onHide} className="text-xs text-gray-400 hover:text-gray-600 flex items-center"><X size={14} className="mr-1"/> Masquer</button>
      </div>
      
      <div className="min-w-[800px] relative pb-4">
        {/* Header Hours */}
        <div className="flex ml-32 border-b border-gray-50 pb-2 mb-6">
          {hours.map((h, i) => (
            <div key={i} className="flex-1 text-center text-xs text-gray-400 font-medium">{h}</div>
          ))}
        </div>

        {/* Arrivées Row */}
        <div className="flex items-center mb-8 relative">
          <div className="w-32 shrink-0 flex items-center space-x-2 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
            <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600"><ArrowRight size={14} /></div>
            <span>ARRIVÉES</span>
          </div>
          <div className="flex-1 flex relative h-8">
             {timelineArrivals.map((event) => <TimelineBubble key={event.left} event={event} tone="arrival" />)}
          </div>
        </div>

        {/* Départs Row */}
        <div className="flex items-center mb-8 relative">
          <div className="w-32 shrink-0 flex items-center space-x-2 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
            <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500"><ArrowLeft size={14} /></div>
            <span>DÉPARTS</span>
          </div>
          <div className="flex-1 flex relative h-8">
             {timelineDepartures.map((event) => <TimelineBubble key={event.left} event={event} tone="departure" />)}
          </div>
        </div>

        {/* Ménage Row */}
        <div className="flex items-center relative">
          <div className="w-32 shrink-0 flex items-center space-x-2 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><Sparkles size={14} /></div>
            <span>MÉNAGE</span>
          </div>
          <div className="flex-1 flex relative h-8 items-center space-x-4">
             <div className="h-8 bg-blue-50/50 rounded-full flex-1 flex items-center justify-center text-xs text-blue-600 border border-blue-100/50">Charge modérée</div>
             <div className="h-8 bg-purple-50/50 rounded-full flex-1 flex items-center justify-center text-xs text-purple-600 border border-purple-100/50">Pic de charge</div>
             <div className="h-8 bg-blue-50/50 rounded-full flex-1 flex items-center justify-center text-xs text-blue-600 border border-blue-100/50">Charge modérée</div>
          </div>
        </div>

        {/* Current Time Indicator */}
        <div className="absolute top-0 bottom-0 left-[75%] border-l-2 border-dashed border-purple-400 z-0">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            MAINTENANT
          </div>
        </div>

        {/* Tooltip/Summary floating box - visual only for demo */}
        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 p-4 w-48 z-20">
           <h4 className="text-xs text-gray-400 font-medium mb-3">Résumé</h4>
           <div className="space-y-2 text-sm">
             <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>Arrivées</span><span className="font-semibold">8</span></div>
             <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>Départs</span><span className="font-semibold">8</span></div>
             <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></span>Ménages prévus</span><span className="font-semibold">16</span></div>
             <div className="pt-2 mt-2 border-t border-gray-50 flex justify-between items-center"><span className="text-gray-500">Chambres dispo</span><span className="font-semibold text-green-600">42</span></div>
           </div>
        </div>
      </div>
    </div>
  );
};

// ReservationModalState, ModalTab, SortKey types now imported from '@/src/components/today/types'

const avatarPalette = [
  'bg-amber-500 text-white',
  'bg-violet-500 text-white',
  'bg-slate-900 text-white',
  'bg-indigo-500 text-white',
  'bg-emerald-500 text-white',
];

const TableHeaderIcon = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
  <span title={label} aria-label={label} className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100/70 text-gray-400">
    <Icon size={16} strokeWidth={1.9} />
  </span>
);

const SortHeader = ({ icon, label, sortKey, activeSort, onSort, align = 'center' }: { icon: LucideIcon; label: string; sortKey: SortKey; activeSort: SortKey | null; onSort: (key: SortKey) => void; align?: 'left' | 'center' | 'right' }) => (
  <button
    type="button"
    onClick={() => onSort(sortKey)}
    className={cn('inline-flex w-full items-center', align === 'center' && 'justify-center', align === 'right' && 'justify-end', align === 'left' && 'justify-start')}
    title={`${label} - trier / réinitialiser`}
  >
    <span className={cn('rounded-xl transition-all', activeSort === sortKey && 'ring-2 ring-violet-400 ring-offset-2')}>
      <TableHeaderIcon icon={icon} label={label} />
    </span>
  </button>
);

const ClientIdentity = ({ row, index, onClick }: { row: RoomRow; index: number; onClick?: () => void }) => (
  <button onClick={onClick} className="flex min-w-0 items-center gap-2 text-left hover:opacity-80 transition-opacity">
    <div className={cn('h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold shadow-sm', avatarPalette[index % avatarPalette.length])}>
      {row.initials}
    </div>
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-gray-950">{row.guest}</span>
        {row.vip && <Crown size={15} className="text-amber-500 shrink-0" strokeWidth={2.2} />}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400 font-medium">
        <span>{row.reservationId}</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span className="inline-flex items-center gap-1"><Users size={13} />{row.guestCount}</span>
      </div>
    </div>
  </button>
);

const EtaEtdCell = ({ row }: { row: RoomRow }) => {
  const isArrival = row.movement === 'arrival';
  const isDepartureToday = row.movement === 'departure';

  if (!isArrival && !isDepartureToday) {
    return <span className="text-sm font-semibold text-slate-300">-</span>;
  }

  return (
    <div className={cn('min-w-0', isArrival ? 'text-emerald-700' : 'text-rose-500')}>
      <div className="flex items-center gap-1.5 font-bold text-base leading-none">
        {isArrival ? <ArrowDownRight size={16} strokeWidth={2.3} /> : <ArrowUpRight size={16} strokeWidth={2.3} />}
        <span>{row.etaTime}</span>
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-400 font-medium">{row.etaNote}</p>
    </div>
  );
};

const DateCell = ({ value, type }: { value: string; type: 'arrival' | 'departure' }) => (
  <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-gray-950">
    {type === 'arrival' ? <LogIn size={15} strokeWidth={2.2} /> : <LogOut size={15} strokeWidth={2.2} />}
    <span className="truncate">{formatReservationDate(value)}</span>
  </div>
);

const StayCell = ({ row }: { row: RoomRow }) => (
  <div className="min-w-0 text-right">
    <div className="truncate text-sm font-bold text-gray-950">{row.nights} nuit{row.nights > 1 ? 's' : ''}</div>
    <div className="mt-1 truncate text-[11px] text-slate-400 font-medium">{row.stayAmount}</div>
  </div>
);



const OperationsTable = ({ initialRooms }: { initialRooms?: RoomRow[] }) => {
  const [rooms, setRooms] = useState<RoomRow[]>(initialRooms ?? roomsData);
  // Sync local state when the live dataset reference changes (length-based to avoid loops)
  const liveLength = initialRooms?.length ?? 0;
  useEffect(() => {
    if (initialRooms && initialRooms.length > 0) {
      setRooms(initialRooms);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLength]);
  const [reservationModal, setReservationModal] = useState<ReservationModalState | null>(null);
  const [roomChangeModal, setRoomChangeModal] = useState<RoomRow | null>(null);
  const [communicationModal, setCommunicationModal] = useState<RoomRow | null>(null);
  const [badgesModal, setBadgesModal] = useState<RoomRow | null>(null);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState<SortKey | null>(null);
  const [flowFilter, setFlowFilter] = useState<'all' | 'arrival' | 'departure' | 'inhouse' | 'group'>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [cleaningFilter, setCleaningFilter] = useState('all');
  const [openMenuRowId, setOpenMenuRowId] = useState<number | null>(null);
  const [isExtendedView, setIsExtendedView] = useState(false);

  const openReservation = (row: RoomRow) => {
    setReservationModal({ row, mode: row.movement === 'departure' ? 'departure' : 'arrival' });
  };

  const closeMenu = () => setOpenMenuRowId(null);

  const toggleSort = (key: SortKey) => {
    setActiveSort((current) => current === key ? null : key);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const updateRoom = (roomId: number, updater: (row: RoomRow) => Partial<RoomRow>) => {
    setRooms((current) => current.map((row) => row.id === roomId ? { ...row, ...updater(row) } : row));
  };

  const handleReservationValidation = (state: ReservationModalState) => {
    if (state.mode === 'arrival' && getDateKey(state.row.arrival) === currentDateKey) {
      const sameDayDeparture = rooms.find((row) => row.id !== state.row.id && row.room === state.row.room && row.movement === 'departure' && getDateKey(row.departure) === currentDateKey);
      const liveArrival = rooms.find((row) => row.id === state.row.id) ?? state.row;

      if (sameDayDeparture && sameDayDeparture.status !== 'Propre') {
        showToast(`Check-in impossible : le check-out de la chambre ${state.row.room} doit être fait et la chambre propre.`);
        return;
      }

      if (liveArrival.status !== 'Propre' && sameDayDeparture) {
        showToast(`Check-in impossible : la chambre ${state.row.room} doit être en statut propre.`);
        return;
      }
    }

    updateRoom(state.row.id, () => state.mode === 'arrival'
      ? { movement: 'inhouse', status: 'Occupée', action: 'Inspection', taskStatus: 'À faire' }
      : { status: 'Propre', taskStatus: 'Validé', action: 'Demande Inspection' }
    );
    setReservationModal(null);
    showToast(state.mode === 'arrival' ? `Check-in validé pour ${state.row.guest}` : `Check-out validé pour ${state.row.guest}`);
  };

  const handleRoomChange = (row: RoomRow, destinationRoom: string) => {
    updateRoom(row.id, () => ({ room: destinationRoom }));
    setRoomChangeModal(null);
    showToast(`${row.guest} a été délogé de la chambre ${row.room} vers ${destinationRoom}`);
  };

  const handleBadgesSave = (row: RoomRow, badges: BadgeType[]) => {
    updateRoom(row.id, () => ({ badges, vip: badges.includes('vip') ? 'VIP Gold' : null }));
    setBadgesModal(null);
    showToast(`Badges mis à jour pour ${row.guest}`);
  };

  const handleMessageSent = (row: RoomRow, channel: CommunicationChannel) => {
    setCommunicationModal(null);
    showToast(`${channel === 'email' ? 'Email' : 'WhatsApp'} envoyé à ${row.guest}`);
  };

  const toggleRoomSelection = (roomId: number) => {
    setSelectedRoomIds((current) => current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId]);
  };

  const openAssignmentModal = () => {
    if (selectedRoomIds.length === 0) {
      showToast('Sélectionnez au moins une chambre à assigner.');
      return;
    }
    setAssignmentModalOpen(true);
  };

  const handleAssignRooms = (housekeeper: string) => {
    setRooms((current) => current.map((row) => selectedRoomIds.includes(row.id) ? { ...row, assignedTo: housekeeper, taskStatus: row.taskStatus === 'Validé' ? row.taskStatus : 'À faire' } : row));
    showToast(`${selectedRoomIds.length} chambre(s) assignée(s) à ${housekeeper}`);
    setSelectedRoomIds([]);
    setAssignmentModalOpen(false);
  };

  const handleActionChange = (row: RoomRow, action: string) => {
    updateRoom(row.id, () => {
      if (action === 'Lancer le ménage') return { action, status: 'Ménage en cours', taskStatus: 'En cours' };
      if (action === 'Demande Inspection') return { action, taskStatus: 'À valider' };
      if (action === 'Refus de service') return { action, taskStatus: 'Validé' };
      return { action, status: 'Bloquée', taskStatus: 'À faire', priority: 'Critique' };
    });
    showToast(`Action mise à jour pour la chambre ${row.room}`);
  };

  const handleQuickReservation = () => {
    const nextId = Math.max(...rooms.map((row) => row.id)) + 1;
    const nextRoom = `${300 + nextId}`;
    setRooms((current) => [
      ...current,
      {
        ...roomsData[0],
        id: nextId,
        priority: 'Moyenne',
        room: nextRoom,
        status: 'Arrivée < 1h',
        guest: `Walk-in ${nextId}`,
        initials: 'WI',
        reservationId: `R-10${430 + nextId}`,
        etaTime: '18:20',
        movement: 'arrival',
        nights: 1,
        stayAmount: '210 €',
        vip: null,
        payment: 'En attente',
        source: 'DIRECT',
        action: 'Inspection',
        taskStatus: 'À faire',
        badges: ['nouveau'],
      }
    ]);
    showToast(`Nouvelle réservation créée en chambre ${nextRoom}`);
  };

  const arrivalCount = rooms.filter((row) => row.movement === 'arrival').length;
  const departureCount = rooms.filter((row) => row.movement === 'departure').length;
  const inhouseCount = rooms.filter((row) => row.movement === 'inhouse').length;
  const groupCount = rooms.filter((row) => row.isGroup).length;

  const totalAdults = rooms.reduce((sum, row) => sum + (row.adults || 0), 0);
  const totalChildren = rooms.reduce((sum, row) => sum + (row.children || 0), 0);
  const totalVips = rooms.filter(row => row.vip).length;

  const cleaningMatches = (row: RoomRow) => {
    if (cleaningFilter === 'all') return true;
    if (cleaningFilter === 'dirty') return row.status === 'Non prête';
    if (cleaningFilter === 'cleaning') return row.status === 'Ménage en cours';
    if (cleaningFilter === 'todo') return row.taskStatus === 'À faire';
    if (cleaningFilter === 'inprogress') return row.taskStatus === 'En cours';
    if (cleaningFilter === 'tovalidate') return row.taskStatus === 'À valider';
    if (cleaningFilter === 'done') return row.taskStatus === 'Validé';
    return true;
  };

  const filteredRows = rooms.filter((row) => {
    const flowMatches = flowFilter === 'all' || 
                        (flowFilter === 'group' ? row.isGroup : row.movement === flowFilter);
    const sourceMatches = sourceFilter === 'all' || row.source === sourceFilter;
    const paymentMatches = paymentFilter === 'all' || row.payment === paymentFilter;
    const searchMatches = !searchQuery.trim() || [row.guest, row.room, row.reservationId, row.source, row.status]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return flowMatches && sourceMatches && paymentMatches && searchMatches && cleaningMatches(row);
  });

  const visibleRows = activeSort
    ? [...filteredRows].sort((a, b) => {
      const valueA = getSortValue(a, activeSort);
      const valueB = getSortValue(b, activeSort);
      if (typeof valueA === 'number' && typeof valueB === 'number') return valueA - valueB;
      return String(valueA).localeCompare(String(valueB), 'fr', { sensitivity: 'base' });
    })
    : filteredRows;

  const selectedRooms = rooms.filter((row) => selectedRoomIds.includes(row.id));
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedRoomIds.includes(row.id));

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 text-gray-700 font-medium px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
              <Calendar size={16} className="text-gray-400" />
              <span>{currentDateShort}</span>
            </div>
            <div className="relative flex-1 max-w-md rounded-xl border border-gray-200 bg-gray-100/70 shadow-inner shadow-white/60">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="text" placeholder="Nom, chambre..." className="w-full pl-9 pr-4 py-2 border-none bg-transparent text-sm focus:outline-none placeholder-gray-400" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20">
              <option value="all">Toutes sources</option>
              <option value="BOOKING.COM">Booking</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="DIRECT">Direct</option>
              <option value="AIRBNB">Airbnb</option>
            </select>
            <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20">
              <option value="all">Tous paiements</option>
              <option value="Payé">Payé</option>
              <option value="Partiel">Partiel</option>
              <option value="En attente">En attente</option>
            </select>
            <select value={cleaningFilter} onChange={(event) => setCleaningFilter(event.target.value)} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20">
              <option value="all">Tous ménages</option>
              <option value="dirty">Non prête</option>
              <option value="cleaning">Ménage en cours</option>
              <option value="todo">À faire</option>
              <option value="inprogress">En cours</option>
              <option value="tovalidate">À valider</option>
              <option value="done">Validé</option>
            </select>

            <div className="flex items-center gap-2 pl-4 border-l border-gray-100">
              <button 
                onClick={() => setIsExtendedView(!isExtendedView)} 
                title={isExtendedView ? "Vue Standard" : "Extension d'info"}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition-all",
                  isExtendedView ? "bg-violet-600 text-white shadow-lg shadow-violet-200" : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                )}
              >
                <Layers size={16} />
                <span className="hidden sm:inline uppercase">Ext. Info</span>
                <div className={cn("h-4 w-8 rounded-full p-0.5 transition-colors", isExtendedView ? "bg-white/20" : "bg-violet-200")}>
                  <div className={cn("h-3 w-3 rounded-full bg-white transition-transform", isExtendedView ? "translate-x-4" : "translate-x-0")} />
                </div>
              </button>

              <div className="flex items-center rounded-2xl bg-gray-50 p-1 shadow-inner shadow-gray-100/70">
                <button onClick={() => setFlowFilter('all')} className={cn('rounded-xl px-4 py-2 text-sm font-bold transition-all', flowFilter === 'all' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-400 hover:text-gray-700')}>Tous</button>
                <button onClick={() => setFlowFilter('arrival')} title="Filtrer les arrivées" className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all', flowFilter === 'arrival' ? 'bg-white shadow-sm' : 'hover:bg-white/70')}>
                  <LogIn size={19} className="text-emerald-600" strokeWidth={2.3} />
                  <span className={cn(flowFilter === 'arrival' ? 'text-emerald-600' : 'text-gray-400')}>{arrivalCount}</span>
                </button>
                <button onClick={() => setFlowFilter('departure')} title="Filtrer les départs" className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all', flowFilter === 'departure' ? 'bg-white shadow-sm' : 'hover:bg-white/70')}>
                  <LogOut size={19} className="text-rose-500" strokeWidth={2.3} />
                  <span className={cn(flowFilter === 'departure' ? 'text-rose-500' : 'text-gray-400')}>{departureCount}</span>
                </button>
                <button onClick={() => setFlowFilter('inhouse')} title="Filtrer les recouches" className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all', flowFilter === 'inhouse' ? 'bg-white shadow-sm' : 'hover:bg-white/70')}>
                  <DoorClosed size={19} className="text-blue-500" strokeWidth={2.3} />
                  <span className={cn(flowFilter === 'inhouse' ? 'text-blue-500' : 'text-gray-400')}>{inhouseCount}</span>
                </button>
                <button onClick={() => setFlowFilter('group')} title="Filtrer les groupes" className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all', flowFilter === 'group' ? 'bg-white shadow-sm' : 'hover:bg-white/70')}>
                  <Users size={19} className="text-orange-500" strokeWidth={2.3} />
                  <span className={cn(flowFilter === 'group' ? 'text-orange-500' : 'text-gray-400')}>{groupCount}</span>
                </button>
              </div>
              <button onClick={openAssignmentModal} title="Assigner les chambres sélectionnées" className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50 text-pink-500 shadow-sm shadow-pink-200/50 transition-colors hover:bg-pink-100">
                <Users size={19} strokeWidth={2.3} />
                {selectedRoomIds.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black text-white">{selectedRoomIds.length}</span>}
              </button>
              <button onClick={handleQuickReservation} className="h-10 w-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-sm shadow-purple-600/30 hover:bg-purple-700 transition-colors"><Plus size={20} /></button>
            </div>
          </div>
        </div>

        <div className="flex gap-4 w-full overflow-visible">
          <div className="flex-1 overflow-visible">
            <table className="w-full table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[2.5%]" />
                {isExtendedView ? (
                  <>
                    <col className="w-[4%]" />
                    <col className="w-[13%]" />
                    <col className="w-[8%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[4%]" />
                    <col className="w-[4%]" />
                    <col className="w-[5%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                  </>
                ) : (
                  <>
                    <col className="w-[4.5%]" />
                    <col className="w-[4.5%]" />
                    <col className="w-[6.5%]" />
                    <col className="w-[15%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[8.5%]" />
                    <col className="w-[5.5%]" />
                    <col className="w-[5%]" />
                    <col className="w-[5%]" />
                    <col className="w-[5.5%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[5%]" />
                  </>
                )}
                <col className="w-[1.5%]" />
              </colgroup>
              <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="px-2 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={() => { const visibleIds = visibleRows.map((row) => row.id); setSelectedRoomIds(allVisibleSelected ? [] : visibleIds); if(!allVisibleSelected && visibleIds.length > 0) setAssignmentModalOpen(true); }} className="rounded border-gray-300 text-purple-600 focus:ring-purple-600" /></th>
                  {isExtendedView ? (
                    <>
                      <th className="px-1 py-3 text-center font-black text-[10px]">CH.</th>
                      <th className="px-1 py-3 font-black text-[10px]">NOM</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">CAT.</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">ARR.</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">DÉP.</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">AD.</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">ENF.</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">NAT.</th>
                      <th className="px-1 py-3 font-black text-[10px]">REF.</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">SOURCE</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">TARIF</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">MONTANT</th>
                      <th className="px-1 py-3 text-center font-black text-[10px]">PAIEMENT</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-3 text-center"><SortHeader icon={AlertTriangle} label="Priorité" sortKey="priority" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={BedDouble} label="Chambre" sortKey="room" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={RefreshCw} label="Statut chambre" sortKey="status" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3"><SortHeader icon={UserRound} label="Client" sortKey="guest" activeSort={activeSort} onSort={toggleSort} align="left" /></th>
                      <th className="px-2 py-3"><SortHeader icon={LogIn} label="Date d'arrivée" sortKey="arrival" activeSort={activeSort} onSort={toggleSort} align="left" /></th>
                      <th className="px-2 py-3"><SortHeader icon={LogOut} label="Date de départ" sortKey="departure" activeSort={activeSort} onSort={toggleSort} align="left" /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={Clock} label="ETA / ETD" sortKey="eta" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-right"><SortHeader icon={Moon} label="Séjour" sortKey="nights" activeSort={activeSort} onSort={toggleSort} align="right" /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={CreditCard} label="Paiement" sortKey="payment" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={Smartphone} label="Canal" sortKey="source" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={DoorOpen} label="Check-in / Check-out" sortKey="movement" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={Zap} label="Action métier" sortKey="action" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={User} label="Assignée" sortKey="assignedTo" activeSort={activeSort} onSort={toggleSort} /></th>
                      <th className="px-2 py-3 text-center"><SortHeader icon={FileText} label="Suivi" sortKey="taskStatus" activeSort={activeSort} onSort={toggleSort} /></th>
                    </>
                  )}
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {visibleRows.map((row, index) => {
                  const isArrival = row.movement === 'arrival';
                  const isDeparture = row.movement === 'departure';

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-2 py-3"><input type="checkbox" checked={selectedRoomIds.includes(row.id)} onChange={() => toggleRoomSelection(row.id)} className="rounded border-gray-300 text-purple-600 focus:ring-purple-600" /></td>
                      
                      {isExtendedView ? (
                        <>
                          <td className="px-1 py-3 text-center font-black text-sm tracking-tighter text-slate-900">{row.room}</td>
                          <td className="px-1 py-3 font-bold truncate max-w-[140px] text-xs uppercase text-slate-800">{row.guest}</td>
                          <td className="px-1 py-3 text-center text-[10px] text-slate-400 font-extrabold uppercase">{row.category || row.type}</td>
                          <td className="px-1 py-3 text-center text-xs font-black text-slate-900">{formatReservationDate(row.arrival).slice(0, 5)}</td>
                          <td className="px-1 py-3 text-center text-xs font-black text-slate-900">{formatReservationDate(row.departure).slice(0, 5)}</td>
                          <td className="px-1 py-3 text-center font-black text-slate-900">{row.adults || row.guestCount}</td>
                          <td className="px-1 py-3 text-center font-black text-slate-300">{row.children ?? 0}</td>
                          <td className="px-1 py-3 text-center text-lg">{row.nationality === 'BE' ? '🇧🇪' : row.nationality === 'GB' ? '🇬🇧' : row.nationality === 'US' ? '🇺🇸' : row.nationality === 'DE' ? '🇩🇪' : row.nationality === 'IT' ? '🇮🇹' : row.nationality === 'ES' ? '🇪🇸' : '🇫🇷'}</td>
                          <td className="px-1 py-3 text-[11px] truncate max-w-[120px] text-violet-600 font-black">{row.bookingRef || row.reservationId}</td>
                          <td className="px-1 py-3 text-center">
                            <span className={cn('rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white', row.source === 'AIRBNB' ? 'bg-[#FF5A5F]' : row.source === 'BOOKING.COM' ? 'bg-[#003580]' : row.source === 'EXPEDIA' ? 'bg-yellow-500' : row.source === 'AGODA' ? 'bg-sky-600' : 'bg-emerald-500')}>
                              {row.source === 'BOOKING.COM' ? 'BOOKING' : row.source}
                            </span>
                          </td>
                          <td className="px-1 py-3 text-center font-mono font-black text-slate-700">{row.ratePlan || 'RACK'}</td>
                          <td className="px-1 py-3 text-center font-mono font-black text-slate-900">{row.stayAmount}</td>
                          <td className="px-1 py-3 text-center"><span className={cn('rounded px-2 py-0.5 text-[9px] font-black uppercase', row.payment === 'Payé' ? 'bg-emerald-50 text-emerald-600' : row.payment === 'Partiel' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600')}>{row.payment}</span></td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-3 text-center">
                            <span className={cn('inline-block max-w-full truncate rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide', row.priority === 'Critique' && 'bg-red-50 text-red-600', row.priority === 'Élevée' && 'bg-orange-50 text-orange-600', row.priority === 'Moyenne' && 'bg-blue-50 text-blue-600', row.priority === 'Faible' && 'bg-green-50 text-green-600')}>{row.priority}</span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button onClick={() => openReservation(row)} className={cn(
                              "inline-flex items-center justify-center rounded-full px-4 py-1 text-xl font-extrabold tracking-tighter shadow-sm",
                              row.status === 'Bloquée' ? "bg-slate-200 text-slate-600" :
                              row.status === 'Non prête' ? "bg-red-100 text-red-600" :
                              row.status === 'Ménage en cours' ? "bg-orange-100 text-orange-600" :
                              row.status === 'Check-out fait' ? "bg-emerald-100 text-emerald-700" :
                              "bg-emerald-100 text-emerald-700",
                              "hover:scale-105 transition-transform"
                            )}>
                              {row.room}
                            </button>
                            <div className="mt-1 text-[10px] text-gray-400 font-medium">{row.type}</div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex min-w-0 items-center space-x-2">
                              <span className={cn('w-1.5 h-1.5 rounded-full', row.status.includes('Bloquée') ? 'bg-slate-500' : row.status.includes('Non prête') ? 'bg-red-500' : row.status.includes('Ménage en cours') ? 'bg-orange-500' : row.status.includes('Arrivée') ? 'bg-yellow-500' : row.status.includes('Occupée') ? 'bg-blue-500' : 'bg-green-500')}></span>
                              <span className={cn('truncate font-medium text-xs', row.status.includes('Bloquée') ? 'text-slate-500' : row.status.includes('Non prête') ? 'text-red-600' : row.status.includes('Ménage en cours') ? 'text-orange-600' : row.status.includes('Arrivée') ? 'text-yellow-600' : row.status.includes('Occupée') ? 'text-blue-600' : 'text-green-600')}>{row.status}</span>
                            </div>
                          </td>
                          <td className="px-2 py-3"><ClientIdentity row={row} index={index} onClick={() => openReservation(row)} /></td>
                          <td className="px-2 py-3"><DateCell value={row.arrival} type="arrival" /></td>
                          <td className="px-2 py-3"><DateCell value={row.departure} type="departure" /></td>
                          <td className="px-2 py-3"><EtaEtdCell row={row} /></td>
                          <td className="px-2 py-3"><StayCell row={row} /></td>
                          <td className="px-2 py-3 text-center">
                            <span className={cn('text-xs font-semibold', row.payment === 'Payé' ? 'text-green-500' : row.payment === 'Partiel' ? 'text-orange-500' : 'text-red-500')}>{row.payment}</span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className={cn('inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[8px] font-bold text-white tracking-wider', row.source === 'AIRBNB' ? "bg-[#FF5A5F]" : row.source === 'BOOKING.COM' ? "bg-[#003580]" : "bg-green-500")}>{row.source}</span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            {isArrival || isDeparture ? (
                              <button onClick={() => openReservation(row)} title={isArrival ? 'Ouvrir le check-in' : 'Ouvrir la facturation'} className={cn('mx-auto flex h-10 w-10 items-center justify-center rounded-2xl transition-all hover:scale-105 active:scale-95', isArrival ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-500 hover:bg-rose-100')}>
                                {isArrival ? <LogIn size={21} strokeWidth={2.2} /> : <LogOut size={21} strokeWidth={2.2} />}
                              </button>
                            ) : (
                              <span title="Client en recouche" className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-500"><DoorClosed size={21} strokeWidth={2.2} /></span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <select value={getActionSelectValue(row.action)} onChange={(event) => handleActionChange(row, event.target.value)} className="w-full min-w-0 rounded-lg border border-purple-100 bg-purple-50 px-2 py-1.5 text-[11px] font-semibold text-purple-600 outline-none transition-colors hover:bg-purple-100">
                              {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className={cn('inline-block max-w-full truncate rounded-md px-2 py-1 text-[10px] font-semibold', row.assignedTo ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400')}>
                              {row.assignedTo ?? 'Non assignée'}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className={cn('inline-block max-w-full truncate rounded-md px-2 py-1 text-[10px] font-semibold', getFollowStyle(row.taskStatus))}>{row.taskStatus}</span>
                          </td>
                        </>
                      )}
                      <td className="px-2 py-3 text-center relative">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuRowId(openMenuRowId === row.id ? null : row.id); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"><MoreHorizontal size={18} /></button>
                        {openMenuRowId === row.id && (
                          <div className="absolute right-0 top-full z-[120] mt-1 w-56 rounded-2xl border border-gray-100 bg-white py-2 shadow-2xl">
                            <button onClick={() => { setRoomChangeModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ArrowRightLeft size={16} /></div><div><div className="font-semibold">Changement de chambre</div><div className="text-xs text-gray-400">Déloger le client</div></div></button>
                            <button onClick={() => { setCommunicationModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Send size={16} /></div><div><div className="font-semibold">Communication client</div><div className="text-xs text-gray-400">Email / WhatsApp</div></div></button>
                            <button onClick={() => { setBadgesModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Tag size={16} /></div><div><div className="font-semibold">Gérer les badges</div><div className="text-xs text-gray-400">VIP, Fidèle, etc.</div></div></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="hidden">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-2">Résumé</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500">Chambres</span><span className="text-lg font-black text-violet-600">{visibleRows.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500">Adultes</span><span className="text-lg font-black text-slate-900">{totalAdults}</span></div>
                <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500">Enfants</span><span className="text-lg font-black text-slate-900">{totalChildren}</span></div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50"><span className="text-[11px] font-bold text-slate-500">Personnes</span><span className="text-lg font-black text-slate-900">{totalAdults + totalChildren}</span></div>
                <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500">VIP</span><span className="text-lg font-black text-amber-500">{totalVips}</span></div>
              </div>
            </div>
            <div className="rounded-2xl bg-violet-600 p-5 text-white shadow-lg shadow-violet-200">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Status</div>
              <div className="mt-1 text-2xl font-black">OPÉRATIONNEL</div>
            </div>
          </div>
        </div>
        {isExtendedView && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:grid-cols-4">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><BedDouble size={18} /></div><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chambres</div><div className="text-xl font-black text-slate-900">{visibleRows.length}</div></div></div>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserRound size={18} /></div><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adultes</div><div className="text-xl font-black text-slate-900">{totalAdults}</div></div></div>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Users size={18} /></div><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Enfants</div><div className="text-xl font-black text-slate-900">{totalChildren}</div></div></div>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500"><Crown size={18} /></div><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">VIP</div><div className="text-xl font-black text-slate-900">{totalVips}</div></div></div>
          </div>
        )}

        <div className="hidden">
          <div className="flex-1 overflow-visible">
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col className="w-[2.5%]" />
              <col className="w-[4.5%]" />
              <col className="w-[4.5%]" />
              <col className="w-[6.5%]" />
              <col className="w-[15%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[8.5%]" />
              <col className="w-[5.5%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[5.5%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[5%]" />
              <col className="w-[1.5%]" />
            </colgroup>
            <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100">
              <tr>
                <th className="px-2 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={() => { const visibleIds = visibleRows.map((row) => row.id); setSelectedRoomIds(allVisibleSelected ? [] : visibleIds); if(!allVisibleSelected && visibleIds.length > 0) setAssignmentModalOpen(true); }} className="rounded border-gray-300 text-purple-600 focus:ring-purple-600" /></th>
                {isExtendedView ? (
                  <>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">CH.</th>
                    <th className="px-1 py-3 font-bold text-[10px]">NOM</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">CAT.</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">ARR.</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">DÉP.</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">AD.</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">ENF.</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">NAT.</th>
                    <th className="px-1 py-3 font-bold text-[10px]">COM / REF</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">STAT.</th>
                    <th className="px-1 py-3 text-center font-bold text-[10px]">TARIF</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-3 text-center"><SortHeader icon={AlertTriangle} label="Priorité" sortKey="priority" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={BedDouble} label="Chambre" sortKey="room" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={RefreshCw} label="Statut chambre" sortKey="status" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3"><SortHeader icon={UserRound} label="Client" sortKey="guest" activeSort={activeSort} onSort={toggleSort} align="left" /></th>
                    <th className="px-2 py-3"><SortHeader icon={LogIn} label="Date d'arrivée" sortKey="arrival" activeSort={activeSort} onSort={toggleSort} align="left" /></th>
                    <th className="px-2 py-3"><SortHeader icon={LogOut} label="Date de départ" sortKey="departure" activeSort={activeSort} onSort={toggleSort} align="left" /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={Clock} label="ETA / ETD" sortKey="eta" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-right"><SortHeader icon={Moon} label="Séjour" sortKey="nights" activeSort={activeSort} onSort={toggleSort} align="right" /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={CreditCard} label="Paiement" sortKey="payment" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={Smartphone} label="Canal" sortKey="source" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={DoorOpen} label="Check-in / Check-out" sortKey="movement" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={Zap} label="Action métier" sortKey="action" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={User} label="Assignée" sortKey="assignedTo" activeSort={activeSort} onSort={toggleSort} /></th>
                    <th className="px-2 py-3 text-center"><SortHeader icon={FileText} label="Suivi" sortKey="taskStatus" activeSort={activeSort} onSort={toggleSort} /></th>
                  </>
                )}
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {visibleRows.map((row, index) => {
                const isArrival = row.movement === 'arrival';
                const isDeparture = row.movement === 'departure';

                return (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-2 py-3"><input type="checkbox" checked={selectedRoomIds.includes(row.id)} onChange={() => toggleRoomSelection(row.id)} className="rounded border-gray-300 text-purple-600 focus:ring-purple-600" /></td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn('inline-block max-w-full truncate rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide', row.priority === 'Critique' && 'bg-red-50 text-red-600', row.priority === 'Élevée' && 'bg-orange-50 text-orange-600', row.priority === 'Moyenne' && 'bg-blue-50 text-blue-600', row.priority === 'Faible' && 'bg-green-50 text-green-600')}>{row.priority}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => openReservation(row)} className={cn(
                        "inline-flex items-center justify-center rounded-full px-4 py-1 text-xl font-extrabold tracking-tighter shadow-sm",
                        row.status === 'Bloquée' ? "bg-slate-200 text-slate-600" :
                        row.status === 'Non prête' ? "bg-red-100 text-red-600" :
                        row.status === 'Ménage en cours' ? "bg-orange-100 text-orange-600" :
                        row.status === 'Check-out fait' ? "bg-emerald-100 text-emerald-700" :
                        "bg-emerald-100 text-emerald-700",
                        "hover:scale-105 transition-transform"
                      )}>
                        {row.room}
                      </button>
                      <div className="mt-1 text-[10px] text-gray-400 font-medium">{row.type}</div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex min-w-0 items-center space-x-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full', row.status.includes('Bloquée') ? 'bg-slate-500' : row.status.includes('Non prête') ? 'bg-red-500' : row.status.includes('Ménage en cours') ? 'bg-orange-500' : row.status.includes('Arrivée') ? 'bg-yellow-500' : row.status.includes('Occupée') ? 'bg-blue-500' : 'bg-green-500')}></span>
                        <span className={cn('truncate font-medium text-xs', row.status.includes('Bloquée') ? 'text-slate-500' : row.status.includes('Non prête') ? 'text-red-600' : row.status.includes('Ménage en cours') ? 'text-orange-600' : row.status.includes('Arrivée') ? 'text-yellow-600' : row.status.includes('Occupée') ? 'text-blue-600' : 'text-green-600')}>{row.status}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3"><ClientIdentity row={row} index={index} onClick={() => openReservation(row)} /></td>
                    <td className="px-2 py-3"><DateCell value={row.arrival} type="arrival" /></td>
                    <td className="px-2 py-3"><DateCell value={row.departure} type="departure" /></td>
                    <td className="px-2 py-3"><EtaEtdCell row={row} /></td>
                    <td className="px-2 py-3"><StayCell row={row} /></td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn('text-xs font-semibold', row.payment === 'Payé' ? 'text-green-500' : row.payment === 'Partiel' ? 'text-orange-500' : 'text-red-500')}>{row.payment}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn('inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[8px] font-bold text-white tracking-wider', row.source === 'AIRBNB' ? 'bg-[#FF5A5F]' : row.source === 'BOOKING.COM' ? 'bg-[#003580]' : 'bg-green-500')}>{row.source}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      {isArrival || isDeparture ? (
                        <button onClick={() => openReservation(row)} title={isArrival ? 'Ouvrir le check-in' : 'Ouvrir la facturation'} className={cn('mx-auto flex h-10 w-10 items-center justify-center rounded-2xl transition-all hover:scale-105 active:scale-95', isArrival ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-500 hover:bg-rose-100')}>
                          {isArrival ? <LogIn size={21} strokeWidth={2.2} /> : <LogOut size={21} strokeWidth={2.2} />}
                        </button>
                      ) : (
                        <span title="Client en recouche" className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-500"><DoorClosed size={21} strokeWidth={2.2} /></span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <select value={getActionSelectValue(row.action)} onChange={(event) => handleActionChange(row, event.target.value)} className="w-full min-w-0 rounded-lg border border-purple-100 bg-purple-50 px-2 py-1.5 text-[11px] font-semibold text-purple-600 outline-none transition-colors hover:bg-purple-100">
                        {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn('inline-block max-w-full truncate rounded-md px-2 py-1 text-[10px] font-semibold', row.assignedTo ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400')}>
                        {row.assignedTo ?? 'Non assignée'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn('inline-block max-w-full truncate rounded-md px-2 py-1 text-[10px] font-semibold', getFollowStyle(row.taskStatus))}>{row.taskStatus}</span>
                    </td>
                    <td className="px-2 py-3 text-center relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenuRowId(openMenuRowId === row.id ? null : row.id); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"><MoreHorizontal size={18} /></button>
                      {openMenuRowId === row.id && (
                        <div className="absolute right-0 top-full z-[120] mt-1 w-56 rounded-2xl border border-gray-100 bg-white py-2 shadow-2xl">
                          <button onClick={() => { setRoomChangeModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ArrowRightLeft size={16} /></div><div><div className="font-semibold">Changement de chambre</div><div className="text-xs text-gray-400">Déloger le client</div></div></button>
                          <button onClick={() => { setCommunicationModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Send size={16} /></div><div><div className="font-semibold">Communication client</div><div className="text-xs text-gray-400">Email / WhatsApp</div></div></button>
                          <button onClick={() => { setBadgesModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Tag size={16} /></div><div><div className="font-semibold">Gérer les badges</div><div className="text-xs text-gray-400">VIP, Fidèle, etc.</div></div></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <div>Affichage de <span className="font-semibold text-gray-900">{filteredRows.length}</span> sur 67 chambres</div>
          <div className="flex items-center space-x-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 border border-transparent"><ChevronLeft size={16} /></button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-600 text-white font-medium shadow-sm">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 font-medium">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 font-medium">3</button>
            <span className="w-8 h-8 flex items-center justify-center">...</span>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 font-medium">14</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 border border-gray-100 bg-white shadow-sm"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl">
          {toast}
        </div>
      )}
      {assignmentModalOpen && selectedRooms.length > 0 && <HousekeepingAssignmentModal rooms={selectedRooms} onClose={() => { setAssignmentModalOpen(false); setSelectedRoomIds([]); }} onAssign={handleAssignRooms} />}
      {reservationModal && <ReservationModal state={reservationModal} onClose={() => setReservationModal(null)} onValidate={handleReservationValidation} />}
      {roomChangeModal && <RoomChangeModal row={roomChangeModal} onClose={() => setRoomChangeModal(null)} onSave={handleRoomChange} />}
      {communicationModal && <CommunicationModal row={communicationModal} onClose={() => setCommunicationModal(null)} onSend={handleMessageSent} />}
      {badgesModal && <BadgesModal row={badgesModal} onClose={() => setBadgesModal(null)} onSave={handleBadgesSave} />}
    </>
  );
};


function TodayView() {
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showRealtimeIndicators, setShowRealtimeIndicators] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const flowday = useFlowdayDataset();
  const hotelQ = useActiveHotel();
  const kpis: FlowdayKpis = flowday.kpis;
  const liveRows = flowday.rows as unknown as RoomRow[];
  const fmtEUR0 = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight" data-testid="flowday-title">
                Flowday <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? 'Mas Provencal Aix'}</span>
              </h2>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar size={14} className="mr-2" />
                <span>{currentDateLong}</span>
                <button
                  type="button"
                  onClick={() => { /* refetch via TanStack */ }}
                  className="ml-4 flex items-center space-x-1 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md text-xs transition-colors"
                >
                  <RefreshCw size={12} className={flowday.isLoading ? 'animate-spin' : ''} />
                  <span>Actualiser</span>
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {!showRealtimeIndicators && (
                <button onClick={() => setShowRealtimeIndicators(true)} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium shadow-sm flex items-center transition-all">
                  <TrendingUp size={18} className="mr-2 text-purple-500" />
                  Afficher indicateurs
                </button>
              )}
              {!showTimeline && (
                <button onClick={() => setShowTimeline(true)} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium shadow-sm flex items-center transition-all">
                  <Clock size={18} className="mr-2 text-purple-500" />
                  Afficher timeline
                </button>
              )}
              <button onClick={() => setShowRightPanel((current) => !current)} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-xl font-medium shadow-sm flex items-center transition-all">
                <BarChart2 size={18} className="mr-2 text-purple-500" />
                {showRightPanel ? 'Masquer le volet' : 'Afficher KPIs'}
              </button>
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm shadow-purple-600/20 flex items-center transition-all hover:scale-[1.02] active:scale-[0.98]">
                <Zap size={18} className="mr-2" />
                Optimiser la journée
              </button>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-8">
            
            {/* Main Content Area (Left/Center) */}
            <div className="flex-1 space-y-8 min-w-0">
              
              {/* KPIs */}
              {showRealtimeIndicators && <div>
                <div className="mb-4 ml-1 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Indicateurs Temps Réel</h3>
                  <button onClick={() => setShowRealtimeIndicators(false)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center"><X size={14} className="mr-1"/> Masquer</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard 
                    title={`Occupation: ${kpis.occupancy}%`}
                    subtitle={`CAPACITÉ TOTALE: ${kpis.totalRooms}`}
                    detailText="Live · Supabase"
                    icon={TrendingUp} 
                    colorClass="text-purple-600" 
                    bgColorClass="bg-purple-50" 
                  />
                  <KpiCard 
                    title={`${kpis.dirtyRooms} chambres sales`}
                    subtitle="MÉNAGE À FAIRE" 
                    highlight={`${kpis.cleanPct}% clean`}
                    icon={Sparkles} 
                    colorClass="text-orange-500" 
                    bgColorClass="bg-orange-50" 
                  />
                  <KpiCard 
                    title={`${kpis.arrivalsToday} arrivée${kpis.arrivalsToday > 1 ? 's' : ''} prévue${kpis.arrivalsToday > 1 ? 's' : ''}`}
                    subtitle="AUJOURD'HUI" 
                    highlight={`${kpis.vipCount} VIP`}
                    icon={Users} 
                    colorClass="text-green-600" 
                    bgColorClass="bg-green-50" 
                  />
                  <KpiCard 
                    title={`${fmtEUR0(kpis.unpaidAmount)} à encaisser`}
                    subtitle="PAIEMENTS ATTENTE" 
                    highlight={`${kpis.unpaidCount} dossier${kpis.unpaidCount > 1 ? 's' : ''}`}
                    icon={CreditCard} 
                    colorClass="text-blue-500" 
                    bgColorClass="bg-blue-50" 
                  />
                </div>
              </div>}

              {/* Timeline */}
              {showTimeline && <Timeline onHide={() => setShowTimeline(false)} />}

              {/* Operations Table */}
              <OperationsTable initialRooms={liveRows} />

            </div>

            {/* Right Sidebar */}
            {showRightPanel && <RightSidebar onHide={() => setShowRightPanel(false)} />}
            
          </div>
        </main>
    </div>
  );
}

export { TodayView };
export default TodayView;
