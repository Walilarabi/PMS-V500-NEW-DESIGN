# Plan : Performance Optimisation — Flowtym PMS

**Date :** 2026-05-28
**Branche :** `claude/amazing-sagan-NZbfi`
**Scope :** 9 axes de performance — React Query, realtime, debounce, pagination, virtualisation, skeletons, memoïsation, indexes Supabase.

---

## Audit — Constats clés

### React Query
- `main.tsx:17-22` : `QueryClient` global sans `gcTime` (défaut 5 min)
- `domains/guests/hooks.ts:10-12` : `useGuests` sans `staleTime` → refetch à chaque render
- `domains/reservations/hooks.ts:66` : `invalidateQueries({ queryKey: ['reservations'] })` bust TOUTES les sous-queries sur chaque mutation

### Realtime — canal potentiellement zombie
- **DEUX** implémentations de `useReservationsRealtime` :
  - `hooks/useRealtimeChannels.ts` — montée dans `App.tsx:249`
  - `domains/reservations/realtime.ts` — importée par `RealtimeBridge.tsx`
- `RealtimeBridge.tsx` est **dead code** (jamais rendu dans le JSX)
- Si un jour rendu, 2 canaux `reservations` s'ouvriraient simultanément

### Debounce
- `ReservationsView.tsx:504` : `onChange → setSearchQuery` instantané, `useMemo` recalculé à chaque frappe
- Aucun hook `useDebounce` partagé dans le codebase
- `FoliosView.tsx:54-63` et `EInvoiceView.tsx:84-93` : debounce maison `useRef+setTimeout` non réutilisé

### Virtualisation
- `@tanstack/react-virtual` **non installé**
- `ReservationsView` (881 lignes), `FacturationView` (473 lignes) : rendu DOM complet
- Tableaux avec pagination locale uniquement (pas de pagination serveur)

### Skeletons
- `Analysis/ReportSkeleton.tsx` existe — cantonné au module Analyse
- `ReservationsView:636-641` : texte "Chargement des réservations…" seulement
- Aucun skeleton pour tableaux principaux (Réservations, Facturation, Clients)

### Indexes Supabase
- Billing tables (`invoices`, `folios`, `invoice_lines`, `payments`) créées par
  `20260530_billing_rls.sql` sans aucun index

---

## Graphe de dépendances

```
Phase 1 (fondations — aucun changement UX visible)
  T1 QueryClient config     ← sans dépendance
  T2 Billing indexes        ← sans dépendance
  T3 Realtime cleanup       ← sans dépendance

Phase 2 (données — après Phase 1)
  T4 useDebounce hook       ← T1
  T5 Invalidation ciblée    ← T1
  T6 Pagination serveur     ← T1, T5

Phase 3 (UI — après Phase 2)
  T7 Skeleton loaders       ← T4
  T8 Virtualisation         ← T6
  T9 React.memo/useMemo     ← T8
```

---

## Phase 1 — Fondations

### T1 — QueryClient : gcTime, staleTime cohérents, guests fix
**Scope :** S (2 fichiers)
**Fichiers :** `frontend/src/main.tsx`, `domains/guests/hooks.ts`

Ajoute `gcTime: 10 * 60_000` aux defaults globaux. Corrige `useGuests` qui n'a
aucun `staleTime` (0 = refetch à chaque render).

**Acceptance criteria**
- [ ] `main.tsx` : `defaultOptions.queries` contient `gcTime: 10 * 60_000`
- [ ] `useGuests` : `staleTime: 30_000` ajouté
- [ ] `npm test` vert

**Verification :** `npm test` + `npm run build`

---

### T2 — Migration indexes billing
**Scope :** XS (1 fichier SQL)
**Fichiers :** `supabase/migrations/20260531_billing_indexes.sql` (nouveau)

Index `(hotel_id, created_at DESC)` sur `invoices`, `folios`, `invoice_lines`,
`payments`. Index FK `(invoice_id)` sur `folios`, `invoice_lines`, `payments`.
Index `(status)` sur `invoices`.

