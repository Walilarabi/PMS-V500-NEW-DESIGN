/**
 * FLOWTYM Events — Live Search Engine
 *
 * Interroge Ticketmaster Discovery API et OpenAgenda API en temps réel
 * pour découvrir des événements autour d'une ville, puis normalise les
 * résultats en RMSMarketEvent prêts à être validés et intégrés.
 *
 * Clés API stockées dans localStorage uniquement — elles ne quittent
 * jamais le navigateur.
 */

import type { RMSMarketEvent, EventImpactLevel, EventCategory } from '../types/events';

// ─── Configuration & stockage ────────────────────────────────────────────────

const STORAGE_KEY = 'flowtym_live_keys_v1';

export interface LiveSearchConfig {
  tmKey?: string;
  oaKey?: string;
  lastCity?: string;
}

export function getLiveConfig(): LiveSearchConfig {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveLiveConfig(patch: Partial<LiveSearchConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getLiveConfig(), ...patch }));
  } catch { /* offline / private mode */ }
}

export function clearLiveKey(source: 'tm' | 'oa'): void {
  const cfg = getLiveConfig();
  if (source === 'tm') delete cfg.tmKey;
  else delete cfg.oaKey;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
}

// ─── Villes supportées (avec coordonnées pour Ticketmaster) ──────────────────

export interface LiveCity {
  n: string;
  c: string;
  lat: number;
  lon: number;
  cc: string;
}

export const LIVE_CITIES: LiveCity[] = [
  { n: 'Paris',       c: 'France',        lat: 48.8566,  lon: 2.3522,   cc: 'FR' },
  { n: 'Lyon',        c: 'France',        lat: 45.764,   lon: 4.8357,   cc: 'FR' },
  { n: 'Marseille',   c: 'France',        lat: 43.2965,  lon: 5.3698,   cc: 'FR' },
  { n: 'Bordeaux',    c: 'France',        lat: 44.8378,  lon: -0.5792,  cc: 'FR' },
  { n: 'Nice',        c: 'France',        lat: 43.7102,  lon: 7.262,    cc: 'FR' },
  { n: 'Lille',       c: 'France',        lat: 50.6292,  lon: 3.0573,   cc: 'FR' },
  { n: 'Toulouse',    c: 'France',        lat: 43.6047,  lon: 1.4442,   cc: 'FR' },
  { n: 'Strasbourg',  c: 'France',        lat: 48.5734,  lon: 7.7521,   cc: 'FR' },
  { n: 'Nantes',      c: 'France',        lat: 47.2184,  lon: -1.5536,  cc: 'FR' },
  { n: 'Londres',     c: 'Royaume-Uni',   lat: 51.5074,  lon: -0.1278,  cc: 'GB' },
  { n: 'Berlin',      c: 'Allemagne',     lat: 52.52,    lon: 13.405,   cc: 'DE' },
  { n: 'Munich',      c: 'Allemagne',     lat: 48.1351,  lon: 11.582,   cc: 'DE' },
  { n: 'Francfort',   c: 'Allemagne',     lat: 50.1109,  lon: 8.6821,   cc: 'DE' },
  { n: 'Amsterdam',   c: 'Pays-Bas',      lat: 52.3676,  lon: 4.9041,   cc: 'NL' },
  { n: 'Bruxelles',   c: 'Belgique',      lat: 50.8503,  lon: 4.3517,   cc: 'BE' },
  { n: 'Madrid',      c: 'Espagne',       lat: 40.4168,  lon: -3.7038,  cc: 'ES' },
  { n: 'Barcelone',   c: 'Espagne',       lat: 41.3851,  lon: 2.1734,   cc: 'ES' },
  { n: 'Rome',        c: 'Italie',        lat: 41.9028,  lon: 12.4964,  cc: 'IT' },
  { n: 'Milan',       c: 'Italie',        lat: 45.4642,  lon: 9.19,     cc: 'IT' },
  { n: 'Lisbonne',    c: 'Portugal',      lat: 38.7169,  lon: -9.1399,  cc: 'PT' },
  { n: 'Zurich',      c: 'Suisse',        lat: 47.3769,  lon: 8.5417,   cc: 'CH' },
  { n: 'Genève',      c: 'Suisse',        lat: 46.2044,  lon: 6.1432,   cc: 'CH' },
  { n: 'Vienne',      c: 'Autriche',      lat: 48.2082,  lon: 16.3738,  cc: 'AT' },
  { n: 'Stockholm',   c: 'Suède',         lat: 59.3293,  lon: 18.0686,  cc: 'SE' },
  { n: 'Copenhague',  c: 'Danemark',      lat: 55.6761,  lon: 12.5683,  cc: 'DK' },
  { n: 'Dubaï',       c: 'EAU',           lat: 25.2048,  lon: 55.2708,  cc: 'AE' },
  { n: 'New York',    c: 'États-Unis',    lat: 40.7128,  lon: -74.006,  cc: 'US' },
  { n: 'Toronto',     c: 'Canada',        lat: 43.6532,  lon: -79.3832, cc: 'CA' },
  { n: 'Tokyo',       c: 'Japon',         lat: 35.6762,  lon: 139.6503, cc: 'JP' },
  { n: 'Singapour',   c: 'Singapour',     lat: 1.3521,   lon: 103.8198, cc: 'SG' },
  { n: 'Sydney',      c: 'Australie',     lat: -33.8688, lon: 151.2093, cc: 'AU' },
];

