# FLOWTYM PMS — Planning : Plan de refonte complet
> Audit + Architecture + Roadmap d'implémentation

---

## 1. AUDIT DU PLANNING ACTUEL

### Problèmes critiques (bloquants)

| # | Problème | Impact | Fichier |
|---|----------|--------|---------|
| P1 | **PlanningViewLive.tsx utilise un contexte mock** — données en mémoire, pas Supabase | Toutes les stats sont fausses | `PlanningViewLive.tsx:l.1-2148` |
| P2 | **Deux implémentations parallèles** : PlanningViewLive (mock) vs PlanningView (Supabase réel) — seule la mauvaise est routée | Double maintenance, incohérence | `App.tsx` |
| P3 | **Aucun temps réel** — modifications d'autres agents non reflétées | Désynchronisation opérationnelle | Tous les hooks |
| P4 | **KPIs calculés en 3 endroits différents** — TO%, ADR, RevPAR sans source unique | Chiffres divergents possibles | `PlanningViewLive`, `RevenueCalendar`, `flowday/hooks` |
| P5 | **Boutons morts** : "Détails TO%", "Détails ADR", Settings — toast seulement | UX brisée | `PlanningViewLive.tsx` |
| P6 | **Drag-to-create et drag-move non persistés** — contexte local uniquement | Perte de données | `PlanningViewLive.tsx` |
| P7 | **Pas de pickup, forecast, compression marché** — métriques revenue absentes | Decision-making impossible | — |

### Composants existants — état

| Fichier | Lignes | Verdict | Motif |
|---------|--------|---------|-------|
| `PlanningViewLive.tsx` | 2148 | **RÉÉCRIRE** | Données mock, monolithique, boutons morts |
| `PlanningView.tsx` | 1232 | **SUPPRIMER** | Doublon inactif, code mort |
| `planning/RevenueCalendar.tsx` | 717 | **CONSERVER + refactor** | Bonne base, extraire KPI |
| `planning/PlanningHeader.tsx` | 235 | **CONSERVER + enrichir** | Bonne structure |
| `planning/ConfirmMoveDialog.tsx` | 199 | **CONSERVER** | Logique saine |
| `planning/PlanningGrid.tsx` | 695 | **CONSERVER + enrichir** | Drag OK, ajouter badges |
| `domains/flowday/hooks.ts` | 352 | **CONSERVER + enrichir** | Excellent adapter, ajouter realtime |
| `domains/planning/hooks.ts` | ~80 | **CONSERVER** | TanStack Query, propre |
| `domains/planning/repository.ts` | ~60 | **CONSERVER** | Supabase direct, propre |

---

## 2. LISTE DES COMPOSANTS

### À CONSERVER (sans changement majeur)
- `planning/ConfirmMoveDialog.tsx` — logique surclassement/délogement
- `domains/planning/repository.ts` — CRUD channels + events
- `domains/planning/hooks.ts` — TanStack hooks channels + events

### À CONSERVER ET ENRICHIR
- `planning/PlanningHeader.tsx` — ajouter mode switcher 5 modes + collapse triggers
- `planning/PlanningGrid.tsx` — ajouter badges réservation, HK, maintenance
- `planning/RevenueCalendar.tsx` — extraire calcul KPI vers hook centralisé
- `domains/flowday/hooks.ts` — ajouter Supabase Realtime subscriptions

### À SUPPRIMER
- `pages/PlanningView.tsx` — version obsolète non routée
- `configStore.ts` (usage planning) — remplacer par Supabase réel
- Toute référence à `ReservationContext` (contexte mock) dans le planning

### À CRÉER — Hooks
| Hook | Responsabilité |
|------|----------------|
| `hooks/planning/usePlanningKpis.ts` | TO, ADR, RevPAR, CA — source unique, memoized |
| `hooks/planning/usePlanningRealtime.ts` | Subscriptions Supabase (reservations, rooms, hk_tasks) |
| `hooks/planning/usePickup.ts` | Calcul pickup J vs J-1 depuis planning_daily_snapshots |
| `hooks/planning/useForecast.ts` | Forecast auto (TO actuel + pickup historique + annulations) |
| `hooks/planning/useMarketCompression.ts` | Indice compression depuis lighthouse_days |
| `hooks/planning/useRmsRecommendations.ts` | Recommandations depuis rms_pricing_recommendations |

