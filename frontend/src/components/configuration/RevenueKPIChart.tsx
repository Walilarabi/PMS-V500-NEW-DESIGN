/**
 * FLOWTYM — RevenueKPIChart (Graphiques)
 *
 * Graphique principal du Calendrier Revenue (onglet "Graphiques").
 *
 * Visuel :
 *   - Barres CA (axe gauche €)
 *   - Ligne TO % (axe droit, domaine strict [0,100])
 *   - Ligne ADR € (axe gauche €, partage l'échelle avec CA)
 *
 * Garde-fous métier :
 *   - TO clampé entre 0 et 100 (jamais au-dessus, même si données source corrompues)
 *   - ADR borné par max raisonnable (10 000 €) ; au-delà → ignoré (donnée aberrante)
 *   - Pas de division par zéro
 *   - Formatage devise (fr-FR €), pourcentage (entier), milliers avec espaces
 *
 * Tooltip : lit via `dataKey` (jamais par index → ordre des séries indifférent)
 */

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/src/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RevenueDay {
  dateNum?: number;
  dayName?: string;
  dateStr?: string;
  occ?: number;
  ca?: number;
  adr?: number;
  revpar?: number;
}

interface RevenueKPIChartProps {
  data: RevenueDay[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — formatters & business guards
// ─────────────────────────────────────────────────────────────────────────────

const fmtEUR = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const fmtEURcompact = (n: number): string => {
  // Y-axis ticks: use compact form for readability (12,8 k€ vs 12 800 €)
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k€`;
  return `${Math.round(n)}€`;
};

const fmtPct = (n: number): string => `${Math.round(n)}%`;

/** Clamp occupancy to [0, 100]. Anything outside is a data bug — silently bounded. */
const clampOcc = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

/** Sanitize ADR: must be a positive finite number ≤ 10 000 €. Otherwise treat as 0 (no sale). */
const sanitizeAdr = (n: number): number => {
  if (!Number.isFinite(n) || n < 0 || n > 10_000) return 0;
  return Math.round(n);
};

/** Sanitize CA: must be a finite non-negative number. */
const sanitizeCa = (n: number): number => {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const RevenueKPIChart: React.FC<RevenueKPIChartProps> = ({ data }) => {
  // ── Sanitized chart data ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return data.map(d => ({
      name: `${d.dateNum ?? '?'} ${d.dayName ?? ''}`.trim(),
      displayDate: d.dateStr,
      ca: sanitizeCa(d.ca ?? 0),
      occ: clampOcc(d.occ ?? 0),
      adr: sanitizeAdr(d.adr ?? 0),
    }));
  }, [data]);

  // ── Aggregates for header KPIs ────────────────────────────────────────────
  const aggregates = useMemo(() => {
    if (chartData.length === 0) {
      return { caTotal: 0, occAvg: 0, adrAvg: 0 };
    }
    // CA total = sum (real cumulative revenue across visible period)
    const caTotal = chartData.reduce((s, d) => s + d.ca, 0);

    // Occupancy avg = simple average of daily TO%, then clamped (guarantee ≤ 100)
    const occAvg = clampOcc(
      chartData.reduce((s, d) => s + d.occ, 0) / chartData.length
    );

    // ADR avg = weighted by occupancy is the correct revenue-management formula:
    //   ADR_period = sum(CA) / sum(occupied_rooms)
    // But we only have ADR per day; we can rebuild via days with adr>0 (occupied days only)
    // For simplicity & robustness, use simple arithmetic mean over days with adr>0
    // (matches what the daily metric represents).
    const occupiedDays = chartData.filter(d => d.adr > 0);
    const adrAvg = occupiedDays.length > 0
      ? Math.round(occupiedDays.reduce((s, d) => s + d.adr, 0) / occupiedDays.length)
      : 0;

    return { caTotal, occAvg: Math.round(occAvg), adrAvg };
  }, [chartData]);

  // ── Y-axis € domain: cap based on CA & ADR (whichever is larger) ──────────
  // We don't let outliers stretch the scale; we use the 95th percentile.
  const eurAxisMax = useMemo(() => {
    if (chartData.length === 0) return 100;
    const allValues = chartData.flatMap(d => [d.ca, d.adr]).filter(v => v > 0).sort((a, b) => a - b);
    if (allValues.length === 0) return 100;
    const p95 = allValues[Math.floor(allValues.length * 0.95)] ?? allValues[allValues.length - 1];
    // Add 10% headroom, round to nearest 1000 for clean ticks
    return Math.ceil((p95 * 1.1) / 1000) * 1000 || 1000;
  }, [chartData]);

  // ── Tooltip (reads via dataKey, never by index) ────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const find = (key: string) => payload.find((p: any) => p?.dataKey === key)?.value;
    const ca = find('ca');
    const occ = find('occ');
    const adr = find('adr');

    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-100 p-4 rounded-2xl shadow-xl shadow-slate-200/50 min-w-[220px]">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">
          {label}
        </p>
        <div className="space-y-2">
          {typeof ca === 'number' && (
            <Row color="#4F46E5" label="Revenue (CA)" value={fmtEUR(ca)} valueClass="text-slate-900" />
          )}
          {typeof occ === 'number' && (
            <Row color="#10B981" label="Occupation" value={fmtPct(clampOcc(occ))} valueClass="text-emerald-600" />
          )}
          {typeof adr === 'number' && (
            <Row color="#F59E0B" label="ADR" value={adr > 0 ? fmtEUR(adr) : '—'} valueClass="text-amber-600" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col p-8 space-y-8 bg-white">
      {/* ── Header KPIs ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 flex-wrap gap-4">
        <div className="flex items-center gap-8 flex-wrap">
          <HeaderStat color="bg-indigo-500" label="Revenue (CA)" val={fmtEUR(aggregates.caTotal)} />
          <HeaderStat color="bg-emerald-500" label="Occ. Moyenne" val={fmtPct(aggregates.occAvg)} />
          <HeaderStat color="bg-amber-500" label="ADR Moyen" val={aggregates.adrAvg > 0 ? fmtEUR(aggregates.adrAvg) : '—'} />
        </div>

        <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
          {['Journalier', 'Cumulé', 'vs N-1'].map((v, i) => (
            <button
              key={v}
              type="button"
              disabled={i !== 0}
              title={i !== 0 ? 'Bientôt disponible' : undefined}
              className={cn(
                "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                i === 0
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-300 cursor-not-allowed"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-[400px] w-full relative">
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.25} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />

            {/* Left axis: € (CA + ADR), strict positive domain capped to 95th percentile */}
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => fmtEURcompact(val)}
              domain={[0, eurAxisMax]}
              width={56}
            />

            {/* Right axis: % (TO only), strict [0, 100] domain */}
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => `${val}%`}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              width={40}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />

            {/* Bars: CA (€, left axis) */}
            <Bar
              yAxisId="left"
              dataKey="ca"
              barSize={14}
              fill="url(#barGradient)"
              radius={[4, 4, 0, 0]}
            />

            {/* Line: TO % (right axis — strict 0-100) */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="occ"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ r: 3, fill: '#fff', stroke: '#10B981', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />

            {/* Line: ADR € (LEFT axis — same scale as CA) */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="adr"
              stroke="#F59E0B"
              strokeWidth={2.5}
              strokeDasharray="0"
              dot={{ r: 3, fill: '#fff', stroke: '#F59E0B', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#F59E0B', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-10 pt-4 border-t border-slate-50 flex-wrap">
        <LegendItem label="Revenue (CA)">
          <div className="w-12 h-3 rounded-md bg-gradient-to-b from-indigo-500/85 to-indigo-500/25" />
        </LegendItem>
        <LegendItem label="Taux d'occupation">
          <div className="w-12 h-[3px] bg-emerald-500 relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white border-2 border-emerald-500" />
          </div>
        </LegendItem>
        <LegendItem label="ADR (Prix moyen)">
          <div className="w-12 h-[3px] bg-amber-500 relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white border-2 border-amber-500" />
          </div>
        </LegendItem>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const HeaderStat: React.FC<{ color: string; label: string; val: string }> = ({ color, label, val }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <span className="text-xl font-black text-slate-900 leading-none tabular-nums">{val}</span>
  </div>
);

const Row: React.FC<{ color: string; label: string; value: string; valueClass: string }> = ({ color, label, value, valueClass }) => (
  <div className="flex items-center justify-between gap-6">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[12px] font-bold text-slate-600">{label}</span>
    </div>
    <span className={cn("text-[13px] font-black tabular-nums", valueClass)}>{value}</span>
  </div>
);

const LegendItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-3">
    {children}
    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

export default RevenueKPIChart;
