# Plan — Formulaires typologies & plans tarifaires + Sélecteur partenaire

**Date :** 2026-05-27  
**Branche :** `main`  
**Scope :** Amélioration profonde des formulaires de création chambre & plan tarifaire, intégration du sélecteur partenaire (34 OTA), cohérence Planning / Calendrier / Réservations.

---

## Contexte & Diagnostic

### Ce qui existe aujourd'hui

| Composant | Localisation | État |
|-----------|-------------|------|
| `RoomManagerPanel` | `components/rms/calendar/` | Drawer CRUD complet — fonctionne dans le Store, **pas de persistance Supabase** |
| `RateManagerPanel` | `components/rms/calendar/` | Drawer CRUD + dupliquer/toggle — **liste partenaires trop courte (8)**, search non branché |
| `RoomTypesPage` | `pages/settings/pages/` | Liste + suppression virtuelles uniquement — **pas de création chambre physique** depuis cette page |
| `RatePlansPage` | `pages/settings/pages/` | Lecture seule + import Excel — **pas d'édition inline fonctionnelle** |
| `ReservationFormModal` | `components/modals/` | Champ `channel` avec 5 options — **pas de filtrage plan par partenaire** |
| `constants/channels.ts` | `constants/` | 5 canaux seulement — **34 partenaires requis** |

### Problèmes racine identifiés

1. **Partner list trop courte** — 8 dans les panels, 5 dans la modal. 34 requis avec IDs stables.
2. **Pas de persistance Supabase** dans `addRoomType` / `updateRoomType` / `addRatePlan` / `updateRatePlan` du store — les données disparaissent au rechargement.
3. **RoomTypesPage ne permet pas de créer une chambre physique** — le bouton `RoomManagerPanel` est présent mais noyé, et la page ne donne pas l'accès direct.
4. **RatePlansPage n'a pas d'édition fonctionnelle inline** — le commentaire l.175 l'admet explicitement.
5. **RateManagerPanel.submit()** : quand `selectedPlanKey` est défini mais `editingPlanId` est null (ouverture depuis la liste, pas depuis la grille), la mise à jour ne se déclenche pas.
6. **ReservationFormModal** : `channel` et `ratePlanId` sont indépendants — aucun filtrage par partenaire.
7. **Absence de relation partenaire → plan tarifaire** dans le store et en base.

---

## Graphe de dépendances

```
TASK 1 — constants/partners.ts
    ↓
TASK 2 — rateCalendarStore (persistance Supabase + actions partenaire)
    ↓              ↓
TASK 3            TASK 4
RoomManagerPanel  RateManagerPanel
(form + persist)  (form + persist + fix submit)
    ↓              ↓
TASK 5 — RoomTypesPage (physique + virtuelle)
TASK 6 — RatePlansPage (édition inline fonctionnelle)
    ↓
TASK 7 — ReservationFormModal (partner selector → plan filter)
    ↓
TASK 8 — Synchronisation & tests finaux
```

---

## Tâches verticales

---

### TASK 1 — Fichier source des 34 partenaires
**Fichier :** `frontend/src/constants/partners.ts`  
**Durée estimée :** 30 min

**Ce qu'on fait :**
- Créer `PARTNERS` : tableau de 34 entrées `{ id, label, logoType?, category }` avec les IDs stables OTA
- Catégories : `'direct'` | `'ota_global'` | `'ota_fr'` | `'gds'` | `'to'` | `'other'`
- Mettre à jour `constants/channels.ts` pour ré-exporter depuis `partners.ts` (rétro-compat)
- Exporter `PARTNERS_BY_ID` (Map pour lookup rapide)

**Critères d'acceptance :**
- [ ] 34 entrées avec IDs uniques stables (slug kebab-case)
- [ ] `import { PARTNERS } from '@/src/constants/partners'` fonctionne sans erreur TS
- [ ] `channels.ts` ré-exporte `CHANNELS` avec les 34 partenaires (sans casser les imports existants)

**Vérification :** `npx tsc --noEmit` sur `constants/` sans erreur

---

### TASK 2 — Store : persistance Supabase + champ `partnerIds`
**Fichiers :** `components/rms/store/rateCalendarStore.ts`, `components/rms/types/index.ts`  
**Durée estimée :** 1h30

**Ce qu'on fait :**