**Acceptance criteria**
- [ ] Migration idempotente (`IF NOT EXISTS`)
- [ ] Couvre les 4 tables
- [ ] Syntaxe SQL valide

**Verification :** lecture du fichier SQL

---

### T3 — Consolidation realtime (dead code + doublon)
**Scope :** S (3 fichiers)
**Fichiers :** `RealtimeBridge.tsx`, `domains/reservations/realtime.ts`, `App.tsx`

Supprimer `RealtimeBridge.tsx` et `domains/reservations/realtime.ts`. App.tsx
importe uniquement depuis `hooks/useRealtimeChannels.ts`.

**Acceptance criteria**
- [ ] `RealtimeBridge.tsx` supprimé (ou redirige vers null)
- [ ] `domains/reservations/realtime.ts` supprimé
- [ ] Une seule instance du canal `flowtym:reservations:live` à l'ouverture
- [ ] `npm test` vert

**Verification :** grep confirme un seul import de `useReservationsRealtime`

---

### ✅ Checkpoint Phase 1
- [ ] `npm test` vert
- [ ] `npm run build` propre
- [ ] Pas de régression UI

---

## Phase 2 — Couche données

### T4 — Hook `useDebounce` partagé + application
**Scope :** M (4 fichiers)
**Fichiers :**
- `frontend/src/hooks/useDebounce.ts` (nouveau)
- `pages/ReservationsView.tsx`
- `pages/finance/FoliosView.tsx`
- `pages/finance/EInvoiceView.tsx`

Hook générique `useDebounce<T>(value: T, delay = 300): T`. Appliqué à
ReservationsView (`useMemo` dépend de `debouncedSearch`, pas de `searchQuery`).
Remplace les `useRef+setTimeout` maisons dans FoliosView et EInvoiceView.

**Acceptance criteria**
- [ ] `useDebounce.ts` : hook pur, test unitaire inclus
- [ ] `ReservationsView` : `useMemo` filter dépend de `debouncedSearch`
- [ ] FoliosView, EInvoiceView : useRef+setTimeout remplacés
- [ ] Aucun filtre ne se déclenche avant 300ms d'inactivité

**Verification :** taper rapidement → le filtre ne se met à jour qu'après pause

---

### T5 — Invalidation ciblée des mutations
**Scope :** M (3 fichiers)
**Fichiers :**
- `domains/reservations/hooks.ts`
- `domains/guests/hooks.ts`
- `domains/billing/hooks.ts`

Remplacer les invalidations broad par des invalidations + `setQueryData` ciblées :
- `updateReservation` → `setQueryData(['reservations','one',id])` + invalide `['reservations','list']` seulement
- `createReservation` → invalide `['reservations','list']` et `['reservations','range',...]`
- `cancelReservation` → `setQueryData` + invalide `['reservations','list']`
- `createGuest` → invalide `['guests', {}]` (pas le profil 360)
- Billing : vérifier `addInvoiceLine` (déjà ciblé `['invoice_lines', invoiceId]`)

**Acceptance criteria**
- [ ] Aucun `invalidateQueries({ queryKey: RESERVATIONS_KEY })` broad restant dans les mutations (sauf realtime)
- [ ] `updateReservation` met à jour le cache en place avant d'invalider
- [ ] `npm test` vert

**Verification :** DevTools TanStack Query → après update, seules les queries affectées re-fetched

---

### T6 — Pagination serveur Réservations + Facturation
**Scope :** L (5 fichiers)
**Fichiers :**
- `domains/reservations/repository.ts`
- `domains/reservations/hooks.ts`
- `domains/billing/repository.ts`
- `domains/billing/hooks.ts`
- `pages/ReservationsView.tsx`
- `pages/finance/FacturationView.tsx`

`listReservations` et `listInvoices` acceptent `{ limit: 50, offset }`, retournent
`{ rows, total }`. `useReservations` et `useInvoices` exposent `page`, `setPage`,
`totalPages`. Les vues affichent "Page X / Y" avec boutons Précédent/Suivant.

