/**
 * FLOWTYM — Moteur des règles tactiques RMS
 *
 * Source de vérité unique des 10 règles tactiques.
 * Expose : seed, lecture, mutation (statut, priorité), évaluation contextuelle.
 *
 * Les règles ne remplacent jamais la stratégie globale, elles produisent
 * une INTENTION qui est ensuite filtrée par le moteur de priorités puis par
 * les garde-fous avant d'être appliquée.
 */

import type {
  TacticalRule,
  TacticalRuleId,
  TacticalRuleStatus,
  TacticalRulesKpis,
  MarketContext,
} from '@/src/types/revenue/tacticalRules.types';
import { rmsAuditLogger } from './rmsAuditLogger';

// ───────────────────────────────────────────────────────────── Seed catalogue
const NOW = Date.now();
const dayAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function historySample(actor: string, count: number, outcomeMix: ('success' | 'adjusted' | 'blocked')[]) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: dayAgo(i),
    date: dayAgo(i).slice(0, 10),
    trigger: `Contexte ${actor} détecté`,
    action: `${actor} appliqué`,
    outcome: outcomeMix[i % outcomeMix.length],
    revenueImpact: Math.round(80 + Math.random() * 320),
    explanation: `Règle ${actor} déclenchée sur conditions marché.`,
  }));
}

