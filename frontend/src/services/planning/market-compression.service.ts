/**
 * FLOWTYM — Service centralisé de compression marché.
 *
 * SOURCE UNIQUE de la compression marché pour tout le Planning. La donnée
 * provient exclusivement de la table `lighthouse_days` (module Revenue / Pricing /
 * colonne Marché — alimentée par l'import Lighthouse). Le Planning ne recalcule
 * JAMAIS la compression localement : il consomme ce service.
 *
 * Si aucune ligne Lighthouse n'existe pour une date, `percent` vaut `null`
 * (l'UI affiche « — », jamais 0 %).
 *
 * Couleurs : identiques à la colonne « Pression » du tableau RMS Revenue Management
 * (RMSTableauPro.tsx) — vert (≤40%) → jaune (>40-70%) → rouge (>70%).
 * Les seuils et couleurs sont synchronisés avec la source unique Revenue pour
 * garantir une cohérence visuelle parfaite entre les deux modules.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { toIsoDate } from '@/src/services/planning/planning-kpi.service';

export type CompressionLevel = 'low' | 'medium' | 'high' | 'critical';

export interface MarketCompressionPoint {
  date: string;
  /** 0-100, ou null si Lighthouse n'a pas de donnée pour cette date. */
  percent: number | null;
  level: CompressionLevel | null;
  compsetMedian: number | null;
  ourPrice: number | null;
}

/**
 * Mappe un pourcentage de demande/compression marché vers un palier coloré.
 * Seuils identiques à la colonne Pression de RMSTableauPro : ≤40 vert, ≤70 jaune, >70 rouge.
 */
export function compressionLevel(percent: number): CompressionLevel {
  if (percent <= 40) return 'low';
  if (percent <= 70) return 'medium';
  return 'high';
  // 'critical' kept in type for backward compat but never returned — maps to same red as 'high'
}

interface LighthouseDayLite {
  stay_date: string;
  market_demand_percent: number | null;
  compset_median: number | null;
  our_price: number | null;
}

function toPoint(row: LighthouseDayLite): MarketCompressionPoint {
  const percent = row.market_demand_percent;
  return {
    date: row.stay_date,
    percent: percent ?? null,
    level: percent != null ? compressionLevel(percent) : null,
    compsetMedian: row.compset_median ?? null,
    ourPrice: row.our_price ?? null,
  };
}

const EMPTY = (date: string): MarketCompressionPoint => ({
  date,
  percent: null,
  level: null,
  compsetMedian: null,
  ourPrice: null,
});

/**
 * Compression marché pour UNE date donnée. Source unique : lighthouse_days.
 * Retourne un point avec `percent: null` si aucune donnée (jamais 0 inventé).
 *
 * Le scope hôtel est garanti par RLS (`hotel_id = get_user_hotel_id()`), donc
 * `hotelId` sert uniquement d'invariant de cache / lisibilité côté appelant.
 */
export async function getMarketCompressionForDate(
  _hotelId: string | null,
  date: Date | string,
): Promise<MarketCompressionPoint> {
  const iso = toIsoDate(date);
  const { data, error } = await supabase
    .from('lighthouse_days')
    .select('stay_date, market_demand_percent, compset_median, our_price')
    .eq('stay_date', iso)
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  return data ? toPoint(data as LighthouseDayLite) : EMPTY(iso);
}

/**
 * Compression marché sur une plage de dates. Source unique : lighthouse_days.
 * Renvoie un point par jour (rempli ou vide) + la map par date.
 */
export async function getMarketCompressionRange(
  _hotelId: string | null,
  startDate: Date | string,
  rangeDays: number,
): Promise<{ days: MarketCompressionPoint[]; byDate: Record<string, MarketCompressionPoint> }> {
  const start = toIsoDate(startDate);
  const endDt = new Date(`${start}T00:00:00`);
  endDt.setDate(endDt.getDate() + Math.max(1, rangeDays) - 1);
  const end = toIsoDate(endDt);

  const { data, error } = await supabase
    .from('lighthouse_days')
    .select('stay_date, market_demand_percent, compset_median, our_price')
    .gte('stay_date', start)
    .lte('stay_date', end)
    .order('stay_date', { ascending: true });
  if (error) throw mapSupabaseError(error);

  const byDate: Record<string, MarketCompressionPoint> = {};
  for (const row of (data ?? []) as LighthouseDayLite[]) {
    byDate[row.stay_date] = toPoint(row);
  }

  const days: MarketCompressionPoint[] = [];
  for (let i = 0; i < Math.max(1, rangeDays); i += 1) {
    const dt = new Date(`${start}T00:00:00`);
    dt.setDate(dt.getDate() + i);
    const iso = toIsoDate(dt);
    days.push(byDate[iso] ?? EMPTY(iso));
  }

  return { days, byDate };
}

// ── Charte couleur compression marché ───────────────────────────────────────
// Identique à la colonne "Pression" de RMSTableauPro (Revenue Management) :
//   Vert  (≤40%)  bg-green-100 / text-green-700
//   Jaune (>40%)  bg-yellow-100 / text-yellow-700
//   Rouge (>70%)  bg-red-100 / text-red-700
export interface CompressionTone {
  /** Couleur hex (graphiques, points). */
  hex: string;
  /** Classe texte Tailwind. */
  text: string;
  /** Classe fond Tailwind (léger). */
  bg: string;
  /** Classe pastille Tailwind. */
  dot: string;
  /** Libellé FR. */
  label: string;
}

const COMPRESSION_TONES: Record<CompressionLevel, CompressionTone> = {
  low:      { hex: '#16A34A', text: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500',  label: 'Faible' },
  medium:   { hex: '#CA8A04', text: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500', label: 'Modérée' },
  high:     { hex: '#B91C1C', text: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500',    label: 'Forte' },
  critical: { hex: '#B91C1C', text: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500',    label: 'Critique' },
};

const NEUTRAL_TONE: CompressionTone = {
  hex: '#CBD5E1', text: 'text-gray-300', bg: 'bg-gray-50', dot: 'bg-gray-300', label: '—',
};

/** Tonalité (couleurs + libellé) pour un palier de compression, ou neutre si null. */
export function getCompressionTone(level: CompressionLevel | null): CompressionTone {
  return level ? COMPRESSION_TONES[level] : NEUTRAL_TONE;
}
