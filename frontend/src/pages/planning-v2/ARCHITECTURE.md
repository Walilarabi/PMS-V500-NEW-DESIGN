# PLANNING V2 — ARCHITECTURE ENTERPRISE

## OBJECTIF

Créer le meilleur planning hôtelier du marché :
- Plus fluide que Mews
- Plus propre que Apaleo
- Plus performant que protel
- Plus intuitif que Noovy

## PRINCIPES DE CONCEPTION

### 1. Performance
- Virtualisation obligatoire (react-window ou @tanstack/virtual)
- Lazy loading des cellules hors viewport
- Memoization agressive
- Pas de rerenders inutiles
- 60fps même avec 1000+ réservations

### 2. Architecture modulaire
```
planning-v2/
├── PlanningView.tsx          # Orchestrateur principal (≤200 lignes)
├── components/
│   ├── PlanningGrid.tsx      # Grille principale virtualisée
│   ├── PlanningHeader.tsx    # Toolbar + filtres + navigation dates
│   ├── RoomRow.tsx           # Ligne d'une chambre
│   ├── ReservationCard.tsx   # Carte réservation (AUCUN débordement)
│   ├── DateCell.tsx          # Cellule jour (événements, pricing)
│   ├── Sidebar.tsx           # Panneau latéral KPI/revenue
│   └── Modals/
│       ├── ReservationModal.tsx
│       ├── MoveModal.tsx
│       └── EventModal.tsx
├── hooks/
│   ├── usePlanningData.ts    # Fetch + cache + temps réel
│   ├── usePlanningFilters.ts # Logique filtres
│   ├── useDragAndDrop.ts     # Drag réservations
│   └── useReservationActions.ts # CRUD operations
├── types/
│   ├── planning.types.ts     # Types stricts
│   └── grid.types.ts
└── utils/
    ├── dateHelpers.ts
    ├── calculations.ts
    └── styles.ts
```

### 3. Design System
Toutes les dimensions, couleurs, espacements, typographie définis dans un fichier unique :
```typescript
export const PLANNING_DESIGN = {
  grid: {
    rowHeight: 56,          // Hauteur fixe d'une ligne (pas de débordement)
    cellWidth: 140,         // Largeur d'une cellule jour
    gutter: 1,              // Espacement inter-cellules
  },
  card: {
    padding: 12,
    borderRadius: 8,
    minHeight: 48,          // Toujours <= rowHeight - (2 × gutter)
    fontSize: {
      client: 13,
      details: 11,
    },
  },
  colors: {
    confirmed: '#10b981',   // Emerald
    pending: '#f59e0b',     // Amber
    cancelled: '#ef4444',   // Red
    option: '#8b5cf6',      // Violet
    checkedIn: '#3b82f6',   // Blue
  },
  typography: {
    menu: {
      size: 15,             // +20% vs actuel (12.5)
      weight: 500,
      family: 'Inter',
    },
    grid: {
      client: 13,
      room: 14,
      details: 11,
    },
  },
};
```

### 4. Gestion des débordements (ZÉRO TOLÉRANCE)
**Règle absolue** : une carte de réservation ne doit JAMAIS dépasser sa cellule.

Solutions techniques :
```tsx
// ReservationCard.tsx
<div
  className="absolute"
  style={{
    top: PLANNING_DESIGN.grid.gutter,
    left: startIndex * PLANNING_DESIGN.grid.cellWidth,
    width: dayCount * PLANNING_DESIGN.grid.cellWidth - (2 * PLANNING_DESIGN.grid.gutter),
    height: PLANNING_DESIGN.card.minHeight,
    overflow: 'hidden',  // CRITIQUE
  }}
>
  <div className="truncate">{clientName}</div>  {/* Text truncation */}
  <div className="text-ellipsis overflow-hidden">{details}</div>
</div>
```

**Techniques anti-débordement** :
- `overflow: hidden` sur la carte
- `truncate` / `text-ellipsis` sur tous les textes
- Tooltip au hover pour info complète
- Hauteur fixe calculée (jamais `auto` ou `fit-content`)

