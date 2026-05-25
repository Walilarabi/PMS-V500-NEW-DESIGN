/**
 * FLOWTYM RMS — Market Intelligence Types
 *
 * Couche d'intelligence marché construite au-dessus du module Événements.
 * Transforme le module en un **moteur de détection de pression marché** :
 * l'événement n'est qu'un signal — la vraie valeur est la réaction marché
 * (compression, ADR, disponibilité, restrictions, pickup, fermetures).
 *
 * Cette couche alimente :
 *   • le Dashboard Intelligence Marché (heatmap, radar, gauges, alertes)
 *   • le moteur de recommandations RMS explicables (hausse BAR, fermeture
 *     promos, Min Stay, CTA, CTD, protection inventaire…)
 *   • le moteur prédictif (impact ADR/TO/Compression par événement)
 *
 * Conventions :
 *   • Tous les scores sont 0-100 (clampés par les engines).
 *   • Toutes les dates sont ISO YYYY-MM-DD.
 *   • Les deltas exprimés en % sont des entiers signés (ex: +18, -34).
 *   • Les confiances sont 0-100 — une recommandation RMS agressive ne peut
 *     être émise QUE si confidence ≥ seuil défini par la stratégie.
 */

import type {
  EventCategory,
  EventImpactLevel,
  RMSMarketEvent,
} from './events';

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. ENRICHISSEMENT ÉVÉNEMENT                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/** Audience attendue (visiteurs uniques) sur toute la durée de l'événement. */
export type AudienceTier =
  | 'micro'      // < 5 000   — local
  | 'small'      // 5k-25k
  | 'medium'    // 25k-100k
  | 'large'     // 100k-300k
  | 'massive'   // 300k-1M
  | 'mega';     // 1M+      — Salon Agriculture, Mondial de l'Auto, JO

/** Clientèle dominante d'un événement. */
export type ClientMix =
  | 'business'           // congrès médical, salon pro
  | 'leisure'            // festival, concert, sport spectacle
  | 'luxury'             // Fashion Week, Art Basel
  | 'corporate'          // séminaire, sommet
  | 'family'             // foire, salon agriculture
  | 'gaming_tech'        // PGW, GamesCom, dev conferences
  | 'sports_fans'        // Roland-Garros, 6 Nations, finales
  | 'diplomatic'         // sommets, événements politiques
  | 'mixed';

/** Portée géographique de l'événement. */
export type EventReach = 'local' | 'regional' | 'national' | 'international' | 'global';

/** Zone géographique impactée (pour cibler le compset). */
export interface GeoImpactZone {
  /** Centre de l'événement (lat/lon). */
  center?: { lat: number; lon: number };
  /** Rayon principal d'impact (km). */
  radiusKm: number;
  /** Zones / arrondissements touchés (libellés courts). */
  zones: string[];
  /** Cluster compset principalement touché. */
  primaryCluster: HotelCluster;
}

/** Cluster hôtelier — segmentation marché. */
export type HotelCluster =
  | 'luxury'
  | 'upscale'
  | 'midscale'
  | 'budget'
  | 'lifestyle'
  | 'business'
  | 'leisure'
  | 'aparthotel';