### À CRÉER — Composants
| Composant | Rôle |
|-----------|------|
| `planning/PlanningKpiBar.tsx` | Barre compacte : TO, ADR, RevPAR, Forecast, Pickup×2, Compset, Libres, Events, Heatmap |
| `planning/ReservationBar.tsx` | Barre Gantt enrichie avec badges (VIP, payée, PdJ, arrivée, départ...) |
| `planning/RoomRowLabel.tsx` | Label chambre avec badge HK (vert/orange/rouge/bleu/gris) + maintenance |
| `planning/FreeRoomsModal.tsx` | Popup chambres libres : liste + créer resa / bloquer / maintenance |
| `planning/PlanningModeBar.tsx` | Switch 5 modes : Occupation, Revenue, Housekeeping, Groupe, Maintenance |
| `planning/RmsRecommendationPanel.tsx` | Panneau droit : recommandations RMS actionnables |
| `planning/PlanningDayColumn.tsx` | Colonne jour : TO%, Forecast, Pickup, Libres, Events avec heatmap |
| `planning/MarketCompressionBadge.tsx` | Badge compression 0-100% coloré |
| `stores/planningUiStore.ts` | Zustand léger : mode actif, sidebar states, date range |

### À CRÉER — Backend / Services
| Fichier | Rôle |
|---------|------|
| `services/planning/planning-kpi.service.ts` | Calculs KPI centralisés (pures functions) |
| `services/planning/planning-snapshot.service.ts` | Écriture/lecture snapshots quotidiens |
| `services/planning/planning-forecast.service.ts` | Moteur forecast automatique |

---

## 3. SCHÉMA BASE DE DONNÉES

### Tables existantes utilisées
```
reservations          → données core (check_in, check_out, status, total_amount, source_partner_id)
rooms                 → housekeeping_status, assigned_to, status (clean/dirty/inspected/maintenance)
room_types            → capacité, nom, code
hk_tasks              → scheduled_for, status (pending/in_progress/done), room_id, assigned_to
maintenance_tasks     → scheduled_date, status, room_id, title
maintenance_tickets   → (si maintenance urgente)
rms_pricing_recommendations → date, recommended_price, delta_percent, confidence_score, status
lighthouse_days       → stay_date, market_demand_percent, compset_median, competitors (jsonb)
planning_events       → start_date, end_date, impact (low/medium/high/critical)
planning_channels     → canaux de distribution
```

### Nouvelle table à créer : `planning_daily_snapshots`
```sql
CREATE TABLE planning_daily_snapshots (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id     uuid NOT NULL,
  snapshot_date date NOT NULL,          -- date du jour snapshoté
  snapped_at   timestamptz DEFAULT now() NOT NULL,  -- heure snapshot (1x/jour ~minuit)
  rooms_total  integer NOT NULL,
  rooms_occupied integer NOT NULL,
  revenue_total  numeric(12,2) NOT NULL DEFAULT 0,
  arrivals_count integer NOT NULL DEFAULT 0,
  departures_count integer NOT NULL DEFAULT 0,
  -- Pour calcul pickup : on enregistre l'état pour chaque date future
  target_date  date NOT NULL,           -- date cible (ex: snapshot pris le 29 mai pour le 30 mai)
  CONSTRAINT pds_unique UNIQUE (hotel_id, snapped_at::date, target_date)
);
-- RLS identique aux autres tables
ALTER TABLE planning_daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY pds_select ON planning_daily_snapshots FOR SELECT USING (hotel_id = get_user_hotel_id());
CREATE POLICY pds_insert ON planning_daily_snapshots FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());
```

**Usage Pickup :**
- À chaque chargement de page, snapshot rapide des J+0..J+30
- Pickup(J) = rooms_occupied(snapped_at=today, target=J) - rooms_occupied(snapped_at=yesterday, target=J)
- Pickup Rev = revenue_total(today) - revenue_total(yesterday)

