/**
 * FLOWTYM — Tooltip premium hover sur le graphique Marché
 *
 * Style Bloomberg terminal / Lighthouse premium :
 *   - médiane marché, min, max
 *   - pression marché + couleur démande
 *   - événement éventuel
 *   - pickup, lead time dominant
 *   - variation vs J-1 / J-7
 *   - tendance (↗ ↘ →)
 *
 * Compacte, ultra lisible, n'apparaît qu'au survol — pas d'actions ici (le
 * panneau d'actions s'ouvre au clic via MarketDayPanel).
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, Zap, Clock } from 'lucide-react';
import { getDemandColor } from '@/src/lib/rms/marketDemandRules';

interface HoverTooltipDay {
  label: string;
  date: string;
  demand: number;
  ourPrice: number;
  median: number;
  mean: number;
  q25: number;
  q75: number;
  // Champs optionnels enrichis
  min?: number;
  max?: number;
  event?: string;
  pickup?: number;
  leadTime?: string;
  deltaD1?: number;  // variation vs J-1 (€)
  deltaD7?: number;  // variation vs J-7 (€)
}

export interface MarketHoverTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}

function pressureLabel(demand: number): { label: string; color: string } {
  if (demand >= 85) return { label: 'Extrême', color: '#DC2626' };
  if (demand >= 65) return { label: 'Forte', color: '#EA580C' };
  if (demand >= 40) return { label: 'Modérée', color: '#D97706' };
  return { label: 'Faible', color: '#16A34A' };
}

function trendIcon(delta?: number) {
  if (delta === undefined || Math.abs(delta) < 0.5) {
    return <Minus className="w-3 h-3 text-slate-400" />;
  }
  return delta > 0
    ? <TrendingUp className="w-3 h-3 text-emerald-500" />
    : <TrendingDown className="w-3 h-3 text-rose-500" />;
}

export const MarketHoverTooltip: React.FC<MarketHoverTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload as HoverTooltipDay | undefined;
  if (!d) return null;

  const pressure = pressureLabel(d.demand);
  const demandColor = getDemandColor(d.demand);
  const min = d.min ?? d.q25;
  const max = d.max ?? d.q75;

  return (
    <div className="rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/50 shadow-2xl px-3 py-2.5 min-w-[260px] text-[12px] text-slate-100 font-mono">
      {/* En-tête : date + badge demande */}
      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-slate-700/50">
        <div>
          <div className="text-[14px] font-bold text-white tracking-tight">{d.label}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{d.date}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${demandColor}33`, color: demandColor }}
          >
            {d.demand}% demande
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider"
            style={{ color: pressure.color }}
          >
            Pression {pressure.label}
          </span>
        </div>
      </div>

      {/* Prix : notre hôtel + médiane + min/max */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
        <Row label="FOLKESTONE" value={`${d.ourPrice}€`} bold accent="#60A5FA" />
        <Row label="MÉDIANE" value={`${d.median}€`} bold accent="#34D399" />
        <Row label="MIN" value={`${min}€`} accent="#94A3B8" />
        <Row label="MAX" value={`${max}€`} accent="#94A3B8" />
        <Row label="IQR" value={`${d.q25}–${d.q75}€`} accent="#64748B" />
        <Row label="MOY." value={`${d.mean}€`} accent="#64748B" />
      </div>

      {/* Écart vs médiane */}
      <div className="flex items-center justify-between gap-3 pt-2 mb-2 border-t border-slate-700/50">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Δ vs médiane</span>
        <span
          className={`text-[12px] font-bold tabular-nums ${
            d.ourPrice >= d.median ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {d.ourPrice - d.median > 0 ? '+' : ''}{d.ourPrice - d.median}€
          <span className="text-[10px] ml-1 opacity-70">
            ({((d.ourPrice - d.median) / d.median * 100).toFixed(1)}%)
          </span>
        </span>
      </div>

      {/* Bandeau marché : variations + pickup + leadtime + event */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
        <div className="flex items-center gap-1.5">
          {trendIcon(d.deltaD1)}
          <span className="text-slate-400">J-1</span>
          <span className="font-bold tabular-nums">
            {d.deltaD1 !== undefined ? `${d.deltaD1 > 0 ? '+' : ''}${d.deltaD1}€` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {trendIcon(d.deltaD7)}
          <span className="text-slate-400">J-7</span>
          <span className="font-bold tabular-nums">
            {d.deltaD7 !== undefined ? `${d.deltaD7 > 0 ? '+' : ''}${d.deltaD7}€` : '—'}
          </span>
        </div>
        {d.pickup !== undefined && (
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-violet-400" />
            <span className="text-slate-400">Pickup</span>
            <span className="font-bold tabular-nums">{d.pickup}</span>
          </div>
        )}
        {d.leadTime && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-blue-400" />
            <span className="text-slate-400">Lead</span>
            <span className="font-bold">{d.leadTime}</span>
          </div>
        )}
      </div>

      {/* Événement éventuel */}
      {d.event && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-start gap-1.5">
          <Calendar className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          <span className="text-[10.5px] text-amber-200 leading-tight">{d.event}</span>
        </div>
      )}

      {/* Indication action */}
      <div className="mt-2 pt-2 border-t border-slate-700/50 text-[9.5px] text-slate-500 uppercase tracking-wider text-center">
        Cliquez pour analyser & décider →
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; bold?: boolean; accent?: string }> = ({
  label, value, bold, accent,
}) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</span>
    <span
      className={`tabular-nums ${bold ? 'text-[13px] font-bold' : 'text-[11.5px] font-semibold'}`}
      style={{ color: accent }}
    >
      {value}
    </span>
  </div>
);
