/**
 * FLOWTYM RMS — Helpers d'affichage Événements (purs, testables).
 *
 * Ces fonctions sont consommées par EventsList et EventsHeatmapView pour
 * éviter qu'un événement avec impact partiel (recherche live à valider,
 * import Excel partiel) ne fasse crasher le rendu.
 *
 * Pattern historique du crash :
 *   const Icon = CATEGORY_ICON[e.category];           // undefined si cat custom
 *   <Icon ... />                                       // ← crash JSX
 *   {e.impact.occupancy.toFixed(0)}                    // ← crash si impact null
 *
 * Toutes les fonctions ici sont défensives : aucune entrée ne peut leur
 * faire jeter une exception.
 */
import type { RMSMarketEvent } from '@/src/types/events';

export interface SafeEventImpact {
  occupancy: number | null;
  adr: number | null;
  revpar: number | null;
  confidence: number;
}

/**
 * Retourne un impact safe pour l'affichage. Une valeur null signifie
 * « non renseigné » (UI affiche un tiret). 0 est une vraie valeur numérique.
 */
export function safeImpact(e: RMSMarketEvent | null | undefined): SafeEventImpact {
  const i = e?.impact;
  return {
    occupancy: i && Number.isFinite(i.occupancy) ? i.occupancy : null,
    adr: i && Number.isFinite(i.adr) ? i.adr : null,
    revpar: i && Number.isFinite(i.revpar) ? i.revpar : null,
    confidence: i && Number.isFinite(i.confidence) ? i.confidence : 0,
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
