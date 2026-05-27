/**
 * FLOWTYM — Revenue Calendar (KPI + Graphiques sub-views).
 *
 * Monthly grid (Mon→Sun × N rows) with optional N-day period mode.
 * Each cell shows: day number, occupancy %, ADR €, RevPAR €, events badge.
 * Two sub-views:
 *   • KPI         — colored heatmap by occupancy with click → DayDetailModal
 *   • Graphiques  — Recharts line chart (ADR + RevPAR) + occupancy area
 *
 * T3 improvements:
 * - Fixed ADR calculation (revenue / max(1, occupied rooms))
 * - Period selector: 7J / 14J / 30J / 60J / 90J (plus default monthly mode)
 * - Room type filter + partner/channel filter
 * - onDayClick callback for day detail modal (T6)
 */
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, BarChart2, Filter } from 'lucide-react';

import { fmtEUR, isoDay, type RevenueSubView } from './types';
import { OCC_THRESHOLDS, getOccThreshold } from './revenueThresholds';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow } from '@/src/lib/supabase.types';
import type { HotelEvent } from '@/src/store/configStore';
import { cn } from '@/src/lib/utils';

// Re-export for consumers (DayDetailModal, etc.)
export { OCC_THRESHOLDS, getOccThreshold as heatmapTone };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DayCell {
  date: Date;
  dateStr: string;
  dateNum: number;
  isToday: boolean;
  occ: number;
  ca: number;
  adr: number;
  revpar: number;
  events: HotelEvent[];
  reservations: ReservationRow[];
}

interface Props {
  monthDate: Date;
  /** Optional start date for period-range mode (used with periodDays). Defaults to monthDate. */
  startDate?: Date;
  reservations: ReservationRow[];
  rooms: RoomRow[];
  events: HotelEvent[];
  subView: RevenueSubView;
  setSubView: (s: RevenueSubView) => void;
  /** Callback when a day cell is clicked — triggers DayDetailModal in parent */
  onDayClick?: (day: DayCell) => void;
  /** Map of dateStr → pickup count (new reservations in last 7 days for that date) */
  pickupByDate?: Map<string, number>;
  /** Map of dateStr → cancellation count */
  cancellationsByDate?: Map<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Period options
// ─────────────────────────────────────────────────────────────────────────────

type PeriodOption = 0 | 7 | 14 | 30 | 60 | 90;
const PERIOD_OPTIONS: { label: string; value: PeriodOption }[] = [
  { label: 'Mois', value: 0 },
  { label: '7J', value: 7 },
  { label: '14J', value: 14 },
  { label: '30J', value: 30 },
  { label: '60J', value: 60 },
  { label: '90J', value: 90 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FR_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const FR_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const RevenueCalendar: React.FC<Props> = ({
  monthDate,
  startDate,
  reservations: allReservations,
  rooms: allRooms,
  events,
  subView,
  setSubView,
  onDayClick,
  pickupByDate,
  cancellationsByDate,
}) => {
  // ── Local state ─────────────────────────────────────────────────────────────
  const [periodDays, setPeriodDays] = useState<PeriodOption>(0); // 0 = monthly mode
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');

  // ── Derived filter options ───────────────────────────────────────────────────
  const roomTypes = useMemo(() => {
    const types = new Set(allRooms.map(r => r.type).filter(Boolean) as string[]);
    return Array.from(types).sort();
  }, [allRooms]);

  const partners = useMemo(() => {
    const sources = new Set(allReservations.map(r => r.source).filter(Boolean) as string[]);
    return Array.from(sources).sort();
  }, [allReservations]);

  // ── Filtered data ────────────────────────────────────────────────────────────
  const reservations = useMemo(() => {
    let filtered = allReservations.filter(r => r.status !== 'cancelled');
    if (partnerFilter !== 'all') {
      filtered = filtered.filter(r =>
        (r.source ?? '').toUpperCase() === partnerFilter.toUpperCase()
      );
    }
    return filtered;
  }, [allReservations, partnerFilter]);

  const rooms = useMemo(() => {
    if (roomTypeFilter === 'all') return allRooms;
    return allRooms.filter(r => r.type === roomTypeFilter);
  }, [allRooms, roomTypeFilter]);

  // ── Build day cells ──────────────────────────────────────────────────────────
  const days: DayCell[] = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out: DayCell[] = [];

    if (periodDays > 0) {
      // Range mode: N days from startDate (or monthDate if not provided)
      const base = startDate ?? monthDate;
      const origin = new Date(base); origin.setHours(0, 0, 0, 0);
      for (let i = 0; i < periodDays; i++) {
        const d = new Date(origin.getTime() + i * 86_400_000);
        out.push(buildDayCell(d, today, reservations, rooms, events));
      }
    } else {
      // Monthly mode: all days in monthDate's month
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();
      const last = new Date(y, m + 1, 0).getDate();
      for (let i = 1; i <= last; i++) {
        const d = new Date(y, m, i);
        out.push(buildDayCell(d, today, reservations, rooms, events));
      }
    }
    return out;
  }, [monthDate, startDate, periodDays, reservations, rooms, events]);

  // ── Aggregated KPIs ──────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const ca = days.reduce((s, d) => s + d.ca, 0);
    const daysWithOcc = days.filter(d => d.occ > 0);
    const occAvg = days.length
      ? Math.round(days.reduce((s, d) => s + d.occ, 0) / days.length)
      : 0;
    const adrAvg = daysWithOcc.length
      ? Math.round(daysWithOcc.reduce((s, d) => s + d.adr, 0) / daysWithOcc.length)
      : 0;
    const revparAvg = days.length
      ? Math.round(days.reduce((s, d) => s + d.revpar, 0) / days.length)
      : 0;
    return { ca, occAvg, adrAvg, revparAvg };
  }, [days]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const periodLabel = periodDays === 0
    ? FR_MONTHS[monthDate.getMonth()]
    : `${days[0]?.dateStr?.slice(8, 10)}/${days[0]?.dateStr?.slice(5, 7)} — ${days[days.length - 1]?.dateStr?.slice(8, 10)}/${days[days.length - 1]?.dateStr?.slice(5, 7)}`;

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden" data-testid="planning-revenue">

