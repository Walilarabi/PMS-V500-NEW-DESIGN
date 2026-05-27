# TODO — Revenue Calendar Rebuild

**Branche :** `claude/amazing-sagan-NZbfi`  
Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

---

## T1 — pmsLogic.ts : computeDayMetrics + computeMonthlyKPIs
- [ ] Ajouter interface `DayMetric` exportée dans `pmsLogic.ts`
- [ ] Ajouter interface `MonthMetric` exportée dans `pmsLogic.ts`
- [ ] Implémenter `computeDayMetrics(reservations, dateStr, totalRoomsCount): DayMetric`
- [ ] Implémenter `computeMonthlyKPIs(reservations, year, month, totalRoomsCount): MonthMetric`
- [ ] ADR = CA_total_jour / max(1, nb_réservations_présentes)
- [ ] `npx tsc --noEmit` → 0 erreur dans `usePlanningMetrics.ts`
- [ ] ✅ CHECKPOINT A-1

## T2 — PlanningView : wirer RevenueCalendar + supprimer ADR aléatoire
- [ ] Importer `RevenueCalendar` depuis `./planning/RevenueCalendar`
- [ ] Importer `RevenueSubView` depuis `./planning/types`
- [ ] Ajouter state `subView: RevenueSubView` avec useState
- [ ] Ajouter rendering conditionnel : `displayMode === 'Calendar'` → `<RevenueCalendar .../>`
- [ ] Passer props : `monthDate={currentDate}` `startDate={currentDate}` `reservations` `rooms` `events` `subView` `setSubView`
- [ ] Remplacer ligne 280 `adr: 120 + Math.floor(Math.random() * 40)` par calcul réel
- [ ] `npm run build` → succès
- [ ] Tester basculement Gantt ↔ Calendrier manuellement
- [ ] ✅ CHECKPOINT A-2

## T3 — RevenueCalendar : fix ADR + période + filtres
- [ ] Fix ADR : `adr = Math.round(ca / Math.max(1, occRes.length))` dans le useMemo
- [ ] Ajouter state `periodDays: 7|14|30|60|90|null` (null = mode mois)
- [ ] Ajouter props `startDate: Date` pour mode range
- [ ] Ajouter header boutons 7J/14J/30J/60J/90J
- [ ] Adapter `days` useMemo : si `periodDays` → calculer N jours depuis `startDate`, sinon mode mois
- [ ] Ajouter state `roomTypeFilter: string` (défaut 'all')
- [ ] Ajouter state `partnerFilter: string` (défaut 'all')
- [ ] Ajouter dropdowns "Tous les types" + "Tous les canaux" dans le header
- [ ] Filtrer les réservations dans le useMemo selon les filtres actifs
- [ ] ✅ CHECKPOINT B-1

## T4 — Hook useRevenueCalendarData
- [ ] Créer `frontend/src/hooks/useRevenueCalendarData.ts`
- [ ] Importer `useReservations` depuis le domaine reservations
- [ ] Calculer `pickupByDate` : Map<dateStr, number> — réservations créées dans les 7 derniers jours pour chaque date future
- [ ] Filtrer `cancellations` : reservations avec `status = 'cancelled'`
- [ ] Ajouter subscription Supabase temps-réel sur table `reservations`
- [ ] Nettoyer la subscription dans le cleanup `useEffect`
- [ ] Exporter `UseRevenueCalendarDataReturn` interface
- [ ] Aucune erreur TS
- [ ] ✅ CHECKPOINT B-2

## T5 — DayDetailModal
- [ ] Créer `frontend/src/components/modals/DayDetailModal.tsx`
- [ ] Afficher : date, occ (N/M chambres, P%), ADR, RevPAR, CA du jour
- [ ] Afficher : liste des réservations présentes (nom, chambre, canal)
- [ ] Afficher : pickup du jour (nouvelles resas N-7)
- [ ] Afficher : événements hôtel du jour
- [ ] Bouton 1 : "Nouvelle réservation" → callback `onNewReservation(dateStr)`
- [ ] Bouton 2 : "Bloquer des chambres" → callback `onBlockRooms(dateStr)` (ou placeholder)
- [ ] Bouton 3 : "Modifier les tarifs" → callback `onEditRates(dateStr)`
- [ ] Bouton 4 : "Ajouter une restriction" → callback `onAddRestriction(dateStr)` (ou placeholder)
- [ ] Bouton 5 : "Voir dans le Gantt" → callback `onViewInGantt(dateStr)`
- [ ] Bouton 6 : "Ajouter un événement" → callback `onAddEvent(dateStr)`
- [ ] Bouton 7 : "Copier les tarifs" → disabled + tooltip "Bientôt disponible"
- [ ] Fermeture Escape + clic overlay
- [ ] Focus trap basique (focus sur bouton fermeture à l'ouverture)
- [ ] ✅ CHECKPOINT C-1

## T6 — Wirer click handlers RevenueCalendar → DayDetailModal
- [ ] Ajouter prop `onDayClick?: (day: DayCell) => void` à `RevenueCalendar`
- [ ] Ajouter `onClick`, `role="button"`, `tabIndex={0}` sur chaque cellule non-vide dans `KpiCalendar`
- [ ] Dans `PlanningView`, ajouter state `selectedDay: DayCell | null`
- [ ] Importer et rendre `<DayDetailModal>` dans PlanningView
- [ ] Passer callbacks : `onNewReservation → setIsModalOpen + préfill date`, `onAddEvent → setIsEventModalOpen + date`
- [ ] `onEditRates` → `useRateCalendarStore.getState().openRatePanel(null)`
- [ ] `onViewInGantt` → `setDisplayMode('Gantt')`
- [ ] ✅ CHECKPOINT C-2

## T7 — Centraliser seuils + polish UX
- [ ] Créer `frontend/src/pages/planning/revenueThresholds.ts`
- [ ] Exporter `OCC_THRESHOLDS` avec 5 niveaux (CRITICAL, HIGH, NORMAL, LOW, EMPTY)
- [ ] Remplacer `heatmapTone()` dans `RevenueCalendar.tsx` pour utiliser `OCC_THRESHOLDS`
- [ ] Afficher mini-badge "Compression" dans cellules ≥90%
- [ ] Afficher indicateur ↑ pickup si `pickupByDate.get(dateStr) > 0`
- [ ] Afficher badge annulations rouges si > 0 pour ce jour
- [ ] ✅ CHECKPOINT D-1

## T8 — Build verify + commit + push
- [ ] `npx tsc --noEmit` → 0 erreur dans les fichiers modifiés/créés
- [ ] `npm run build` → succès complet
- [ ] `git checkout -b claude/amazing-sagan-NZbfi` (si pas déjà sur la branche)
- [ ] `git add -A && git commit -m "feat(planning): Revenue Calendar rebuild — fix dead toggle, broken imports, real data, modals, filters, pickup"`
- [ ] `git push -u origin claude/amazing-sagan-NZbfi`
- [ ] ✅ LIVRAISON COMPLÈTE

---

## Ancienne TODO (Formulaires + Partners) — COMPLÉTÉE

- [x] T1 — constants/partners.ts (34 partenaires)
- [x] T2 — Store + Supabase persistence
- [x] T3 — RoomManagerPanel : formulaire + harmonisation
- [x] T4 — RateManagerPanel : fix submit + harmonisation
- [x] T5 — RoomTypesPage : CRUD physique
- [x] T6 — RatePlansPage : édition inline + filtre partenaire
- [x] T7 — ReservationFormModal : sélecteur partenaire + filtrage plans
- [x] T8 — Synchronisation & contrôles finaux
