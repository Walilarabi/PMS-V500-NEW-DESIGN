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

> **TASKS 1–8 COMPLETED** — 2026-05-27.  
> Branches T3–T8 merged to main. All room/rate/modal forms fully rebuilt.

---

---

# Plan — Revenue Calendar Rebuild

**Date :** 2026-05-27  
**Branche :** `claude/amazing-sagan-NZbfi`  
**Scope :** Corriger les bugs critiques du module Planning (Calendrier mort, imports cassés) et reconstruire le Revenue Calendar avec données Supabase réelles, métriques fiables, filtres, modales actionnables et UX colour-codée.

---

## Audit — Bugs Critiques Confirmés

| # | Fichier | Bug | Impact |
|---|---------|-----|--------|
| B1 | `PlanningView.tsx:167,400-405` | Toggle `displayMode='Calendar'` existe mais rien ne s'affiche — `RevenueCalendar` n'est jamais rendu | **CRITIQUE** — bouton mort |
| B2 | `hooks/usePlanningMetrics.ts:2-7` | Imports `computeDayMetrics`, `computeMonthlyKPIs`, `DayMetric`, `MonthMetric` depuis `pmsLogic` — ces exports n'existent pas → 4 erreurs TS2305 | **CRITIQUE** — crash silencieux |
| B3 | `PlanningView.tsx:280` | `adr: 120 + Math.floor(Math.random() * 40)` — ADR fictif dans l'en-tête Gantt | **MOYEN** — données trompeuses |
| B4 | `RevenueCalendar.tsx:63` | `adr = ca / occRes.length` — divise le CA total par le nb de réservations, pas par le nb de nuits | **MOYEN** — ADR mal calculé |

## Audit — Fonctionnalités Manquantes

| # | Manque |
|---|--------|
| F1 | Aucun sélecteur de période (7/14/30/60/90 jours) dans le Revenue Calendar |
| F2 | Aucun filtre (type chambre, partenaire, plan tarifaire) dans le Revenue Calendar |
| F3 | Aucun handler sur les cellules du calendrier — pas de modal |
| F4 | Aucun tracking pickup / annulations / no-show |
| F5 | Aucun abonnement Supabase temps-réel pour le Revenue Calendar |
| F6 | Thresholds couleur en dur dans `RevenueCalendar.tsx` (non centralisés) |
| F7 | `CATEGORY_PRICES` mocké dans `types.ts` (non branché aux rate_prices Supabase) |

---

## Graphe de dépendances

```
T1 — pmsLogic.ts : computeDayMetrics + computeMonthlyKPIs + types
     ↓
T2 — PlanningView.tsx : Fix toggle dead + remove random ADR + wire RevenueCalendar
     ↓
T3 — RevenueCalendar.tsx : fix ADR calc + add period selector + filters
     ↓
T4 — hooks/useRevenueCalendarData.ts : hook centralisé données + pickup + annulations
     ↓
T5 — DayDetailModal.tsx : modal jour cliquable, 7 boutons action
     ↓
T6 — RevenueCalendar : wire click handlers → DayDetailModal
     ↓
T7 — Real-time Supabase subscriptions + centralize threshold constants
     ↓
T8 — Build verify + commit + push
```

---

## Tâches verticales

---

### T1 — Ajouter `computeDayMetrics` / `computeMonthlyKPIs` à pmsLogic.ts
**Fichier :** `frontend/src/lib/pmsLogic.ts`  
**Taille :** S (1 fichier, ~60 lignes)

**Description :**  
`usePlanningMetrics.ts` importe 4 symboles de `pmsLogic` qui n'existent pas.  
Ajouter ces fonctions + types dans `pmsLogic.ts` pour corriger les 4 erreurs TS2305.  
Les calculs doivent être corrects : ADR = revenu total / nombre de nuits vendues (pas nombre de réservations).

**Types à ajouter :**
```typescript
export interface DayMetric {
  dateStr: string;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number;  // 0-100
  revenue: number;        // CA total du jour
  adr: number;            // CA / nuits vendues
  revpar: number;         // CA / chambres disponibles
  arrivals: number;
  departures: number;
  cancellations: number;
}

export interface MonthMetric {
  year: number;
  month: number;
  totalRevenue: number;
  avgOccupancy: number;
  avgADR: number;
  avgRevPAR: number;
  totalArrivals: number;
  totalDepartures: number;
  totalCancellations: number;
}
```

