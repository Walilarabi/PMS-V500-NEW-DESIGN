/**
 * FLOWTYM RMS — Graphique marché « Écart des tarifs ».
 *
 *   - Barres demande marché (1 barre = 1 couleur unie selon palier)
 *   - Zone écart interquartile 25-75% (gris)
 *   - Courbe tarif médian compset (vert)
 *   - Courbe Folkestone Opéra (bleu)
 *   - Double axe : demande (%) à gauche, prix (€) à droite
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ComposedChart, Bar, Line, Area, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Info, MoreVertical } from 'lucide-react';
import { useCompetitiveWatchData } from '../../../lib/rms/useCompetitiveWatchData';
import { getDemandColor } from '../../../lib/rms/marketDemandRules';
import { CHART_COLORS, DEMAND_BANDS } from '../../../lib/rms/chartColors';
import { ChartLegend } from './ChartLegend';
import { MarketHoverTooltip } from './MarketHoverTooltip';
import { MarketDayDecisionModal, type MarketDay } from './MarketDayDecisionModal';

type MetricMode = 'price' | 'demand';

const LEGEND_ITEMS = [
  { label: 'Demande du marché (%)', color: '#1E293B', marker: 'square' as const },
  { label: 'Tarif médian compset', color: CHART_COLORS.median, marker: 'line' as const },
  { label: 'Folkestone Opéra', color: CHART_COLORS.ourHotel, marker: 'line' as const },
  { label: 'Écart interquartile (25-75%)', color: CHART_COLORS.iqrBand, marker: 'gradient' as const, colorTo: CHART_COLORS.iqrBandFill },
];

export interface MarketMainChartProps {
  selectedLabel: string;
  onSelectDay?: (label: string) => void;
}

export const MarketMainChart: React.FC<MarketMainChartProps> = ({
  selectedLabel,
  onSelectDay,
}) => {
  const [mode, setMode] = useState<MetricMode>('price');
  const { visibleMarketMonth, compsetHotels } = useCompetitiveWatchData();

  // Modale décision RM ouverte au clic
  const [modalDay, setModalDay] = useState<MarketDay | null>(null);

  /**
   * Ouverture de la modale au clic sur une date.
   * Reçoit directement le payload du Bar (pas besoin de fouiller activePayload).
   * Recharts passe la data du data point cliqué en 1er argument.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDayClick = (datum: any) => {
    if (!datum || !datum.label) return;
    if (onSelectDay) onSelectDay(datum.label);
    setModalDay({
      label: datum.label,
      date: datum.date,
      demand: datum.demand,
      ourPrice: datum.ourPrice,
      median: datum.median,
      mean: datum.mean,
      q25: datum.q25,
      q75: datum.q75,
    });
  };

  // Enrichissement contextuel des barres : delta J-1 / J-7, min/max, event
  const data = useMemo(
    () =>
      visibleMarketMonth.map((d, i, arr) => {
        const prev1 = arr[i - 1];
        const prev7 = arr[i - 7];
        return {
          ...d,
          iqrRange: [d.q25, d.q75] as [number, number],
          deltaD1: prev1 ? d.ourPrice - prev1.ourPrice : undefined,
          deltaD7: prev7 ? d.ourPrice - prev7.ourPrice : undefined,
          min: d.q25,
          max: d.q75,
        };
      }),
    [visibleMarketMonth],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-slate-50">
              Écart des tarifs
            </h2>
            <Info className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            Notre positionnement face au compset
          </p>
        </div>
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
              € Prix
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
              % Demande
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

      {/* Légende */}
      <div className="px-5 pt-3.5">
        <ChartLegend items={LEGEND_ITEMS} />
      </div>

      {/* Graphique */}
      <div className="px-2 pt-2 pb-1">
        <div className="w-full h-[400px] min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 24, right: 8, bottom: 8, left: 8 }}
              barCategoryGap="22%"
            >
              <defs>
                <linearGradient id="iqr-band" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.iqrBand} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={CHART_COLORS.iqrBand} stopOpacity={0.18} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />

              <XAxis
                dataKey="label"
                interval={1}
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

              {/* Cursor désactivé : Recharts dessinait sinon un rectangle gris
                  qui apparaissait comme un overlay sombre couvrant le graphique
                  au survol/clic. La MarketHoverTooltip a son propre fond clair. */}
              <Tooltip
                content={<MarketHoverTooltip />}
                cursor={false}
              />

              {/* onClick directement sur Bar : Recharts passe la data du point
                  cliqué en 1er argument (contrairement au onClick du ComposedChart
                  qui dépend de activePayload, peu fiable). cursor: 'pointer' pour
                  indiquer visuellement que les barres sont cliquables. */}
              <Bar
                yAxisId="demand"
                dataKey="demand"
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
                isAnimationActive
                animationDuration={650}
                opacity={mode === 'demand' ? 1 : 0.92}
                onClick={handleDayClick}
                style={{ cursor: 'pointer' }}
              >
                {data.map((d) => (
                  <Cell key={d.date} fill={getDemandColor(d.demand)} />
                ))}
              </Bar>

              <Area
                yAxisId="price"
                dataKey="iqrRange"
                stroke="none"
                fill="url(#iqr-band)"
                isAnimationActive
                animationDuration={650}
                activeDot={false}
              />

              <Line
                yAxisId="price"
                type="monotone"
                dataKey="median"
                stroke={CHART_COLORS.median}
                strokeWidth={2.5}
                strokeOpacity={mode === 'demand' ? 0.35 : 1}
                dot={{ r: 3, fill: '#fff', stroke: CHART_COLORS.median, strokeWidth: 2 }}
                activeDot={{ r: 5, onClick: (_: unknown, p: any) => handleDayClick(p?.payload) }}
                isAnimationActive
                animationDuration={750}
              />
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ourPrice"
                stroke={CHART_COLORS.ourHotel}
                strokeWidth={2.5}
                strokeOpacity={mode === 'demand' ? 0.35 : 1}
                dot={{ r: 3, fill: '#fff', stroke: CHART_COLORS.ourHotel, strokeWidth: 2 }}
                activeDot={{ r: 5, onClick: (_: unknown, p: any) => handleDayClick(p?.payload) }}
                isAnimationActive
                animationDuration={750}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Légende température */}
      <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-5 py-3.5 border-t border-slate-100 dark:border-slate-800">
        <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
          Demande du marché (%) :
        </span>
        {DEMAND_BANDS.map((band) => (
          <span key={band.tier} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: band.color }}
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {band.label}
            </span>
          </span>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          Jour sélectionné : <span className="font-semibold text-slate-600 dark:text-slate-300">{selectedLabel}</span>
        </span>
      </div>

      {/* Modale décision RM — compset complet + recommandation + actions */}
      <MarketDayDecisionModal
        day={modalDay}
        compsetHotels={compsetHotels}
        onClose={() => setModalDay(null)}
      />
    </motion.section>
  );
};
