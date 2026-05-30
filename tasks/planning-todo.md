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
- [ ] 1.3 Rewire PlanningViewLive → données réelles (configRooms/generateOccupancyData mock → useRooms/useReservations + usePlanningKpis) ⏳ PROCHAINE ÉTAPE
- [x] 1.4 planning-kpi.service.ts (source unique) + usePlanningKpis + 20 tests ✅
- [x] 1.5 usePlanningRealtime + publication supabase_realtime (4/4 tables) ✅

### Notes 1.3 (cible technique)
- Fichier : src/pages/PlanningViewLive.tsx (1801 lignes) — routé via App.tsx (`case 'planning'`)
- Réel déjà présent : useReservations(), useRooms(), useFlowday()
- Mock à retirer : useConfigStore() rooms/events/channels + generateOccupancyData()
- Remplacer les calculs KPI internes par usePlanningKpis()
- Brancher usePlanningRealtime() au montage (reservations déjà couvert globalement par App.tsx)

## Phase 2 — Barre KPI compacte (maquette #1, #14)
- [ ] 2.1 PlanningKpiBar.tsx (TO, ADR, RevPAR, Forecast, Pickup Ch, Pickup Rev, Compression, Libres, Events, mini-heatmap)
- [ ] 2.2 usePickup.ts (planning_daily_snapshots J vs J-1)
- [ ] 2.3 useMarketCompression.ts (lighthouse_days.market_demand_percent)
- [ ] 2.4 Service snapshot (écriture auto au chargement si absent < 12h)
- [ ] 2.5 Intégration barre + recherche header + ajout FINANCE au menu

## Phase 3 — Colonnes journalières (maquette #7, #13)
- [ ] 3.1 PlanningDayColumn.tsx (TO%, Forecast, Pickup, Libres, Events + heatmap)
- [ ] 3.2 useForecast.ts (calcul auto)

## Phase 4 — Badges (maquette #3, #4, #5)
- [ ] 4.1 ReservationBar.tsx (badges VIP/payée/PdJ/arrivée/départ/groupe/online/notes)
- [ ] 4.2 RoomRowLabel.tsx (pastille HK + icône maintenance)
- [ ] 4.3 Intégration PlanningGrid

## Phase 5 — Sidebars collapsibles
- [ ] 5.1 planningUiStore.ts (Zustand + localStorage)
- [ ] 5.2 Sidebar gauche collapsible (icônes/étendu, ≤200ms)
- [ ] 5.3 Sidebar droite collapsible

## Phase 6 — RMS + Chambres libres (maquette #8, #17)
- [ ] 6.1 RmsRecommendationPanel.tsx (rms_pricing_recommendations, Appliquer/Rejeter)
- [ ] 6.2 FreeRoomsModal.tsx (liste + créer resa/bloquer/maintenance/statut)
- [ ] 6.3 useRmsRecommendations.ts

## Phase 7 — 5 modes (maquette #9)
- [ ] 7.1 PlanningModeBar.tsx (Occupation/Revenue/Housekeeping/Groupe/Maintenance)
- [ ] 7.2 Styles par mode
- [ ] 7.3 Mode Housekeeping (actions rapides)
- [ ] 7.4 Mode Maintenance (fond rayé)

## Phase 8 — Performance (maquette #12)
- [ ] 8.1 Virtualisation lignes chambre
- [ ] 8.2 useMemo + useCallback agressifs
- [ ] 8.3 Optimistic updates drag-move (persisté en DB)
- [ ] 8.4 Lazy loading modales
- [ ] 8.5 Batch snapshot writes
- [ ] 8.6 Realtime throttle 500ms (fait dans usePlanningRealtime)
