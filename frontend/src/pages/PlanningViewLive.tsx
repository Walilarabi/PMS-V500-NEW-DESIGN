import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
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
  Settings2,
  User,
  Activity,
  TrendingDown,
  Target,
  ZapOff,
  X,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Star,
  Coffee,
  Smartphone,
  StickyNote,
  DoorOpen,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReservationFormModal, { ReservationFormData } from '@/src/components/modals/ReservationFormModal';
import { RevenueKPIChart } from '@/src/components/configuration/RevenueKPIChart';
import { useReservations, Reservation } from '@/src/contexts/ReservationContext';
import type { HotelEvent, ChannelConfig } from '@/src/store/configStore';
import { useEventsStore } from '@/src/store/eventsStore';
import { aggregateEventsForDate, eventCellTone, impactLevelLabel } from '@/src/services/events-bridge.service';
import { useRealtimeKPI } from '@/src/hooks/useRealtimeKPI';
import { EventManagerModal } from '@/src/components/modals/EventManagerModal';
import { ChannelColorModal } from '@/src/components/modals/ChannelColorModal';
// Modale lourde (graphiques) — chargée à la demande pour alléger le bundle initial.
const RevenueDetailsModal = lazy(() =>
  import('@/src/components/modals/RevenueDetailsModal').then((m) => ({ default: m.RevenueDetailsModal })),
);
import { ReservationDetailsModal } from '@/src/components/modals/ReservationDetailsModal';
import { AvailabilityModal } from '@/src/components/modals/AvailabilityModal';
import { Palette } from 'lucide-react';
import { buildReservation } from '@/src/lib/reservationFactory';
import { useRooms, useUpdateRoom } from '@/src/domains/hotel/hooks';
import { useEvents, useChannels } from '@/src/domains/planning/hooks';
import { usePlanningRealtime } from '@/src/hooks/planning/usePlanningRealtime';
import type { RoomRow } from '@/src/lib/supabase.types';
import { PlanningKpiBar } from '@/src/pages/planning/PlanningKpiBar';
import { usePickup } from '@/src/hooks/planning/usePickup';
import { useMarketCompression } from '@/src/hooks/planning/useMarketCompression';
import { useForecast } from '@/src/hooks/planning/useForecast';
import { ReservationBadges } from '@/src/pages/planning/ReservationBadges';
import { deriveBadges } from '@/src/services/planning/planning-reservation-badges.service';
import { RoomRowLabel } from '@/src/pages/planning/RoomRowLabel';
import { usePlanningUiStore } from '@/src/store/planningUiStore';
import { FreeRoomsModal } from '@/src/pages/planning/FreeRoomsModal';
import { PlanningRightPanel, type RightPanelIntel } from '@/src/pages/planning/PlanningRightPanel';
import { getOccThreshold } from '@/src/pages/planning/revenueThresholds';
import { persistReservationMove } from '@/src/domains/reservations/repository';
import {
  computeDayKpi,
  computeRangeKpis,
  aggregateKpis,
  type KpiReservation,
  type KpiRoom,
} from '@/src/services/planning/planning-kpi.service';

const getContrastColor = (hexcolor: string) => {
  if (!hexcolor) return '#1e293b';
  const hex = hexcolor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#1e293b' : '#ffffff';
};

const toLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format ISO date or "YYYY-MM-DD HH:mm" → "JJ/MM/AA" (French short format).
 * Resilient to undefined / invalid input → returns '—'.
 */
