/**
 * FLOWTYM RMS — Graphique comparaison dynamique.
 *
 *   - 2 barres par date : demande Aujourd'hui (couleur unie palier) + Hier (gris)
 *   - Étiquettes % au-dessus de chaque barre
 *   - Courbe médiane Aujourd'hui (verte pleine) + étiquettes pastille verte
 *   - Courbe médiane comparée (violette pointillée) + étiquettes pastille violette
 *   - Zone d'écart entre les deux médianes
 *   - Colonne du jour sélectionné mise en surbrillance
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ComposedChart, Bar, Line, Area, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceArea, LabelList, ResponsiveContainer,
} from 'recharts';
import { MoreVertical } from 'lucide-react';
import {
  getComparisonData, COMPARE_PERIODS,
} from '../../../data/rms/mockCompetitiveWatchData';
import type { ComparePeriodKey } from '../../../data/rms/mockCompetitiveWatchData';
import { getDemandColor } from '../../../lib/rms/marketDemandRules';
import { CHART_COLORS, DEMAND_BANDS } from '../../../lib/rms/chartColors';
import { ChartLegend } from './ChartLegend';
import { CustomTooltip } from './CustomTooltip';

type MetricMode = 'price' | 'demand';

/**
 * recharts v3 n'expose pas `fill` / `stroke` dans le type de props de
 * ReferenceArea (hérité de RectangleProps) alors qu'ils sont supportés à
 * l'exécution. Cast localisé pour combler cette lacune de typage.
 */
const HighlightArea = ReferenceArea as unknown as React.FC<Record<string, unknown>>;

const LEGEND_ITEMS = [
  { label: "Demande marché (Aujourd'hui)", color: '#1E293B', marker: 'square' as const },
  { label: 'Demande marché (Hier)', color: CHART_COLORS.hierBar, marker: 'square' as const },
  { label: "Médiane compset (Aujourd'hui)", color: CHART_COLORS.median, marker: 'line' as const },
  { label: 'Médiane compset (comparé)', color: CHART_COLORS.medianPast, marker: 'dashed' as const },
  { label: 'Écart entre médianes', color: CHART_COLORS.median, colorTo: CHART_COLORS.medianPast, marker: 'gradient' as const },
];

/* ── Étiquettes personnalisées ──────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarPercentLabel(props: any, isPast: boolean) {
  const { x, y, width, value } = props;
  if (value == null || x == null) return null;
  const color = isPast ? CHART_COLORS.hierBarLabel : getDemandColor(value);
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fontSize={11}
      fontWeight={700}
      fill={color}
    >
      {value}%
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MedianPill(props: any, variant: 'today' | 'past') {
  const { x, y, value } = props;
  if (value == null || x == null) return null;
  const isToday = variant === 'today';
  const bg = isToday ? '#DCFCE7' : '#EDE9FE';
  const fg = isToday ? '#15803D' : '#6D28D9';
  const text = `${value}€`;
  const w = text.length * 6.6 + 12;
  const offY = isToday ? -15 : 17;
  return (
    <g>
      <rect x={x - w / 2} y={y + offY - 9} width={w} height={18} rx={9} fill={bg} />
      <text
        x={x}
        y={y + offY + 3.5}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={700}
        fill={fg}
      >
        {text}
      </text>
    </g>
  );
}

/* ── Composant ──────────────────────────────────────────────────────────── */

export interface DynamicComparisonChartProps {
  period: ComparePeriodKey;
  onPeriodChange: (period: ComparePeriodKey) => void;
  selectedLabel: string;
  onSelectDay?: (label: string) => void;
}