const SEED: TacticalRule[] = [
  {
    id: 'market_compression',
    name: 'Compression marché',
    category: 'demand',
    priority: 1,
    status: 'active',
    description: 'Exploiter les pics de demande',
    triggers: [
      { label: 'Pression marché haute', metric: 'market_pressure', operator: '>=', threshold: 'high' },
      { label: 'Compset complet', metric: 'compset_availability', operator: '<', threshold: 20 },
      { label: 'Événement majeur', metric: 'has_event', operator: '=', threshold: 1 },
      { label: '↑ recherches OTA', metric: 'ota_search_velocity', operator: '>', threshold: 1.4 },
    ],
    actions: [
      { label: '↑ Prix', type: 'price_up', magnitude: 0.08 },
      { label: 'Fermeture promos', type: 'close_promo' },
      { label: '↑ Min Stay', type: 'min_stay', magnitude: 2 },
    ],
    connectivity: ['Veille concurrentielle', 'Événements', 'Calendrier tarifaire', 'Autopilote'],
    iaConfidence: 92,
    revenueImpact30d: 6820,
    revparImpact30d: 24,
    triggersCount30d: 23,
    successCount: 19,
    adjustedCount: 3,
    blockedCount: 1,
    lastTriggeredAt: dayAgo(0),
    history: historySample('Compression marché', 8, ['success', 'success', 'adjusted', 'success']),
  },
  {
    id: 'abnormal_pickup',
    name: 'Pickup anormal',
    category: 'demand',
    priority: 2,
    status: 'active',
    description: 'Accélération des réservations',
    triggers: [
      { label: 'Pickup > moyenne', metric: 'pickup_vs_avg', operator: '>', threshold: 1.5 },
      { label: 'Hausse 24/48h', metric: 'pickup_24h', operator: '>', threshold: 4 },
    ],
    actions: [
      { label: '↑ Prix', type: 'price_up', magnitude: 0.05 },
      { label: 'Allocation OTA sélective', type: 'ota_limit' },
    ],
    connectivity: ['Réservations', 'Planning', 'Tableau RMS', 'Forecast'],
    iaConfidence: 89,
    revenueImpact30d: 4120,
    revparImpact30d: 15,
    triggersCount30d: 18,
    successCount: 14,
    adjustedCount: 3,
    blockedCount: 1,
    lastTriggeredAt: dayAgo(1),
    history: historySample('Pickup anormal', 6, ['success', 'adjusted']),
  },
  {
    id: 'demand_gap',
    name: 'Trou de demande',
    category: 'demand',
    priority: 3,
    status: 'active',
    description: 'Stimuler les périodes faibles',
    triggers: [
      { label: 'TO faible', metric: 'occupancy', operator: '<', threshold: 45 },
      { label: 'Faible visibilité', metric: 'visibility', operator: '<', threshold: 30 },
      { label: 'Peu de résas', metric: 'pickup', operator: '<', threshold: 1 },
    ],
    actions: [
      { label: 'Promo contrôlée', type: 'open_promo' },
      { label: '↓ Prix limité', type: 'price_down', magnitude: -0.06 },
      { label: 'Push direct', type: 'push_direct' },
    ],
    connectivity: ['Promotions', 'OTA', 'Stratégie', 'Calendrier tarifaire'],
    iaConfidence: 85,
    revenueImpact30d: 3450,
    revparImpact30d: 12,
    triggersCount30d: 31,
    successCount: 25,
    adjustedCount: 4,
    blockedCount: 2,
    lastTriggeredAt: dayAgo(0),
    history: historySample('Trou de demande', 7, ['success', 'adjusted', 'success']),
  },
  {
    id: 'competitive_parity',
    name: 'Parité concurrentielle',
    category: 'pricing',
    priority: 4,
    status: 'active',
    description: 'Rester aligné au marché',
    triggers: [
      { label: 'Écart vs médiane compset', metric: 'price_gap_pct', operator: '>', threshold: 15 },
    ],
    actions: [
      { label: 'Ajustement prix', type: 'price_down', magnitude: -0.04 },
      { label: 'Protection ADR', type: 'block' },
    ],
    connectivity: ['Veille concurrentielle', 'Lighthouse', 'Expedia', 'RMS'],
    iaConfidence: 83,
    revenueImpact30d: 2980,
    revparImpact30d: 9,
    triggersCount30d: 42,
    successCount: 35,
    adjustedCount: 5,
    blockedCount: 2,
    lastTriggeredAt: dayAgo(2),
    history: historySample('Parité concurrentielle', 6, ['adjusted', 'success']),
  },
  {
    id: 'early_bird',
    name: 'Early bird dynamique',
    category: 'pricing',
    priority: 5,
    status: 'active',
    description: 'Stimuler la demande lointaine',
    triggers: [
      { label: 'Faible TO futur J+30/60', metric: 'future_occupancy', operator: '<', threshold: 35 },
      { label: 'Pickup bas', metric: 'pickup', operator: '<', threshold: 1 },
    ],
    actions: [
      { label: 'Promo anticipée', type: 'open_promo' },
      { label: 'Réduction limitée', type: 'price_down', magnitude: -0.08 },
    ],
    connectivity: ['Promotions', 'Calendrier tarifaire', 'Forecast'],
    iaConfidence: 80,
    revenueImpact30d: 2410,
    revparImpact30d: 8,
    triggersCount30d: 15,
    successCount: 11,
    adjustedCount: 3,
    blockedCount: 1,
    lastTriggeredAt: dayAgo(3),
    history: historySample('Early bird', 5, ['success', 'adjusted']),
  },
  {
    id: 'smart_last_minute',
    name: 'Last minute intelligent',
    category: 'pricing',
    priority: 6,
    status: 'active',
    description: 'Éviter les chambres vides',
    triggers: [
      { label: 'Dispo élevée J-3/J-1', metric: 'short_term_availability', operator: '>', threshold: 60 },
    ],
    actions: [
      { label: '↓ Prix progressif', type: 'price_down', magnitude: -0.05 },
      { label: 'Push OTA ciblées', type: 'push_direct' },
    ],
    connectivity: ['Planning', 'OTA', 'Autopilote', 'Calendrier tarifaire'],
    iaConfidence: 82,
    revenueImpact30d: 2250,
    revparImpact30d: 7,
    triggersCount30d: 29,
    successCount: 22,
    adjustedCount: 5,
    blockedCount: 2,
    lastTriggeredAt: dayAgo(0),
    history: historySample('Last minute', 6, ['success', 'adjusted', 'blocked']),
  },
  {
    id: 'ota_mix_optimization',
    name: 'Optimisation mix OTA',
    category: 'distribution',
    priority: 7,
    status: 'active',
    description: 'Améliorer la rentabilité',
    triggers: [
      { label: 'Dépendance OTA', metric: 'ota_share', operator: '>', threshold: 75 },
      { label: 'Commissions élevées', metric: 'commission_rate', operator: '>', threshold: 20 },
    ],
    actions: [
      { label: 'Fermeture OTA low-margin', type: 'block' },
      { label: 'Push direct', type: 'push_direct' },
    ],
    connectivity: ['Distribution & OTA', 'Promotions', 'Channel Manager'],
    iaConfidence: 78,
    revenueImpact30d: 1980,
    revparImpact30d: 6,
    triggersCount30d: 22,
    successCount: 17,
    adjustedCount: 4,
    blockedCount: 1,
    lastTriggeredAt: dayAgo(4),
    history: historySample('Optimisation OTA', 5, ['success', 'adjusted']),
  },
  {
    id: 'event_protection',
    name: 'Protection événements',
    category: 'event',
    priority: 8,
    status: 'active',
    description: 'Éviter sous-valorisation',
    triggers: [
      { label: 'Événement majeur, salon, concert', metric: 'has_major_event', operator: '=', threshold: 1 },
    ],
    actions: [
      { label: 'Blocage promos', type: 'close_promo' },
      { label: '↑ Prix', type: 'price_up', magnitude: 0.1 },
      { label: 'LOS, CTA', type: 'min_stay', magnitude: 2 },
    ],
    connectivity: ['Import événements', 'Veille concurrentielle', 'Calendrier tarifaire'],
    iaConfidence: 91,
    revenueImpact30d: 4760,
    revparImpact30d: 16,
    triggersCount30d: 17,
    successCount: 15,
    adjustedCount: 1,
    blockedCount: 1,
    lastTriggeredAt: dayAgo(1),
    history: historySample('Protection événements', 6, ['success']),
  },
  {
    id: 'anti_cannibalization',
    name: 'Anti-cannibalisation',
    category: 'pricing',
    priority: 9,
    status: 'active',
    description: 'Éviter promos destructrices',
    triggers: [
      { label: 'Promo détruit ADR', metric: 'adr_drop', operator: '>', threshold: 8 },
      { label: 'Forte demande', metric: 'market_pressure', operator: '>=', threshold: 'high' },
    ],
    actions: [
      { label: 'Désactivation promo', type: 'close_promo' },
      { label: 'Limitation réduction', type: 'block' },
    ],
    connectivity: ['Promotions', 'Stratégie', 'Recommandations'],
    iaConfidence: 86,
    revenueImpact30d: 1620,
    revparImpact30d: 5,
    triggersCount30d: 26,
    successCount: 20,
    adjustedCount: 4,
    blockedCount: 2,
    lastTriggeredAt: dayAgo(2),
    history: historySample('Anti-cannibalisation', 5, ['success', 'blocked']),
  },
  {
    id: 'rms_anomaly_detection',
    name: 'Détection anomalies RMS',
    category: 'protection',
    priority: 10,
    status: 'active',
    description: 'Protéger contre les erreurs',
    triggers: [
      { label: 'Prix aberrant, import, push, variation', metric: 'anomaly', operator: '=', threshold: 1 },
    ],
    actions: [
      { label: 'Blocage auto', type: 'block' },
      { label: 'Alerte', type: 'alert' },
      { label: 'Rollback', type: 'rollback' },
    ],
    connectivity: ['Imports', 'Audit', 'Channel Manager', 'Logs IA'],
    iaConfidence: 94,
    revenueImpact30d: 1370,
    revparImpact30d: 4,
    triggersCount30d: 14,
    successCount: 12,
    adjustedCount: 1,
    blockedCount: 1,
    lastTriggeredAt: dayAgo(0),
    history: historySample('Anomalies RMS', 4, ['success', 'success', 'blocked']),
  },
];

