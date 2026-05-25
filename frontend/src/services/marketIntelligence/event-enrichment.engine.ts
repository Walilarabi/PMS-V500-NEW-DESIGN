/**
 * FLOWTYM RMS — Event Enrichment Engine
 *
 * Transforme un `RMSMarketEvent` brut en `EventEnrichment` — l'événement
 * passe d'un calendrier statique à une fiche métier exploitable par le
 * moteur de pression marché.
 *
 * Pipeline :
 *   1) Audience estimée (fallback intelligent par catégorie + venue)
 *   2) Tier audience (micro → mega)
 *   3) Mix client dominant (business, leisure, luxury, sports_fans…)
 *   4) Portée (local → global)
 *   5) Prestige (récurrence + tradition + médiatisation)
 *   6) Durée & part weekend
 *   7) Récurrence (annual / biennial…)
 *   8) Zone géographique impactée (rayon, cluster principal)
 *   9) Mots-clés / tags
 *
 * 100 % pur — aucune dépendance UI, aucun side effect, déterministe.
 * Ainsi le moteur est testable et utilisable côté worker / batch.
 */

import type { EventCategory, RMSMarketEvent } from '../../types/events';
import {
  AUDIENCE_TIER_THRESHOLDS,
  type AudienceTier,
  type ClientMix,
  type EventEnrichment,
  type EventReach,
  type GeoImpactZone,
  type HotelCluster,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* CONSTANTES MÉTIER                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Audience par défaut (en visiteurs uniques cumulés) si l'événement n'a pas
 * de `estimatedVisitors`. Ces valeurs reflètent les ordres de grandeur
 * observés sur la place de Paris (médianes sectorielles).
 */
const DEFAULT_AUDIENCE_BY_CATEGORY: Record<EventCategory, number> = {
  salon: 80_000,
  congress: 12_000,
  sport: 60_000,
  concert: 50_000,
  culture: 40_000,
  fashion: 20_000,
  festival: 100_000,
  holiday: 250_000,
  school_break: 500_000,
  tourism_peak: 800_000,
  religious: 30_000,
  political: 5_000,
  internal: 1_000,
  manual: 5_000,
  mega_concert: 250_000,
  pop_concert: 80_000,
  rap_concert: 60_000,
  kpop_concert: 90_000,
  electro_concert: 50_000,
  metal_concert: 40_000,
  world_tour: 200_000,
  other: 10_000,
};

/** Catégories considérées "internationales" par nature. */
const INHERENTLY_INTERNATIONAL: ReadonlySet<EventCategory> = new Set([
  'mega_concert', 'world_tour', 'kpop_concert', 'fashion', 'salon', 'congress',
]);

/** Catégories de prestige naturellement élevé. */
const PRESTIGE_BASE_BY_CATEGORY: Record<EventCategory, number> = {
  salon: 55,
  congress: 50,
  sport: 60,
  concert: 50,
  culture: 60,
  fashion: 75,
  festival: 55,
  holiday: 40,
  school_break: 25,
  tourism_peak: 35,
  religious: 50,
  political: 70,
  internal: 20,
  manual: 30,
  mega_concert: 80,
  pop_concert: 60,
  rap_concert: 55,
  kpop_concert: 70,
  electro_concert: 55,
  metal_concert: 55,
  world_tour: 85,
  other: 30,
};

/**
 * Heuristiques venue → cluster compset principal + zones.
 * Indexées par mot-clé bas de casse contenu dans le nom du lieu.
 */
const VENUE_HEURISTICS: Array<{
  match: RegExp;
  cluster: HotelCluster;
  zones: string[];
  radiusKm: number;
}> = [
  { match: /porte de versailles|p\.\s*de versailles|paris expo/i, cluster: 'upscale', zones: ['Paris 15', 'Boulogne'],                  radiusKm: 5 },
  { match: /villepinte|paris nord/i,                  cluster: 'midscale',  zones: ['Roissy', 'CDG', '93'],                              radiusKm: 15 },
  { match: /palais des congr[eè]s/i,                  cluster: 'upscale',   zones: ['Paris 17', 'Paris 16'],                             radiusKm: 4 },
  { match: /grand palais/i,                            cluster: 'luxury',    zones: ['Paris 8', 'Champs-Élysées'],                        radiusKm: 3 },
  { match: /stade de france|sdf/i,                    cluster: 'business',  zones: ['St-Denis', 'Paris 18', 'Paris 19'],                 radiusKm: 8 },
  { match: /accor arena|bercy/i,                       cluster: 'upscale',   zones: ['Paris 12', 'Paris 13', 'Paris 4'],                  radiusKm: 4 },
  { match: /paris la d[eé]fense arena|la d[eé]fense/i, cluster: 'business', zones: ['La Défense', 'Paris 17', 'Neuilly'],                radiusKm: 5 },
  { match: /roland.?garros|porte d.?auteuil/i,        cluster: 'luxury',    zones: ['Paris 16', 'Boulogne'],                             radiusKm: 4 },
  { match: /tuileries|louvre/i,                        cluster: 'luxury',    zones: ['Paris 1', 'Paris 2', 'Paris 8'],                    radiusKm: 3 },
  { match: /palais brogniart|bourse/i,                 cluster: 'upscale',   zones: ['Paris 2', 'Paris 9'],                               radiusKm: 3 },
  { match: /paris centre/i,                            cluster: 'luxury',    zones: ['Paris 1', 'Paris 2', 'Paris 8'],                    radiusKm: 4 },
  { match: /paris entier|paris$/i,                     cluster: 'midscale',  zones: ['Paris intra-muros'],                                 radiusKm: 12 },
];

/** Mapping rapide nom → mix client (déduction par mots-clés). */
const CLIENT_MIX_KEYWORDS: Array<{ match: RegExp; mix: ClientMix }> = [
  { match: /fashion|couture|mode|tranoi|premiere vision/i, mix: 'luxury' },
  { match: /art basel|biennale|f.?i?ac|art paris|musée|design week/i, mix: 'luxury' },
  { match: /vivatech|games week|gaming|tech|developer|conf/i, mix: 'gaming_tech' },
  { match: /roland.?garros|6 nations|six nations|marathon|stade|natation|finale/i, mix: 'sports_fans' },
  { match: /sommet|otan|g7|g20|onu|diplomatique/i, mix: 'diplomatic' },
  { match: /salon|expo|foire|sirha|sial|batimat|mondial/i, mix: 'business' },
  { match: /congr[eè]s|europcr|dermatology|pharma/i, mix: 'business' },
  { match: /festival|concert|tour|live|spectacle/i, mix: 'leisure' },
  { match: /agriculture|salon des maires|enfants/i, mix: 'family' },
  { match: /séminaire|incentive|corporate/i, mix: 'corporate' },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Compte les jours inclusifs entre deux dates ISO YYYY-MM-DD. */
export function durationDaysInclusive(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
  return Math.round((e - s) / 86_400_000) + 1;
}

/** Calcule la part de jours weekend (sam/dim) sur la durée de l'événement. */
export function computeWeekendShare(start: string, end: string): number {
  const total = durationDaysInclusive(start, end);
  if (total <= 0) return 0;
  let weekend = 0;
  const cur = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < total; i++) {
    const dow = cur.getUTCDay();
    if (dow === 0 || dow === 6) weekend++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return weekend / total;
}

/** Tier audience à partir d'un nombre absolu. */
export function audienceTierFromCount(n: number): AudienceTier {
  if (n >= AUDIENCE_TIER_THRESHOLDS.mega) return 'mega';
  if (n >= AUDIENCE_TIER_THRESHOLDS.massive) return 'massive';
  if (n >= AUDIENCE_TIER_THRESHOLDS.large) return 'large';
  if (n >= AUDIENCE_TIER_THRESHOLDS.medium) return 'medium';
  if (n >= AUDIENCE_TIER_THRESHOLDS.small) return 'small';
  return 'micro';
}

/** Convertit une recurrence métier vers le type `EventEnrichment.recurrence`. */
function mapRecurrence(
  frequency: RMSMarketEvent['frequency'],
): EventEnrichment['recurrence'] {
  switch (frequency) {
    case 'annuel':     return 'annual';
    case 'biannuel':   return 'biennial';
    case 'semestriel': return 'biannual';
    case 'ponctuel':   return 'unique';
    default:           return 'unique';
  }
}

/** Heuristique portée géographique à partir du nom + catégorie + audience. */
function inferReach(event: RMSMarketEvent, audience: number): EventReach {
  const name = event.name.toLowerCase();
  if (/global|world|mondial|international|tour/i.test(name)) return 'global';
  if (INHERENTLY_INTERNATIONAL.has(event.category)) {
    return audience >= 50_000 ? 'international' : 'national';
  }
  if (audience >= 200_000) return 'international';
  if (audience >= 50_000) return 'national';
  if (audience >= 10_000) return 'regional';
  return 'local';
}

/** Détecte le mix client par mots-clés sur le nom + catégorie. */
function inferClientMix(event: RMSMarketEvent): ClientMix {
  const name = event.name.toLowerCase();
  for (const { match, mix } of CLIENT_MIX_KEYWORDS) {
    if (match.test(name)) return mix;
  }
  // Fallback par catégorie
  switch (event.category) {
    case 'salon':
    case 'congress':         return 'business';
    case 'fashion':          return 'luxury';
    case 'sport':            return 'sports_fans';
    case 'mega_concert':
    case 'pop_concert':
    case 'rap_concert':
    case 'kpop_concert':
    case 'electro_concert':
    case 'metal_concert':
    case 'world_tour':
    case 'concert':          return 'leisure';
    case 'culture':          return 'luxury';
    case 'political':        return 'diplomatic';
    case 'religious':
    case 'holiday':          return 'family';
    case 'festival':         return 'leisure';
    case 'school_break':
    case 'tourism_peak':     return 'family';
    case 'internal':
    case 'manual':
    case 'other':            return 'mixed';
  }
}

/** Détecte la zone d'impact géographique à partir du venue + zone. */
function inferGeoImpact(event: RMSMarketEvent): GeoImpactZone {
  const haystack = `${event.venue ?? ''} ${event.zone ?? ''}`.trim() || event.city;
  for (const h of VENUE_HEURISTICS) {
    if (h.match.test(haystack)) {
      return {
        radiusKm: h.radiusKm,
        zones: h.zones,
        primaryCluster: h.cluster,
      };
    }
  }
  // Fallback : ville entière, cluster midscale (plus représentatif compset).
  return {
    radiusKm: 10,
    zones: [event.city],
    primaryCluster: 'midscale',
  };
}

/** Boost de prestige pour les événements à fort historique. */
function inferPrestige(event: RMSMarketEvent, reach: EventReach, audience: number): number {
  let prestige = PRESTIGE_BASE_BY_CATEGORY[event.category] ?? 30;
  if (reach === 'global') prestige += 15;
  else if (reach === 'international') prestige += 8;
  else if (reach === 'national') prestige += 3;

  if (audience >= 500_000) prestige += 10;
  else if (audience >= 100_000) prestige += 5;

  if (event.frequency === 'annuel') prestige += 5;
  if (event.frequency === 'biannuel') prestige += 3;

  if (event.realImpact?.adr && event.realImpact.adr >= 25) prestige += 8;

  return Math.max(0, Math.min(100, prestige));
}

/** Extrait des mots-clés simples pour le routing RMS. */
function extractKeywords(event: RMSMarketEvent): string[] {
  const out = new Set<string>();
  const lower = event.name.toLowerCase();
  if (/mode|fashion|couture/.test(lower)) out.add('fashion');
  if (/sport|stade|marathon|tournoi|natation/.test(lower)) out.add('sport');
  if (/salon|expo|foire/.test(lower)) out.add('salon');
  if (/congr[eè]s|medical|pharma/.test(lower)) out.add('congress');
  if (/concert|tour|live/.test(lower)) out.add('concert');
  if (/agriculture|salon des maires/.test(lower)) out.add('family');
  if (/luxe|premium|haute couture|art basel/.test(lower)) out.add('luxury');
  if (/tech|gaming|vivatech|games week/.test(lower)) out.add('tech');
  if (event.zone) out.add(event.zone.toLowerCase());
  return Array.from(out);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Enrichit un événement avec toutes les dimensions métier nécessaires au
 * moteur de pression marché et au moteur de recommandations RMS.
 *
 * 100 % déterministe : pour un même `event` en entrée, le résultat est
 * identique. Aucune lecture d'horloge, aucun side-effect.
 */
export function enrichEvent(event: RMSMarketEvent): EventEnrichment {
  const estimatedAudience =
    event.estimatedVisitors && event.estimatedVisitors > 0
      ? event.estimatedVisitors
      : DEFAULT_AUDIENCE_BY_CATEGORY[event.category] ?? 10_000;

  const audienceTier = audienceTierFromCount(estimatedAudience);
  const durationDays = durationDaysInclusive(event.startDate, event.endDate);
  const weekendShare = computeWeekendShare(event.startDate, event.endDate);
  const reach = inferReach(event, estimatedAudience);
  const clientMix = inferClientMix(event);
  const prestige = inferPrestige(event, reach, estimatedAudience);
  const recurrence = mapRecurrence(event.frequency);
  const geoImpact = inferGeoImpact(event);
  const keywords = extractKeywords(event);

  return {
    estimatedAudience,
    audienceTier,
    clientMix,
    reach,
    prestige,
    durationDays,
    weekendShare,
    recurrence,
    geoImpact,
    keywords,
  };
}

/**
 * Version batch — enrichit une liste d'événements.
 * Aucune optimisation cross-event nécessaire pour l'instant : O(n).
 */
export function enrichEvents(events: RMSMarketEvent[]): Map<string, EventEnrichment> {
  const out = new Map<string, EventEnrichment>();
  for (const ev of events) out.set(ev.id, enrichEvent(ev));
  return out;
}