export const DynamicComparisonChart: React.FC<DynamicComparisonChartProps> = ({
  period,
  onPeriodChange,
  selectedLabel,
  onSelectDay,
}) => {
  const [mode, setMode] = useState<MetricMode>('price');

  const periodMeta = COMPARE_PERIODS.find((p) => p.key === period) ?? COMPARE_PERIODS[0];

  const data = useMemo(() => {
    return getComparisonData(period).map((d) => ({
      ...d,
      medianRange: [
        Math.min(d.medianToday, d.medianPast),
        Math.max(d.medianToday, d.medianPast),
      ] as [number, number],
    }));
  }, [period]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <h2 className="text-[16px] font-bold text-slate-900 dark:text-slate-50">
          Comparaison : Aujourd'hui vs {periodMeta.label}
        </h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode('price')}
              className={`h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${
                mode === 'price'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Prix (€)
            </button>
            <button
              type="button"
              onClick={() => setMode('demand')}
              className={`h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${
                mode === 'demand'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              % Demande (%)
            </button>
          </div>
          <button
            type="button"
            aria-label="Plus d'options"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sélecteur de période */}
      <div className="flex items-center gap-2 px-5 pt-3.5 flex-wrap">
        <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
          Aujourd'hui vs
        </span>
        {COMPARE_PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPeriodChange(p.key)}
              className={`h-8 px-3.5 rounded-lg text-[12.5px] font-bold transition-all ${
                active
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Légende */}
      <div className="px-5 pt-3.5">
        <ChartLegend items={LEGEND_ITEMS} />
      </div>

      {/* Titres d'axes */}
      <div className="flex items-center justify-between px-5 pt-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        <span>Demande du marché (%)</span>
        <span>Prix (€)</span>
      </div>

      {/* Graphique */}
      <div className="px-2 pb-1">
        <div className="w-full h-[400px] min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 28, right: 8, bottom: 8, left: 8 }}
              barCategoryGap="26%"
              barGap={3}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(e: any) => {
                const lbl = e?.activePayload?.[0]?.payload?.label;
                if (lbl && onSelectDay) onSelectDay(lbl);
              }}
            >
              <defs>
                <linearGradient id="median-spread" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.median} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={CHART_COLORS.medianPast} stopOpacity={0.14} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />

              {/* Surbrillance du jour sélectionné */}
              <HighlightArea
                x1={selectedLabel}
                x2={selectedLabel}
                yAxisId="demand"
                fill="#3B82F6"
                fillOpacity={0.09}
                stroke="#93C5FD"
                ifOverflow="extendDomain"
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickMargin={10}
              />
              <YAxis
                yAxisId="demand"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                width={42}
              />
              <YAxis
                yAxisId="price"
                orientation="right"
                domain={[0, 800]}
                ticks={[0, 200, 400, 600, 800]}
                tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}€`}
                width={48}
              />

              <Tooltip
                content={<CustomTooltip variant="comparison" />}
                cursor={{ fill: 'rgba(148,163,184,0.10)' }}
              />

              {/* Barres demande Hier (gris) */}
              <Bar
                yAxisId="demand"
                dataKey="demandPast"
                fill={CHART_COLORS.hierBar}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive
                animationDuration={650}
              >
                <LabelList content={(p) => BarPercentLabel(p, true)} />
              </Bar>

              {/* Barres demande Aujourd'hui (couleur palier) */}
              <Bar
                yAxisId="demand"
                dataKey="demandToday"
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive
                animationDuration={650}
              >
                {data.map((d) => (
                  <Cell key={d.date} fill={getDemandColor(d.demandToday)} />
                ))}
                <LabelList content={(p) => BarPercentLabel(p, false)} />
              </Bar>

              {/* Zone d'écart entre les médianes */}
              <Area
                yAxisId="price"
                dataKey="medianRange"
                stroke="none"
                fill="url(#median-spread)"
                isAnimationActive
                animationDuration={650}
                activeDot={false}
              />

              {/* Médiane comparée (violette pointillée) */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="medianPast"
                stroke={CHART_COLORS.medianPast}
                strokeWidth={2.5}
                strokeDasharray="6 5"
                strokeOpacity={mode === 'demand' ? 0.35 : 1}
                dot={{ r: 3, fill: '#fff', stroke: CHART_COLORS.medianPast, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={750}
              >
                {mode === 'price' && (
                  <LabelList content={(p) => MedianPill(p, 'past')} />
                )}
              </Line>

              {/* Médiane Aujourd'hui (verte pleine) */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="medianToday"
                stroke={CHART_COLORS.median}
                strokeWidth={3}
                strokeOpacity={mode === 'demand' ? 0.35 : 1}
                dot={{ r: 3.5, fill: '#fff', stroke: CHART_COLORS.median, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                isAnimationActive
                animationDuration={750}
              >
                {mode === 'price' && (
                  <LabelList content={(p) => MedianPill(p, 'today')} />
                )}
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Légende température */}
      <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-5 py-3.5 border-t border-slate-100 dark:border-slate-800">
        <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
          Température demande marché (%) :
        </span>
        {DEMAND_BANDS.map((band) => (
          <span key={band.tier} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: band.color }} />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {band.label}
            </span>
          </span>
        ))}
      </div>
    </motion.section>
  );
};
