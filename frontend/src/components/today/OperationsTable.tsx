/**
 * FLOWTYM — Flowday OperationsTable & its inline helpers.
 *
 * Extracted from `TodayView.tsx` to reduce the parent page to a thin
 * orchestrator. Exposes <OperationsTable initialRooms={...} />.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, ChevronLeft, ChevronRight, MoreHorizontal,
  ArrowUpRight, ArrowDownRight, Calendar, Send, ArrowRightLeft,
  Layers, Tag, UserRound, Users, BedDouble, Crown,
  LogIn, LogOut, DoorClosed, type LucideIcon,
  AlertTriangle, RefreshCw, Clock, Moon, CreditCard, Smartphone,
  DoorOpen, Zap, User, FileText,
} from 'lucide-react';

import { ReservationModal } from '@/src/components/today/modals/ReservationModal';
import { ReservationDetailsModal } from '@/src/components/modals/ReservationDetailsModal';
import { NewReservationModal } from '@/src/components/modals/NewReservationModal';
import { HousekeepingAssignmentModal } from '@/src/components/today/modals/HousekeepingAssignmentModal';
import { RoomChangeModal } from '@/src/components/today/modals/RoomChangeModal';
import { CommunicationModal } from '@/src/components/today/modals/CommunicationModal';
import { BadgesModal } from '@/src/components/today/modals/BadgesModal';
import { CommunicationTimelineDrawer } from '@/src/components/communication/CommunicationTimelineDrawer';
import type {
  BadgeType, CommunicationChannel, ReservationModalState, RoomRow, SortKey,
} from '@/src/components/today/types';
import {
  cn, formatReservationDate,
  actionOptions, getActionSelectValue, getFollowStyle, getSortValue,
  currentDateKey, currentDateShort, getDateKey, roomsData,
} from '@/src/components/today/helpers';

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
  const [journalRow, setJournalRow] = useState<RoomRow | null>(null);
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
  const [detailsRow, setDetailsRow] = useState<RoomRow | null>(null);
  const [newReservationOpen, setNewReservationOpen] = useState(false);

  /**
   * Ouvre la fiche réservation partagée (même composant que Planning + Réservations).
   * Une seule fiche pour toute l'app : cohérence totale.
   */
  const openReservation = (row: RoomRow) => {
    setDetailsRow(row);
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

  /**
   * Ouvre le formulaire de création de réservation avec la date du jour préremplie.
   * Ne crée AUCUNE réservation automatiquement : l'utilisateur doit compléter et valider.
   */
  const handleQuickReservation = () => {
    setNewReservationOpen(true);
  };

  // Dates préremplies dans NewReservationModal : aujourd'hui → demain (J+1)
  const todayPrefill = (() => {
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(t.getTime() + 86_400_000);
    const isoTomorrow = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    return { checkIn: iso, checkOut: isoTomorrow };
  })();

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
                          <td className="px-2 py-3"><ClientIdentity row={row} index={index} onClick={() => setDetailsRow(row)} /></td>
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
                      <td className="px-0 py-3 text-left relative w-10">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuRowId(openMenuRowId === row.id ? null : row.id); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"><MoreHorizontal size={18} /></button>
                        {openMenuRowId === row.id && (
                          <div className="absolute left-0 top-full z-[120] mt-1 w-60 rounded-2xl border border-gray-100 bg-white py-2 shadow-2xl">
                            <button onClick={() => { setRoomChangeModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ArrowRightLeft size={16} /></div><div><div className="font-semibold">Changement de chambre</div><div className="text-xs text-gray-400">Déloger le client</div></div></button>
                            <button onClick={() => { setCommunicationModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Send size={16} /></div><div><div className="font-semibold">Communication client</div><div className="text-xs text-gray-400">Email / WhatsApp</div></div></button>
                            <button onClick={() => { setBadgesModal(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Tag size={16} /></div><div><div className="font-semibold">Gérer les badges</div><div className="text-xs text-gray-400">VIP, Fidèle, etc.</div></div></button>
                            <button onClick={() => { setJournalRow(row); closeMenu(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-sky-50 hover:text-sky-600 transition-colors"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Clock size={16} /></div><div><div className="font-semibold">Journal des communications</div><div className="text-xs text-gray-400">Timeline unifiée</div></div></button>
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
      {detailsRow && (
        <ReservationDetailsModal
          isOpen={true}
          reservation={{
            id: detailsRow.reservationId || String(detailsRow.id),
            guestId: detailsRow.guestId ?? null,
            reservationUuid: detailsRow.reservationUuid ?? null,
            client: detailsRow.guest,
            guestName: detailsRow.guest,
            room: detailsRow.room,
            arrival: detailsRow.arrival,
            departure: detailsRow.departure,
            checkIn: detailsRow.arrival,
            checkOut: detailsRow.departure,
            source: detailsRow.source,
            status: detailsRow.status === 'check-out fait' ? 'checked_out' : detailsRow.movement === 'arrival' ? 'confirmed' : 'checked_in',
            totalAmount: detailsRow.amount || 0,
            montant: detailsRow.amount || 0,
            nights: detailsRow.nights || 1,
            guests: { adults: detailsRow.adults || detailsRow.guestCount || 1, children: 0 },
          } as any}
          onClose={() => setDetailsRow(null)}
        />
      )}
      {roomChangeModal && <RoomChangeModal row={roomChangeModal} onClose={() => setRoomChangeModal(null)} onSave={handleRoomChange} />}
      {communicationModal && <CommunicationModal row={communicationModal} onClose={() => setCommunicationModal(null)} onSend={handleMessageSent} />}
      {badgesModal && <BadgesModal row={badgesModal} onClose={() => setBadgesModal(null)} onSave={handleBadgesSave} />}
      <CommunicationTimelineDrawer
        open={Boolean(journalRow)}
        onClose={() => setJournalRow(null)}
        scope={{ guestId: journalRow?.guestId ?? null, reservationId: journalRow?.reservationUuid ?? null }}
        subtitle={journalRow ? `${journalRow.guest} · Chambre ${journalRow.room}` : undefined}
      />
      <NewReservationModal
        isOpen={newReservationOpen}
        onClose={() => setNewReservationOpen(false)}
        prefill={todayPrefill}
        onSave={async () => {
          setNewReservationOpen(false);
          showToast('Réservation créée');
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: { message: 'Réservation créée — synchronisée avec Planning et Réservations', type: 'success' },
          }));
        }}
      />
    </>
  );
};

export default OperationsTable;