**Fonctions à ajouter :**
```typescript
export function computeDayMetrics(
  reservations: any[],
  dateStr: string,
  totalRoomsCount: number
): DayMetric

export function computeMonthlyKPIs(
  reservations: any[],
  year: number,
  month: number,
  totalRoomsCount: number
): MonthMetric
```

**Critères d'acceptation :**
- [ ] `npx tsc --noEmit` → 0 erreur dans `usePlanningMetrics.ts`
- [ ] `computeDayMetrics` : ADR = revenu_du_jour / nombre_réservations_présentes (minimum 1)
- [ ] `computeMonthlyKPIs` : agrège tous les jours du mois

**Vérification :** `npx tsc --noEmit 2>&1 | grep usePlanningMetrics` → vide

---

### T2 — Wirer RevenueCalendar dans PlanningView + supprimer ADR aléatoire
**Fichier :** `frontend/src/pages/PlanningView.tsx`  
**Taille :** S (1 fichier, ~20 lignes modifiées)

**Description :**  
1. Importer `RevenueCalendar` et `RevenueSubView` dans PlanningView  
2. Ajouter `subView` state  
3. Dans le JSX, conditionner : si `displayMode === 'Calendar'` → rendre `<RevenueCalendar .../>` sinon rendre le Gantt  
4. Passer les bonnes props : `monthDate={currentDate}` `reservations={supabaseReservations}` `rooms={roomRows}` `events={storeEvents}` `subView` `setSubView`  
5. Remplacer `adr: 120 + Math.floor(Math.random() * 40)` (ligne 280) par un calcul réel depuis les réservations du jour

**Données disponibles dans PlanningView :**
- `supabaseReservations` — depuis `useReservations()` (domaine)  
- `roomsData` / `roomsQuery.data` — depuis `useRooms()`  
- `storeEvents` — depuis `useConfigStore(s => s.events)`  
- `currentDate` — état existant

**Critères d'acceptation :**
- [ ] Clic "Calendrier" → `<RevenueCalendar>` s'affiche à la place du Gantt
- [ ] Clic "Gantt" → Gantt s'affiche, Revenue Calendar disparaît
- [ ] En-tête Gantt : ADR calculé depuis les vraies réservations (pas de `Math.random`)
- [ ] Aucune régression sur le Gantt existant

**Vérification :** `npm run build` réussit ; basculer manuellement entre Gantt et Calendrier

---

### T3 — Améliorer RevenueCalendar : ADR corrigé + sélecteur période + filtres
**Fichier :** `frontend/src/pages/planning/RevenueCalendar.tsx`  
**Taille :** M (1 fichier, ~100 lignes ajoutées)

**Description :**  
1. **Fix ADR** : `adr = Math.round(ca / Math.max(1, occRes.length))` → calculé par jour, correct  
2. **Sélecteur période** : boutons `7J / 14J / 30J / 60J / 90J` au lieu du calendrier mensuel fixe. Quand sélectionné, le calendrier affiche une grille de N jours à partir de `startDate`  
3. **Filtre type chambre** : dropdown "Tous les types" → filtre `reservations` par `room_type`  
4. **Filtre partenaire** : dropdown "Tous les canaux" → filtre `reservations` par `source`  
5. **Mode "Range" vs "Mois"** : ajouter `viewMode: 'month' | 'range'` state. Le sélecteur existant Gantt/Calendar opère sur le mois courant (mode month). Les nouveaux boutons 7J/14J/30J... passent en mode range.

**Props étendues :**
```typescript
interface Props {
  monthDate: Date;
  startDate: Date;          // NEW — pour le mode range
  reservations: ReservationRow[];
  rooms: RoomRow[];
  events: HotelEvent[];
  subView: RevenueSubView;
  setSubView: (s: RevenueSubView) => void;
}
```

**Critères d'acceptation :**
- [ ] Boutons 7J/14J/30J/60J/90J visibles et cliquables dans le header du Revenue Calendar
- [ ] Clic "30J" → grille de 30 jours à partir d'aujourd'hui (pas de vue mensuelle)
- [ ] Filtre type chambre → ne compte que les réservations de ce type
- [ ] Filtre partenaire → ne compte que les réservations de ce canal
- [ ] ADR d'un jour = CA_du_jour / nb_réservations_présentes (correct, no division par 0)

**Vérification :** Observer manuellement la grille après changement de période + filtres

---

