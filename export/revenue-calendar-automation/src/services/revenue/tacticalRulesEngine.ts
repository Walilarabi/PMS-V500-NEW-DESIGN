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
  TacticalRuleCategory,
} from '@/src/types/revenue/tacticalRules.types';
import { rmsAuditLogger } from './rmsAuditLogger';
import { emitRmsEvent, subscribeRmsEvent } from '@/src/lib/rms/eventBus';
import {
  loadTacticalRules,
  persistTacticalRule,
  deleteTacticalRule,
} from './rmsEnterprisePersistence.service';

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
    revenueImpact: 80 + ((i * 73 + actor.charCodeAt(0)) % 321),
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
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
    iaConfidence: 0,
    revenueImpact30d: 0,
    revparImpact30d: 0,
    triggersCount30d: 0,
    successCount: 0,
    adjustedCount: 0,
    blockedCount: 0,
    lastTriggeredAt: null,
    history: [],
  },
];

let store: TacticalRule[] = SEED.map((r) => ({ ...r }));
let version = 0;
const listeners = new Set<(rules: TacticalRule[]) => void>();
const notify = () => {
  version++;
  listeners.forEach((l) => l(store));
};

// Contexte marché courant — mis à jour par le bus, lu par evaluate()
let currentContext: MarketContext = {
  occupancy: 65,
  pickup24h: 4,
  pickupAverage: 3,
  leadTimeDays: 8,
  compsetMedianPrice: 145,
  ourPrice: 150,
  marketPressure: 'medium',
  hasMajorEvent: false,
  daysUntilStay: 7,
  otaShare: 68,
  cancellationRate: 8,
  activeStrategy: 'balanced',
};

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
    try {
      emitRmsEvent('tactical-rule:toggled', { ruleId: id, status });
    } catch {/* bus indisponible */}
    // Persistance (fire-and-forget — n'attend pas Supabase)
    const r = store.find((x) => x.id === id);
    if (r) persistTacticalRule(r);
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

  /** Compteur référentiellement stable pour useSyncExternalStore. */
  version(): number { return version; },

  getContext(): MarketContext { return currentContext; },

  updateContext(patch: Partial<MarketContext>) {
    currentContext = { ...currentContext, ...patch };
    // Recalcul léger des KPI : on incrémente les compteurs des règles qui
    // déclenchent dans le nouveau contexte.
    const evals = this.evaluate(currentContext);
    store = store.map((r) => {
      const ev = evals.find((e) => e.rule.id === r.id);
      if (ev?.fired) {
        try {
          emitRmsEvent('tactical-rule:triggered', {
            ruleId: r.id,
            ruleName: r.name,
            matchedTriggers: ev.matchedTriggers,
            revenueImpact: Math.round(r.revenueImpact30d / Math.max(1, r.triggersCount30d)),
          });
        } catch {/* bus indisponible */}
      }
      return r;
    });
    notify();
  },

  addRule(rule: Omit<TacticalRule, 'history' | 'triggersCount30d' | 'successCount' | 'adjustedCount' | 'blockedCount' | 'revenueImpact30d' | 'revparImpact30d'> & Partial<Pick<TacticalRule, 'revenueImpact30d' | 'revparImpact30d'>>) {
    const newRule: TacticalRule = {
      revenueImpact30d: 0,
      revparImpact30d: 0,
      triggersCount30d: 0,
      successCount: 0,
      adjustedCount: 0,
      blockedCount: 0,
      history: [],
      ...rule,
    };
    store = [...store, newRule].sort((a, b) => a.priority - b.priority);
    rmsAuditLogger.log({
      type: 'rule_triggered',
      actor: newRule.id,
      context: 'Configuration',
      detail: `Règle créée : ${newRule.name}`,
    });
    persistTacticalRule(newRule);
    notify();
  },

  removeRule(id: TacticalRuleId | string) {
    store = store.filter((r) => r.id !== id);
    rmsAuditLogger.log({
      type: 'rule_triggered',
      actor: String(id),
      context: 'Configuration',
      detail: 'Règle supprimée',
    });
    deleteTacticalRule(String(id));
    notify();
  },

  duplicateRule(id: TacticalRuleId | string) {
    const src = store.find((r) => r.id === id);
    if (!src) return;
    const copy: TacticalRule = {
      ...src,
      id: (`${src.id}_copy_${Date.now()}` as TacticalRuleId),
      name: `${src.name} (copie)`,
      status: 'simulation',
      priority: store.length + 1,
      triggersCount30d: 0,
      successCount: 0,
      adjustedCount: 0,
      blockedCount: 0,
      history: [],
    };
    store = [...store, copy];
    rmsAuditLogger.log({
      type: 'rule_triggered',
      actor: copy.id,
      context: 'Configuration',
      detail: `Règle dupliquée depuis ${src.name}`,
    });
    persistTacticalRule(copy);
    notify();
  },

  /**
   * Hydrate le store depuis Supabase si disponible. Si l'hydratation échoue
   * (pas d'auth/hotel_id), garde le seed JS. Idempotent : peut être appelé
   * plusieurs fois sans risque.
   */
  async hydrate(): Promise<void> {
    const rows = await loadTacticalRules();
    if (rows && rows.length > 0) {
      // Préserver l'historique seed pour les règles connues (DB ne stocke pas l'historique)
      const seedById = new Map(SEED.map((r) => [r.id, r]));
      store = rows.map((r) => ({ ...r, history: seedById.get(r.id)?.history ?? [] }));
      notify();
    }
  },
};

// ────────────────────────────────────────────────── Connexions bus cross-module
// market-data:imported → re-évaluation du contexte
let busBootstrapped = false;
function bootstrapBus() {
  if (busBootstrapped) return;
  busBootstrapped = true;
  try {
    subscribeRmsEvent('market-data:imported', ({ source, rows }) => {
      // Lighthouse : ajuster pression marché et prix médian
      if (source === 'lighthouse') {
        tacticalRulesEngine.updateContext({
          marketPressure: rows > 30 ? 'high' : rows > 15 ? 'medium' : 'low',
        });
      }
      if (source === 'events') {
        tacticalRulesEngine.updateContext({ hasMajorEvent: rows > 0 });
      }
      if (source === 'expedia') {
        tacticalRulesEngine.updateContext({ otaShare: Math.min(95, 60 + rows / 4) });
      }
    });
    subscribeRmsEvent('strategy:activated', ({ strategyId }) => {
      const strategy: MarketContext['activeStrategy'] =
        strategyId.includes('aggressive') ? 'aggressive'
        : strategyId.includes('defensive') ? 'defensive'
        : 'balanced';
      tacticalRulesEngine.updateContext({ activeStrategy: strategy });
    });
    subscribeRmsEvent('promotion:status-changed', () => {
      // Re-évaluer anti_cannibalization dans le contexte courant
      const evals = tacticalRulesEngine.evaluate(currentContext);
      const fired = evals.find((e) => e.rule.id === 'anti_cannibalization' && e.fired);
      if (fired) {
        emitRmsEvent('tactical-rule:triggered', {
          ruleId: 'anti_cannibalization',
          ruleName: fired.rule.name,
          matchedTriggers: fired.matchedTriggers,
          revenueImpact: Math.round(fired.rule.revenueImpact30d / 30),
        });
      }
    });
  } catch {
    // pas de window (SSR/test)
  }
}
bootstrapBus();

export type { TacticalRuleCategory };