*Types (`index.ts`) :*
- Ajouter `partnerIds: string[]` à `RoomTypeData` (remplace/complète `distributionChannels`)
- Ajouter `partnerIds: string[]` à `RatePlanData` (remplace/complète `distributionChannels`)
- Garder `distributionChannels` pour rétro-compat (alias)

*Store (`rateCalendarStore.ts`) :*
- `addRoomType` : après `safeSet`, appeler `upsertRoomTypeToSupabase(payload)`
- `updateRoomType` : après `safeSet`, appeler `upsertRoomTypeToSupabase(payload)`
- `deleteRoomType` : appeler `deleteRoomTypeFromSupabase(id)` (déjà partiellement fait pour virtuelles)
- `addRatePlan` : après `safeSet`, appeler `upsertRatePlanToSupabase(payload)`
- `updateRatePlan` : après `safeSet`, appeler `upsertRatePlanToSupabase(payload)`
- `deleteRatePlan` : appeler `deleteRatePlanFromSupabase(id)`
- Fix `updateRatePlan` : ne plus conditionner sur `editingPlanId` mais sur le `planId` passé dans le payload

*Supabase helpers (nouveau fichier `services/rms/rmsSupabasePersistence.ts`) :*
```typescript
upsertRoomTypeToSupabase(room: RoomTypeData): Promise<void>
deleteRoomTypeFromSupabase(roomTypeId: string): Promise<void>
upsertRatePlanToSupabase(plan: RatePlanData, roomTypeId: string): Promise<void>
deleteRatePlanFromSupabase(planId: string): Promise<void>
```
Utilise tables : `room_types`, `rate_plans` (hotel_id = tenantId from auth session).

**Critères d'acceptance :**
- [ ] Créer une chambre → visible dans Supabase `room_types` après sauvegarde
- [ ] Créer un plan → visible dans `rate_plans`
- [ ] Rechargement de page → données toujours présentes (Supabase source of truth)
- [ ] `partnerIds` stocké en colonne `partner_ids text[]` dans les deux tables
- [ ] Pas de régression sur les mocks (fallback si Supabase inaccessible)

**Vérification :** créer une chambre, recharger, vérifier présence

---

### TASK 3 — RoomManagerPanel : refonte formulaire + UX harmonisée
**Fichier :** `components/rms/calendar/RoomManagerPanel.tsx`  
**Durée estimée :** 1h30

**Ce qu'on fait :**
- Remplacer `DIST_CHANNELS` (8 items) par `PARTNERS` complet (34 items) avec groupes catégorie
- Ajouter validation visuelle : bordure rouge + message si `name` ou `code` vide au submit
- Ajouter état de chargement `isSaving` pendant la persistance Supabase (bouton spinner)
- Ajouter toast de succès/erreur après save
- Fermer le formulaire automatiquement après succès (avec délai 300ms pour voir le toast)
- Liste mise à jour immédiatement (déjà le cas via store réactif)
- Bouton Supprimer : demander confirmation, puis spinner pendant suppression
- Harmoniser visuellement avec `RateManagerPanel` :
  - Même width formulaire (`max-w-2xl`)
  - Même taille champs (`h-10 py-2`)
  - Même taille labels (`text-xs font-bold uppercase tracking-wider`)
  - Même footer buttons (`flex gap-3 pt-4 border-t`)

**Critères d'acceptance :**
- [ ] Nom vide → bouton disabled + message d'erreur inline
- [ ] Code vide → même traitement
- [ ] Submit → spinner → toast → fermeture automatique
- [ ] Supprimer → confirm dialog → spinner → liste mise à jour
- [ ] MultiCheck partenaires affiche 34 entrées groupées
- [ ] Annuler → retour liste sans modification

---

### TASK 4 — RateManagerPanel : fix submit + harmonisation + 34 partenaires
**Fichier :** `components/rms/calendar/RateManagerPanel.tsx`  
**Durée estimée :** 1h30

**Ce qu'on fait :**
- Fix critique : `submit()` vérifie `selectedPlanKey` ≠ null pour update (pas `editingPlanId`)
- Brancher le champ de recherche (state `query`, filtre sur `flatPlans`)
- Remplacer `DIST_CHANNELS` par `PARTNERS` complet avec groupes
- Ajouter **sélecteur partenaire principal** (`primaryPartnerId`) : dropdown obligatoire qui détermine à quel OTA ce plan appartient
- Ajouter validation (name + code obligatoires) avec messages inline
- Ajouter `isSaving` + toast succès/erreur
- Fermeture auto après succès
- Toggle Actif/Inactif dans la liste → fonctionne sans conditions supplémentaires
- Bouton Dupliquer : visible + fonctionnel (déjà implémenté dans store)
- Harmoniser visuellement avec `RoomManagerPanel` (même structure footer, labels)