### 5. Temps réel (Supabase Realtime)
Toute modification doit être propagée instantanément :
- `useRealtimeSubscription('reservations')` → invalide cache
- Optimistic updates pour fluidité
- Rollback si erreur serveur

### 6. États de chargement
- Skeleton loaders pendant fetch initial
- Spinners inline pour actions
- Pas de blocage UI complet

## WORKFLOW DONNÉES

```
Supabase (source of truth)
    ↓
useQuery + Realtime
    ↓
Normalization + Enrichment
    ↓
Filter + Sort
    ↓
Virtualized Render
```

## RENDU VISUEL CIBLE

### Grille
```
┌────────────┬──────────┬──────────┬──────────┬──────────┐
│ Chambre    │ 16 Mai   │ 17 Mai   │ 18 Mai   │ 19 Mai   │
├────────────┼──────────┼──────────┼──────────┼──────────┤
│ 201        │ ▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓ │          │          │
│ Double     │ Jean D.  │          │          │          │
├────────────┼──────────┼──────────┼──────────┼──────────┤
│ 202        │          │ ▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓│
│ Double     │          │ Marie L. │          │          │
└────────────┴──────────┴──────────┴──────────┴──────────┘
```

Chaque carte :
- **Coins arrondis** (8px)
- **Ombre légère** (`shadow-sm`)
- **Bordure gauche** (4px, couleur statut)
- **Padding** interne uniforme (12px)
- **Typographie** :
  - Client : 13px, medium (500)
  - Détails : 11px, regular (400), text-gray-600

### Carte réservation (spec exacte)
```tsx
<div className="relative h-[48px] rounded-lg bg-white shadow-sm border-l-4 border-emerald-500 overflow-hidden">
  <div className="absolute inset-0 p-3 flex flex-col justify-between">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium text-gray-900 truncate">
        Jean Dupont
      </span>
      <Badge size="sm" variant="emerald">2N</Badge>
    </div>
    <div className="flex items-center gap-2 text-[11px] text-gray-600">
      <span className="truncate">Booking.com</span>
      <span>•</span>
      <span>450€</span>
    </div>
  </div>
</div>
```

## PRIORITÉS DE DÉVELOPPEMENT

### Phase 1 — Fondations (1-2 jours)
- [ ] Architecture modulaire
- [ ] Design system
- [ ] PlanningGrid virtualisée
- [ ] ReservationCard sans débordement
- [ ] Types stricts

### Phase 2 — Fonctionnalités (2-3 jours)
- [ ] Drag & drop
- [ ] Filtres
- [ ] Navigation dates
- [ ] Modales CRUD
- [ ] Sidebar revenue

### Phase 3 — Polish (1 jour)
- [ ] Animations
- [ ] Tooltips
- [ ] Skeleton loaders
- [ ] Responsive checks
- [ ] Tests performance

### Phase 4 — Intégration (1 jour)
- [ ] Connexion Supabase
- [ ] Realtime subscriptions
- [ ] Error handling
- [ ] Loading states

## CRITÈRES DE VALIDATION

Le Planning V2 sera considéré comme **production-ready** uniquement si :

✅ **Performance** : 60fps avec 500 réservations affichées
✅ **Visuel** : Aucun débordement, aucun alignement cassé
✅ **UX** : Toutes les actions < 200ms (ressenti)
✅ **Code** : Aucun composant > 300 lignes
✅ **Temps réel** : Mise à jour < 1s après modification DB
✅ **Accessibilité** : Navigation clavier fonctionnelle

## NEXT STEPS

1. Créer `PlanningGrid.tsx` avec virtualisation
2. Créer `ReservationCard.tsx` avec containment strict
3. Créer `usePlanningData.ts` avec TanStack Query
4. Brancher sur Supabase
5. Tester avec 1000+ réservations

---

**Ce document est le contrat d'architecture. Toute déviation doit être justifiée.**
