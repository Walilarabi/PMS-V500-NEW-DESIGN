# TODO — Câblage RMS Enterprise

Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

## Phase 1 — Bus & contrats
- [ ] T1.1 Étendre `RmsEventMap` avec les nouveaux événements
- [ ] T1.2 Émission depuis tacticalRulesEngine / guardrailsEngine / priorityConflictEngine / rmsRuleEvaluator / rmsAuditLogger

## Phase 2 — Connexions cross-module
- [ ] T2.1 `market-data:imported` → re-évalue le contexte marché
- [ ] T2.2 `strategy:activated` → met à jour la hiérarchie
- [ ] T2.3 `promotion:status-changed` → ré-évalue anti_cannibalization
- [ ] T2.4 `tactical-rule:triggered` → AlertsPage capte
- [ ] T2.5 `guardrail:blocked` → AlertsPage affiche

## Phase 3 — Modals
- [ ] T3.1 Modal « Nouvelle règle »
- [ ] T3.2 Modal « Configurer les priorités »
- [ ] T3.3 Garde-fou : persistence après création
- [ ] T3.4 Conflit : `resolveConflict` réel

## Phase 4 — Boutons
- [ ] T4.1 Menu kebab (voir / dupliquer / supprimer / historique)
- [ ] T4.2 Export historique CSV
- [ ] T4.5 Bouton « Simuler avant activation »

## Phase 5 — Autopilot
- [ ] T5.1 AutopilotPage utilise rmsRuleEvaluator pour générer les recos
- [ ] T5.2 Bouton « Pousser » → channel-manager + recordDecision
- [ ] T5.3 Bouton « Rollback » → emit rollback

## Phase 6 — Stratégie
- [ ] T6.1 StrategiesPage : sélection → emit strategy:activated

## Phase 7 — Simulation
- [ ] T7.1 SimulationPage : sliders + live evaluation

## Phase 8 — Alertes
- [ ] T8.1 AlertsPage : nouvelle source RMS Enterprise

## Phase 9 — Decision History
- [ ] T9.1 Inclure autopilot:pushed et tactical-rule:triggered

## Phase 10 — Tests
- [ ] T10.1 Bandeau debug RMS dans TacticalRulesPage
- [ ] T10.2 Tests manuels module Revenue de bout en bout
