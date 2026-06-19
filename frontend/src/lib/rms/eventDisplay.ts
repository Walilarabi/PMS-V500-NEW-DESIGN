/**
 * FLOWTYM RMS — Helpers d'affichage Événements (purs, testables).
 *
 * Ces fonctions sont consommées par EventsList, EventsHeatmapView,
 * EventDetailPanel, EventValidationModal, EventLiveSearchView, etc.
 * pour éviter qu'un événement avec `impact` partiel (recherche live à
 * valider, import Excel partiel, données legacy persistées) ne fasse
 * crasher le rendu.
 *
 * Pattern historique du crash :
 *   const Icon = CATEGORY_ICON[e.category];           // undefined si cat custom
 *   <Icon ... />                                       // ← crash JSX
 *   {e.impact.occupancy.toFixed(0)}                    // ← crash si impact null
 *   ev.impact.compression                              // ← crash bulkUpsert
 *
 * Toutes les fonctions ici sont défensives : aucune entrée ne peut leur
 * faire jeter une exception.
 */
import type { EventImpactLevel, ImpactScore, RMSMarketEvent } from '@/src/types/events';

/**
 * Vue safe pour l'AFFICHAGE :
 *   • occupancy / adr / revpar peuvent être `null` → l'UI rend « — » au
 *     lieu de « +0% » (distinction « non renseigné » vs « zéro »).
 *   • level / demand / pickup / compression / confidence sont toujours
 *     numériques (ou energy-level pour `level`) — utilisés par la logique
 *     métier (RMS, KPIs, filtres) où null n'a pas de sens.
 */
export interface SafeEventImpact {
  level: EventImpactLevel;
  demand: number;
  occupancy: number | null;
  adr: number | null;
  pickup: number;
  revpar: number | null;
  compression: number;
  confidence: number;
}

const VALID_LEVELS: readonly EventImpactLevel[] = [
  'very_low', 'low', 'medium', 'high', 'critical', 'hyper_compression',
];

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function nullableNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function level(v: unknown): EventImpactLevel {
  return typeof v === 'string' && (VALID_LEVELS as readonly string[]).includes(v)
    ? (v as EventImpactLevel)
    : 'very_low';
}

type ImpactCarrier = { impact?: Partial<ImpactScore> | null } | null | undefined;

/**
 * Retourne un impact safe pour l'affichage. occupancy/adr/revpar peuvent
 * être null si non renseignés (UI affiche un tiret) ; les autres champs
 * sont toujours numériques avec 0 par défaut.
 *
 * Aucune lecture directe à `event.impact.*` ne doit subsister dans les
 * composants du module Événements — tous doivent passer par ce helper.
 */
export function safeImpact(e: ImpactCarrier): SafeEventImpact {
  const i = e?.impact ?? null;
  return {
    level: level(i?.level),
    demand: num(i?.demand),
    occupancy: nullableNum(i?.occupancy),
    adr: nullableNum(i?.adr),
    pickup: num(i?.pickup),
    revpar: nullableNum(i?.revpar),
    compression: num(i?.compression),
    confidence: num(i?.confidence),
  };
}

/**
 * Version « store » : ImpactScore complet jamais null, pour réécrire
 * l'event entrant avant stockage. Garantit que tous les consommateurs
 * en aval (engine RMS, bridges, services d'agrégation) reçoivent des
 * valeurs numériques cohérentes — plus aucun TypeError possible côté
 * services lors d'un import live ou d'un payload Supabase incomplet.
 *
 * À utiliser dans `addEvent`, `bulkUpsert`, `applySearchResult` et
 * partout où un event est inséré dans le store.
 */
export function normalizeImpact(e: ImpactCarrier): ImpactScore {
  const s = safeImpact(e);
  return {
    level: s.level,
    demand: s.demand,
    occupancy: s.occupancy ?? 0,
    adr: s.adr ?? 0,
    pickup: s.pickup,
    revpar: s.revpar ?? 0,
    compression: s.compression,
    confidence: s.confidence,
  };
}

/**
 * Normalise un événement entier : garantit `impact`, `history` et
 * `sources` non-null. Sert d'écluse à l'entrée du store pour les
 * payloads venant d'une recherche live, d'un import Excel ou de
 * Supabase (snapshots legacy).
 */
export function normalizeEvent<T extends Partial<RMSMarketEvent>>(ev: T): T & { impact: ImpactScore } {
  return {
    ...ev,
    impact: normalizeImpact(ev as ImpactCarrier),
    history: (ev.history ?? []) as RMSMarketEvent['history'],
    sources: (ev.sources ?? []) as RMSMarketEvent['sources'],
  };
}

/**
 * Formate un pourcentage signé. Tolère null / undefined / NaN / Infinity.
 * Retourne « — » au lieu de crash ou « NaN% » qui pollue l'UI.
 */
export function fmtSignedPct(n: number | null | undefined, plus = true): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const s = n.toFixed(0);
  return plus && n >= 0 ? `+${s}%` : `${s}%`;
}

/**
 * Borne un score (0–100) pour ScoreBadge. Out-of-range → 0.
 */
export function safeScore(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
