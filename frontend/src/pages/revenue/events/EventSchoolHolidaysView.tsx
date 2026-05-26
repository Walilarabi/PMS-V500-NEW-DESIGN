/**
 * FLOWTYM Events — Vacances scolaires multi-pays
 * Vue calendrier annuelle avec grille CSS, drapeaux réels et barres saisonnières.
 */
import React, { useMemo, useState } from 'react';
import {
  BarChart3, Calendar, CheckCircle2, ChevronDown, Globe, MapPin, Plus,
  RefreshCw, School, Trash2, Users, X,
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
  endMonth: number;
  label: string;      // "14 fév. – 01 mar."
}

interface CountryRow {
  code: string;
  name: string;
  flagCode: string; // flagcdn.com ISO-2 lowercase (fr, be, gb…)
  periods: HolidayPeriod[];
  custom?: boolean;
}

export interface EventSchoolHolidaysViewProps {
  onImportEvents: (events: RMSMarketEvent[]) => void;
  year?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS      = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
const MONTHS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const YEARS       = [2024, 2025, 2026, 2027];
const GRID_TEMPLATE = '180px repeat(12, 1fr)';
const LS_KEY_CUSTOM = 'flowtym_custom_holiday_countries_v1';

const SEASON_CFG: Record<Season, { bg: string; text: string; border: string; label: string; dot: string }> = {
  hiver:     { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    label: 'Hiver',     dot: 'bg-blue-400'    },
  printemps: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Printemps', dot: 'bg-emerald-400' },
  ete:       { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   label: 'Été',       dot: 'bg-amber-400'   },
  automne:   { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    label: 'Automne',   dot: 'bg-rose-400'    },
};

// ─── Default holiday data (2026) ──────────────────────────────────────────────

const DEFAULT_COUNTRIES: CountryRow[] = [
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
      { name: 'Hiver', season: 'hiver',     startMonth: 0, endMonth: 0, label: '09 jan. – 19 jan.' },
      { name: 'Aïd',   season: 'printemps', startMonth: 3, endMonth: 3, label: '05 avr. – 15 avr.' },
      { name: 'Été',   season: 'ete',       startMonth: 5, endMonth: 7, label: '08 jun. – 01 sep.' },
    ],
  },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadCustomCountries(): CountryRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY_CUSTOM);
    return raw ? (JSON.parse(raw) as CountryRow[]) : [];
  } catch { return []; }
}

function saveCustomCountries(list: CountryRow[]) {
  try { localStorage.setItem(LS_KEY_CUSTOM, JSON.stringify(list)); } catch { /* noop */ }
}

// ─── FlagImg — fix: flagcdn.com n'a pas w24/w48, utiliser w20/w40 ─────────────