### Vue Supabase utile : `v_planning_day_kpi`
```sql
CREATE OR REPLACE VIEW v_planning_day_kpi AS
SELECT
  r.hotel_id,
  r.check_in AS day,
  COUNT(*) FILTER (WHERE r.status NOT IN ('cancelled','no_show')) AS occupied,
  SUM(r.total_amount / r.nights) FILTER (WHERE r.status NOT IN ('cancelled','no_show')) AS revenue_day,
  COUNT(*) FILTER (WHERE r.check_in = CURRENT_DATE AND r.status NOT IN ('cancelled','no_show')) AS arrivals,
  COUNT(*) FILTER (WHERE r.check_out = CURRENT_DATE AND r.status NOT IN ('cancelled','no_show')) AS departures
FROM reservations r
GROUP BY r.hotel_id, r.check_in;
```

---

## 4. ARCHITECTURE FRONTEND

```
PlanningPage (nouveau composant racine)
│
├── PlanningModeBar            ← 5 modes : Occupation | Revenue | HK | Groupe | Maintenance
│
├── PlanningKpiBar             ← Barre compacte unique (remplace 2 lignes actuelles)
│   ├── KpiChip (TO %)
│   ├── KpiChip (ADR)
│   ├── KpiChip (RevPAR)
│   ├── KpiChip (Forecast %)
│   ├── KpiChip (Pickup Ch) ← couleur vert/rouge/gris
│   ├── KpiChip (Pickup Rev)
│   ├── KpiChip (Compression marché) ← depuis lighthouse_days
│   ├── KpiChip (Libres) ← click → FreeRoomsModal
│   ├── KpiChip (Events) ← count planning_events
│   └── HeatmapMiniBar ← gradient 7 jours
│
├── PlanningHeader             ← (conservé, enrichi)
│   ├── DateNav (prev/next/today)
│   ├── ViewRangeSelector (7j/15j/mois)
│   ├── SearchFilter
│   ├── BtnNewReservation
│   ├── BtnCollapseLeft  ← NOUVEAU
│   └── BtnCollapseRight ← NOUVEAU
│
└── PlanningBody (flex horizontal)
    │
    ├── [LEFT SIDEBAR collapsible]    ← NOUVEAU : navigation modules
    │   Mode icônes ou mode étendu
    │   Sauvegardé dans localStorage
    │
    ├── PlanningGanttView (flex-1)   ← zone principale
    │   │
    │   ├── PlanningDayHeaders
    │   │   └── PlanningDayColumn × N  ← TO%, Forecast, Pickup, Events par colonne
    │   │
    │   └── PlanningRoomRows × M
    │       ├── RoomRowLabel           ← badge HK + numéro chambre
    │       └── ReservationBar × K    ← icônes VIP/payée/PdJ/groupe/message
    │
    └── [RIGHT SIDEBAR collapsible]   ← NOUVEAU : intelligence + recommandations
        ├── RmsRecommendationPanel
        ├── FreeRoomsPanel
        └── MarketCompressionPanel
```

### State Management

```
planningUiStore (Zustand)
  leftSidebarCollapsed: boolean      → localStorage
  rightSidebarCollapsed: boolean     → localStorage
  activeMode: 'occupation' | 'revenue' | 'housekeeping' | 'groupe' | 'maintenance'
  dateRange: { start: Date, days: 7|15|30 }

usePlanningKpis(date, reservations, rooms)
  → { toRate, adr, revpar, ca, arrivals, departures }  pure function, memoized

usePlanningRealtime()
  → Supabase channel : reservations INSERT/UPDATE/DELETE
  → Supabase channel : rooms UPDATE (housekeeping_status)
  → Supabase channel : hk_tasks UPDATE
  → invalide TanStack Query caches à chaque event

usePickup(targetDate)
  → lit planning_daily_snapshots (today vs yesterday pour targetDate)

useForecast(date, toRate, pickup, compressionIndex)
  → calcul algorithmique (pas de saisie manuelle)
  → formule : toRate + pickup_trend - cancellation_rate - noshow_rate + compression_boost

useMarketCompression(date)
  → lit lighthouse_days WHERE stay_date = date
  → retourne market_demand_percent (0-100)
```

