# Plan — Moteur RMS Enterprise Flowtym

## Objectif
Connecter le nouveau moteur « Règles tactiques » (3 onglets) à tout l'écosystème
Revenue existant via le bus `rms:` afin que chaque action UI déclenche un effet
métier réel : audit, alertes, autopilote, channel manager, calendrier
tarifaire, recommandations, historique des décisions.

## Audit de l'existant (read-only)

### Pages Revenue déjà câblées
| Route | Composant | Statut actuel |
|---|---|---|
| `rev_dashboard` | RevenueDashboard | KPI + sparkline |
| `rev_market` | CompetitiveWatchPage | Lighthouse + Compset (déjà branché) |
| `rev_pricing_reco` | RMSTableauPro | Recommandations + decisions |
| `rev_calendar` | PricingCalendar | Calendrier tarifaire |
| `rev_automation` | YieldAndRules → **TacticalRulesPage** (nouveau) | À connecter |
| `rev_strategies` | StrategiesPage | À connecter (emit `strategy:activated`) |
| `rev_autopilot` | AutopilotPage | À connecter au moteur tactique |
| `rev_simulation` | SimulationPage | À connecter au simulateur |
| `rev_alerts` | AlertsPage | Reçoit déjà `alert:action` |
| `rev_distribution` | DistributionAnalytics | OTA + CM |
| `rev_promotions` | PromotionsCompact | Emit `promotion:*` (déjà branché) |
| `rev_audit` | DecisionHistoryPage | Reçoit `rms-decision:*` (déjà branché) |

### Bus existant `frontend/src/lib/rms/eventBus.ts`
Types disponibles : `promotion:*`, `market-data:imported`, `rms-decision:*`,
`alert:action`, `strategy:activated`.

### Services existants
- `channel-manager.service.ts` : `pushToAllChannels`, `subscribe`, history
- `calendar-pricing.service.ts` : `getPricePerNight`, `getStayBreakdown`
- `rms-calendar-sync.service.ts` : `syncRMSDecision`
- `rms-decisions.service.ts` : `recordRmsDecision` (Supabase persist)
- `rms-propagation.service.ts` : `RMSPropagationService` (validation + push)
- `lighthouse-*.service.ts` : import + persistence
- `salon-events.service.ts` : événements Paris
- `analysis/alerts.service.ts` : watchers + triggers Supabase

### Engines nouveaux (à brancher)
- `tacticalRulesEngine` (10 règles)
- `guardrailsEngine` (12 garde-fous)
- `priorityConflictEngine` (hiérarchie + conflits)
- `rmsRuleEvaluator` (orchestrateur de bout en bout)
- `revenueImpactSimulator`
- `rmsAuditLogger`

---

## Découpage vertical (slices testables)

### Phase 1 — Bus & contrats (fondations)
**T1.1** Étendre `RmsEventMap` avec les événements RMS Enterprise :
- `tactical-rule:triggered`
- `tactical-rule:toggled`
- `guardrail:blocked` / `guardrail:adjusted` / `guardrail:warned`
- `conflict:detected` / `conflict:resolved`
- `priority:reordered`
- `autopilot:pushed` / `autopilot:rollback`
- `recommendation:applied`
- `audit:logged`

**T1.2** Faire émettre ces événements par les engines existants
(tacticalRulesEngine, guardrailsEngine, priorityConflictEngine,
rmsRuleEvaluator, rmsAuditLogger).

**Critères d'acceptation** :
- Toggle d'une règle → événement `tactical-rule:toggled` capté
- Évaluation d'un prix qui passe sous le plancher → événement `guardrail:blocked`
- Reorder hiérarchie → événement `priority:reordered`

---

### Phase 2 — Connexion engines ↔ existant
**T2.1** Quand `market-data:imported` arrive (Lighthouse / Expedia / Events),
`tacticalRulesEngine` re-évalue le contexte marché et recalcule ses KPI.

**T2.2** Quand `strategy:activated` arrive, priorityConflictEngine met à jour
le niveau « Stratégie automatique ».

**T2.3** Quand `promotion:status-changed` arrive, déclencher la règle
`anti_cannibalization` si pression marché élevée.

**T2.4** Quand `tactical-rule:triggered` arrive, alerts.service peut créer un
trigger d'alerte côté UI.

**T2.5** Quand `guardrail:blocked` arrive, AlertsPage affiche un nouvel item.

