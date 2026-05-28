# TODO — Performance Optimisation
**Branche :** `claude/amazing-sagan-NZbfi`
Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

---

## Phase 1 — Fondations

- [ ] **T1** — QueryClient gcTime + useGuests staleTime (`main.tsx`, `guests/hooks.ts`)
- [ ] **T2** — Migration indexes billing (`20260531_billing_indexes.sql`)
- [ ] **T3** — Supprimer `RealtimeBridge.tsx` + `domains/reservations/realtime.ts` (dead code)

---

## Phase 2 — Couche données

- [ ] **T4** — Hook `useDebounce` + application ReservationsView, FoliosView, EInvoiceView
- [ ] **T5** — Invalidation ciblée : `reservations/hooks`, `guests/hooks`, `billing/hooks`
- [ ] **T6** — Pagination serveur `listReservations` + `listInvoices` + UI Prev/Next

---

## Phase 3 — Couche UI

- [ ] **T7** — `TableSkeleton` composant + intégration ReservationsView, FacturationView
- [ ] **T8** — Installer `@tanstack/react-virtual` + virtualiser ReservationsView, FacturationView
- [ ] **T9** — `React.memo(FilterSelect)` + `useMemo` channelOptions/roomTypeOptions
