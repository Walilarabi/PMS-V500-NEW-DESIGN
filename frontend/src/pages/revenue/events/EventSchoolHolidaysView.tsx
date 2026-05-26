/**
 * FLOWTYM Events — Vacances scolaires multi-pays
 * Vue calendrier annuelle avec grille CSS, drapeaux réels et barres saisonnières.
 */
import React, { useMemo, useState } from 'react';
import {
  BarChart3, Calendar, CheckCircle2, Globe, MapPin, Plus, RefreshCw, School, Users,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import type { EventCategory, EventImpactLevel, RMSMarketEvent } from '@/src/types/events';

// ─── Types ────────────────────────────────────────────────────────────────────

type Season = 'hiver' | 'printemps' | 'ete' | 'automne';

interface HolidayPeriod {
  name: string;
  season: Season;
  startMonth: number; // 0 = Jan
  endMonth: number;   // 0 = Jan
  label: string;      // "14 fév. – 01 mar."
}

interface CountryRow {
  code: string;
  name: string;
  flagCode: string; // flagcdn.com code
  periods: HolidayPeriod[];
}

export interface EventSchoolHolidaysViewProps {
  onImportEvents: (events: RMSMarketEvent[]) => void;
  year?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

const SEASON_CFG: Record<Season, { bg: string; text: string; border: string; label: string; dot: string }> = {
  hiver:     { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    label: 'Hiver',     dot: 'bg-blue-400'    },
  printemps: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Printemps', dot: 'bg-emerald-400' },
  ete:       { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   label: 'Été',       dot: 'bg-amber-400'   },
  automne:   { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    label: 'Automne',   dot: 'bg-rose-400'    },
};

const YEARS = [2024, 2025, 2026, 2027];

const GRID_TEMPLATE = '180px repeat(12, 1fr)';

// ─── Holiday data (2026) ──────────────────────────────────────────────────────

const COUNTRY_DATA: CountryRow[] = [
  {
    code: 'FR', name: 'France', flagCode: 'fr',
    periods: [
      { name: 'Hiver',     season: 'hiver',     startMonth: 1,  endMonth: 2,  label: '14 fév. – 01 mar.' },
      { name: 'Printemps', season: 'printemps', startMonth: 3,  endMonth: 3,  label: '11 avr. – 26 avr.' },
      { name: 'Été',       season: 'ete',       startMonth: 6,  endMonth: 7,  label: '04 juil. – 31 aoû.' },
      { name: 'Toussaint', season: 'automne',   startMonth: 9,  endMonth: 10, label: '17 oct. – 02 nov.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '19 déc. – 04 jan.' },
    ],
  },
  {
    code: 'BE', name: 'Belgique', flagCode: 'be',
    periods: [
      { name: 'Carnaval',  season: 'hiver',     startMonth: 1,  endMonth: 1,  label: '23 fév. – 07 mar.' },
      { name: 'Pâques',    season: 'printemps', startMonth: 3,  endMonth: 3,  label: '06 avr. – 19 avr.' },
      { name: 'Été',       season: 'ete',       startMonth: 6,  endMonth: 7,  label: '04 juil. – 31 aoû.' },
      { name: 'Toussaint', season: 'automne',   startMonth: 10, endMonth: 10, label: '02 nov. – 08 nov.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '26 déc. – 04 jan.' },
    ],
  },
  {
    code: 'LU', name: 'Luxembourg', flagCode: 'lu',
    periods: [
      { name: 'Hiver',     season: 'hiver',     startMonth: 1,  endMonth: 1,  label: '16 fév. – 20 fév.' },
      { name: 'Pâques',    season: 'printemps', startMonth: 2,  endMonth: 3,  label: '30 mar. – 10 avr.' },
      { name: 'Été',       season: 'ete',       startMonth: 6,  endMonth: 8,  label: '15 juil. – 14 sep.' },
      { name: 'Automne',   season: 'automne',   startMonth: 9,  endMonth: 9,  label: '19 oct. – 23 oct.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '23 déc. – 02 jan.' },
    ],
  },
  {
    code: 'NL', name: 'Pays-Bas', flagCode: 'nl',
    periods: [
      { name: 'Hiver',     season: 'hiver',     startMonth: 1,  endMonth: 1,  label: '16 fév. – 20 fév.' },
      { name: 'Pâques',    season: 'printemps', startMonth: 2,  endMonth: 3,  label: '30 mar. – 06 avr.' },
      { name: 'Mai',       season: 'printemps', startMonth: 4,  endMonth: 4,  label: '25 avr. – 03 mai' },
      { name: 'Été',       season: 'ete',       startMonth: 6,  endMonth: 7,  label: '11 juil. – 22 aoû.' },
      { name: 'Automne',   season: 'automne',   startMonth: 9,  endMonth: 9,  label: '17 oct. – 25 oct.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '26 déc. – 04 jan.' },
    ],
  },
  {
    code: 'DE', name: 'Allemagne', flagCode: 'de',
    periods: [
      { name: 'Hiver',     season: 'hiver',     startMonth: 1,  endMonth: 1,  label: '23 fév. – 27 fév.' },
      { name: 'Pâques',    season: 'printemps', startMonth: 2,  endMonth: 3,  label: '30 mar. – 10 avr.' },
      { name: 'Été',       season: 'ete',       startMonth: 6,  endMonth: 8,  label: '30 juil. – 10 sep.' },
      { name: 'Automne',   season: 'automne',   startMonth: 9,  endMonth: 9,  label: '26 oct. – 30 oct.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '23 déc. – 06 jan.' },
    ],
  },
  {
    code: 'CH', name: 'Suisse', flagCode: 'ch',
    periods: [
      { name: 'Hiver',     season: 'hiver',     startMonth: 1,  endMonth: 1,  label: '09 fév. – 20 fév.' },
      { name: 'Printemps', season: 'printemps', startMonth: 2,  endMonth: 3,  label: '30 mar. – 17 avr.' },
      { name: 'Été',       season: 'ete',       startMonth: 6,  endMonth: 7,  label: '13 juil. – 14 aoû.' },
      { name: 'Automne',   season: 'automne',   startMonth: 9,  endMonth: 9,  label: '12 oct. – 23 oct.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '23 déc. – 08 jan.' },
    ],
  },
  {
    code: 'IT', name: 'Italie', flagCode: 'it',
    periods: [
      { name: 'Épiphanie', season: 'hiver',     startMonth: 0,  endMonth: 0,  label: '06 jan. – 07 jan.' },
      { name: 'Pâques',    season: 'printemps', startMonth: 3,  endMonth: 3,  label: '06 avr. – 10 avr.' },
      { name: 'Été',       season: 'ete',       startMonth: 5,  endMonth: 8,  label: '15 jun. – 15 sep.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '24 déc. – 06 jan.' },
    ],
  },
  {
    code: 'ES', name: 'Espagne', flagCode: 'es',
    periods: [
      { name: 'Hiver',     season: 'hiver',     startMonth: 0,  endMonth: 1,  label: '23 jan. – 01 fév.' },
      { name: 'S. Sainte', season: 'printemps', startMonth: 2,  endMonth: 3,  label: '20 mar. – 06 avr.' },
      { name: 'Été',       season: 'ete',       startMonth: 5,  endMonth: 8,  label: '22 jun. – 08 sep.' },
      { name: 'Automne',   season: 'automne',   startMonth: 9,  endMonth: 10, label: '30 oct. – 01 nov.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '23 déc. – 08 jan.' },
    ],
  },
  {
    code: 'GB', name: 'Royaume-Uni', flagCode: 'gb',
    periods: [
      { name: 'Half-term', season: 'hiver',     startMonth: 1,  endMonth: 1,  label: '16 fév. – 20 fév.' },
      { name: 'Pâques',    season: 'printemps', startMonth: 3,  endMonth: 3,  label: '01 avr. – 17 avr.' },
      { name: 'Half-term', season: 'printemps', startMonth: 4,  endMonth: 4,  label: '25 mai – 29 mai' },
      { name: 'Été',       season: 'ete',       startMonth: 6,  endMonth: 7,  label: '22 juil. – 01 sep.' },
      { name: 'Automne',   season: 'automne',   startMonth: 9,  endMonth: 9,  label: '26 oct. – 30 oct.' },
      { name: 'Noël',      season: 'hiver',     startMonth: 11, endMonth: 11, label: '23 déc. – 06 jan.' },
    ],
  },
  {
    code: 'US', name: 'États-Unis', flagCode: 'us',
    periods: [
      { name: 'Spring Break', season: 'printemps', startMonth: 2,  endMonth: 3,  label: '23 mar. – 03 avr.' },
      { name: 'Été',          season: 'ete',       startMonth: 5,  endMonth: 7,  label: '09 jun. – 25 aoû.' },
      { name: 'Thanksgiving', season: 'automne',   startMonth: 10, endMonth: 10, label: '26 nov. – 27 nov.' },
      { name: 'Noël',         season: 'hiver',     startMonth: 11, endMonth: 11, label: '23 déc. – 01 jan.' },
    ],
  },
  {
    code: 'JP', name: 'Japon', flagCode: 'jp',
    periods: [
      { name: 'Hiver',       season: 'hiver',     startMonth: 0,  endMonth: 0,  label: '01 jan. – 08 jan.' },
      { name: 'Golden Week', season: 'printemps', startMonth: 3,  endMonth: 4,  label: '28 avr. – 06 mai' },
      { name: 'Été',         season: 'ete',       startMonth: 6,  endMonth: 7,  label: '20 juil. – 31 aoû.' },
      { name: 'Noël',        season: 'hiver',     startMonth: 11, endMonth: 11, label: '28 déc. – 03 jan.' },
    ],
  },
  {
    code: 'SA', name: 'Arabie Saoudite', flagCode: 'sa',
    periods: [
      { name: 'Hiver',   season: 'hiver',     startMonth: 0, endMonth: 0, label: '09 jan. – 19 jan.' },
      { name: 'Aïd',    season: 'printemps', startMonth: 3, endMonth: 3, label: '05 avr. – 15 avr.' },
      { name: 'Été',    season: 'ete',       startMonth: 5, endMonth: 7, label: '08 jun. – 01 sep.' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const EventSchoolHolidaysView: React.FC<EventSchoolHolidaysViewProps> = ({
  onImportEvents,
  year: yearProp,
}) => {
  const [year, setYear] = useState(yearProp ?? 2026);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [importedCount, setImportedCount] = useState(0);
  const { setPendingValidation } = useEventsStore();

  React.useEffect(() => {
    if (yearProp && yearProp !== year) setYear(yearProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearProp]);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear  = today.getFullYear();

  const visibleCountries = useMemo(
    () => countryFilter === 'all'
      ? COUNTRY_DATA
      : COUNTRY_DATA.filter(c => c.code === countryFilter),
    [countryFilter],
  );

  const totalPeriods = useMemo(
    () => COUNTRY_DATA.reduce((acc, c) => acc + c.periods.length, 0),
    [],
  );

  const majDate = today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  function handleImport() {
    const now = new Date().toISOString();
    const events: RMSMarketEvent[] = visibleCountries.flatMap(c =>
      c.periods.map(p => ({
        id: `vs_${c.code}_${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${year}`,
        name: `${p.name} ${c.name} ${year}`,
        category: 'culture' as EventCategory,
        status: 'active' as const,
        city: c.name,
        country: c.code,
        startDate: `${year}-${String(p.startMonth + 1).padStart(2, '0')}-01`,
        endDate:   `${year}-${String(p.endMonth + 1).padStart(2, '0')}-28`,
        impact: {
          demand: 20, adr: 15, occupancy: 10, pickup: 15, revpar: 18,
          compression: 60, confidence: 80,
          level: 'high' as EventImpactLevel,
        },
        influencePrice: 15,
        description: `${p.name} · ${c.name} · ${p.label}`,
        sources: ['school_holidays'],
        primarySource: 'Flowtym School Calendar',
        rmsSynced: false,
        history: [{ at: now, action: 'imported', source: 'flowtym' }],
        createdAt: now,
        updatedAt: now,
      }))
    );
    setPendingValidation(events);
    setImportedCount(events.length);
    onImportEvents(events);
  }

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
            <School className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">
              Vacances scolaires {year} · 12 pays
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Calendrier officiel multi-pays — toutes saisons et destinations clés
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {YEARS.map(y => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={cn(
                  'px-3 py-1 text-[12px] font-semibold rounded-lg transition-all tabular-nums',
                  year === y
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
                )}
              >
                {y}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-700 transition-all shadow-sm shadow-violet-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Importer
          </button>
        </div>
      </div>

      {/* ── KPI Tiles ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiTile icon={Globe}     value="12 pays"         label="couverts"                tone="violet"  />
        <KpiTile icon={Calendar}  value="4 saisons"       label="périodes saisonnières"   tone="sky"     />
        <KpiTile icon={BarChart3} value={`${totalPeriods} périodes`} label="référencées" tone="emerald" />
        <KpiTile icon={Users}     value="92%"             label="population couverte"     tone="amber"   />
        <KpiTile icon={RefreshCw} value={`MAJ ${majDate}`} label="sources officielles"   tone="rose"    />
      </div>

      {/* ── Calendar panel ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] font-medium rounded-lg ring-1 ring-slate-200 bg-white outline-none focus:ring-violet-400 min-w-[170px]"
              >
                <option value="all">Tous les pays ({COUNTRY_DATA.length})</option>
                {COUNTRY_DATA.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Season legend */}
            <div className="flex items-center gap-4 flex-wrap">
              {(Object.entries(SEASON_CFG) as [Season, (typeof SEASON_CFG)[Season]][]).map(([season, cfg]) => (
                <div key={season} className="flex items-center gap-1.5">
                  <span className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
                  <span className="text-[12px] text-slate-600 font-medium">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {importedCount > 0 && (
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {importedCount} période{importedCount > 1 ? 's' : ''} en attente de validation
            </div>
          )}
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto">
          {/* Header row */}
          <div
            className="min-w-[860px] border-b border-slate-100"
            style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/80">
              PAYS
            </div>
            {MONTHS.map((m, i) => {
              const isCurrentMonth = i === currentMonth && year === currentYear;
              return (
                <div
                  key={m}
                  className={cn(
                    'px-1 py-2.5 text-[10px] font-bold uppercase tracking-widest text-center border-l border-slate-100',
                    isCurrentMonth
                      ? 'bg-violet-50 text-violet-600'
                      : 'bg-slate-50/80 text-slate-400',
                  )}
                >
                  {m}
                  {isCurrentMonth && (
                    <span className="block w-1 h-1 bg-violet-500 rounded-full mx-auto mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Country rows */}
          <div className="min-w-[860px] divide-y divide-slate-100">
            {visibleCountries.map((country, rowIdx) => (
              <div
                key={country.code}
                style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, minHeight: '48px' }}
                className={cn(
                  'group hover:bg-slate-50/60 transition-colors',
                  rowIdx % 2 === 0 ? '' : 'bg-slate-50/20',
                )}
              >
                {/* Country name cell */}
                <div className="flex items-center gap-2.5 px-4 py-2 border-r border-slate-100 bg-white/80 group-hover:bg-slate-50/80">
                  <img
                    src={`https://flagcdn.com/w24/${country.flagCode}.png`}
                    srcSet={`https://flagcdn.com/w48/${country.flagCode}.png 2x`}
                    alt={country.name}
                    width={20}
                    height={14}
                    className="rounded-sm object-cover shadow-sm flex-shrink-0"
                    style={{ width: 20, height: 14 }}
                  />
                  <span className="text-[12px] font-semibold text-slate-800 truncate">{country.name}</span>
                </div>

                {/* Holiday bars — each positioned via CSS Grid column */}
                {country.periods.map(period => {
                  const cfg      = SEASON_CFG[period.season];
                  const startCol = period.startMonth + 2; // col 1 = country name
                  const endCol   = period.endMonth   + 3; // exclusive end
                  return (
                    <div
                      key={`${country.code}-${period.name}`}
                      style={{ gridColumn: `${startCol} / ${endCol}`, alignSelf: 'center' }}
                      className="px-0.5 py-1"
                    >
                      <div
                        className={cn(
                          'rounded-md px-1.5 py-1 border h-full flex flex-col justify-center',
                          cfg.bg, cfg.border,
                        )}
                        title={`${period.name} · ${period.label}`}
                      >
                        <div className={cn('text-[9.5px] font-bold truncate leading-tight', cfg.text)}>
                          {period.name}
                        </div>
                        <div className={cn('text-[8.5px] truncate leading-tight mt-0.5 opacity-75', cfg.text)}>
                          {period.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer sources */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40">
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 mb-2">
            <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Sources officielles ·</span>
            <span>🇫🇷 data.education.gouv.fr</span>
            <span className="text-slate-300">·</span>
            <span>🇧🇪 calendrier.be</span>
            <span className="text-slate-300">·</span>
            <span>🇩🇪🇨🇭🇳🇱 openholidaysapi.org</span>
            <span className="text-slate-300">·</span>
            <span>🇬🇧 gov.uk/school-term-holiday-dates</span>
            <span className="text-slate-300">·</span>
            <span>🇪🇸 educacion.gob.es</span>
            <span className="text-slate-300">·</span>
            <span>🇺🇸 nces.ed.gov</span>
            <span className="text-slate-300">·</span>
            <span>🇯🇵 mext.go.jp</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TrustBadge color="emerald" label="Données libres de droits" />
            <TrustBadge color="blue"    label="Sources gouvernementales" />
            <TrustBadge color="violet"  label="Mise à jour annuelle" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiTile({
  icon: Icon, value, label, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  tone: 'violet' | 'sky' | 'emerald' | 'amber' | 'rose';
}) {
  const TONES = {
    violet:  { bg: 'bg-violet-50',  ring: 'ring-violet-100',  text: 'text-violet-600'  },
    sky:     { bg: 'bg-sky-50',     ring: 'ring-sky-100',     text: 'text-sky-600'     },
    emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-100', text: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-100',   text: 'text-amber-600'   },
    rose:    { bg: 'bg-rose-50',    ring: 'ring-rose-100',    text: 'text-rose-600'    },
  }[tone];

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1', TONES.bg, TONES.ring)}>
        <Icon className={cn('w-4 h-4', TONES.text)} />
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-bold text-slate-900 leading-tight tabular-nums">{value}</div>
        <div className="text-[10.5px] text-slate-400 font-medium mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function TrustBadge({ color, label }: { color: 'emerald' | 'blue' | 'violet'; label: string }) {
  const COLORS = {
    emerald: { outer: 'bg-emerald-50 ring-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    blue:    { outer: 'bg-blue-50    ring-blue-100    text-blue-700',    dot: 'bg-blue-500'    },
    violet:  { outer: 'bg-violet-50  ring-violet-100  text-violet-700',  dot: 'bg-violet-500'  },
  }[color];
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[10.5px] font-semibold', COLORS.outer)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', COLORS.dot)} />
      {label}
    </div>
  );
}