function FlagImg({ code, className }: { code: string; className?: string }) {
  const iso = code.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
  return (
    <img
      src={`https://flagcdn.com/w20/${iso}.png`}
      srcSet={`https://flagcdn.com/w40/${iso}.png 2x`}
      alt={iso.toUpperCase()}
      width={20}
      height={14}
      loading="lazy"
      decoding="async"
      className={cn('rounded-sm object-cover shadow-sm flex-shrink-0 ring-1 ring-black/10', className)}
      style={{ width: 20, height: 14 }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ─── Empty period template ────────────────────────────────────────────────────

function emptyPeriod(): HolidayPeriod {
  return { name: '', season: 'ete', startMonth: 6, endMonth: 7, label: '' };
}

// ─── Add Country Modal ────────────────────────────────────────────────────────

interface AddCountryModalProps {
  onClose: () => void;
  onSave: (country: CountryRow) => void;
}

const AddCountryModal: React.FC<AddCountryModalProps> = ({ onClose, onSave }) => {
  const [name,     setName]     = useState('');
  const [flagCode, setFlagCode] = useState('');
  const [periods,  setPeriods]  = useState<HolidayPeriod[]>([emptyPeriod()]);
  const [preview,  setPreview]  = useState(false);

  const validCode = /^[a-zA-Z]{2}$/.test(flagCode.trim());

  function updatePeriod(i: number, patch: Partial<HolidayPeriod>) {
    setPeriods(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  }

  function addPeriod() {
    if (periods.length < 6) setPeriods(prev => [...prev, emptyPeriod()]);
  }

  function removePeriod(i: number) {
    setPeriods(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    if (!name.trim() || !validCode) return;
    const validPeriods = periods.filter(p => p.name.trim() && p.startMonth <= p.endMonth);
    if (validPeriods.length === 0) return;
    onSave({
      code:     flagCode.trim().toUpperCase(),
      name:     name.trim(),
      flagCode: flagCode.trim().toLowerCase(),
      periods:  validPeriods,
      custom:   true,
    });
    onClose();
  }

  const canSave = name.trim().length > 0 && validCode &&
    periods.some(p => p.name.trim() && p.startMonth <= p.endMonth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center">
              <Globe className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Ajouter un pays</h3>
              <p className="text-[11px] text-slate-500">Définissez le code ISO et les périodes de vacances</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Country info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                Nom du pays *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ex. Portugal"
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-400 outline-none bg-slate-50/60 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                Code ISO-2 (drapeau) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={flagCode}
                  onChange={e => setFlagCode(e.target.value.slice(0, 2))}
                  placeholder="ex. PT"
                  maxLength={2}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg ring-1 text-[13px] uppercase font-mono outline-none',
                    validCode ? 'ring-emerald-300 bg-emerald-50/40' : 'ring-slate-200 bg-slate-50/60',
                  )}
                />
                {validCode && (
                  <button
                    type="button"
                    onClick={() => setPreview(v => !v)}
                    className="px-2 py-2 rounded-lg ring-1 ring-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-600"
                  >
                    {preview ? 'Masquer' : 'Aperçu'}
                  </button>
                )}
                {validCode && preview && (
                  <FlagImg code={flagCode} className="w-8 h-5" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Code alpha-2 ISO 3166-1 · ex. FR, DE, PT, MA…</p>
            </div>
          </div>

          {/* Periods */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold">
                Périodes de vacances ({periods.length}/6)
              </label>
              {periods.length < 6 && (
                <button
                  type="button"
                  onClick={addPeriod}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-[11.5px] font-medium ring-1 ring-violet-200 hover:bg-violet-100"
                >
                  <Plus className="w-3 h-3" /> Ajouter une période
                </button>
              )}
            </div>

            <div className="space-y-3">
              {periods.map((p, i) => (
                <div key={i} className={cn(
                  'rounded-xl ring-1 p-3 space-y-2.5',
                  SEASON_CFG[p.season].border,
                  SEASON_CFG[p.season].bg,
                )}>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[11px] font-bold uppercase tracking-wide', SEASON_CFG[p.season].text)}>
                      Période {i + 1}
                    </span>
                    {periods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePeriod(i)}
                        className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9.5px] text-slate-500 mb-1 font-medium">Nom</label>
                      <input
                        type="text"
                        value={p.name}
                        onChange={e => updatePeriod(i, { name: e.target.value })}
                        placeholder="ex. Été"
                        className="w-full px-2.5 py-1.5 rounded-lg ring-1 ring-white/70 bg-white/60 text-[12px] outline-none focus:ring-violet-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-slate-500 mb-1 font-medium">Saison</label>
                      <select
                        value={p.season}
                        onChange={e => updatePeriod(i, { season: e.target.value as Season })}
                        className="w-full px-2.5 py-1.5 rounded-lg ring-1 ring-white/70 bg-white/60 text-[12px] outline-none"
                      >
                        {(Object.entries(SEASON_CFG) as [Season, (typeof SEASON_CFG)[Season]][]).map(([s, c]) => (
                          <option key={s} value={s}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-slate-500 mb-1 font-medium">Mois début</label>
                      <select
                        value={p.startMonth}
                        onChange={e => updatePeriod(i, { startMonth: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg ring-1 ring-white/70 bg-white/60 text-[12px] outline-none"
                      >
                        {MONTHS_FULL.map((m, idx) => (
                          <option key={idx} value={idx}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-slate-500 mb-1 font-medium">Mois fin</label>
                      <select
                        value={p.endMonth}
                        onChange={e => updatePeriod(i, { endMonth: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg ring-1 ring-white/70 bg-white/60 text-[12px] outline-none"
                      >
                        {MONTHS_FULL.map((m, idx) => (
                          <option key={idx} value={idx} disabled={idx < p.startMonth}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-500 mb-1 font-medium">Étiquette (dates exactes)</label>
                    <input
                      type="text"
                      value={p.label}
                      onChange={e => updatePeriod(i, { label: e.target.value })}
                      placeholder="ex. 22 jun. – 08 sep."
                      className="w-full px-2.5 py-1.5 rounded-lg ring-1 ring-white/70 bg-white/60 text-[12px] outline-none focus:ring-violet-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 bg-slate-50/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all flex items-center gap-1.5',
              canSave
                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter au calendrier
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const EventSchoolHolidaysView: React.FC<EventSchoolHolidaysViewProps> = ({
  onImportEvents,
  year: yearProp,
}) => {
  const [year,          setYear]          = useState(yearProp ?? 2026);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [importedCount, setImportedCount] = useState(0);
  const [customCountries, setCustomCountries] = useState<CountryRow[]>(loadCustomCountries);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const { setPendingValidation } = useEventsStore();

  React.useEffect(() => {
    if (yearProp && yearProp !== year) setYear(yearProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearProp]);

  const today        = new Date();
  const currentMonth = today.getMonth();
  const currentYear  = today.getFullYear();
  const majDate      = today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const allCountries = useMemo(
    () => [...DEFAULT_COUNTRIES, ...customCountries],
    [customCountries],
  );

  const visibleCountries = useMemo(
    () => countryFilter === 'all' ? allCountries : allCountries.filter(c => c.code === countryFilter),
    [allCountries, countryFilter],
  );

  const totalPeriods = useMemo(
    () => allCountries.reduce((acc, c) => acc + c.periods.length, 0),
    [allCountries],
  );

  function handleAddCountry(country: CountryRow) {
    const updated = [...customCountries, country];
    setCustomCountries(updated);
    saveCustomCountries(updated);
  }

  function handleRemoveCustom(code: string) {
    const updated = customCountries.filter(c => c.code !== code);
    setCustomCountries(updated);
    saveCustomCountries(updated);
  }

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
    <>
      <div className="space-y-4">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <School className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">
                Vacances scolaires {year} · {allCountries.length} pays
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Calendrier officiel multi-pays — toutes saisons et destinations clés
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ── Year dropdown ─────────────────────────────────── */}
            <div className="relative">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[13px] font-semibold text-slate-700 outline-none focus:ring-violet-400 cursor-pointer"
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>
                    {y}{y === currentYear ? ' (en cours)' : y < currentYear ? ' (passé)' : ' (à venir)'}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="w-3.5 h-3.5" /> Pays
            </button>

            <button
              type="button"
              onClick={handleImport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-700 transition-all shadow-sm shadow-violet-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Importer
            </button>
          </div>
        </div>

        {/* ── KPI Tiles ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiTile icon={Globe}     value={`${allCountries.length} pays`} label="couverts"              tone="violet"  />
          <KpiTile icon={Calendar}  value="4 saisons"                     label="périodes saisonnières"  tone="sky"     />
          <KpiTile icon={BarChart3} value={`${totalPeriods}`}             label="périodes référencées"   tone="emerald" />
          <KpiTile icon={Users}     value="92%"                           label="population couverte"    tone="amber"   />
          <KpiTile icon={RefreshCw} value={`MAJ ${majDate}`}              label="sources officielles"   tone="rose"    />
        </div>

        {/* ── Calendar panel ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <div className="relative">
                  <select
                    value={countryFilter}
                    onChange={e => setCountryFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-[12.5px] font-medium rounded-lg ring-1 ring-slate-200 bg-white outline-none focus:ring-violet-400 min-w-[170px] cursor-pointer"
                  >
                    <option value="all">Tous les pays ({allCountries.length})</option>
                    {allCountries.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name}{c.custom ? ' ✦' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
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
            {/* Header */}
            <div
              className="min-w-[860px] border-b border-slate-100"
              style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE }}
            >
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/80">
                PAYS
              </div>
              {MONTHS.map((m, i) => {
                const isCurrent = i === currentMonth && year === currentYear;
                return (
                  <div
                    key={m}
                    className={cn(
                      'px-1 py-2.5 text-[10px] font-bold uppercase tracking-widest text-center border-l border-slate-100',
                      isCurrent ? 'bg-violet-50 text-violet-600' : 'bg-slate-50/80 text-slate-400',
                    )}
                  >
                    {m}
                    {isCurrent && <span className="block w-1 h-1 bg-violet-500 rounded-full mx-auto mt-0.5" />}
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
                  className={cn('group hover:bg-slate-50/60 transition-colors', rowIdx % 2 !== 0 && 'bg-slate-50/20')}
                >
                  {/* Country name cell */}
                  <div className="flex items-center gap-2.5 px-4 py-2 border-r border-slate-100 bg-white/80 group-hover:bg-slate-50/80">
                    <FlagImg code={country.flagCode} />
                    <span className="text-[12px] font-semibold text-slate-800 truncate flex-1">{country.name}</span>
                    {country.custom && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustom(country.code)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-rose-500 text-slate-300 transition-all"
                        title="Supprimer ce pays"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Holiday bars */}
                  {country.periods.map(period => {
                    const cfg      = SEASON_CFG[period.season];
                    const startCol = period.startMonth + 2;
                    const endCol   = period.endMonth   + 3;
                    return (
                      <div
                        key={`${country.code}-${period.name}`}
                        style={{ gridColumn: `${startCol} / ${endCol}`, alignSelf: 'center' }}
                        className="px-0.5 py-1"
                      >
                        <div
                          className={cn('rounded-md px-1.5 py-1 border flex flex-col justify-center', cfg.bg, cfg.border)}
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

              {/* Add country row */}
              <div
                style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, minHeight: '40px' }}
                className="border-t-2 border-dashed border-slate-200"
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-[11.5px] font-medium text-slate-400 hover:text-violet-600 hover:bg-violet-50/50 transition-colors group"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter un pays
                </button>
              </div>
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

      {/* Add Country Modal */}
      {showAddModal && (
        <AddCountryModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddCountry}
        />
      )}
    </>
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