const formatShortDate = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') return '—';
  const datePart = input.split(' ')[0]?.split('T')[0] ?? '';
  const parts = datePart.split('-');
  if (parts.length < 3) return '—';
  const [year, month, day] = parts;
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year.slice(-2)}`;
};

/**
 * Convertit un type de chambre long vers son code court.
 * Ex: "Twin Classique" → "TWN CL"
 */
const getRoomCode = (type: string, category: string): string => {
  const fullType = `${type} ${category}`.trim();
  
  // Mapping exact selon le fichier chambres_folkestone.xlsx
  const mapping: Record<string, string> = {
    'Twin Classique': 'TWN CL',
    'Double Deluxe': 'DBL DLX',
    'Twin Deluxe': 'TWN DLX',
    'Double Classique': 'DBL CL',
    'Double Single Use Classique': 'DSU CL',
    'Double Deluxe Terrasse': 'DBL DLX TER',
    'Double Classique Terrasse': 'DBL CL TER',
  };
  
  return mapping[fullType] || `${type.substring(0, 3).toUpperCase()} ${category.substring(0, 2).toUpperCase()}`;
};

export const PlanningView = () => {
  const { addReservation, updateReservation, reservations: contextReservations } = useReservations();
  const rmsEvents = useEventsStore((s) => s.events);

  // ── Données réelles Supabase ────────────────────────────────────────────
  const roomsQuery = useRooms();
  const eventsQuery = useEvents();
  const channelsQuery = useChannels();
  const updateRoomMut = useUpdateRoom();
  usePlanningRealtime();

  const storeRooms: RoomRow[] = roomsQuery.data ?? [];

  const storeEvents: HotelEvent[] = React.useMemo(
    () =>
      (eventsQuery.data ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        startDate: e.start_date,
        endDate: e.end_date,
        impact: e.impact,
        description: e.description ?? undefined,
        source: e.source ?? undefined,
        location: e.location ?? undefined,
      })),
    [eventsQuery.data],
  );

  const storeChannels: ChannelConfig[] = React.useMemo(
    () =>
      (channelsQuery.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
      })),
    [channelsQuery.data],
  );

  const syncStatus = roomsQuery.isLoading || eventsQuery.isLoading
    ? 'loading'
    : roomsQuery.isError
      ? 'error'
      : 'synced';

  // Calcul KPI temps réel automatique
  const kpiData = useRealtimeKPI(contextReservations, storeRooms.length, {
    start: new Date(),
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
  });
  
  const [currentDate, setCurrentDate] = useState(new Date());
  // Préférences UI persistées (collapse sidebars, mode actif).
  const leftSidebarCollapsed = usePlanningUiStore((s) => s.leftSidebarCollapsed);
  const toggleLeftSidebar = usePlanningUiStore((s) => s.toggleLeftSidebar);
  const rightSidebarCollapsed = usePlanningUiStore((s) => s.rightSidebarCollapsed);
  const toggleRightSidebar = usePlanningUiStore((s) => s.toggleRightSidebar);
  const showRightSidebar = !rightSidebarCollapsed;
  const activeMode = usePlanningUiStore((s) => s.activeMode);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDetailsRes, setSelectedDetailsRes] = useState<Reservation | null>(null);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [isFreeRoomsOpen, setIsFreeRoomsOpen] = useState(false);
  const [smartMoveEnabled, setSmartMoveEnabled] = useState(true);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);
  const [hoveredRes, setHoveredRes] = useState<Reservation | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeView, setActiveView] = useState<'7J' | '15J' | 'Mois'>('15J');
  const [displayMode, setDisplayMode] = useState<'Gantt' | 'Revenue'>('Gantt');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [activeRevCalFilter, setActiveRevCalFilter] = useState<string | null>(null);
  const [revenueSubView, setRevenueSubView] = useState<'KPI' | 'Graphiques'>('KPI');
  const [isRevenueDetailsOpen, setIsRevenueDetailsOpen] = useState(false);
  const [revenueDetailsTab, setRevenueDetailsTab] = useState<'day' | 'events' | 'channels' | 'forecast' | 'alerts' | 'score'>('day');
  const [editReservation, setEditReservation] = useState<Reservation | null>(null);
  const [confirmMove, setConfirmMove] = useState<{resId: string, newRoom: RoomRow, oldPrice: number, newPrice: number} | null>(null);
  const [isCustomizingMove, setIsCustomizingMove] = useState(false);
  const [moveCustomMode, setMoveCustomMode] = useState<'night' | 'total' | 'free'>('night');
  const [customSupplement, setCustomSupplement] = useState<number>(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Drag-select pour créer une réservation ──────────────────────────────
  const [dragSel, setDragSel] = useState<{
    roomNumber: string;
    roomType: string;
    roomCategory: string;
    startDateIdx: number;  // index dans days[]
    endDateIdx: number;    // index dans days[]
    active: boolean;
  } | null>(null);
  const [dragFormData, setDragFormData] = useState<Record<string, string> | null>(null);
  const [isMouseSelecting, setIsMouseSelecting] = useState(false);

  // Filtres planning — partagés avec la sidebar principale via planningUiStore.
  const floorFilter = usePlanningUiStore((s) => s.floorFilter);
  const typeFilter = usePlanningUiStore((s) => s.typeFilter);
  const statusFilter = usePlanningUiStore((s) => s.statusFilter);
  const [channelFilter, setChannelFilter] = useState<string>('Tous Canaux');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredEvents, setHoveredEvents] = useState<HotelEvent[] | null>(null);

  // Constants for filters — options (étage/type/statut) are presented by the
  // sidebar (PlanningSidebarSection) ; only the channel list is used here.
  const channels   = React.useMemo(() => storeChannels.map(c => c.name),                                                          [storeChannels]);

  // Filter Rooms
  const rooms = React.useMemo(() => storeRooms.filter(r => {
    const passFloor = floorFilter === 'Tous' || String(r.floor ?? '') === floorFilter;
    const passType = typeFilter === 'Tous Types' || r.type === typeFilter || r.category === typeFilter;
    const passSearch = searchQuery === '' ||
      r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.type ?? '').toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter for rooms
    const todayFilterStr = toLocalISODate(new Date());
    let passStatus = true;
    if (statusFilter === 'Libres') {
      // Free = no active reservation today (reservation-based, not room.status field)
      passStatus = !contextReservations.some(res =>
        res.room === r.number &&
        todayFilterStr >= res.arrival.split(' ')[0] &&
        todayFilterStr < res.departure.split(' ')[0] &&
        res.effectiveStatus !== 'cancelled' && res.effectiveStatus !== 'noshow'
      );
    } else if (statusFilter === 'Ménage') {
      passStatus = r.housekeeping_status === 'dirty';
    } else if (statusFilter === 'Occupées') {
      passStatus = contextReservations.some(res =>
        res.room === r.number &&
        todayFilterStr >= res.arrival.split(' ')[0] &&
        todayFilterStr < res.departure.split(' ')[0] &&
        res.effectiveStatus !== 'cancelled' && res.effectiveStatus !== 'noshow'
      );
    } else if (statusFilter === 'Arrivées') {
      passStatus = contextReservations.some(res =>
        res.room === r.number && res.arrival.startsWith(todayFilterStr)
        && res.effectiveStatus !== 'cancelled' && res.effectiveStatus !== 'noshow'
      );
    } else if (statusFilter === 'Départs') {
      passStatus = contextReservations.some(res =>
        res.room === r.number && res.departure.startsWith(todayFilterStr)
        && res.effectiveStatus !== 'cancelled' && res.effectiveStatus !== 'noshow'
      );
    }

    return passFloor && passType && passSearch && passStatus;
  }), [storeRooms, floorFilter, typeFilter, statusFilter, searchQuery, contextReservations]);

  const [monthDate, setMonthDate] = React.useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = React.useState(false);
  const monthPickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Écouter les raccourcis clavier globaux (dispatched depuis App.tsx) ──
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      switch (detail?.action) {
        case 'prev': handlePrev(); break;
        case 'next': handleNext(); break;
        case 'datepicker': setShowMonthPicker(v => !v); break;
        case 'view15': setActiveView('15J'); break;
        case 'viewWeek': setActiveView('7J'); break;
        case 'zoomIn': {
          if (activeView === 'Mois') setActiveView('15J');
          else if (activeView === '15J') setActiveView('7J');
          break;
        }
        case 'zoomOut': {
          if (activeView === '7J') setActiveView('15J');
          else if (activeView === '15J') setActiveView('Mois');
          break;
        }
      }
    };
    window.addEventListener('flowtym:planning-nav', handler);
    return () => window.removeEventListener('flowtym:planning-nav', handler);
  });

  // Navigation handlers

  const handlePrev = () => {
    if (displayMode === 'Revenue') {
      setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - (activeView === '7J' ? 7 : activeView === '15J' ? 15 : 30));
      setCurrentDate(next);
    }
  };

  const handleNext = () => {
    if (displayMode === 'Revenue') {
      setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + (activeView === '7J' ? 7 : activeView === '15J' ? 15 : 30));
      setCurrentDate(next);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetRoom: RoomRow) => {
    e.preventDefault();
    if (!smartMoveEnabled) return;
    const resId = e.dataTransfer.getData('text/plain');
    if (!resId) return;

    const res = contextReservations.find(r => r.id === resId);
    if (!res) return;

    if (res.room === targetRoom.number) return; // Same room

    // Verify availability
    const arrivalTime = new Date(res.arrival).getTime();
    const departureTime = new Date(res.departure).getTime();
    
    const hasConflict = contextReservations.some(otherRes => {
      if (otherRes.id === res.id) return false;
      if (otherRes.room !== targetRoom.number) return false;
      const oArr = new Date(otherRes.arrival).getTime();
      const oDep = new Date(otherRes.departure).getTime();
      if (isNaN(oArr) || isNaN(oDep) || isNaN(arrivalTime) || isNaN(departureTime)) return false;
      return Math.max(arrivalTime, oArr) < Math.min(departureTime, oDep);
    });

    if (hasConflict) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `La chambre ${targetRoom.number} est déjà  occupée sur ces dates.` } }));
      return;
    }

    const getPriceByCategory = (cat?: string) => {
      switch (cat) {
        case 'SUP': return 150;
        case 'DLX': return 200;
        case 'JS': return 280;
        case 'STE': return 350;
        case 'CL': return 100;
        default: return 120; // Default generic price
      }
    };

    const oldRoom = storeRooms.find(r => r.number === res.room);
    const oldPrice = oldRoom?.base_price ?? getPriceByCategory(oldRoom?.category ?? undefined);
    const newPrice = targetRoom.base_price ?? getPriceByCategory(targetRoom.category ?? undefined);

    if (oldRoom?.category !== targetRoom.category) {
      setConfirmMove({ resId, newRoom: targetRoom, oldPrice, newPrice });
    } else {
      updateReservation(resId, { room: targetRoom.number, roomType: targetRoom.type ?? undefined });
      // Persistance DB (corrige P6 : le déplacement survit au rechargement).
      persistReservationMove({ id: resId, roomId: targetRoom.id, roomNumber: targetRoom.number })
        .then(() => window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Réservation déplacée en chambre ${targetRoom.number}` } })))
        .catch((e) => window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Échec de l'enregistrement du déplacement : ${e instanceof Error ? e.message : 'erreur'}` } })));
    }
  };

  const handleConfirmMove = () => {
    if (!confirmMove) return;
    const { resId, newRoom, oldPrice, newPrice } = confirmMove;
    const res = contextReservations.find(r => r.id === resId);
    if (res) {
      let diff = newPrice - oldPrice;
      const stayLength = Math.ceil((new Date(res.departure).getTime() - new Date(res.arrival).getTime()) / (1000 * 60 * 60 * 24));
      const days = isNaN(stayLength) ? 1 : stayLength;
      let note = `Délogement avec tarif maj: ${newRoom.number} (${newPrice}€/nuit)`;

      if (isCustomizingMove) {
        if (moveCustomMode === 'free') {
          diff = 0;
          note = `Délogement vers ${newRoom.number} (Surclassement offert)`;
        } else if (moveCustomMode === 'night') {
          diff = customSupplement;
          note = `Délogement vers ${newRoom.number} avec supplément/remise de ${customSupplement}€/nuit`;
        } else if (moveCustomMode === 'total') {
          diff = customSupplement / days;
          note = `Délogement vers ${newRoom.number} avec supplément/remise global de ${customSupplement}€`;
        }
      }

      const newTotal = (res.totalAmount || 0) + (diff * days);
      
      updateReservation(resId, {
        room: newRoom.number,
        roomType: newRoom.type ?? undefined,
        totalAmount: newTotal,
        logs: [{ timestamp: new Date().toISOString(), action: note, userId: 'user' }]
      });
      // Persistance DB : chambre + nouveau total (cohérence prix/DB).
      persistReservationMove({ id: resId, roomId: newRoom.id, roomNumber: newRoom.number, totalAmount: newTotal })
        .then(() => window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: `Délogement confirmé. Nouveau total: ${newTotal.toFixed(2)}€` }
        })))
        .catch((e) => window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: `Échec de l'enregistrement : ${e instanceof Error ? e.message : 'erreur'}` }
        })));
    }
    setConfirmMove(null);
    setIsCustomizingMove(false);
  };

  const handleIgnoreMove = () => {
    if (!confirmMove) return;
    const { resId, newRoom } = confirmMove;
    updateReservation(resId, {
      room: newRoom.number,
      roomType: newRoom.type ?? undefined,
      logs: [{ timestamp: new Date().toISOString(), action: `Délogement sans changement de prix: ${newRoom.number}`, userId: 'user' }]
    });
    // Persistance DB (chambre uniquement, prix maintenu).
    persistReservationMove({ id: resId, roomId: newRoom.id, roomNumber: newRoom.number })
      .catch((e) => window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Échec de l'enregistrement : ${e instanceof Error ? e.message : 'erreur'}` }
      })));
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `Délogement effectué. Prix maintenu.` }
    }));
    setConfirmMove(null);
    setIsCustomizingMove(false);
  };
  const handleToday = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    setCurrentDate(today);
    setMonthDate(today);
  };

  const viewLength = activeView === '7J' ? 7 : activeView === '15J' ? 15 : 31;
  const colWidth = 100 / viewLength; // percentage

  // ── KPIs planning (source unique : planning-kpi.service) ─────────────────
  // Les réservations du contexte sont synchronisées depuis Supabase ; on les
  // mappe vers le sous-ensemble pur consommé par le moteur KPI centralisé.
  const kpiReservations = React.useMemo<KpiReservation[]>(() => {
    const looseToIso = (s?: string): string => {
      if (!s) return '';
      const head = s.split(' ')[0].split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
      const d = new Date(s);
      return isNaN(d.getTime()) ? '' : toLocalISODate(d);
    };
    return contextReservations.map((r) => {
      const status = r.effectiveStatus === 'noshow' ? 'no_show' : (r.effectiveStatus ?? 'confirmed');
      return {
        check_in: r.checkIn || looseToIso(r.arrival),
        check_out: r.checkOut || looseToIso(r.departure),
        nights: r.nights ?? null,
        status,
        total_amount: r.totalAmount ?? null,
      };
    }).filter((r) => r.check_in && r.check_out);
  }, [contextReservations]);

  const kpiRooms = React.useMemo<KpiRoom[]>(
    () => storeRooms.map((r) => ({ id: r.id, active: r.active ?? true, status: r.status ?? null })),
    [storeRooms],
  );

  const visibleDayKpis = React.useMemo(
    () => computeRangeKpis(currentDate, viewLength, kpiReservations, kpiRooms),
    [currentDate, viewLength, kpiReservations, kpiRooms],
  );
  const visibleSummary = React.useMemo(() => aggregateKpis(visibleDayKpis), [visibleDayKpis]);
  const todayKpi = React.useMemo(
    () => computeDayKpi(new Date(), kpiReservations, kpiRooms),
    [kpiReservations, kpiRooms],
  );

  // Numéros de chambre occupés aujourd'hui (pour la modale chambres libres).
  const todayOccupiedNumbers = React.useMemo(() => {
    const todayStr = toLocalISODate(new Date());
    const set = new Set<string>();
    contextReservations.forEach((res) => {
      if (res.effectiveStatus === 'cancelled' || res.effectiveStatus === 'noshow' || !res.room) return;
      const ci = (res.checkIn || res.arrival).split(' ')[0].split('T')[0];
      const co = (res.checkOut || res.departure).split(' ')[0].split('T')[0];
      if (ci <= todayStr && todayStr < co) set.add(res.room);
    });
    return set;
  }, [contextReservations]);

  // Ratio chambres propres (housekeeping) — pour la vue rapide opérationnelle.
  const hkCleanRatio = React.useMemo(() => {
    if (storeRooms.length === 0) return 0;
    const clean = storeRooms.filter((r) => r.housekeeping_status === 'clean' || r.housekeeping_status === 'inspected').length;
    return (clean / storeRooms.length) * 100;
  }, [storeRooms]);

  // Check-in en ligne effectués aujourd'hui.
  const onlineCheckinsToday = React.useMemo(() => {
    const todayStr = toLocalISODate(new Date());
    return contextReservations.filter((res) => {
      if (res.checkinStatus !== 'online') return false;
      const ci = (res.checkIn || res.arrival).split(' ')[0].split('T')[0];
      return ci === todayStr;
    }).length;
  }, [contextReservations]);

  // Snapshot horizon fixe J+0..J+30 (indépendant de la plage affichée) pour un
  // pickup couvrant tout l'horizon de réservation.
  const snapshotKpis = React.useMemo(
    () => computeRangeKpis(new Date(), 31, kpiReservations, kpiRooms),
    [kpiReservations, kpiRooms],
  );
  const pickup = usePickup(new Date(), 31, snapshotKpis);
  const compression = useMarketCompression(currentDate, viewLength);

  // Événements actifs intersectant la plage affichée.
  const rangeEventsCount = React.useMemo(() => {
    if (visibleDayKpis.length === 0) return 0;
    const start = visibleDayKpis[0].date;
    const end = visibleDayKpis[visibleDayKpis.length - 1].date;
    return storeEvents.filter((e) => e.startDate <= end && e.endDate >= start).length;
  }, [storeEvents, visibleDayKpis]);

  // Forecast d'occupation auto (calculé, jamais saisi) par jour visible.
  const forecast = useForecast(visibleDayKpis, pickup.byDate, compression.byDate, kpiReservations);
  // Forecast moyen de la plage (pour la barre KPI).
  const avgForecast = React.useMemo(() => {
    const vals = visibleDayKpis.map((d) => forecast.byDate[d.date]).filter((v) => v != null) as number[];
    return vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  }, [visibleDayKpis, forecast.byDate]);

  const days = React.useMemo(() => {
    return Array.from({ length: viewLength }, (_, i) => {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      const dateStr = toLocalISODate(date);

      // Source unique : moteur KPI centralisé (cohérent avec la barre KPI).
      const kpi = visibleDayKpis[i];

      const dayEvents = storeEvents.filter(e => {
          return dateStr >= e.startDate && dateStr <= e.endDate;
      });

      const pk = pickup.byDate[dateStr];
      const comp = compression.byDate[dateStr];

      return {
        id: `day-${date.getTime()}`,
        dateStr,
        dateNum: date.getDate(),
        dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
        monthName: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'][date.getMonth()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        occ: kpi ? Math.round(kpi.toRate) : 0,
        available: kpi ? kpi.free : 0,
        adr: kpi ? Math.round(kpi.adr) : 0,
        events: dayEvents,
        forecast: forecast.byDate[dateStr] ?? null,
        pickupRooms: pk && !pk.noBaseline ? pk.rooms : null,
        pickupRevenue: pk && !pk.noBaseline ? pk.revenue : null,
        compressionPercent: comp?.percent ?? null,
      };
    });
  }, [storeEvents, currentDate, viewLength, visibleDayKpis, forecast.byDate, pickup.byDate, compression.byDate]);

  // Intelligence du jour de référence (premier jour visible) pour le volet droit.
  const rightPanelIntel = React.useMemo<RightPanelIntel>(() => {
    const d = days[0];
    const ev = d?.events[0] ?? null;
    const impactFr: Record<string, string> = { low: 'Faible', medium: 'Moyen', high: 'Fort', critical: 'Très fort' };
    return {
      dateLabel: d ? `${d.dateNum} ${d.monthName}` : '',
      toRate: d?.occ ?? 0,
      forecast: d?.forecast ?? null,
      adr: d?.adr ?? 0,
      revpar: visibleDayKpis[0]?.revpar ?? 0,
      pickupRooms: d?.pickupRooms ?? null,
      pickupRevenue: d?.pickupRevenue ?? null,
      compressionPercent: d?.compressionPercent ?? null,
      eventName: ev?.name ?? null,
      eventImpact: ev ? (impactFr[ev.impact] ?? ev.impact) : null,
    };
  }, [days, visibleDayKpis]);

  const calendarDays = React.useMemo(() => {
    const today = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1); // start of current month
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    // Use total sellable rooms (not filtered) as the denominator for TO and RevPAR
    const totalRooms = storeRooms.filter(r => r.active !== false && r.status !== 'out_of_order' && r.status !== 'maintenance').length || storeRooms.length;
    const result = [];
    for (let i = 1; i <= lastDay; i++) {
      const date = new Date(year, month, i);
      const dateStr = toLocalISODate(date);
      const occupiedRes = contextReservations.filter(res => {
        try {
          const start = new Date(res.arrival).getTime();
          const end = new Date(res.departure).getTime();
          const current = date.getTime();
          return !isNaN(start) && !isNaN(end) && current >= start && current < end
            && res.effectiveStatus !== 'cancelled' && res.effectiveStatus !== 'noshow';
        } catch { return false; }
      });
      const occupiedCount = occupiedRes.length;
      const dayEvents = storeEvents.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
      const occ = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

      // Per-night revenue: each reservation contributes its prorated daily amount
      const ca = occupiedRes.reduce((sum, res) => sum + res.revenuePerNight, 0);
      const adr = occupiedCount > 0 ? Math.round(ca / occupiedCount) : 0;

      result.push({
        date,
        dateStr,
        dateNum: i,
        dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
        isToday: i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear(),
        occ,
        ca,
        adr,
        revpar: totalRooms > 0 ? ca / totalRooms : 0,
        events: dayEvents,
      });
    }
    return result;
  }, [contextReservations, storeEvents, storeRooms, monthDate]);

  const revenueBaselines = React.useMemo(() => {
    const avgAdr = calendarDays.length ? calendarDays.reduce((sum, d) => sum + d.adr, 0) / calendarDays.length : 0;
    const avgRevpar = calendarDays.length ? calendarDays.reduce((sum, d) => sum + d.revpar, 0) / calendarDays.length : 0;
    return { avgAdr, avgRevpar };
  }, [calendarDays]);

  const revenueInsightsByDate = React.useMemo(() => {
    const byDate: Record<string, {
      score: number;
      demandLevel: 'strong' | 'normal' | 'weak';
      riskLevel: 'high' | 'medium' | 'low';
      recommendedAction: string;
      recommendedDeltaPct: number;
      pickupSignal: number;
    }> = {};

    calendarDays.forEach((day) => {
      const adrIndex = revenueBaselines.avgAdr > 0 ? (day.adr / revenueBaselines.avgAdr) * 100 : 100;
      const revparIndex = revenueBaselines.avgRevpar > 0 ? (day.revpar / revenueBaselines.avgRevpar) * 100 : 100;
      const eventBoost = Math.min(100, day.events.length * 18);
      const pickupSignal = Math.max(-15, Math.min(25, Math.round(((day.occ - 68) / 2) + (eventBoost / 12))));

      const score = Math.max(
        35,
        Math.min(
          99,
          Math.round((day.occ * 0.4) + (adrIndex * 0.25) + (revparIndex * 0.25) + (eventBoost * 0.1))
        )
      );

      const demandLevel: 'strong' | 'normal' | 'weak' = day.occ >= 85 || (day.events.length > 0 && day.occ >= 75)
        ? 'strong'
        : day.occ >= 65
          ? 'normal'
          : 'weak';

      let recommendedAction = 'Maintenir la stratégie tarifaire.';
      let recommendedDeltaPct = 0;
      let riskLevel: 'high' | 'medium' | 'low' = 'low';

      if (demandLevel === 'strong') {
        recommendedDeltaPct = day.occ >= 92 ? 12 : 8;
        recommendedAction = `Augmenter BAR de +${recommendedDeltaPct}% et fermer les classes basses.`;
        riskLevel = day.occ >= 96 ? 'medium' : 'low';
      } else if (demandLevel === 'normal') {
        recommendedDeltaPct = 3;
        recommendedAction = 'Optimiser mix canal: pousser direct web et limiter OTA commissionnées.';
        riskLevel = day.events.length > 0 ? 'medium' : 'low';
      } else {
        recommendedDeltaPct = -7;
        recommendedAction = 'Activer offre mobile/direct et package séjour pour relancer pickup.';
        riskLevel = 'high';
      }

      byDate[day.dateStr] = { score, demandLevel, riskLevel, recommendedAction, recommendedDeltaPct, pickupSignal };
    });

    return byDate;
  }, [calendarDays, revenueBaselines.avgAdr, revenueBaselines.avgRevpar]);

  const monthlyScore = React.useMemo(() => {
    const values = Object.values(revenueInsightsByDate) as Array<{ score: number }>;
    if (values.length === 0) return 0;
    return Math.round(values.reduce((s, d) => s + d.score, 0) / values.length);
  }, [revenueInsightsByDate]);

  const monthlyScoreLabel = monthlyScore >= 85 ? 'Excellent mois'
    : monthlyScore >= 75 ? 'Bon mois'
    : monthlyScore >= 65 ? 'Mois moyen'
    : 'Mois difficile';

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

  const addOneNight = React.useCallback((isoDate: string) => {
    const next = new Date(`${isoDate}T00:00:00`);
    next.setDate(next.getDate() + 1);
    return toLocalISODate(next);
  }, []);

  const isCellReserved = React.useCallback((roomNumber: string, dateStr: string) => {
    return contextReservations.some((res) => {
      if (res.room !== roomNumber) return false;
      const start = res.arrival.split(' ')[0];
      const end = res.departure.split(' ')[0];
      return dateStr >= start && dateStr < end;
    });
  }, [contextReservations]);

  const hasReservedNightsInRange = React.useCallback((roomNumber: string, startIdx: number, departureIdx: number) => {
    for (let i = startIdx; i < departureIdx; i += 1) {
      if (isCellReserved(roomNumber, days[i].dateStr)) return true;
    }
    return false;
  }, [days, isCellReserved]);

  const openQuickReservationFromDrag = React.useCallback((selection: NonNullable<typeof dragSel>) => {
    const startIdx = Math.min(selection.startDateIdx, selection.endDateIdx);
    const endIdx = Math.max(selection.startDateIdx, selection.endDateIdx);
    const checkIn = days[startIdx]?.dateStr;
    if (!checkIn) return;

    const checkOut = startIdx === endIdx
      ? addOneNight(checkIn)
      : (days[endIdx]?.dateStr ?? addOneNight(checkIn));

    const departureIndexForValidation = startIdx === endIdx ? startIdx + 1 : endIdx;
    if (departureIndexForValidation <= startIdx) return;

    if (hasReservedNightsInRange(selection.roomNumber, startIdx, departureIndexForValidation)) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Impossible: au moins une nuit est déjà réservée pour la chambre ${selection.roomNumber}.` }
      }));
      return;
    }

    setDragFormData({
      roomNumber: selection.roomNumber,
      category: selection.roomCategory,
      roomType: `${selection.roomCategory}/${selection.roomType}`,
      checkIn,
      checkOut
    });
    setIsModalOpen(true);
  }, [addOneNight, days, hasReservedNightsInRange]);

  const handleGridCellMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>, room: RoomRow, dateIdx: number) => {
    if (e.button !== 0) return;
    if (!days[dateIdx]) return;
    if (isCellReserved(room.number, days[dateIdx].dateStr)) return;

    e.preventDefault();
    setIsMouseSelecting(true);
    setDragSel({
      roomNumber: room.number,
      roomType: room.type ?? '',
      roomCategory: room.category ?? '',
      startDateIdx: dateIdx,
      endDateIdx: dateIdx,
      active: true,
    });
  }, [days, isCellReserved]);

  const handleGridCellMouseEnter = React.useCallback((room: RoomRow, dateIdx: number) => {
    setDragSel((prev) => {
      if (!prev?.active) return prev;
      if (prev.roomNumber !== room.number) return prev;
      if (!days[dateIdx]) return prev;
      if (isCellReserved(room.number, days[dateIdx].dateStr)) return prev;
      return { ...prev, endDateIdx: dateIdx };
    });
  }, [days, isCellReserved]);

  const handleGridMouseUp = React.useCallback(() => {
    setIsMouseSelecting(false);
    setDragSel((prev) => {
      if (!prev?.active) return null;
      openQuickReservationFromDrag(prev);
      return null;
    });
  }, [openQuickReservationFromDrag]);

  React.useEffect(() => {
    const onMouseUp = () => {
      if (!isMouseSelecting) return;
      handleGridMouseUp();
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [handleGridMouseUp, isMouseSelecting]);

  // Préparer données pour modal disponibilité
  const availabilityData = React.useMemo(() => {
    // Grouper chambres par catégorie
    const categoriesMap = new Map<string, { category: string; totalRooms: number; occupiedByDate: Record<string, Set<string>> }>();
    
    storeRooms.forEach(room => {
      const category = `${room.type ?? ''} ${room.category ?? ''}`.trim();
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, { category, totalRooms: 0, occupiedByDate: {} });
      }
      categoriesMap.get(category)!.totalRooms++;
    });

    // Calculer occupation par date pour chaque catégorie
    contextReservations.forEach(res => {
      if (res.effectiveStatus === 'cancelled' || res.effectiveStatus === 'noshow' || !res.room) return;

      const room = storeRooms.find(r => r.number === res.room);
      if (!room) return;

      const category = `${room.type ?? ''} ${room.category ?? ''}`.trim();
      const catData = categoriesMap.get(category);
      if (!catData) return;
      
      const checkIn = new Date(res.checkIn || res.arrival);
      const checkOut = new Date(res.checkOut || res.departure);
      
      // Marquer chambre occupée pour chaque nuit
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        const dateKey = toLocalISODate(d);
        if (!catData.occupiedByDate[dateKey]) {
          catData.occupiedByDate[dateKey] = new Set();
        }
        catData.occupiedByDate[dateKey].add(res.room);
      }
    });
    
    // Convertir Sets en counts
    return Array.from(categoriesMap.values()).map(cat => ({
      category: cat.category,
      totalRooms: cat.totalRooms,
      occupiedByDate: Object.fromEntries(
        Object.entries(cat.occupiedByDate).map(([date, rooms]) => [date, rooms.size])
      )
    }));
  }, [storeRooms, contextReservations]);

  if (syncStatus === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#F8FAFC] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Chargement du planning…</p>
      </div>
    );
  }

  if (syncStatus === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#F8FAFC] gap-3">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-sm text-slate-700 font-medium">Impossible de charger le planning</p>
        <p className="text-xs text-slate-400">Vérifiez votre connexion et rechargez la page.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden font-sans select-none" onMouseMove={handleMouseMove}>
      {/* Top Header Bar */}
      <div className="h-[72px] shrink-0 border-b border-gray-100 flex items-center justify-between px-6 bg-white z-[60]">
        <div className="flex items-center gap-6">
          {displayMode === 'Gantt' ? (
            <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
              <button onClick={() => setActiveView('7J')} className={cn("px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", activeView === '7J' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>Semaine</button>
              <button onClick={() => setActiveView('15J')} className={cn("px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", activeView === '15J' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>15J</button>
              <button onClick={() => setActiveView('Mois')} className={cn("px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", activeView === 'Mois' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>Mois</button>
            </div>
          ) : (
            <div className="flex items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-3">Vue :</span>
               <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Mois</span>
            </div>
          )}

          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 ml-4">
            <button onClick={() => setDisplayMode('Gantt')} className={cn("flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", displayMode === 'Gantt' ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>
              <LayoutGrid size={14} /> Gantt
            </button>
            <button onClick={() => setDisplayMode('Revenue')} className={cn("flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all", displayMode === 'Revenue' ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}>
              <TrendingUp size={14} /> Calendrier Revenu
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

          <div className="relative" ref={monthPickerRef}>
            <div 
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="px-6 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3 cursor-pointer group"
            >
               <CalendarIcon className="text-indigo-500" size={16} />
               <span className="text-xs font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">
                 {displayMode === 'Gantt' ? (
                   `${days[0]?.dayName.toLowerCase()}. ${days[0]?.dateNum} ${days[0]?.monthName.toLowerCase()} — ${days[days.length-1]?.dayName.toLowerCase()}. ${days[days.length-1]?.dateNum} ${days[days.length-1]?.monthName.toLowerCase()} ${currentDate.getFullYear()}`
                 ) : (
                   `Planning Revenue — ${monthDate.toLocaleString('default', { month: 'long' })} ${monthDate.getFullYear()}`
                 )}
               </span>
               <ChevronDown className={cn("text-indigo-400 group-hover:text-indigo-600 transition-transform", showMonthPicker && "rotate-180")} size={16} />
            </div>

            <AnimatePresence>
              {showMonthPicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
                >
                  <div className="grid grid-cols-3 gap-1 p-3">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const d = new Date(new Date().getFullYear(), i, 1);
                      const isCurrent = i === (displayMode === 'Gantt' ? currentDate.getMonth() : monthDate.getMonth());
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const newDate = new Date(displayMode === 'Gantt' ? currentDate.getFullYear() : monthDate.getFullYear(), i, 1);
                            if (displayMode === 'Gantt') {
                              setCurrentDate(newDate);
                            } else {
                              setMonthDate(newDate);
                            }
                            setShowMonthPicker(false);
                          }}
                          className={cn(
                            "py-2.5 px-1 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all",
                            isCurrent ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                          )}
                        >
                          {d.toLocaleString('default', { month: 'short' })}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

          {/* Filtre canal — Étage/Type/Statut vivent dans la sidebar (maquette) */}
          <div className="flex items-center gap-2 px-2 bg-gray-50 border border-gray-100 rounded-2xl">
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
             {displayMode === 'Gantt' && (
               <button
                 onClick={toggleLeftSidebar}
                 title={leftSidebarCollapsed ? "Déployer la colonne chambres" : "Réduire la colonne chambres"}
                 aria-label={leftSidebarCollapsed ? "Déployer la colonne chambres" : "Réduire la colonne chambres"}
                 aria-pressed={leftSidebarCollapsed}
                 className={cn("p-2.5 rounded-xl transition-all", leftSidebarCollapsed ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50")}
               >
                 {leftSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
               </button>
             )}
             {displayMode === 'Gantt' && (
               <button
                 onClick={toggleRightSidebar}
                 title="Volet intelligence (droite)"
                 aria-label="Afficher/masquer le volet intelligence"
                 aria-pressed={showRightSidebar}
                 className={cn("p-2.5 rounded-xl transition-all", showRightSidebar ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50")}
               >
                 <Eye size={18} />
               </button>
             )}
             <button
               onClick={() => setShowSettingsPanel(true)}
               className={cn("p-2.5 rounded-xl transition-all", showSettingsPanel ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50")}
             >
               <Settings2 size={18} />
             </button>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-xl shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Barre KPI compacte (Gantt) — données réelles, source unique */}
      {displayMode === 'Gantt' && (
        <PlanningKpiBar
          toRate={visibleSummary.avgToRate}
          adr={visibleSummary.avgAdr}
          revpar={visibleSummary.avgRevpar}
          forecast={avgForecast}
          occupied={todayKpi.occupied}
          totalRooms={todayKpi.totalRooms}
          free={todayKpi.free}
          pickupRooms={pickup.noBaseline ? null : pickup.totalRooms}
          pickupRevenue={pickup.noBaseline ? null : pickup.totalRevenue}
          compressionPercent={compression.avgPercent}
          compressionLevel={
            compression.avgPercent == null
              ? null
              : compression.avgPercent <= 40
                ? 'low'
                : compression.avgPercent <= 60
                  ? 'medium'
                  : compression.avgPercent <= 80
                    ? 'high'
                    : 'critical'
          }
          eventsCount={rangeEventsCount}
          heatmap={visibleDayKpis.map((d) => ({ date: d.date, toRate: d.toRate }))}
          onFreeRoomsClick={() => setIsFreeRoomsOpen(true)}
          onEventsClick={() => setIsEventModalOpen(true)}
          pickupLoading={pickup.isLoading}
          compressionLoading={compression.isLoading}
        />
      )}

      {/* Revenue Top Dashboard */}
      {displayMode === 'Revenue' && (
        <div className="bg-white border-b border-gray-100 px-8 py-6 flex items-center justify-between gap-6 shrink-0">
           <div className="flex-1 grid grid-cols-5 gap-6">
              {[
                  { label: 'TO', val: `${kpiData.to.toFixed(1)}%`, trend: `${kpiData.roomsSold}/${storeRooms.length} chambres`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50/40', border: 'border-emerald-100/50' },
                  { label: 'CA total', val: `${kpiData.totalRevenue.toLocaleString('fr-FR')} €`, trend: `${kpiData.reservationsCount} réservations`, icon: Euro, color: 'text-indigo-600', bg: 'bg-indigo-50/40', border: 'border-indigo-100/50' },
                  { label: 'RevPAR', val: `${kpiData.revpar.toFixed(1)} €`, trend: `Chambres vendues: ${kpiData.roomsSold}`, icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50/40', border: 'border-violet-100/50' },
                  { label: 'ADR', val: `${kpiData.adr.toFixed(1)} €`, trend: `Dispo restante: ${kpiData.availableRooms}`, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50/40', border: 'border-amber-100/50' },
               ].map((kpi, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setRevenueDetailsTab('day'); setIsRevenueDetailsOpen(true); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevenueDetailsTab('day'); setIsRevenueDetailsOpen(true); } }}
                    className={cn('p-5 rounded-3xl border transition-all cursor-pointer group hover:shadow-xl hover:shadow-gray-200/50', kpi.bg, kpi.border)}
                  >
                    <div className="flex items-center justify-between mb-3">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{kpi.label}</span>
                          <span className={cn("text-xl font-black", kpi.color)}>{kpi.val}</span>
                       </div>
                       <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", kpi.bg.replace('/40', '/60'))}>
                          <kpi.icon size={18} className={kpi.color} />
                       </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <span className="text-[10px] font-black text-emerald-500">{kpi.trend}</span>
                    </div>
                 </div>
               ))}
              <div 
                onClick={() => {
                   setRevenueDetailsTab('score');
                   setIsRevenueDetailsOpen(true);
                }}
                className="p-5 rounded-3xl border border-indigo-100 bg-indigo-50/30 flex items-center gap-4 cursor-pointer hover:bg-white hover:shadow-xl transition-all group"
              >
                 <div className="relative w-16 h-16 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                       <circle cx="18" cy="18" r="16" fill="none" className="stroke-white" strokeWidth="4" />
                       <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-500" strokeWidth="4" strokeDasharray={`${monthlyScore} 100`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-indigo-600">{monthlyScore}</div>
                 </div>
                 <div>
                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Score mensuel</div>
                    <div className="flex items-baseline gap-1">
                       <span className="text-lg font-black text-indigo-600">{monthlyScore}</span>
                       <span className="text-[10px] font-black text-gray-400">/100</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-indigo-400 uppercase">{monthlyScoreLabel}</span>
                       <ChevronRight size={10} className="text-indigo-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Legend Bar */}
      {displayMode === 'Gantt' && (
        <div className="h-12 shrink-0 border-b border-gray-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 z-50">
          <div className="flex items-center gap-6">
             {storeChannels.slice(0, 5).map(channel => (
               <div key={channel.id} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm opacity-80 transition-all" 
                    style={{ backgroundColor: channel.color }}
                  />
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{channel.name}</span>
               </div>
             ))}
             
             <button 
               onClick={() => setIsChannelModalOpen(true)}
               className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all group ml-2"
             >
                <div className="relative">
                  <Palette size={16} />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center">
                    <Plus size={8} className="text-white" />
                  </div>
                </div>
             </button>
          </div>
  
          <div className="flex items-center gap-6">
              {/* Statuts */}
              {[
                { label: 'Option', dot: '#FDE047', pattern: true },
                { label: 'Pending', dot: '#FB923C', pattern: false },
                { label: 'Confirmée', dot: '#6366F1', pattern: false },
                { label: 'Annulée', dot: '#9CA3AF', pattern: false },
                { label: 'No-show', dot: '#EF4444', pattern: false },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-sm opacity-80" style={{ backgroundColor: s.dot, backgroundImage: s.pattern ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 4px)' : undefined }} />
                   <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 9, fontWeight: 900, background: '#DC2626', color: '#fff', padding: '2px 6px', borderRadius: 5 }}>OB</span>
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Overbooking</span>
              </div>
           </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Unit Sidebar */}
        {displayMode === 'Gantt' && (
          <div className={cn("flex flex-col bg-white border-r border-gray-100 shrink-0 z-40 transition-[width] duration-200 ease-out", leftSidebarCollapsed ? "w-[68px]" : "w-[170px]")}>
           {/* En-tête colonne — aligné avec la ligne DATES (56px) */}
           <div className="h-[56px] flex items-center px-4 border-r border-b border-gray-100 bg-white">
              <span className={cn("text-[10px] font-black text-gray-400 uppercase tracking-widest", leftSidebarCollapsed && "hidden")}>Chambres</span>
              <span className={cn("text-[10px] font-black text-gray-300 uppercase tracking-widest ml-auto", leftSidebarCollapsed && "hidden")}>État</span>
           </div>
           {/* Libellés indicateurs — alignés aux lignes du header (6 × 34px) */}
           <div className={cn("flex flex-col border-b border-gray-100", leftSidebarCollapsed && "[&_button]:justify-center [&_button]:px-0 [&_span]:hidden")}>
               <button onClick={() => { setRevenueDetailsTab('day'); setIsRevenueDetailsOpen(true); }} className='h-[34px] flex items-center px-4 gap-2 text-gray-400 group hover:bg-gray-50 transition-all outline-none border-none border-b border-gray-50 bg-transparent w-full text-left'>
                  <TrendingUp size={12} className='group-hover:text-indigo-400 transition-colors shrink-0' />
                  <span className='text-[9px] font-black uppercase tracking-widest'>TO (réel)</span>
               </button>
               <button onClick={() => { setRevenueDetailsTab('forecast'); setIsRevenueDetailsOpen(true); }} className='h-[34px] flex items-center px-4 gap-2 text-gray-400 group hover:bg-gray-50 transition-all outline-none border-none border-b border-gray-50 bg-sky-50/20 w-full text-left'>
                  <LineChart size={12} className='group-hover:text-sky-400 transition-colors shrink-0' />
                  <span className='text-[9px] font-black uppercase tracking-widest'>Forecast</span>
               </button>
               <button onClick={() => { setRevenueDetailsTab('forecast'); setIsRevenueDetailsOpen(true); }} className='h-[34px] flex items-center px-4 gap-2 text-gray-400 group hover:bg-gray-50 transition-all outline-none border-none border-b border-gray-50 bg-transparent w-full text-left'>
                  <ArrowUpRight size={12} className='group-hover:text-emerald-400 transition-colors shrink-0' />
                  <span className='text-[9px] font-black uppercase tracking-widest'>Pickup (ch.)</span>
               </button>
               <button onClick={() => { setRevenueDetailsTab('forecast'); setIsRevenueDetailsOpen(true); }} className='h-[34px] flex items-center px-4 gap-2 text-gray-400 group hover:bg-gray-50 transition-all outline-none border-none border-b border-gray-50 bg-gray-50/30 w-full text-left'>
                  <Euro size={12} className='group-hover:text-emerald-400 transition-colors shrink-0' />
                  <span className='text-[9px] font-black uppercase tracking-widest'>Pickup (rev.)</span>
               </button>
               <button onClick={() => { setRevenueDetailsTab('day'); setIsRevenueDetailsOpen(true); }} className='h-[34px] flex items-center px-4 gap-2 text-gray-400 group hover:bg-gray-50 transition-all outline-none border-none border-b border-gray-50 bg-transparent w-full text-left'>
                  <Gauge size={12} className='group-hover:text-indigo-400 transition-colors shrink-0' />
                  <span className='text-[9px] font-black uppercase tracking-widest'>Comp. marché</span>
               </button>
               <button onClick={() => setIsFreeRoomsOpen(true)} className='h-[34px] flex items-center px-4 gap-2 text-gray-400 group hover:bg-gray-50 transition-all outline-none border-none border-b border-gray-50 bg-sky-50/10 w-full text-left'>
                  <DoorOpen size={12} className='group-hover:text-sky-400 transition-colors shrink-0' />
                  <span className='text-[9px] font-black uppercase tracking-widest'>Ch. libres</span>
               </button>
               <button onClick={() => setIsEventModalOpen(true)} className='h-[34px] flex items-center px-4 gap-2 text-gray-400 group hover:bg-gray-50 transition-all outline-none border-none bg-gray-50/30 w-full text-left'>
                  <Zap size={12} className='group-hover:text-indigo-400 transition-colors shrink-0' />
                  <span className='text-[9px] font-black uppercase tracking-widest'>Événements</span>
               </button>
           </div>

           <div ref={sidebarRef} className="flex-1 overflow-hidden scrollbar-hide pointer-events-none">
              {rooms.map(room => {
                const todayRes = contextReservations.find(res => {
                  const now = new Date().getTime();
                  return res.room === room.number && now >= new Date(res.arrival).getTime() && now <= new Date(res.departure).getTime();
                });

                return (
                  <div key={room.id} className="h-[32px] flex items-center px-4 border-b border-gray-100 group">
                    <RoomRowLabel
                      number={room.number}
                      code={getRoomCode(room.type ?? '', room.category ?? '')}
                      housekeepingStatus={room.housekeeping_status}
                      roomStatus={room.status}
                      fullLabel={`${room.number} - ${room.type ?? ''} ${room.category ?? ''}`.trim()}
                      compact={leftSidebarCollapsed}
                    />
                    {activeMode === 'housekeeping' && (room.housekeeping_status === 'dirty' || room.housekeeping_status === 'to_clean') ? (
                      <button
                        onClick={() => updateRoomMut.mutate({ id: room.id, patch: { housekeeping_status: 'clean' } })}
                        disabled={updateRoomMut.isPending}
                        title={`Marquer la chambre ${room.number} propre`}
                        aria-label={`Marquer la chambre ${room.number} propre`}
                        className="ml-auto shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition-all pointer-events-auto"
                      >
                        <CheckCircle2 size={11} /> Propre
                      </button>
                    ) : (
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded-full ml-auto shrink-0 border border-white',
                          todayRes ? 'bg-blue-500' : 'bg-gray-200',
                        )}
                        title={todayRes ? 'Occupée aujourd\'hui' : 'Libre aujourd\'hui'}
                      />
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0" ref={gridRef}>
           {displayMode === 'Gantt' ? (
             <div className="flex-1 overflow-auto custom-scrollbar flex flex-col" onScroll={handleScroll}>
                {/* Header Stats & Dates (Sticky) */}
               <div className="sticky top-0 z-30 bg-white border-b border-gray-100 w-full overflow-hidden">
                  {/* 1. Ligne DATES — première ligne du planning (maquette) */}
                  <div className="flex bg-white w-full flex-nowrap">
                     {days.map((d, i) => (
                       <div key={`date-${d.id}`} className={cn("shrink-0 h-[56px] flex flex-col items-center justify-center border-r border-b border-gray-100 transition-all", d.isWeekend ? "bg-[#FFF9F5]/50" : "bg-white", i === 0 && "bg-indigo-50/30 ring-2 ring-inset ring-indigo-100/50")} style={{ width: `${colWidth}%` }}>
                         <span className={cn("text-[10px] font-black uppercase tracking-widest mb-1", d.isWeekend ? "text-orange-300" : "text-gray-400")}>{d.dayName}</span>
                         <div className="flex items-baseline gap-1.5 leading-none">
                            <span className={cn("text-[17px] font-black", i === 0 ? "text-indigo-400" : d.isWeekend ? "text-orange-400" : "text-gray-900")}>{d.dateNum}</span>
                            <span className={cn("text-[11px] font-black uppercase tracking-tighter opacity-70", i === 0 ? "text-indigo-300" : d.isWeekend ? "text-orange-300" : "text-gray-400")}>{d.monthName}</span>
                         </div>
                       </div>
                     ))}
                  </div>
                  {/* 2. TO (réel) */}
                  <div className="flex text-center flex-nowrap w-full">
                     {days.map(d => (
                       <div key={`occ-${d.id}`} className={cn("h-[34px] border-r border-b border-gray-50 flex items-center justify-center transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")} style={{ width: `${colWidth}%` }}>
                          <span className={cn("text-[11px] font-black", d.occ > 80 ? "text-emerald-400" : d.occ > 50 ? "text-orange-300" : "text-gray-400")}>{d.occ}%</span>
                       </div>
                     ))}
                  </div>
                  {/* 3. Forecast d'occupation (calculé) */}
                  <div className="flex text-center bg-sky-50/20 w-full flex-nowrap">
                     {days.map(d => (
                       <div key={`fc-${d.id}`} className={cn("h-[34px] border-r border-b border-gray-50 flex items-center justify-center transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")} style={{ width: `${colWidth}%` }} title={d.forecast != null ? `Forecast occ. ${d.forecast.toFixed(1)}%` : 'Forecast indisponible'}>
                          <span className={cn("text-[11px] font-black", d.forecast == null ? "text-gray-300" : d.forecast > 80 ? "text-sky-600" : d.forecast > 50 ? "text-sky-400" : "text-sky-300")}>
                            {d.forecast == null ? '—' : `${Math.round(d.forecast)}%`}
                          </span>
                       </div>
                     ))}
                  </div>
                  {/* 4. Pickup (chambres) J vs J-1 */}
                  <div className="flex text-center w-full flex-nowrap">
                     {days.map(d => {
                       const pk = d.pickupRooms;
                       const tone = pk == null ? 'text-gray-300' : pk > 0 ? 'text-emerald-500' : pk < 0 ? 'text-rose-500' : 'text-gray-400';
                       return (
                         <div key={`pk-${d.id}`} className={cn("h-[34px] border-r border-b border-gray-50 flex items-center justify-center gap-0.5 transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")} style={{ width: `${colWidth}%` }} title={pk == null ? 'Pickup indisponible (pas d\'historique)' : `Pickup ${pk > 0 ? '+' : ''}${pk} ch. vs hier`}>
                           {pk != null && pk !== 0 && (pk > 0 ? <ArrowUpRight size={11} className={tone} /> : <ArrowDownRight size={11} className={tone} />)}
                           <span className={cn("text-[11px] font-black", tone)}>{pk == null ? '—' : `${pk > 0 ? '+' : ''}${pk}`}</span>
                         </div>
                       );
                     })}
                  </div>
                  {/* 5. Pickup (revenu) J vs J-1 */}
                  <div className="flex text-center bg-gray-50/30 w-full flex-nowrap">
                     {days.map(d => {
                       const rev = d.pickupRevenue;
                       const tone = rev == null ? 'text-gray-300' : rev > 0 ? 'text-emerald-500' : rev < 0 ? 'text-rose-500' : 'text-gray-400';
                       return (
                         <div key={`pkrev-${d.id}`} className={cn("h-[34px] border-r border-b border-gray-50 flex items-center justify-center transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")} style={{ width: `${colWidth}%` }} title={rev == null ? 'Pickup revenu indisponible' : `Pickup ${rev > 0 ? '+' : ''}${Math.round(rev)}€ vs hier`}>
                           <span className={cn("text-[10px] font-black", tone)}>{rev == null ? '—' : `${rev > 0 ? '+' : ''}${Math.round(rev)}€`}</span>
                         </div>
                       );
                     })}
                  </div>
                  {/* 6. Compression marché (Lighthouse) */}
                  <div className="flex text-center w-full flex-nowrap">
                     {days.map(d => {
                       const c = d.compressionPercent;
                       const tone = c == null ? 'text-gray-300' : c <= 40 ? 'text-emerald-500' : c <= 60 ? 'text-amber-500' : c <= 80 ? 'text-orange-500' : 'text-rose-500';
                       return (
                         <div key={`comp-${d.id}`} className={cn("h-[34px] border-r border-b border-gray-50 flex items-center justify-center transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")} style={{ width: `${colWidth}%` }} title={c == null ? 'Compression marché indisponible (Lighthouse)' : `Compression marché ${c}%`}>
                           <span className={cn("text-[11px] font-black", tone)}>{c == null ? '—' : `${c}%`}</span>
                         </div>
                       );
                     })}
                  </div>
                  {/* 7. Chambres libres */}
                  <div className="flex text-center bg-sky-50/10 w-full flex-nowrap">
                     {days.map(d => {
                       const free = d.available;
                       const tone = free == null ? 'text-gray-300' : free === 0 ? 'text-rose-500' : free <= 5 ? 'text-orange-500' : free <= 15 ? 'text-amber-500' : 'text-sky-500';
                       return (
                         <div key={`free-${d.id}`} className={cn("h-[34px] border-r border-b border-gray-50 flex items-center justify-center transition-colors shrink-0", d.isWeekend && "bg-gray-50/10")} style={{ width: `${colWidth}%` }} title={`${free ?? '—'} chambre(s) libre(s)`}>
                           <span className={cn("text-[11px] font-black tabular-nums", tone)}>{free ?? '—'}</span>
                         </div>
                       );
                     })}
                  </div>
                  {/* 8. Ligne Événements — agrège configStore.events + useEventsStore */}
                  <div className="flex text-center bg-gray-50/30 w-full flex-nowrap">
                     {days.map(d => {
                       const agg = aggregateEventsForDate(rmsEvents, d.dateStr);
                       const total = agg.count + d.events.length;
                       const tone = eventCellTone(agg.level);
                       const hasEvents = total > 0;
                       return (
                         <div
                           key={`ev-${d.id}`}
                           onClick={() => { setSelectedEventDate(d.dateStr); setIsEventModalOpen(true); }}
                           onMouseEnter={(e) => {
                             if (hasEvents) {
                               // hoveredEvents reste sur HotelEvent[] pour compat
                               // mais on enrichit avec les RMSMarketEvent agrégés.
                               const fromRms: HotelEvent[] = agg.events.map((x) => ({
                                 id: x.id,
                                 name: x.name,
                                 startDate: x.startDate,
                                 endDate: x.endDate,
                                 impact: (x.impact.level === 'very_low' ? 'low' : x.impact.level) as HotelEvent['impact'],
                                 source: x.primarySource,
                                 location: x.venue || x.zone,
                                 description: `Pression ${agg.pressure}% · ADR +${x.impact.adr}% · TO +${x.impact.occupancy}% · Reco prix +${x.influencePrice}%`,
                               }));
                               setHoveredEvents([...fromRms, ...d.events]);
                               setTooltipPos({ x: e.clientX, y: e.clientY + 20 });
                             }
                           }}
                           onMouseLeave={() => setHoveredEvents(null)}
                           className={cn(
                             'h-[34px] border-r border-b border-gray-50 flex items-center justify-center transition-colors cursor-pointer hover:bg-indigo-50/50 shrink-0',
                             d.isWeekend && 'bg-gray-50/10',
                           )}
                           style={{ width: `${colWidth}%` }}
                           title={hasEvents ? `${total} événement(s) — ${impactLevelLabel(agg.level)}` : undefined}
                         >
                            {hasEvents && (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ring-1 ring-inset text-[10px] font-semibold tabular-nums',
                                tone.bg, tone.text, tone.ring,
                                agg.level === 'hyper_compression' && 'shadow-sm shadow-fuchsia-300/40',
                              )}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} />
                                {total}
                                {agg.level === 'hyper_compression' && (
                                  <span className="ml-0.5 text-[9px] uppercase tracking-wide">⚡</span>
                                )}
                              </span>
                            )}
                         </div>
                       );
                     })}
                  </div>
               </div>

               {/* Main Grid Body */}
               <div className="relative w-full bg-white flex-1 min-h-[500px]">
                  <div className="absolute inset-0 flex pointer-events-none z-0">
                     {days.map((d) => {
                        // Mode Revenue : fond teinté par occupation (heatmap).
                        const revenueTint = activeMode === 'revenue' ? getOccThreshold(d.occ).bg : '';
                        return (
                        <div
                          key={`col-${d.id}`}
                          className={cn("shrink-0 border-r", revenueTint || (d.isWeekend ? "bg-gray-50/30 border-gray-200/60" : "border-gray-100"))}
                          style={{ width: `${colWidth}%`, opacity: activeMode === 'revenue' ? 0.5 : 1 }}
                        />
                        );
                     })}
                  </div>
                  <div className="relative z-10 pb-20 w-full">
                     {rooms.map((room) => {
                      const roomUnderMaintenance = room.status === 'maintenance' || room.status === 'out_of_order';
                      const maintenanceStriped = activeMode === 'maintenance' && roomUnderMaintenance;
                      const hkRowTint = activeMode === 'housekeeping'
                        ? (room.housekeeping_status === 'dirty' || room.housekeeping_status === 'to_clean'
                            ? 'bg-amber-50/40'
                            : room.housekeeping_status === 'clean'
                              ? 'bg-emerald-50/20'
                              : '')
                        : '';
                      return (
                      <div
                         key={`row-${room.id}`}
                         className={cn("h-[32px] border-b border-gray-100 relative hover:bg-gray-50/20 transition-colors w-full", hkRowTint)}
                         style={maintenanceStriped ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(244,63,94,0.08) 6px, rgba(244,63,94,0.08) 12px)' } : undefined}
                         onDragOver={handleDragOver}
                         onDrop={(e) => handleDrop(e, room)}
                       >
                        <div className="absolute inset-0 z-10 flex">
                          {days.map((day, dayIdx) => {
                            const isReserved = isCellReserved(room.number, day.dateStr);
                            const isActiveRoom = dragSel?.active && dragSel.roomNumber === room.number;
                            const minIdx = isActiveRoom ? Math.min(dragSel.startDateIdx, dragSel.endDateIdx) : -1;
                            const maxIdx = isActiveRoom ? Math.max(dragSel.startDateIdx, dragSel.endDateIdx) : -1;
                            const isSelected = isActiveRoom && dayIdx >= minIdx && dayIdx <= maxIdx;
                            const isStartCell = isSelected && dayIdx === minIdx;
                            const isEndCell = isSelected && dayIdx === maxIdx;
                            const isSingleCellSelection = isStartCell && isEndCell;
                            return (
                              <div
                                key={`cell-${room.id}-${day.id}`}
                                data-chambre={room.number}
                                data-categorie={`${room.category ?? ''}/${room.type ?? ''}`}
                                data-date={day.dateStr}
                                className={cn(
                                  'h-full border-r border-transparent transition-colors relative overflow-hidden',
                                  isReserved
                                    ? 'bg-rose-50/50 cursor-not-allowed'
                                    : 'cursor-crosshair hover:bg-indigo-50/40',
                                  isSelected && 'bg-indigo-200/30 border-indigo-200',
                                  isStartCell && 'bg-indigo-300/35',
                                  isEndCell && !isSingleCellSelection && 'bg-violet-300/35'
                                )}
                                style={{ width: `${colWidth}%` }}
                                onMouseDown={(e) => handleGridCellMouseDown(e, room, dayIdx)}
                                onMouseEnter={() => handleGridCellMouseEnter(room, dayIdx)}
                                onMouseUp={handleGridMouseUp}
                              >
                                {isSelected && (
                                  <div className="absolute inset-y-1 left-0 right-0 border-2 border-indigo-400/60 rounded-md pointer-events-none" />
                                )}
                                {isStartCell && (
                                  <>
                                    <div className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-white pointer-events-none" />
                                    <span className="absolute left-5 top-1 text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-white/85 px-1.5 py-0.5 rounded pointer-events-none">
                                      Arr.
                                    </span>
                                  </>
                                )}
                                {isEndCell && !isSingleCellSelection && (
                                  <>
                                    <div className="absolute right-1 top-1.5 w-2.5 h-2.5 rounded-full bg-violet-600 ring-2 ring-white pointer-events-none" />
                                    <span className="absolute right-5 top-1 text-[9px] font-black uppercase tracking-widest text-violet-700 bg-white/85 px-1.5 py-0.5 rounded pointer-events-none">
                                      Dép.
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                         {/* Afficher UNIQUEMENT les réservations sans conflit temporel */}
                         {(() => {
                           const roomReservations = contextReservations.filter(res => res.room === room.number);
                           
                           // Tri par date d'arrivée
                           const sorted = roomReservations.sort((a, b) => {
                             const dateA = a.checkIn ? new Date(a.checkIn) : new Date(a.arrival);
                             const dateB = b.checkIn ? new Date(b.checkIn) : new Date(b.arrival);
                             return dateA.getTime() - dateB.getTime();
                           });
                           
                           // Filtrer uniquement les réservations valides (sans chevauchement avec celles avant)
                           const validReservations: typeof sorted = [];
                           let lastEndMs = 0;
                           
                           for (const res of sorted) {
                             const startDate = res.checkIn ? new Date(res.checkIn) : new Date(res.arrival);
                             const endDate = res.checkOut ? new Date(res.checkOut) : new Date(res.departure);
                             const startMs = startDate.getTime();
                             const endMs = endDate.getTime();
                             
                             // Accepter si pas de conflit avec la réservation précédente
                             if (startMs >= lastEndMs) {
                               validReservations.push(res);
                               lastEndMs = endMs;
                             }
                             // Sinon = conflit → ignorer cette réservation (pas affichée)
                           }
                           
                           return validReservations.map((res, idx) => {
                           const arrivalDate = res.checkIn ? new Date(res.checkIn) : new Date(res.arrival);
                           const departureDate = res.checkOut ? new Date(res.checkOut) : new Date(res.departure);
                           
                           const startOfGrid = new Date(currentDate);
                           startOfGrid.setHours(0, 0, 0, 0);
                           
                           const startOfGridMs = startOfGrid.getTime();
                           const endOfGridMs = startOfGridMs + viewLength * 24 * 60 * 60 * 1000;
                           
                           const arrivalNormalized = new Date(arrivalDate);
                           arrivalNormalized.setHours(0, 0, 0, 0);
                           
                           const departureNormalized = new Date(departureDate);
                           departureNormalized.setHours(0, 0, 0, 0);
                           
                           const arrMs = arrivalNormalized.getTime();
                           const depMs = departureNormalized.getTime();
                           
                           // If the reservation is completely outside the visible grid, don't render it
                           if (depMs <= startOfGridMs || arrMs >= endOfGridMs) return null;
                           
                           const visibleStartMs = Math.max(startOfGridMs, arrMs);
                           const visibleEndMs = Math.min(endOfGridMs, depMs);

                           const startIndex = Math.floor((visibleStartMs - startOfGridMs) / (1000 * 60 * 60 * 24));
                           const dayCount = Math.max(1, Math.ceil((visibleEndMs - visibleStartMs) / (1000 * 60 * 60 * 24)));
                           
                           if (isNaN(startIndex) || isNaN(dayCount) || dayCount <= 0) return null;
                           if (channelFilter !== 'Tous Canaux' && res.source.toUpperCase() !== channelFilter.toUpperCase()) return null;

                           // —— Logique visuelle par statut ——
                           const resStatus = (res as any).reservationStatus ?? 'confirmed';
                           const isOB = (res as any).isOverbooking === true;

                           let barStyle: React.CSSProperties = {};
                           let statusIcon = '';
                           let opacityClass = '';

                           if (resStatus === 'option') {
                             barStyle = {
                               backgroundColor: '#FEF08A',
                               borderColor: '#FDE047',
                               color: '#713F12',
                               backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.4) 4px, rgba(255,255,255,0.4) 8px)',
                             };
                             statusIcon = '±';
                           } else if (resStatus === 'pending') {
                             barStyle = { backgroundColor: '#FED7AA', borderColor: '#FB923C', color: '#7C2D12' };
                             statusIcon = '⌶';
                           } else if (resStatus === 'cancelled') {
                             barStyle = { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF', color: '#6B7280', textDecoration: 'line-through' };
                             statusIcon = '✖';
                             opacityClass = 'opacity-50';
                           } else if (resStatus === 'noshow') {
                             barStyle = { backgroundColor: '#FEE2E2', borderColor: '#EF4444', color: '#991B1B' };
                             statusIcon = '!';
                           } else {
                             // Matching strict par nom de canal
                             const channelConfig = storeChannels.find(c => c.name.toUpperCase() === res.source.toUpperCase());
                             
                             if (channelConfig) {
                               barStyle = { 
                                 backgroundColor: channelConfig.color, 
                                 borderColor: channelConfig.color, 
                                 color: getContrastColor(channelConfig.color), 
                                 boxShadow: 'none' 
                               };
                             } else {
                               // Fallback : couleur par source partielle
                               const src = res.source.toUpperCase();
                               let fallbackColor = '#6366f1'; // Indigo par défaut
                               
                               if (src.includes('BOOKING')) fallbackColor = '#003580';
                               else if (src.includes('EXPEDIA')) fallbackColor = '#FDA44F';
                               else if (src.includes('AIRBNB')) fallbackColor = '#FF5A5F';
                               else if (src.includes('DIRECT')) fallbackColor = '#A5B4FC';
                               
                               barStyle = { 
                                 backgroundColor: fallbackColor, 
                                 borderColor: fallbackColor, 
                                 color: getContrastColor(fallbackColor), 
                                 boxShadow: 'none' 
                               };
                             }
                             statusIcon = '✓';
                           }

                           if (isOB) {
                             barStyle.borderColor = '#DC2626';
                             barStyle.border = '1px solid #DC2626';
                           }

                           return (
                             <div
                               key={`planning-res-${res.id}-${idx}`}
                               draggable={smartMoveEnabled}
                               onDragStart={(e) => { if (smartMoveEnabled) e.dataTransfer.setData('text/plain', res.id); }}
                               onMouseEnter={(e) => { setHoveredRes(res); setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 }); }}
                               onMouseLeave={() => setHoveredRes(null)}
                               onClick={() => {
                                 setSelectedDetailsRes(res);
                                 setIsDetailsModalOpen(true);
                               }}
                               className={cn(
                                 'absolute h-[26px] top-[3px] rounded-lg border flex items-center px-2 gap-1.5 cursor-pointer transition-all hover:brightness-95 z-20 group overflow-hidden text-xs',
                                 opacityClass,
                                 // Mode Groupe : met en avant les résas de groupe, atténue les autres.
                                 activeMode === 'groupe' && (res.groupId ? 'ring-2 ring-indigo-500 ring-offset-1' : 'opacity-40'),
                                 // Mode Ménage : atténue les barres pour laisser lire les pastilles HK.
                                 activeMode === 'housekeeping' && 'opacity-60',
                               )}
                               style={{ 
                                 left: `calc(${startIndex * colWidth}% + 4px)`, 
                                 width: `calc(${Math.min(viewLength - startIndex, dayCount) * colWidth}% - 8px)`,
                                 contain: 'layout style paint',
                                 isolation: 'isolate',
                                 clipPath: 'inset(0 0 0 0 round 8px)',
                                 ...barStyle 
                               }}
                             >
                                {/* Icône ARRIVÉE conditionnelle : uniquement si check-in = aujourd'hui */}
                                {(() => {
                                  const today = toLocalISODate(new Date());
                                  const checkInDate = toLocalISODate(arrivalDate);
                                  const checkOutDate = toLocalISODate(departureDate);
                                  
                                  return (
                                    <>
                                      {checkInDate === today && (
                                        <div className="shrink-0 flex items-center justify-center" style={{ width: 16, height: 16 }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}>
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                          </svg>
                                        </div>
                                      )}
                                      <span className={cn("text-[11px] font-semibold truncate min-w-0 flex-1", viewLength > 15 ? "hidden lg:block" : "")}>{res.client}</span>
                                      {(() => {
                                        const badges = deriveBadges({
                                          checkInIso: res.checkIn || checkInDate,
                                          checkOutIso: res.checkOut || checkOutDate,
                                          vip: res.vip,
                                          loyaltyLevel: res.loyaltyLevel,
                                          paymentStatus: res.paymentStatus,
                                          solde: res.solde,
                                          groupId: res.groupId,
                                          checkinStatus: res.checkinStatus,
                                          specialRequests: res.specialRequests,
                                          mealPlan: res.mealPlan,
                                        }, today);
                                        return <ReservationBadges badges={badges} max={viewLength > 15 ? 3 : 5} />;
                                      })()}
                                      {isOB && (
                                        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 900, background: '#DC2626', color: '#fff', padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>OB</span>
                                      )}
                                      {/* Icône DÉPART conditionnelle : uniquement si check-out = aujourd'hui */}
                                      {checkOutDate === today && (
                                        <div className="shrink-0 flex items-center justify-center ml-auto" style={{ width: 16, height: 16 }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ef4444' }}>
                                            <polyline points="15 18 9 12 15 6"></polyline>
                                          </svg>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                             </div>
                           );
                         })
                       })()}
                       </div>
                     );})}
                  </div>
               </div>
             </div>
           ) : (
             /* Revenue Planning View */
             <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
                {/* Revenue Sub-Header Filters */}
                <div className="px-8 py-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
                   <div className="flex items-center gap-6">
                      <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                         {([
                           { id: 'KPI', label: 'Revenue Intelligence' },
                           { id: 'Graphiques', label: 'Graphiques' },
                         ] as const).map((v) => (
                           <button
                             key={v.id}
                             onClick={() => setRevenueSubView(v.id)}
                             className={cn(
                               "px-5 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all",
                               revenueSubView === v.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"
                             )}
                           >
                             {v.label}
                           </button>
                         ))}
                      </div>

                      <div className="flex items-center gap-4 ml-6">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtres rapides :</span>
                         <div className="flex items-center gap-6">
                             {[
                               { label: 'Jours critiques', color: 'bg-rose-500' },
                               { label: 'Événements', color: 'bg-indigo-500' },
                               { label: 'Sous-performance', color: 'bg-orange-400' }
                             ].map((f, i) => {
                               const isActive = activeRevCalFilter === f.label;
                               return (
                                 <button
                                   key={i}
                                   onClick={() => setActiveRevCalFilter(isActive ? null : f.label)}
                                   className='flex items-center gap-2 cursor-pointer group outline-none'
                                 >
                                   <div className={cn('w-2 h-2 rounded-full transition-all', f.color, isActive ? 'scale-125 ring-2 ring-offset-2 ring-gray-100' : 'opacity-40')} />
                                   <span className={cn('text-[10px] font-black uppercase tracking-widest transition-colors', isActive ? 'text-gray-900' : 'text-gray-400 group-hover:text-indigo-600')}>{f.label}</span>
                                 </button>
                               );
                             })}
                          </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
                      >
                         <ChevronLeft size={18} />
                      </button>
                      
                      <div className="px-6 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-center min-w-[160px]">
                         <span className="text-[12px] font-black uppercase tracking-widest text-indigo-600">
                            {monthDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
                         </span>
                      </div>

                      <button 
                        onClick={() => setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
                      >
                         <ChevronRight size={18} />
                      </button>
                   </div>
                </div>

                {/* Revenue Calendar Grid or Charts */}
                <div className="flex-1 flex overflow-hidden bg-white">
                   {revenueSubView === 'Graphiques' ? (
                      <RevenueKPIChart data={calendarDays} />
                   ) : (
                      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#F8FAFC]">
                         <div className="grid grid-cols-7 gap-6">
                            {['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'].map(day => (
                              <div key={day} className="py-2 text-center">
                                 <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{day}</span>
                              </div>
                            ))}
                            
                            {Array.from({ length: (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
                              <div key={`empty-rev-${i}`} />
                            ))}

                            {calendarDays.map((d, dayIdx) => {
                              const insight = revenueInsightsByDate[d.dateStr];
                              const score = insight?.score ?? 65;
                              const scoreColor = score >= 85 ? 'text-emerald-500 border-emerald-100 bg-emerald-50' :
                                               score >= 75 ? 'text-indigo-500 border-indigo-100 bg-indigo-50' :
                                               score >= 65 ? 'text-orange-500 border-orange-100 bg-orange-50' : 'text-rose-500 border-rose-100 bg-rose-50';
                              const demandBadge = insight?.demandLevel === 'strong'
                                ? { label: 'Demande forte', cls: 'text-emerald-600 bg-emerald-50' }
                                : insight?.demandLevel === 'normal'
                                  ? { label: 'Demande stable', cls: 'text-indigo-600 bg-indigo-50' }
                                  : { label: 'Demande faible', cls: 'text-rose-600 bg-rose-50' };
                              const matchesFilter = !activeRevCalFilter
                                || (activeRevCalFilter === 'Jours critiques' && insight?.riskLevel === 'high')
                                || (activeRevCalFilter === 'Événements' && d.events.length > 0)
                                || (activeRevCalFilter === 'Sous-performance' && insight?.demandLevel === 'weak');

                              return (
                                <div
                                  key={`rev-day-${d.dateStr}`}
                                  onClick={() => {
                                    setSelectedCalendarDate(d.dateStr);
                                    setRevenueDetailsTab('day');
                                    setIsRevenueDetailsOpen(true);
                                  }}
                                  className={cn(
                                    "bg-white rounded-[32px] border border-gray-100 p-6 transition-all cursor-pointer hover:shadow-2xl hover:shadow-gray-200/50 hover:scale-[1.02] relative group",
                                    selectedCalendarDate === d.dateStr && "ring-2 ring-indigo-500 shadow-2xl shadow-indigo-100",
                                    d.isToday && "ring-2 ring-violet-500 bg-violet-50/40",
                                    !matchesFilter && "opacity-25 pointer-events-none"
                                  )}
                                >
                                   <div className="flex items-center justify-between mb-6">
                                      <div className="flex items-baseline gap-1">
                                         <span className={cn("text-2xl font-black", d.isToday ? "text-indigo-600" : "text-gray-900")}>{d.dateNum}</span>
                                         {d.isToday && (
                                           <Badge className="bg-indigo-600 text-white border-none text-[8px] font-black uppercase px-2 py-0.5 rounded-lg">Aujourd'hui</Badge>
                                         )}
                                      </div>
                                      <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center text-[13px] font-black shadow-sm", scoreColor)}>
                                         {score}
                                      </div>
                                   </div>

                                   <div className="space-y-4 mb-6">
                                      <div className="flex items-center justify-between">
                                         <div className="flex flex-col">
                                            <span className="text-xl font-black text-gray-900">{d.occ}%</span>
                                            <span className="text-[14px] font-black text-gray-900 mt-1">{d.ca.toLocaleString()} €</span>
                                         </div>
                                         <div className="text-right">
                                            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">ADR {Math.round(d.adr)} €</div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase">RevPAR {Math.round(d.revpar)} €</div>
                                         </div>
                                      </div>

                                      <div className="flex items-center justify-between gap-3">
                                        <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-lg", demandBadge.cls)}>
                                          {demandBadge.label}
                                        </span>
                                        <span className={cn(
                                          "text-[9px] font-black uppercase px-2 py-1 rounded-lg",
                                          (insight?.riskLevel === 'high' ? "text-rose-600 bg-rose-50" : insight?.riskLevel === 'medium' ? "text-orange-600 bg-orange-50" : "text-emerald-600 bg-emerald-50")
                                        )}>
                                          Risque {insight?.riskLevel === 'high' ? 'élevé' : insight?.riskLevel === 'medium' ? 'modéré' : 'faible'}
                                        </span>
                                      </div>

                                      <div className="h-10 flex items-end gap-1 px-1">
                                         {[
                                           ...Array.from({ length: 7 }, (_, i) => {
                                             const prev = calendarDays[dayIdx - 7 + i];
                                             return prev ? Math.max(5, prev.occ) : 5;
                                           }),
                                           Math.max(5, d.occ),
                                         ].map((h, idx) => (
                                           <div
                                             key={idx}
                                             className={cn(
                                               "flex-1 rounded-full transition-all group-hover:opacity-100",
                                               idx === 7 ? "bg-indigo-500" : "bg-gray-100",
                                               idx > 4 && idx < 7 && "bg-indigo-200"
                                             )}
                                             style={{ height: `${h}%` }}
                                           />
                                         ))}
                                      </div>
                                      <div className="flex items-center justify-between">
                                         <span className="text-[9px] font-black text-gray-400 uppercase">Pickup (J-3)</span>
                                         <span className={cn("text-[9px] font-black", (insight?.pickupSignal || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                                           {(insight?.pickupSignal || 0) >= 0 ? '+' : ''}{insight?.pickupSignal || 0}%
                                         </span>
                                      </div>
                                   </div>

                                   {/* ── KPI · Forecast · Heatmap fusionnés ── */}
                                   <div className="space-y-2 border-t border-gray-50 pt-4">
                                     {/* Forecast: action recommandée du RMS */}
                                     {insight?.recommendedAction && (
                                       <div className="flex items-start gap-2">
                                         <Zap size={10} className="text-indigo-500 shrink-0 mt-0.5" />
                                         <span className="text-[10px] font-bold text-indigo-600 leading-snug line-clamp-2">
                                           {insight.recommendedAction}
                                         </span>
                                       </div>
                                     )}
                                     {/* Heatmap: TO et événements en chiffres */}
                                     <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tight text-gray-400">
                                       <span>TO {d.occ}%</span>
                                       <span>RevPAR {Math.round(d.revpar)}€</span>
                                       {d.events.length > 0 && (
                                         <span className="text-indigo-500">{d.events.length} évt</span>
                                       )}
                                     </div>
                                     {/* KPI: événements liés (max 2) */}
                                     {d.events.slice(0, 2).map((evt, idx) => (
                                       <div key={idx} className="flex items-center gap-2">
                                          <div className={cn("w-2 h-2 rounded-full", evt.impact === 'critical' ? 'bg-rose-500' : evt.impact === 'high' ? 'bg-orange-500' : 'bg-indigo-500')} />
                                          <span className="text-[10px] font-bold text-gray-500 truncate uppercase tracking-tighter">{evt.name}</span>
                                       </div>
                                     ))}
                                   </div>
                                </div>
                              );
                            })}
                         </div>

                         <div className="mt-12 flex items-center justify-between px-4">
                            <div className="flex items-center gap-6">
                               {[
                                 { label: 'Très bon (Score ≥ 80)', color: 'bg-emerald-500' },
                                 { label: 'Bon (70 ≤ Score < 80)', color: 'bg-indigo-500' },
                                 { label: 'Moyen (50 ≤ Score < 70)', color: 'bg-orange-400' },
                                 { label: 'Faible (Score < 50)', color: 'bg-rose-500' },
                                 { label: 'Événement majeur', color: 'bg-indigo-500', isStar: true }
                               ].map((l, idx) => (
                                 <div key={idx} className="flex items-center gap-2">
                                    {l.isStar ? <Zap size={12} className="text-indigo-500" /> : <div className={cn("w-2 h-2 rounded-full", l.color)} />}
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{l.label}</span>
                                 </div>
                               ))}
                            </div>
                            <div className="text-right">
                               <div className="text-[11px] font-black text-gray-900 uppercase">Score du jour</div>
                               <div className="text-[10px] font-black text-gray-400 uppercase italic">Note globale /100</div>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
             </div>
           )}
        </div>

        {/* Volet latéral droit — Intelligence RMS + opérationnel, collé au bord droit */}
        {displayMode === 'Gantt' && (
          <aside
            className={cn(
              'shrink-0 bg-white border-l border-gray-100 z-30 transition-[width] duration-200 ease-out overflow-hidden flex flex-col',
              showRightSidebar ? 'w-[300px]' : 'w-9',
            )}
            aria-label="Volet intelligence RMS"
          >
            {showRightSidebar ? (
              <>
                {/* En-tête du volet — bouton de repli (collapse) */}
                <div className="h-9 shrink-0 flex items-center justify-between pl-3 pr-2 border-b border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Intelligence</span>
                  <button
                    onClick={toggleRightSidebar}
                    title="Réduire le volet"
                    aria-label="Réduire le volet intelligence"
                    aria-pressed={!showRightSidebar}
                    className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <PlanningRightPanel
                    startDate={currentDate}
                    rangeDays={viewLength}
                    today={todayKpi}
                    hkCleanRatio={hkCleanRatio}
                    onlineCheckins={onlineCheckinsToday}
                    intel={rightPanelIntel}
                  />
                </div>
              </>
            ) : (
              /* Replié — fine bande cliquable pour rouvrir le volet */
              <button
                onClick={toggleRightSidebar}
                title="Afficher le volet intelligence"
                aria-label="Afficher le volet intelligence"
                aria-pressed={!showRightSidebar}
                className="w-full h-full flex items-start justify-center pt-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </aside>
        )}
      </div>
      {/* ↑ Fin de la ligne principale (sidebar gauche · grille pleine largeur · volet droit collé à droite) */}

      {/* Volet inférieur — légende + actions rapides (maquette), pleine largeur en bas */}
      {displayMode === 'Gantt' && (
        <div className="shrink-0 border-t border-gray-100 bg-white px-6 py-2.5 flex items-center gap-6 z-40">
          {/* Légende des badges réservation */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Légende</span>
            {[
              { icon: <span className="w-3 h-3 rounded-[3px] border-2 border-emerald-500" />, label: 'Arrivée' },
              { icon: <span className="w-3 h-3 rounded-[3px] border-2 border-orange-400" />, label: 'Départ' },
              { icon: <Star size={12} className="text-amber-500" />, label: 'VIP' },
              { icon: <Users size={12} className="text-indigo-600" />, label: 'Groupe' },
              { icon: <CheckCircle2 size={12} className="text-emerald-600" />, label: 'Payée' },
              { icon: <Euro size={12} className="text-rose-600" />, label: 'Solde dû' },
              { icon: <Coffee size={12} className="text-orange-500" />, label: 'PdJ' },
              { icon: <Smartphone size={12} className="text-sky-600" />, label: 'Online' },
              { icon: <StickyNote size={12} className="text-violet-600" />, label: 'Notes' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                {l.icon}
                <span className="text-[10px] font-bold text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>

          {/* Actions rapides */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setIsFreeRoomsOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wide hover:bg-indigo-100 transition-all"
            >
              <DoorOpen size={13} /> {todayKpi.free} chambres libres
            </button>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Recherche…"
                aria-label="Rechercher une chambre ou un client"
                className="h-8 w-40 pl-8 pr-3 rounded-xl border border-gray-200 text-[11px] font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setSmartMoveEnabled((v) => !v)}
              title="Activer/désactiver le déplacement intelligent (drag & drop)"
              aria-label="Déplacement intelligent"
              aria-pressed={smartMoveEnabled}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wide text-gray-500 hover:bg-gray-50 transition-all"
            >
              <span>Déplacement intelligent</span>
              <span className={cn('w-8 h-4 rounded-full relative transition-colors', smartMoveEnabled ? 'bg-indigo-600' : 'bg-gray-200')}>
                <span className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform', smartMoveEnabled ? 'translate-x-4' : 'translate-x-0.5')} />
              </span>
            </button>
          </div>
        </div>
      )}

    {/* Tooltip Overlay */}
      <AnimatePresence>
        {hoveredRes && (() => {
          const resStatus = (hoveredRes as any).reservationStatus ?? 'confirmed';
          const nights = (() => {
            const s = new Date(hoveredRes.arrival);
            const e = new Date(hoveredRes.departure);
            const n = Math.ceil((e.getTime() - s.getTime()) / 86400000);
            return isNaN(n) || n < 1 ? 1 : n;
          })();
          // Use real solde from Supabase if available; otherwise derive from payment status
          const balance = hoveredRes.solde != null
            ? hoveredRes.solde
            : hoveredRes.paymentStatus === 'paid'
              ? 0
              : hoveredRes.paymentStatus === 'partial'
                ? hoveredRes.totalAmount * 0.5
                : hoveredRes.totalAmount;
          const statusMeta: Record<string, { label: string; bg: string; text: string; dot: string }> = {
            confirmed:  { label: 'Confirmée',   bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
            pending:    { label: 'En attente',  bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
            option:     { label: 'Option',      bg: 'bg-yellow-50',   text: 'text-yellow-700',  dot: 'bg-yellow-400' },
            cancelled:  { label: 'Annulée',     bg: 'bg-gray-100',    text: 'text-gray-500',    dot: 'bg-gray-400' },
            noshow:     { label: 'No-show',     bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
          };
          const sm = statusMeta[resStatus] ?? statusMeta.confirmed;
          // Smart tooltip positioning: flip if near bottom/right edge
          const vpW = window.innerWidth;
          const vpH = window.innerHeight;
          const TW = 320, TH = 310;
          const left = tooltipPos.x + TW + 20 > vpW ? tooltipPos.x - TW - 8 : tooltipPos.x + 14;
          const top  = tooltipPos.y + TH + 20 > vpH ? tooltipPos.y - TH - 8 : tooltipPos.y + 14;

          return (
            <motion.div
              key="res-tooltip"
              initial={{ opacity: 0, scale: 0.95, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 6 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              style={{ position: 'fixed', left, top, width: TW }}
              className="z-[9999] pointer-events-none bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden"
            >
              {/* Header strip — accent by status */}
              <div className="h-1 w-full" style={{ background: resStatus === 'confirmed' ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : resStatus === 'pending' ? '#f59e0b' : resStatus === 'option' ? '#fde047' : resStatus === 'noshow' ? '#ef4444' : '#9ca3af' }} />

              {/* Main content */}
              <div className="px-4 pt-3 pb-4 space-y-3">

                {/* Row 1 — Client + amount */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white text-[13px] font-black shadow-sm"
                         style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                      {(hoveredRes.client || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-gray-900 truncate leading-tight">{hoveredRes.client}</span>
                        {hoveredRes.vip && (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">VIP</span>
                        )}
                      </div>
                      {/* Chambre */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-gray-400">Ch.</span>
                        <span className="text-[11px] font-semibold text-gray-700">{hoveredRes.room}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide truncate">{hoveredRes.roomType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[15px] font-black text-gray-900 leading-tight">{(hoveredRes.totalAmount || 0).toLocaleString('fr-FR')}€</div>
                    <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide leading-none mt-0.5">Total TTC</div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Row 2 — Dates + nights */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 bg-indigo-50/60 rounded-xl px-2.5 py-2">
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-wider mb-0.5">Arrivée</p>
                    <p className="text-[12px] font-bold text-indigo-900 tabular-nums">{formatShortDate(hoveredRes.checkIn ?? hoveredRes.arrival)}</p>
                  </div>
                  <div className="col-span-1 bg-orange-50/60 rounded-xl px-2.5 py-2">
                    <p className="text-[8px] font-black text-orange-400 uppercase tracking-wider mb-0.5">Départ</p>
                    <p className="text-[12px] font-bold text-orange-900 tabular-nums">{formatShortDate(hoveredRes.checkOut ?? hoveredRes.departure)}</p>
                  </div>
                  <div className="col-span-1 bg-violet-50/60 rounded-xl px-2.5 py-2 flex flex-col items-center justify-center">
                    <p className="text-[18px] font-black text-violet-700 leading-none">{nights}</p>
                    <p className="text-[8px] font-black text-violet-400 uppercase tracking-wide mt-0.5">nuit{nights > 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* Row 3 — References + status */}
                <div className="space-y-1.5">
                  {/* Canal + statut */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100">{hoveredRes.source}</span>
                      {hoveredRes.mealPlan && (
                        <span className="text-[9px] font-semibold text-gray-500 px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-100 uppercase">{hoveredRes.mealPlan}</span>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${sm.bg}`}>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sm.dot}`} />
                      <span className={`text-[10px] font-bold ${sm.text}`}>{sm.label}</span>
                    </div>
                  </div>

                  {/* Partner ref */}
                  {hoveredRes.partnerRef && (
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[10px] text-gray-400">Réf. partenaire</span>
                      <span className="text-[10px] font-bold text-gray-700 font-mono tracking-wide">{hoveredRes.partnerRef}</span>
                    </div>
                  )}

                  {/* Paiement + solde */}
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] text-gray-400">Paiement</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${hoveredRes.payment === 'Payé' ? 'text-emerald-600' : hoveredRes.payment === 'Partiel' ? 'text-amber-600' : 'text-rose-600'}`}>
                        {hoveredRes.payment || 'En attente'}
                      </span>
                      {balance > 0 && hoveredRes.payment !== 'Payé' && (
                        <span className="text-[9px] text-rose-500 font-semibold">Solde {balance.toFixed(0)}€</span>
                      )}
                    </div>
                  </div>

                  {/* Occupants */}
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] text-gray-400">Occupants</span>
                    <span className="text-[10px] font-semibold text-gray-700">
                      {hoveredRes.guests?.adults ?? 2} adultes{(hoveredRes.guests?.children ?? 0) > 0 ? `, ${hoveredRes.guests?.children ?? 0} enfant${(hoveredRes.guests?.children ?? 0) > 1 ? 's' : ''}` : ''}
                    </span>
                  </div>
                </div>

                {/* Notes — only if present */}
                {hoveredRes.notes && (
                  <div className="flex items-start gap-2 bg-amber-50/50 rounded-xl px-3 py-2 border border-amber-100/60">
                    <AlertCircle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-relaxed line-clamp-2">{hoveredRes.notes}</p>
                  </div>
                )}

              </div>
            </motion.div>
          );
        })()}

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
                   <div key={idx} className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                         <h5 className="text-sm font-bold text-gray-800 leading-tight">
                           {evt.name || (evt as any).title || 'Événement sans nom'}
                         </h5>
                         <div className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0",
                            evt.impact === 'critical' ? "bg-rose-100 text-rose-700" : 
                            evt.impact === 'high' ? "bg-orange-100 text-orange-700" : 
                            evt.impact === 'medium' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                         )}>
                           {evt.impact === 'critical' ? 'Critique' : evt.impact === 'high' ? 'Fort' : evt.impact === 'medium' ? 'Moyen' : 'Faible'}
                         </div>
                      </div>
                      
                      <div className="space-y-1.5">
                         <div className="flex items-center gap-2 text-gray-500">
                            <Clock size={12} className="text-gray-400" />
                            <span className="text-xs font-medium">
                               <span className="text-gray-400">Du</span> {evt.startDate} <span className="text-gray-400">au</span> {evt.endDate}
                            </span>
                         </div>
                         
                         {evt.location && (
                            <div className="flex items-center gap-2 text-gray-500">
                               <ExternalLink size={12} className="text-indigo-400" />
                               <span className="text-xs font-medium">{evt.location}</span>
                            </div>
                         )}
                      </div>
                   </div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fiche réservation depuis le planning */}
      {isDetailsModalOpen && selectedDetailsRes && (
        <ReservationDetailsModal
          isOpen={true}
          onClose={() => setIsDetailsModalOpen(false)}
          reservation={selectedDetailsRes}
          onUpdate={(updated) => updateReservation(updated.id, updated)}
        />
      )}

      <ReservationFormModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setDragFormData(null); }} 
        initialData={dragFormData ? {
          checkIn: dragFormData.checkIn,
          checkOut: dragFormData.checkOut,
          roomNumber: dragFormData.roomNumber,
          category: dragFormData.category,
        } : undefined}
        availableRooms={storeRooms.map(r => ({ number: r.number, type: r.type ?? '', price: r.base_price ?? undefined }))}
        allReservations={contextReservations.map(r => ({ id: r.id, room: r.room, arrival: r.arrival, departure: r.departure }))}
        source="planning"
        onSave={(data: ReservationFormData) => {
          const room = storeRooms.find(r => r.number === data.roomNumber);
          const typedData = data as ReservationFormData & {
            reservationStatus?: Reservation['reservationStatus'];
            isOverbooking?: boolean;
            dynamicPriceApplied?: boolean;
            appliedPricingRules?: string[];
          };
          const newRes: Reservation = buildReservation({
            ...typedData,
            roomType: room ? `${room.category ?? 'STD'}/${room.type ?? 'DLX'}` : 'STD/DLX',
          });
          addReservation(newRes);
          setIsModalOpen(false);
          setDragFormData(null);
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: { message: `Réservation créée — Ch. ${data.roomNumber} · ${data.checkIn} → ${data.checkOut}` }
          }));
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
      {isRevenueDetailsOpen && (
        <Suspense fallback={null}>
          <RevenueDetailsModal
            isOpen={isRevenueDetailsOpen}
            onClose={() => setIsRevenueDetailsOpen(false)}
            initialTab={revenueDetailsTab}
            selectedDate={selectedCalendarDate || undefined}
            reservations={contextReservations}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rooms={rooms as any}
            events={storeEvents}
            rmsEvents={rmsEvents}
            channels={storeChannels}
            calendarDays={calendarDays}
            insightsByDate={revenueInsightsByDate}
            onRefresh={async () => {
              // Force re-evaluation of derived data; React Query invalidations are
              // already handled inside the modal. We just need to bump local state
              // so memos re-compute against the freshest store snapshots.
              setMonthDate((d) => new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          />
        </Suspense>
      )}
      <ChannelColorModal 
        isOpen={isChannelModalOpen} 
        onClose={() => setIsChannelModalOpen(false)} 
      />

      {/* Modal Confirmation Délogement */}
      <AnimatePresence>
        {confirmMove && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-6">
                  <TrendingUp size={32} />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">
                  {confirmMove.newPrice > confirmMove.oldPrice ? 'Upgrade Catégorie' : 'Downgrade Catégorie'}
                </h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  Vous déplacez cette réservation vers la chambre <span className="font-bold text-indigo-600">{confirmMove.newRoom.number}</span> ({confirmMove.newRoom.category}). 
                  Souhaitez-vous appliquer le nouveau tarif de {confirmMove.newPrice}€/nuit ?
                </p>
                
                {!isCustomizingMove ? (
                  <>
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ancien prix</p>
                        <p className="text-lg font-black text-gray-400 line-through">{confirmMove.oldPrice}€</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Nouveau prix</p>
                        <p className="text-lg font-black text-indigo-600">{confirmMove.newPrice}€</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-8 text-left space-y-4">
                    <div className="flex bg-gray-50 p-1 rounded-xl">
                      <button 
                        onClick={() => setMoveCustomMode('night')}
                        className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-colors", moveCustomMode === 'night' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                      >
                        Par nuit
                      </button>
                      <button 
                        onClick={() => setMoveCustomMode('total')}
                        className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-colors", moveCustomMode === 'total' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                      >
                        Total
                      </button>
                      <button 
                        onClick={() => setMoveCustomMode('free')}
                        className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-colors", moveCustomMode === 'free' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                      >
                        Offert
                      </button>
                    </div>

                    {moveCustomMode !== 'free' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Montant du supplément {moveCustomMode === 'night' ? 'par nuit' : 'total'} (€)
                        </label>
                        <input 
                          type="number" 
                          value={customSupplement}
                          onChange={(e) => setCustomSupplement(parseFloat(e.target.value) || 0)}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 text-lg font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="Ex: 50"
                        />
                      </div>
                    )}
                    {moveCustomMode === 'free' && (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                        <p className="text-emerald-600 font-bold text-sm">Le surclassement sera marqué comme offert.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className={cn("p-6 bg-gray-50 grid gap-3", !isCustomizingMove ? "grid-cols-4" : "grid-cols-2")}>
                {!isCustomizingMove ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => setConfirmMove(null)}
                      className="rounded-2xl border-gray-200 font-black uppercase text-[9px] tracking-widest h-12"
                    >
                      Annuler
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsCustomizingMove(true);
                        setCustomSupplement(confirmMove.newPrice - confirmMove.oldPrice);
                      }}
                      className="rounded-2xl border-orange-200 text-orange-600 font-black uppercase text-[9px] tracking-widest h-12 hover:bg-orange-50"
                    >
                      Perso.
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleIgnoreMove}
                      className="rounded-2xl border-indigo-200 text-indigo-600 font-black uppercase text-[9px] tracking-widest h-12 hover:bg-indigo-50"
                    >
                      Ignorer
                    </Button>
                    <Button 
                      onClick={handleConfirmMove}
                      className="rounded-2xl bg-indigo-600 font-black uppercase text-[9px] tracking-widest h-12 shadow-lg shadow-indigo-100"
                    >
                      Auto
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCustomizingMove(false)}
                      className="rounded-2xl border-gray-200 font-black uppercase text-[9px] tracking-widest h-12"
                    >
                      Retour
                    </Button>
                    <Button 
                      onClick={handleConfirmMove}
                      className={cn("rounded-2xl font-black uppercase text-[9px] tracking-widest h-12 shadow-lg", moveCustomMode === 'free' ? "bg-emerald-600 shadow-emerald-100" : "bg-indigo-600 shadow-indigo-100")}
                    >
                      Valider
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Modal Disponibilité par catégorie */}
      <AvailabilityModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        dateRange={days.map(d => new Date(d.id))}
        roomsByCategory={availabilityData}
      />

      <FreeRoomsModal
        isOpen={isFreeRoomsOpen}
        onClose={() => setIsFreeRoomsOpen(false)}
        rooms={storeRooms}
        occupiedNumbers={todayOccupiedNumbers}
        dateIso={toLocalISODate(new Date())}
        onCreateReservation={(room) => {
          const checkIn = toLocalISODate(new Date());
          setDragFormData({
            roomNumber: room.number,
            category: room.category ?? '',
            roomType: `${room.category ?? ''}/${room.type ?? ''}`,
            checkIn,
            checkOut: addOneNight(checkIn),
          });
          setIsFreeRoomsOpen(false);
          setIsModalOpen(true);
        }}
      />

      {/* ── Paramètres du planning ────────────────────────────────── */}
      {showSettingsPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-indigo-600" />
                <h3 className="font-bold text-gray-900 text-[14px]">Paramètres du planning</h3>
              </div>
              <button onClick={() => setShowSettingsPanel(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Vue par défaut</p>
                <div className="flex gap-1.5">
                  {(['7J', '15J', 'Mois'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setActiveView(v)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors',
                        activeView === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mode d'affichage</p>
                <div className="flex gap-1.5">
                  {(['Gantt', 'Revenue'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setDisplayMode(m)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors',
                        displayMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-gray-700">Volet latéral</span>
                <button
                  onClick={toggleRightSidebar}
                  className={cn(
                    'w-10 h-6 rounded-full transition-colors relative',
                    showRightSidebar ? 'bg-indigo-600' : 'bg-gray-200',
                  )}
                >
                  <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', showRightSidebar ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-gray-700">Colonne chambre réduite</span>
                <button
                  onClick={toggleLeftSidebar}
                  className={cn(
                    'w-10 h-6 rounded-full transition-colors relative',
                    leftSidebarCollapsed ? 'bg-indigo-600' : 'bg-gray-200',
                  )}
                >
                  <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', leftSidebarCollapsed ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
              </div>
            </div>
            <div className="px-5 pb-4">
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold py-2.5 rounded-xl transition-colors"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
);
};