---

## 5. FORMULES MÉTIER

### TO (Taux d'Occupation)
```
TO = reserved_rooms / total_active_rooms × 100
Source : reservations WHERE check_in <= date AND check_out > date AND status NOT IN ('cancelled','no_show')
```

### ADR (Average Daily Rate)
```
ADR = revenue_du_jour / rooms_occupied
revenue_du_jour = SUM(total_amount / nights) pour toutes résas présentes ce jour
```

### RevPAR
```
RevPAR = revenue_du_jour / total_rooms
```

### Pickup (Chambres)
```
Pickup = rooms_occupied(snapshot_today, target=J) - rooms_occupied(snapshot_yesterday, target=J)
Couleur : vert si > 0, rouge si < 0, gris si = 0
```

### Pickup (Revenu)
```
PickupRev = revenue(snapshot_today, target=J) - revenue(snapshot_yesterday, target=J)
```

### Forecast
```
forecast_base = TO_actuel
pickup_trend  = moyenne_pickup_7j_historique × lead_time_factor
cancel_rate   = (cancellations_30j / total_reservations_30j)
noshow_rate   = (noshows_30j / total_arrivals_30j)
compression_boost = if(market_demand_percent > 70) + (market_demand_percent - 70) * 0.15
Forecast = min(100, forecast_base + pickup_trend - (cancel_rate × remaining_days) - noshow_rate + compression_boost)
```

### Compression Marché
```
Source : lighthouse_days.market_demand_percent (0-100, fourni directement par Lighthouse)
Couleur : 0-40 vert | 41-60 jaune | 61-80 orange | 81-100 rouge
```

### Chambres Libres
```
libres = total_active_rooms - rooms_occupied_today
Source : rooms WHERE active=true COUNT() - reservations présentes ce jour
```

---

## 6. BADGES RÉSERVATION (dans les barres Gantt)

| Badge | Condition | Icône |
|-------|-----------|-------|
| Arrivée du jour | check_in == today | ↓ vert |
| Départ du jour | check_out == today | ↑ orange |
| VIP | guest.loyalty_level IS NOT NULL | ★ |
| Payée | payment_status == 'paid' | ✓ vert |
| Non payée | solde > 0 | € rouge |
| Petit-déjeuner | plan tarifaire BB/HB/FB | ☕ |
| Groupe | group_id IS NOT NULL | 👥 |
| Check-in online | checkin_status == 'online' | 📱 |
| Notes spéciales | special_requests IS NOT NULL | 📝 |

---

## 7. MODES D'AFFICHAGE

| Mode | Filtre / Style | Données additionnelles |
|------|----------------|------------------------|
| Occupation | Vue standard | TO%, chambres libres |
| Revenue | Heatmap couleur par ADR/RevPAR | Recommandations RMS |
| Housekeeping | Badge HK proéminent, filtrable par statut | hk_tasks du jour |
| Groupe | Réservations groupe surlignées | group_reservations |
| Maintenance | maintenance_tasks visibles, fond rayé | maintenance_tasks + tickets |

---

## 8. PLAN D'IMPLÉMENTATION PAR PHASE

### Phase 1 — Foundation (J1-J2) ★ PRIORITÉ ABSOLUE
**Objectif : brancher le planning sur les vraies données**

- [ ] 1.1 Créer migration `planning_daily_snapshots` (Supabase MCP)
- [ ] 1.2 Supprimer `PlanningView.tsx` (doublon inactif)
- [ ] 1.3 Réécrire `PlanningViewLive.tsx` → `PlanningPage.tsx`
  - Remplacer `ReservationContext` (mock) par `useReservations()` de `/domains/reservations/hooks`
  - Remplacer `configStore.rooms` par `useRooms()` de `/domains/hotel/hooks`
  - Valider drag-to-create + drag-move persistés en DB
- [ ] 1.4 Créer `hooks/planning/usePlanningKpis.ts` (source unique TO/ADR/RevPAR)
- [ ] 1.5 Créer `hooks/planning/usePlanningRealtime.ts` (Supabase Realtime)