export function findCity(name: string): LiveCity | undefined {
  const q = name.toLowerCase().trim();
  return LIVE_CITIES.find((c) => c.n.toLowerCase() === q);
}

export function autocompleteCity(input: string): LiveCity[] {
  if (!input || input.length < 2) return [];
  const q = input.toLowerCase();
  return LIVE_CITIES.filter(
    (c) => c.n.toLowerCase().includes(q) || c.c.toLowerCase().includes(q),
  ).slice(0, 7);
}

// ─── Scoring & classification ─────────────────────────────────────────────────

function lsImpactLevel(genre: string, attendance: number): EventImpactLevel {
  const g = (genre || '').toLowerCase();

  if (g.includes('concert') || g.includes('music') || g.includes('festival')) {
    if (attendance > 50_000) return 'hyper_compression';
    if (attendance > 20_000) return 'critical';
    if (attendance > 5_000)  return 'high';
    return 'medium';
  }
  if (g.includes('sport') || g.includes('championship') || g.includes('match') || g.includes('cup') || g.includes('league')) {
    if (attendance > 40_000) return 'hyper_compression';
    if (attendance > 15_000) return 'critical';
    return 'high';
  }
  if (g.includes('conf') || g.includes('congress') || g.includes('summit') ||
      g.includes('expo') || g.includes('fair') || g.includes('salon') || g.includes('trade')) {
    return 'high';
  }
  if (g.includes('fashion') || g.includes('mode') || g.includes('art')) return 'high';
  if (g.includes('comedy') || g.includes('theatre') || g.includes('theater')) return 'medium';
  return 'medium';
}

function lsCategory(genre: string): EventCategory {
  const g = (genre || '').toLowerCase();
  if (g.includes('sport') || g.includes('championship') || g.includes('match') || g.includes('cup')) return 'sport';
  if (g.includes('k-pop') || g.includes('kpop')) return 'kpop_concert';
  if (g.includes('metal') || g.includes('rock')) return 'metal_concert';
  if (g.includes('rap') || g.includes('hip-hop') || g.includes('hip hop')) return 'rap_concert';
  if (g.includes('electro') || g.includes('dj') || g.includes('electronic') || g.includes('techno')) return 'electro_concert';
  if (g.includes('concert') || g.includes('music') || g.includes('pop')) return 'pop_concert';
  if (g.includes('festival')) return 'festival';
  if (g.includes('fashion') || g.includes('mode')) return 'fashion';
  if (g.includes('expo') || g.includes('fair') || g.includes('salon') || g.includes('trade')) return 'salon';
  if (g.includes('conf') || g.includes('congress') || g.includes('summit')) return 'congress';
  if (g.includes('art') || g.includes('culture') || g.includes('museum') || g.includes('theatre')) return 'culture';
  return 'other';
}

