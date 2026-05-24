/**
 * FLOWTYM RMS — Onglet "Historique des événements".
 *
 * Permet d'analyser les événements passés et de saisir manuellement
 * l'impact réel observé (TO, ADR, CA) afin de calibrer les futures
 * prévisions.
 *
 * Colonnes :
 *   nom · type · lieu · arrivée · départ · fréquence · visiteurs ·
 *   impact réel TO · impact réel ADR · impact réel CA · source · commentaire
 *
 * Les colonnes d'impact réel + commentaire sont éditables en place
 * (saisie post-événement par le Revenue Manager).
 */
import React, { useMemo, useState } from 'react';
import { CalendarRange, Save, Pencil, X, MapPin, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import type { RMSMarketEvent, EventFrequency, RealImpact } from '@/src/types/events';
import { CATEGORY_LABELS } from '@/src/types/events';
import { CATEGORY_ICON } from './components/CategoryIcon';

const FREQUENCY_LABELS: Record<EventFrequency, string> = {
  ponctuel: 'Ponctuel',
  semestriel: 'Semestriel',
  annuel: 'Annuel',
  biannuel: 'Biannuel',
};

const FREQ_TONES: Record<EventFrequency, string> = {
  ponctuel: 'bg-slate-100 text-slate-700',
  semestriel: 'bg-sky-50 text-sky-700 ring-sky-100',
  annuel: 'bg-violet-50 text-violet-700 ring-violet-100',
  biannuel: 'bg-amber-50 text-amber-700 ring-amber-100',
};

function formatFr(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const EventsHistory: React.FC = () => {
  const { events, updateEvent } = useEventsStore();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear - 1);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    frequency: EventFrequency;
    estimatedVisitors: string;
    realOccupancy: string;
    realAdr: string;
    realRevenue: string;
    internalComment: string;
  }>({
    frequency: 'ponctuel',
    estimatedVisitors: '',
    realOccupancy: '',
    realAdr: '',
    realRevenue: '',
    internalComment: '',
  });

  // Liste d'années disponibles (depuis l'événement le plus ancien jusqu'à l'année courante)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const e of events) {
      const y = parseInt(e.startDate.slice(0, 4), 10);
      if (!Number.isNaN(y)) years.add(y);
    }
    years.add(currentYear);
    years.add(currentYear - 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [events, currentYear]);

  // Filtre par année + tri chronologique inversé (le plus récent en haut)
  const filtered = useMemo(() => {
    return events
      .filter((e) => e.startDate.startsWith(String(year)))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [events, year]);

  // Statistiques globales de l'année
  const yearStats = useMemo(() => {
    const withRealImpact = filtered.filter((e) => e.realImpact?.occupancy != null || e.realImpact?.adr != null || e.realImpact?.revenue != null);
    const avgRealAdr = withRealImpact.length === 0
      ? 0
      : withRealImpact.reduce((s, e) => s + (e.realImpact?.adr ?? 0), 0) / withRealImpact.length;
    const avgRealOcc = withRealImpact.length === 0
      ? 0
      : withRealImpact.reduce((s, e) => s + (e.realImpact?.occupancy ?? 0), 0) / withRealImpact.length;
    const totalVisitors = filtered.reduce((s, e) => s + (e.estimatedVisitors ?? 0), 0);
    return {
      count: filtered.length,
      withRealImpact: withRealImpact.length,
      avgRealAdr: Math.round(avgRealAdr * 10) / 10,
      avgRealOcc: Math.round(avgRealOcc * 10) / 10,
      totalVisitors,
    };
  }, [filtered]);

  function startEdit(ev: RMSMarketEvent) {
    setEditing(ev.id);
    setDraft({
      frequency: ev.frequency ?? 'ponctuel',
      estimatedVisitors: ev.estimatedVisitors?.toString() ?? '',
      realOccupancy: ev.realImpact?.occupancy?.toString() ?? '',
      realAdr: ev.realImpact?.adr?.toString() ?? '',
      realRevenue: ev.realImpact?.revenue?.toString() ?? '',
      internalComment: ev.internalComment ?? '',
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  function saveEdit(id: string) {
    const realImpact: RealImpact = {
      occupancy: draft.realOccupancy === '' ? undefined : parseFloat(draft.realOccupancy),
      adr: draft.realAdr === '' ? undefined : parseFloat(draft.realAdr),
      revenue: draft.realRevenue === '' ? undefined : parseFloat(draft.realRevenue),
      recordedAt: new Date().toISOString(),
    };
    updateEvent(id, {
      frequency: draft.frequency,
      estimatedVisitors: draft.estimatedVisitors === '' ? undefined : parseInt(draft.estimatedVisitors, 10),
      realImpact,
      internalComment: draft.internalComment.trim() || undefined,
    });
    setEditing(null);
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
      {/* Header — sélecteur année + stats */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-violet-600" />
          <h3 className="text-[14px] font-semibold text-slate-900">Historique des événements</h3>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-[11.5px] uppercase tracking-wide text-slate-400 font-medium">Année</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium focus:ring-violet-500 outline-none"
          >
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs annuels */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/40">
        <StatBlock label="Événements" value={String(yearStats.count)} />
        <StatBlock label="Avec impact mesuré" value={`${yearStats.withRealImpact} / ${yearStats.count}`} tone="violet" />
        <StatBlock label="ADR réel moyen" value={`${yearStats.avgRealAdr >= 0 ? '+' : ''}${yearStats.avgRealAdr}%`} tone="emerald" />
        <StatBlock label="TO réel moyen" value={`${yearStats.avgRealOcc >= 0 ? '+' : ''}${yearStats.avgRealOcc}%`} tone="emerald" />
        <StatBlock label="Visiteurs estimés" value={yearStats.totalVisitors.toLocaleString('fr-FR')} icon={Users} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400 bg-slate-50/60 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Événement</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Lieu</th>
              <th className="px-3 py-3 font-medium">Dates</th>
              <th className="px-3 py-3 font-medium">Fréquence</th>
              <th className="px-3 py-3 font-medium text-right">Visiteurs</th>
              <th className="px-3 py-3 font-medium text-right">TO réel</th>
              <th className="px-3 py-3 font-medium text-right">ADR réel</th>
              <th className="px-3 py-3 font-medium text-right">CA réel</th>
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">Commentaire</th>
              <th className="px-3 py-3 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-16 text-center text-slate-400 text-sm">
                  <CalendarRange className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Aucun événement enregistré pour {year}.
                </td>
              </tr>
            )}
            {filtered.map((e) => {
              const Icon = CATEGORY_ICON[e.category];
              const isEditing = editing === e.id;
              const freq = e.frequency ?? 'ponctuel';
              return (
                <tr key={e.id} className={cn('border-b border-slate-100 last:border-b-0', isEditing ? 'bg-violet-50/40' : 'hover:bg-slate-50/60')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{e.name}</div>
                        {e.venue && <div className="text-[10.5px] text-slate-500 truncate">{e.venue}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-700">
                      {CATEGORY_LABELS[e.category]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <div className="flex items-center gap-1 min-w-0">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{e.city}{e.zone ? ` · ${e.zone}` : ''}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700 tabular-nums whitespace-nowrap">
                    Du {formatFr(e.startDate)} au {formatFr(e.endDate)}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <select
                        value={draft.frequency}
                        onChange={(ev) => setDraft({ ...draft, frequency: ev.target.value as EventFrequency })}
                        className="w-full px-2 py-1 rounded-md ring-1 ring-slate-200 text-[12px] bg-white focus:ring-violet-500 outline-none"
                      >
                        {(Object.keys(FREQUENCY_LABELS) as EventFrequency[]).map((f) =>
                          <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>,
                        )}
                      </select>
                    ) : (
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium ring-1 ring-inset', FREQ_TONES[freq])}>
                        {FREQUENCY_LABELS[freq]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                    {isEditing ? (
                      <input
                        type="number"
                        value={draft.estimatedVisitors}
                        onChange={(ev) => setDraft({ ...draft, estimatedVisitors: ev.target.value })}
                        placeholder="0"
                        className="w-20 px-2 py-1 rounded-md ring-1 ring-slate-200 text-[12px] text-right bg-white focus:ring-violet-500 outline-none"
                      />
                    ) : (
                      e.estimatedVisitors != null ? e.estimatedVisitors.toLocaleString('fr-FR') : '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={draft.realOccupancy}
                        onChange={(ev) => setDraft({ ...draft, realOccupancy: ev.target.value })}
                        placeholder="%"
                        className="w-16 px-2 py-1 rounded-md ring-1 ring-slate-200 text-[12px] text-right bg-white focus:ring-violet-500 outline-none"
                      />
                    ) : (
                      <ImpactDelta value={e.realImpact?.occupancy} suffix="%" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={draft.realAdr}
                        onChange={(ev) => setDraft({ ...draft, realAdr: ev.target.value })}
                        placeholder="%"
                        className="w-16 px-2 py-1 rounded-md ring-1 ring-slate-200 text-[12px] text-right bg-white focus:ring-violet-500 outline-none"
                      />
                    ) : (
                      <ImpactDelta value={e.realImpact?.adr} suffix="%" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={draft.realRevenue}
                        onChange={(ev) => setDraft({ ...draft, realRevenue: ev.target.value })}
                        placeholder="%"
                        className="w-16 px-2 py-1 rounded-md ring-1 ring-slate-200 text-[12px] text-right bg-white focus:ring-violet-500 outline-none"
                      />
                    ) : (
                      <ImpactDelta value={e.realImpact?.revenue} suffix="%" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600 text-[11.5px] truncate max-w-[120px]">{e.primarySource}</td>
                  <td className="px-3 py-3 text-slate-600 text-[11.5px]">
                    {isEditing ? (
                      <textarea
                        value={draft.internalComment}
                        onChange={(ev) => setDraft({ ...draft, internalComment: ev.target.value })}
                        placeholder="Note interne…"
                        rows={2}
                        className="w-full min-w-[160px] px-2 py-1 rounded-md ring-1 ring-slate-200 text-[12px] bg-white focus:ring-violet-500 outline-none resize-none"
                      />
                    ) : (
                      <div className="max-w-[200px] line-clamp-2 italic text-slate-500">
                        {e.internalComment || '—'}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => saveEdit(e.id)}
                          className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="Enregistrer"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                          title="Annuler"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(e)}
                        className="p-1.5 rounded-md hover:bg-violet-50 text-violet-600"
                        title="Saisir l'impact réel"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 text-[11.5px] text-slate-500 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
        Les impacts réels saisis ici alimentent l'apprentissage IA — les prochaines prévisions seront calibrées en fonction des historiques observés.
      </div>
    </div>
  );
};

function ImpactDelta({ value, suffix = '' }: { value?: number; suffix?: string }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  const tone = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-rose-600' : 'text-slate-500';
  return (
    <span className={cn('font-semibold', tone)}>
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  );
}

function StatBlock({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: 'emerald' | 'violet';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const color = tone === 'emerald' ? 'text-emerald-700' : tone === 'violet' ? 'text-violet-700' : 'text-slate-900';
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={cn('text-[15px] font-semibold tabular-nums mt-0.5', color)}>{value}</div>
    </div>
  );
}
