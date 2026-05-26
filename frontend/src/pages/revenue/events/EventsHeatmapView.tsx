/**
 * FLOWTYM Events — Vue Heatmap
 *
 * Heatmap mois × catégorie des événements filtrés.
 * La couleur représente l'impact RM maximum atteint pour cette case.
 */
import React, { useMemo } from 'react';
import { Activity, Flame } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import { CATEGORY_LABELS, IMPACT_LABELS } from '@/src/types/events';
import type { EventCategory, EventImpactLevel, RMSMarketEvent } from '@/src/types/events';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const LEVEL_RANK: Record<EventImpactLevel, number> = {
  very_low:          0,
  low:               1,
  medium:            2,
  high:              3,
  critical:          4,
  hyper_compression: 5,
};

const LEVEL_COLOR: Record<number, string> = {
  0: 'bg-slate-50  text-slate-400  ring-slate-100',
  1: 'bg-sky-100   text-sky-700    ring-sky-200',
  2: 'bg-amber-100 text-amber-700  ring-amber-200',
  3: 'bg-orange-200 text-orange-700 ring-orange-300',
  4: 'bg-rose-200  text-rose-700   ring-rose-300',
  5: 'bg-fuchsia-300 text-fuchsia-800 ring-fuchsia-400',
};

const LEGEND: Array<{ rank: number; label: string }> = [
  { rank: 0, label: 'Aucun' },
  { rank: 1, label: 'Faible' },
  { rank: 2, label: 'Moyen' },
  { rank: 3, label: 'Fort' },
  { rank: 4, label: 'Critique' },
  { rank: 5, label: 'Hyper' },
];

interface Cell {
  rank: number;
  level: EventImpactLevel | null;
  count: number;
  events: RMSMarketEvent[];
}

export const EventsHeatmapView: React.FC = () => {
  const { getFilteredEvents } = useEventsStore();
  const events = getFilteredEvents();

  // Catégories effectivement présentes (sans les vides) pour limiter la grille.
  const categoriesUsed = useMemo<EventCategory[]>(() => {
    const set = new Set<EventCategory>();
    for (const ev of events) set.add(ev.category);
    return (Object.keys(CATEGORY_LABELS) as EventCategory[]).filter((c) => set.has(c));
  }, [events]);

  // Construit la matrice : catégorie → 12 mois → { rank max, count, events[] }
  const matrix = useMemo(() => {
    const m: Record<string, Cell[]> = {};
    for (const cat of categoriesUsed) {
      m[cat] = Array.from({ length: 12 }, () => ({ rank: 0, level: null, count: 0, events: [] }));
    }
    for (const ev of events) {
      const month = Number(ev.startDate.substring(5, 7)) - 1;
      if (Number.isNaN(month) || !m[ev.category]) continue;
      const cell = m[ev.category][month];
      const rank = LEVEL_RANK[ev.impact.level];
      cell.count += 1;
      cell.events.push(ev);
      if (rank > cell.rank) {
        cell.rank  = rank;
        cell.level = ev.impact.level;
      }
    }
    return m;
  }, [categoriesUsed, events]);

  // Total mois (toutes catégories confondues) pour la ligne récap
  const monthTotals = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => ({ count: 0, rank: 0 }));
    for (const cat of categoriesUsed) {
      const row = matrix[cat];
      for (let i = 0; i < 12; i++) {
        totals[i].count += row[i].count;
        if (row[i].rank > totals[i].rank) totals[i].rank = row[i].rank;
      }
    }
    return totals;
  }, [categoriesUsed, matrix]);

  const today = new Date();
  const currentMonth = today.getMonth();

  if (events.length === 0) {
    return (
      <div className="rounded-2xl ring-1 ring-slate-100 bg-white py-16 flex flex-col items-center gap-3 text-center shadow-sm">
        <Activity className="w-10 h-10 text-slate-300" />
        <div className="text-[14px] font-semibold text-slate-700">Aucun événement à représenter</div>
        <div className="text-[12px] text-slate-400 max-w-xs">
          Ajustez vos filtres ou ajoutez des événements pour visualiser la heatmap.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
            <Flame className="w-4 h-4 text-violet-600" />
            Heatmap d'impact RM — catégorie × mois
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            La couleur reflète l'impact RM maximum atteint sur la case. Le chiffre indique le nombre d'événements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-slate-400">Aucun</span>
          <div className="flex gap-0.5">
            {LEGEND.map((l) => (
              <div key={l.rank} className={cn('w-5 h-3 rounded-sm ring-1 ring-inset', LEVEL_COLOR[l.rank])} title={l.label} />
            ))}
          </div>
          <span className="text-[10.5px] text-slate-400">Hyper</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px] px-4 py-4">
          {/* Header months */}
          <div className="grid grid-cols-[140px_repeat(12,1fr)] gap-1 mb-1.5">
            <div />
            {MONTHS.map((m, idx) => (
              <div
                key={m}
                className={cn(
                  'text-[10px] font-bold text-center uppercase tracking-wide py-1',
                  idx === currentMonth ? 'text-violet-600' : 'text-slate-400',
                )}
              >
                {m}
              </div>
            ))}
          </div>

          {/* Rows */}
          {categoriesUsed.map((cat) => (
            <div key={cat} className="grid grid-cols-[140px_repeat(12,1fr)] gap-1 mb-1">
              <div className="text-[11.5px] font-medium text-slate-700 truncate self-center pr-2">
                {CATEGORY_LABELS[cat]}
              </div>
              {matrix[cat].map((cell, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-9 rounded-md ring-1 ring-inset flex items-center justify-center text-[11px] font-bold transition-transform hover:scale-110 hover:z-10 relative',
                    LEVEL_COLOR[cell.rank],
                  )}
                  title={
                    cell.count
                      ? `${CATEGORY_LABELS[cat]} · ${MONTHS[idx]} : ${cell.count} évén. · impact max ${cell.level ? IMPACT_LABELS[cell.level] : '—'}`
                      : `${CATEGORY_LABELS[cat]} · ${MONTHS[idx]} : aucun événement`
                  }
                >
                  {cell.count > 0 ? cell.count : ''}
                </div>
              ))}
            </div>
          ))}

          {/* Totals row */}
          <div className="grid grid-cols-[140px_repeat(12,1fr)] gap-1 mt-2 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold text-violet-700 self-center pr-2">Total / mois</div>
            {monthTotals.map((t, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-9 rounded-md flex items-center justify-center text-[11.5px] font-bold ring-1 ring-inset',
                  LEVEL_COLOR[t.rank],
                  idx === currentMonth && 'outline outline-1 outline-violet-500 outline-offset-1',
                )}
              >
                {t.count > 0 ? t.count : '·'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