      {/* ── Top KPIs ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 min-w-0">
          <KpiTile testid="rev-kpi-occ" label="TO moyen" val={`${totals.occAvg}%`} hint={periodLabel} tone="emerald" />
          <KpiTile testid="rev-kpi-ca" label="CA total" val={fmtEUR(totals.ca)} hint={`${days.length} jours`} tone="indigo" />
          <KpiTile testid="rev-kpi-revpar" label="RevPAR moyen" val={fmtEUR(totals.revparAvg)} hint={`${rooms.length} chambres`} tone="violet" />
          <KpiTile testid="rev-kpi-adr" label="ADR moyen" val={fmtEUR(totals.adrAvg || 0)} hint="Sur jours occupés" tone="amber" />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100" data-testid="rev-period-selector">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriodDays(opt.value)}
                data-testid={`rev-period-${opt.label}`}
                className={cn(
                  "px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  periodDays === opt.value
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          {(roomTypes.length > 0 || partners.length > 0) && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-1" data-testid="rev-filters">
              <Filter size={12} className="text-gray-400 ml-1.5 shrink-0" />
              {roomTypes.length > 0 && (
                <select
                  value={roomTypeFilter}
                  onChange={e => setRoomTypeFilter(e.target.value)}
                  data-testid="rev-filter-roomtype"
                  className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-1 px-1 focus:ring-0 cursor-pointer"
                >
                  <option value="all">Tous les types</option>
                  {roomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {roomTypes.length > 0 && partners.length > 0 && (
                <div className="w-px h-4 bg-gray-200" />
              )}
              {partners.length > 0 && (
                <select
                  value={partnerFilter}
                  onChange={e => setPartnerFilter(e.target.value)}
                  data-testid="rev-filter-partner"
                  className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-1 px-1 focus:ring-0 cursor-pointer"
                >
                  <option value="all">Tous les canaux</option>
                  {partners.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Sub-view toggle */}
          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100" data-testid="rev-subview-toggle">
            {(['KPI', 'Graphiques'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSubView(v)}
                data-testid={`rev-subview-${v}`}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all",
                  subView === v ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {v === 'KPI' ? <TrendingUp size={12} /> : <BarChart2 size={12} />}
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {subView === 'KPI' ? (
          <KpiCalendar
            days={days}
            monthDate={monthDate}
            periodDays={periodDays}
            onDayClick={onDayClick}
            pickupByDate={pickupByDate}
            cancellationsByDate={cancellationsByDate}
          />
        ) : (
          <GraphView days={days} />
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a single DayCell
// ─────────────────────────────────────────────────────────────────────────────

function buildDayCell(
  d: Date,
  today: Date,
  reservations: ReservationRow[],
  rooms: RoomRow[],
  events: HotelEvent[],
): DayCell {
  const dStr = isoDay(d);
  const dt = d.getTime();
  const occRes = reservations.filter(r => {
    const a = new Date(r.check_in).getTime();
    const b = new Date(r.check_out).getTime();
    return !isNaN(a) && !isNaN(b) && dt >= a && dt < b;
  });

  const ca = occRes.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  // FIXED: ADR = revenue / occupied rooms (not total reservations)
  const adr = occRes.length ? Math.round(ca / occRes.length) : 0;
  const occ = rooms.length ? Math.round((occRes.length / rooms.length) * 100) : 0;
  const revpar = rooms.length ? Math.round(ca / rooms.length) : 0;
  const dayEvents = events.filter(e => dStr >= e.startDate && dStr <= e.endDate);

  return {
    date: d,
    dateStr: dStr,
    dateNum: d.getDate(),
    isToday: dt === today.getTime(),
    occ,
    ca,
    adr,
    revpar,
    events: dayEvents,
    reservations: occRes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI tiles
// ─────────────────────────────────────────────────────────────────────────────

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-50/40 border-emerald-100/50 text-emerald-700',
  indigo: 'bg-indigo-50/40 border-indigo-100/50 text-indigo-700',
  violet: 'bg-violet-50/40 border-violet-100/50 text-violet-700',
  amber: 'bg-amber-50/40 border-amber-100/50 text-amber-700',
};

const KpiTile: React.FC<{
  testid: string; label: string; val: string; hint: string; tone: keyof typeof TONE_BG;
}> = ({ testid, label, val, hint, tone }) => (
  <div className={`p-3 rounded-2xl border ${TONE_BG[tone]}`} data-testid={testid}>
    <p className="text-[10px] uppercase tracking-widest font-black opacity-60">{label}</p>
    <p className="text-lg lg:text-xl font-black tabular-nums mt-0.5">{val}</p>
    <p className="text-[9px] text-gray-500 truncate">{hint}</p>
  </div>
);

// OCC_THRESHOLDS and heatmapTone (= getOccThreshold) are re-exported above from revenueThresholds.ts

// ─────────────────────────────────────────────────────────────────────────────
// KPI Calendar grid
// ─────────────────────────────────────────────────────────────────────────────

const KpiCalendar: React.FC<{
  days: DayCell[];
  monthDate: Date;
  periodDays: PeriodOption;
  onDayClick?: (day: DayCell) => void;
  pickupByDate?: Map<string, number>;
  cancellationsByDate?: Map<string, number>;
}> = ({ days, monthDate, periodDays, onDayClick, pickupByDate, cancellationsByDate }) => {
  // Pad start to align with Monday-first calendar
  const firstDow = periodDays > 0
    ? (days[0]?.date.getDay() + 6) % 7  // Mon=0
    : (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;

  const padded: (DayCell | null)[] = [...Array(firstDow).fill(null), ...days];
  while (padded.length % 7 !== 0) padded.push(null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="rev-kpi-calendar">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
        {FR_DAYS.map(d => (
          <div key={d} className="px-2 py-2 text-[10px] uppercase font-black text-gray-500 tracking-widest text-center">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {padded.map((d, i) => {
          if (!d) return (
            <div key={`pad-${i}`} className="border-r border-b border-gray-50 min-h-[96px] bg-gray-50/30" />
          );

          const tone = getOccThreshold(d.occ);
          const pickup = pickupByDate?.get(d.dateStr) ?? 0;
          const cancels = cancellationsByDate?.get(d.dateStr) ?? 0;
          const isCompression = d.occ >= 90;
          const isClickable = !!onDayClick;

          return (
            <div
              key={d.dateStr}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={() => onDayClick?.(d)}
              onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onDayClick?.(d); } : undefined}
              className={cn(
                "relative border-r border-b border-gray-50 p-2 min-h-[96px] transition-colors",
                d.isToday ? "ring-2 ring-inset ring-indigo-400" : "",
                isClickable ? "cursor-pointer hover:bg-indigo-50/40 hover:shadow-inner" : ""
              )}
              data-testid={`rev-day-${d.dateStr}`}
              aria-label={`${d.dateStr}: ${d.occ}% occupation, ADR ${d.adr}€`}
            >
              {/* Date number + event badge */}
              <div className="flex items-start justify-between gap-1">
                <span className={cn(
                  "text-sm font-black tabular-nums",
                  d.isToday ? "text-indigo-600" : "text-gray-700"
                )}>
                  {d.dateNum}
                </span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {/* Pickup indicator */}
                  {pickup > 0 && (
                    <span
                      className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1 rounded"
                      title={`${pickup} nouvelle${pickup > 1 ? 's' : ''} réservation${pickup > 1 ? 's' : ''} (7j)`}
                    >
                      ↑{pickup}
                    </span>
                  )}
                  {/* Events badge */}
                  {d.events.length > 0 && (
                    <span
                      className="bg-rose-100 text-rose-700 text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center"
                      title={d.events.map(e => e.name).join(', ')}
                    >
                      {d.events.length}
                    </span>
                  )}
                  {/* Cancellations badge */}
                  {cancels > 0 && (
                    <span
                      className="bg-red-100 text-red-600 text-[8px] font-black px-1 rounded"
                      title={`${cancels} annulation${cancels > 1 ? 's' : ''}`}
                    >
                      ✕{cancels}
                    </span>
                  )}
                </div>
              </div>

              {/* Occupancy badge */}
              <div className={cn(
                "mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ring-1",
                tone.bg, tone.ring
              )}>
                {d.occ}%
              </div>

              {/* Compression label */}
              {isCompression && (
                <span className={cn("text-[8px] font-black uppercase tracking-tight block mt-0.5", tone.labelColor)}>
                  {tone.label}
                </span>
              )}

              <p className="text-[10px] text-gray-500 mt-1 tabular-nums">ADR {d.adr > 0 ? `${d.adr} €` : '—'}</p>
              <p className="text-[10px] text-gray-400 tabular-nums">CA {fmtEUR(d.ca)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Graph view
// ─────────────────────────────────────────────────────────────────────────────

const GraphView: React.FC<{ days: DayCell[] }> = ({ days }) => {
  const data = days.map(d => ({
    label: String(d.dateNum).padStart(2, '0'),
    occ: d.occ,
    adr: d.adr,
    revpar: d.revpar,
    ca: d.ca,
  }));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-6" data-testid="rev-graph">
      <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Performance journalière</p>
      <div className="w-full" style={{ height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #E5E7EB' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area yAxisId="left" type="monotone" dataKey="occ" name="Occupation %" fill="#C7D2FE" stroke="#6366F1" />
            <Line yAxisId="right" type="monotone" dataKey="adr" name="ADR €" stroke="#F59E0B" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="revpar" name="RevPAR €" stroke="#A855F7" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueCalendar;
