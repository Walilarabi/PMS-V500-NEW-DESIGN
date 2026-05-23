/**
 * FLOWTYM RMS — Mega Artist Registry (Mega Entertainment & Concert Impact Engine).
 *
 * Registre central des artistes mondiaux générant un impact hôtelier
 * massif. Chaque artiste porte un profil métier :
 *   • popularité (0-100)
 *   • capacité de remplissage attendue (0-100 — % stade type comble)
 *   • rayonnement international (0-100)
 *   • impact touristique (0-100 — % audience extra-locale)
 *   • historique ADR / TO (deltas % observés sur la place)
 *
 * Le moteur d'impact utilise ce registre pour booster automatiquement
 * le score des événements concert et déclencher le palier
 * "hyper_compression" pour les phénomènes globaux (BTS, Beyoncé,
 * Taylor Swift, Coldplay, Adele, Céline Dion).
 *
 * Cette base est volontairement extensible : on ajoute un artiste en
 * insérant une entrée — le moteur en tient compte automatiquement.
 */

import type { EventCategory } from '../types/events';

export type ArtistTier = 'hyper_global' | 'global' | 'national' | 'regional';

export interface MegaArtist {
  /** Slug stable utilisé pour rapprocher le nom de l'événement → registre. */
  id: string;
  /** Nom canonique (orthographe officielle). */
  name: string;
  /** Variantes / alias détectés dans les libellés d'événements. */
  aliases: string[];
  /** Catégorie d'événement associée (utilisée si non précisée). */
  category: EventCategory;
  /** Tier business — pilote le boost et le palier hyper_compression. */
  tier: ArtistTier;
  /** Popularité globale (0-100). */
  popularity: number;
  /** Capacité de remplissage moyenne attendue (0-100). */
  fillRate: number;
  /** Rayonnement international (0-100). */
  international: number;
  /** Impact touristique — % d'audience extra-locale (0-100). */
  touristImpact: number;
  /** Delta ADR historique observé sur place (%). */
  historicAdrLift: number;
  /** Delta TO historique (%). */
  historicOccLift: number;
  /** Notes Revenue Management. */
  notes?: string;
}

/**
 * Catalogue initial — étendu au fil des saisons. Les valeurs reflètent
 * les ordres de grandeur observés sur la place de Paris (Stade de France,
 * Accor Arena, Paris La Défense Arena).
 */
export const MEGA_ARTIST_REGISTRY: MegaArtist[] = [
  // ─── HYPER GLOBAL — déclenchent le palier hyper_compression ──────────
  {
    id: 'bts',
    name: 'BTS',
    aliases: ['bts', 'beyond the scene', '방탄소년단'],
    category: 'kpop_concert',
    tier: 'hyper_global',
    popularity: 100, fillRate: 100, international: 100, touristImpact: 95,
    historicAdrLift: 65, historicOccLift: 40,
    notes: 'Phénomène K-Pop mondial — saturation hôtels + transports + boutiques.',
  },
  {
    id: 'taylor_swift',
    name: 'Taylor Swift',
    aliases: ['taylor swift', 'eras tour', 'swift'],
    category: 'pop_concert',
    tier: 'hyper_global',
    popularity: 100, fillRate: 100, international: 100, touristImpact: 92,
    historicAdrLift: 70, historicOccLift: 38,
    notes: 'Eras Tour — Swifties internationaux, lead time long, ADR record.',
  },
  {
    id: 'beyonce',
    name: 'Beyoncé',
    aliases: ['beyoncé', 'beyonce', 'renaissance tour'],
    category: 'pop_concert',
    tier: 'hyper_global',
    popularity: 99, fillRate: 100, international: 98, touristImpact: 90,
    historicAdrLift: 55, historicOccLift: 36,
  },
  {
    id: 'coldplay',
    name: 'Coldplay',
    aliases: ['coldplay', 'music of the spheres'],
    category: 'pop_concert',
    tier: 'hyper_global',
    popularity: 98, fillRate: 100, international: 96, touristImpact: 88,
    historicAdrLift: 50, historicOccLift: 34,
  },
  {
    id: 'adele',
    name: 'Adele',
    aliases: ['adele'],
    category: 'pop_concert',
    tier: 'hyper_global',
    popularity: 99, fillRate: 100, international: 97, touristImpact: 87,
    historicAdrLift: 58, historicOccLift: 35,
  },
  {
    id: 'celine_dion',
    name: 'Céline Dion',
    aliases: ['céline dion', 'celine dion'],
    category: 'pop_concert',
    tier: 'hyper_global',
    popularity: 99, fillRate: 100, international: 97, touristImpact: 89,
    historicAdrLift: 60, historicOccLift: 36,
  },

  // ─── GLOBAL — palier critical/hyper selon volume de dates ─────────────
  {
    id: 'the_weeknd',
    name: 'The Weeknd',
    aliases: ['the weeknd', 'weeknd', 'abel tesfaye'],
    category: 'pop_concert',
    tier: 'global',
    popularity: 96, fillRate: 98, international: 92, touristImpact: 82,
    historicAdrLift: 38, historicOccLift: 28,
  },
  {
    id: 'bruno_mars',
    name: 'Bruno Mars',
    aliases: ['bruno mars'],
    category: 'pop_concert',
    tier: 'global',
    popularity: 94, fillRate: 97, international: 90, touristImpact: 78,
    historicAdrLift: 32, historicOccLift: 24,
  },
  {
    id: 'david_guetta',
    name: 'David Guetta',
    aliases: ['david guetta', 'guetta'],
    category: 'electro_concert',
    tier: 'global',
    popularity: 93, fillRate: 96, international: 89, touristImpact: 76,
    historicAdrLift: 30, historicOccLift: 22,
  },
  {
    id: 'system_of_a_down',
    name: 'System of a Down',
    aliases: ['system of a down', 'soad'],
    category: 'metal_concert',
    tier: 'global',
    popularity: 90, fillRate: 95, international: 88, touristImpact: 70,
    historicAdrLift: 26, historicOccLift: 20,
  },
  {
    id: 'queens_of_the_stone_age',
    name: 'Queens of the Stone Age',
    aliases: ['queens of the stone age', 'qotsa'],
    category: 'metal_concert',
    tier: 'global',
    popularity: 82, fillRate: 90, international: 78, touristImpact: 60,
    historicAdrLift: 18, historicOccLift: 14,
  },
  {
    id: 'acid_bath',
    name: 'Acid Bath',
    aliases: ['acid bath'],
    category: 'metal_concert',
    tier: 'national',
    popularity: 65, fillRate: 75, international: 50, touristImpact: 40,
    historicAdrLift: 10, historicOccLift: 7,
  },

  // ─── NATIONAL — fort impact local (Stade de France, Bercy) ────────────
  {
    id: 'jul',
    name: 'Jul',
    aliases: ['jul'],
    category: 'rap_concert',
    tier: 'national',
    popularity: 96, fillRate: 100, international: 50, touristImpact: 55,
    historicAdrLift: 28, historicOccLift: 22,
    notes: 'Phénomène national rap — sold-out Stade de France multi-soirs.',
  },
  {
    id: 'aya_nakamura',
    name: 'Aya Nakamura',
    aliases: ['aya nakamura', 'aya'],
    category: 'pop_concert',
    tier: 'national',
    popularity: 94, fillRate: 100, international: 70, touristImpact: 62,
    historicAdrLift: 30, historicOccLift: 23,
    notes: 'Phénomène francophone — fort rayonnement Europe + Afrique.',
  },
  {
    id: 'fally_ipupa',
    name: 'Fally Ipupa',
    aliases: ['fally ipupa', 'fally'],
    category: 'world_tour',
    tier: 'national',
    popularity: 88, fillRate: 95, international: 75, touristImpact: 70,
    historicAdrLift: 24, historicOccLift: 18,
    notes: 'Tournée internationale — audience africaine + diaspora.',
  },
  {
    id: 'plk',
    name: 'PLK',
    aliases: ['plk'],
    category: 'rap_concert',
    tier: 'national',
    popularity: 82, fillRate: 88, international: 40, touristImpact: 38,
    historicAdrLift: 14, historicOccLift: 11,
  },
];

