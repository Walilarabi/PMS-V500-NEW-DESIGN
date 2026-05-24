/**
 * FLOWTYM RMS — Calcul robuste de la médiane compset.
 *
 * Bug fix Phase 4 : la médiane devenait négative sur certaines dates
 * car le calcul `current / (1 + variation/100)` divisait par zéro
 * ou produisait des valeurs négatives quand `variation ≤ -100%`
 * (cas Lighthouse "hôtel fermé" / "épuisé").
 *
 * Règles métier appliquées ici :
 *   • exclure les hôtels fermés / sold out / indisponibles
 *   • exclure les tarifs ≤ 0
 *   • exclure les valeurs NaN / Infinity / null / undefined
 *   • exclure les états 'closed' / 'épuisé' / 'indisponible'
 *   • contrôle anti-aberrant (Tukey 1.5×IQR ou clamp 50€ minimum)
 *   • si tous les hôtels exclus → retourner null (UI : "Indisponible")
 *
 * Sortie : `{ median, sampleSize, excluded[], reason? }` pour debug/logs.
 */

/** États qui signifient "pas en vente" — on ignore le prix. */
const UNAVAILABLE_STATES = new Set<string>([
  'closed', 'closed_to_sale', 'sold_out', 'soldout', 'unavailable',
  'inactive', 'épuisé', 'epuise', 'indisponible', 'fermé', 'ferme', 'off',
]);

/** Plancher tarifaire absolu (€) — en dessous on suspecte une erreur d'import. */
const MIN_VALID_PRICE = 50;
/** Plafond tarifaire absolu (€) — au-dessus on suspecte un tarif "no bid". */
const MAX_VALID_PRICE = 100_000;

export interface CompetitorPriceQuote {
  /** Identifiant ou nom de l'hôtel concurrent. */
  id: string;
  /** Prix proposé (€). Peut être null si non parsé. */
  price: number | null | undefined;
  /** État commercial : 'open' / 'closed' / 'sold_out' / etc. */
  status?: string | null;
  /** Disponibilité brute (peut venir de Lighthouse / Expedia). */
  available?: boolean | null;
}

export interface SafeMedianResult {
  /** Médiane calculée. `null` si dataset vide après filtrage. */
  median: number | null;
  /** Nombre d'hôtels retenus dans le calcul. */
  sampleSize: number;
  /** Nombre total d'hôtels avant filtrage. */
  totalCandidates: number;
  /** Détail des exclusions pour logs / debug. */
  excluded: Array<{ id: string; reason: string }>;
  /** Raison principale si median === null. */
  reason?: string;
}

/** Médiane d'un tableau de nombres (tri stable). Suppose le tableau non vide. */
function medianOf(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Détection des valeurs aberrantes via la règle de Tukey (1.5 × IQR). */
function tukeyOutliers(values: number[]): Set<number> {
  if (values.length < 4) return new Set(); // pas assez de points pour Tukey
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = medianOf(sorted.slice(0, Math.floor(sorted.length / 2)));
  const q3 = medianOf(sorted.slice(Math.ceil(sorted.length / 2)));
  const iqr = q3 - q1;
  if (!Number.isFinite(iqr) || iqr === 0) return new Set();
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return new Set(values.filter((v) => v < lo || v > hi));
}

/**
 * Calcule la médiane des prix compset en filtrant les hôtels fermés /
 * tarifs invalides / valeurs aberrantes. Retourne `null` si aucun hôtel
 * valide — l'UI doit alors afficher "Indisponible".
 */
export function computeSafeCompsetMedian(
  quotes: CompetitorPriceQuote[],
  options: { excludeOutliers?: boolean; logger?: (msg: string, ctx: unknown) => void } = {},
): SafeMedianResult {
  const total = quotes.length;
  const excluded: Array<{ id: string; reason: string }> = [];

  // ─── Filtrage métier ──────────────────────────────────────────────────
  const valid: { id: string; price: number }[] = [];
  for (const q of quotes) {
    if (q.available === false) {
      excluded.push({ id: q.id, reason: 'unavailable=false' });
      continue;
    }
    const status = (q.status ?? '').toString().toLowerCase().trim();
    if (status && UNAVAILABLE_STATES.has(status)) {
      excluded.push({ id: q.id, reason: `status=${status}` });
      continue;
    }
    if (q.price == null) {
      excluded.push({ id: q.id, reason: 'price=null' });
      continue;
    }
    if (!Number.isFinite(q.price)) {
      excluded.push({ id: q.id, reason: 'price=NaN/Infinity' });
      continue;
    }
    if (q.price <= 0) {
      excluded.push({ id: q.id, reason: 'price<=0' });
      continue;
    }
    if (q.price < MIN_VALID_PRICE) {
      excluded.push({ id: q.id, reason: `price<${MIN_VALID_PRICE}€` });
      continue;
    }
    if (q.price > MAX_VALID_PRICE) {
      excluded.push({ id: q.id, reason: `price>${MAX_VALID_PRICE}€` });
      continue;
    }
    valid.push({ id: q.id, price: q.price });
  }

  // ─── Contrôle anti-valeurs aberrantes (optionnel, par défaut activé) ──
  const excludeOutliers = options.excludeOutliers !== false;
  if (excludeOutliers && valid.length >= 4) {
    const outliers = tukeyOutliers(valid.map((v) => v.price));
    if (outliers.size > 0) {
      const filtered: typeof valid = [];
      for (const v of valid) {
        if (outliers.has(v.price)) {
          excluded.push({ id: v.id, reason: 'outlier (Tukey 1.5×IQR)' });
        } else {
          filtered.push(v);
        }
      }
      valid.length = 0;
      valid.push(...filtered);
    }
  }

  // ─── Fallback si dataset vide ─────────────────────────────────────────
  if (valid.length === 0) {
    const result: SafeMedianResult = {
      median: null,
      sampleSize: 0,
      totalCandidates: total,
      excluded,
      reason: total === 0 ? 'no_competitors' : 'all_excluded',
    };
    options.logger?.('[safeMedian] median=null', result);
    return result;
  }

  // ─── Calcul médiane ───────────────────────────────────────────────────
  const sorted = valid.map((v) => v.price).sort((a, b) => a - b);
  const median = Math.round(medianOf(sorted));
  const result: SafeMedianResult = {
    median,
    sampleSize: valid.length,
    totalCandidates: total,
    excluded,
  };
  options.logger?.('[safeMedian] computed', result);
  return result;
}

/**
 * Helper : passe une variation Lighthouse à une valeur "passée" en
 * évitant les divisions par zéro et résultats négatifs. Si la variation
 * est ≤ -100% ou non finie, retourne `null` (l'UI doit afficher "—").
 */
export function safePastValueFromVariation(
  current: number,
  variationPct: number | null | undefined,
): number | null {
  if (!Number.isFinite(current) || current <= 0) return null;
  if (variationPct == null || !Number.isFinite(variationPct)) return null;
  // Clamp : empêche le diviseur d'être ≤ 0 (ex : -100% → x/0)
  const clamped = Math.max(-99, Math.min(500, variationPct));
  const past = current / (1 + clamped / 100);
  if (!Number.isFinite(past) || past <= 0) return null;
  return Math.round(past);
}
