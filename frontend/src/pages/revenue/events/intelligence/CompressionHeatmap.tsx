/**
 * FLOWTYM RMS — Compression Heatmap (dense, premium)
 *
 * Visualise jour par jour le score de compression marché sur la fenêtre.
 * Type "GitHub contributions" rectangles colorés par classification, avec
 * indicateur point pour les jours avec événement actif.
 *
 * Tooltip natif (title) — UI minimaliste et performante. Pas de lib chart.
 */

import React, { useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import {
  COMPRESSION_CLASSIFICATION_LABELS,
  type MarketHeatmapCell,
} from '@/src/types/marketIntelligence';

interface CompressionHeatmapProps {
  cells: MarketHeatmapCell[];
}

const TONE_BY_CLASS = {
  no_compression: { bg: 'bg-slate-100', label: 'Calme', dot: 'bg-slate-400' },
  soft:           { bg: 'bg-emerald-100', label: 'Léger', dot: 'bg-emerald-500' },
  building:       { bg: 'bg-amber-200',  label: 'Formation', dot: 'bg-amber-600' },
  strong:         { bg: 'bg-rose-300',   label: 'Forte', dot: 'bg-rose-600' },
  extreme:        { bg: 'bg-rose-600',   label: 'Extrême', dot: 'bg-rose-900' },
} as const;

export const CompressionHeatmap: React.FC<CompressionHeatmapProps> = ({ cells }) => {
  // Découpe en semaines (7 colonnes)
  const weeks = useMemo(() => {
    if (cells.length === 0) return [];
    const out: MarketHeatmapCell[][] = [];
    // Aligner sur le lundi : trouver le 1er lundi <= 1er cell
    const first = new Date(`${cells[0].date}T00:00:00Z`);
    const dow = (first.getUTCDay() + 6) % 7; // 0 = lundi
    const start = new Date(first);
    start.setUTCDate(first.getUTCDate() - dow);

    const byDate = new Map<string, MarketHeatmapCell>(cells.map((c) => [c.date, c]));
    const last = new Date(`${cells[cells.length - 1].date}T00:00:00Z`);
    const cur = new Date(start);
    let week: MarketHeatmapCell[] = [];
    while (cur <= last) {
      const iso = cur.toISOString().slice(0, 10);
      const c = byDate.get(iso) ?? {
        date: iso,
        compression: 0,
        velocity: 0,
        eventCount: 0,
        topEventId: null,
        classification: 'no_compression' as const,
      };
      week.push(c);
      if (week.length === 7) {
        out.push(week);
        week = [];
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (week.length) out.push(week);
    return out;
  }, [cells]);

  if (cells.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-6 text-center text-[12px] text-slate-400">
        Pas encore de données marché dans la fenêtre.
      </div>
    );
  }

  return (
    <div className="bg-slate-50/40 rounded-xl ring-1 ring-slate-100 p-3">
      {/* Header months */}
      <div className="flex items-center gap-px overflow-x-auto pb-1.5 -mt-0.5">
        <div className="w-6 shrink-0" />
        {weeks.map((w, wi) => {
          const first = w[0];
          const showLabel = wi === 0 || new Date(first.date).getUTCDate() <= 7;
          return (
            <div key={wi} className="w-3 shrink-0 text-[9.5px] text-slate-400 text-center tabular-nums">
              {showLabel && new Date(first.date).toLocaleDateString('fr-FR', { month: 'short' })}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-px overflow-x-auto">
        {/* Day labels */}
        <div className="flex flex-col gap-px text-[9.5px] text-slate-400 mr-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} className="h-3 leading-3">
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>

        {/* Heat cells */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-px">
            {week.map((cell, di) => {
              const tone = TONE_BY_CLASS[cell.classification];
              const hasEvent = cell.eventCount > 0;
              return (
                <div
                  key={di}
                  className={cn(
                    'w-3 h-3 rounded-[3px] relative',
                    tone.bg,
                  )}
                  title={`${formatDateFr(cell.date)} — Compression ${cell.compression}/100 (${tone.label}) · ${cell.eventCount} événement(s)`}
                >
                  {hasEvent && (
                    <span className={cn('absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full', tone.dot)} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
          <span>Moins</span>
          {(['no_compression', 'soft', 'building', 'strong', 'extreme'] as const).map((k) => (
            <span key={k} className={cn('w-3 h-3 rounded-[3px]', TONE_BY_CLASS[k].bg)} />
          ))}
          <span>Plus</span>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-violet-600" /> jour avec événement
          </span>
        </div>
      </div>
    </div>
  );
};

function formatDateFr(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
}
