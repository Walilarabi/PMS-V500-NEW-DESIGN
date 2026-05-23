/**
 * FLOWTYM — Moteur garde-fous RMS
 *
 * Couche de sécurité absolue : aucune décision (règle, stratégie, autopilote,
 * promotion, channel manager) ne doit pouvoir produire une action qui viole un
 * garde-fou bloquant.
 *
 * Niveaux :
 *   - blocking      : bloque toute action contraire
 *   - warning       : laisse passer mais alerte
 *   - auto_adjust   : ajuste automatiquement à la limite autorisée
 */

import type {
  Guardrail,
  GuardrailId,
  GuardrailsKpis,
  GuardrailHierarchyLevel,
} from '@/src/types/revenue/guardrails.types';
import { rmsAuditLogger } from './rmsAuditLogger';
import { emitRmsEvent } from '@/src/lib/rms/eventBus';

const dayAgo = (n: number, h = 0) => new Date(Date.now() - n * 86_400_000 - h * 3_600_000).toISOString();

function blocks(actor: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: dayAgo(i, i * 2),
    date: dayAgo(i).slice(0, 10),
    context: ['Chambre Standard', 'Chambre Supérieure', 'Suite Junior', 'Booking.com'][i % 4],
    requested: `Demande ${actor}`,
    limit: `Limite atteinte`,
    outcome: 'blocked' as const,
    source: (['rule', 'autopilot', 'channel_manager', 'manual'] as const)[i % 4],
  }));
}

const SEED: Guardrail[] = [
  {
    id: 'price_floor',
    name: 'Plancher tarifaire',
    category: 'pricing',
    severity: 'blocking',
    condition: 'Prix ne doit jamais descendre sous le plancher',
    threshold: '110 €',
    thresholdValue: 110,
    action: 'Bloque toute baisse',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 14,
    warningsCount30d: 4,
    adjustmentsCount30d: 0,
    averageDeltaLimited: -3.2,
    history: blocks('Plancher tarifaire', 6),
  },
  {
    id: 'price_ceiling',
    name: 'Plafond tarifaire',
    category: 'pricing',
    severity: 'blocking',
    condition: 'Prix ne doit jamais dépasser le plafond',
    threshold: '350 €',
    thresholdValue: 350,
    action: 'Bloque toute hausse',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 5,
    warningsCount30d: 2,
    adjustmentsCount30d: 0,
    averageDeltaLimited: -1.4,
    history: blocks('Plafond tarifaire', 3),
  },
  {
    id: 'daily_variation_max',
    name: 'Variation max journalière',
    category: 'pricing',
    severity: 'warning',
    condition: 'Variation max autorisée par jour',
    threshold: '±15%',
    thresholdValue: 15,
    action: 'Ajuste à la limite',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 1,
    warningsCount30d: 9,
    adjustmentsCount30d: 7,
    averageDeltaLimited: -2.1,
    history: blocks('Variation max', 5),
  },
  {
    id: 'weekly_variation_max',
    name: 'Variation max hebdomadaire',
    category: 'pricing',
    severity: 'warning',
    condition: 'Variation max autorisée sur 7 jours',
    threshold: '±30%',
    thresholdValue: 30,
    action: 'Ajuste à la limite',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 0,
    warningsCount30d: 3,
    adjustmentsCount30d: 2,
    averageDeltaLimited: -1.6,
    history: blocks('Variation hebdo', 2),
  },
  {
    id: 'adr_minimum',
    name: 'ADR minimum',
    category: 'pricing',
    severity: 'blocking',
    condition: 'ADR ne doit pas descendre sous le seuil',
    threshold: '120 €',
    thresholdValue: 120,
    action: 'Bloque les baisses',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 6,
    warningsCount30d: 3,
    adjustmentsCount30d: 0,
    averageDeltaLimited: -2.7,
    history: blocks('ADR minimum', 4),
  },
  {
    id: 'revpar_minimum',
    name: 'RevPAR minimum',
    category: 'pricing',
    severity: 'warning',
    condition: 'RevPAR ne doit pas descendre sous le seuil',
    threshold: '70 €',
    thresholdValue: 70,
    action: 'Ajuste les prix',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 0,
    warningsCount30d: 5,
    adjustmentsCount30d: 3,
    averageDeltaLimited: -1.9,
    history: blocks('RevPAR min', 3),
  },
  {
    id: 'min_stay_events',
    name: 'Min Stay événements',
    category: 'restriction',
    severity: 'blocking',
    condition: 'Poser un séjour minimum sur événements majeurs',
    threshold: '2 nuits',
    thresholdValue: 2,
    action: 'Applique Min Stay',
    coverage: { scope: 'event', detail: 'Événements majeurs', percentage: 8 },
    status: 'active',
    blocksCount30d: 3,
    warningsCount30d: 1,
    adjustmentsCount30d: 0,
    averageDeltaLimited: 0,
    history: blocks('Min Stay', 2),
  },
  {
    id: 'max_stay_events',
    name: 'Max Stay événements',
    category: 'restriction',
    severity: 'warning',
    condition: 'Limiter la durée max sur événements majeurs',
    threshold: '5 nuits',
    thresholdValue: 5,
    action: 'Applique Max Stay',
    coverage: { scope: 'event', detail: 'Événements majeurs', percentage: 8 },
    status: 'active',
    blocksCount30d: 0,
    warningsCount30d: 2,
    adjustmentsCount30d: 1,
    averageDeltaLimited: 0,
    history: blocks('Max Stay', 1),
  },
  {
    id: 'group_adr_protection',
    name: 'Protection ADR groups',
    category: 'restriction',
    severity: 'blocking',
    condition: 'Groupes ne doivent pas casser l\'ADR',
    threshold: '-10% max',
    thresholdValue: -10,
    action: 'Bloque prix trop bas',
    coverage: { scope: 'segment', detail: 'Groupes & séminaires', percentage: 100 },
    status: 'active',
    blocksCount30d: 4,
    warningsCount30d: 2,
    adjustmentsCount30d: 0,
    averageDeltaLimited: -4.1,
    history: blocks('ADR Groups', 3),
  },
  {
    id: 'occupancy_max',
    name: 'Taux d\'occupation max',
    category: 'availability',
    severity: 'warning',
    condition: 'Ne jamais dépasser le taux d\'occupation max',
    threshold: '95%',
    thresholdValue: 95,
    action: 'Ajuste disponibilité',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 0,
    warningsCount30d: 4,
    adjustmentsCount30d: 3,
    averageDeltaLimited: -1.2,
    history: blocks('TO max', 2),
  },
  {
    id: 'ota_parity',
    name: 'Parité tarifaire OTA',
    category: 'distribution',
    severity: 'blocking',
    condition: 'Ne jamais être < Parité OTA définie',
    threshold: 'Parité 0%',
    thresholdValue: 0,
    action: 'Bloque les tarifs trop bas',
    coverage: { scope: 'channel', detail: 'OTA synchronisées', percentage: 100 },
    status: 'active',
    blocksCount30d: 4,
    warningsCount30d: 1,
    adjustmentsCount30d: 0,
    averageDeltaLimited: -3.6,
    history: blocks('Parité OTA', 3),
  },
  {
    id: 'reputation_protection',
    name: 'Protection réputation',
    category: 'quality',
    severity: 'blocking',
    condition: 'Éviter les prix extrêmes impactant la réputation',
    threshold: 'Indice ≥ 80',
    thresholdValue: 80,
    action: 'Bloque ajustements',
    coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
    status: 'active',
    blocksCount30d: 0,
    warningsCount30d: 2,
    adjustmentsCount30d: 1,
    averageDeltaLimited: -0.8,
    history: blocks('Réputation', 1),
  },
];