let store: TacticalRule[] = SEED.map((r) => ({ ...r }));
const listeners = new Set<(rules: TacticalRule[]) => void>();
const notify = () => listeners.forEach((l) => l(store));

// ───────────────────────────────────────────────────────────────── Évaluation
export interface RuleEvaluation {
  rule: TacticalRule;
  fired: boolean;
  matchedTriggers: string[];
  proposedActions: string[];
  explanation: string;
}

function matchesThreshold(metric: number | string | undefined, op: string, threshold: number | string | string[]): boolean {
  if (metric === undefined) return false;
  if (Array.isArray(threshold)) return threshold.includes(String(metric));
  if (typeof threshold === 'string' && typeof metric === 'string') {
    if (op === '=') return metric === threshold;
    if (op === '>=') {
      const order = ['low', 'medium', 'high', 'extreme'];
      return order.indexOf(metric) >= order.indexOf(threshold);
    }
  }
  const m = Number(metric);
  const t = Number(threshold);
  switch (op) {
    case '>': return m > t;
    case '<': return m < t;
    case '>=': return m >= t;
    case '<=': return m <= t;
    case '=': return m === t;
    default: return false;
  }
}

function metricValue(ctx: MarketContext, key: string): number | string | undefined {
  switch (key) {
    case 'market_pressure': return ctx.marketPressure;
    case 'compset_availability': return 100 - ctx.occupancy; // proxy
    case 'has_event': return ctx.hasMajorEvent ? 1 : 0;
    case 'has_major_event': return ctx.hasMajorEvent ? 1 : 0;
    case 'ota_search_velocity': return ctx.pickup24h / Math.max(1, ctx.pickupAverage);
    case 'pickup_vs_avg': return ctx.pickup24h / Math.max(0.1, ctx.pickupAverage);
    case 'pickup_24h': return ctx.pickup24h;
    case 'occupancy': return ctx.occupancy;
    case 'visibility': return Math.max(5, ctx.daysUntilStay);
    case 'pickup': return ctx.pickup24h;
    case 'price_gap_pct': return Math.abs(((ctx.ourPrice - ctx.compsetMedianPrice) / ctx.compsetMedianPrice) * 100);
    case 'future_occupancy': return ctx.occupancy;
    case 'short_term_availability': return 100 - ctx.occupancy;
    case 'ota_share': return ctx.otaShare;
    case 'commission_rate': return 18;
    case 'adr_drop': return Math.max(0, (ctx.compsetMedianPrice - ctx.ourPrice) / ctx.compsetMedianPrice * 100);
    case 'anomaly': return 0;
    default: return undefined;
  }
}