// ─── Résolution / matching ────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Recherche un artiste dans le registre à partir d'un nom d'événement.
 * Le matching se fait sur le nom + tous les alias.
 */
export function matchArtist(eventName: string): MegaArtist | null {
  const n = normalize(eventName);
  for (const a of MEGA_ARTIST_REGISTRY) {
    if (a.aliases.some((alias) => n.includes(normalize(alias)))) return a;
  }
  return null;
}

/**
 * Coefficient multiplicateur appliqué au score d'impact d'un événement
 * concert en fonction du tier de l'artiste.
 *   hyper_global → 1.4 (peut faire passer un critique en hyper_compression)
 *   global       → 1.2
 *   national     → 1.0
 *   regional     → 0.85
 */
export function tierBoost(tier: ArtistTier): number {
  switch (tier) {
    case 'hyper_global': return 1.4;
    case 'global':       return 1.2;
    case 'national':     return 1.0;
    case 'regional':     return 0.85;
  }
}

/**
 * Construit un ImpactScore concert à partir du profil de l'artiste,
 * du nombre de dates consécutives et de la capacité du lieu.
 *
 *   - venueCapacity ∈ [0, 1] où 1 = stade comble (≥80 000 places)
 *   - dateCount     nombre de représentations consécutives ou groupées
 *
 * La compression et le pickup montent avec le tier de l'artiste.
 */
export function buildConcertImpact(artist: MegaArtist, dateCount: number, venueCapacity = 1) {
  const boost = tierBoost(artist.tier);
  const fill = artist.fillRate / 100;
  const intl = artist.international / 100;
  const tourist = artist.touristImpact / 100;
  // Volume du phénomène : plus de dates → plus de compression cumulée
  const volumeMultiplier = Math.min(1.4, 0.85 + 0.12 * dateCount);

  const compression = clamp(
    Math.round(45 + 50 * fill * boost * venueCapacity * volumeMultiplier),
    0, 100,
  );
  const demand = clamp(Math.round(20 + 40 * boost * fill), 0, 100);
  const adr = clamp(Math.round(artist.historicAdrLift * boost * (0.85 + 0.15 * intl)), 0, 100);
  const occupancy = clamp(Math.round(artist.historicOccLift * boost * (0.85 + 0.15 * tourist)), 0, 100);
  const pickup = clamp(Math.round(15 + 30 * boost * fill), 0, 100);
  const revpar = clamp(Math.round(adr * 0.6 + occupancy * 0.5), 0, 100);
  const confidence = clamp(Math.round(78 + 20 * (artist.popularity / 100)), 0, 100);

  return { demand, adr, occupancy, pickup, revpar, compression, confidence };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Recommandation tarifaire (% au-dessus du base) — calée sur le tier.
 */
export function concertPriceInfluence(artist: MegaArtist, dateCount = 1): number {
  const base = {
    hyper_global: 32,
    global: 22,
    national: 14,
    regional: 8,
  }[artist.tier];
  return Math.round(base + Math.min(8, dateCount * 1.5));
}
