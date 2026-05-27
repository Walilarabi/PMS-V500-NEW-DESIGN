# TODO — Formulaires typologies & plans tarifaires + Sélecteur partenaire

Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

---

## TASK 1 — constants/partners.ts (34 partenaires)
- [ ] Créer `frontend/src/constants/partners.ts` avec 34 entrées `{id, label, category}`
- [ ] Catégories : `direct`, `ota_global`, `ota_fr`, `gds`, `to`, `other`
- [ ] Exporter `PARTNERS`, `PARTNERS_BY_ID` (Map<id, Partner>), `PARTNER_CATEGORIES`
- [ ] Mettre à jour `constants/channels.ts` → ré-exporter `CHANNELS` depuis `partners.ts`
- [ ] Vérifier `npx tsc --noEmit` sans erreur sur les fichiers constants

## TASK 2 — Store + Supabase persistence
- [ ] Ajouter `partnerIds: string[]` à `RoomTypeData` dans `types/index.ts`
- [ ] Ajouter `partnerIds: string[]` à `RatePlanData` dans `types/index.ts`
- [ ] Créer `services/rms/rmsSupabasePersistence.ts` avec 4 helpers upsert/delete
- [ ] Câbler `addRoomType` → `upsertRoomTypeToSupabase` dans le store
- [ ] Câbler `updateRoomType` → `upsertRoomTypeToSupabase` dans le store
- [ ] Câbler `deleteRoomType` → `deleteRoomTypeFromSupabase` dans le store
- [ ] Câbler `addRatePlan` → `upsertRatePlanToSupabase` dans le store
- [ ] Câbler `updateRatePlan` → `upsertRatePlanToSupabase` dans le store
- [ ] Câbler `deleteRatePlan` → `deleteRatePlanFromSupabase` dans le store
- [ ] Fix `updateRatePlan` : conditionner sur `planId` dans payload, pas `editingPlanId`
- [ ] ✅ CHECKPOINT A : build propre, test create chambre → Supabase

## TASK 3 — RoomManagerPanel : formulaire + harmonisation
- [ ] Remplacer `DIST_CHANNELS` (8) par `PARTNERS` complet (34) avec groupes catégorie
- [ ] Ajouter validation inline : bordure rouge si `name` ou `code` vide
- [ ] Ajouter `isSaving` state + spinner sur bouton submit
- [ ] Ajouter toast succès/erreur (composant inline)
- [ ] Fermeture auto du formulaire après succès (délai 300ms)
- [ ] Bouton Supprimer : confirmation + spinner pendant suppression
- [ ] Harmoniser : `max-w-2xl`, `h-10`, labels `text-xs font-bold uppercase tracking-wider`
- [ ] Tester : créer → annuler → modifier → supprimer

## TASK 4 — RateManagerPanel : fix submit + harmonisation
- [ ] Fix critique : `submit()` utilise `selectedPlanKey` pour update (pas `editingPlanId`)
- [ ] Brancher champ recherche (state `query` → filtre `flatPlans`)
- [ ] Remplacer `DIST_CHANNELS` par `PARTNERS` complet avec groupes
- [ ] Ajouter `primaryPartnerId` dropdown dans le formulaire (obligatoire)
- [ ] Ajouter validation inline (name + code)
- [ ] Ajouter `isSaving` + toast succès/erreur
- [ ] Fermeture auto après succès
- [ ] Vérifier Toggle Actif/Inactif fonctionne dans la liste
- [ ] Vérifier Dupliquer fonctionne + visible dans liste
- [ ] Harmoniser visuellement avec RoomManagerPanel
- [ ] ✅ CHECKPOINT B : les deux panels create/edit/delete fonctionnels

## TASK 5 — RoomTypesPage : CRUD physique
- [ ] Ajouter bouton `+ Nouvelle chambre` → `openRoomPanel()` en mode création
- [ ] Ajouter bouton `Modifier` sur chaque ligne physique → `openRoomPanel(roomTypeId)`
- [ ] Ajouter bouton `Supprimer` sur chaque ligne physique avec confirmation
- [ ] Afficher chips partenaires sur chaque ligne
- [ ] Message CTA si liste vide
- [ ] ✅ CHECKPOINT C partiel : RoomTypesPage CRUD complet

## TASK 6 — RatePlansPage : édition inline + filtre partenaire
- [ ] Bouton `Modifier` sur chaque ligne → `openRatePanel(roomTypeId, planId)`
- [ ] Toggle Actif/Inactif inline → `toggleRatePlanActive()`
- [ ] Ajouter filtre partenaire (dropdown) à côté du filtre chambre
- [ ] Ajouter colonne "Partenaire" dans le tableau
- [ ] Supprimer notes "Phase 1" et "Édition dans le Calendrier" obsolètes
- [ ] ✅ CHECKPOINT C : pages Paramètres 100% opérationnelles

## TASK 7 — ReservationFormModal : sélecteur partenaire + filtrage plans
- [ ] Remplacer `channel` select (5 options) par `partner` select (34 groupés)
- [ ] Auto-renseigner `channel` et `partnerName` à partir du partenaire choisi
- [ ] Construire liste plans : `allPlans.filter(p => p.partnerIds.includes(partnerId))`
- [ ] Afficher message si aucun plan disponible pour ce partenaire
- [ ] Brancher `getStayBreakdown()` quand plan + dates → afficher montant calculé
- [ ] Ajouter warning (non bloquant) si partenaire ou plan manquant
- [ ] ✅ CHECKPOINT D partiel : filtrage partenaire→plan opérationnel

## TASK 8 — Synchronisation & contrôles finaux
- [ ] Vérifier `useSupabaseSync` recharge `partner_ids` dans les mappings
- [ ] Vérifier Planning affiche nouvelles typologies
- [ ] Vérifier Calendrier tarifaire affiche nouveaux plans
- [ ] `npx tsc --noEmit` → 0 erreur dans les fichiers touchés
- [ ] `npm run build` → succès
- [ ] Commit `feat(forms): room types + rate plans overhaul, 34 partners, Supabase persistence`
- [ ] Push `main`
- [ ] ✅ CHECKPOINT D : livraison complète

---

## Ancienne TODO (Câblage RMS Enterprise)

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