export const tacticalRulesEngine = {
  all(): TacticalRule[] { return store; },

  active(): TacticalRule[] { return store.filter((r) => r.status === 'active'); },

  byId(id: TacticalRuleId): TacticalRule | undefined { return store.find((r) => r.id === id); },

  byCategory(category: string): TacticalRule[] {
    if (category === 'all') return store;
    return store.filter((r) => r.category === category);
  },

  setStatus(id: TacticalRuleId, status: TacticalRuleStatus) {
    store = store.map((r) => (r.id === id ? { ...r, status } : r));
    rmsAuditLogger.log({
      type: 'rule_triggered',
      actor: id,
      context: 'Configuration',
      detail: `Statut → ${status}`,
    });
    notify();
  },

  reorder(ids: TacticalRuleId[]) {
    const map = new Map(store.map((r) => [r.id, r]));
    store = ids
      .map((id, idx) => {
        const r = map.get(id);
        return r ? { ...r, priority: idx + 1 } : null;
      })
      .filter(Boolean) as TacticalRule[];
    notify();
  },

  setPriority(id: TacticalRuleId, priority: number) {
    store = store.map((r) => (r.id === id ? { ...r, priority } : r));
    store.sort((a, b) => a.priority - b.priority);
    notify();
  },

  kpis(): TacticalRulesKpis {
    const active = store.filter((r) => r.status === 'active');
    const revenue = store.reduce((s, r) => s + r.revenueImpact30d, 0);
    const success = store.reduce((s, r) => s + r.successCount, 0);
    const adjusted = store.reduce((s, r) => s + r.adjustedCount, 0);
    const blocked = store.reduce((s, r) => s + r.blockedCount, 0);
    const ia = active.length
      ? Math.round(active.reduce((s, r) => s + r.iaConfidence, 0) / active.length)
      : 0;
    const revenueDelta = revenue > 0 ? 18.6 : 0;
    return {
      activeCount: active.length,
      totalCount: store.length,
      revenue30d: revenue,
      revenueDelta,
      automatedActions30d: success + adjusted + blocked,
      successfulActions: success,
      adjustedActions: adjusted,
      blockedActions: blocked,
      conflictsDetected: 3,
      averageIaConfidence: ia,
    };
  },

  evaluate(context: MarketContext): RuleEvaluation[] {
    return store
      .filter((r) => r.status === 'active')
      .map((rule) => {
        const matched: string[] = [];
        for (const t of rule.triggers) {
          const v = metricValue(context, t.metric);
          if (matchesThreshold(v, t.operator, t.threshold)) {
            matched.push(t.label);
          }
        }
        const fired = matched.length > 0;
        return {
          rule,
          fired,
          matchedTriggers: matched,
          proposedActions: fired ? rule.actions.map((a) => a.label) : [],
          explanation: fired
            ? `${rule.name} déclenchée : ${matched.join(' • ')}.`
            : `${rule.name} non déclenchée dans le contexte actuel.`,
        };
      });
  },

  subscribe(listener: (rules: TacticalRule[]) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
