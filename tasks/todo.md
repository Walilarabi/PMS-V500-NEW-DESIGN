# TODO — Revenue Calendar Rebuild

**Branche :** `claude/amazing-sagan-NZbfi`  
**Commit :** `fb09e99`  
Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

---

## T1 — pmsLogic.ts : computeDayMetrics + computeMonthlyKPIs ✅
- [x] Ajouter interface `DayMetric` exportée dans `pmsLogic.ts`
- [x] Ajouter interface `MonthMetric` exportée dans `pmsLogic.ts`
- [x] Implémenter `computeDayMetrics(reservations, dateStr, totalRoomsCount): DayMetric`
- [x] Implémenter `computeMonthlyKPIs(reservations, year, month, totalRoomsCount): MonthMetric`
- [x] ADR = CA_total_jour / max(1, nb_réservations_présentes)
- [x] `npx tsc --noEmit` → 0 erreur dans `usePlanningMetrics.ts`
- [x] ✅ CHECKPOINT A-1

## T2 — PlanningView : wirer RevenueCalendar + supprimer ADR aléatoire ✅
- [x] Importer `RevenueCalendar` depuis `./planning/RevenueCalendar`
- [x] Importer `RevenueSubView` depuis `./planning/types`
- [x] Ajouter state `subView: RevenueSubView` avec useState
- [x] Ajouter rendering conditionnel : `displayMode === 'Calendar'` → `<RevenueCalendar .../>`
- [x] Passer props : `monthDate={currentDate}` `startDate={currentDate}` `reservations` `rooms` `events` `subView` `setSubView`
- [x] Remplacer `adr: 120 + Math.floor(Math.random() * 40)` par calcul réel depuis ganttReservations
- [x] `npm run build` → succès
- [x] ✅ CHECKPOINT A-2

## T3 — RevenueCalendar : fix ADR + période + filtres ✅
- [x] Fix ADR : `adr = Math.round(ca / Math.max(1, occRes.length))`
- [x] Ajouter state `periodDays: 0|7|14|30|60|90` (0 = mode mois)
- [x] Ajouter props `startDate?: Date` pour mode range
- [x] Ajouter header boutons Mois/7J/14J/30J/60J/90J
- [x] Adapter `days` useMemo : si `periodDays > 0` → N jours depuis `startDate`, sinon mode mois
- [x] Ajouter state `roomTypeFilter` + `partnerFilter`
- [x] Ajouter dropdowns "Tous les types" + "Tous les canaux" dans le header
- [x] Filtrer les réservations dans le useMemo selon les filtres actifs
- [x] ✅ CHECKPOINT B-1

## T4 — Hook useRevenueCalendarData ✅
- [x] Créer `frontend/src/hooks/useRevenueCalendarData.ts`
- [x] Calculer `pickupByDate` : Map<dateStr, number>
- [x] Filtrer `cancellations` : reservations avec `status = 'cancelled'`
- [x] `cancellationsByDate` : Map<dateStr, count>
- [x] Ajouter subscription Supabase temps-réel + cleanup dans `useEffect`
- [x] Exporter `UseRevenueCalendarDataReturn` interface
- [x] ✅ CHECKPOINT B-2

## T5 — DayDetailModal ✅
- [x] Créer `frontend/src/components/modals/DayDetailModal.tsx`
- [x] Afficher : date, occ (N/M chambres, P%), ADR, RevPAR, CA du jour
- [x] Afficher : liste des réservations présentes, événements, pickup, annulations
- [x] 7 boutons d'action (1 disabled "Copier les tarifs")
- [x] Fermeture Escape + clic overlay + focus management
- [x] ✅ CHECKPOINT C-1

## T6 — Wirer click handlers RevenueCalendar → DayDetailModal ✅
- [x] `onDayClick?: (day: DayCell) => void` prop dans `RevenueCalendar`
- [x] `onClick`, `role="button"`, `tabIndex={0}` sur chaque cellule
- [x] `selectedDay` state + `<DayDetailModal>` dans PlanningView
- [x] Callbacks : openRatePanel, setDisplayMode('Gantt'), EventManagerModal, ReservationFormModal
- [x] ✅ CHECKPOINT C-2

## T7 — Centraliser seuils + polish UX ✅
- [x] Créer `frontend/src/pages/planning/revenueThresholds.ts`
- [x] `OCC_THRESHOLDS` + `getOccThreshold()` + `ADR_THRESHOLDS_MULT` + `PICKUP_WINDOW_DAYS`
- [x] RevenueCalendar + DayDetailModal importent depuis revenueThresholds.ts
- [x] Badge "Compression" dans cellules ≥90% + indicateur ↑ pickup + badge annulations
- [x] ✅ CHECKPOINT D-1

## T8 — Build verify + commit + push ✅
- [x] `npx tsc --noEmit` → 0 erreur dans les fichiers créés/modifiés
- [x] `npm run build` → succès (17.31s)
- [x] `git commit fb09e99`
- [x] `git push -u origin claude/amazing-sagan-NZbfi`
- [x] ✅ LIVRAISON COMPLÈTE

---

## Ancienne TODO (Formulaires + Partners) — COMPLÉTÉE

- [x] T1-T8 forms overhaul (committed on main: 66c4957, e4a7759, 6632db3, 982dc4e, 35c4aba)
