/**
 * FLOWTYM RMS — Domain types for the Events module
 *
 * Couvre :
 *   • Le modèle d'événement marché (RMSMarketEvent)
 *   • Les sources de recherche (EventSource)
 *   • Les scores d'impact (ImpactScore) et le Market Pressure Index
 *   • Les logs de synchronisation
 *
 * Ces types alimentent :
 *   • Le module Événements (liste, calendrier, panneau recherche)
 *   • Le moteur RMS (pression marché, recommandations, alertes)
 *   • La veille concurrentielle, le calendrier tarifaire, le planning
 */

export type EventImpactLevel =
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'hyper_compression';

export type EventCategory =
  | 'salon'
  | 'congress'
  | 'sport'
  | 'concert'
  | 'culture'
  | 'fashion'
  | 'festival'
  | 'holiday'
  | 'school_break'
  | 'tourism_peak'
  | 'religious'
  | 'political'
  | 'internal'
  | 'manual'
  // ─── Mega Entertainment & Concert Impact ──────────────────────────────
  | 'mega_concert'      // concerts internationaux à très fort impact
  | 'pop_concert'       // pop internationale
  | 'rap_concert'       // rap / hip-hop
  | 'kpop_concert'      // K-Pop
  | 'electro_concert'   // DJ / Electro
  | 'metal_concert'     // hard rock / metal
  | 'world_tour'        // tournée mondiale d'un artiste majeur
  | 'other';

export type EventStatus = 'active' | 'planned' | 'archived' | 'cancelled';

export type SyncFrequency = 'realtime' | '6h' | 'daily' | 'weekly' | 'monthly' | 'manual';

/**
 * Récurrence de l'événement — utile pour l'analyse historique et la
 * prévision (ex: salon annuel, festival biannuel).
 */
export type EventFrequency = 'ponctuel' | 'semestriel' | 'annuel' | 'biannuel';

/**
 * Impact réel observé après l'événement (saisi manuellement par le RM).
 * Sert à l'apprentissage et à la calibration des prévisions.
 */
export interface RealImpact {
  occupancy?: number;   // taux d'occupation observé (delta vs baseline, en %)
  adr?: number;         // ADR observé (delta vs baseline, en %)
  revenue?: number;     // CA observé (delta vs baseline, en %)
  recordedAt?: string;  // ISO
}

export type SourceMethod =
  | 'api'
  | 'rss'
  | 'ical'
  | 'json_feed'
  | 'xml'
  | 'scraping'
  | 'excel'
  | 'csv'
  | 'manual';

/**
 * Source officielle / non officielle utilisée par le moteur de recherche
 * pour collecter les événements d'une ville.
 */
export interface EventSource {
  id: string;
  city: string;
  country: string;
  name: string;
  type: EventCategory | 'multi';
  url?: string;
  method: SourceMethod;
  syncFrequency: SyncFrequency;
  status: 'idle' | 'syncing' | 'ok' | 'error';
  reliabilityScore: number;      // 0-100
  lastSyncAt?: string;            // ISO
  active: boolean;
  apiAvailable: boolean;
  priority: 'recommended' | 'standard' | 'optional';
  notes?: string;
}

/**
 * Coefficients d'impact RMS — alimentent le moteur de recommandations.
 * Tous les coefficients sont en pourcentage (ex: 12 = +12%).
 */
export interface ImpactScore {
  demand: number;      // pression demande
  adr: number;         // pression ADR
  occupancy: number;   // pression TO
  pickup: number;      // pression pickup
  revpar: number;      // pression RevPAR
  compression: number; // compression marché 0-100
  confidence: number;  // confiance IA 0-100
  level: EventImpactLevel;
}

export interface EventHistoryEntry {
  at: string;          // ISO timestamp
  action: 'created' | 'updated' | 'synced' | 'merged' | 'imported' | 'manual_edit';
  source?: string;
  diff?: string;
}

/**
 * Événement marché — entité centrale du module.
 * Un même événement peut provenir de plusieurs sources (fusion).
 */
export interface RMSMarketEvent {
  id: string;
  name: string;
  category: EventCategory;
  status: EventStatus;

  city: string;
  zone?: string;        // ex: "Porte de Versailles", "Paris 16e"
  venue?: string;
  country: string;

  startDate: string;    // ISO YYYY-MM-DD
  endDate: string;      // ISO YYYY-MM-DD

  impact: ImpactScore;
  influencePrice: number;  // recommandation prix en %

  description?: string;
  externalId?: string;     // identifiant chez la source
  sources: string[];       // ids EventSource
  primarySource: string;   // libellé court

  attachedHotels?: string[]; // hotelIds éventuels
  linkedStrategies?: string[];
  linkedAlerts?: string[];
  linkedRecommendations?: string[];

  rmsSynced: boolean;
  syncedAt?: string;

  // ─── Historique & analyse ─────────────────────────────────────────────
  frequency?: EventFrequency;
  estimatedVisitors?: number;
  realImpact?: RealImpact;
  internalComment?: string;

  history: EventHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Resultat du moteur d'agrégation pour une période / ville donnée.
 */
export interface EventSearchResult {
  query: {
    city: string;
    fromDate: string;
    toDate: string;
    sourceIds: string[];
    minImpact?: EventImpactLevel;
  };
  ranAt: string;
  events: RMSMarketEvent[];
  duplicatesMerged: number;
  sourcesQueried: number;
  errors: { sourceId: string; message: string }[];
}

/**
 * Index de pression marché agrégé pour un jour donné — utilisé par
 * le RMS et le planning pour cumuler les impacts de plusieurs événements.
 */
export interface MarketPressureIndex {
  date: string;
  eventIds: string[];
  pressure: number;        // 0-100
  level: EventImpactLevel;
  drivers: { eventId: string; weight: number }[];
}

export const IMPACT_LEVEL_ORDER: Record<EventImpactLevel, number> = {
  very_low: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
  hyper_compression: 5,
};

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  salon: 'Salon',
  congress: 'Congrès',
  sport: 'Sport',
  concert: 'Concert',
  culture: 'Culture',
  fashion: 'Fashion',
  festival: 'Festival',
  holiday: 'Jour férié',
  school_break: 'Vacances scolaires',
  tourism_peak: 'Pic touristique',
  religious: 'Religieux',
  political: 'Politique',
  internal: 'Interne',
  manual: 'Manuel',
  mega_concert: 'Méga concert',
  pop_concert: 'Pop',
  rap_concert: 'Rap / Hip-Hop',
  kpop_concert: 'K-Pop',
  electro_concert: 'Electro / DJ',
  metal_concert: 'Metal / Hard Rock',
  world_tour: 'Tournée mondiale',
  other: 'Autre',
};

export const IMPACT_LABELS: Record<EventImpactLevel, string> = {
  very_low: 'Très faible',
  low: 'Faible',
  medium: 'Moyen',
  high: 'Fort',
  critical: 'Critique',
  hyper_compression: 'Hyper Compression',
};