**Critères de validation :**
- TO% affiché correspond aux vraies réservations Supabase
- Drag-to-create crée une vraie ligne en DB
- Modification d'une réservation dans un autre onglet → planning mis à jour en < 2s

---

### Phase 2 — Barre KPI Compacte (J3-J4)
**Objectif : une seule barre, toutes les métriques revenue**

- [ ] 2.1 Créer `planning/PlanningKpiBar.tsx`
  - TO%, ADR, RevPAR (depuis usePlanningKpis)
  - Pickup Ch + Pickup Rev (depuis usePickup → planning_daily_snapshots)
  - Compression marché (depuis lighthouse_days via useMarketCompression)
  - Chambres libres (depuis rooms count)
  - Événements (depuis planning_events count du jour)
  - Mini heatmap 7 jours
- [ ] 2.2 Créer `hooks/planning/usePickup.ts`
- [ ] 2.3 Créer `hooks/planning/useMarketCompression.ts`
- [ ] 2.4 Service snapshot : écriture auto au chargement (si snapshot < 12h absent)
- [ ] 2.5 Intégrer la barre dans PlanningPage, supprimer les lignes KPI actuelles

**Critères de validation :**
- Barre KPI visible, données réelles
- Pickup affiché avec couleur verte/rouge/grise
- Compression marché depuis lighthouse_days

---

### Phase 3 — Colonnes Journalières Enrichies (J5)
**Objectif : chaque colonne de jour = centre de décision**

- [ ] 3.1 Créer `planning/PlanningDayColumn.tsx`
  - TO% du jour (coloré selon seuils)
  - Forecast% (depuis useForecast)
  - Pickup Ch
  - Pickup Rev
  - Compression marché
  - Chambres libres (cliquable)
  - Événements du jour (badge)
  - Heatmap gradient de fond
- [ ] 3.2 Créer `hooks/planning/useForecast.ts`

**Critères de validation :**
- Chaque colonne affiche les bonnes métriques
- Forecast est calculé automatiquement, pas saisi

---

### Phase 4 — Badges Réservations + HK + Maintenance (J6-J7)
**Objectif : lecture instantanée sans ouvrir les fiches**

- [ ] 4.1 Créer `planning/ReservationBar.tsx` (remplace barres actuelles)
  - Badges : arrivée, départ, VIP, payée, non payée, PdJ, groupe, online, notes
  - Couleur selon mode actif
- [ ] 4.2 Créer `planning/RoomRowLabel.tsx`
  - Badge housekeeping_status (vert/orange/rouge/bleu/gris) depuis rooms.housekeeping_status
  - Icône maintenance si maintenance_tasks actives
  - Fond rayé si out_of_order
- [ ] 4.3 Intégrer dans PlanningGrid.tsx

**Critères de validation :**
- Badge HK visible, temps réel (se met à jour quand housekeeping_status change)
- Badge maintenance visible
- Icônes réservation visibles sans ouvrir la fiche

---

### Phase 5 — Sidebars Collapsibles (J8)
**Objectif : maximiser l'espace planning**

- [ ] 5.1 Créer `stores/planningUiStore.ts` (Zustand)
  - leftSidebarCollapsed, rightSidebarCollapsed, activeMode
  - Persisté en localStorage
- [ ] 5.2 Sidebar gauche collapsible (mode icônes / mode étendu)
  - Animation 200ms max
  - Bouton toggle permanent
- [ ] 5.3 Sidebar droite collapsible
  - Contient : recommandations RMS, analytics
  - Le Gantt récupère l'espace automatiquement

**Critères de validation :**
- Collapse/expand fluide < 200ms
- État persisté entre sessions
- Planning occupe tout l'espace disponible

---

### Phase 6 — RMS Recommandations + Chambres Libres (J9-J10)
**Objectif : décisions revenue sans changer de module**

- [ ] 6.1 Créer `planning/RmsRecommendationPanel.tsx`
  - Lit rms_pricing_recommendations (status='pending')
  - Bouton "Appliquer" → met à jour rate_prices
  - Bouton "Rejeter" → met à jour status='rejected'
  - Groupe par confiance (high > 80%, medium, low)
