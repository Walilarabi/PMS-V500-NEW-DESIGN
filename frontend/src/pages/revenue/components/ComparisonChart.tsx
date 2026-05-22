/**
 * FLOWTYM — Comparaison Dynamique
 *
 * Graphique "pickup" : compare l'import actif (aujourd'hui) avec un
 * snapshot historique (vs Hier, J-3, J-7, J-14, J-30).
 *
 *   - Ligne pleine bleue   : notre tarif actuel
 *   - Ligne tiretée grise  : notre tarif lors du snapshot de comparaison
 *   - Ligne pleine verte   : médiane compset actuelle
 *   - Ligne tiretée verte  : médiane compset du snapshot de comparaison
 *   - Barres               : demande marché actuelle (palette température)
 *   - Tooltip riche        : valeurs actuelles + comparaison + delta
 */

import { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Cell, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import type { LighthouseImport } from '../../../services/lighthouse-parser.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const COLORS = {
  ourHotelCurrent: '#2563eb',
  ourHotelCompare: '#94a3b8',
  medianCurrent: '#10b981',
  medianCompare: '#6ee7b7',
  grid: '#f3f4f6',
  axis: '#9ca3af',
};

function getDemandColor(demand: number): string {
  if (demand >= 90) return '#ef4444';
  if (demand >= 80) return '#fca5a5';
  if (demand >= 70) return '#fdba74';
  if (demand >= 50) return '#fde68a';
  if (demand >= 30) return '#bbf7d0';
  return '#bfdbfe';
}

// ─── Types internes ───────────────────────────────────────────────────────

interface ComparisonDatum {
  date: string;
  dateLabel: string;
  ourPriceCurrent: number | null;
  ourPriceCompare: number | null;
  medianCurrent: number | null;
  medianCompare: number | null;
  demandCurrent: number;
  delta: number | null;
  medianDelta: number | null;
  events: string;
  ranking: string;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  compareLabel: string;
}