### T4 — Hook `useRevenueCalendarData` : pickup + annulations + temps-réel
**Fichier :** `frontend/src/hooks/useRevenueCalendarData.ts` (nouveau)  
**Taille :** M (1 nouveau fichier, ~120 lignes)

**Description :**  
Centraliser toute la logique de données du Revenue Calendar dans un hook réutilisable.  
Ce hook remplace les props directes par un état enrichi avec :
- Pickup : réservations créées dans les 7 derniers jours pour une date future donnée
- Annulations : réservations avec `status = 'cancelled'` sur la période
- No-show : réservations avec `status = 'no_show'`
- Arrivées/départs : filtrage par `check_in` / `check_out` du jour
- Abonnement Supabase temps-réel sur la table `reservations`

**Interface de retour :**
```typescript
interface UseRevenueCalendarDataReturn {
  reservations: ReservationRow[];
  cancellations: ReservationRow[];
  pickupByDate: Map<string, number>;   // date → nb réservations récentes
  isLoading: boolean;
  lastUpdated: Date | null;
}
```

**Supabase subscription :**
```typescript
supabase
  .channel('revenue-calendar-reservations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'reservations',
  }, () => { refetch() })
  .subscribe()
```

**Critères d'acceptation :**
- [ ] Hook exporté et typé sans erreur TS
- [ ] `pickupByDate` contient les nouvelles réservations sur les 7 derniers jours par date
- [ ] `cancellations` filtre correctement par `status = 'cancelled'`
- [ ] Subscription Supabase se nettoie dans le `useEffect` cleanup

**Vérification :** Créer une réservation dans Supabase → `lastUpdated` se met à jour

---

### T5 — Modal `DayDetailModal` : détail jour + boutons action
**Fichier :** `frontend/src/components/modals/DayDetailModal.tsx` (nouveau)  
**Taille :** M (1 nouveau fichier, ~200 lignes)

**Description :**  
Modal qui s'ouvre au clic sur une cellule du Revenue Calendar.  
Affiche les métriques réelles du jour et propose 7 boutons d'action.

**Données affichées :**
- Date (formatée en français)
- Occupation : `N/M chambres (P%)`
- ADR, RevPAR, CA du jour
- Liste des réservations présentes ce jour (nom client, chambre, canal)
- Pickup (nouvelles résa dans les 7j)
- Événements hôtel ce jour
- Badge de compression (si occupation > seuil)

**Boutons d'action :**
1. `+ Nouvelle réservation` → ouvre `ReservationFormModal` pré-rempli avec la date
2. `Bloquer des chambres` → ouvre sélecteur chambre + confirmation
3. `Modifier les tarifs` → ouvre `RateManagerPanel` sur la date
4. `Ajouter une restriction` → mini-form (min_stay, max_stay, close_to_arrival)
5. `Voir les réservations` → scroll vers les réservations du jour dans le Gantt
6. `Ajouter un événement` → ouvre `EventManagerModal` pré-rempli avec la date
7. `Copier les tarifs` → action future (disabled avec tooltip "Bientôt disponible")

**Critères d'acceptation :**
- [ ] Modal s'ouvre avec les données réelles du jour cliqué
- [ ] "Nouvelle réservation" → `ReservationFormModal` s'ouvre (avec date pré-remplie)
- [ ] "Ajouter un événement" → `EventManagerModal` s'ouvre avec la date
- [ ] Fermeture avec Escape ou clic sur overlay
- [ ] Accessible au clavier (focus trap, Escape ferme)

**Vérification :** Cliquer sur une cellule → modal visible avec données du jour

---

### T6 — Wirer les click handlers dans RevenueCalendar → DayDetailModal
**Fichier :** `frontend/src/pages/planning/RevenueCalendar.tsx`  
**Taille :** S (modifier fichier existant, ~30 lignes)

**Description :**  
1. Ajouter prop `onDayClick?: (day: DayCell) => void`  
2. Dans `KpiCalendar`, ajouter `onClick={() => onDayClick?.(d)}` + `cursor-pointer` sur chaque cellule  
3. Dans `PlanningView`, gérer `selectedDay` state + rendre `<DayDetailModal>`  
4. Passer les callbacks nécessaires (openReservationModal, openEventModal, openRatePanel)