function lsCoefs(level: EventImpactLevel) {
  switch (level) {
    case 'hyper_compression': return { demand: 45, adr: 38, occupancy: 25, pickup: 35, revpar: 44, compression: 95, confidence: 88 };
    case 'critical':          return { demand: 38, adr: 32, occupancy: 20, pickup: 30, revpar: 38, compression: 88, confidence: 85 };
    case 'high':              return { demand: 26, adr: 22, occupancy: 14, pickup: 22, revpar: 24, compression: 72, confidence: 82 };
    case 'medium':            return { demand: 14, adr: 11, occupancy: 8,  pickup: 12, revpar: 13, compression: 50, confidence: 78 };
    case 'low':               return { demand: 6,  adr: 4,  occupancy: 3,  pickup: 5,  revpar: 5,  compression: 22, confidence: 72 };
    default:                  return { demand: 3,  adr: 2,  occupancy: 1,  pickup: 2,  revpar: 2,  compression: 10, confidence: 65 };
  }
}

function lsInfluencePrice(level: EventImpactLevel): number {
  const map: Record<EventImpactLevel, number> = {
    hyper_compression: 45, critical: 30, high: 18, medium: 10, low: 5, very_low: 0,
  };
  return map[level] ?? 0;
}

// ─── Période de recherche (rétro & prospective) ───────────────────────────────

/**
 * Plage temporelle pour la recherche live.
 * Permet d'interroger le passé (2024, 2025), le présent (2026) et le futur (2027),
 * ainsi que des fenêtres glissantes (3/6/12 mois à compter d'aujourd'hui).
 */
export interface LivePeriod {
  start: string;   // ISO date YYYY-MM-DD inclus
  end: string;     // ISO date YYYY-MM-DD inclus
  label: string;   // libellé court pour l'UI
  kind: 'year' | 'forward';
}

export function yearPeriod(year: number): LivePeriod {
  return {
    start: `${year}-01-01`,
    end:   `${year}-12-31`,
    label: String(year),
    kind:  'year',
  };
}

export function monthsForwardPeriod(months: number): LivePeriod {
  const now = new Date();
  const fut = new Date(now);
  fut.setMonth(now.getMonth() + months);
  return {
    start: now.toISOString().substring(0, 10),
    end:   fut.toISOString().substring(0, 10),
    label: `${months} mois`,
    kind:  'forward',
  };
}

function isoToTmDateTime(date: string, endOfDay = false): string {
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
}

function isoToUnix(date: string, endOfDay = false): number {
  return Math.floor(new Date(`${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`).getTime() / 1000);
}

