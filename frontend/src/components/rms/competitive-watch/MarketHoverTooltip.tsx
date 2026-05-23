/**
 * FLOWTYM — Tooltip premium hover sur le graphique Marché
 *
 * Thème CLAIR cohérent avec l'interface Flowtym :
 *   - fond blanc, ombre douce, bordure violet pâle
 *   - typographie système, accents violet/emerald/rose
 *   - lisible immédiatement, pas de noir, pas de monospace lourd
 *
 * Contenu (lecture rapide) :
 *   - tarif médian
 *   - notre hôtel + écart vs médiane (€ et %)
 *   - min / max
 *   - pression marché + couleur
 *   - événement éventuel
 *   - Δ J-1 / J-7
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

interface HoverTooltipDay {
  label: string;
  date: string;
  demand: number;
  ourPrice: number;
  median: number;
  mean: number;
  q25: number;
  q75: number;
  min?: number;
  max?: number;
  event?: string;
  deltaD1?: number;
  deltaD7?: number;
}

export interface MarketHoverTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}

function pressureMeta(demand: number): { label: string; bg: string; text: string } {
  if (demand >= 85) return { label: 'Extrême',  bg: 'bg-rose-100',    text: 'text-rose-700' };
  if (demand >= 65) return { label: 'Forte',    bg: 'bg-orange-100',  text: 'text-orange-700' };
  if (demand >= 40) return { label: 'Modérée',  bg: 'bg-amber-100',   text: 'text-amber-700' };
  return                 { label: 'Faible',   bg: 'bg-emerald-100', text: 'text-emerald-700' };
}

function trendIcon(delta?: number) {
  if (delta === undefined || Math.abs(delta) < 0.5) {
    return <Minus className="w-3 h-3 text-slate-400" />;
  }
  return delta > 0
    ? <TrendingUp className="w-3 h-3 text-emerald-600" />
    : <TrendingDown className="w-3 h-3 text-rose-600" />;
}

export const MarketHoverTooltip: React.FC<MarketHoverTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload as HoverTooltipDay | undefined;
  if (!d) return null;

  const pressure = pressureMeta(d.demand);
  const gap = d.ourPrice - d.median;
  const gapPct = ((gap / d.median) * 100).toFixed(1);
  const min = d.min ?? d.q25;
  const max = d.max ?? d.q75;

  return (
    <div
      className="rounded-2xl bg-white border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.08)] px-3.5 py-3 min-w-[240px] text-[12px] text-slate-700"
    >
      {/* En-tête : date + badge pression */}
      <div className="flex items-start justify-between gap-3 pb-2 mb-2 border-b border-slate-100">
        <div>
          <div className="text-[14px] font-bold text-slate-900 leading-tight">{d.label}</div>
          <div className="text-[10.5px] text-slate-500 mt-0.5">Demande {d.demand}% du marché</div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pressure.bg} ${pressure.text}`}>
          {pressure.label}
        </span>
      </div>

      {/* Médiane marché (info principale) */}
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[11px] font-medium text-slate-600">Tarif médian</span>
        <span className="text-[16px] font-bold text-emerald-600 tabular-nums">{d.median}€</span>
      </div>

      {/* Notre tarif + écart */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[11px] font-medium text-slate-600">Folkestone Opéra</span>
        <span className="flex items-baseline gap-2">
          <span className="text-[14px] font-bold text-blue-600 tabular-nums">{d.ourPrice}€</span>
          <span className={`text-[11px] font-semibold tabular-nums ${gap >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {gap > 0 ? '+' : ''}{gap}€ ({gap > 0 ? '+' : ''}{gapPct}%)
          </span>
        </span>
      </div>

      {/* Min / Max + IQR */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Cell label="Min" value={`${min}€`} accent="text-slate-700" />
        <Cell label="Moy." value={`${d.mean}€`} accent="text-slate-700" />
        <Cell label="Max" value={`${max}€`} accent="text-slate-700" />
      </div>

      {/* Variations J-1 / J-7 */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {trendIcon(d.deltaD1)}
          <span className="text-[10.5px] text-slate-500">J-1</span>
          <span className="text-[11px] font-semibold tabular-nums text-slate-800">
            {d.deltaD1 !== undefined ? `${d.deltaD1 > 0 ? '+' : ''}${d.deltaD1}€` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {trendIcon(d.deltaD7)}
          <span className="text-[10.5px] text-slate-500">J-7</span>
          <span className="text-[11px] font-semibold tabular-nums text-slate-800">
            {d.deltaD7 !== undefined ? `${d.deltaD7 > 0 ? '+' : ''}${d.deltaD7}€` : '—'}
          </span>
        </div>
      </div>

      {/* Événement éventuel */}
      {d.event && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-1.5">
          <Calendar className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-[10.5px] text-amber-700 font-medium leading-tight">{d.event}</span>
        </div>
      )}

      {/* Footer : invitation au clic */}
      <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-violet-600 font-semibold text-center uppercase tracking-wider">
        Cliquez pour analyser et décider →
      </div>
    </div>
  );
};

const Cell: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="rounded-lg bg-slate-50 px-2 py-1 text-center">
    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-[12px] font-bold tabular-nums mt-0.5 ${accent ?? 'text-slate-900'}`}>{value}</div>
  </div>
);
