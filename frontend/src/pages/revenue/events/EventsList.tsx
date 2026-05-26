/**
 * FLOWTYM RMS — Vue Liste du module Événements
 *
 * Colonnes maquette :
 *   ÉVÉNEMENT | LIEU | DATES | CATÉGORIE | IMPACT ESTIMÉ (TO · ADR · RevPAR)
 *   | SCORE | STATUT | SOURCE | ACTIONS
 *
 * Sticky header · pagination premium · skeleton loader · flags réels.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown as ChevronDownIcon,
  ChevronsLeft, ChevronsRight,
  Copy, Edit3, MoreVertical, Pause, Play, Trash2,
  CheckCircle2, Clock, Archive, XCircle, AlertTriangle, Pencil, HelpCircle,
  TrendingUp, Plug,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import type { EventStatus, RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS } from '@/src/types/events';
import { ImpactBadge } from './components/ImpactBadge';
import { CATEGORY_ICON } from './components/CategoryIcon';
import { CountryFlag } from './components/CountryFlag';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const MONTHS_FR_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateFr(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS_FR_SHORT[parseInt(m, 10) - 1]} ${y}`;
}

function formatDateRange(start: string, end: string): React.ReactNode {
  if (start === end) return <span className="whitespace-nowrap tabular-nums">{formatDateFr(start)}</span>;
  const sy = start.slice(0, 4), ey = end.slice(0, 4);
  const startStr = sy === ey
    ? `${parseInt(start.slice(8), 10)} ${MONTHS_FR_SHORT[parseInt(start.slice(5, 7), 10) - 1]}`
    : formatDateFr(start);
  return (
    <span className="whitespace-nowrap tabular-nums">
      {startStr}
      <span className="text-slate-300 mx-1">→</span>
      {formatDateFr(end)}
    </span>
  );
}

function fmt(n: number, plus = true): string {
  const s = n.toFixed(0);
  return plus && n >= 0 ? `+${s}%` : `${s}%`;
}

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusCfg {
  dot: string; pill: string; text: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATUS_CFG: Record<EventStatus, StatusCfg> = {
  new:       { dot: 'bg-indigo-400',  pill: 'bg-indigo-50  ring-indigo-100',  text: 'text-indigo-700',  label: 'Nouveau',     icon: TrendingUp    },
  confirmed: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700', label: 'Confirmé',    icon: CheckCircle2  },
  estimated: { dot: 'bg-sky-400',     pill: 'bg-sky-50     ring-sky-100',     text: 'text-sky-700',     label: 'Estimé',      icon: HelpCircle    },
  active:    { dot: 'bg-emerald-500', pill: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700', label: 'Actif',       icon: CheckCircle2  },
  planned:   { dot: 'bg-blue-400',    pill: 'bg-blue-50    ring-blue-100',    text: 'text-blue-700',    label: 'Planifié',    icon: Clock         },
  modified:  { dot: 'bg-amber-400',   pill: 'bg-amber-50   ring-amber-100',   text: 'text-amber-700',   label: 'Modifié',     icon: Pencil        },
  to_verify: { dot: 'bg-orange-400',  pill: 'bg-orange-50  ring-orange-100',  text: 'text-orange-700',  label: 'À vérifier',  icon: AlertTriangle },
  archived:  { dot: 'bg-slate-300',   pill: 'bg-slate-50   ring-slate-100',   text: 'text-slate-600',   label: 'Archivé',     icon: Archive       },
  cancelled: { dot: 'bg-rose-400',    pill: 'bg-rose-50    ring-rose-100',    text: 'text-rose-700',    label: 'Annulé',      icon: XCircle       },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusPill({ status }: { status: EventStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.planned;
  const Icon = cfg.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold whitespace-nowrap',
      cfg.pill, cfg.text,
    )}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      {cfg.label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-rose-50 text-rose-700 ring-rose-100' :
    score >= 60 ? 'bg-orange-50 text-orange-700 ring-orange-100' :
    score >= 40 ? 'bg-amber-50 text-amber-700 ring-amber-100' :
    'bg-slate-50 text-slate-600 ring-slate-100';
  return (
    <span className={cn('inline-flex items-center justify-center w-9 h-6 rounded-md ring-1 text-[11.5px] font-bold tabular-nums', color)}>
      {Math.round(score)}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[180, 110, 130, 80, 160, 50, 90, 90, 32].map((w, i) => (
        <td key={i} className="px-3 py-3.5">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Tri ──────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'startDate' | 'city' | 'occupancy' | 'adr' | 'revpar' | 'confidence' | 'status';

function sortEvents(events: RMSMarketEvent[], key: SortKey, dir: 1 | -1): RMSMarketEvent[] {
  return [...events].sort((a, b) => {
    let va: string | number, vb: string | number;
    switch (key) {
      case 'name':       va = a.name;             vb = b.name;       break;
      case 'startDate':  va = a.startDate;        vb = b.startDate;  break;
      case 'city':       va = a.city;             vb = b.city;       break;
      case 'occupancy':  va = a.impact.occupancy; vb = b.impact.occupancy; break;
      case 'adr':        va = a.impact.adr;       vb = b.impact.adr; break;
      case 'revpar':     va = a.impact.revpar;    vb = b.impact.revpar; break;
      case 'confidence': va = a.impact.confidence; vb = b.impact.confidence; break;
      case 'status':     va = a.status;           vb = b.status;     break;
      default:           return 0;
    }
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return 0;
  });
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: 1 | -1 }) {
  if (col !== sortKey) return <ChevronDownIcon className="w-3 h-3 opacity-20" />;
  return sortDir === 1
    ? <ChevronUp className="w-3 h-3 text-violet-600" />
    : <ChevronDownIcon className="w-3 h-3 text-violet-600" />;
}

// ─── Main list ────────────────────────────────────────────────────────────────

interface EventsListProps { onSelect: (ev: RMSMarketEvent) => void }

export const EventsList: React.FC<EventsListProps> = ({ onSelect }) => {
  const { getFilteredEvents, deleteEvent, duplicateEvent, setStatus, filters } = useEventsStore();
  const events   = getFilteredEvents();
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menu, setMenu]         = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState(false);
  const [sortKey, setSortKey]   = useState<SortKey>('startDate');
  const [sortDir, setSortDir]   = useState<1 | -1>(1);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  }

  // Simule un court skeleton visuel quand les filtres changent.
  const prevFilters = useRef(filters);
  useEffect(() => {
    if (prevFilters.current !== filters) {
      prevFilters.current = filters;
      setSkeleton(true);
      const t = setTimeout(() => setSkeleton(false), 200);
      return () => clearTimeout(t);
    }
  }, [filters]);

  // Retour page 1 quand les filtres changent.
  useEffect(() => { setPage(1); },
    [filters.search, filters.minImpact, filters.categories, filters.fromDate, filters.toDate, filters.activeOnly, pageSize]);

  const sorted = useMemo(() => sortEvents(events, sortKey, sortDir), [events, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const firstIdx = sorted.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIdx  = Math.min(page * pageSize, sorted.length);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400 bg-slate-50/95 backdrop-blur border-b border-slate-100">
              <Th onClick={() => toggleSort('name')} label="Événement" sortKey="name" active={sortKey} dir={sortDir} />
              <Th onClick={() => toggleSort('city')} label="Lieu" sortKey="city" active={sortKey} dir={sortDir} />
              <Th onClick={() => toggleSort('startDate')} label="Dates" sortKey="startDate" active={sortKey} dir={sortDir} />
              <th className="px-3 py-3 font-semibold">Catégorie</th>
              {/* Impact estimé — 3 sous-colonnes cliquables */}
              <th className="px-3 py-3 font-semibold cursor-pointer hover:text-violet-600 select-none text-right" onClick={() => toggleSort('occupancy')}>
                <span className="flex items-center justify-end gap-1">
                  TO <SortIcon col="occupancy" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th className="px-3 py-3 font-semibold cursor-pointer hover:text-violet-600 select-none text-right" onClick={() => toggleSort('adr')}>
                <span className="flex items-center justify-end gap-1">
                  ADR <SortIcon col="adr" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th className="px-3 py-3 font-semibold cursor-pointer hover:text-violet-600 select-none text-right" onClick={() => toggleSort('revpar')}>
                <span className="flex items-center justify-end gap-1">
                  RevPAR <SortIcon col="revpar" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <Th onClick={() => toggleSort('confidence')} label="Score" sortKey="confidence" active={sortKey} dir={sortDir} />
              <Th onClick={() => toggleSort('status')} label="Statut" sortKey="status" active={sortKey} dir={sortDir} />
              <th className="px-3 py-3 font-semibold">Source</th>
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {skeleton
              ? Array.from({ length: pageSize }).map((_, i) => <SkeletonRow key={i} />)
              : sorted.length === 0
                ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center text-slate-400 text-sm">
                      Aucun événement ne correspond aux filtres en cours.
                    </td>
                  </tr>
                )
                : pageEvents.map((e: RMSMarketEvent) => (
                    <EventRow
                      key={e.id}
                      e={e}
                      onSelect={onSelect}
                      menu={menu}
                      setMenu={(id) => setMenu(id)}
                      duplicateEvent={duplicateEvent}
                      setStatus={setStatus}
                      deleteEvent={deleteEvent}
                    />
                  ))
            }
          </tbody>
        </table>
      </div>

      {/* Pagination sticky */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 bg-white/95 backdrop-blur text-[12px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            {sorted.length === 0
              ? '0 événement'
              : <><strong className="text-slate-800">{firstIdx}–{lastIdx}</strong> sur <strong className="text-slate-800">{sorted.length}</strong> événement{sorted.length > 1 ? 's' : ''}</>}
          </span>
          <span className="hidden sm:inline text-slate-300">·</span>
          <label className="hidden sm:flex items-center gap-2">
            <span>Par page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              className="px-2 py-1 rounded-md ring-1 ring-slate-200 bg-white text-[12px] font-semibold text-slate-700 focus:ring-violet-500 outline-none cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <PageNumbers page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
};

// ─── Sortable column header ───────────────────────────────────────────────────

function Th({ label, sortKey, active, dir, onClick }: {
  label: string; sortKey: SortKey; active: SortKey; dir: 1 | -1;
  onClick: () => void;
}) {
  const isActive = sortKey === active;
  return (
    <th
      className={cn(
        'px-3 py-3 font-semibold cursor-pointer select-none hover:text-violet-600 transition-colors',
        isActive && 'text-violet-600',
      )}
      onClick={onClick}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon col={sortKey} sortKey={active} sortDir={dir} />
      </span>
    </th>
  );
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

interface EventRowProps {
  e: RMSMarketEvent;
  onSelect: (ev: RMSMarketEvent) => void;
  menu: string | null;
  setMenu: (id: string | null) => void;
  duplicateEvent: (id: string) => void;
  setStatus: (id: string, status: EventStatus) => void;
  deleteEvent: (id: string) => void;
}

const EventRow: React.FC<EventRowProps> = ({ e, onSelect, menu, setMenu, duplicateEvent, setStatus, deleteEvent }) => {
  const Icon = CATEGORY_ICON[e.category];
  const catColor = CATEGORY_TONE[e.category] ?? 'bg-slate-100 text-slate-700';

  return (
    <tr
      className="border-b border-slate-100 last:border-0 hover:bg-violet-50/20 cursor-pointer group transition-colors"
      onClick={() => onSelect(e)}
    >
      {/* Événement */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset" style={{ backgroundColor: 'rgb(245 243 255)', color: 'rgb(109 40 217)' }}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">{e.name}</div>
            {e.venue && <div className="text-[11px] text-slate-400 truncate">{e.venue}</div>}
          </div>
        </div>
      </td>

      {/* Lieu */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {e.country && <CountryFlag code={e.country} size="xs" />}
          <div className="min-w-0">
            <div className="text-slate-800 font-medium truncate text-[12.5px]">{e.city}</div>
            {e.country && <div className="text-[10.5px] text-slate-400 truncate">{e.country}</div>}
          </div>
        </div>
      </td>

      {/* Dates */}
      <td className="px-3 py-3 text-slate-600 text-[12px]">
        {formatDateRange(e.startDate, e.endDate)}
      </td>

      {/* Catégorie */}
      <td className="px-3 py-3">
        <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-semibold', catColor)}>
          {CATEGORY_LABELS[e.category]}
        </span>
      </td>

      {/* TO */}
      <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-600 text-[12.5px]">
        {fmt(e.impact.occupancy)}
      </td>
      {/* ADR */}
      <td className="px-3 py-3 text-right tabular-nums font-semibold text-violet-600 text-[12.5px]">
        {fmt(e.impact.adr)}
      </td>
      {/* RevPAR */}
      <td className="px-3 py-3 text-right tabular-nums font-semibold text-indigo-600 text-[12.5px]">
        {fmt(e.impact.revpar)}
      </td>

      {/* Score */}
      <td className="px-3 py-3">
        <ScoreBadge score={e.impact.confidence} />
      </td>

      {/* Statut */}
      <td className="px-3 py-3">
        <StatusPill status={e.status} />
      </td>

      {/* Source */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          {e.rmsSynced && <Plug className="w-3 h-3 text-emerald-500 shrink-0" title="RMS synchronisé" />}
          <span className="text-[11.5px] text-slate-500 truncate max-w-[100px]">{e.primarySource}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-right relative" onClick={(ev) => ev.stopPropagation()}>
        <button
          onClick={() => setMenu(menu === e.id ? null : e.id)}
          className="p-1.5 rounded-lg hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Actions"
        >
          <MoreVertical className="w-4 h-4 text-slate-500" />
        </button>
        {menu === e.id && (
          <div className="absolute right-2 top-10 z-20 w-48 bg-white rounded-xl ring-1 ring-slate-200 shadow-xl py-1 text-[13px]">
            <button onClick={() => { onSelect(e); setMenu(null); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Modifier
            </button>
            <button onClick={() => { duplicateEvent(e.id); setMenu(null); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-slate-500" /> Dupliquer
            </button>
            <button onClick={() => {
              setStatus(e.id, e.status === 'active' ? 'planned' : 'active');
              setMenu(null);
            }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
              {e.status === 'active'
                ? <><Pause className="w-3.5 h-3.5 text-slate-500" /> Désactiver</>
                : <><Play className="w-3.5 h-3.5 text-slate-500" /> Activer</>}
            </button>
            <button onClick={() => {
              setStatus(e.id, 'confirmed');
              setMenu(null);
            }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmer
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button onClick={() => { deleteEvent(e.id); setMenu(null); }}
              className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Category color palette ───────────────────────────────────────────────────

const CATEGORY_TONE: Partial<Record<string, string>> = {
  salon:          'bg-blue-50   text-blue-700',
  congress:       'bg-indigo-50 text-indigo-700',
  sport:          'bg-emerald-50 text-emerald-700',
  concert:        'bg-fuchsia-50 text-fuchsia-700',
  culture:        'bg-purple-50  text-purple-700',
  fashion:        'bg-rose-50    text-rose-700',
  festival:       'bg-orange-50  text-orange-700',
  holiday:        'bg-amber-50   text-amber-700',
  school_break:   'bg-sky-50     text-sky-700',
  tourism_peak:   'bg-teal-50    text-teal-700',
  religious:      'bg-violet-50  text-violet-700',
  political:      'bg-slate-100  text-slate-700',
  internal:       'bg-slate-100  text-slate-700',
  manual:         'bg-slate-100  text-slate-700',
  mega_concert:   'bg-fuchsia-100 text-fuchsia-800',
  pop_concert:    'bg-pink-50    text-pink-700',
  rap_concert:    'bg-zinc-100   text-zinc-800',
  kpop_concert:   'bg-fuchsia-50 text-fuchsia-700',
  electro_concert:'bg-cyan-50    text-cyan-700',
  metal_concert:  'bg-red-50     text-red-700',
  world_tour:     'bg-violet-100 text-violet-800',
  other:          'bg-slate-100  text-slate-600',
};

// ─── Premium pagination ───────────────────────────────────────────────────────

interface PageNumbersProps { page: number; totalPages: number; onChange: (p: number) => void }

function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end   = Math.min(total - 1, page + 1);
  if (start > 2) out.push('gap');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push('gap');
  out.push(total);
  return out;
}

function PageNumbers({ page, totalPages, onChange }: PageNumbersProps) {
  const items = pageWindow(page, totalPages);
  const btn = 'h-7 min-w-[28px] px-1.5 rounded-md text-[12px] font-semibold tabular-nums flex items-center justify-center transition-colors';
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(1)} disabled={page === 1} title="Première page"
        className={cn(btn, 'text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent')}>
        <ChevronsLeft className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} title="Précédent"
        className={cn(btn, 'text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent')}>
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`g${i}`} className="px-1 text-slate-300 select-none">…</span>
        ) : (
          <button key={it} onClick={() => onChange(it)} aria-current={page === it ? 'page' : undefined}
            className={cn(btn, page === it ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>
            {it}
          </button>
        ),
      )}
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} title="Suivant"
        className={cn(btn, 'text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent')}>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onChange(totalPages)} disabled={page === totalPages} title="Dernière page"
        className={cn(btn, 'text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent')}>
        <ChevronsRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