**Acceptance criteria**
- [ ] `listReservations` retourne `{ rows, total }` avec limit/offset
- [ ] `queryKey` inclut `{ limit, offset }` → cache par page
- [ ] Navigation page 1→2→1 : retour page 1 sans réseau (cache hit)
- [ ] Boutons Précédent/Suivant visibles et fonctionnels
- [ ] Tests repository mis à jour

**Verification :** DevTools Network → retour page 1 = 0 requête réseau

---

### ✅ Checkpoint Phase 2
- [ ] `npm test` vert
- [ ] `npm run build` propre
- [ ] Recherche ne spamme plus le réseau
- [ ] Pagination serveur visible

---

## Phase 3 — Couche UI

### T7 — Skeleton loaders tableaux
**Scope :** M (4 fichiers)
**Fichiers :**
- `components/ui/TableSkeleton.tsx` (nouveau)
- `pages/ReservationsView.tsx`
- `pages/finance/FacturationView.tsx`

Composant `<TableSkeleton rows={8} cols={6} />` avec `animate-pulse`. Remplace
les textes "Chargement..." par le skeleton dans les 3 vues principales.

**Acceptance criteria**
- [ ] `TableSkeleton` accepte `rows` et `cols`
- [ ] Les vues affichent le skeleton pendant `isLoading`
- [ ] Aucune régression états vides / erreur

**Verification :** DevTools → throttle "Slow 3G" → skeleton visible avant données

---

### T8 — Virtualisation `@tanstack/react-virtual`
**Scope :** L (3 fichiers)
**Fichiers :**
- `package.json` (add `@tanstack/react-virtual`)
- `pages/ReservationsView.tsx`
- `pages/finance/FacturationView.tsx`

`useVirtualizer` avec `estimateSize: () => 52`, `overscan: 5`. Conteneur
scrollable à hauteur fixe (CSS `overflow-y: auto; height: calc(100vh - Xpx)`).

**Acceptance criteria**
- [ ] `@tanstack/react-virtual` dans `dependencies`
- [ ] Avec 500 lignes : < 30 `<tr>` dans le DOM à tout moment
- [ ] Scroll fluide, hauteur stable (pas de saut)
- [ ] `npm test` vert

**Verification :** DevTools Elements → compter `<tr>` pendant scroll

---

### T9 — React.memo + useMemo sur composants lourds
**Scope :** S (2 fichiers)
**Fichiers :**
- `pages/ReservationsView.tsx`
- `pages/finance/FacturationView.tsx`

Enveloppe `FilterSelect` dans `React.memo`. Déplace `channelOptions`,
`roomTypeOptions`, `statusOptions` dans `useMemo` dépendant de leurs sources.

**Acceptance criteria**
- [ ] `FilterSelect` wrappé dans `React.memo`
- [ ] `channelOptions` etc. : `useMemo` avec dépendances correctes
- [ ] React Profiler : `FilterSelect` ne re-render pas lors d'une frappe dans la recherche

**Verification :** React DevTools Profiler → saisir dans recherche → FilterSelect ne flamme pas

---

### ✅ Checkpoint Phase 3 (final)
- [ ] `npm test` vert
- [ ] `npm run build` propre
- [ ] Virtualisation : ≤ 30 lignes DOM simultanées
- [ ] Skeleton sur toutes les vues principales
- [ ] Aucune requête dupliquée visible dans DevTools Network

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| `react-virtual` casse le layout tableau | Moyen | Wrapper div avec hauteur fixe + overflow-y: auto |
| Pagination serveur brise les filtres locaux | Moyen | Les filtres deviennent params query, pas state local |
| Invalidation ciblée → incohérence cache | Faible | `setQueryData` + invalide list = cohérent |
| `gcTime` réduit vide le cache trop tôt | Faible | 10 min reste large, réglable |

## Hors scope
- Virtualisation du Gantt planning (canvas/SVG, logique différente)
- Pagination GuestsListPage (non prioritaire)
- Profiling complet PlanningViewLive (2 181 lignes — tâche séparée)
