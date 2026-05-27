/**
 * FLOWTYM — RevenueDetailsModal
 *
 * Modale "Détails Complets" du Calendrier Revenue.
 * Reçoit toutes les données réelles via props (aucune donnée hardcoded).
 *
 * Six onglets, tous câblés sur les vraies sources métier :
 *   1. day       → Analyse du jour    (réservations, occ, ADR, RevPAR, CA, arrivées, départs, no-show)
 *   2. events    → Événements         (configStore + RMS market events)
 *   3. channels  → Canaux             (groupé par source des vraies réservations)
 *   4. forecast  → Forecast J+30      (calendarDays projetés)
 *   5. alerts    → Alertes            (RMS events critiques + insights métier)
 *   6. score     → Scoring            (insight RMS calculé)
 *
 * Quand une donnée n'est pas disponible, on affiche explicitement
 * « Donnée non disponible » au lieu d'inventer.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  Target,
  AlertCircle,
  Activity,
  Globe,
  PieChart,
  DollarSign,
  Download,
  RefreshCw,
  Euro,
  ArrowUpRight,
  ArrowDownRight,
  UserX,
  BedDouble,
  ShieldCheck,
  Info,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/src/lib/utils';
import { Badge } from '@/src/components/ui/Badge';
import type { Reservation } from '@/src/contexts/ReservationContext';
import type { Room, HotelEvent, ChannelConfig } from '@/src/store/configStore';
import type { RMSMarketEvent } from '@/src/types/events';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueInsight {
  score: number;                                       // 0-99
  demandLevel: 'strong' | 'normal' | 'weak';
  riskLevel: 'high' | 'medium' | 'low';
  recommendedAction: string;
  recommendedDeltaPct: number;
  pickupSignal: number;
}

export interface RevenueCalendarDay {
  date: Date;
  dateStr: string;
  dateNum: number;
  isToday: boolean;
  occ: number;
  ca: number;
  adr: number;
  revpar: number;
  events: HotelEvent[];
}

export interface RevenueDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: string;
  initialTab?: 'day' | 'events' | 'channels' | 'forecast' | 'alerts' | 'score';
  // Real data sources
  reservations: Reservation[];
  rooms: Room[];
  events: HotelEvent[];
  rmsEvents?: RMSMarketEvent[];
  channels?: ChannelConfig[];
  calendarDays: RevenueCalendarDay[];
  insightsByDate?: Record<string, RevenueInsight>;
  /** Optional refresh callback — parent triggers data refetch from its sources */
  onRefresh?: () => Promise<void> | void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtEUR = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number): string => `${Math.round(n)}%`;

/** Parse "DD MMM HH:mm" or ISO date → Date. Returns null if invalid. */
function parseResDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Fallback parsing not required — Reservation context uses ISO-ish strings
  return null;
}

/** dateStr (YYYY-MM-DD) → "lundi 25 mai 2026" */
function formatLongDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

/** Check if a reservation occupies the given date (check_in ≤ date < check_out) */
function reservationCoversDate(r: Reservation, target: Date): boolean {
  const a = parseResDate(r.arrival);
  const b = parseResDate(r.departure);
  if (!a || !b) return false;
  const t = target.getTime();
  return t >= a.getTime() && t < b.getTime();
}

/** Reservation arrives on date if check_in starts that day */
function reservationArrivesOn(r: Reservation, dateStr: string): boolean {
  const a = parseResDate(r.arrival);
  if (!a) return false;
  return a.toISOString().slice(0, 10) === dateStr;
}

/** Reservation departs on date if check_out starts that day */
function reservationDepartsOn(r: Reservation, dateStr: string): boolean {
  const b = parseResDate(r.departure);
  if (!b) return false;
  return b.toISOString().slice(0, 10) === dateStr;
}

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: 'Direct', BOOKING: 'Booking.com', EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb', WALKIN: 'Walk-in', PHONE: 'Téléphone',
  OTA: 'OTA', GDS: 'GDS',
};