**Critères** :
- Importer un Lighthouse → KPI des règles bougent
- Activer une stratégie → onglet Priorités l'affiche

---

### Phase 3 — Modals manquantes
**T3.1** Modal « Nouvelle règle » (création tactique) — formulaire complet
(nom, catégorie, déclencheurs, actions, priorité).
**T3.2** Modal « Configurer les priorités » (rebattre les 10 niveaux).
**T3.3** Modal « Nouveau garde-fou » est déjà là mais doit persister via le
store et émettre un événement.
**T3.4** Détail conflit : doit faire un vrai `resolveConflict` + émettre.

**Critères** :
- Créer une 11e règle persiste après refresh tab
- Modifier l'ordre persiste

---

### Phase 4 — Boutons & actions
**T4.1** Bouton « Voir détail » / « Modifier » / « Dupliquer » / « Supprimer »
ouvre la modal détail (déjà fait) et propose vraiment ces actions.
**T4.2** Bouton « Exporter historique » télécharge un CSV.
**T4.3** Filtres catégorie & recherche : déjà fonctionnels (filtrage local).
**T4.4** Toggle ON/OFF règle : déjà fonctionnel via engine.
**T4.5** Bouton « Simuler avant activation » → simulation modale.
**T4.6** Bouton « Simuler le changement » dans onglet 3 : déjà fonctionnel.

---

### Phase 5 — Pipeline Autopilot
**T5.1** AutopilotPage utilise `rmsRuleEvaluator.evaluate()` pour produire
les recommandations pour les 30 prochains jours, agrège règles déclenchées,
conflits, garde-fous.
**T5.2** Bouton « Pousser » → `pushToAllChannels` + `recordRmsDecision` +
émet `autopilot:pushed`.
**T5.3** Bouton « Rollback » → `rmsRuleEvaluator.rollback()` + émet `autopilot:rollback`.

**Critères** :
- Quand autopilote OFF → recommandations affichées en attente
- Quand autopilote ON → poussées avec audit

---

### Phase 6 — Stratégie
**T6.1** StrategiesPage : sélectionner une stratégie active émet
`strategy:activated` + met à jour le contexte marché du moteur tactique.

---

### Phase 7 — Simulation
**T7.1** SimulationPage : sliders pour ajuster `MarketContext` (TO, pickup,
pression marché, événements, prix), affiche en live les règles déclenchées,
les garde-fous activés et la recommandation finale via `rmsRuleEvaluator`.

---

### Phase 8 — Alertes
**T8.1** AlertsPage : nouvelle source = `tactical-rule:triggered`,
`guardrail:blocked`, `conflict:detected` — agrégés dans la liste.

---

### Phase 9 — Decision History
**T9.1** Inclure les événements `autopilot:pushed`, `tactical-rule:triggered`
dans la timeline.

---

### Phase 10 — Bandeau debug + Tests
**T10.1** Composant de test rapide en bas de TacticalRulesPage (en mode dev)
qui permet de :
- évaluer le contexte
- simuler un import market-data
- déclencher manuellement chaque règle
- afficher le journal d'audit

**T10.2** Lancer le serveur, tester chaque onglet, chaque modal, chaque toggle,
chaque bouton. Documenter ce qui marche et ce qui reste mocké.

---

## Périmètre réaliste pour cette session

**Inclus** :
- T1.1, T1.2 (bus étendu)
- T2.1, T2.2, T2.3, T2.4, T2.5 (connexions cross-module)
- T3.1, T3.2 (modals manquantes)
- T4.1 → T4.6 (boutons réels)
- T5.1 (autopilote alimenté par le moteur)
- T7.1 (simulation live)
- T8.1 (alertes connectées)
- T10.1, T10.2 (panneau dev + tests manuels)

**Hors périmètre — restera mocké/documenté** :
- Persistance Supabase des règles tactiques (tables non créées)
- Push Channel Manager réel (provider mock conservé)
- Import Lighthouse côté serveur (parseur existant utilisé tel quel)

---

## Checkpoints

- ✅ Après Phase 1 : `npm run build` passe
- ✅ Après Phase 4 : navigation Onglet 1 → toutes actions cliquables
- ✅ Après Phase 5 : Autopilot ↔ tactical engine OK
- ✅ Après Phase 10 : tour complet du module Revenue OK manuellement