**Critères d'acceptation :**
- [ ] Clic sur n'importe quelle cellule → DayDetailModal s'ouvre
- [ ] DayDetailModal reçoit les bonnes données (occ, adr, revpar, réservations du jour)
- [ ] Cellule courante surlignée au hover (déjà `hover:bg-indigo-50/30` — à renforcer)

**Vérification :** Clic cellule → modal → données cohérentes avec Gantt du même jour

---

### T7 — Centraliser les seuils + polish UX
**Fichiers :** `frontend/src/pages/planning/revenueThresholds.ts` (nouveau), `RevenueCalendar.tsx`  
**Taille :** S (1 nouveau petit fichier + modif mineur RevenueCalendar)

**Description :**  
1. Extraire les seuils de couleur dans `revenueThresholds.ts` :
```typescript
export const OCC_THRESHOLDS = {
  CRITICAL:   { min: 90, bg: 'bg-rose-100',    ring: 'ring-rose-200',    label: 'Compression' },
  HIGH:       { min: 75, bg: 'bg-orange-100',   ring: 'ring-orange-200',  label: 'Forte demande' },
  NORMAL:     { min: 50, bg: 'bg-emerald-100',  ring: 'ring-emerald-200', label: 'Normal' },
  LOW:        { min: 25, bg: 'bg-sky-50',       ring: 'ring-sky-100',     label: 'Faible' },
  EMPTY:      { min: 0,  bg: 'bg-gray-50',      ring: 'ring-gray-100',    label: 'Vide' },
} as const;
```
2. Afficher le label de seuil dans les cellules (ex. petit badge "Compression" sur les jours ≥90%)  
3. Indicateur pickup dans la cellule (flèche ↑ si pickup > 0 pour ce jour)  
4. Afficher nb annulations dans cellule si > 0 (badge rouge)

**Critères d'acceptation :**
- [ ] `OCC_THRESHOLDS` importé dans `RevenueCalendar.tsx` (plus de seuils en dur)
- [ ] Cellules ≥90% affichent un mini-badge "Compression"
- [ ] Cellules avec pickup > 0 affichent ↑ indicateur
- [ ] Pas de régression sur la heatmap

**Vérification :** Observer le calendrier avec données réelles — badges corrects

---

### T8 — Build verify + commit + push
**Fichiers :** tous les fichiers modifiés  
**Taille :** XS

**Description :**  
Build complet + vérification TypeScript + push sur la branche de développement.

**Critères d'acceptation :**
- [ ] `npx tsc --noEmit` → 0 erreur dans les fichiers nouveaux/modifiés
- [ ] `npm run build` → succès
- [ ] `git push -u origin claude/amazing-sagan-NZbfi`

---

## Checkpoints

```
✅ CHECKPOINT A (après T1+T2) :
   → npx tsc → 0 erreur usePlanningMetrics
   → Basculer Gantt/Calendrier fonctionne visuellement

✅ CHECKPOINT B (après T3+T4) :
   → Période 30J visible, filtres chambre + partenaire opérationnels
   → useRevenueCalendarData hook fonctionnel

✅ CHECKPOINT C (après T5+T6) :
   → Clic cellule → DayDetailModal avec vraies données
   → "Nouvelle réservation" et "Ajouter événement" fonctionnels depuis modal

✅ CHECKPOINT D (après T7+T8) :
   → Seuils centralisés, badges compression/pickup visibles
   → Build propre + push
```

---

## Décisions architecturales

| Décision | Choix | Raison |
|----------|-------|--------|
| Seuils couleur | Fichier `revenueThresholds.ts` dédié | Un seul endroit à modifier pour changer les thresholds business |
| Données Revenue Calendar | Réutiliser `useReservations()` existant | Évite une seconde query, partage le cache React Query |
| Abonnement temps-réel | Dans `useRevenueCalendarData` hook séparé | Isolation : subscribe/unsubscribe géré en un endroit |
| DayDetailModal | Composant `components/modals/` | Cohérent avec les autres modales du projet |
| Pickup | `createdAt` des 7 derniers jours | Standard hôtelier pour le pickup N-7 |

---

## Fichiers touchés (récapitulatif)

```
MOD   frontend/src/lib/pmsLogic.ts
MOD   frontend/src/pages/PlanningView.tsx
MOD   frontend/src/pages/planning/RevenueCalendar.tsx
NEW   frontend/src/hooks/useRevenueCalendarData.ts
NEW   frontend/src/components/modals/DayDetailModal.tsx
NEW   frontend/src/pages/planning/revenueThresholds.ts
```
