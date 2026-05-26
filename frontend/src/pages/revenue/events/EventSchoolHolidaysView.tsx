/**
 * FLOWTYM Events — Vacances scolaires multi-pays
 *
 * • France   → API officielle data.education.gouv.fr (zones A/B/C/Corse)
 * • Autres   → OpenHolidaysAPI (BE, CH, DE, ES, GB, IT, LU, NL, PT, AT)
 *
 * Toutes les données sont ouvertes — aucune clé API requise.
 * Couvre 2024 → 2027 et expose un sélecteur année par défaut.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Backpack, Calendar, CheckCircle2, Filter, Loader2, MapPin, Plus,
  RotateCcw, Sparkles, TrendingUp,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  fetchSchoolHolidays,
  fetchOpenHolidaysSchool,
  normalizeSchoolHoliday,
  schoolHolidayImpact,
  HOLIDAY_COUNTRIES,
  type SchoolHolidayRecord,
  type HolidayCountry,
  type CountryHoliday,
} from '@/src/services/event-live-search.service';
import { useEventsStore } from '@/src/store/eventsStore';
import type { EventImpactLevel, RMSMarketEvent } from '@/src/types/events';

// Convertit un CountryHoliday (OpenHolidaysAPI) vers le format unifié interne.
function toUnifiedRecord(h: CountryHoliday, year: number): SchoolHolidayRecord {
  return {
    description:   h.name,
    startDate:     h.startDate,
    endDate:       h.endDate,
    zones:         h.region ?? (h.nationwide ? 'National' : ''),
    location:      h.countryCode,
    anneeScolaire: `${year}-${year + 1}`,
    population:    'Élèves',
  };
}

// Normalise vers un RMSMarketEvent avec le pays correct
function normalizeForeignHoliday(h: CountryHoliday, country: HolidayCountry): RMSMarketEvent {
  const level = schoolHolidayImpact(h.name);
  const now   = new Date().toISOString();
  const slug  = (h.name + '_' + (h.region ?? '')).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  return {
    id:             `vs_${country.code}_${slug}_${h.startDate}`,
    name:           h.region ? `${h.name} — ${h.region}` : h.name,
    category:       'culture',
    status:         'active',
    city:           country.name,
    country:        country.code,
    startDate:      h.startDate,
    endDate:        h.endDate || h.startDate,
    impact:         IMPACT_FROM_LEVEL[level],
    influencePrice: INFLUENCE_FROM_LEVEL[level],
    description:    `Vacances scolaires ${country.name} · ${h.region ?? (h.nationwide ? 'National' : '')}`.trim(),
    sources:        ['school_holidays'],
    primarySource:  `OpenHolidaysAPI · ${country.code}`,
    rmsSynced:      false,
    history:        [{ at: now, action: 'imported', source: 'openholidaysapi.org' }],
    createdAt:      now,
    updatedAt:      now,
  };
}

const IMPACT_FROM_LEVEL: Record<EventImpactLevel, RMSMarketEvent['impact']> = {
  hyper_compression: { demand: 45, adr: 38, occupancy: 25, pickup: 35, revpar: 44, compression: 95, confidence: 88, level: 'hyper_compression' },
  critical:          { demand: 38, adr: 32, occupancy: 20, pickup: 30, revpar: 38, compression: 88, confidence: 85, level: 'critical' },
  high:              { demand: 26, adr: 22, occupancy: 14, pickup: 22, revpar: 24, compression: 72, confidence: 82, level: 'high' },
  medium:            { demand: 14, adr: 11, occupancy: 8,  pickup: 12, revpar: 13, compression: 50, confidence: 78, level: 'medium' },
  low:               { demand: 6,  adr: 4,  occupancy: 3,  pickup: 5,  revpar: 5,  compression: 22, confidence: 72, level: 'low' },
  very_low:          { demand: 3,  adr: 2,  occupancy: 1,  pickup: 2,  revpar: 2,  compression: 10, confidence: 65, level: 'very_low' },
};

const INFLUENCE_FROM_LEVEL: Record<EventImpactLevel, number> = {
  hyper_compression: 45, critical: 30, high: 18, medium: 10, low: 5, very_low: 0,
};

const IMPACT_STYLES: Record<EventImpactLevel, { label: string; cls: string }> = {
  hyper_compression: { label: 'Hyper',       cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
  critical:          { label: 'Critique',    cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  high:              { label: 'Fort',        cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  medium:            { label: 'Moyen',       cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  low:               { label: 'Faible',      cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  very_low:          { label: 'Très faible', cls: 'bg-slate-50 text-slate-500 ring-slate-200' },
};

const ZONES = ['Zone A', 'Zone B', 'Zone C', 'Corse'] as const;
const YEARS = [
  { year: 2024, label: '2024', hint: 'Passé',    tone: 'slate'   as const },
  { year: 2025, label: '2025', hint: 'Passé',    tone: 'slate'   as const },
  { year: 2026, label: '2026', hint: 'En cours', tone: 'violet'  as const },
  { year: 2027, label: '2027', hint: 'À venir',  tone: 'emerald' as const },
];

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dayCount(start: string, end: string): number {
  if (!start) return 1;
  const d0 = new Date(start);
  const d1 = new Date(end || start);
  return Math.max(1, Math.round((d1.getTime() - d0.getTime()) / 86_400_000) + 1);
}

interface EventSchoolHolidaysViewProps {
  onImportEvents: (events: RMSMarketEvent[]) => void;
}

export const EventSchoolHolidaysView: React.FC<EventSchoolHolidaysViewProps> = ({ onImportEvents }) => {
  const [year, setYear] = useState<number>(2026);
  const [country, setCountry] = useState<HolidayCountry>(HOLIDAY_COUNTRIES[0]);
  const [zone, setZone] = useState<string | undefined>(undefined);
  const [records, setRecords] = useState<Array<{ rec: SchoolHolidayRecord; ev: RMSMarketEvent }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedCount, setImportedCount] = useState(0);
  const { setPendingValidation } = useEventsStore();

  // Charge automatiquement au montage + à chaque changement de filtre.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (country.code === 'FR') {
          // Source officielle française avec zones
          const r = await fetchSchoolHolidays({ year, zone });
          if (!cancelled) {
            const items = r.map((rec) => ({ rec, ev: normalizeSchoolHoliday(rec) }));
            setRecords(items);
            setSelected(new Set(items.map((i) => keyFor(i.rec))));
          }
        } else {
          // OpenHolidaysAPI pour les autres pays
          const raw = await fetchOpenHolidaysSchool(country, year);
          if (!cancelled) {
            const items = raw
              .filter((h) => !zone || h.region === zone)
              .map((h) => ({
                rec: toUnifiedRecord(h, year),
                ev:  normalizeForeignHoliday(h, country),
              }));
            setRecords(items);
            setSelected(new Set(items.map((i) => keyFor(i.rec))));
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [country, year, zone]);

  const normalized = useMemo(
    () => (records ?? []).map((item) => ({ rec: item.rec, ev: item.ev, key: keyFor(item.rec) })),
    [records],
  );

  const stats = useMemo(() => {
    const total = normalized.length;
    const critical = normalized.filter(
      (n) => n.ev.impact.level === 'hyper_compression' || n.ev.impact.level === 'critical',
    ).length;
    const totalDays = normalized.reduce((acc, n) => acc + dayCount(n.ev.startDate, n.ev.endDate), 0);
    const zones = new Set(normalized.map((n) => n.rec.zones).filter(Boolean));
    return { total, critical, totalDays, zoneCount: zones.size };
  }, [normalized]);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) =>
      s.size === normalized.length ? new Set() : new Set(normalized.map((n) => n.key)),
    );
  }

  function handleImport() {
    const events = normalized.filter((n) => selected.has(n.key)).map((n) => n.ev);
    if (events.length === 0) return;
    setPendingValidation(events);
    setImportedCount(events.length);
    onImportEvents(events);
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <Backpack className="w-4 h-4 text-violet-600" />
            Vacances scolaires {country.flag} {country.name}
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {country.code === 'FR'
              ? 'Calendrier officiel · data.education.gouv.fr · zones académiques A / B / C / Corse'
              : 'Calendrier officiel · openholidaysapi.org · données ouvertes'}
          </p>
        </div>
        {importedCount > 0 && (
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {importedCount} période{importedCount > 1 ? 's' : ''} en attente de validation
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-900">Filtres</div>
            <div className="text-[11px] text-slate-500">Année et zone académique</div>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-wrap items-end gap-5">
          <div>
            <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1.5">
              Pays <span className="text-slate-300">·</span> <span className="text-slate-700 font-semibold">{country.flag} {country.name}</span>
            </label>
            <select
              value={country.code}
              onChange={(e) => {
                const c = HOLIDAY_COUNTRIES.find((h) => h.code === e.target.value);
                if (c) { setCountry(c); setZone(undefined); }
              }}
              className="px-3 py-1.5 text-[12.5px] font-medium rounded-lg ring-1 ring-slate-200 bg-white outline-none focus:ring-violet-400 min-w-[180px]"
            >
              {HOLIDAY_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1.5">
              Année <span className="text-slate-300">·</span> <span className="text-violet-600 font-semibold tabular-nums">{year}</span>
            </label>
            <div className="flex items-center gap-1">
              {YEARS.map((y) => {
                const active = year === y.year;
                return (
                  <button
                    key={y.year}
                    type="button"
                    onClick={() => setYear(y.year)}
                    title={y.hint}
                    className={cn(
                      'px-3 py-1.5 text-[12.5px] font-semibold rounded-lg ring-1 transition-all tabular-nums',
                      active
                        ? y.tone === 'violet'
                          ? 'bg-violet-600 text-white ring-violet-600 shadow-sm shadow-violet-600/20'
                          : y.tone === 'emerald'
                            ? 'bg-emerald-600 text-white ring-emerald-600 shadow-sm shadow-emerald-600/20'
                            : 'bg-slate-700 text-white ring-slate-700'
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {y.label}
                    <span className={cn('block text-[9px] font-normal mt-0.5', active ? 'text-white/80' : 'text-slate-400')}>
                      {y.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {country.code === 'FR' && (
            <div>
              <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1.5">
                Zone académique
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setZone(undefined)}
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-medium rounded-lg ring-1 transition-all',
                    !zone
                      ? 'bg-violet-50 text-violet-700 ring-violet-200'
                      : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  Toutes
                </button>
                {ZONES.map((z) => {
                  const active = zone === z;
                  return (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZone(z)}
                      className={cn(
                        'px-3 py-1.5 text-[12px] font-medium rounded-lg ring-1 transition-all',
                        active
                          ? 'bg-violet-50 text-violet-700 ring-violet-200'
                          : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
                      )}
                    >
                      {z}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-violet-700 bg-violet-50 ring-1 ring-violet-100 px-3 py-2 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Chargement…
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-4 flex items-start gap-2 text-[12px] bg-rose-50 ring-1 ring-rose-100 text-rose-700 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      {!loading && records && normalized.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Périodes" value={stats.total} tone="violet"  icon={Calendar} />
          <Kpi label="Impact fort+" value={stats.critical} tone="rose"   icon={TrendingUp} />
          <Kpi label="Jours cumulés" value={stats.totalDays} tone="emerald" icon={Sparkles} suffix="j" />
          <Kpi label="Zones distinctes" value={stats.zoneCount} tone="amber"   icon={MapPin} />
        </div>
      )}

      {/* Table */}
      {!loading && records !== null && (
        normalized.length === 0 ? (
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-12 flex flex-col items-center gap-2 text-center">
            <RotateCcw className="w-8 h-8 text-slate-300" />
            <div className="text-[13px] font-medium text-slate-500">Aucune période trouvée</div>
            <div className="text-[12px] text-slate-400">Essayez une autre année ou changez de zone.</div>
          </div>
        ) : (
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/40">
              <div className="text-[12.5px] text-slate-700">
                <span className="font-semibold text-slate-900 tabular-nums">{normalized.length}</span>{' '}
                période{normalized.length !== 1 ? 's' : ''} de vacances ·{' '}
                <span className="font-medium text-slate-600">{selectedCount} sélectionnée{selectedCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(new Set(normalized.map((n) => n.key)))}
                  className="text-[11.5px] text-violet-600 hover:text-violet-800 font-medium"
                >
                  Tout sélectionner
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-[11.5px] text-slate-500 hover:text-slate-800 font-medium"
                >
                  Aucun
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all',
                    selectedCount > 0
                      ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Importer {selectedCount > 0 ? `${selectedCount} ` : ''}période{selectedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>

            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 460px)' }}>
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 text-[10.5px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 font-medium w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === normalized.length && normalized.length > 0}
                        onChange={toggleAll}
                        className="w-3.5 h-3.5 accent-violet-600"
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-medium text-left">Période</th>
                    <th className="px-3 py-2.5 font-medium text-left">Zone</th>
                    <th className="px-3 py-2.5 font-medium text-left">Académie</th>
                    <th className="px-3 py-2.5 font-medium text-left">Début</th>
                    <th className="px-3 py-2.5 font-medium text-left">Fin</th>
                    <th className="px-3 py-2.5 font-medium text-left">Durée</th>
                    <th className="px-3 py-2.5 font-medium text-left">Impact RM</th>
                  </tr>
                </thead>
                <tbody>
                  {normalized.map(({ rec, ev, key }) => {
                    const imp = IMPACT_STYLES[ev.impact.level] ?? IMPACT_STYLES.very_low;
                    const days = dayCount(ev.startDate, ev.endDate);
                    const isSel = selected.has(key);
                    return (
                      <tr
                        key={key}
                        className={cn(
                          'border-t border-slate-100 transition-colors',
                          isSel ? 'hover:bg-slate-50' : 'opacity-50 hover:opacity-75 hover:bg-slate-50',
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggle(key)}
                            className="w-3.5 h-3.5 accent-violet-600"
                            aria-label={`Sélectionner ${rec.description}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">{rec.description}</div>
                          <div className="text-[10.5px] text-slate-400">{rec.anneeScolaire}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset bg-slate-50 text-slate-700 ring-slate-200">
                            {rec.zones || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{rec.location || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 tabular-nums">{fmtDate(rec.startDate)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 tabular-nums">{fmtDate(rec.endDate)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">{days}&nbsp;j</td>
                        <td className="px-3 py-2.5">
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset', imp.cls)}>
                            {imp.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <div className="text-[11px] text-slate-400 px-2">
        Impact RM auto-calculé : Été → hyper-compression · Noël → critique · Toussaint/Hiver/Printemps → fort.
        Données fournies par <span className="font-medium text-slate-500">data.education.gouv.fr</span> sous licence ouverte.
      </div>
    </div>
  );
};

function keyFor(r: SchoolHolidayRecord): string {
  return `${r.description}__${r.zones}__${r.location}__${r.startDate}`;
}

function Kpi({
  label, value, tone, icon: Icon, suffix,
}: {
  label: string;
  value: number;
  tone: 'violet' | 'rose' | 'emerald' | 'amber';
  icon: React.ComponentType<{ className?: string }>;
  suffix?: string;
}) {
  const tones = {
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-100' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-100' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-100' },
  }[tone];
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1', tones.bg, tones.text, tones.ring)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
        <div className="text-[18px] font-bold text-slate-900 tabular-nums leading-tight">
          {value}{suffix ?? ''}
        </div>
      </div>
    </div>
  );
}
