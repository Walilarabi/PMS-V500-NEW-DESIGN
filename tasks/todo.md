# TODO — Câblage RMS Enterprise

Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

## Phase 1 — Bus & contrats
- [x] T1.1 Étendre `RmsEventMap` avec les nouveaux événements
- [x] T1.2 Émission depuis tacticalRulesEngine / guardrailsEngine / priorityConflictEngine / rmsRuleEvaluator / rmsAuditLogger

## Phase 2 — Connexions cross-module
- [x] T2.1 `market-data:imported` → re-évalue le contexte marché
- [x] T2.2 `strategy:activated` → met à jour le contexte (store)
- [x] T2.3 `promotion:status-changed` → ré-évalue anti_cannibalization
- [x] T2.4 `tactical-rule:triggered` → consommé via RmsEnterpriseFeed
- [x] T2.5 `guardrail:blocked` → AlertsPage affiche via RmsEnterpriseFeed

## Phase 3 — Modals
- [x] T3.1 Modal « Nouvelle règle »
- [x] T3.2 Modal « Configurer les priorités »
- [x] T3.3 Garde-fou : upsert/remove persistés
- [x] T3.4 Conflit : `resolveConflict` réel + emit

## Phase 4 — Boutons
- [x] T4.1 Menu kebab (voir / dupliquer / supprimer / historique)
- [x] T4.2 Export historique CSV
- [x] T4.5 Bouton « Simuler avant activation » (via menu kebab)

## Phase 5 — Autopilot
- [x] T5.1 Pipeline complet via rmsRuleEvaluator + widget injectable
- [x] T5.2 Push effectif vers Channel Manager (pushToAllChannels)
- [x] T5.3 Rollback → emit autopilot:rollback

## Phase 6 — Stratégie
- [x] T6.1 setActiveStrategy emit strategy:activated → met à jour le moteur

## Phase 7 — Simulation
- [x] T7.1 TacticalEngineWidget injecté dans SimulationPage

## Phase 8 — Alertes
- [x] T8.1 RmsEnterpriseFeed en haut de AlertsPage

## Phase 9 — Decision History
- [x] T9.1 Écoute autopilot:pushed / rollback / tactical-rule:triggered
- [x] T9.1 RmsEnterpriseFeed en haut de DecisionHistoryPage

## Phase 10 — Tests
- [x] T10.1 Widget Moteur tactique = panneau dev/inspection
- [x] T10.2 4 scénarios pipeline + add/remove + reorder validés via tasks/manual-test-script.mjs

## Bugs corrigés en cours de route
- [x] BUG1 : magnitudes d'actions non-prix (min_stay=2) cumulaient au prix → filtré sur PRICE_ACTION_TYPES

## Améliorations recommandées — implémentées
- [x] #1 Persistance Supabase : migration 20260520_rms_enterprise.sql + service rmsEnterprisePersistence + hydrate dans 4 engines
- [x] #2 AutopilotPage refondu : AutopilotForecastPanel = 30 jours via rmsRuleEvaluator + events Paris + push/rollback
- [x] #3 Conflits dynamiques : priorityConflictEngine.recordRuntimeConflict + déduplication signature + emit conflict:detected
- [x] #4 Tests Vitest : 48 tests / 7 fichiers (initial)
- [x] #5 Recherche/tri/pagination via useDataTable + TablePagination + SortableHeader sur RuleTable et GuardrailTable
- [x] #6 Drag&drop HTML5 dans ConfigurePrioritiesModal (garde-fous verrouillés)
- [x] #7 i18n léger (fr/en) : useT hook, LocaleSwitcher, catalogues FR/EN structurés
- **Final : 61 tests / 9 fichiers ✅**
