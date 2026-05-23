/**
 * Tests manuels du moteur RMS Enterprise — exécution Node pure.
 *
 * Ne dépend pas de window (le bus a un fallback EventTarget).
 *
 * Lance les scénarios clés et imprime les outputs pour validation visuelle.
 */

// Charge un mini-DOM EventTarget global pour le bus
globalThis.window = globalThis.window || new EventTarget();
globalThis.document = globalThis.document || { createElement: () => ({}) };

// Shim variables d'environnement Vite — supabase.ts throw si elles manquent.
// On fournit des URL bidons : les requêtes vont échouer silencieusement
// (resolveHotelAndUser retourne null hotelId), ce qui est exactement le
// comportement attendu en environnement de test.
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://test.invalid';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key';

// Imports relatifs (alias @/ non disponible en Node sans bundler)
import { tacticalRulesEngine } from '../frontend/src/services/revenue/tacticalRulesEngine';
import { guardrailsEngine } from '../frontend/src/services/revenue/guardrailsEngine';
import { priorityConflictEngine } from '../frontend/src/services/revenue/priorityConflictEngine';
import { rmsRuleEvaluator } from '../frontend/src/services/revenue/rmsRuleEvaluator';
import { rmsAuditLogger } from '../frontend/src/services/revenue/rmsAuditLogger';
import { subscribeRmsEvent } from '../frontend/src/lib/rms/eventBus';

let busEvents = 0;
const types = ['tactical-rule:triggered','tactical-rule:toggled','guardrail:blocked','guardrail:adjusted','priority:reordered','autopilot:pushed','recommendation:produced','audit:logged'];
for (const t of types) subscribeRmsEvent(t, () => { busEvents++; });

const log = (...a) => console.log(...a);

log('━━━ SCENARIO 1 — Contexte calme ━━━');
let r = rmsRuleEvaluator.evaluate({
  autopilot: false,
  context: { occupancy: 50, pickup24h: 2, pickupAverage: 3, leadTimeDays: 12, compsetMedianPrice: 145, ourPrice: 150, marketPressure: 'low', hasMajorEvent: false, daysUntilStay: 12, otaShare: 60, cancellationRate: 6, activeStrategy: 'balanced' },
  basePrice: 150, previousPrice: 148, date: '2026-01-15',
});
log('  Règles appliquées :', r.appliedRules.map(a => a.ruleName).join(', ') || 'aucune');
log('  Garde-fous       :', r.guardrails.triggered.length, 'déclenchés');
log('  Prix final       :', r.recommendedPrice, '€ (base', r.basePrice + ')');

log('\n━━━ SCENARIO 2 — Compression marché + événement ━━━');
r = rmsRuleEvaluator.evaluate({
  autopilot: false,
  context: { occupancy: 88, pickup24h: 8, pickupAverage: 3, leadTimeDays: 4, compsetMedianPrice: 175, ourPrice: 160, marketPressure: 'high', hasMajorEvent: true, daysUntilStay: 3, otaShare: 65, cancellationRate: 4, activeStrategy: 'aggressive' },
  basePrice: 160, previousPrice: 155, date: '2026-06-12',
});
log('  Règles appliquées :', r.appliedRules.map(a => a.ruleName).join(', ') || 'aucune');
log('  Règles suspendues:', r.suppressedRules.map(a => a.ruleName).join(', ') || 'aucune');
log('  Garde-fous       :', r.guardrails.triggered.length);
log('  Prix final       :', r.recommendedPrice, '€');

log('\n━━━ SCENARIO 3 — Prix < plancher (garde-fou bloquant) ━━━');
r = rmsRuleEvaluator.evaluate({
  autopilot: false,
  context: { occupancy: 30, pickup24h: 1, pickupAverage: 3, leadTimeDays: 20, compsetMedianPrice: 90, ourPrice: 100, marketPressure: 'low', hasMajorEvent: false, daysUntilStay: 20, otaShare: 70, cancellationRate: 12, activeStrategy: 'defensive' },
  basePrice: 95, previousPrice: 100, date: '2026-02-10',
});
log('  Prix proposé     :', 95, '€ → final', r.recommendedPrice, '€');
log('  Garde-fous       :', r.guardrails.triggered.map(t => t.guardrail.name).join(', '));
log('  Bloqué           :', !r.guardrails.allowed);

log('\n━━━ SCENARIO 4 — Autopilote ON ━━━');
r = rmsRuleEvaluator.evaluate({
  autopilot: true,
  context: { occupancy: 75, pickup24h: 5, pickupAverage: 3, leadTimeDays: 5, compsetMedianPrice: 165, ourPrice: 160, marketPressure: 'high', hasMajorEvent: true, daysUntilStay: 5, otaShare: 68, cancellationRate: 5, activeStrategy: 'balanced' },
  basePrice: 160, previousPrice: 158, date: '2026-06-15',
});
log('  Poussé            :', r.pushed);
log('  Validation humaine:', r.needsHumanValidation);
log('  Prix final        :', r.recommendedPrice, '€');

log('\n━━━ AUDIT LOG (5 derniers) ━━━');
rmsAuditLogger.all().slice(0, 5).forEach((e, i) => {
  log(`  ${i+1}. [${e.type}] ${e.actor} — ${e.detail}`);
});

log('\n━━━ STATS ENGINES ━━━');
log('  Règles tactiques  :', tacticalRulesEngine.all().length);
log('  Garde-fous actifs :', guardrailsEngine.all().filter(g => g.status === 'active').length);
log('  Hiérarchie        :', priorityConflictEngine.hierarchy().length, 'niveaux');
log('  Conflits          :', priorityConflictEngine.conflicts().length);
log('  Événements bus    :', busEvents);

log('\n━━━ TEST ADD/REMOVE RULE ━━━');
const before = tacticalRulesEngine.all().length;
tacticalRulesEngine.addRule({
  id: 'test_rule',
  name: 'Test règle',
  category: 'demand',
  priority: 99,
  status: 'simulation',
  description: 'test',
  triggers: [{ label: 't', metric: 'occupancy', operator: '>', threshold: 50 }],
  actions: [{ label: 'a', type: 'price_up', magnitude: 0.05 }],
  connectivity: [],
  iaConfidence: 70,
});
log('  Après addRule    :', tacticalRulesEngine.all().length, '(attendu', before + 1, ')');
tacticalRulesEngine.removeRule('test_rule');
log('  Après removeRule :', tacticalRulesEngine.all().length, '(attendu', before, ')');

log('\n━━━ TEST REORDER PRIORITY ━━━');
const ids = priorityConflictEngine.hierarchy().map(h => h.id);
priorityConflictEngine.reorder([ids[1], ids[0], ...ids.slice(2)]);
log('  Priorité 1 après reorder :', priorityConflictEngine.hierarchy()[0].name);
priorityConflictEngine.reorder(ids); // restore
log('  Priorité 1 restaurée     :', priorityConflictEngine.hierarchy()[0].name);

log('\n✅ Tous les scénarios complétés');
