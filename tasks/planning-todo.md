# Planning Refonte — Todo (par phase)

## Phase 1 — Foundation ← EN COURS
- [ ] 1.1 Migration Supabase : planning_daily_snapshots
- [ ] 1.2 Supprimer PlanningView.tsx (doublon)
- [ ] 1.3 Réécrire PlanningPage.tsx (ex-PlanningViewLive) → Supabase réel
- [ ] 1.4 usePlanningKpis.ts (source unique)
- [ ] 1.5 usePlanningRealtime.ts (Supabase Realtime)

## Phase 2 — Barre KPI
- [ ] 2.1 PlanningKpiBar.tsx
- [ ] 2.2 usePickup.ts
- [ ] 2.3 useMarketCompression.ts
- [ ] 2.4 Service snapshot (auto write)
- [ ] 2.5 Intégration dans PlanningPage

## Phase 3 — Colonnes Journalières
- [ ] 3.1 PlanningDayColumn.tsx
- [ ] 3.2 useForecast.ts

## Phase 4 — Badges
- [ ] 4.1 ReservationBar.tsx (badges)
- [ ] 4.2 RoomRowLabel.tsx (HK + maintenance)
- [ ] 4.3 Intégration PlanningGrid

## Phase 5 — Sidebars
- [ ] 5.1 planningUiStore.ts
- [ ] 5.2 Left sidebar collapsible
- [ ] 5.3 Right sidebar collapsible

## Phase 6 — RMS + Chambres Libres
- [ ] 6.1 RmsRecommendationPanel.tsx
- [ ] 6.2 FreeRoomsModal.tsx
- [ ] 6.3 useRmsRecommendations.ts

## Phase 7 — 5 Modes
- [ ] 7.1 PlanningModeBar.tsx
- [ ] 7.2 Styles par mode (ReservationBar + RoomRowLabel)
- [ ] 7.3 Mode Housekeeping (actions rapides)
- [ ] 7.4 Mode Maintenance (fond rayé)

## Phase 8 — Performance
- [ ] 8.1 Virtualisation lignes chambre
- [ ] 8.2 useMemo + useCallback agressifs
- [ ] 8.3 Optimistic updates drag-move
- [ ] 8.4 Lazy loading modales
- [ ] 8.5 Batch snapshot writes
- [ ] 8.6 Realtime throttle 500ms
