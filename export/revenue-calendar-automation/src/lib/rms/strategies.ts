/**
 * FLOWTYM RMS — Catalogue des stratégies tarifaires.
 *
 * Source unique de vérité pour les 7 stratégies RMS : métadonnées
 * d'affichage + profil de scoring exploité par le moteur de sélection
 * automatique (`autoStrategyEngine`).
 */

import type { LucideIcon } from 'lucide-react';
import { Swords, Shield, Scale, Crown, BedDouble, Clock, Flame } from 'lucide-react';

export type StrategyId =
  | 'aggressive'
  | 'defensive'
  | 'balanced'
  | 'premium'
  | 'fill'
  | 'lastminute'
  | 'compression';

/** Signaux marché temps réel exploités par le moteur de sélection. */
export type SignalKey =
  | 'occupancy'
  | 'pickup'
  | 'leadTime'
  | 'marketPressure'
  | 'eventIntensity'
  | 'compsetTrend'
  | 'bookingPace'
  | 'segmentMix'
  | 'historyIndex'
  | 'futureDemand'
  | 'otaTrend'
  | 'marketCompression';

/** Terme de scoring : un signal favorise la stratégie selon une direction. */
export interface ScoringTerm {
  key: SignalKey;
  /** `high` = signal élevé favorable, `low` = signal bas favorable, `mid` = valeur médiane favorable. */
  ideal: 'high' | 'low' | 'mid';
  weight: number;
}

export interface StrategyInfo {
  id: StrategyId;
  name: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  description: string;
  params: { label: string; value: string }[];
  metrics: { label: string; value: string; tone: 'up' | 'down' | 'flat' }[];
  /** Profil de scoring — combinaison de signaux qui rendent la stratégie pertinente. */
  profile: ScoringTerm[];
}