**Critères d'acceptance :**
- [ ] Éditer un plan depuis la liste → submit → plan mis à jour dans liste
- [ ] Dupliquer → nouveau plan visible dans liste avec suffixe `-COPY`
- [ ] Toggle Actif/Inactif → badge mis à jour immédiatement
- [ ] Supprimer → confirmation → plan retiré de la liste
- [ ] Recherche text filtre en temps réel
- [ ] `primaryPartnerId` sauvegardé dans le store et en Supabase

---

### TASK 5 — RoomTypesPage : CRUD chambre physique intégré
**Fichier :** `pages/settings/pages/RoomTypesPage.tsx`  
**Durée estimée :** 1h

**Ce qu'on fait :**
- Intégrer le bouton `RoomManagerPanel` correctement dans le header (déjà présent mais doit s'ouvrir directement en mode création)
- Ajouter un bouton `+ Nouvelle chambre` qui appelle `useRateCalendarStore.getState().openRoomPanel()` → ouvre RoomManagerPanel en mode création
- Bouton `Modifier` sur chaque ligne physique (pas seulement virtuelles) → appelle `openRoomPanel(roomTypeId)`
- Bouton `Supprimer` sur chaque ligne physique avec confirmation
- Indicateur "Partenaires" sur chaque ligne : affiche les logos/noms des partenaires assignés
- Mise à jour immédiate de la liste après toute mutation (store réactif)
- Message "Aucune chambre configurée" si liste vide avec bouton CTA

**Critères d'acceptance :**
- [ ] Clic `+ Nouvelle chambre` → ouvre formulaire pré-vide
- [ ] Modifier chambre physique → formulaire pré-rempli, save → liste mise à jour
- [ ] Supprimer chambre physique → confirmation → chambre retirée de la liste
- [ ] Partenaires visibles sur chaque ligne (chips)
- [ ] Lien vers Calendrier tarifaire toujours fonctionnel

---

### TASK 6 — RatePlansPage : édition inline + filtre partenaire
**Fichier :** `pages/settings/pages/RatePlansPage.tsx`  
**Durée estimée :** 1h

**Ce qu'on fait :**
- Bouton `Modifier` sur chaque ligne : ouvre `RateManagerPanel` avec ce plan pré-chargé
  - Appelle `useRateCalendarStore.getState().openRatePanel(roomTypeId, planId)`
- Toggle Actif/Inactif sur chaque ligne → appelle `toggleRatePlanActive` du store
- Ajouter filtre partenaire (dropdown) en plus du filtre chambre existant
- Ajouter colonne "Partenaire principal" dans le tableau
- Supprimer note "Phase 1 — modification rapide" devenue fausse
- Supprimer note "Édition complète... dans le Calendrier tarifaire" — l'édition est maintenant ici aussi

**Critères d'acceptance :**
- [ ] Clic Modifier → RateManagerPanel s'ouvre sur ce plan
- [ ] Toggle Actif → badge mis à jour sans rechargement
- [ ] Filtre partenaire → filtre la liste en temps réel
- [ ] Colonne partenaire principal visible dans le tableau

---

### TASK 7 — ReservationFormModal : sélecteur partenaire + filtrage plans
**Fichier :** `components/modals/ReservationFormModal.tsx`  
**Durée estimée :** 2h

**Ce qu'on fait :**

*Sélecteur partenaire :*
- Remplacer le champ `channel` (5 options) par un `<select>` `partner` avec 34 partenaires (groupés par catégorie)
- Le champ `channel` reste en interne pour compatibilité — se peuple automatiquement à partir du partenaire choisi
- `partnerName` se peuple automatiquement depuis `PARTNERS_BY_ID`

*Filtrage plans tarifaires :*
- Ajouter dropdown `ratePlanId` dans le formulaire (actuellement présent comme champ mais sans liste)
- La liste des plans disponibles = `allPlans.filter(p => p.partnerIds.includes(selectedPartnerId))`
- Si aucun partenaire sélectionné → afficher tous les plans
- Si partenaire sélectionné et aucun plan disponible → message "Aucun plan disponible pour ce partenaire"

*Tarifs depuis le calendrier :*
- Quand un plan est sélectionné + dates renseignées → appeler `getStayBreakdown()` (déjà importé)
- Afficher le tarif calculé dans le champ montant (read-only, avec indicateur "calculé")

*Validation :*
- Partenaire recommandé (warning si manquant, pas bloquant)
- Plan tarifaire recommandé (warning si manquant, pas bloquant)

**Critères d'acceptance :**
- [ ] Sélectionner `Booking.com` → liste des plans filtrée sur plans Booking.com uniquement
- [ ] Sélectionner `Direct` → plans Direct uniquement
- [ ] Aucune sélection → tous les plans visibles
- [ ] Sélectionner plan + dates → montant calculé automatiquement
- [ ] `partnerName` et `channel` auto-renseignés
- [ ] Sauvegarde réservation → `partner_id` stocké dans Supabase (colonne `source`)

---

### TASK 8 — Synchronisation cross-modules & contrôles finaux
**Fichiers :** `hooks/useSupabaseSync.ts`, migrations Supabase si nécessaire  
**Durée estimée :** 1h

**Ce qu'on fait :**
- Vérifier que `useSupabaseSync` recharge les chambres et plans depuis Supabase au login (déjà partiellement fait)
- Ajouter rechargement des `partner_ids` dans le mapping `mapSupabaseRoomToStore` et `mapSupabaseReservationToContext`
- Vérifier que le Planning affiche les nouvelles typologies (via `useConfigStore.updateRooms` — déjà câblé)
- Vérifier que le Calendrier tarifaire affiche les nouveaux plans (via `rateCalendarStore` — déjà câblé)
- Build + TypeScript check complets
- Commit + push

**Critères d'acceptance :**
- [ ] Créer chambre → visible dans Planning immédiatement
- [ ] Créer plan → visible dans Calendrier tarifaire
- [ ] Réservation créée avec partenaire Booking.com → colonne `source` = "Booking.com"
- [ ] Rechargement page → toutes les données persistent
- [ ] `npx tsc --noEmit` → 0 erreur dans les fichiers touchés
- [ ] `npm run build` → succès sans erreur Tailwind

---

## Checkpoints entre phases

```
✅ CHECKPOINT A (après TASK 1+2) :
   → partners.ts importable, store persiste en Supabase

✅ CHECKPOINT B (après TASK 3+4) :
   → Les deux panels fonctionnent de bout en bout (create → save → list update)

✅ CHECKPOINT C (après TASK 5+6) :
   → Pages Paramètres 100% opérationnelles

✅ CHECKPOINT D (après TASK 7+8) :
   → ReservationFormModal avec sélecteur partenaire + filtrage plans
   → Build propre + push
```

---

## Décisions architecturales

| Décision | Choix | Raison |
|----------|-------|--------|
| Relation partenaire→plan | `partnerIds: string[]` sur `RatePlanData` | 1 plan peut être vendu sur plusieurs OTA ; évite une table de jointure |
| Persistance | Helpers Supabase dans `services/rms/` | Séparation claire store ↔ persistance |
| `channels.ts` rétro-compat | Ré-export depuis `partners.ts` | Évite de casser 12+ imports existants |
| Partenaire dans la modal | Dropdown principal, pas multi-select | 1 réservation = 1 source |
| Validation form | Inline (pas de lib externe) | Cohérent avec le reste du codebase |

---

## Fichiers touchés (récapitulatif)

```
NEW   frontend/src/constants/partners.ts
MOD   frontend/src/constants/channels.ts
NEW   frontend/src/services/rms/rmsSupabasePersistence.ts
MOD   frontend/src/components/rms/types/index.ts
MOD   frontend/src/components/rms/store/rateCalendarStore.ts
MOD   frontend/src/components/rms/calendar/RoomManagerPanel.tsx
MOD   frontend/src/components/rms/calendar/RateManagerPanel.tsx
MOD   frontend/src/pages/settings/pages/RoomTypesPage.tsx
MOD   frontend/src/pages/settings/pages/RatePlansPage.tsx
MOD   frontend/src/components/modals/ReservationFormModal.tsx
MOD   frontend/src/hooks/useSupabaseSync.ts
```
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