function ComparisonTooltip({ active, payload, compareLabel }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ComparisonDatum;
  if (!d) return null;

  return (
    <div className="bg-white rounded-lg shadow-2xl border border-gray-200 px-4 py-3 min-w-[240px]">
      <div className="font-semibold text-sm text-gray-900 pb-2 border-b border-gray-100 mb-2">
        {d.dateLabel}
      </div>

      <div className="space-y-2 text-xs">
        {/* Notre tarif */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Notre tarif</span>
          <div className="flex items-center gap-2">
            {d.ourPriceCompare != null && (
              <span className="text-gray-400">
                {d.ourPriceCompare}€{' '}
                <span className="text-gray-300 text-[10px]">({compareLabel})</span>
              </span>
            )}
            <span className="font-semibold text-blue-600">{d.ourPriceCurrent ?? '—'}€</span>
            {d.delta != null && (
              <span
                className={cn(
                  'font-bold text-[11px]',
                  d.delta > 0 ? 'text-emerald-600' : d.delta < 0 ? 'text-red-500' : 'text-gray-400',
                )}
              >
                {d.delta > 0 ? '+' : ''}{d.delta}€
              </span>
            )}
          </div>
        </div>

        {/* Médiane */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Médiane compset</span>
          <div className="flex items-center gap-2">
            {d.medianCompare != null && (
              <span className="text-gray-400">{d.medianCompare}€</span>
            )}
            <span className="font-semibold text-emerald-600">{d.medianCurrent ?? '—'}€</span>
            {d.medianDelta != null && (
              <span
                className={cn(
                  'font-bold text-[11px]',
                  d.medianDelta > 0 ? 'text-emerald-600' : d.medianDelta < 0 ? 'text-red-500' : 'text-gray-400',
                )}
              >
                {d.medianDelta > 0 ? '+' : ''}{d.medianDelta}€
              </span>
            )}
          </div>
        </div>

        {/* Demande */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <span className="text-gray-500">Demande marché</span>
          <span className="font-semibold text-gray-700">{d.demandCurrent}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────

export interface ComparisonChartProps {
  currentData: LighthouseImport;
  compareData: LighthouseImport | null;
  compareLabel: string;
  selectedMonth: string;
  isLoading?: boolean;
  onDateClick?: (date: string) => void;
}

export function ComparisonChart({
  currentData,
  compareData,
  compareLabel,
  selectedMonth,
  isLoading,
  onDateClick,
}: ComparisonChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Fusion des deux datasets par date
  const chartData = useMemo<ComparisonDatum[]>(() => {
    const currentDays = currentData.days.filter(d => d.date.startsWith(selectedMonth));
    const compareMap = new Map<string, LighthouseImport['days'][0]>();
    if (compareData) {
      compareData.days.forEach(d => compareMap.set(d.date, d));
    }

    return currentDays.map(d => {
      const cmp = compareMap.get(d.date);
      const ourPriceCurrent = d.ourPrice > 0 ? d.ourPrice : null;
      const ourPriceCompare = cmp && cmp.ourPrice > 0 ? cmp.ourPrice : null;
      const medianCurrent = d.compsetMedian > 0 ? d.compsetMedian : null;
      const medianCompare = cmp && cmp.compsetMedian > 0 ? cmp.compsetMedian : null;

      return {
        date: d.date,
        dateLabel: `${d.dayName} ${d.date.slice(8, 10)}`,
        ourPriceCurrent,
        ourPriceCompare,
        medianCurrent,
        medianCompare,
        demandCurrent: d.marketDemandPercent,
        delta:
          ourPriceCurrent != null && ourPriceCompare != null
            ? Math.round(ourPriceCurrent - ourPriceCompare)
            : null,
        medianDelta:
          medianCurrent != null && medianCompare != null
            ? Math.round(medianCurrent - medianCompare)
            : null,
        events: d.events,
        ranking: d.ranking,
      };
    });
  }, [currentData, compareData, selectedMonth]);

  // KPIs résumé
  const kpis = useMemo(() => {
    const withDelta = chartData.filter(d => d.delta != null);
    if (withDelta.length === 0) return null;

    const ourPricesNow = chartData.map(d => d.ourPriceCurrent).filter((v): v is number => v != null);
    const ourPricesCmp = chartData.map(d => d.ourPriceCompare).filter((v): v is number => v != null);

    const avgCurrent = ourPricesNow.length
      ? Math.round(ourPricesNow.reduce((s, p) => s + p, 0) / ourPricesNow.length)
      : null;
    const avgCompare = ourPricesCmp.length
      ? Math.round(ourPricesCmp.reduce((s, p) => s + p, 0) / ourPricesCmp.length)
      : null;
    const avgDelta = withDelta.length
      ? Math.round(withDelta.reduce((s, d) => s + (d.delta ?? 0), 0) / withDelta.length)
      : null;

    const upCount = withDelta.filter(d => (d.delta ?? 0) > 2).length;
    const downCount = withDelta.filter(d => (d.delta ?? 0) < -2).length;
    const stableCount = withDelta.length - upCount - downCount;

    return { avgCurrent, avgCompare, avgDelta, upCount, downCount, stableCount };
  }, [chartData]);

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const hasCompareData = compareData != null;

  // ─── États ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement du snapshot de comparaison…</span>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-400 text-sm">
        Aucune donnée disponible pour ce mois.
      </div>
    );
  }

  // ─── Rendu ────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Comparaison dynamique</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Aujourd'hui vs {compareLabel} · {chartData.length} jours analysés
          </p>
        </div>

        {hasCompareData && kpis ? (
          <div className="flex items-center gap-5 text-xs">
            <div>
              <div className="text-gray-400">Tarif actuel moy.</div>
              <div className="text-sm font-semibold text-blue-600">{kpis.avgCurrent}€</div>
            </div>
            {kpis.avgCompare != null && (
              <div>
                <div className="text-gray-400">Tarif {compareLabel}</div>
                <div className="text-sm font-semibold text-gray-400">{kpis.avgCompare}€</div>
              </div>
            )}
            {kpis.avgDelta != null && (
              <div>
                <div className="text-gray-400">Variation moy.</div>
                <div
                  className={cn(
                    'text-sm font-bold flex items-center gap-1',
                    kpis.avgDelta >= 0 ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {kpis.avgDelta >= 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />}
                  {kpis.avgDelta >= 0 ? '+' : ''}{kpis.avgDelta}€
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <TrendingUp className="w-3 h-3" />{kpis.upCount}
              </span>
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <TrendingDown className="w-3 h-3" />{kpis.downCount}
              </span>
              <span className="flex items-center gap-1 text-gray-400 font-semibold">
                <Minus className="w-3 h-3" />{kpis.stableCount}
              </span>
            </div>
          </div>
        ) : (
          !hasCompareData && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              Aucun snapshot {compareLabel} disponible — importez régulièrement pour activer le comparatif.
            </div>
          )
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={(e: any) => {
              if (e?.activePayload?.[0]?.payload?.date && onDateClick) {
                onDateClick(e.activePayload[0].payload.date);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />

            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: COLORS.axis }}
              tickLine={false}
              axisLine={{ stroke: COLORS.grid }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fontSize: 11, fill: COLORS.axis }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}€`}
            />
            <YAxis
              yAxisId="demand"
              orientation="right"
              tick={{ fontSize: 11, fill: COLORS.axis }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              width={45}
            />

            <Tooltip
              content={<ComparisonTooltip compareLabel={compareLabel} />}
              cursor={{ stroke: COLORS.ourHotelCurrent, strokeWidth: 1, strokeDasharray: '3 3' }}
              animationDuration={150}
            />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(e: any) => toggleSeries(e.dataKey)}
            />

            {/* Barres demande marché */}
            {!hiddenSeries.has('demandCurrent') && (
              <Bar
                yAxisId="demand"
                dataKey="demandCurrent"
                name="Demande marché"
                radius={[6, 6, 0, 0]}
                maxBarSize={18}
                isAnimationActive
                animationDuration={400}
              >
                {chartData.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={getDemandColor(entry.demandCurrent)}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            )}

            {/* Lignes du snapshot de comparaison (tiretées, en arrière-plan) */}
            {hasCompareData && !hiddenSeries.has('ourPriceCompare') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ourPriceCompare"
                name={`Notre tarif (${compareLabel})`}
                stroke={COLORS.ourHotelCompare}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, stroke: COLORS.ourHotelCompare, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}
            {hasCompareData && !hiddenSeries.has('medianCompare') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="medianCompare"
                name={`Médiane (${compareLabel})`}
                stroke={COLORS.medianCompare}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, stroke: COLORS.medianCompare, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* Lignes actuelles (pleines, au premier plan) */}
            {!hiddenSeries.has('medianCurrent') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="medianCurrent"
                name="Médiane compset"
                stroke={COLORS.medianCurrent}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: COLORS.medianCurrent, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}
            {!hiddenSeries.has('ourPriceCurrent') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ourPriceCurrent"
                name={currentData.ourHotelName}
                stroke={COLORS.ourHotelCurrent}
                strokeWidth={3}
                dot={{ r: 3, stroke: COLORS.ourHotelCurrent, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 6, stroke: COLORS.ourHotelCurrent, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Légende de lecture */}
      <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-6 flex-wrap text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 rounded" style={{ background: COLORS.ourHotelCurrent }} />
          Actuel
        </span>
        {hasCompareData && (
          <>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-5 h-0"
                style={{ borderTop: `2px dashed ${COLORS.ourHotelCompare}` }}
              />
              {compareLabel}
            </span>
          </>
        )}
        <span className="ml-auto">
          Cliquez sur un point pour le détail · cliquez sur une légende pour masquer/afficher
        </span>
      </div>
    </div>
  );
}