const getSourceLabel = (source: string | null | undefined): string => {
  const key = (source ?? 'DIRECT').toUpperCase();
  return SOURCE_LABELS[key] ?? source ?? 'Direct';
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const RevenueDetailsModal: React.FC<RevenueDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  initialTab = 'day',
  reservations,
  rooms,
  events,
  rmsEvents = [],
  channels = [],
  calendarDays,
  insightsByDate = {},
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { setActiveTab(initialTab); }, [initialTab, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // ── Selected day data ──────────────────────────────────────────────────────
  const dayData = useMemo(() => {
    if (!selectedDate) return null;
    const target = new Date(`${selectedDate}T00:00:00`);
    if (isNaN(target.getTime())) return null;

    // Real rooms inventory (excluding fictitious)
    const sellableRooms = rooms.filter(r => !r.isFictitious);
    const totalRooms = sellableRooms.length;

    // Reservations covering this day
    const inHouseRes = reservations.filter(r => reservationCoversDate(r, target));
    const arrivalsRes = reservations.filter(r => reservationArrivesOn(r, selectedDate));
    const departuresRes = reservations.filter(r => reservationDepartsOn(r, selectedDate));
    const noShowRes = arrivalsRes.filter(r => (r.status ?? '').toLowerCase().includes('no_show')
      || (r.status ?? '').toLowerCase().includes('no-show')
      || (r.status ?? '').toLowerCase() === 'noshow');

    const occupiedCount = inHouseRes.length;
    const ca = inHouseRes.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

    // Strict formulas
    const occ = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;
    const adr = occupiedCount > 0 ? Math.round(ca / occupiedCount) : 0;
    const revpar = totalRooms > 0 ? Math.round(ca / totalRooms) : 0;

    // Day events from store
    const dayEvents = events.filter(e => selectedDate >= e.startDate && selectedDate <= e.endDate);
    // RMS market events for that date
    const dayRmsEvents = rmsEvents.filter(e => selectedDate >= e.startDate && selectedDate <= e.endDate);

    return {
      target,
      totalRooms,
      sellableRooms,
      occupiedCount,
      availableCount: Math.max(0, totalRooms - occupiedCount),
      inHouseRes,
      arrivalsRes,
      departuresRes,
      noShowRes,
      ca,
      occ,
      adr,
      revpar,
      dayEvents,
      dayRmsEvents,
    };
  }, [selectedDate, reservations, rooms, events, rmsEvents, refreshTick]);

  // ── Channel breakdown for the selected day ─────────────────────────────────
  const channelStats = useMemo(() => {
    if (!dayData) return [];
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of dayData.inHouseRes) {
      const key = (r.source ?? 'DIRECT').toUpperCase();
      const existing = map.get(key) ?? { count: 0, revenue: 0 };
      map.set(key, { count: existing.count + 1, revenue: existing.revenue + (r.totalAmount ?? 0) });
    }
    const total = dayData.inHouseRes.length;
    return Array.from(map.entries())
      .map(([source, data]) => {
        const channelDef = channels.find(c => c.id?.toUpperCase() === source || c.name?.toUpperCase().includes(source));
        const adr = data.count > 0 ? Math.round(data.revenue / data.count) : 0;
        return {
          source,
          label: getSourceLabel(source),
          color: channelDef?.color ?? '#6366F1',
          count: data.count,
          revenue: data.revenue,
          adr,
          share: total > 0 ? Math.round((data.count / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [dayData, channels]);

  // ── Room type breakdown ────────────────────────────────────────────────────
  const roomTypeStats = useMemo(() => {
    if (!dayData) return [];
    const map = new Map<string, { count: number; revenue: number; capacity: number }>();
    // Capacity by type
    for (const room of dayData.sellableRooms) {
      const key = room.type || 'Non défini';
      const existing = map.get(key) ?? { count: 0, revenue: 0, capacity: 0 };
      map.set(key, { ...existing, capacity: existing.capacity + 1 });
    }
    // Occupied by type
    for (const r of dayData.inHouseRes) {
      const key = r.roomType || 'Non défini';
      const existing = map.get(key) ?? { count: 0, revenue: 0, capacity: 0 };
      map.set(key, { ...existing, count: existing.count + 1, revenue: existing.revenue + (r.totalAmount ?? 0) });
    }
    return Array.from(map.entries())
      .map(([type, data]) => ({
        type,
        occupied: data.count,
        capacity: data.capacity,
        revenue: data.revenue,
        occRate: data.capacity > 0 ? Math.round((data.count / data.capacity) * 100) : 0,
      }))
      .sort((a, b) => b.occRate - a.occRate);
  }, [dayData]);

  // ── Forecast J+30 (real projection from calendarDays) ──────────────────────
  const forecast = useMemo(() => {
    if (!selectedDate) return null;
    const startIdx = calendarDays.findIndex(d => d.dateStr === selectedDate);
    if (startIdx < 0) return null;
    // Next 30 days from selected date (within available calendar window)
    const next30 = calendarDays.slice(startIdx, startIdx + 30);
    if (next30.length === 0) return null;
    const avgOcc = Math.round(next30.reduce((s, d) => s + d.occ, 0) / next30.length);
    const totalCa = next30.reduce((s, d) => s + d.ca, 0);
    const occupiedDays = next30.filter(d => d.occ > 0);
    const avgAdr = occupiedDays.length > 0
      ? Math.round(occupiedDays.reduce((s, d) => s + d.adr, 0) / occupiedDays.length)
      : 0;
    const avgRevpar = Math.round(next30.reduce((s, d) => s + d.revpar, 0) / next30.length);
    return { days: next30, avgOcc, totalCa, avgAdr, avgRevpar };
  }, [selectedDate, calendarDays]);

  // ── Alerts: derived from real data ─────────────────────────────────────────
  const alerts = useMemo(() => {
    const out: Array<{
      kind: 'critical' | 'warning' | 'info';
      title: string;
      message: string;
      source: string;
    }> = [];

    if (!dayData) return out;

    // Compression / surbooking
    if (dayData.occ >= 95) {
      out.push({
        kind: 'critical',
        title: 'Compression — risque de refus',
        message: `Occupation à ${dayData.occ}% (${dayData.occupiedCount}/${dayData.totalRooms} ch.). Fermer les classes basses, augmenter le BAR.`,
        source: 'Calendrier Revenue',
      });
    } else if (dayData.occ <= 25) {
      out.push({
        kind: 'warning',
        title: 'Occupation faible',
        message: `TO ${dayData.occ}% — activer pickup, offre direct/mobile, packages.`,
        source: 'Calendrier Revenue',
      });
    }

    // No-show
    if (dayData.noShowRes.length > 0) {
      out.push({
        kind: 'warning',
        title: `${dayData.noShowRes.length} no-show enregistré${dayData.noShowRes.length > 1 ? 's' : ''}`,
        message: 'Vérifier les politiques de garantie et facturer les nuitées si applicable.',
        source: 'Réservations',
      });
    }

    // High-impact RMS events
    const criticalRms = dayData.dayRmsEvents.filter(e => e.impact?.level === 'critical' || e.impact?.level === 'high');
    for (const ev of criticalRms) {
      out.push({
        kind: ev.impact?.level === 'critical' ? 'critical' : 'warning',
        title: `Événement majeur — ${ev.name}`,
        message: `${ev.city ?? ''}${ev.venue ? ` · ${ev.venue}` : ''} — Compression marché ${ev.impact?.compression ?? '?'}/100.`,
        source: ev.primarySource ?? 'RMS Events',
      });
    }

    // Insight-based risk
    const insight = selectedDate ? insightsByDate[selectedDate] : undefined;
    if (insight?.riskLevel === 'high') {
      out.push({
        kind: 'warning',
        title: 'Risque élevé — action recommandée',
        message: insight.recommendedAction,
        source: 'Moteur RMS interne',
      });
    }

    return out;
  }, [dayData, selectedDate, insightsByDate]);

  // ── Insight (for Score tab) ────────────────────────────────────────────────
  const insight = selectedDate ? insightsByDate[selectedDate] : undefined;

  // ── Refresh handler ────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      // 1. Invalidate React Query caches used by parent hooks (useRMS*, useOperational*, etc.)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['rms-events'] }),
        queryClient.invalidateQueries({ queryKey: ['rms-pricing-reco'] }),
        queryClient.invalidateQueries({ queryKey: ['operational-data'] }),
      ]);
      // 2. Ask the parent to refetch its own sources (context, Zustand stores)
      if (onRefresh) {
        await onRefresh();
      }
      // 3. Force-recompute internal memos (dayData, channelStats, etc.)
      setRefreshTick(t => t + 1);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Données actualisées', type: 'success' },
      }));
    } catch (err) {
      console.error('[RevenueDetailsModal] refresh failed:', err);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Erreur lors de l\'actualisation', type: 'error' },
      }));
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Export handler (CSV download) ──────────────────────────────────────────
  const handleExport = () => {
    if (isExporting || !dayData || !selectedDate) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Aucune donnée à exporter', type: 'error' },
      }));
      return;
    }
    setIsExporting(true);
    try {
      const lines: string[] = [];
      const sep = ';';

      // Header section
      lines.push(`Rapport Revenue - ${selectedDate}`);
      lines.push(`Genere le${sep}${new Date().toISOString()}`);
      lines.push('');

      // KPIs
      lines.push('KPI');
      lines.push(`Metric${sep}Valeur`);
      lines.push(`Taux d'occupation${sep}${dayData.occ}%`);
      lines.push(`ADR${sep}${dayData.adr} EUR`);
      lines.push(`RevPAR${sep}${dayData.revpar} EUR`);
      lines.push(`CA total${sep}${dayData.ca} EUR`);
      lines.push(`Chambres vendues${sep}${dayData.occupiedCount}`);
      lines.push(`Chambres disponibles${sep}${dayData.availableCount}`);
      lines.push(`Capacite totale${sep}${dayData.totalRooms}`);
      lines.push(`Arrivees${sep}${dayData.arrivalsRes.length}`);
      lines.push(`Departs${sep}${dayData.departuresRes.length}`);
      lines.push(`No-show${sep}${dayData.noShowRes.length}`);
      lines.push('');

      // Channels
      if (channelStats.length > 0) {
        lines.push('CANAUX');
        lines.push(`Canal${sep}Reservations${sep}Part${sep}CA${sep}ADR canal`);
        for (const ch of channelStats) {
          lines.push(`${ch.label}${sep}${ch.count}${sep}${ch.share}%${sep}${ch.revenue} EUR${sep}${ch.adr} EUR`);
        }
        lines.push('');
      }

      // Room types
      if (roomTypeStats.length > 0) {
        lines.push('TYPES DE CHAMBRE');
        lines.push(`Type${sep}Occupees${sep}Capacite${sep}Taux${sep}CA`);
        for (const rt of roomTypeStats) {
          lines.push(`${rt.type}${sep}${rt.occupied}${sep}${rt.capacity}${sep}${rt.occRate}%${sep}${rt.revenue} EUR`);
        }
        lines.push('');
      }

      // Reservations
      if (dayData.inHouseRes.length > 0) {
        lines.push('RESERVATIONS PRESENTES');
        lines.push(`ID${sep}Client${sep}Chambre${sep}Type${sep}Canal${sep}Montant`);
        for (const r of dayData.inHouseRes) {
          const safe = (s: string) => (s ?? '').replace(/[;\n\r]/g, ' ');
          lines.push(`${safe(r.id)}${sep}${safe(r.client)}${sep}${safe(r.room)}${sep}${safe(r.roomType)}${sep}${safe(r.source)}${sep}${r.totalAmount ?? 0} EUR`);
        }
        lines.push('');
      }

      // Events
      if (dayData.dayEvents.length > 0) {
        lines.push('EVENEMENTS');
        lines.push(`Nom${sep}Debut${sep}Fin${sep}Impact${sep}Source`);
        for (const e of dayData.dayEvents) {
          const safe = (s: string | undefined) => (s ?? '').replace(/[;\n\r]/g, ' ');
          lines.push(`${safe(e.name)}${sep}${safe(e.startDate)}${sep}${safe(e.endDate)}${sep}${safe(e.impact)}${sep}${safe(e.source)}`);
        }
        lines.push('');
      }

      // Alerts
      if (alerts.length > 0) {
        lines.push('ALERTES');
        lines.push(`Niveau${sep}Titre${sep}Message${sep}Source`);
        for (const a of alerts) {
          const safe = (s: string) => (s ?? '').replace(/[;\n\r]/g, ' ');
          lines.push(`${safe(a.kind)}${sep}${safe(a.title)}${sep}${safe(a.message)}${sep}${safe(a.source)}`);
        }
      }

      // Trigger download with BOM for Excel UTF-8 compat
      const csv = '﻿' + lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue-report-${selectedDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Rapport exporte (revenue-report-${selectedDate}.csv)`, type: 'success' },
      }));
    } catch (err) {
      console.error('[RevenueDetailsModal] export failed:', err);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Erreur lors de l\'export', type: 'error' },
      }));
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'day' as const, label: 'Analyse du Jour', icon: Calendar },
    { id: 'events' as const, label: 'Événements', icon: Zap },
    { id: 'channels' as const, label: 'Canaux', icon: Globe },
    { id: 'forecast' as const, label: 'Forecast J+30', icon: TrendingUp },
    { id: 'alerts' as const, label: 'Alertes', icon: AlertCircle, badge: alerts.length },
    { id: 'score' as const, label: 'Scoring', icon: Target },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/40 backdrop-blur-md overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="revenue-details-title"
        className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col h-[88vh] overflow-hidden border border-white/20"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <TrendingUp size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 id="revenue-details-title" className="text-xl font-bold text-gray-800 leading-tight">
                  Détails Complets — {formatLongDate(selectedDate)}
                </h2>
                <Badge className="bg-emerald-50 text-emerald-600 border-none text-[10px] font-bold px-2 py-0.5 rounded-md">LIVE DATA</Badge>
              </div>
              <p className="text-sm font-medium text-gray-500 mt-0.5">
                {dayData ? `${dayData.occupiedCount}/${dayData.totalRooms} chambres · ${fmtEUR(dayData.ca)} CA` : 'Aucune donnée pour cette date'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !dayData}
              title={!dayData ? 'Aucune donnée' : 'Exporter le rapport en CSV'}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isExporting ? 'Export…' : 'Exporter'}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Recharger les données depuis le serveur"
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isRefreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="px-8 border-b border-gray-100 bg-white shrink-0 flex items-center gap-6 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "py-3 px-2 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap text-sm",
                activeTab === tab.id ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-gray-500 hover:text-gray-800 font-normal"
              )}
            >
              <tab.icon size={15} className={activeTab === tab.id ? "text-indigo-600" : "text-gray-400"} />
              <span>{tab.label}</span>
              {'badge' in tab && tab.badge && tab.badge > 0 && (
                <span className={cn(
                  "ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-indigo-600 text-white" : "bg-rose-100 text-rose-600"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#F8FAFC]">
          <AnimatePresence mode="wait">
            {!dayData ? (
              <motion.div
                key="no-data"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-gray-400"
              >
                <Info size={40} className="mb-3" />
                <p className="text-sm font-bold">Aucune donnée disponible pour cette date.</p>
                <p className="text-xs mt-1">Sélectionnez un jour dans le calendrier.</p>
              </motion.div>
            ) : (
              <>
                {activeTab === 'day' && (
                  <DayTab
                    key="tab-day"
                    dayData={dayData}
                    insight={insight}
                    roomTypeStats={roomTypeStats}
                    channelStats={channelStats}
                  />
                )}
                {activeTab === 'events' && (
                  <EventsTab
                    key="tab-events"
                    dayEvents={dayData.dayEvents}
                    rmsEvents={dayData.dayRmsEvents}
                  />
                )}
                {activeTab === 'channels' && (
                  <ChannelsTab
                    key="tab-channels"
                    channelStats={channelStats}
                    totalCa={dayData.ca}
                  />
                )}
                {activeTab === 'forecast' && (
                  <ForecastTab key="tab-forecast" forecast={forecast} />
                )}
                {activeTab === 'alerts' && (
                  <AlertsTab key="tab-alerts" alerts={alerts} />
                )}
                {activeTab === 'score' && (
                  <ScoreTab
                    key="tab-score"
                    insight={insight}
                    dayData={dayData}
                  />
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Analyse du Jour
// ─────────────────────────────────────────────────────────────────────────────

interface DayData {
  totalRooms: number;
  occupiedCount: number;
  availableCount: number;
  inHouseRes: Reservation[];
  arrivalsRes: Reservation[];
  departuresRes: Reservation[];
  noShowRes: Reservation[];
  ca: number;
  occ: number;
  adr: number;
  revpar: number;
  dayEvents: HotelEvent[];
  dayRmsEvents: RMSMarketEvent[];
  sellableRooms: Room[];
  target: Date;
}

const DayTab: React.FC<{
  dayData: DayData;
  insight?: RevenueInsight;
  roomTypeStats: Array<{ type: string; occupied: number; capacity: number; revenue: number; occRate: number }>;
  channelStats: Array<{ source: string; label: string; color: string; count: number; revenue: number; adr: number; share: number }>;
}> = ({ dayData, insight, roomTypeStats, channelStats }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="space-y-6"
  >
    {/* KPI principal */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard label="Taux d'occupation" value={fmtPct(dayData.occ)} sub={`${dayData.occupiedCount}/${dayData.totalRooms} ch.`} icon={PieChart} color="text-emerald-600" />
      <KPICard label="ADR" value={dayData.adr > 0 ? fmtEUR(dayData.adr) : '—'} sub="CA / vendues" icon={DollarSign} color="text-indigo-600" />
      <KPICard label="RevPAR" value={fmtEUR(dayData.revpar)} sub="CA / dispo" icon={Activity} color="text-violet-600" />
      <KPICard label="CA Journalier" value={fmtEUR(dayData.ca)} sub="Somme réelle" icon={Euro} color="text-emerald-700" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Flux d'activité */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <Activity size={16} className="text-indigo-500" /> Flux d'activité
        </h4>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6">
          <FluxRow icon={Calendar} label="Réservations" val={String(dayData.inHouseRes.length)} />
          <FluxRow icon={Users} label="Clients in-house" val={String(dayData.inHouseRes.length)} />
          <FluxRow icon={ArrowUpRight} label="Arrivées" val={String(dayData.arrivalsRes.length)} />
          <FluxRow icon={ArrowDownRight} label="Départs" val={String(dayData.departuresRes.length)} />
          <FluxRow icon={BedDouble} label="Chambres dispo." val={String(dayData.availableCount)} />
          <FluxRow
            icon={UserX}
            label="No-show"
            val={String(dayData.noShowRes.length)}
            valColor={dayData.noShowRes.length > 0 ? 'text-rose-500' : undefined}
          />
        </div>
      </div>

      {/* Recommandations Yield (RMS interne) */}
      <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-md">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-medium text-slate-300">Recommandations Yield</h4>
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Zap size={14} className="text-indigo-300" />
          </div>
        </div>
        {insight ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                Demande {insight.demandLevel === 'strong' ? 'forte' : insight.demandLevel === 'normal' ? 'normale' : 'faible'}
                {' · '}
                Risque {insight.riskLevel === 'high' ? 'élevé' : insight.riskLevel === 'medium' ? 'modéré' : 'faible'}
              </p>
              <p className="text-sm font-medium text-slate-100">{insight.recommendedAction}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[9px] font-black uppercase text-slate-400">Delta tarif</p>
                <p className={cn(
                  "text-lg font-black tabular-nums",
                  insight.recommendedDeltaPct > 0 ? 'text-emerald-300' : insight.recommendedDeltaPct < 0 ? 'text-rose-300' : 'text-slate-200'
                )}>
                  {insight.recommendedDeltaPct > 0 ? '+' : ''}{insight.recommendedDeltaPct}%
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[9px] font-black uppercase text-slate-400">Pickup signal</p>
                <p className={cn(
                  "text-lg font-black tabular-nums",
                  insight.pickupSignal >= 0 ? 'text-emerald-300' : 'text-rose-300'
                )}>
                  {insight.pickupSignal >= 0 ? '+' : ''}{insight.pickupSignal}%
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Donnée non disponible</p>
        )}
      </div>

      {/* Top canaux */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="text-base font-semibold text-gray-800 mb-5">Top canaux du jour</h4>
        {channelStats.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune réservation</p>
        ) : (
          <div className="space-y-4">
            {channelStats.slice(0, 5).map(ch => (
              <div key={ch.source} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ch.color }} />
                    <span className="text-sm font-semibold text-gray-800">{ch.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[10px] font-bold text-gray-400">{ch.count} ch.</span>
                    <span className="text-base font-bold text-gray-900 tabular-nums">{ch.share}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ background: ch.color, width: `${ch.share}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 tabular-nums">CA {fmtEUR(ch.revenue)} · ADR {ch.adr > 0 ? fmtEUR(ch.adr) : '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Répartition par type de chambre */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="text-base font-semibold text-gray-800 mb-5">Par type de chambre</h4>
        {roomTypeStats.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun type configuré</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {roomTypeStats.slice(0, 6).map(rt => {
              const color = rt.occRate >= 80 ? 'text-emerald-600' : rt.occRate >= 50 ? 'text-indigo-600' : 'text-gray-600';
              const bg = rt.occRate >= 80 ? 'bg-emerald-50/50' : rt.occRate >= 50 ? 'bg-indigo-50/50' : 'bg-gray-50';
              return (
                <div key={rt.type} className={cn("p-4 rounded-2xl border border-gray-100", bg)}>
                  <p className="text-xs font-medium text-gray-500 mb-1 truncate">{rt.type}</p>
                  <p className={cn("text-2xl font-bold tabular-nums", color)}>{rt.occRate}%</p>
                  <p className="text-[10px] text-gray-400 tabular-nums mt-1">{rt.occupied}/{rt.capacity} ch.</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* Liste réservations in-house */}
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h4 className="text-base font-semibold text-gray-800 mb-4">
        Réservations présentes
        <span className="ml-2 text-xs font-medium text-gray-400">({dayData.inHouseRes.length})</span>
      </h4>
      {dayData.inHouseRes.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune réservation</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {dayData.inHouseRes.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                  <Users size={13} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-gray-900 truncate">{r.client}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    Ch. {r.room} · {r.roomType} · {getSourceLabel(r.source)}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-black text-gray-700 tabular-nums shrink-0">
                {fmtEUR(r.totalAmount || 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Événements
// ─────────────────────────────────────────────────────────────────────────────

const EventsTab: React.FC<{
  dayEvents: HotelEvent[];
  rmsEvents: RMSMarketEvent[];
}> = ({ dayEvents, rmsEvents }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="space-y-6"
  >
    {/* Événements hôtel (configStore) */}
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h4 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar size={16} className="text-indigo-500" /> Événements hôtel
        <span className="ml-1 text-xs font-medium text-gray-400">({dayEvents.length})</span>
      </h4>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucun événement enregistré pour cette date</p>
      ) : (
        <div className="space-y-2">
          {dayEvents.map(evt => (
            <div key={evt.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-1 h-12 rounded-full shrink-0",
                  evt.impact === 'critical' ? 'bg-rose-500' :
                  evt.impact === 'high' ? 'bg-orange-500' :
                  evt.impact === 'medium' ? 'bg-amber-400' :
                  'bg-emerald-400'
                )} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{evt.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {evt.location ?? 'Lieu non précisé'}
                    {evt.source && <span> · {evt.source}</span>}
                  </p>
                  {evt.description && (
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{evt.description}</p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-medium text-gray-400">{evt.startDate} → {evt.endDate}</p>
                <span className={cn(
                  "inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase",
                  evt.impact === 'critical' ? 'bg-rose-100 text-rose-700' :
                  evt.impact === 'high' ? 'bg-orange-100 text-orange-700' :
                  evt.impact === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                )}>
                  Impact {evt.impact === 'critical' ? 'critique' : evt.impact === 'high' ? 'fort' : evt.impact === 'medium' ? 'moyen' : 'faible'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Événements marché (RMS) */}
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h4 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Zap size={16} className="text-violet-500" /> Événements marché (RMS)
        <span className="ml-1 text-xs font-medium text-gray-400">({rmsEvents.length})</span>
      </h4>
      {rmsEvents.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucun événement marché détecté pour cette date</p>
      ) : (
        <div className="space-y-2">
          {rmsEvents.map(evt => (
            <div key={evt.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{evt.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {evt.city}
                    {evt.zone && <span> · {evt.zone}</span>}
                    {evt.venue && <span> · {evt.venue}</span>}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {evt.startDate} → {evt.endDate} · Source : {evt.primarySource}
                  </p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[9px] font-black uppercase shrink-0",
                  evt.impact?.level === 'critical' || evt.impact?.level === 'hyper_compression' ? 'bg-rose-100 text-rose-700' :
                  evt.impact?.level === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-emerald-100 text-emerald-700'
                )}>
                  {evt.impact?.level ?? 'normal'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-white rounded-lg px-2 py-1 border border-gray-100">
                  <span className="text-gray-400">ADR</span>
                  <span className="ml-1 font-bold text-gray-700 tabular-nums">+{evt.impact?.adr ?? 0}%</span>
                </div>
                <div className="bg-white rounded-lg px-2 py-1 border border-gray-100">
                  <span className="text-gray-400">RevPAR</span>
                  <span className="ml-1 font-bold text-gray-700 tabular-nums">+{evt.impact?.revpar ?? 0}%</span>
                </div>
                <div className="bg-white rounded-lg px-2 py-1 border border-gray-100">
                  <span className="text-gray-400">Compression</span>
                  <span className="ml-1 font-bold text-gray-700 tabular-nums">{evt.impact?.compression ?? 0}/100</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Canaux
// ─────────────────────────────────────────────────────────────────────────────

const ChannelsTab: React.FC<{
  channelStats: Array<{ source: string; label: string; color: string; count: number; revenue: number; adr: number; share: number }>;
  totalCa: number;
}> = ({ channelStats, totalCa }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="space-y-6"
  >
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h4 className="text-base font-semibold text-gray-800 mb-4">
        Répartition par canal — issue des vraies réservations
      </h4>
      {channelStats.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune réservation pour cette date</p>
      ) : (
        <div className="space-y-3">
          {channelStats.map(ch => (
            <div key={ch.source} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: ch.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{ch.label}</p>
                    <p className="text-[10px] text-gray-500">{ch.count} réservation{ch.count > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-gray-900 tabular-nums">{ch.share}%</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">{fmtEUR(ch.revenue)}</p>
                </div>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ background: ch.color, width: `${ch.share}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-white px-2 py-1 rounded-md border border-gray-100">
                  <span className="text-gray-400">ADR canal</span>
                  <span className="ml-1 font-bold text-gray-700 tabular-nums">{ch.adr > 0 ? fmtEUR(ch.adr) : '—'}</span>
                </div>
                <div className="bg-white px-2 py-1 rounded-md border border-gray-100">
                  <span className="text-gray-400">Part CA</span>
                  <span className="ml-1 font-bold text-gray-700 tabular-nums">
                    {totalCa > 0 ? Math.round((ch.revenue / totalCa) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Forecast J+30
// ─────────────────────────────────────────────────────────────────────────────

const ForecastTab: React.FC<{
  forecast: { days: RevenueCalendarDay[]; avgOcc: number; totalCa: number; avgAdr: number; avgRevpar: number } | null;
}> = ({ forecast }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="space-y-6"
  >
    {!forecast ? (
      <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
        <Info size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-bold text-gray-500">Donnée non disponible</p>
        <p className="text-xs text-gray-400 mt-1">Pas de forecast J+30 calculé pour cette plage.</p>
      </div>
    ) : (
      <>
        {/* Forecast summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Occupation prévue" value={fmtPct(forecast.avgOcc)} sub={`Moy. ${forecast.days.length} j`} icon={PieChart} color="text-emerald-600" />
          <KPICard label="ADR prévu" value={forecast.avgAdr > 0 ? fmtEUR(forecast.avgAdr) : '—'} sub="Jours occupés" icon={DollarSign} color="text-indigo-600" />
          <KPICard label="RevPAR prévu" value={fmtEUR(forecast.avgRevpar)} sub={`Sur ${forecast.days.length} j`} icon={Activity} color="text-violet-600" />
          <KPICard label="CA prévu" value={fmtEUR(forecast.totalCa)} sub="Cumul" icon={Euro} color="text-emerald-700" />
        </div>

        {/* Jour par jour */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h4 className="text-base font-semibold text-gray-800 mb-4">Évolution jour par jour</h4>
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {forecast.days.map(d => (
              <div key={d.dateStr} className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <span className="font-bold text-gray-700 w-16 shrink-0 tabular-nums">
                  {new Date(`${d.dateStr}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
                <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      d.occ >= 80 ? "bg-emerald-500" :
                      d.occ >= 60 ? "bg-indigo-500" :
                      d.occ >= 40 ? "bg-amber-400" :
                      "bg-rose-400"
                    )}
                    style={{ width: `${Math.min(100, d.occ)}%` }}
                  />
                </div>
                <span className="font-bold text-gray-700 w-12 text-right tabular-nums">{d.occ}%</span>
                <span className="text-gray-500 w-20 text-right tabular-nums">ADR {d.adr > 0 ? `${d.adr}€` : '—'}</span>
                <span className="text-gray-500 w-20 text-right tabular-nums">{fmtEUR(d.ca)}</span>
                {d.events.length > 0 && (
                  <Zap size={11} className="text-indigo-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </>
    )}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Alertes
// ─────────────────────────────────────────────────────────────────────────────

const AlertsTab: React.FC<{
  alerts: Array<{ kind: 'critical' | 'warning' | 'info'; title: string; message: string; source: string }>;
}> = ({ alerts }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="space-y-4"
  >
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h4 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <AlertCircle size={16} className="text-rose-500" />
        Alertes du jour
        <span className="ml-1 text-xs font-medium text-gray-400">({alerts.length})</span>
      </h4>
      {alerts.length === 0 ? (
        <div className="text-center py-10">
          <ShieldCheck size={32} className="mx-auto text-emerald-300 mb-2" />
          <p className="text-sm font-bold text-gray-500">Aucune alerte</p>
          <p className="text-xs text-gray-400 mt-1">Tous les indicateurs sont dans la zone normale.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={cn(
                "p-4 rounded-2xl border flex items-start gap-3",
                a.kind === 'critical' ? 'bg-rose-50 border-rose-100' :
                a.kind === 'warning' ? 'bg-amber-50 border-amber-100' :
                'bg-sky-50 border-sky-100'
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                a.kind === 'critical' ? 'bg-rose-100 text-rose-600' :
                a.kind === 'warning' ? 'bg-amber-100 text-amber-600' :
                'bg-sky-100 text-sky-600'
              )}>
                <AlertCircle size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-600 mt-1">{a.message}</p>
                <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-widest font-bold">Source : {a.source}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Scoring
// ─────────────────────────────────────────────────────────────────────────────

const ScoreTab: React.FC<{
  insight?: RevenueInsight;
  dayData: DayData;
}> = ({ insight, dayData }) => {
  if (!insight) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center"
      >
        <Info size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-bold text-gray-500">Scoring non disponible</p>
        <p className="text-xs text-gray-400 mt-1">Le moteur RMS n'a pas calculé d'indicateur pour cette date.</p>
      </motion.div>
    );
  }

  const scoreColor = insight.score >= 85 ? 'text-emerald-600' :
                     insight.score >= 70 ? 'text-indigo-600' :
                     insight.score >= 55 ? 'text-amber-600' :
                     'text-rose-600';
  const scoreBg = insight.score >= 85 ? 'bg-emerald-50 border-emerald-100' :
                  insight.score >= 70 ? 'bg-indigo-50 border-indigo-100' :
                  insight.score >= 55 ? 'bg-amber-50 border-amber-100' :
                  'bg-rose-50 border-rose-100';

  // Real factor breakdown: occ contributes 40%, ADR index 25%, RevPAR index 25%, events 10%
  const factors = [
    { label: 'Taux d\'occupation', weight: 40, value: `${dayData.occ}%` },
    { label: 'Index ADR', weight: 25, value: `${dayData.adr > 0 ? `${dayData.adr} €` : '—'}` },
    { label: 'Index RevPAR', weight: 25, value: `${dayData.revpar} €` },
    { label: 'Boost événementiel', weight: 10, value: `${dayData.dayEvents.length} évt(s)` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      {/* Big score */}
      <div className={cn("p-8 rounded-3xl border flex items-center gap-6", scoreBg)}>
        <div className="w-28 h-28 rounded-full bg-white border-4 border-current flex items-center justify-center shadow-lg shrink-0">
          <div className={cn("text-center", scoreColor)}>
            <p className="text-4xl font-black tabular-nums leading-none">{insight.score}</p>
            <p className="text-[9px] font-black uppercase tracking-widest mt-0.5">/ 100</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Score RMS du jour</p>
          <p className={cn("text-2xl font-black mt-1", scoreColor)}>
            {insight.score >= 85 ? 'Excellent' :
             insight.score >= 70 ? 'Bon' :
             insight.score >= 55 ? 'Moyen' :
             'Faible'}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            Demande {insight.demandLevel === 'strong' ? 'forte' : insight.demandLevel === 'normal' ? 'normale' : 'faible'}
            {' · '}
            Risque {insight.riskLevel === 'high' ? 'élevé' : insight.riskLevel === 'medium' ? 'modéré' : 'faible'}
          </p>
        </div>
      </div>

      {/* Recommandation */}
      <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-md">
        <div className="flex items-center gap-3 mb-3">
          <Zap size={16} className="text-indigo-300" />
          <p className="text-sm font-bold text-slate-100">Action recommandée</p>
        </div>
        <p className="text-base text-slate-100">{insight.recommendedAction}</p>
        {insight.recommendedDeltaPct !== 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Ajustement tarifaire suggéré : {insight.recommendedDeltaPct > 0 ? '+' : ''}{insight.recommendedDeltaPct}%
          </p>
        )}
      </div>

      {/* Facteurs */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="text-base font-semibold text-gray-800 mb-4">Méthode de calcul — facteurs pondérés</h4>
        <div className="space-y-3">
          {factors.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-700 w-44 shrink-0">{f.label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${f.weight}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-gray-500 w-12 text-right">{f.weight}%</span>
              <span className="text-xs font-bold text-gray-700 w-20 text-right tabular-nums">{f.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-4 italic">
          Score = (TO × 0,40) + (index ADR × 0,25) + (index RevPAR × 0,25) + (boost événementiel × 0,10), borné [35, 99].
        </p>
      </div>

      {/* Pickup signal */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="text-base font-semibold text-gray-800 mb-3">Signal Pickup</h4>
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            insight.pickupSignal >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          )}>
            {insight.pickupSignal >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div>
            <p className="text-3xl font-black tabular-nums">
              {insight.pickupSignal >= 0 ? '+' : ''}{insight.pickupSignal}%
            </p>
            <p className="text-xs text-gray-500">
              Tendance pickup (vs baseline). {insight.pickupSignal >= 5 ? 'Accélération — fermer les classes basses.' :
              insight.pickupSignal >= 0 ? 'Stable.' :
              'Ralentissement — activer offre direct.'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const KPICard: React.FC<{
  label: string; value: string; sub: string; icon: React.ElementType; color: string;
}> = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
    <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <p className={cn("text-2xl font-bold tracking-tight tabular-nums leading-tight", color)}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  </div>
);

const FluxRow: React.FC<{
  icon: React.ElementType; label: string; val: string; valColor?: string;
}> = ({ icon: Icon, label, val, valColor }) => (
  <div className="flex items-center justify-between border-b border-gray-50 pb-2">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-gray-400" />
      <span className="text-xs font-medium text-gray-500">{label}</span>
    </div>
    <span className={cn("text-sm font-bold tabular-nums", valColor || "text-gray-900")}>{val}</span>
  </div>
);

export default RevenueDetailsModal;
