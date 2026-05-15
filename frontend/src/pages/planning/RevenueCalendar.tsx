/**
 * FLOWTYM — Revenue Calendar (KPI + Graphiques sub-views).
 *
 * Monthly grid (Sun→Sat × N rows). Each cell shows : day number, occupancy %,
 * ADR €, RevPAR €, events badge. Two sub-views :
 *   • KPI         — colored heatmap by occupancy
 *   • Graphiques  — Recharts line chart (ADR + RevPAR) + occupancy area
 */
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, BarChart2 } from 'lucide-react';

import { fmtEUR, isoDay, type RevenueSubView } from './types';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow } from '@/src/lib/supabase.types';
import type { HotelEvent } from '@/src/store/configStore';

interface Props {
  monthDate: Date;
  reservations: ReservationRow[];
  rooms: RoomRow[];
  events: HotelEvent[];
  subView: RevenueSubView;
  setSubView: (s: RevenueSubView) => void;
}

interface DayCell {
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

const FR_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const FR_MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export const RevenueCalendar: React.FC<Props> = ({
  monthDate, reservations, rooms, events, subView, setSubView,
}) => {
  const days: DayCell[] = useMemo(() => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out: DayCell[] = [];
    for (let i = 1; i <= last; i++) {
      const d = new Date(y, m, i);
      const dStr = isoDay(d);
      const dt = d.getTime();
      const occRes = reservations.filter((r) => {
        const a = new Date(r.check_in).getTime();
        const b = new Date(r.check_out).getTime();
        return !isNaN(a) && !isNaN(b) && dt >= a && dt < b;
      });
      const ca = occRes.reduce((s, r) => s + (r.total_amount ?? 0), 0);
      const adr = occRes.length ? Math.round(ca / occRes.length) : 0;
      const occ = rooms.length ? Math.round((occRes.length / rooms.length) * 100) : 0;
      const revpar = rooms.length ? Math.round(ca / rooms.length) : 0;
      const dayEvents = events.filter((e) => dStr >= e.startDate && dStr <= e.endDate);
      out.push({
        date: d, dateStr: dStr, dateNum: i,
        isToday: dt === today.getTime(),
        occ, ca, adr, revpar, events: dayEvents,
      });
    }
    return out;
  }, [monthDate, reservations, rooms, events]);

  const totals = useMemo(() => {
    const ca = days.reduce((s, d) => s + d.ca, 0);
    const occAvg = days.length ? Math.round(days.reduce((s, d) => s + d.occ, 0) / days.length) : 0;
    const adrAvg = days.filter((d) => d.adr > 0).reduce((s, d) => s + d.adr, 0) / Math.max(1, days.filter((d) => d.adr > 0).length);
    const revparAvg = days.length ? days.reduce((s, d) => s + d.revpar, 0) / days.length : 0;
    return { ca, occAvg, adrAvg, revparAvg };
  }, [days]);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden" data-testid="planning-revenue">
      {/* Top KPIs */}
      <div className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 min-w-0">
          <KpiTile testid="rev-kpi-occ" label="TO moyen" val={`${totals.occAvg}%`} hint={`${days.length} jours`} tone="emerald" />
          <KpiTile testid="rev-kpi-ca" label="CA total" val={fmtEUR(totals.ca)} hint={FR_MONTHS[monthDate.getMonth()]} tone="indigo" />
          <KpiTile testid="rev-kpi-revpar" label="RevPAR moyen" val={fmtEUR(totals.revparAvg)} hint={`${rooms.length} chambres`} tone="violet" />
          <KpiTile testid="rev-kpi-adr" label="ADR moyen" val={fmtEUR(totals.adrAvg || 0)} hint="Sur jours occupés" tone="amber" />
        </div>
        <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100" data-testid="rev-subview-toggle">
          {(['KPI', 'Graphiques'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSubView(v)}
              data-testid={`rev-subview-${v}`}
              className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                subView === v ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {v === 'KPI' ? <TrendingUp size={12} /> : <BarChart2 size={12} />}
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {subView === 'KPI' ? (
          <KpiCalendar days={days} monthDate={monthDate} />
        ) : (
          <GraphView days={days} />
        )}
      </div>
    </div>
  );
};

/* ---------------------------------- Tiles -------- */

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-50/40 border-emerald-100/50 text-emerald-700',
  indigo: 'bg-indigo-50/40 border-indigo-100/50 text-indigo-700',
  violet: 'bg-violet-50/40 border-violet-100/50 text-violet-700',
  amber: 'bg-amber-50/40 border-amber-100/50 text-amber-700',
};

const KpiTile: React.FC<{ testid: string; label: string; val: string; hint: string; tone: keyof typeof TONE_BG }> = ({ testid, label, val, hint, tone }) => (
  <div className={`p-3 rounded-2xl border ${TONE_BG[tone]}`} data-testid={testid}>
    <p className="text-[10px] uppercase tracking-widest font-black opacity-60">{label}</p>
    <p className="text-lg lg:text-xl font-black tabular-nums mt-0.5">{val}</p>
    <p className="text-[9px] text-gray-500 truncate">{hint}</p>
  </div>
);

/* ----------------------------- KPI calendar -------- */

const heatmapTone = (occ: number): { bg: string; ring: string } => {
  if (occ >= 90) return { bg: 'bg-rose-100', ring: 'ring-rose-200' };
  if (occ >= 75) return { bg: 'bg-orange-100', ring: 'ring-orange-200' };
  if (occ >= 50) return { bg: 'bg-emerald-100', ring: 'ring-emerald-200' };
  if (occ >= 25) return { bg: 'bg-sky-50', ring: 'ring-sky-100' };
  return { bg: 'bg-gray-50', ring: 'ring-gray-100' };
};

const KpiCalendar: React.FC<{ days: DayCell[]; monthDate: Date }> = ({ days, monthDate }) => {
  // pad start to align with Monday-first calendar
  const firstDow = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7; // Mon=0
  const padded: (DayCell | null)[] = [...Array(firstDow).fill(null), ...days];
  while (padded.length % 7 !== 0) padded.push(null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="rev-kpi-calendar">
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
        {FR_DAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-[10px] uppercase font-black text-gray-500 tracking-widest text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {padded.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="border-r border-b border-gray-50 min-h-[96px] bg-gray-50/30" />;
          const tone = heatmapTone(d.occ);
          return (
            <div
              key={d.dateStr}
              className={`relative border-r border-b border-gray-50 p-2 min-h-[96px] hover:bg-indigo-50/30 transition-colors ${d.isToday ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
              data-testid={`rev-day-${d.dateStr}`}
            >
              <div className="flex items-start justify-between">
                <span className={`text-sm font-black tabular-nums ${d.isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{d.dateNum}</span>
                {d.events.length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center" title={d.events.map((e) => e.name).join(', ')}>
                    {d.events.length}
                  </span>
                )}
              </div>
              <div className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${tone.bg} ${tone.ring} ring-1`}>
                {d.occ}%
              </div>
              <p className="text-[10px] text-gray-500 mt-1 tabular-nums">ADR {d.adr || '—'} €</p>
              <p className="text-[10px] text-gray-400 tabular-nums">CA {fmtEUR(d.ca)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ----------------------------- Graph view -------- */

const GraphView: React.FC<{ days: DayCell[] }> = ({ days }) => {
  const data = days.map((d) => ({
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