/** Enrichissement événementiel — calculé par l'EventEnrichmentEngine. */
export interface EventEnrichment {
  /** Audience estimée (nombre absolu) — base pour les buckets. */
  estimatedAudience: number;
  audienceTier: AudienceTier;
  clientMix: ClientMix;
  reach: EventReach;
  /** Score prestige 0-100 (récurrence + médiatisation + tradition). */
  prestige: number;
  /** Durée effective en jours (1 = ponctuel). */
  durationDays: number;
  /** Concentration weekend (0-1) : 0 = full semaine, 1 = full weekend. */
  weekendShare: number;
  /** Récurrence détectée — nourrit le Reliability Engine. */
  recurrence: 'unique' | 'annual' | 'biennial' | 'biannual' | 'monthly';
  /** Zone géographique impactée. */
  geoImpact: GeoImpactZone;
  /** Mots-clés extraits / tags utilisés par le bridge RMS. */
  keywords: string[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. EVENT IMPACT SCORE (0-100)                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** Détail des contributions au score d'impact — explicable. */
export interface EventImpactBreakdown {
  /** Score brut audience (0-20). */
  audience: number;
  /** Score brut rayonnement international (0-15). */
  international: number;
  /** Score brut durée (0-10). */
  duration: number;
  /** Score brut basé sur le delta ADR historique (0-20). */
  historicAdr: number;
  /** Score brut basé sur le delta TO historique (0-20). */
  historicOccupancy: number;
  /** Score brut rareté / récurrence (0-10). */
  rarity: number;
  /** Score brut prestige (0-5). */
  prestige: number;
}

/** Résultat du calcul Event Impact Score. */
export interface EventImpactScore {
  /** Score final 0-100. */
  score: number;
  /** Classification métier (palier). */
  classification:
    | 'extreme_compression'   // 90-100
    | 'very_high_tension'     // 75-89
    | 'adr_lift_likely'       // 60-74
    | 'watch'                  // 40-59
    | 'low_impact';            // <40
  /** Détail explicable des contributions. */
  breakdown: EventImpactBreakdown;
  /** Niveau d'impact compatible avec le module Événements actuel. */
  legacyLevel: EventImpactLevel;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. EVENT RELIABILITY SCORE                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Comparaison prévu vs réel sur un événement passé. */
export interface EventActualVsForecast {
  /** Période de référence (ex: édition précédente). */
  edition: string;
  /** Date de l'édition observée. */
  observedAt: string;
  /** Prévu — données issues du moteur au moment du forecast. */
  forecast: {
    occupancyDelta: number;
    adrDelta: number;
    revparDelta: number;
    compression: number;
  };
  /** Réel — observé après l'édition. */
  actual: {
    occupancyDelta: number;
    adrDelta: number;
    revparDelta: number;
    compression: number;
  };
}

/** Erreur de prévision moyenne par dimension (en points de %). */
export interface ForecastError {
  occupancy: number;
  adr: number;
  revpar: number;
  compression: number;
}

/** Reliability d'un événement — calculée sur l'historique. */
export interface EventReliabilityScore {
  /** Identifiant logique de l'événement (slug ou famille). */
  eventKey: string;
  /** Nombre d'éditions observées. */
  editionsObserved: number;
  /** Score de fiabilité 0-100 (100 = prévisions toujours justes). */
  score: number;
  /** Erreur moyenne par dimension. */
  meanError: ForecastError;
  /** Moyenne historique d'impact réel — sert de prior pour les prévisions. */
  historicLift: {
    occupancyDelta: number;
    adrDelta: number;
    revparDelta: number;
    compression: number;
  };
  /** Tendance d'impact (croissante / stable / déclinante). */
  trend: 'rising' | 'stable' | 'declining';
  /** L'événement est-il candidat à priorisation l'année suivante ? */
  shouldPrioritizeNextEdition: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. MARKET VELOCITY INDEX                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/** Mesures d'un point de marché à une date donnée. */
export interface MarketSnapshot {
  date: string;
  capturedAt: string;
  /** Médiane compset retenue (€). */
  compsetMedian: number;
  /** Notre prix BAR principal (€). */
  ourPrice: number;
  /** % disponibilité compset (1 = 100% des hôtels ont du stock). */
  availability: number;
  /** % hôtels appliquant Min Stay. */
  minStayShare: number;
  /** % hôtels appliquant CTA/CTD. */
  ctaCtdShare: number;
  /** % hôtels ayant fermé les tarifs flexibles. */
  flexibleClosedShare: number;
  /** % hôtels ayant fermé une OTA majeure. */
  otaClosedShare: number;
  /** Pickup observé sur la fenêtre J/J-1 (réservations). */
  pickup: number;
  /** % hôtels ayant fait disparaître une catégorie chambre. */
  inventoryShrinkShare: number;
}

/** Comparaison à différentes échelles temporelles. */
export interface MarketDeltaSet {
  /** vs J-1. */
  d1: number;
  /** vs J-3. */
  d3: number;
  /** vs J-7. */
  d7: number;
  /** vs J-14. */
  d14: number;
  /** vs J-30. */
  d30: number;
}

/** Métriques de vélocité — vitesse à laquelle le marché évolue. */
export interface MarketVelocity {
  date: string;
  /** Vitesse d'augmentation ADR (points / jour, lissée). */
  adrVelocity: number;
  /** Vitesse de disparition du stock (points / jour). */
  inventoryDepletionVelocity: number;
  /** Accélération compression (delta velocity / jour). */
  compressionAcceleration: number;
  /** Accélération pickup. */
  pickupAcceleration: number;
  /** Deltas multi-échelles pour la médiane. */
  medianDelta: MarketDeltaSet;
  /** Deltas multi-échelles pour la dispo. */
  availabilityDelta: MarketDeltaSet;
  /** Index global 0-100 — synthétique pour radar. */
  velocityIndex: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. MARKET COMPRESSION ENGINE                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Type de compression détectée. */
export type CompressionScope =
  | 'localized'   // un quartier / cluster
  | 'global'      // toute la place
  | 'luxury'
  | 'midscale'
  | 'budget';

/** Score compression 0-100 + détail. */
export interface MarketCompressionScore {
  date: string;
  scope: CompressionScope;
  /** Score 0-100 — pondération métier. */
  score: number;
  classification:
    | 'no_compression'    // <20
    | 'soft'              // 20-39
    | 'building'          // 40-59
    | 'strong'            // 60-79
    | 'extreme';          // 80+
  /** Contributions détaillées (somme ≈ score). */
  contributions: {
    medianLift: number;             // 0-25
    availabilityDrop: number;       // 0-20
    minStay: number;                // 0-15
    ctaCtd: number;                 // 0-10
    flexibleClosed: number;         // 0-10
    pickupAcceleration: number;     // 0-10
    luxuryLift: number;             // 0-5
    budgetLift: number;             // 0-5
  };
  /** Clusters dont la compression dépasse le seuil. */
  affectedClusters: HotelCluster[];
  /** Snapshot ayant servi au calcul. */
  snapshot: MarketSnapshot;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. CORRÉLATION ÉVÉNEMENT ↔ MARCHÉ                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Réaction marché observée pendant la fenêtre d'un événement.
 * Permet d'attribuer (ou non) la pression marché à l'événement.
 */
export interface EventMarketReaction {
  eventId: string;
  /** Score 0-100 — l'événement explique-t-il la pression observée ? */
  attributionScore: number;
  /** Pression marché observée (max sur la fenêtre). */
  observedPressure: number;
  /** Compression observée. */
  observedCompression: MarketCompressionScore | null;
  /** Vélocité observée. */
  observedVelocity: MarketVelocity | null;
  /** Snapshots de référence pré-événement vs in-event. */
  preEventSnapshot: MarketSnapshot | null;
  inEventSnapshot: MarketSnapshot | null;
  /** Signaux qui ont déclenché l'attribution. */
  signals: MarketSignal[];
}

/** Signal détectable par le moteur — explicable. */
export interface MarketSignal {
  /** Code court (utilisé en UI). */
  code:
    | 'median_lift'
    | 'availability_drop'
    | 'min_stay_spread'
    | 'cta_ctd_spread'
    | 'flex_closure'
    | 'ota_closure'
    | 'inventory_shrink'
    | 'pickup_burst'
    | 'luxury_lift'
    | 'budget_lift';
  /** Libellé humain. */
  label: string;
  /** Intensité 0-100. */
  intensity: number;
  /** Confiance 0-100. */
  confidence: number;
  /** Détail chiffré (varie selon le code). */
  detail: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 7. CONFIDENCE / ANTI-BRUIT                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Facteurs de confiance — score 0-100 par facteur. */
export interface ConfidenceFactors {
  /** Fiabilité moyenne des sources qui ont remonté l'événement. */
  sourceReliability: number;
  /** Nombre de sources qui confirment l'événement (boost). */
  sourceCoverage: number;
  /** Cohérence date / lieu / catégorie (pénalise les incohérences). */
  dataConsistency: number;
  /** Historique de fiabilité (Reliability Engine). */
  historicalReliability: number;
  /** Qualité des données marché (vs taille compset, freshness). */
  marketDataQuality: number;
  /** Anti-bruit : pénalité si signaux contradictoires. */
  signalCoherence: number;
}

/** Résultat consolidé du moteur Confidence. */
export interface ConfidenceScore {
  score: number;     // 0-100
  factors: ConfidenceFactors;
  /** True si le score franchit le seuil pour autoriser des actions agressives. */
  allowsAggressiveActions: boolean;
  /** Anomalies détectées qui ont fait baisser le score. */
  anomalies: NoiseAnomaly[];
}

/** Anomalie détectée par le filtre anti-bruit. */
export interface NoiseAnomaly {
  code:
    | 'duplicate_signal'
    | 'price_outlier'
    | 'ghost_event'
    | 'closed_hotel'
    | 'aberrant_price'
    | 'minor_local_event'
    | 'low_audience'
    | 'past_event'
    | 'contradictory_signals'
    | 'low_source_count';
  severity: 'info' | 'warning' | 'critical';
  detail: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 8. RECOMMANDATIONS RMS — EXPLICABLES                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/** Type de recommandation RMS pilotée par l'événement. */
export type RmsRecommendationType =
  | 'bar_lift'              // hausse BAR statique
  | 'dynamic_lift'          // hausse dynamique progressive
  | 'close_promotions'      // fermer promos
  | 'close_ota'             // fermer une OTA
  | 'min_stay'              // imposer Min Stay
  | 'cta'                   // Close To Arrival
  | 'ctd'                   // Close To Departure
  | 'open_premium'          // ouvrir catégories premium
  | 'los_restrictions'      // restrictions longueur séjour
  | 'reduce_allotments'     // réduire allotements OTA
  | 'controlled_overbooking'
  | 'inventory_protection';

export type RmsRecommendationSeverity = 'soft' | 'standard' | 'aggressive' | 'maximum';

/** Cause / explication d'une recommandation RMS. */
export interface RmsRecommendationCause {
  /** Code court (réf. signal ou métrique). */
  code: string;
  /** Libellé humain : "Compression marché détectée". */
  label: string;
  /** Détail chiffré : "+18% médiane marché en 7 jours". */
  detail: string;
  /** Poids dans la décision (0-1, somme ≈ 1). */
  weight: number;
}

/** Recommandation RMS finale — entièrement explicable. */
export interface RmsRecommendation {
  id: string;
  /** Date cible (ou plage). */
  targetDate: string;
  targetEndDate?: string;
  type: RmsRecommendationType;
  severity: RmsRecommendationSeverity;
  /** Libellé court ("Hausse BAR +14% sur la fenêtre Roland-Garros"). */
  title: string;
  /** Suggestion chiffrée (ex: +14 pour +14%, 2 pour Min Stay 2 nuits). */
  suggestedValue: number;
  suggestedUnit: 'percent' | 'nights' | 'flag';
  /** Causes explicables (ordonnées par poids décroissant). */
  causes: RmsRecommendationCause[];
  /** Événements qui ont motivé la reco. */
  drivingEventIds: string[];
  /** Confidence agrégée 0-100. */
  confidence: number;
  /** Compression détectée (snapshot). */
  compression?: MarketCompressionScore;
  /** Vélocité détectée (snapshot). */
  velocity?: MarketVelocity;
  /** Émise à. */
  emittedAt: string;
  /** Expire à (pour éviter d'agir sur des recos obsolètes). */
  expiresAt: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 9. DASHBOARD INTELLIGENCE MARCHÉ                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/** État synthétique d'une date pour la heatmap. */
export interface MarketHeatmapCell {
  date: string;
  compression: number;
  velocity: number;
  eventCount: number;
  topEventId: string | null;
  classification: MarketCompressionScore['classification'];
}

/** Alerte intelligence marché. */
export interface MarketIntelligenceAlert {
  id: string;
  emittedAt: string;
  level: 'info' | 'warning' | 'critical';
  code:
    | 'brutal_compression'
    | 'abnormal_variation'
    | 'stock_disappearance'
    | 'critical_event_detected'
    | 'market_restrictions_change'
    | 'pickup_acceleration'
    | 'reliability_drift';
  title: string;
  detail: string;
  /** Référence aux entités impliquées. */
  refs: {
    eventIds?: string[];
    dates?: string[];
    cluster?: HotelCluster;
  };
}

/** Forecast d'impact pour une fenêtre. */
export interface MarketImpactForecast {
  date: string;
  expectedAdrLift: number;
  expectedOccupancyLift: number;
  expectedCompression: number;
  confidence: number;
  /** Événements qui contribuent au forecast. */
  contributingEventIds: string[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 10. CONTEXT — événement enrichi + scores                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Vue enrichie d'un événement : tout ce qu'on calcule à partir d'un
 * `RMSMarketEvent` + données marché. C'est ce que consomme l'UI premium.
 */
export interface EnrichedMarketEvent {
  event: RMSMarketEvent;
  enrichment: EventEnrichment;
  impactScore: EventImpactScore;
  reliability: EventReliabilityScore | null;
  confidence: ConfidenceScore;
  /** Catégorie inférée pour le routing UI (peut différer de event.category). */
  inferredCategory: EventCategory;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 11. CONSTANTES MÉTIER                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/** Pondérations du Event Impact Score (somme = 100). */
export const EVENT_IMPACT_WEIGHTS = {
  audience: 20,
  international: 15,
  duration: 10,
  historicAdr: 20,
  historicOccupancy: 20,
  rarity: 10,
  prestige: 5,
} as const;

/** Pondérations du Market Compression Score (somme = 100). */
export const COMPRESSION_WEIGHTS = {
  medianLift: 25,
  availabilityDrop: 20,
  minStay: 15,
  ctaCtd: 10,
  flexibleClosed: 10,
  pickupAcceleration: 10,
  luxuryLift: 5,
  budgetLift: 5,
} as const;

/** Seuil confidence pour actions agressives RMS. */
export const CONFIDENCE_THRESHOLD_AGGRESSIVE = 70;

/** Seuil confidence minimum pour émettre une recommandation. */
export const CONFIDENCE_THRESHOLD_EMIT = 45;

/** Audience par tier (borne inférieure incluse). */
export const AUDIENCE_TIER_THRESHOLDS: Record<AudienceTier, number> = {
  micro: 0,
  small: 5_000,
  medium: 25_000,
  large: 100_000,
  massive: 300_000,
  mega: 1_000_000,
} as const;

export const AUDIENCE_TIER_LABELS: Record<AudienceTier, string> = {
  micro: 'Micro (<5k)',
  small: 'Petit (5-25k)',
  medium: 'Moyen (25-100k)',
  large: 'Grand (100-300k)',
  massive: 'Massif (300k-1M)',
  mega: 'Méga (1M+)',
};

export const CLIENT_MIX_LABELS: Record<ClientMix, string> = {
  business: 'Business',
  leisure: 'Loisirs',
  luxury: 'Luxe',
  corporate: 'Corporate',
  family: 'Famille',
  gaming_tech: 'Gaming / Tech',
  sports_fans: 'Fans sport',
  diplomatic: 'Diplomatique',
  mixed: 'Mixte',
};

export const REACH_LABELS: Record<EventReach, string> = {
  local: 'Local',
  regional: 'Régional',
  national: 'National',
  international: 'International',
  global: 'Mondial',
};

export const CLUSTER_LABELS: Record<HotelCluster, string> = {
  luxury: 'Luxe',
  upscale: 'Upscale',
  midscale: 'Midscale',
  budget: 'Budget',
  lifestyle: 'Lifestyle',
  business: 'Business',
  leisure: 'Leisure',
  aparthotel: 'Aparthotel',
};

export const RECOMMENDATION_TYPE_LABELS: Record<RmsRecommendationType, string> = {
  bar_lift: 'Hausse BAR',
  dynamic_lift: 'Hausse dynamique',
  close_promotions: 'Fermer promotions',
  close_ota: 'Fermer OTA',
  min_stay: 'Minimum Stay',
  cta: 'Close To Arrival',
  ctd: 'Close To Departure',
  open_premium: 'Ouvrir premium',
  los_restrictions: 'Restrictions LOS',
  reduce_allotments: 'Réduire allotements',
  controlled_overbooking: 'Surbooking contrôlé',
  inventory_protection: 'Protection inventaire',
};

export const COMPRESSION_CLASSIFICATION_LABELS: Record<
  MarketCompressionScore['classification'],
  string
> = {
  no_compression: 'Pas de compression',
  soft: 'Compression légère',
  building: 'Compression en formation',
  strong: 'Compression forte',
  extreme: 'Compression extrême',
};
