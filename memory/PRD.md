# FLOWTYM PMS — Product Requirements Document (live)

## 1. Mission

FLOWTYM is a mission-critical SaaS PMS for hotel groups. Architecture must be production-ready, multi-tenant, event-driven, security-first, DDD-oriented, performance-optimized.

## 2. Stack (current)

| Layer | Tech |
| ----- | ---- |
| Frontend | React 19 + Vite 6 + TypeScript + TailwindCSS 4 + Zustand + TanStack Query/Table + Zod |
| Auth + DB | Supabase (Postgres + Auth + RLS) — project `hzrzkvdebaadditvbqis` |
| Backend stub | FastAPI placeholder (kept for future BullMQ/PDP webhooks) |

## 3. Architecture

- DDD by domain: `src/domains/{auth, reservations, hotel, _shared}/`
- Each domain: `schemas.ts` (Zod), `repository.ts` (Supabase), `hooks.ts` (TanStack Query)
- Strict tenant isolation via `hotel_id` + RLS policies (`get_user_hotel_id()`)
- Branded types (`TenantId`, `HotelId`, …) for compile-time safety
- Domain errors (`DomainError`, `NotFoundError`, `ConflictError`, …)
- All currency values stored in cents server-side, displayed in EUR via `Intl`
- Audit logs immutable via Postgres triggers

## 4. What is implemented (Jan 2026)

### Phase 1 — Setup
- Repo restructured into `/app/frontend` (Vite) + `/app/backend` (FastAPI stub).
- Supervisor wired (`yarn start` on port 3000, FastAPI on 8001).
- Existing 9-page UI (Flowday, Planning, Reservations, Clients, Revenue, Finance, Analysis, Flowboard, Settings) running.

### Phase 2 — Supabase integration
- Migration `0010_flowtym_align.sql`: creates `public.users`, `public.audit_logs`, fixes `get_user_hotel_id()` / `get_user_role()` helpers, adds RPC `provision_user_for_hotel`, applies hotel-scoped RLS policies on every business table.
- Migration runner / auditor / inspector scripts (`yarn db:audit`, `yarn db:migrate`, `yarn tsx scripts/seed-admin.ts`).
- Typed Supabase client (`src/lib/supabase.ts` + `supabase.types.ts`).
- Auth domain with `loginWithPassword`, `getCurrentSession`, `onAuthStateChange`, `signOut`.
- LoginPage with split-screen brand panel + form (data-testid'd).
- AuthProvider + RootGate gate.
- Reservations domain: `listReservations`, `getReservation`, `createReservation`, `updateReservationStatus` + Zod row schema + TanStack hooks.
- Hotel domain: `useActiveHotel`, `useRooms`.
- LiveReservationsBanner injected at top of ReservationsView showing real Supabase rows for the active hotel.
- Logout button in Topbar (`data-testid="logout-button"`).

### State
- 5 hotels exist in Supabase, "Mas Provencal Aix" has 10 rooms + 4 reservations (live data flowing into the UI).
- 9 auth users — only `walilarabi@gmail.com` is provisioned in `public.users` so far.

## 5. Backlog (priority order)

### P0 — must have before public demo
- [ ] Replace mock data on Flowday/Today/Planning views with Supabase domain hooks.
- [ ] Wire ReservationFormModal to `useCreateReservation` (currently writes to local context only).
- [ ] User-management UI for `direction` role (list, invite, suspend) using `attach_user_to_tenant` RPC pattern.

### P1 — value adds
- [ ] Domain `billing` (invoices, payments) with immutable writes + correction entries.
- [ ] Domain `housekeeping` (room_cleaning_tasks, maintenance_tasks).
- [ ] Realtime subscription on `reservations` (Supabase channels) for live status updates.
- [ ] Optimistic locking via `version` column on `reservations` (currently absent in legacy schema; add via migration).

### P2 — compliance & ops
- [ ] FEC + UBL 2.1 export jobs (BullMQ once a Node backend is wired).
- [ ] PPF/PDP webhook receiver (HMAC verified) → `pdp_exchange_logs`.
- [ ] Audit log UI & retention policy.
- [ ] Multi-hotel switcher for owners managing multiple properties.

## 6. Personas

- **Direction / owner**: full read+write across the hotel + user management.
- **Receptionist**: reservations, guests, daily ops, no finance settings.
- **Housekeeping** (`gouvernante`, `femme_de_chambre`): room cleaning tasks + status updates.
- **Maintenance**: maintenance_tasks + room out-of-order toggles.
- **Accountant** (mapped to `direction` for now): invoices, payments, exports.

## 7. Known issues

- ESLint complains about TS parser (cosmetic, no runtime impact). The `tsc --noEmit` lint passes.
- Self-service signup is disabled until a multi-tenant `provision_tenant_with_first_hotel` RPC is wired.
- Reservation create flow on the legacy modal still writes to local mock context, not Supabase.
- Database password reset can take ~30 s to propagate to the pooler — documented in test_credentials.md.

## 8. Operational notes

- Database password rotations: update `/app/backend/.env` `DATABASE_URL` and `/app/memory/test_credentials.md`.
- All migrations live in `/app/frontend/supabase/migrations/*.sql`. Run `yarn db:migrate`.
- Frontend hot reloads via Vite; supervisor restarts only needed on `.env` changes or new deps.
