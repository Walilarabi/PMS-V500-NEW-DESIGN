import { useState } from 'react';
import * as React from 'react';
import {
  Menu, Calendar, Users, TrendingUp, DollarSign, BarChart2, Settings,
  Search, Bell, Grid, RefreshCw, Zap, CheckCircle, Clock, AlertTriangle,
  BedDouble, User, CreditCard, ArrowRight, ArrowLeft, Smartphone, FileText,
  Plus, ChevronLeft, ChevronRight, MoreHorizontal, ArrowUpRight, ArrowDownRight,
  Sparkles, X, LogIn, LogOut, Crown, IdCard,
  Mail, Phone, MapPin, Hash, Globe2, Hotel, WalletCards,
  UserRound, BadgeEuro, Moon, DoorOpen, DoorClosed, Check, Tag, type LucideIcon,
  ArrowRightLeft, Send, Printer, MessageCircle, Layers, Maximize2, Minimize2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type BadgeType = 'vip' | 'prioritaire' | 'nouveau' | 'fidele' | 'incident';

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

type RoomRow = {
  id: number;
  priority: string;
  room: string;
  type: string;
  status: string;
  guest: string;
  initials: string;
  reservationId: string;
  guestCount: number;
  etaTime: string;
  etaNote: string;
  movement: string;
  nights: number;
  stayAmount: string;
  vip: string | null;
  payment: string;
  arrival: string;
  departure: string;
  source: string;
  action: string;
  taskStatus: string;
  badges?: BadgeType[];
  email?: string;
  phone?: string;
  assignedTo?: string;
  isGroup?: boolean;
  category?: string;
  adults?: number;
  children?: number;
  nationality?: string;
  bookingRef?: string;
  ratePlan?: string;
};

// --- COMPONENTS ---

const Sidebar = () => (
  <div className="w-16 h-screen border-r border-gray-100 bg-white flex flex-col items-center py-4 space-y-8 shrink-0 hidden md:flex z-50 fixed left-0 top-0">
    <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">F</div>
    <div className="flex flex-col space-y-6 text-gray-400">
      <button className="p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors"><TrendingUp size={20} /></button>
      <button className="p-2 rounded-lg hover:bg-gray-50 transition-colors"><Calendar size={20} /></button>
      <button className="p-2 rounded-lg bg-purple-100 text-purple-600 transition-colors"><CheckCircle size={20} /></button>
    </div>
  </div>
);

const Header = () => (
  <header className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-6 sticky top-0 z-40">
    <div className="flex items-center space-x-8">
      <div className="flex items-center space-x-3">
        {/* Mobile menu button */}
        <button className="md:hidden p-2 -ml-2 text-gray-500"><Menu size={20} /></button>
        <div>
          <h1 className="font-semibold text-gray-900 text-lg leading-tight">Flowtym Premium Resort</h1>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Paris</p>
        </div>
      </div>
      
      <nav className="hidden lg:flex items-center space-x-1">
        {[
          { icon: Zap, label: 'FLOWDAY', active: true },
          { icon: Calendar, label: 'RÉSERVATION' },
          { icon: Users, label: 'CLIENTS' },
          { icon: TrendingUp, label: 'REVENUE' },
          { icon: DollarSign, label: 'FINANCE' },
          { icon: BarChart2, label: 'ANALYSE' },
          { icon: Settings, label: 'PARAMÈTRES' },
        ].map((item, i) => (
          <button 
            key={i} 
            className={cn(
              "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              item.active ? "text-purple-600 bg-purple-50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <item.icon size={16} className={cn(item.active ? "text-purple-600" : "text-gray-400")} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>

    <div className="flex items-center space-x-4">
      <div className="relative hidden md:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text" 
          placeholder="Rechercher..." 
          className="w-64 pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
        />
      </div>
      <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
        <Bell size={20} />
        <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
      </button>
      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors hidden sm:block">
        <Grid size={20} />
      </button>
      <button className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-semibold text-sm flex items-center justify-center border border-purple-200">
        WL
      </button>
    </div>
  </header>
);

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

type ReservationModalState = {
  row: RoomRow;
  mode: 'arrival' | 'departure';
};

type ModalTab = 'reservation' | 'billing' | 'cardex' | 'incidents' | 'lost' | 'reviews' | 'elite';

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

type SortKey = 'priority' | 'room' | 'status' | 'guest' | 'arrival' | 'departure' | 'eta' | 'nights' | 'payment' | 'source' | 'movement' | 'action' | 'assignedTo' | 'taskStatus';

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

const formatReservationDate = (dateTime: string) => {
  const [date] = dateTime.split(' ');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
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

const ReservationModal = ({ state, onClose, onValidate }: { state: ReservationModalState; onClose: () => void; onValidate: (state: ReservationModalState) => void }) => {
  const { row, mode } = state;
  const [activeTab, setActiveTab] = useState<ModalTab>(mode === 'departure' ? 'billing' : 'reservation');
  const stayTotal = row.stayAmount;
  const roomLabel = `Ch. ${row.room} (${row.type})`;
  const statusLabel = row.status === 'Non prête' ? 'non prête' : row.status.toLowerCase();
  const tabs: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'reservation', label: 'Réservation', icon: FileText },
    { id: 'billing', label: 'Facturation', icon: CreditCard },
    { id: 'cardex', label: 'Cardex', icon: Users },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'lost', label: 'Objets oubliés', icon: Search },
    { id: 'reviews', label: 'Avis', icon: Sparkles },
    { id: 'elite', label: 'Élite Stay', icon: BadgeEuro },
  ];

  const InfoBlock = ({ label, value, className }: { label: string; value: string; className?: string }) => (
    <div className={className}>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="rounded-2xl bg-slate-50 px-4 py-4 text-base font-semibold text-slate-800">{value}</div>
    </div>
  );

  const PanelTitle = ({ icon: Icon, children }: { icon: LucideIcon; children: string }) => (
    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4 text-sm font-extrabold uppercase tracking-wide text-violet-500">
      <Icon size={18} />
      {children}
    </div>
  );

  const Metric = ({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) => (
    <div className="rounded-3xl bg-white p-6 text-center shadow-sm border border-slate-100">
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn('text-2xl font-black', tone)}>{value}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm md:p-6">
      <div className="min-h-[92vh] w-full max-w-[1180px] overflow-hidden rounded-[2rem] bg-slate-50 shadow-2xl">
        <div className="relative flex items-center justify-between gap-4 bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 px-8 py-7 text-white">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/16 text-2xl font-black">{row.initials}</div>
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-black">{row.guest}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/65">
                <span>{row.reservationId}</span>
                <span className="rounded-full bg-white px-3 py-1 text-blue-600">{statusLabel}</span>
                <span>Ch. {row.room} · {formatReservationDate(row.arrival)} → {formatReservationDate(row.departure)} · {row.nights} nuit(s)</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-7">
            <div className="text-right">
              <div className="font-mono text-3xl font-black">{stayTotal}</div>
              <div className="mt-1 text-sm font-bold text-emerald-300">✓ Soldée</div>
            </div>
            <button onClick={onClose} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors" aria-label="Fermer">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white px-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-2 border-b-2 px-5 py-4 text-sm font-bold transition-colors whitespace-nowrap', active ? 'border-violet-500 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-700')}>
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[720px] p-7">
          {activeTab === 'reservation' && (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-600"><span className="h-2 w-2 rounded-full bg-blue-600" />Confirmée</span>
                <div className="flex flex-wrap gap-3">
                  <button className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"><Printer size={18} /></button>
                  <button className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-blue-500"><Mail size={18} /></button>
                  <button onClick={() => onValidate(state)} className="rounded-2xl bg-violet-600 px-7 py-3 font-black text-white shadow-lg shadow-violet-600/25">✓ Confirmer</button>
                  <button className="rounded-2xl border border-violet-300 bg-white px-7 py-3 font-black text-violet-500">Modifier</button>
                  <button onClick={onClose} className="rounded-2xl bg-red-50 px-7 py-3 font-black text-red-600">Annuler</button>
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={Users}>Client</PanelTitle>
                  <div className="grid gap-5 md:grid-cols-2">
                    <InfoBlock label="Nom complet" value={row.guest} />
                    <InfoBlock label="Nationalité" value="🇫🇷 France" />
                    <InfoBlock label="Email" value={row.email ?? 'sophie.dubois@gmail.com'} />
                    <InfoBlock label="Téléphone" value={row.phone ?? '+33 6 12 34 56 78'} />
                  </div>
                </div>
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={BedDouble}>Séjour</PanelTitle>
                  <div className="grid gap-5 md:grid-cols-2">
                    <InfoBlock label="Arrivée" value={formatReservationDate(row.arrival)} />
                    <InfoBlock label="Départ" value={formatReservationDate(row.departure)} />
                    <InfoBlock label="Type de chambre" value="Simple" />
                    <InfoBlock label="Chambre (dispo)" value={`${row.room} (Double Classique)`} />
                    <InfoBlock label="Type de pension" value="Room Only" />
                    <InfoBlock label="Conditions d'annulation" value="Flexible (72h)" />
                  </div>
                </div>
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={CreditCard}>Paiement & Garantie</PanelTitle>
                  <div className="grid gap-5 md:grid-cols-2">
                    <InfoBlock label="Canal (source)" value={row.source === 'DIRECT' ? 'Direct' : row.source} />
                    <InfoBlock label="Mode de paiement" value="Carte bancaire" />
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Garantie</div>
                      <div className="flex gap-2"><span className="rounded-xl border-2 border-violet-500 p-3 text-violet-500"><CreditCard size={18} /></span><span className="rounded-xl border border-slate-200 p-3 text-slate-400"><Hotel size={18} /></span><span className="rounded-xl border border-slate-200 p-3 text-slate-400"><WalletCards size={18} /></span></div>
                    </div>
                    <InfoBlock label="Statut du paiement" value={row.payment === 'Payé' ? 'Payé (Solde 0)' : row.payment} />
                  </div>
                </div>
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={FileText}>Documents & Cardex</PanelTitle>
                  <div className="space-y-4">
                    <InfoBlock label="Ajouter au journal (Cardex)" value="Note, incident, préférence client..." />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><span className="font-bold text-violet-600">21:42 · system :</span> Création initiale</div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Pièces jointes (CNI, confirmations...)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-7">
              <div className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
                <InfoBlock label="Réservation" value={row.reservationId} />
                <InfoBlock label="Dates" value={`${formatReservationDate(row.arrival)} - ${formatReservationDate(row.departure)}`} />
                <InfoBlock label="Durée & Pax" value={`${row.nights} nuit(s) · ${row.guestCount} adulte(s)`} />
                <InfoBlock label="Hébergement" value={roomLabel} />
              </div>
              <div className="grid gap-5 md:grid-cols-4">
                <Metric label="Total facturé (TTC)" value="432,00 €" />
                <Metric label="Total encaissé" value="420,00 €" tone="text-emerald-600" />
                <Metric label="Solde restant" value="12,00 €" tone="text-red-600" />
                <Metric label="Statut global" value="EN ATTENTE" tone="text-amber-500" />
              </div>
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
                  <span className="font-black text-violet-600">Folio 1 : Hébergement</span><span className="rounded-xl bg-slate-50 px-4 py-2 font-mono text-sm">N° FAC-20260505-F1</span><span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-600">Soldé</span>
                  <div className="ml-auto flex gap-2"><button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">Aperçu PDF</button><button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">Imprimer</button><button className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-bold text-blue-600">Envoyer</button></div>
                </div>
                <div className="grid gap-5 bg-slate-50 p-5 md:grid-cols-2"><InfoBlock label="Facturé à" value={row.guest} /><InfoBlock label="Adresse de facturation complète" value={`${row.guest}\n${row.email ?? 'sophie.dubois@gmail.com'}`} /></div>
                <table className="w-full text-sm"><thead className="text-left text-slate-400"><tr><th className="p-4">Date</th><th>Description</th><th>Qté</th><th>PU HT</th><th>TVA</th><th className="pr-6 text-right">Total TTC</th></tr></thead><tbody className="divide-y divide-slate-100">{[0, 1, 2].map((i) => <tr key={i}><td className="p-4 text-slate-500">{formatReservationDate(row.arrival)}</td><td className="font-bold">Nuitée Ch. {row.room}</td><td>1</td><td>127,27 €</td><td>10%</td><td className="pr-6 text-right font-black">140,00 €</td></tr>)}</tbody></table>
                <div className="grid gap-5 border-t border-slate-100 p-5 md:grid-cols-[1fr_1fr_1fr_auto]"><InfoBlock label="Famille de produit" value="Sélectionner une famille..." /><InfoBlock label="Produit" value="Sélectionner un produit..." /><InfoBlock label="Code produit" value="2 lettres..." /><button className="self-end rounded-2xl bg-violet-600 px-7 py-4 font-black text-white">Ajouter</button></div>
                <div className="flex flex-wrap items-end justify-between gap-6 border-t border-slate-100 bg-slate-50 p-6"><button className="rounded-2xl border border-emerald-300 bg-emerald-50 px-7 py-3 font-black text-emerald-600">Encaisser sur ce folio</button><div className="min-w-[300px] space-y-3 text-right"><div className="flex justify-between"><span>Total HT</span><span>381,82 €</span></div><div className="flex justify-between"><span>TVA</span><span>38,18 €</span></div><div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-black"><span>TOTAL TTC</span><span>420,00 €</span></div></div></div>
              </div>
            </div>
          )}

          {activeTab === 'cardex' && (
            <div className="space-y-6">
              <div className="grid gap-5 md:grid-cols-4"><Metric label="Séjours totaux" value="1" /><Metric label="Nuits cumulées" value={`${row.nights}`} /><Metric label="CA total (HT/TTC)" value={stayTotal} /><Metric label="Dépense moyenne" value={stayTotal} /></div>
              <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                <div className="space-y-6"><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={Users}>Fiche identité</PanelTitle><div className="space-y-5 text-sm font-semibold text-slate-700"><div><Mail size={16} className="mb-1 text-slate-400" />{row.email ?? 'sophie.dubois@gmail.com'}</div><div><Phone size={16} className="mb-1 text-slate-400" />+33 6 12 34 56 78</div><div><MapPin size={16} className="mb-1 text-slate-400" />75001 Paris, France</div><div><Hash size={16} className="mb-1 text-slate-400" />CX-9921</div></div></div><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={Globe2}>Origine des réservations</PanelTitle><div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 font-black"><span>{row.source}</span><span className="rounded-full bg-violet-600 px-4 py-2 text-white">1</span></div></div></div>
                <div className="space-y-6"><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><div className="mb-5 flex justify-between"><PanelTitle icon={Calendar}>Chronologie des séjours</PanelTitle><span className="font-bold text-slate-400">1 Dossier(s)</span></div><table className="w-full text-sm"><thead className="text-left text-slate-400"><tr><th>Réf</th><th>Dates</th><th>Ch.</th><th>Nuits</th><th>Montant</th><th>Statut</th></tr></thead><tbody><tr className="bg-violet-50"><td className="py-4 font-black text-violet-600">{row.reservationId}</td><td>{formatReservationDate(row.arrival)} → {formatReservationDate(row.departure)}</td><td><span className="rounded-xl bg-white px-3 py-1 font-black">{row.room}</span></td><td>{row.nights}</td><td className="font-black">{stayTotal}</td><td className="font-black text-blue-600">{statusLabel.toUpperCase()}</td></tr></tbody></table></div><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={Sparkles}>Notes & préférences</PanelTitle><div className="grid gap-4 md:grid-cols-3"><InfoBlock label="Étage" value="Étage élevé" /><InfoBlock label="Lit" value="Double Queen" /><InfoBlock label="Régime" value="Sans gluten" /></div></div><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={IdCard}>Documents d'identité (check-in)</PanelTitle><p className="text-sm italic text-slate-400">Aucun document ID/Passeport enregistré.</p></div></div>
              </div>
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="space-y-6"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="rounded-2xl bg-red-50 p-4 text-red-600"><AlertTriangle /></div><div><h4 className="text-2xl font-black">Journal des Incidents</h4><p className="font-semibold text-slate-400">Chambre {row.room} · 1 actif(s)</p></div></div><button className="rounded-2xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg shadow-violet-600/25">+ Signaler un incident</button></div>{[{ tone: 'orange', title: 'Climatisation chambre insuffisante — température maintenue à 26°C malgré réglage', status: 'EN COURS' }, { tone: 'green', title: 'Nuisances sonores signalées — chambre voisine', status: 'RÉSOLU' }].map((incident) => <div key={incident.title} className={cn('rounded-3xl bg-white p-7 shadow-sm border-l-4', incident.tone === 'orange' ? 'border-orange-500' : 'border-emerald-500')}><div className="flex items-center gap-3 text-sm font-black"><span className="rounded-xl bg-slate-100 px-3 py-2 text-slate-500">TECHNIQUE</span><span className={cn('rounded-xl px-3 py-2', incident.tone === 'orange' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600')}>{incident.status}</span><span className="text-slate-400">05/05/2026 · 14:30</span></div><h5 className="mt-5 text-xl font-black text-slate-900">{incident.title}</h5><div className="mt-6 border-t border-slate-100 pt-5 text-slate-500">Intervention : <b>Maintenance</b> <span className="ml-4 rounded-lg bg-blue-50 px-3 py-1 font-black text-blue-600">✓ CLIENT INFORMÉ</span></div></div>)}</div>
          )}

          {activeTab === 'lost' && (
            <div className="space-y-6"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="rounded-2xl bg-orange-50 p-4 text-orange-600"><Search /></div><div><h4 className="text-2xl font-black">Objets Oubliés (Lost & Found)</h4><p className="font-semibold text-slate-400">Gestion des articles trouvés en chambre</p></div></div><button className="rounded-2xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg shadow-violet-600/25">+ Déclarer un objet</button></div><div className="grid gap-5 md:grid-cols-2">{['Chargeur iPhone blanc + câble', 'Veste bleue Zara, taille M'].map((item, i) => <div key={item} className={cn('rounded-3xl bg-white p-7 shadow-sm border-l-4', i === 0 ? 'border-orange-500' : 'border-blue-600')}><div className="mb-5 flex justify-between"><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-400">{i === 0 ? 'Electronique' : 'Vêtement'}</span><span className={cn('rounded-xl px-3 py-2 text-xs font-black', i === 0 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600')}>{i === 0 ? 'À traiter' : 'Réclamé'}</span></div><h5 className="text-xl font-black text-slate-900">{item}</h5><p className="mt-3 font-semibold text-slate-500"><MapPin size={16} className="inline mr-2" />Trouvé à : {i === 0 ? `Chambre ${row.room}` : 'Restaurant'}</p><div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-400"><span>Déclaré le 05/05/2026</span><div className="flex gap-2"><button className="rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-500">Étiqueter</button><button className="rounded-xl border border-blue-200 px-3 py-2 font-bold text-blue-600">Informer client</button></div></div></div>)}</div></div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6"><div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 md:flex md:items-center md:gap-10"><div className="border-r border-slate-100 pr-10"><div className="text-6xl font-black text-amber-500">8.0</div><div className="mt-2 font-black text-slate-400">2 AVIS CLIENTS</div></div><div className="grid flex-1 gap-5 md:grid-cols-2">{[['Propreté','8.5','bg-emerald-500'],['Confort','7.5','bg-amber-500'],['Localisation','10.0','bg-emerald-500'],['Service','8.0','bg-emerald-500']].map(([label, score, color]) => <div key={label}><div className="mb-2 flex justify-between font-black text-slate-600"><span>{label}</span><span>{score}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={cn('h-full rounded-full', color)} style={{ width: `${Number(score) * 10}%` }} /></div></div>)}</div></div>{['Excellent séjour, personnel aux petits soins. La suite panoramique valait largement l’investissement.', 'Bon séjour dans l’ensemble. Climatisation un peu bruyante la nuit.'].map((review, i) => <div key={review} className={cn('rounded-3xl bg-white p-8 shadow-sm border-l-4', i === 0 ? 'border-emerald-500' : 'border-amber-500')}><div className="mb-5 flex justify-between"><span className="rounded-xl bg-violet-50 px-4 py-2 text-sm font-black text-violet-600">{i === 0 ? 'DIRECT' : 'BOOKING.COM'}</span><span className="font-black text-slate-900">{i === 0 ? '9/10' : '7/10'}</span></div><blockquote className="text-xl font-bold italic text-slate-800">"{review}"</blockquote>{i === 0 ? <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-slate-600">Merci pour votre confiance. Nous espérons vous accueillir à nouveau très prochainement.</div> : <button className="mt-6 rounded-2xl border border-violet-200 px-5 py-3 font-black text-violet-500">Répondre à cet avis</button>}</div>)}</div>
          )}

          {activeTab === 'elite' && (
            <div className="space-y-7"><div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-900 to-orange-700 p-9 text-white"><div className="text-sm font-black uppercase tracking-[0.25em] text-white/55">Élite Stay Member</div><h4 className="mt-2 text-3xl font-black">Tier Gold</h4><div className="mt-3 text-2xl font-black">{row.guest}</div><p className="mt-4 font-semibold text-white/65">Inscrit le 15/01/2024 · 6 séjours cumulés</p><div className="mt-3 text-6xl font-black text-amber-200">15004 <span className="text-xl text-white/55">PTS</span></div><div className="absolute right-10 top-10 text-right"><div className="text-sm font-black text-white/55">ID MEMBRE</div><div className="mt-2 font-mono text-xl font-black">ES-GUEST</div></div><div className="absolute bottom-10 right-10 rounded-2xl bg-white/10 px-8 py-5 text-center"><div className="text-sm font-black text-white/55">VALEUR</div><div className="text-2xl font-black">150,00 €</div></div></div><div className="rounded-3xl bg-white p-7 shadow-sm border border-slate-100"><div className="mb-4 flex justify-between font-black"><span>Objectif Platinum</span><span className="text-violet-600">31244 pts manquants</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-full w-[18%] rounded-full bg-gradient-to-r from-amber-500 to-violet-500" /></div><div className="mt-3 flex justify-between font-bold text-slate-400"><span>18756 pts (Total)</span><span>Prochain palier : 50000 pts</span></div></div><div className="grid gap-5 md:grid-cols-4"><Metric label="Dépenses totales" value="1500,50 €" /><Metric label="Gains ce séjour" value="+6300 pts" tone="text-emerald-600" /><Metric label="Taux multiplicateur" value="×1.5" tone="text-violet-600" /><Metric label="Statut actuel" value="Gold" tone="text-amber-500" /></div><div className="grid gap-6 md:grid-cols-2"><div className="rounded-3xl bg-white p-7 shadow-sm border border-slate-100"><PanelTitle icon={Crown}>Vos avantages Gold</PanelTitle><div className="space-y-4 font-semibold text-slate-600">{['Bonus x1.5 sur les points','Surclassement si disponible','Petit-déjeuner offert 1×/séjour','Late checkout 14h00'].map((b) => <div key={b} className="flex gap-3"><span className="text-emerald-500">✓</span>{b}</div>)}</div></div><div className="rounded-3xl border border-violet-200 bg-violet-50 p-7"><PanelTitle icon={BadgeEuro}>Comment convertir ?</PanelTitle><div className="space-y-4 font-bold text-violet-700"><p>· Vous gagnez 10 points par euro dépensé.</p><p>· 1000 points = 10,00 € de remise directe.</p><p>· Valable sur les séjours, le restaurant et le spa.</p></div><button className="mt-7 w-full rounded-2xl bg-violet-600 py-4 font-black text-white shadow-lg shadow-violet-600/25">Utiliser mes points maintenant</button></div></div><div className="rounded-3xl bg-white p-7 shadow-sm border border-slate-100"><PanelTitle icon={Clock}>Historique des transactions</PanelTitle><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-400"><tr><th className="p-4">Date</th><th>Type</th><th>Détails</th><th className="pr-4 text-right">Points</th></tr></thead><tbody className="divide-y divide-slate-100">{['Séjour — Ch. 102 — 5 nuit(s)','Séjour — Ch. 101 — 3 nuit(s)','Bonus Silver ×1.25 — RES-001'].map((detail, i) => <tr key={detail}><td className="p-4 text-slate-500">05/05/2026</td><td><span className={cn('rounded-full px-3 py-1 text-xs font-black', i === 2 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>{i === 2 ? 'DÉBIT' : 'GAIN'}</span></td><td className="font-bold">{detail}</td><td className="pr-4 text-right font-black text-emerald-600">+{i === 0 ? '250' : i === 1 ? '4200' : '1050'}</td></tr>)}</tbody></table></div></div>
          )}
        </div>
      </div>
    </div>
  );
};

type CommunicationChannel = 'email' | 'whatsapp';

type MessageTemplate = {
  id: string;
  label: string;
  icon: string;
  content: string;
};

const messageTemplates: MessageTemplate[] = [
  { id: 'confirmation', label: 'Confirmation de séjour', icon: '📅', content: 'Bonjour {guest},\n\nNous avons le plaisir de vous confirmer votre réservation pour les dates du {arrival} au {departure}.\nChambre : {room}\n\nCordialement,\nL\'équipe de la Réception' },
  { id: 'rappel', label: 'Rappel Arrivée', icon: '⏰', content: 'Cher(e) {guest},\n\nNous avons hâte de vous accueillir très bientôt dans la chambre {room}.\n\nA bientôt !\nL\'équipe de la Réception' },
  { id: 'paiement', label: 'Demande de Paiement', icon: '💰', content: 'Bonjour {guest},\n\nNous vous rappelons que le solde de votre séjour reste à régler.\nMontant : {amount}\n\nMerci de votre confiance.' },
  { id: 'facture', label: 'Envoi de Facture', icon: '📄', content: 'Bonjour {guest},\n\nVeuillez trouver ci-joint votre facture de séjour.\n\nCordialement,\nLa Réception' },
  { id: 'satisfaction', label: 'Questionnaire de Satisfaction', icon: '⭐', content: 'Cher(e) {guest},\n\nVotre avis nous est précieux ! Merci de prendre quelques minutes pour répondre à notre questionnaire de satisfaction.\n\nMerci beaucoup.' },
  { id: 'offre', label: 'Offre Spéciale', icon: '🎁', content: 'Bonjour {guest},\n\nProfitez de notre offre spéciale pour votre prochain séjour !\n-20% sur les nuits supplémentaires.\n\nÀ très vite.' },
  { id: 'modification', label: 'Modification de Réservation', icon: '✏️', content: 'Bonjour {guest},\n\nVotre réservation a été modifiée comme convenu.\nNouvelles dates : {arrival} - {departure}\n\nCordialement.' },
  { id: 'annulation', label: 'Confirmation d\'Annulation', icon: '❌', content: 'Bonjour {guest},\n\nVotre réservation a été annulée comme demandé.\n\nNous espérons vous accueillir prochainement.' },
];

const housekeepers = ['Amina Benali', 'Julie Martin', 'Sara Diallo', 'Emma Petit', 'Lina Rossi'];

const actionOptions = ['Lancer le ménage', 'Demande Inspection', 'Refus de service', 'Bloquer la chambre'];

const getActionSelectValue = (action: string) => {
  if (action.includes('ménage')) return 'Lancer le ménage';
  if (action.includes('Inspection')) return 'Demande Inspection';
  if (action.includes('Refus')) return 'Refus de service';
  if (action.includes('Bloquer')) return 'Bloquer la chambre';
  return 'Lancer le ménage';
};

const getFollowStyle = (taskStatus: string) => {
  if (taskStatus === 'À faire') return 'bg-red-50 text-red-600 border border-red-100';
  if (taskStatus === 'En cours') return 'bg-orange-50 text-orange-600 border border-orange-100';
  if (taskStatus === 'À valider') return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
  return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
};

const priorityRank: Record<string, number> = { Critique: 0, Élevée: 1, Moyenne: 2, Faible: 3 };

const getSortValue = (row: RoomRow, key: SortKey) => {
  if (key === 'priority') return priorityRank[row.priority] ?? 99;
  if (key === 'room') return Number(row.room) || 0;
  if (key === 'arrival') return new Date(row.arrival).getTime();
  if (key === 'departure') return new Date(row.departure).getTime();
  if (key === 'eta') return row.etaTime || '99:99';
  if (key === 'nights') return row.nights;
  return String(row[key] ?? '').toLowerCase();
};

const OperationsTable = () => {
  const [rooms, setRooms] = useState<RoomRow[]>(roomsData);
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

const HousekeepingAssignmentModal = ({ rooms, onClose, onAssign }: { rooms: RoomRow[]; onClose: () => void; onAssign: (housekeeper: string) => void }) => {
  const [selectedHousekeeper, setSelectedHousekeeper] = useState(housekeepers[0]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 p-7 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">Attribuer le ménage</h3>
              <p className="mt-1 text-sm font-semibold text-white/70">{rooms.length} chambre(s) sélectionnée(s)</p>
            </div>
            <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><X size={22} /></button>
          </div>
        </div>

        <div className="space-y-6 p-7">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Femme de chambre</label>
            <select value={selectedHousekeeper} onChange={(event) => setSelectedHousekeeper(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500">
              {housekeepers.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">Chambres à assigner</div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
                  <div className="font-black text-slate-900">Ch. {room.room}</div>
                  <div className="truncate px-3 font-semibold text-slate-500">{room.guest}</div>
                  <div className="text-xs font-bold text-slate-400">{room.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-7 py-5">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Annuler</button>
          <button onClick={() => onAssign(selectedHousekeeper)} className="flex-1 rounded-2xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors">Attribuer</button>
        </div>
      </div>
    </div>
  );
};

const RoomChangeModal = ({ row, onClose, onSave }: { row: RoomRow; onClose: () => void; onSave: (row: RoomRow, destinationRoom: string) => void }) => {
  const [destinationRoom, setDestinationRoom] = useState('');
  const availableRooms = ['103', '104', '106', '108', '109', '110', '201', '203', '204', '205'];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 p-8 text-white">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15">
                <ArrowRightLeft size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Délogement - Changement de chambre</h3>
                <p className="mt-1 text-sm text-white/75">PMS FLOWTYM - OPÉRATIONS</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
              <h4 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-violet-600"><BedDouble size={18} />Chambre Source</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-400">Chambre</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.room}</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Catégorie</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.type}</div></div>
                </div>
                <div><label className="text-xs font-bold text-slate-400">Client</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.guest}</div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-400">Arrivée</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{formatReservationDate(row.arrival)}</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Départ</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{formatReservationDate(row.departure)}</div></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-xs font-bold text-slate-400">Adultes</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.guestCount}</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Enfants</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">0</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Source</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900">{row.source}</div></div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
              <h4 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-violet-600"><Hotel size={18} />Chambre Destination</h4>
              <label className="text-xs font-bold text-slate-400">Sélectionner une chambre libre</label>
              <select value={destinationRoom} onChange={(e) => setDestinationRoom(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">-- Choisir une chambre --</option>
                {availableRooms.map((r) => <option key={r} value={r}>Ch. {r}</option>)}
              </select>
              <div className="mt-6 rounded-2xl bg-violet-50 p-5 text-sm text-violet-600">
                <p className="font-semibold">Note :</p>
                <p className="mt-1 text-violet-500">Le délogement transférera automatiquement la réservation et les informations client vers la nouvelle chambre.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-8 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Quitter</button>
          <button disabled={!destinationRoom} onClick={() => onSave(row, destinationRoom)} className={cn('ml-auto rounded-2xl px-8 py-3 font-bold text-white transition-colors', destinationRoom ? 'bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/25' : 'bg-slate-300 cursor-not-allowed')}>Valider le délogement</button>
        </div>
      </div>
    </div>
  );
};

const fillMessageTemplate = (template: MessageTemplate, row: RoomRow) => template.content
  .replace(/\{guest\}/g, row.guest)
  .replace(/\{room\}/g, row.room)
  .replace(/\{arrival\}/g, formatReservationDate(row.arrival))
  .replace(/\{departure\}/g, formatReservationDate(row.departure))
  .replace(/\{amount\}/g, row.stayAmount);

const CommunicationModal = ({ row, onClose, onSend }: { row: RoomRow; onClose: () => void; onSend: (row: RoomRow, channel: CommunicationChannel) => void }) => {
  const [channel, setChannel] = useState<CommunicationChannel>('email');
  const [template, setTemplate] = useState<MessageTemplate>(messageTemplates[0]);
  const [messageContent, setMessageContent] = useState(() => fillMessageTemplate(messageTemplates[0], row));

  const sendMessage = () => {
    onSend(row, channel);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 p-8 text-white">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">Communication Client</h3>
              <p className="mt-1 text-sm text-white/75">CHAMBRE {row.room}</p>
            </div>
            <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-400">Client</label>
              <div className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-bold text-slate-900">{row.guest}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Canal d'envoi</label>
              <div className="mt-1 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button onClick={() => setChannel('email')} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors', channel === 'email' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><Mail size={18} />Email</button>
                <button onClick={() => setChannel('whatsapp')} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors', channel === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><MessageCircle size={18} />WhatsApp</button>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-400">Email</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-900"><Mail size={18} className="text-slate-400" /><span className="font-medium">arathew.smith@email.com</span></div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">WhatsApp / Tél</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-900"><Phone size={18} className="text-slate-400" /><span className="font-medium">+33 6 12 34 56 78</span></div>
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs font-bold text-slate-400">Modèle de message</label>
            <div className="relative mt-1">
              <select value={template.id} onChange={(e) => { const t = messageTemplates.find((m) => m.id === e.target.value); if (t) { setTemplate(t); setMessageContent(fillMessageTemplate(t, row)); } }} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {messageTemplates.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
              <ChevronRight size={18} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">Contenu du message</label>
            <textarea value={messageContent} onChange={(e) => setMessageContent(e.target.value)} rows={6} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors"><Printer size={18} />Imprimer</button>
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-8 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Fermer</button>
          <button onClick={sendMessage} className={cn('ml-auto flex items-center gap-2 rounded-2xl px-8 py-3 font-bold text-white transition-colors', channel === 'email' ? 'bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/25' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25')}>{channel === 'email' ? <Send size={18} /> : <MessageCircle size={18} />}{channel === 'email' ? 'ENVOYER EMAIL' : 'WHATSAPP'}</button>
        </div>
      </div>
    </div>
  );
};

const BadgesModal = ({ row, onClose, onSave }: { row: RoomRow; onClose: () => void; onSave: (row: RoomRow, badges: BadgeType[]) => void }) => {
  const [selectedBadges, setSelectedBadges] = useState<BadgeType[]>(row.badges ?? (row.vip ? ['vip'] : []));

  const toggleBadge = (badge: BadgeType) => {
    setSelectedBadges((prev) => prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]);
  };

  const badgeOptions: { id: BadgeType; label: string; icon: string; color: string }[] = [
    { id: 'vip', label: 'VIP', icon: '👑', color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { id: 'prioritaire', label: 'Prioritaire', icon: '⚡', color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { id: 'nouveau', label: 'Nouveau client', icon: '✨', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { id: 'fidele', label: 'Fidèle', icon: '❤️', color: 'bg-pink-50 text-pink-600 border-pink-200' },
    { id: 'incident', label: 'Incident', icon: '🚩', color: 'bg-red-50 text-red-600 border-red-200' },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Gérer les badges</h3>
            <p className="text-sm text-slate-400">CHAMBRE {row.room}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-3">
          {badgeOptions.map((badge) => (
            <button key={badge.id} onClick={() => toggleBadge(badge.id)} className={cn('flex w-full items-center justify-between rounded-2xl border-2 p-4 transition-all', selectedBadges.includes(badge.id) ? cn(badge.color, 'border-current shadow-sm') : 'border-slate-100 bg-slate-50 hover:bg-slate-100')}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{badge.icon}</span>
                <span className={cn('font-semibold', selectedBadges.includes(badge.id) ? 'text-current' : 'text-slate-600')}>{badge.label}</span>
              </div>
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-full border-2', selectedBadges.includes(badge.id) ? 'border-violet-600 bg-violet-600' : 'border-slate-300')}>
                {selectedBadges.includes(badge.id) && <Check size={14} className="text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Annuler</button>
          <button onClick={() => onSave(row, selectedBadges)} className="flex-1 rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors">Enregistrer</button>
        </div>
      </div>
    </div>
  );
};

const RightSidebar = ({ onHide }: { onHide: () => void }) => {
  return (
    <div className="w-80 shrink-0 space-y-6 hidden xl:block">
      {/* KPI Stats Section - Flow Score */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">KPIs & Stats</h3>
          <button onClick={onHide} className="text-xs text-gray-400 hover:text-gray-600 flex items-center"><X size={14} className="mr-1"/> Masquer</button>
        </div>
        
        <div className="flex justify-between items-start mb-6">
          <span className="text-sm font-medium text-gray-600">Flow Score</span>
          <button className="w-6 h-6 rounded bg-gray-50 flex items-center justify-center text-gray-400"><Zap size={12} /></button>
        </div>

        <div className="flex items-center space-x-4 mb-8">
          {/* Simple SVG Gauge approximation */}
          <div className="relative w-24 h-24">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-green-500"
                strokeWidth="3"
                strokeDasharray="78, 100"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 leading-none">78</span>
              <span className="text-[10px] text-gray-400">/100</span>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-gray-900">Journée fluide</h4>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Continuez comme ça !</p>
          </div>
        </div>
        
        {/* Decorative wave line */}
        <div className="h-10 w-full overflow-hidden opacity-20 text-purple-600 flex items-end">
           <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-full stroke-current fill-none stroke-2">
             <path d="M0,10 Q10,0 20,10 T40,10 T60,10 T80,10 T100,10" />
           </svg>
        </div>
      </div>

      {/* Performance du jour */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-gray-500 font-medium text-sm mb-6">Performance du jour</h3>
        
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><BedDouble size={14} className="mr-2"/> Taux d'occupation</span>
              <span className="text-green-500 text-xs font-semibold flex items-center"><ArrowUpRight size={12} className="mr-0.5"/> 8.3%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">75.4%</div>
          </div>
          
          <div className="h-px bg-gray-100"></div>

          <div>
            <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><TargetIcon className="w-3.5 h-3.5 mr-2"/> ADR</span>
              <span className="text-green-500 text-xs font-semibold flex items-center"><ArrowUpRight size={12} className="mr-0.5"/> 2.1%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">189.00 €</div>
          </div>

          <div className="h-px bg-gray-100"></div>

          <div>
            <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><Zap size={14} className="mr-2"/> REVPAR</span>
              <span className="text-green-500 text-xs font-semibold flex items-center"><ArrowUpRight size={12} className="mr-0.5"/> 5.1%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">142.50 €</div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
               <div className="bg-blue-500 h-full w-1/3"></div>
               <div className="bg-purple-500 h-full w-1/3"></div>
               <div className="bg-green-500 h-full w-1/4"></div>
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          <div>
             <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><FileText size={14} className="mr-2"/> Revenue total</span>
              <span className="text-red-500 text-xs font-semibold flex items-center"><ArrowDownRight size={12} className="mr-0.5"/> 1.2%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">28 450 €</div>
            <div className="text-[10px] text-gray-400 mt-1 uppercase">VS même jour semaine dernière</div>
          </div>
        </div>

        <button className="w-full mt-6 py-2.5 rounded-xl border border-gray-200 text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors">
          VOIR LE RAPPORT COMPLET
        </button>
      </div>

      {/* Actions Rapides */}
      <div>
        <h3 className="text-gray-500 font-medium text-sm mb-4">Actions Rapides</h3>
        <div className="space-y-3">
          <button className="w-full bg-white border border-gray-100 rounded-xl p-4 flex items-center hover:shadow-sm transition-shadow group">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-3 group-hover:bg-blue-100 transition-colors"><Plus size={16} /></div>
            <span className="font-semibold text-gray-700 text-sm">Nouvelle réservation</span>
          </button>
          <button className="w-full bg-white border border-gray-100 rounded-xl p-4 flex items-center hover:shadow-sm transition-shadow group">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mr-3 group-hover:bg-purple-100 transition-colors"><User size={16} /></div>
            <span className="font-semibold text-gray-700 text-sm">Walk-in</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Simple target icon helper since Lucide's target might differ slightly
const TargetIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
)


function TodayView() {
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showRealtimeIndicators, setShowRealtimeIndicators] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Flowday</h2>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar size={14} className="mr-2" />
                <span>{currentDateLong}</span>
                <button className="ml-4 flex items-center space-x-1 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md text-xs transition-colors">
                  <RefreshCw size={12} />
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
                    title="Occupation: 62.5%" 
                    subtitle="CAPACITÉ TOTALE: 42" 
                    detailText="Direct/OTA"
                    icon={TrendingUp} 
                    colorClass="text-purple-600" 
                    bgColorClass="bg-purple-50" 
                  />
                  <KpiCard 
                    title="2 chambres sales" 
                    subtitle="MÉNAGE À FAIRE" 
                    highlight="75% clean"
                    icon={Sparkles} 
                    colorClass="text-orange-500" 
                    bgColorClass="bg-orange-50" 
                  />
                  <KpiCard 
                    title="0 arrivées prévues" 
                    subtitle="AUJOURD'HUI" 
                    highlight="4 VIP"
                    icon={Users} 
                    colorClass="text-green-600" 
                    bgColorClass="bg-green-50" 
                  />
                  <KpiCard 
                    title="4,280 € à encaisser" 
                    subtitle="PAIEMENTS ATTENTE" 
                    highlight="2 litiges"
                    icon={CreditCard} 
                    colorClass="text-blue-500" 
                    bgColorClass="bg-blue-50" 
                  />
                </div>
              </div>}

              {/* Timeline */}
              {showTimeline && <Timeline onHide={() => setShowTimeline(false)} />}

              {/* Operations Table */}
              <OperationsTable />

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
