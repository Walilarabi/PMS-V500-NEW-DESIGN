/**
 * FLOWTYM RMS — Vue Liste du module Événements
 *
 * Tableau premium aéré : icône + nom, type, ville/zone, dates, durée, impact,
 * pickup, compression, influence prix, source, statut, sync RMS, actions.
 */
import React, { useMemo, useState } from 'react';
import { ChevronRight, Copy, Edit3, MoreVertical, Pause, Play, Trash2, Link2, Plug } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import type { RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS } from '@/src/types/events';
import { ImpactBadge } from './components/ImpactBadge';
import { CATEGORY_ICON } from './components/CategoryIcon';
import { daysBetween, formatDateRange } from '@/src/services/event-impact.engine';

interface EventsListProps {
  onSelect: (ev: RMSMarketEvent) => void;
}

const PAGE_SIZE = 10;

export const EventsList: React.FC<EventsListProps> = ({ onSelect }) => {
  const { getFilteredEvents, deleteEvent, duplicateEvent, setStatus } = useEventsStore();
  const events = getFilteredEvents();
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<string | null>(null);

  const pageEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [events, page]);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50/60 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Événement</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Ville / Zone</th>
              <th className="px-3 py-3 font-medium">Dates</th>
              <th className="px-3 py-3 font-medium">Durée</th>
              <th className="px-3 py-3 font-medium">Impact</th>
              <th className="px-3 py-3 font-medium text-right">Pickup</th>
              <th className="px-3 py-3 font-medium text-right">Compression</th>
              <th className="px-3 py-3 font-medium text-right">Influence prix</th>
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">Statut</th>
              <th className="px-3 py-3 font-medium">Sync RMS</th>
              <th className="px-3 py-3 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {pageEvents.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-slate-400 text-sm">
                  Aucun événement ne correspond aux filtres en cours.
                </td>
              </tr>
            )}
            {pageEvents.map((e) => {
              const Icon = CATEGORY_ICON[e.category];
              return (
                <tr
                  key={e.id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 cursor-pointer group"
                  onClick={() => onSelect(e)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{e.name}</div>
                        {e.venue && <div className="text-[11px] text-slate-500 truncate">{e.venue}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                      {CATEGORY_LABELS[e.category]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <div className="font-medium">{e.city}</div>
                    {e.zone && <div className="text-[11px] text-slate-500">{e.zone}</div>}
                  </td>
                  <td className="px-3 py-3 text-slate-700 tabular-nums">{formatDateRange(e.startDate, e.endDate)}</td>
                  <td className="px-3 py-3 text-slate-700 tabular-nums">
                    {daysBetween(e.startDate, e.endDate)} j
                  </td>
                  <td className="px-3 py-3">
                    <ImpactBadge level={e.impact.level} />
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-emerald-600 tabular-nums">
                    +{e.impact.pickup}%
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{e.impact.compression}</td>
                  <td className="px-3 py-3 text-right font-semibold text-violet-700 tabular-nums">
                    +{e.influencePrice}%
                  </td>
                  <td className="px-3 py-3 text-slate-600 text-[12px]">{e.primarySource}</td>
                  <td className="px-3 py-3">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-3 py-3">
                    {e.rmsSynced ? (
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100 rounded-full px-2 py-0.5">
                        <Plug className="w-3 h-3" />
                        Synchronisé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-600 bg-slate-50 ring-1 ring-slate-100 rounded-full px-2 py-0.5">
                        <Link2 className="w-3 h-3" />
                        En attente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right relative">
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setMenu(menu === e.id ? null : e.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-500" />
                    </button>
                    {menu === e.id && (
                      <div
                        className="absolute right-2 top-10 z-20 w-48 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg py-1 text-[13px]"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <button
                          onClick={() => { onSelect(e); setMenu(null); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Modifier
                        </button>
                        <button
                          onClick={() => { duplicateEvent(e.id); setMenu(null); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-500" /> Dupliquer
                        </button>
                        <button
                          onClick={() => {
                            setStatus(e.id, e.status === 'active' ? 'planned' : 'active');
                            setMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                        >
                          {e.status === 'active' ? (
                            <><Pause className="w-3.5 h-3.5 text-slate-500" /> Désactiver</>
                          ) : (
                            <><Play className="w-3.5 h-3.5 text-slate-500" /> Activer</>
                          )}
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => { deleteEvent(e.id); setMenu(null); }}
                          className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-[12px] text-slate-500">
        <span>
          {events.length === 0
            ? '0 événement'
            : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, events.length)} sur ${events.length} événements`}
        </span>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={cn(
                'w-7 h-7 rounded-md text-[12px] font-medium',
                page === i + 1
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            className="ml-1 p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const STATUS_STYLES: Record<RMSMarketEvent['status'], { dot: string; pill: string; text: string; label: string }> = {
  active: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700', label: 'Actif' },
  planned: { dot: 'bg-sky-400', pill: 'bg-sky-50 ring-sky-100', text: 'text-sky-700', label: 'Planifié' },
  archived: { dot: 'bg-slate-300', pill: 'bg-slate-50 ring-slate-100', text: 'text-slate-600', label: 'Archivé' },
  cancelled: { dot: 'bg-rose-400', pill: 'bg-rose-50 ring-rose-100', text: 'text-rose-700', label: 'Annulé' },
};

function StatusPill({ status }: { status: RMSMarketEvent['status'] }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11.5px] font-medium', s.pill, s.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}
