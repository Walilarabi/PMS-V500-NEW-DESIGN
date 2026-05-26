/**
 * FLOWTYM Events — Heatmap interactive
 *
 * Clic sur une cellule → panneau de détail :
 *   • Événements listés, pays, périodes
 *   • Score de compression, impact RMS, TO/ADR/RevPAR estimés
 *   • Niveau de pression marché
 */
import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUp, BarChart2, Flame, TrendingUp, X, Zap,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import { CATEGORY_LABELS, IMPACT_LABELS } from '@/src/types/events';
import type { EventCategory, EventImpactLevel, RMSMarketEvent } from '@/src/types/events';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTHS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const LEVEL_RANK: Record<EventImpactLevel, number> = {
  very_low: 0, low: 1, medium: 2, high: 3, critical: 4, hyper_compression: 5,
};

const LEVEL_COLOR: Record<number, string> = {
  0: 'bg-slate-50   text-slate-400   ring-slate-100',
  1: 'bg-sky-100    text-sky-700     ring-sky-200',
  2: 'bg-amber-100  text-amber-700   ring-amber-200',
  3: 'bg-orange-200 text-orange-700  ring-orange-300',
  4: 'bg-rose-200   text-rose-700    ring-rose-300',
  5: 'bg-fuchsia-300 text-fuchsia-800 ring-fuchsia-400',
};

const PRESSURE_LABELS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Nulle',    cls: 'text-slate-400'   },
  1: { label: 'Faible',   cls: 'text-sky-600'     },
  2: { label: 'Modérée',  cls: 'text-amber-600'   },
  3: { label: 'Forte',    cls: 'text-orange-600'  },
  4: { label: 'Critique', cls: 'text-rose-600'    },
  5: { label: 'Extrême',  cls: 'text-fuchsia-700' },
};

