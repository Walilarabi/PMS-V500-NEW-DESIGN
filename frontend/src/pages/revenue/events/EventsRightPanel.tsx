/**
 * FLOWTYM Events — Panneau droit contextuel
 *
 * Trois widgets compacts :
 *   1. Vacances scolaires : sélecteur pays + mini-calendrier mensuel
 *      avec barres de zones (Zone A / B / C).
 *   2. Heatmap des vacances par pays — densité mensuelle des congés
 *      scolaires sur l'année active.
 *   3. Recherche d'événements — champ ville/événement + bouton qui ouvre
 *      la recherche live (Ticketmaster + OpenAgenda).
 *
 * Les données vacances proviennent d'OpenHolidaysAPI (libre, sans clé).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Radio, Search } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  fetchOpenHolidaysMulti,
  fetchOpenHolidaysSchool,
  HOLIDAY_COUNTRIES,
  type CountryHoliday,
  type HolidayCountry,
} from '@/src/services/event-live-search.service';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
  'FR-A': 'bg-emerald-500',   'A': 'bg-emerald-500',
  'FR-B': 'bg-sky-500',       'B': 'bg-sky-500',
  'FR-C': 'bg-violet-500',    'C': 'bg-violet-500',
  'Corse': 'bg-amber-500',
};

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTHS_FR_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR         = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

const HEATMAP_COUNTRIES = HOLIDAY_COUNTRIES.slice(0, 6); // 6 pays pour la heatmap

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number): number {
  // Lundi = 0, Dimanche = 6
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

function overlaps(holiday: CountryHoliday, year: number, month: number, day: number): boolean {
  const cell = new Date(year, month, day).toISOString().substring(0, 10);
  return cell >= holiday.startDate && cell <= holiday.endDate;
}

function zoneFor(h: CountryHoliday): string {
  if (!h.region) return 'def';
  return h.region.replace(/^FR-/, '').replace(/^DE-/, '').slice(0, 6);
}

// ─── Widget 1 : Vacances scolaires (mini-calendrier mois) ─────────────────────

function HolidaysCalendarWidget({ year }: { year: number }) {
  const [country, setCountry] = useState<HolidayCountry>(HOLIDAY_COUNTRIES[0]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [holidays, setHolidays] = useState<CountryHoliday[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const baseYear  = year;
  const baseMonth = today.getFullYear() === year ? today.getMonth() : 4; // mai par défaut sur années sans "now"
  const currentMonth = (baseMonth + monthOffset + 12 * 12) % 12;
  const currentYear  = baseYear + Math.floor((baseMonth + monthOffset) / 12);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOpenHolidaysSchool(country, currentYear)
      .then((rows) => { if (!cancelled) setHolidays(rows); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [country, currentYear]);

  const monthHolidays = useMemo(
    () => (holidays ?? []).filter((h) => {
      const s = new Date(h.startDate), e = new Date(h.endDate);
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd   = new Date(currentYear, currentMonth + 1, 0);
      return s <= monthEnd && e >= monthStart;
    }),
    [holidays, currentYear, currentMonth],
  );

  const nDays = daysInMonth(currentYear, currentMonth);
  const offset = firstDayOfWeek(currentYear, currentMonth);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <h3 className="text-[12.5px] font-semibold text-slate-900">Vacances scolaires</h3>
        </div>
      </div>

      {/* Country + Month nav */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <select
          value={country.code}
          onChange={(e) => {
            const c = HOLIDAY_COUNTRIES.find((h) => h.code === e.target.value);
            if (c) { setCountry(c); setMonthOffset(0); }
          }}
          className="text-[12px] font-medium text-slate-800 rounded-lg ring-1 ring-slate-200 bg-white px-2 py-1 outline-none focus:ring-violet-400"
          aria-label="Choisir le pays"
        >
          {HOLIDAY_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthOffset((v) => v - 1)}
            className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[12px] font-semibold text-slate-700 tabular-nums min-w-[80px] text-center">
            {MONTHS_FR_LONG[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => setMonthOffset((v) => v + 1)}
            className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-[9px] font-bold text-slate-400 text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`pad-${i}`} className="h-7" />
          ))}
          {Array.from({ length: nDays }).map((_, i) => {
            const day = i + 1;
            const matched = monthHolidays.filter((h) => overlaps(h, currentYear, currentMonth, day));
            const isToday =
              currentYear === today.getFullYear() &&
              currentMonth === today.getMonth() &&
              day === today.getDate();
            return (
              <div
                key={day}
                className={cn(
                  'h-7 rounded text-[10.5px] font-medium flex items-center justify-center relative',
                  matched.length > 0 ? 'text-slate-900' : 'text-slate-600',
                  isToday && 'ring-1 ring-violet-500',
                )}
                title={matched.map((h) => `${h.name}${h.region ? ' · ' + h.region : ''}`).join('\n')}
              >
                <span className="relative z-10">{day}</span>
                {matched.length > 0 && (
                  <div className="absolute inset-x-0.5 bottom-0.5 flex gap-0.5 h-1">
                    {matched.slice(0, 3).map((h, idx) => {
                      const z = zoneFor(h);
                      const color = ZONE_COLORS[h.region ?? z] ?? ZONE_COLORS[z] ?? 'bg-rose-400';
                      return <div key={idx} className={cn('flex-1 rounded-sm opacity-80', color)} />;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Status */}
        {loading && <div className="text-[10px] text-slate-400 text-center mt-2">Chargement…</div>}
        {error && <div className="text-[10px] text-rose-500 text-center mt-2">{error}</div>}
        {!loading && !error && monthHolidays.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5 px-1">
            {monthHolidays.slice(0, 6).map((h, idx) => {
              const z = zoneFor(h);
              const color = ZONE_COLORS[h.region ?? z] ?? ZONE_COLORS[z] ?? 'bg-rose-400';
              return (
                <span key={idx} className="inline-flex items-center gap-1 text-[9.5px] text-slate-600">
                  <span className={cn('w-1.5 h-1.5 rounded-full', color)} />
                  <span className="truncate max-w-[110px]">{h.name}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Widget 2 : Heatmap vacances par pays ─────────────────────────────────────

function HolidaysHeatmapWidget({ year }: { year: number }) {
  const [data, setData] = useState<Record<string, CountryHoliday[]> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOpenHolidaysMulti(HEATMAP_COUNTRIES, year)
      .then((r) => { if (!cancelled) setData(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  // Pour chaque pays × mois → nombre de jours de vacances scolaires
  const matrix = useMemo(() => {
    if (!data) return {};
    const out: Record<string, number[]> = {};
    for (const c of HEATMAP_COUNTRIES) {
      const rows = data[c.code] ?? [];
      const months = Array(12).fill(0);
      for (const h of rows) {
        const start = new Date(h.startDate);
        const end   = new Date(h.endDate);
        const day = new Date(start);
        while (day <= end) {
          if (day.getFullYear() === year) months[day.getMonth()] += 1;
          day.setDate(day.getDate() + 1);
        }
      }
      out[c.code] = months;
    }
    return out;
  }, [data, year]);

  const maxDays = useMemo(() => {
    let m = 1;
    for (const code of Object.keys(matrix)) {
      for (const v of matrix[code]) if (v > m) m = v;
    }
    return m;
  }, [matrix]);

  function intensity(days: number): string {
    if (days === 0) return 'bg-slate-50';
    const ratio = days / maxDays;
    if (ratio > 0.75) return 'bg-violet-600';
    if (ratio > 0.5)  return 'bg-violet-400';
    if (ratio > 0.25) return 'bg-violet-200';
    return 'bg-violet-100';
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100">
        <h3 className="text-[12.5px] font-semibold text-slate-900">Heatmap des vacances (par pays)</h3>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9.5px] text-slate-400">Faible</span>
          <div className="flex gap-0.5 mx-2">
            {['bg-slate-50', 'bg-violet-100', 'bg-violet-200', 'bg-violet-400', 'bg-violet-600'].map((c) => (
              <div key={c} className={cn('w-3 h-2 rounded-sm', c)} />
            ))}
          </div>
          <span className="text-[9.5px] text-slate-400">Élevé</span>
        </div>
      </div>

      <div className="px-3 py-3">
        {/* Months header */}
        <div className="grid grid-cols-[64px_repeat(12,1fr)] gap-0.5 mb-1">
          <div />
          {MONTHS_FR_SHORT.map((m) => (
            <div key={m} className="text-[8.5px] font-bold text-slate-400 text-center">{m}</div>
          ))}
        </div>
        {/* Country rows */}
        {HEATMAP_COUNTRIES.map((c) => (
          <div key={c.code} className="grid grid-cols-[64px_repeat(12,1fr)] gap-0.5 items-center mb-0.5">
            <div className="text-[10px] font-medium text-slate-700 flex items-center gap-1 truncate">
              <span>{c.flag}</span>
              <span className="truncate">{c.name}</span>
            </div>
            {(matrix[c.code] ?? Array(12).fill(0)).map((days, idx) => (
              <div
                key={idx}
                className={cn('h-5 rounded-sm transition-colors', intensity(days))}
                title={`${c.name} · ${MONTHS_FR_LONG[idx]} : ${days} jour${days !== 1 ? 's' : ''}`}
              />
            ))}
          </div>
        ))}
        {loading && <div className="text-[10px] text-slate-400 text-center mt-2">Chargement…</div>}
      </div>
    </div>
  );
}

// ─── Widget 3 : Recherche d'événements ────────────────────────────────────────

function EventSearchWidget({ onLaunch }: { onLaunch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-violet-600" />
          Recherche d'événements
        </h3>
        <span className="text-[9px] uppercase font-bold tracking-wide bg-gradient-to-r from-violet-600 to-indigo-500 text-white px-1.5 py-px rounded">
          Nouveau
        </span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onLaunch(query)}
            placeholder="Rechercher une ville, un événement…"
            className="w-full pl-8 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-400 outline-none text-[12px]"
          />
        </div>
        <div className="text-[10.5px] text-slate-500 leading-relaxed">
          Recherche intelligente multi-sources
        </div>
        <button
          onClick={() => onLaunch(query)}
          className="w-full px-3 py-2 rounded-lg bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 shadow-sm shadow-violet-600/20 flex items-center justify-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5" />
          Lancer la recherche
        </button>
      </div>
    </div>
  );
}

// ─── Composition ──────────────────────────────────────────────────────────────

interface EventsRightPanelProps {
  year: number;
  onLaunchSearch: (query: string) => void;
}

export const EventsRightPanel: React.FC<EventsRightPanelProps> = ({ year, onLaunchSearch }) => {
  return (
    <aside className="w-[320px] shrink-0 space-y-3" aria-label="Panneau contextuel événements">
      <HolidaysCalendarWidget year={year} />
      <HolidaysHeatmapWidget   year={year} />
      <EventSearchWidget       onLaunch={onLaunchSearch} />
    </aside>
  );
};