export const STRATEGIES: StrategyInfo[] = [
  {
    id: 'aggressive',
    name: 'Agressif',
    tagline: 'Maximiser le RevPAR',
    icon: Swords,
    accent: '#EF4444',
    description:
      "Hausses tarifaires rapides dès que la demande progresse. Capte le revenu sur les pics, accepte une occupation plus basse.",
    params: [
      { label: 'Élasticité prix', value: 'Haute' },
      { label: 'Seuil de hausse', value: 'Demande > 60 %' },
      { label: 'Plafond tarifaire', value: '+35 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+12 %', tone: 'up' },
      { label: 'ADR', value: '+18 %', tone: 'up' },
      { label: 'Occupation', value: '-6 pts', tone: 'down' },
    ],
    profile: [
      { key: 'marketPressure', ideal: 'high', weight: 0.9 },
      { key: 'futureDemand', ideal: 'high', weight: 0.85 },
      { key: 'bookingPace', ideal: 'high', weight: 0.7 },
      { key: 'eventIntensity', ideal: 'high', weight: 0.55 },
      { key: 'occupancy', ideal: 'high', weight: 0.5 },
    ],
  },
  {
    id: 'defensive',
    name: 'Défensif',
    tagline: "Sécuriser l'occupation",
    icon: Shield,
    accent: '#2563EB',
    description:
      "Tarifs prudents pour protéger le taux de remplissage. Privilégie la stabilité du volume sur les marchés incertains.",
    params: [
      { label: 'Élasticité prix', value: 'Basse' },
      { label: 'Seuil de baisse', value: 'Demande < 45 %' },
      { label: 'Plancher tarifaire', value: '-20 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+3 %', tone: 'up' },
      { label: 'ADR', value: '-4 %', tone: 'down' },
      { label: 'Occupation', value: '+9 pts', tone: 'up' },
    ],
    profile: [
      { key: 'bookingPace', ideal: 'low', weight: 0.9 },
      { key: 'futureDemand', ideal: 'low', weight: 0.85 },
      { key: 'otaTrend', ideal: 'low', weight: 0.65 },
      { key: 'compsetTrend', ideal: 'low', weight: 0.55 },
      { key: 'marketPressure', ideal: 'low', weight: 0.5 },
    ],
  },
  {
    id: 'balanced',
    name: 'Équilibré',
    tagline: 'RevPAR & occupation',
    icon: Scale,
    accent: '#8B5CF6',
    description:
      "Compromis entre prix et volume. Ajuste les tarifs progressivement en suivant la médiane compset et la demande marché.",
    params: [
      { label: 'Élasticité prix', value: 'Modérée' },
      { label: 'Référence', value: 'Médiane compset' },
      { label: 'Amplitude', value: '±15 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+7 %', tone: 'up' },
      { label: 'ADR', value: '+5 %', tone: 'up' },
      { label: 'Occupation', value: '+2 pts', tone: 'up' },
    ],
    profile: [
      { key: 'marketPressure', ideal: 'mid', weight: 0.8 },
      { key: 'bookingPace', ideal: 'mid', weight: 0.75 },
      { key: 'futureDemand', ideal: 'mid', weight: 0.7 },
      { key: 'occupancy', ideal: 'mid', weight: 0.6 },
      { key: 'compsetTrend', ideal: 'mid', weight: 0.5 },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Positionnement haut de gamme',
    icon: Crown,
    accent: '#D97706',
    description:
      "Maintient un tarif au-dessus du compset pour préserver l'image de marque. Refuse la course au prix bas.",
    params: [
      { label: 'Position cible', value: 'Top 3 compset' },
      { label: 'Écart médiane', value: '+10 à +25 %' },
      { label: 'Discount OTA', value: 'Limité' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+5 %', tone: 'up' },
      { label: 'ADR', value: '+21 %', tone: 'up' },
      { label: 'Occupation', value: '-11 pts', tone: 'down' },
    ],
    profile: [
      { key: 'segmentMix', ideal: 'high', weight: 0.85 },
      { key: 'historyIndex', ideal: 'high', weight: 0.8 },
      { key: 'compsetTrend', ideal: 'high', weight: 0.6 },
      { key: 'occupancy', ideal: 'high', weight: 0.5 },
      { key: 'eventIntensity', ideal: 'high', weight: 0.4 },
    ],
  },
  {
    id: 'fill',
    name: 'Remplissage',
    tagline: "Maximiser l'occupation",
    icon: BedDouble,
    accent: '#16A34A',
    description:
      "Priorité absolue au taux d'occupation. Tarifs attractifs pour écouler l'inventaire sur les périodes creuses.",
    params: [
      { label: 'Objectif occupation', value: '> 92 %' },
      { label: 'Élasticité prix', value: 'Très haute' },
      { label: 'Plancher tarifaire', value: '-30 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+1 %', tone: 'flat' },
      { label: 'ADR', value: '-12 %', tone: 'down' },
      { label: 'Occupation', value: '+16 pts', tone: 'up' },
    ],
    profile: [
      { key: 'occupancy', ideal: 'low', weight: 0.95 },
      { key: 'bookingPace', ideal: 'low', weight: 0.8 },
      { key: 'futureDemand', ideal: 'low', weight: 0.7 },
      { key: 'pickup', ideal: 'low', weight: 0.6 },
      { key: 'marketPressure', ideal: 'low', weight: 0.45 },
    ],
  },
  {
    id: 'lastminute',
    name: 'Dernière minute',
    tagline: 'Capter la demande J / J-3',
    icon: Clock,
    accent: '#0891B2',
    description:
      "Optimise les réservations de dernière minute. Tarifs dynamiques sur la fenêtre courte selon le pickup observé.",
    params: [
      { label: 'Fenêtre', value: 'J à J-3' },
      { label: 'Déclencheur', value: 'Pickup faible' },
      { label: 'Amplitude', value: '±25 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+6 %', tone: 'up' },
      { label: 'ADR', value: '-3 %', tone: 'down' },
      { label: 'Occupation', value: '+8 pts', tone: 'up' },
    ],
    profile: [
      { key: 'leadTime', ideal: 'low', weight: 0.95 },
      { key: 'pickup', ideal: 'low', weight: 0.8 },
      { key: 'occupancy', ideal: 'low', weight: 0.55 },
      { key: 'futureDemand', ideal: 'low', weight: 0.4 },
      { key: 'bookingPace', ideal: 'low', weight: 0.4 },
    ],
  },
  {
    id: 'compression',
    name: 'Compression forte',
    tagline: 'Exploiter la rareté',
    icon: Flame,
    accent: '#DC2626',
    description:
      "Active des hausses marquées quand le marché est en surchauffe et la disponibilité compset faible. Maximise le yield sur événements.",
    params: [
      { label: 'Déclencheur', value: 'Pression > 85 %' },
      { label: 'Élasticité prix', value: 'Extrême' },
      { label: 'Plafond tarifaire', value: '+60 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+19 %', tone: 'up' },
      { label: 'ADR', value: '+34 %', tone: 'up' },
      { label: 'Occupation', value: '-12 pts', tone: 'down' },
    ],
    profile: [
      { key: 'marketCompression', ideal: 'high', weight: 0.95 },
      { key: 'marketPressure', ideal: 'high', weight: 0.85 },
      { key: 'eventIntensity', ideal: 'high', weight: 0.8 },
      { key: 'futureDemand', ideal: 'high', weight: 0.55 },
      { key: 'occupancy', ideal: 'high', weight: 0.5 },
    ],
  },
];

export const STRATEGY_BY_ID: Record<StrategyId, StrategyInfo> = STRATEGIES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<StrategyId, StrategyInfo>,
);