const HIERARCHY: GuardrailHierarchyLevel[] = [
  { priority: 1, severity: 'blocking', label: 'Bloquants', description: 'Toujours prioritaires' },
  { priority: 2, severity: 'warning', label: 'Avertissements', description: 'Très prioritaires' },
  { priority: 3, severity: 'auto_adjust', label: 'Ajustements automatiques', description: 'Priorité moyenne' },
  { priority: 4, severity: 'warning', label: 'Informations', description: 'Sans action bloquante' },
];

let store: Guardrail[] = SEED.map((g) => ({ ...g }));
const listeners = new Set<(g: Guardrail[]) => void>();
const notify = () => listeners.forEach((l) => l(store));

// ─────────────────────────────────────────────────────────── Évaluation publique
export interface PriceProposal {
  price: number;
  previousPrice: number;
  occupancy?: number;
  source: 'rule' | 'autopilot' | 'channel_manager' | 'manual' | 'strategy';
  context?: string;
}

export interface GuardrailVerdict {
  allowed: boolean;
  finalPrice: number;
  triggered: { guardrail: Guardrail; outcome: 'blocked' | 'adjusted' | 'warning'; reason: string }[];
}

export const guardrailsEngine = {
  all(): Guardrail[] { return store; },

  byCategory(cat: string): Guardrail[] {
    if (cat === 'all') return store;
    return store.filter((g) => g.category === cat);
  },

  byId(id: GuardrailId): Guardrail | undefined { return store.find((g) => g.id === id); },

  setStatus(id: GuardrailId, status: 'active' | 'paused') {
    store = store.map((g) => (g.id === id ? { ...g, status } : g));
    rmsAuditLogger.log({
      type: 'guardrail_adjust',
      actor: String(id),
      context: 'Configuration',
      detail: `Statut → ${status}`,
    });
    notify();
  },

  upsert(g: Guardrail) {
    const exists = store.some((x) => x.id === g.id);
    store = exists ? store.map((x) => (x.id === g.id ? g : x)) : [...store, g];
    rmsAuditLogger.log({
      type: 'guardrail_adjust',
      actor: g.name,
      context: 'Configuration',
      detail: exists ? 'Garde-fou mis à jour' : 'Garde-fou créé',
    });
    notify();
  },

  remove(id: GuardrailId | string) {
    store = store.filter((g) => g.id !== id);
    rmsAuditLogger.log({
      type: 'guardrail_adjust',
      actor: String(id),
      context: 'Configuration',
      detail: 'Garde-fou supprimé',
    });
    notify();
  },

  hierarchy(): GuardrailHierarchyLevel[] { return HIERARCHY; },

  kpis(): GuardrailsKpis {
    const active = store.filter((g) => g.status === 'active');
    const blocks30 = store.reduce((s, g) => s + g.blocksCount30d, 0);
    const warns30 = store.reduce((s, g) => s + g.warningsCount30d, 0);
    const adjusts30 = store.reduce((s, g) => s + g.adjustmentsCount30d, 0);
    const avgDelta = active.length
      ? active.reduce((s, g) => s + g.averageDeltaLimited, 0) / active.length
      : 0;
    const risk: GuardrailsKpis['globalRisk'] =
      blocks30 > 25 ? 'high' : blocks30 > 10 ? 'medium' : 'low';
    return {
      activeCount: active.length,
      totalCount: store.length,
      blocksCount30d: blocks30 + warns30 + adjusts30,
      globalRisk: risk,
      protectedEvents: 8,
      averageDeltaLimited: avgDelta,
      globalCoverage: 98,
      uncoveredDates: 7,
      totalDates: 365,
    };
  },

  evaluate(proposal: PriceProposal): GuardrailVerdict {
    const triggered: GuardrailVerdict['triggered'] = [];
    let finalPrice = proposal.price;
    let allowed = true;

    for (const g of store.filter((g) => g.status === 'active')) {
      if (g.id === 'price_floor' && proposal.price < g.thresholdValue) {
        if (g.severity === 'blocking') {
          allowed = false;
          finalPrice = Math.max(finalPrice, g.thresholdValue);
          triggered.push({ guardrail: g, outcome: 'blocked', reason: `Prix ${proposal.price}€ < plancher ${g.thresholdValue}€` });
        } else {
          finalPrice = Math.max(finalPrice, g.thresholdValue);
          triggered.push({ guardrail: g, outcome: 'adjusted', reason: `Ajusté à ${g.thresholdValue}€` });
        }
      }
      if (g.id === 'price_ceiling' && proposal.price > g.thresholdValue) {
        if (g.severity === 'blocking') {
          allowed = false;
          finalPrice = Math.min(finalPrice, g.thresholdValue);
          triggered.push({ guardrail: g, outcome: 'blocked', reason: `Prix ${proposal.price}€ > plafond ${g.thresholdValue}€` });
        } else {
          finalPrice = Math.min(finalPrice, g.thresholdValue);
          triggered.push({ guardrail: g, outcome: 'adjusted', reason: `Ajusté à ${g.thresholdValue}€` });
        }
      }
      if (g.id === 'daily_variation_max' && proposal.previousPrice > 0) {
        const variation = ((proposal.price - proposal.previousPrice) / proposal.previousPrice) * 100;
        if (Math.abs(variation) > g.thresholdValue) {
          const sign = variation > 0 ? 1 : -1;
          finalPrice = proposal.previousPrice * (1 + (sign * g.thresholdValue) / 100);
          triggered.push({ guardrail: g, outcome: 'adjusted', reason: `Variation ${variation.toFixed(1)}% limitée à ±${g.thresholdValue}%` });
        }
      }
      if (g.id === 'adr_minimum' && proposal.price < g.thresholdValue) {
        if (g.severity === 'blocking') {
          allowed = false;
          finalPrice = Math.max(finalPrice, g.thresholdValue);
          triggered.push({ guardrail: g, outcome: 'blocked', reason: `ADR ${proposal.price}€ < seuil ${g.thresholdValue}€` });
        }
      }
      if (g.id === 'occupancy_max' && proposal.occupancy && proposal.occupancy > g.thresholdValue) {
        triggered.push({ guardrail: g, outcome: 'warning', reason: `TO ${proposal.occupancy}% > seuil ${g.thresholdValue}%` });
      }
    }

    if (triggered.length > 0) {
      const t = triggered[0];
      rmsAuditLogger.log({
        type: t.outcome === 'blocked' ? 'guardrail_block'
            : t.outcome === 'adjusted' ? 'guardrail_adjust'
            : 'guardrail_warn',
        actor: t.guardrail.name,
        context: proposal.context ?? proposal.source,
        detail: t.reason,
        impact: proposal.price - finalPrice,
      });
      try {
        const payload = {
          guardrailId: t.guardrail.id,
          guardrailName: t.guardrail.name,
          reason: t.reason,
          impact: proposal.price - finalPrice,
          context: proposal.context ?? proposal.source,
        };
        if (t.outcome === 'blocked') emitRmsEvent('guardrail:blocked', payload);
        else if (t.outcome === 'adjusted') emitRmsEvent('guardrail:adjusted', payload);
        else emitRmsEvent('guardrail:warned', {
          guardrailId: t.guardrail.id,
          guardrailName: t.guardrail.name,
          reason: t.reason,
          context: proposal.context ?? proposal.source,
        });
      } catch {/* bus indisponible */}
    }

    return { allowed, finalPrice, triggered };
  },

  subscribe(listener: (g: Guardrail[]) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