// ─── Normalisation Ticketmaster ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normTM(ev: any, city: LiveCity): RMSMarketEvent {
  const start: string = ev.dates?.start?.localDate ?? '';
  const end: string   = ev.dates?.end?.localDate ?? start;
  const genre: string = ev.classifications?.[0]?.genre?.name ?? ev.classifications?.[0]?.segment?.name ?? '';
  const attendance: number = ev.capacity ?? 0;
  const level = lsImpactLevel(genre, attendance);
  const coefs = lsCoefs(level);
  const now = new Date().toISOString();
  const id = `tm_${(ev.id as string ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 20)}_${start}`;

  return {
    id,
    name: (ev.name as string) ?? '',
    category: lsCategory(genre),
    status: 'active',
    city: city.n,
    country: city.cc,
    venue: ev._embedded?.venues?.[0]?.name ?? undefined,
    startDate: start,
    endDate: end,
    impact: { ...coefs, level },
    influencePrice: lsInfluencePrice(level),
    sources: ['ticketmaster'],
    primarySource: 'Ticketmaster',
    rmsSynced: false,
    history: [{ at: now, action: 'imported', source: 'Ticketmaster Live Search' }],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Normalisation OpenAgenda ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normOA(ev: any, city: LiveCity): RMSMarketEvent {
  const timings = (ev.timings ?? []) as Array<{ begin?: string; end?: string }>;
  const start: string = (timings[0]?.begin ?? '').substring(0, 10);
  const end: string   = (timings[timings.length - 1]?.end ?? timings[0]?.begin ?? '').substring(0, 10);
  const keywords: string = ((ev.keywords?.fr ?? []) as string[]).join(' ');
  const level = lsImpactLevel(keywords, 0);
  const coefs = lsCoefs(level);
  const now = new Date().toISOString();
  const slug: string = (ev.slug ?? '') as string;
  const id = `oa_${slug.replace(/[^a-z0-9]/gi, '').slice(0, 20)}_${start}`;

  return {
    id,
    name: (ev.title?.fr ?? ev.title?.en ?? slug) as string,
    category: lsCategory(keywords),
    status: 'active',
    city: city.n,
    country: city.cc,
    venue: (ev.location?.name ?? undefined) as string | undefined,
    startDate: start,
    endDate: end || start,
    impact: { ...coefs, level },
    influencePrice: lsInfluencePrice(level),
    sources: ['openagenda'],
    primarySource: 'OpenAgenda',
    rmsSynced: false,
    history: [{ at: now, action: 'imported', source: 'OpenAgenda Live Search' }],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Dédoublonnage rapide ─────────────────────────────────────────────────────

function dedup(events: RMSMarketEvent[]): RMSMarketEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = e.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) + e.startDate;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Fetch Ticketmaster ───────────────────────────────────────────────────────

export async function fetchTicketmaster(
  city: LiveCity,
  key: string,
  period: LivePeriod,
): Promise<RMSMarketEvent[]> {
  const sd = isoToTmDateTime(period.start, false);
  const ed = isoToTmDateTime(period.end, true);
  const url =
    `https://app.ticketmaster.com/discovery/v2/events.json` +
    `?apikey=${encodeURIComponent(key)}` +
    `&latlong=${city.lat},${city.lon}` +
    `&radius=30&unit=km` +
    `&startDateTime=${sd}&endDateTime=${ed}` +
    `&size=200&sort=date,asc`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Ticketmaster: HTTP ${r.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await r.json();
  return ((d._embedded?.events ?? []) as unknown[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((ev: any) => normTM(ev, city))
    .filter((ev) => ev.startDate && ev.name);
}

// ─── Fetch OpenAgenda ──────────────────────────────────────────────────────────

export async function fetchOpenAgenda(
  city: LiveCity,
  key: string,
  period: LivePeriod,
): Promise<RMSMarketEvent[]> {
  const after  = isoToUnix(period.start, false);
  const before = isoToUnix(period.end, true);
  const url =
    `https://api.openagenda.com/v2/events` +
    `?key=${encodeURIComponent(key)}` +
    `&size=200` +
    `&timings[gte]=${after}&timings[lte]=${before}` +
    `&city[]=${encodeURIComponent(city.n)}` +
    `&lang=fr`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`OpenAgenda: HTTP ${r.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await r.json();
  return ((d.events ?? []) as unknown[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((ev: any) => normOA(ev, city))
    .filter((ev) => ev.startDate && ev.name);
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

export interface LiveSearchResult {
  events: RMSMarketEvent[];
  errors: string[];
  sources: { id: 'ticketmaster' | 'openagenda'; count: number; ok: boolean; error?: string }[];
}

export async function runLiveSearch(
  city: LiveCity,
  period: LivePeriod,
  useTM: boolean,
  useOA: boolean,
  tmKey: string,
  oaKey: string,
): Promise<LiveSearchResult> {
  const all: RMSMarketEvent[] = [];
  const errors: string[] = [];
  const sources: LiveSearchResult['sources'] = [];

  await Promise.allSettled([
    useTM
      ? fetchTicketmaster(city, tmKey, period)
          .then((r) => { all.push(...r); sources.push({ id: 'ticketmaster', count: r.length, ok: true }); })
          .catch((e: Error) => { errors.push(e.message); sources.push({ id: 'ticketmaster', count: 0, ok: false, error: e.message }); })
      : Promise.resolve(),
    useOA
      ? fetchOpenAgenda(city, oaKey, period)
          .then((r) => { all.push(...r); sources.push({ id: 'openagenda', count: r.length, ok: true }); })
          .catch((e: Error) => { errors.push(e.message); sources.push({ id: 'openagenda', count: 0, ok: false, error: e.message }); })
      : Promise.resolve(),
  ]);

  return { events: dedup(all.sort((a, b) => a.startDate.localeCompare(b.startDate))), errors, sources };
}

// ─── Vacances scolaires (data.education.gouv.fr) ──────────────────────────────

/**
 * Enregistrement brut renvoyé par l'API du calendrier scolaire.
 * Dataset officiel `fr-en-calendrier-scolaire` — pas de clé API requise.
 */
export interface SchoolHolidayRecord {
  description: string;
  startDate: string;     // ISO YYYY-MM-DD
  endDate: string;       // ISO YYYY-MM-DD
  zones: string;         // "Zone A" | "Zone B" | "Zone C" | "Corse" | ...
  location: string;      // "Paris" | "Bordeaux" | ...
  anneeScolaire: string; // "2025-2026"
  population: string;    // "Élèves" | "Enseignants"
}

const SCHOOL_HOLIDAYS_URL =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';

export interface SchoolHolidaysQuery {
  year: number;
  zone?: string;       // "Zone A" | "Zone B" | "Zone C" | "Corse" | undefined → toutes
  location?: string;   // ville académique
}

export async function fetchSchoolHolidays(q: SchoolHolidaysQuery): Promise<SchoolHolidayRecord[]> {
  const whereParts = [
    `start_date >= date'${q.year}-01-01'`,
    `start_date <= date'${q.year}-12-31'`,
    `population = "Élèves"`,
  ];
  if (q.zone)     whereParts.push(`zones = "${q.zone.replace(/"/g, '')}"`);
  if (q.location) whereParts.push(`location = "${q.location.replace(/"/g, '')}"`);

  const params = new URLSearchParams({
    limit: '100',
    order_by: 'start_date asc',
    where: whereParts.join(' AND '),
  });

  const r = await fetch(`${SCHOOL_HOLIDAYS_URL}?${params.toString()}`);
  if (!r.ok) throw new Error(`Vacances scolaires : HTTP ${r.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await r.json();
  return ((d.results ?? []) as unknown[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((rec: any): SchoolHolidayRecord => ({
      description:   String(rec.description ?? '').trim(),
      startDate:     String(rec.start_date ?? '').substring(0, 10),
      endDate:       String(rec.end_date ?? '').substring(0, 10),
      zones:         String(rec.zones ?? '').trim(),
      location:      String(rec.location ?? '').trim(),
      anneeScolaire: String(rec.annee_scolaire ?? '').trim(),
      population:    String(rec.population ?? '').trim(),
    }))
    .filter((h) => h.startDate && h.description);
}

/**
 * Impact RM des vacances scolaires sur l'hôtellerie loisirs.
 * Été = hyper-compression, Noël = critique, autres = élevé/moyen selon période.
 */
export function schoolHolidayImpact(description: string): EventImpactLevel {
  const d = description.toLowerCase();
  if (d.includes('été') || d.includes('ete'))                 return 'hyper_compression';
  if (d.includes('noël') || d.includes('noel'))               return 'critical';
  if (d.includes('hiver'))                                     return 'high';
  if (d.includes('printemps') || d.includes('pâques'))         return 'high';
  if (d.includes('toussaint'))                                 return 'high';
  if (d.includes('ascension') || d.includes('pont'))           return 'medium';
  return 'medium';
}

export function normalizeSchoolHoliday(h: SchoolHolidayRecord): RMSMarketEvent {
  const level = schoolHolidayImpact(h.description);
  const coefs = lsCoefs(level);
  const now   = new Date().toISOString();
  const slug  = (h.description + '_' + h.zones).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  const id    = `vs_${slug}_${h.startDate}`;

  return {
    id,
    name:          `${h.description}${h.zones ? ` — ${h.zones}` : ''}`,
    category:      'culture',
    status:        'active',
    city:          h.location || 'France',
    country:       'FR',
    startDate:     h.startDate,
    endDate:       h.endDate || h.startDate,
    impact:        { ...coefs, level },
    influencePrice: lsInfluencePrice(level),
    description:   `Vacances scolaires ${h.anneeScolaire || ''} · ${h.zones || ''} · ${h.location || ''}`.trim(),
    sources:       ['school_holidays'],
    primarySource: 'Calendrier scolaire',
    rmsSynced:     false,
    history:       [{ at: now, action: 'imported', source: 'data.education.gouv.fr' }],
    createdAt:     now,
    updatedAt:     now,
  };
}

// ─── Vacances scolaires multi-pays (OpenHolidaysAPI) ──────────────────────────

/**
 * Pays supportés pour les vacances scolaires.
 * OpenHolidaysAPI couvre la majeure partie de l'UE + Royaume-Uni — pas les US.
 */
export interface HolidayCountry {
  code: string;     // ISO 3166-1 alpha-2
  name: string;
  flag: string;     // emoji drapeau
  lang: string;     // langue de retour préférée
}

export const HOLIDAY_COUNTRIES: HolidayCountry[] = [
  { code: 'FR', name: 'France',       flag: '🇫🇷', lang: 'FR' },
  { code: 'DE', name: 'Allemagne',    flag: '🇩🇪', lang: 'DE' },
  { code: 'GB', name: 'Royaume-Uni',  flag: '🇬🇧', lang: 'EN' },
  { code: 'ES', name: 'Espagne',      flag: '🇪🇸', lang: 'ES' },
  { code: 'IT', name: 'Italie',       flag: '🇮🇹', lang: 'IT' },
  { code: 'BE', name: 'Belgique',     flag: '🇧🇪', lang: 'FR' },
  { code: 'CH', name: 'Suisse',       flag: '🇨🇭', lang: 'FR' },
  { code: 'NL', name: 'Pays-Bas',     flag: '🇳🇱', lang: 'EN' },
  { code: 'AT', name: 'Autriche',     flag: '🇦🇹', lang: 'DE' },
  { code: 'PT', name: 'Portugal',     flag: '🇵🇹', lang: 'PT' },
  { code: 'LU', name: 'Luxembourg',   flag: '🇱🇺', lang: 'FR' },
];

export interface CountryHoliday {
  countryCode: string;
  name: string;
  startDate: string;  // ISO YYYY-MM-DD
  endDate:   string;
  type:      string;  // "School" en majorité
  region?:   string;  // subdivision (ex: "DE-BW")
  nationwide: boolean;
}

const OPEN_HOLIDAYS_URL = 'https://openholidaysapi.org/SchoolHolidays';

export async function fetchOpenHolidaysSchool(
  country: HolidayCountry,
  year: number,
): Promise<CountryHoliday[]> {
  const params = new URLSearchParams({
    countryIsoCode:  country.code,
    languageIsoCode: country.lang,
    validFrom:       `${year}-01-01`,
    validTo:         `${year}-12-31`,
  });

  const r = await fetch(`${OPEN_HOLIDAYS_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`OpenHolidays ${country.code}: HTTP ${r.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await r.json();
  return data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((rec: any): CountryHoliday => {
      const nameList: Array<{ language: string; text: string }> = rec.name ?? [];
      const nameEntry = nameList.find((n) => n.language === country.lang) ?? nameList[0];
      return {
        countryCode: country.code,
        name:        nameEntry?.text ?? '—',
        startDate:   String(rec.startDate ?? '').substring(0, 10),
        endDate:     String(rec.endDate   ?? '').substring(0, 10),
        type:        String(rec.type ?? 'School'),
        region:      rec.subdivisions?.[0]?.shortName,
        nationwide:  Boolean(rec.nationwide),
      };
    })
    .filter((h) => h.startDate && h.name);
}

/**
 * Récupère les vacances scolaires de plusieurs pays en parallèle.
 * Les pays en erreur sont simplement omis (sans bloquer l'ensemble).
 */
export async function fetchOpenHolidaysMulti(
  countries: HolidayCountry[],
  year: number,
): Promise<Record<string, CountryHoliday[]>> {
  const results = await Promise.allSettled(
    countries.map((c) => fetchOpenHolidaysSchool(c, year).then((rows) => ({ code: c.code, rows }))),
  );
  const out: Record<string, CountryHoliday[]> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') out[r.value.code] = r.value.rows;
  }
  return out;
}
