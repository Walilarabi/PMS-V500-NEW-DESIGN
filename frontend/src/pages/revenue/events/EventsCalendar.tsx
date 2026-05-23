/**
 * FLOWTYM RMS — Vue Calendrier du module Événements
 *
 * Calendrier mensuel premium avec :
 *   • barres événements multi-jours (gestion des chevauchements en lanes)
 *   • indicateur pression marché par jour (point coloré)
 *   • cellules aérées, hiérarchie tabulaire (Apple Calendar + Linear)
 *   • navigation prev/next + "Aujourd'hui"
 *   • clic sur événement → ouverture du panneau détail
 */
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import type { RMSMarketEvent, EventImpactLevel } from '@/src/types/events';
import { IMPACT_LABELS } from '@/src/types/events';
import { EventBar } from './components/EventBar';
import { impactColor } from './components/ImpactBadge';

const WEEKDAY_LABELS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

interface EventsCalendarProps {
  onSelectEvent: (ev: RMSMarketEvent) => void;
  onCreate?: (date: string) => void;
}

function startOfMonthGrid(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dayIdx = (first.getDay() + 6) % 7; // lundi = 0
  const grid = new Date(first);
  grid.setDate(first.getDate() - dayIdx);
  return grid;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Range layout : on découpe par semaine, et on attribue une lane à chaque event */
function layoutWeek(weekStart: Date, weekEnd: Date, events: RMSMarketEvent[]) {
  const inRange = events.filter(
    (e) => e.startDate <= isoDay(weekEnd) && e.endDate >= isoDay(weekStart),
  );
  // tri par début + durée décroissante pour stacking propre
  const sorted = [...inRange].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return b.endDate.localeCompare(a.endDate);
  });
  const lanes: { event: RMSMarketEvent; startCol: number; span: number; truncL: boolean; truncR: boolean }[][] = [];
  for (const ev of sorted) {
    const evStart = new Date(`${ev.startDate}T00:00:00`);
    const evEnd = new Date(`${ev.endDate}T00:00:00`);
    const clipStart = evStart < weekStart ? weekStart : evStart;
    const clipEnd = evEnd > weekEnd ? weekEnd : evEnd;
    const startCol = Math.floor((clipStart.getTime() - weekStart.getTime()) / 86_400_000);
    const span = Math.floor((clipEnd.getTime() - clipStart.getTime()) / 86_400_000) + 1;
    const truncL = evStart < weekStart;
    const truncR = evEnd > weekEnd;
    let placed = false;
    for (const lane of lanes) {
      const conflict = lane.some(
        (it) => !(it.startCol + it.span <= startCol || startCol + span <= it.startCol),
      );
      if (!conflict) {
        lane.push({ event: ev, startCol, span, truncL, truncR });
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([{ event: ev, startCol, span, truncL, truncR }]);
  }
  return lanes;
}

export const EventsCalendar: React.FC<EventsCalendarProps> = ({ onSelectEvent, onCreate }) => {
  const { getFilteredEvents, getPressureWindow } = useEventsStore();
  const events = getFilteredEvents();
  const [cursor, setCursor] = useState<Date>(() => new Date(2026, 5, 1)); // juin 2026 pour démo

  const gridStart = useMemo(() => startOfMonthGrid(cursor), [cursor]);
  const weeks = useMemo(() => {
    const arr: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + w * 7 + d);
        week.push(day);
      }
      arr.push(week);
    }
    return arr;
  }, [gridStart]);

  const gridFrom = isoDay(weeks[0][0]);
  const gridTo = isoDay(weeks[weeks.length - 1][6]);
  const pressure = useMemo(() => getPressureWindow(gridFrom, gridTo), [gridFrom, gridTo, events.length]);

  const todayIso = isoDay(new Date());
  const monthLabel = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const shift = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date())}
            className="px-3 py-1.5 text-[13px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg ring-1 ring-slate-100"
          >
            Aujourd'hui
          </button>
          <div className="flex items-center gap-0.5 ml-1">
            <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-50">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <h3 className="text-[15px] font-semibold text-slate-900 capitalize ml-2">{monthLabel}</h3>
        </div>
        <Legend />
      </div>

      {/* Weekdays header */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-3 py-2 text-[11px] uppercase tracking-wide font-medium text-slate-400">
            {w}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div>
        {weeks.map((week, wi) => {
          const lanes = layoutWeek(week[0], week[6], events);
          const visibleLanes = lanes.slice(0, 4);
          const extraByCol: number[] = Array(7).fill(0);
          if (lanes.length > 4) {
            for (let li = 4; li < lanes.length; li++) {
              for (const it of lanes[li]) {
                for (let c = it.startCol; c < it.startCol + it.span; c++) {
                  extraByCol[c]++;
                }
              }
            }
          }
          return (
            <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0 min-h-[120px]">
              {/* Day cells */}
              {week.map((day, di) => {
                const iso = isoDay(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = iso === todayIso;
                const p = pressure[iso];
                return (
                  <div
                    key={di}
                    onDoubleClick={() => onCreate?.(iso)}
                    className={cn(
                      'relative px-2 pt-2 border-r border-slate-100 last:border-r-0',
                      !inMonth && 'bg-slate-50/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'text-[12px] font-medium tabular-nums',
                          inMonth ? 'text-slate-700' : 'text-slate-300',
                          isToday &&
                            'inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-600 text-white',
                        )}
                      >
                        {day.getDate()}
                      </span>
                      {p && p.pressure > 0 && <PressureDot level={p.level} value={p.pressure} />}
                    </div>
                  </div>
                );
              })}

              {/* Lanes overlay */}
              <div className="col-span-7 relative -mt-[88px] pointer-events-none">
                <div className="grid grid-cols-7 gap-y-1 px-1.5 pt-7">
                  {visibleLanes.map((lane, li) => (
                    <React.Fragment key={li}>
                      <LaneRow
                        lane={lane}
                        onSelect={(e) => onSelectEvent(e)}
                      />
                    </React.Fragment>
                  ))}
                </div>

                {/* +N more indicator */}
                {lanes.length > 4 && (
                  <div className="grid grid-cols-7 px-1.5 mt-1">
                    {extraByCol.map((n, ci) => (
                      <div key={ci} className="px-1">
                        {n > 0 && (
                          <span className="pointer-events-auto inline-block text-[10.5px] font-medium text-violet-700 bg-violet-50 ring-1 ring-violet-100 rounded px-1.5 py-0.5">
                            +{n} évén.
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function LaneRow({
  lane,
  onSelect,
}: {
  lane: { event: RMSMarketEvent; startCol: number; span: number; truncL: boolean; truncR: boolean }[];
  onSelect: (e: RMSMarketEvent) => void;
}) {
  // construit une grille 7 cols avec gaps, en plaçant chaque event
  const cells: React.ReactNode[] = [];
  let col = 0;
  const sorted = [...lane].sort((a, b) => a.startCol - b.startCol);
  for (const item of sorted) {
    if (item.startCol > col) {
      for (let c = col; c < item.startCol; c++) {
        cells.push(<div key={`g${c}`} className="h-7" />);
      }
    }
    cells.push(
      <div
        key={`e${item.event.id}-${item.startCol}`}
        className="pointer-events-auto"
        style={{ gridColumn: `span ${item.span} / span ${item.span}` }}
      >
        <EventBar
          event={item.event}
          span={item.span}
          truncatedLeft={item.truncL}
          truncatedRight={item.truncR}
          onClick={() => onSelect(item.event)}
        />
      </div>,
    );
    col = item.startCol + item.span;
  }
  if (col < 7) {
    for (let c = col; c < 7; c++) cells.push(<div key={`gend${c}`} className="h-7" />);
  }
  return <div className="contents">{cells}</div>;
}

function PressureDot({ level, value }: { level: EventImpactLevel; value: number }) {
  const c = impactColor(level);
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5 ring-1', c.soft, c.ring, c.text)}
      title={`Pression marché ${value}% (${IMPACT_LABELS[level]})`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', c.bar)} />
      {value}
    </span>
  );
}

function Legend() {
  return (
    <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500">
      {(['critical', 'high', 'medium', 'low', 'very_low'] as EventImpactLevel[]).map((l) => {
        const c = impactColor(l);
        return (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', c.bar)} />
            {IMPACT_LABELS[l]}
          </span>
        );
      })}
    </div>
  );
}