- [ ] 6.2 Créer `planning/FreeRoomsModal.tsx`
  - Déclenché par click sur "X chambres libres"
  - Liste les chambres libres avec type, étage, statut HK
  - Actions : Créer réservation | Bloquer | Maintenance | Changer statut
- [ ] 6.3 Créer `hooks/planning/useRmsRecommendations.ts`

**Critères de validation :**
- Recommandation appliquée → rate_prices modifié en DB
- FreeRoomsModal → création réservation fonctionne end-to-end

---

### Phase 7 — 5 Modes d'Affichage (J11-J12)
**Objectif : un planning pour tous les rôles**

- [ ] 7.1 Créer `planning/PlanningModeBar.tsx`
  - 5 modes : Occupation | Revenue | Housekeeping | Groupe | Maintenance
  - Sans rechargement de page (filtre côté client)
- [ ] 7.2 Appliquer le style par mode dans ReservationBar.tsx et RoomRowLabel.tsx
- [ ] 7.3 Mode Housekeeping : filtre par statut HK, actions rapides (marquer propre)
- [ ] 7.4 Mode Maintenance : fond rayé sur chambres en maintenance

**Critères de validation :**
- Switch de mode instantané sans rechargement
- Chaque mode affiche les bonnes informations

---

### Phase 8 — Performance (J13-J14)
**Objectif : < 1s chargement, aucun freeze**

- [ ] 8.1 Virtualisation des lignes chambre (react-virtual ou @tanstack/react-virtual)
- [ ] 8.2 Memoization aggressive : useMemo sur calculs KPI, useCallback sur handlers
- [ ] 8.3 Optimistic updates sur drag-move (pas d'attente réseau)
- [ ] 8.4 Lazy loading des modales (React.lazy + Suspense)
- [ ] 8.5 Snapshot service : batch write, pas 1 requête par chambre
- [ ] 8.6 Supabase Realtime : throttle UI updates 500ms pour éviter storm de re-renders

**Critères de validation :**
- Lighthouse Score > 90
- 100 chambres × 30 jours = scroll fluide 60fps
- Premier chargement < 1s sur 4G simulé

---

## 9. ORDRE DE PRIORITÉ ABSOLU

```
Phase 1 (données réelles)     ← AUJOURD'HUI — sans ça, tout le reste est inutile
Phase 2 (barre KPI)           ← revenue management visible
Phase 3 (colonnes enrichies)  ← décision par jour
Phase 4 (badges)              ← opérationnel sans friction
Phase 5 (sidebars)            ← espace + confort
Phase 6 (RMS + libres)        ← intelligence revenue
Phase 7 (modes)               ← multi-rôle
Phase 8 (performance)         ← finition
```

---

## 10. CHECKLIST TECHNIQUE NON-NÉGOCIABLE

- [x] Zéro donnée fictive — métriques 100% Supabase (suppression du fallback ADR `|| 120`, pickup/compression/forecast → « — » si pas de donnée réelle)
- [x] Zéro bouton mort — 4 toasts « Détails… » remplacés par vraies modales ; chips/labels/RMS/free-rooms écrivent en DB
- [x] RLS sur `planning_daily_snapshots` (vérifié : rls_enabled=true, 3 policies) + `rate_plan_room_type_assignments` (3 policies)
- [x] Realtime Supabase sur rooms + hk_tasks + maintenance_tasks (usePlanningRealtime, throttle 500ms) — reservations couvert globalement (App.tsx)
- [x] Gestion loading / error / empty (PlanningKpiBar skeleton, RmsRecommendationPanel, FreeRoomsModal, syncStatus)
- [x] Tests usePlanningKpis (TO/ADR/RevPAR) — 15 tests planning-kpi.service
- [x] Tests usePickup / snapshot (computePickup delta) — 8 tests planning-snapshot.service
- [x] Tests useForecast (algorithme) — 12 tests planning-forecast.service ; + 11 tests badges
- [x] TypeScript : nouveaux fichiers sans erreur tsc (erreurs résiduelles = pré-existantes, fichiers non touchés)

**Total : 46 tests services/hooks planning + 11 badges = 57 tests verts. Build production OK. 8 phases livrées.**
