/**
 * FLOWTYM — Heatmap mensuelle (calendrier)
 *
 * Carte chaleur 7×N (semaines × jours) avec couleurs ramp.
 */

import React from 'react';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export interface HeatmapCell {
  date: string;       // YYYY-MM-DD
  value: number;
  label?: string;     // optionnel pour tooltip
}

export interface HeatmapProps {
  cells: HeatmapCell[];
  min?: number;
  max?: number;
  colorRamp?: [string, string, string]; // [low, mid, high]
  valueFormatter?: (v: number) => string;
  onCellClick?: (cell: HeatmapCell) => void;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getWeekIndex(date: Date, firstDay: Date): number {
  const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  return Math.floor(days / 7);
}

function lerpColor(color1: string, color2: string, t: number): string {
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export const Heatmap: React.FC<HeatmapProps> = ({
  cells, min, max, colorRamp = ['#FAFAFA', '#A5B4FC', '#4338CA'], valueFormatter, onCellClick,
}) => {
  if (cells.length === 0) {
    return <div className="text-center text-xs text-gray-400 py-12">Aucune donnée à afficher</div>;
  }

  const sorted = [...cells].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = new Date(sorted[0].date);
  // Aligner sur lundi
  const firstWeekDay = (firstDate.getDay() + 6) % 7; // 0 = lundi
  const firstMonday = new Date(firstDate);
  firstMonday.setDate(firstDate.getDate() - firstWeekDay);

  const lastDate = new Date(sorted[sorted.length - 1].date);
  const weekCount = getWeekIndex(lastDate, firstMonday) + 1;

  const minV = min ?? Math.min(...cells.map(c => c.value));
  const maxV = max ?? Math.max(...cells.map(c => c.value));
  const range = Math.max(maxV - minV, 1);

  // Construire grille [weekIdx][dayIdx]
  const grid: (HeatmapCell | null)[][] = Array.from({ length: weekCount }, () => Array(7).fill(null));
  cells.forEach(c => {
    const d = new Date(c.date);
    const dayIdx = (d.getDay() + 6) % 7;
    const weekIdx = getWeekIndex(d, firstMonday);
    if (weekIdx >= 0 && weekIdx < weekCount) {
      grid[weekIdx][dayIdx] = c;
    }
  });

  const colorFor = (value: number) => {
    const t = (value - minV) / range;
    if (t < 0.5) return lerpColor(colorRamp[0], colorRamp[1], t * 2);
    return lerpColor(colorRamp[1], colorRamp[2], (t - 0.5) * 2);
  };

  const fmt = valueFormatter ?? ((v: number) => `${v}`);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        <div className="flex flex-col gap-1 pr-1 sticky left-0 bg-white">
          <div className="h-4" />
          {DAYS.map(d => (
            <div key={d} className="h-6 flex items-center text-[10px] text-gray-400 font-semibold w-7">
              {d}
            </div>
          ))}
        </div>
        {Array.from({ length: weekCount }).map((_, wi) => {
          const weekStart = new Date(firstMonday);
          weekStart.setDate(firstMonday.getDate() + wi * 7);
          const monthLabel = weekStart.toLocaleDateString('fr-FR', { month: 'short' });
          return (
            <div key={wi} className="flex flex-col gap-1">
              <div className="h-4 text-[9px] text-gray-400 text-center">
                {wi === 0 || weekStart.getDate() <= 7 ? monthLabel : ''}
              </div>
              {Array.from({ length: 7 }).map((_, di) => {
                const cell = grid[wi][di];
                if (!cell) return <div key={di} className="h-6 w-6" />;
                return (
                  <button
                    key={di}
                    onClick={() => onCellClick?.(cell)}
                    className={cn(
                      'h-6 w-6 rounded-sm border border-white transition-all hover:scale-110 hover:z-10 hover:ring-2 hover:ring-violet-300',
                    )}
                    style={{ backgroundColor: colorFor(cell.value) }}
                    title={`${cell.date} · ${fmt(cell.value)}${cell.label ? ` · ${cell.label}` : ''}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Légende */}
      <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-500">
        <span>Min {fmt(minV)}</span>
        <div className="flex">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-3 w-3" style={{ backgroundColor: colorFor(minV + (range * i) / 9) }} />
          ))}
        </div>
        <span>Max {fmt(maxV)}</span>
      </div>
    </div>
  );
};
