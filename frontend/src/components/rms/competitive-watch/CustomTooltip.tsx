/**
 * FLOWTYM RMS — Tooltip personnalisé des graphiques.
 *
 * Deux variantes :
 *   - 'market'      → vue Écart des tarifs (demande, notre tarif, médiane)
 *   - 'comparison'  → vue comparaison dynamique (aujourd'hui vs passé)
 */

import React from 'react';
import { getDemandColor } from '../../../lib/rms/marketDemandRules';

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}

function TooltipShell({
  title,
  badge,
  rows,
}: {
  title: string;
  badge?: { text: string; color: string };
  rows: TooltipRow[];
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl px-3.5 py-3 min-w-[200px]">
      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
        <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{title}</span>
        {badge && (
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${badge.color}1f`, color: badge.color }}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{row.label}</span>
            <span
              className={`text-[12.5px] tabular-nums ${row.bold ? 'font-bold' : 'font-semibold'}`}
              style={{ color: row.color ?? 'inherit' }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  variant: 'market' | 'comparison';
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, variant }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  if (variant === 'market') {
    const tierColor = getDemandColor(d.demand);
    return (
      <TooltipShell
        title={d.label}
        badge={{ text: `Demande ${d.demand}%`, color: tierColor }}
        rows={[
          { label: 'Folkestone Opéra', value: d.ourPrice != null ? `${d.ourPrice}€` : 'N/A', color: '#2563EB', bold: true },
          { label: 'Tarif médian compset', value: d.median != null ? `${d.median}€` : 'N/A', color: '#22C55E' },
          { label: 'Tarif moyen compset', value: d.mean != null ? `${d.mean}€` : 'N/A', color: '#64748B' },
          { label: 'Écart interquartile', value: d.q25 != null && d.q75 != null ? `${d.q25}€ – ${d.q75}€` : 'N/A', color: '#94A3B8' },
        ]}
      />
    );
  }

  // variant === 'comparison'
  const demandDelta = d.demandToday - d.demandPast;
  const medianDelta = d.medianToday - d.medianPast;
  const tierColor = getDemandColor(d.demandToday);
  return (
    <TooltipShell
      title={d.label}
      badge={{ text: `Demande ${d.demandToday}%`, color: tierColor }}
      rows={[
        { label: 'Demande (aujourd\'hui)', value: `${d.demandToday}%`, color: tierColor, bold: true },
        { label: 'Demande (comparé)', value: `${d.demandPast}%`, color: '#94A3B8' },
        {
          label: 'Δ Demande',
          value: `${demandDelta >= 0 ? '+' : ''}${demandDelta} pts`,
          color: demandDelta >= 0 ? '#16A34A' : '#EF4444',
          bold: true,
        },
        { label: 'Médiane (aujourd\'hui)', value: `${d.medianToday}€`, color: '#22C55E' },
        { label: 'Médiane (comparé)', value: `${d.medianPast}€`, color: '#7C3AED' },
        {
          label: 'Δ Médiane',
          value: `${medianDelta >= 0 ? '+' : ''}${medianDelta}€`,
          color: medianDelta >= 0 ? '#16A34A' : '#EF4444',
          bold: true,
        },
      ]}
    />
  );
};
