# Planning Refonte — Todo (par phase)

> Référence visuelle : maquette fournie par le client (FLOWTYM Planning — Folkestone Opera).
> Les numéros d'annotation (1-17) de la maquette sont mappés aux phases ci-dessous.

## Mapping maquette → phases
| # maquette | Élément | Phase |
|-----------|---------|-------|
| 1  | Barre KPI compacte | Phase 2 |
| 3  | Statuts des réservations (badges) | Phase 4 |
| 4  | Indicateurs housekeeping (pastilles chambre) | Phase 4 |
| 5  | Maintenance (fond rayé + icône) | Phase 4 / 7 |
| 7  | Compression marché & pickup | Phase 2 / 3 |
| 8  | Chambres libres interactives | Phase 6 |
| 9  | Modes d'affichage (Occupation/Revenue/Ménage/Groupe) | Phase 7 |
| 12 | Drag & drop intelligent | Phase 8 (persisté Phase 1.3) |
| 13 | Heatmap d'occupation | Phase 2 / 3 |
| 14 | Recherche avancée | Phase 2 (header) |
| 17 | Planning Intelligence (RMS) — panneau droit | Phase 6 |
| —  | Sidebar gauche pilotage + sidebar droite | Phase 5 |
| —  | Menu : ajouter FINANCE entre Revenue et Analyse | Phase 2 |

## Phase 1 — Foundation
- [x] 1.1 Migration planning_daily_snapshots (RLS hotel_id) — vérifié en DB ✅
- [x] 1.2 Supprimer PlanningView.tsx (doublon mort, non importé) ✅
- [x] 1.3 Rewire PlanningViewLive → données réelles (useConfigStore mock → useRooms/useEvents/useChannels + usePlanningRealtime) ✅
- [x] 1.4 planning-kpi.service.ts (source unique) + usePlanningKpis + 20 tests ✅
- [x] 1.5 usePlanningRealtime + publication supabase_realtime (4/4 tables) ✅

### Notes 1.3 (cible technique)
- Fichier : src/pages/PlanningViewLive.tsx (1801 lignes) — routé via App.tsx (`case 'planning'`)
- Réel déjà présent : useReservations(), useRooms(), useFlowday()
- Mock à retirer : useConfigStore() rooms/events/channels + generateOccupancyData()
- Remplacer les calculs KPI internes par usePlanningKpis()
- Brancher usePlanningRealtime() au montage (reservations déjà couvert globalement par App.tsx)

## Phase 2 — Barre KPI compacte (maquette #1, #14)
- [x] 2.1 PlanningKpiBar.tsx (TO, ADR, RevPAR, Pickup Ch, Pickup Rev, Compression, Libres, Events, mini-heatmap) ✅ — Forecast déplacé en Phase 3 (useForecast)
- [x] 2.2 usePickup.ts (planning_daily_snapshots J vs J-1) ✅ + 8 tests
- [x] 2.3 useMarketCompression.ts (lighthouse_days.market_demand_percent) ✅
- [x] 2.4 Service snapshot (écriture auto 1×/jour, horizon J+30) ✅ planning-snapshot.service.ts
- [x] 2.5 Intégration barre (mode Gantt) + correction 4 boutons morts ✅ — FINANCE déjà présent au menu (Topbar entre Revenue et Analyse)

## Phase 3 — Colonnes journalières (maquette #7, #13)
- [x] 3.1 Lignes journalières enrichies (TO%, Forecast, Libres, Pickup, ADR, Events) ✅ — intégrées au header sticky (layout row-par-métrique aligné sidebar). Forecast/Pickup chip ajoutés à la barre KPI.
- [x] 3.2 useForecast.ts (calcul auto) ✅ + planning-forecast.service.ts (12 tests). Source unique : days[] dérive désormais de visibleDayKpis (fin de la triple divergence P4).

## Phase 4 — Badges (maquette #3, #4, #5)
- [x] 4.1 ReservationBadges.tsx (VIP/payée/solde dû/PdJ/groupe/online/notes) + service pur deriveBadges (11 tests). Arrivée/départ déjà gérés par chevrons. ✅
- [x] 4.2 RoomRowLabel.tsx (pastille HK clean/dirty/inspected/oos + icône maintenance) ✅
- [x] 4.3 Intégration PlanningGrid + extension useSupabaseSync (payment_status, solde, group_id, checkin_status, special_requests, meal_plan, guests.vip/loyalty) + RoomRow type (housekeeping_status, assigned_to) ✅

## Phase 5 — Sidebars collapsibles
- [x] 5.1 planningUiStore.ts (Zustand + persist localStorage : leftSidebarCollapsed, rightSidebarCollapsed, activeMode) ✅
- [x] 5.2 Colonne gauche collapsible (170px↔68px, transition 200ms, mode icônes via RoomRowLabel compact) + toggle persistant ✅
- [x] 5.3 Sidebar droite collapsible — panneau RMS docké (300px, transition margin) branché sur rightSidebarCollapsed ✅ (livré avec Phase 6)

## Phase 6 — RMS + Chambres libres (maquette #8, #17)
- [x] 6.1 RmsRecommendationPanel.tsx (pending groupées par confiance, loading/error/empty) — Appliquer ÉCRIT rate_prices (chaîne room_type_id→code→ligne→updatePrice verrou optimiste) + marque applied ; Rejeter marque rejected. ✅
- [x] 6.2 FreeRoomsModal.tsx (liste chambres libres du jour + Créer résa préremplie / Bloquer / Maintenance via useUpdateRoom) ✅
- [x] 6.3 useRmsRecommendations.ts (fetch pending range + apply chain + reject, invalidations) + planning-rms.service.ts ✅

## Phase 7 — 5 modes (maquette #9)
- [x] 7.1 PlanningModeBar.tsx (Occupation/Revenue/Housekeeping/Groupe/Maintenance) branché sur planningUiStore (persisté), role=tablist ✅
- [x] 7.2 Styles par mode (sans rechargement) : Revenue=heatmap fond colonnes, Groupe=ring résas groupe + atténue autres ✅
- [x] 7.3 Mode Housekeeping : lignes teintées par statut HK + bouton rapide « Propre » (housekeeping_status→clean, useUpdateRoom) ✅
- [x] 7.4 Mode Maintenance : fond rayé sur chambres maintenance/out_of_order ✅

## Phase 8 — Performance (maquette #12)
- [ ] 8.1 Virtualisation lignes chambre
- [ ] 8.2 useMemo + useCallback agressifs
- [ ] 8.3 Optimistic updates drag-move (persisté en DB)
- [ ] 8.4 Lazy loading modales
- [ ] 8.5 Batch snapshot writes
- [ ] 8.6 Realtime throttle 500ms (fait dans usePlanningRealtime)