const LEGEND: Array<{ rank: number; label: string }> = [
  { rank: 0, label: 'Aucun' },
  { rank: 1, label: 'Faible' },
  { rank: 2, label: 'Moyen' },
  { rank: 3, label: 'Fort' },
  { rank: 4, label: 'Critique' },
  { rank: 5, label: 'Hyper' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cell {
  rank: number;
  level: EventImpactLevel | null;
  count: number;
  events: RMSMarketEvent[];
}

interface SelectedCell {
  category: EventCategory;
  monthIdx: number;
  cell: Cell;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avgImpact(events: RMSMarketEvent[], field: 'adr' | 'occupancy' | 'revpar' | 'compression'): number {
  if (!events.length) return 0;
  return Math.round(events.reduce((s, e) => s + (e.impact[field] ?? 0), 0) / events.length);
}

function uniqueCountries(events: RMSMarketEvent[]): string[] {
  return [...new Set(events.map((e) => e.country).filter(Boolean))];
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function CellDetailPanel({ sel, onClose }: { sel: SelectedCell; onClose: () => void }) {
  const { cell, category, monthIdx } = sel;
  const year = new Date().getFullYear();
  const avgAdr         = avgImpact(cell.events, 'adr');
  const avgOccupancy   = avgImpact(cell.events, 'occupancy');
  const avgRevpar      = avgImpact(cell.events, 'revpar');
  const avgCompression = avgImpact(cell.events, 'compression');
  const countries      = uniqueCountries(cell.events);
  const pressure       = PRESSURE_LABELS[cell.rank] ?? PRESSURE_LABELS[0];

  return (
    <div className="mt-4 rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 bg-slate-50/60 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-bold text-slate-900">
              {CATEGORY_LABELS[category]} · {MONTHS_FULL[monthIdx]} {year}
            </h3>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ring-1 ring-inset',
              LEVEL_COLOR[cell.rank],
            )}>
              {cell.level ? IMPACT_LABELS[cell.level] : 'Aucun impact'}
            </span>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            {cell.count} événement{cell.count !== 1 ? 's' : ''} · Pression marché :{' '}
            <span className={cn('font-semibold', pressure.cls)}>{pressure.label}</span>
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition-colors" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox
            label="TO estimé"
            value={`+${avgOccupancy}%`}
            icon={BarChart2}
            color="text-violet-600"
            bg="bg-violet-50"
            ring="ring-violet-100"
          />
          <KpiBox
            label="ADR estimé"
            value={`+${avgAdr}%`}
            icon={TrendingUp}
            color="text-amber-600"
            bg="bg-amber-50"
            ring="ring-amber-100"
          />
          <KpiBox
            label="RevPAR estimé"
            value={`+${avgRevpar}%`}
            icon={ArrowUp}
            color="text-emerald-600"
            bg="bg-emerald-50"
            ring="ring-emerald-100"
          />
          <KpiBox
            label="Compression"
            value={`${avgCompression}%`}
            icon={Zap}
            color="text-rose-600"
            bg="bg-rose-50"
            ring="ring-rose-100"
          />
        </div>

        {/* Pays + impact RMS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Pays concernés</div>
            {countries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {countries.map((c) => (
                  <span key={c} className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-[12px] font-medium text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[12px] text-slate-400">—</span>
            )}
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Pression marché</div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  cell.rank >= 4 ? 'bg-rose-500' : cell.rank >= 3 ? 'bg-orange-500' : cell.rank >= 2 ? 'bg-amber-500' : 'bg-sky-400',
                )}
                style={{ width: `${Math.round((cell.rank / 5) * 100)}%` }}
              />
            </div>
            <div className={cn('text-[12px] font-semibold mt-1', pressure.cls)}>{pressure.label}</div>
          </div>
        </div>

        {/* Liste des événements */}
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
            Événements liés ({cell.count})
          </div>
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
            {cell.events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50/80 ring-1 ring-slate-100">
                <div className={cn(
                  'mt-0.5 w-2 h-2 rounded-full shrink-0',
                  LEVEL_COLOR[LEVEL_RANK[ev.impact.level]].split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-slate-300',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-slate-900 truncate">{ev.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-2">
                    <span>{fmtDate(ev.startDate)} → {fmtDate(ev.endDate)}</span>
                    {ev.venue && <span className="text-slate-400">· {ev.venue}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-semibold text-amber-600">+{ev.impact.adr}% ADR</div>
                  <div className="text-[10px] text-violet-600">{ev.impact.compression}% compr.</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerte RM suggérée */}
        {cell.rank >= 3 && (
          <div className={cn(
            'flex items-start gap-2.5 rounded-xl px-4 py-3 text-[12px] ring-1',
            cell.rank >= 5
              ? 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200'
              : cell.rank >= 4
                ? 'bg-rose-50 text-rose-800 ring-rose-200'
                : 'bg-orange-50 text-orange-800 ring-orange-200',
          )}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Action RM recommandée : </span>
              {cell.rank >= 5
                ? 'Stop-sell ou yield maximum — compression extrême anticipée.'
                : cell.rank >= 4
                  ? 'Relever significativement les tarifs — forte compression prévue.'
                  : 'Surveiller et ajuster les tarifs à la hausse dès J-30.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiBox({ label, value, icon: Icon, color, bg, ring }: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string; ring: string;
}) {
  return (
    <div className={cn('rounded-xl ring-1 px-3 py-2.5 bg-white', ring)}>
      <div className={cn('w-6 h-6 rounded-md flex items-center justify-center mb-1.5', bg)}>
        <Icon className={cn('w-3 h-3', color)} />
      </div>
      <div className={cn('text-[16px] font-bold tabular-nums', color)}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export const EventsHeatmapView: React.FC = () => {
  const { getFilteredEvents } = useEventsStore();
  const events = getFilteredEvents();
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const categoriesUsed = useMemo<EventCategory[]>(() => {
    const set = new Set<EventCategory>();
    for (const ev of events) set.add(ev.category);
    return (Object.keys(CATEGORY_LABELS) as EventCategory[]).filter((c) => set.has(c));
  }, [events]);

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
      if (rank > cell.rank) { cell.rank = rank; cell.level = ev.impact.level; }
    }
    return m;
  }, [categoriesUsed, events]);

  const monthTotals = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => ({ count: 0, rank: 0, events: [] as RMSMarketEvent[] }));
    for (const cat of categoriesUsed) {
      const row = matrix[cat];
      for (let i = 0; i < 12; i++) {
        totals[i].count += row[i].count;
        totals[i].events.push(...row[i].events);
        if (row[i].rank > totals[i].rank) totals[i].rank = row[i].rank;
      }
    }
    return totals;
  }, [categoriesUsed, matrix]);

  const today = new Date();
  const currentMonth = today.getMonth();

  function handleCellClick(cat: EventCategory, monthIdx: number) {
    const cell = matrix[cat]?.[monthIdx];
    if (!cell || cell.count === 0) return;
    if (selected?.category === cat && selected?.monthIdx === monthIdx) {
      setSelected(null);
    } else {
      setSelected({ category: cat, monthIdx, cell });
    }
  }

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
    <div className="space-y-0">
      <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-violet-600" />
              Heatmap d'impact RM — catégorie × mois
            </h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Cliquez sur une cellule pour afficher le détail : événements, métriques RM, pression marché.
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

            {/* Category rows */}
            {categoriesUsed.map((cat) => (
              <div key={cat} className="grid grid-cols-[140px_repeat(12,1fr)] gap-1 mb-1">
                <div className="text-[11.5px] font-medium text-slate-700 truncate self-center pr-2">
                  {CATEGORY_LABELS[cat]}
                </div>
                {matrix[cat].map((cell, idx) => {
                  const isSelected = selected?.category === cat && selected?.monthIdx === idx;
                  const clickable = cell.count > 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!clickable}
                      onClick={() => handleCellClick(cat, idx)}
                      className={cn(
                        'h-9 rounded-md ring-1 ring-inset flex items-center justify-center text-[11px] font-bold transition-all',
                        LEVEL_COLOR[cell.rank],
                        clickable
                          ? 'cursor-pointer hover:scale-110 hover:z-10 hover:shadow-md relative focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1'
                          : 'cursor-default',
                        isSelected && 'ring-2 ring-violet-500 scale-110 z-10 shadow-md',
                      )}
                      title={
                        cell.count
                          ? `${CATEGORY_LABELS[cat]} · ${MONTHS[idx]} — ${cell.count} évén. · impact max ${cell.level ? IMPACT_LABELS[cell.level] : '—'} — Cliquer pour détails`
                          : `${CATEGORY_LABELS[cat]} · ${MONTHS[idx]} — aucun événement`
                      }
                      aria-label={cell.count ? `Voir détails ${CATEGORY_LABELS[cat]} ${MONTHS_FULL[idx]}` : undefined}
                    >
                      {cell.count > 0 ? cell.count : ''}
                    </button>
                  );
                })}
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

      {/* Detail panel — slides in below the heatmap when a cell is selected */}
      {selected && (
        <CellDetailPanel
          sel={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};
