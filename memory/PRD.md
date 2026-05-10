# FLOWTYM PMS — Product Requirements Document (live)

## 1. Mission

FLOWTYM is a mission-critical SaaS PMS for hotel groups. Architecture must be production-ready, multi-tenant, event-driven, security-first, DDD-oriented, performance-optimized.

## 2. Stack (current)

| Layer | Tech |
| ----- | ---- |
| Frontend | React 19 + Vite 6 + TypeScript + TailwindCSS 4 + Zustand + TanStack Query/Table + Zod |
| Auth + DB | Supabase (Postgres + Auth + RLS + **Realtime**) — project `hzrzkvdebaadditvbqis` |
| Backend stub | FastAPI placeholder (kept for future BullMQ/PDP webhooks) |

## 3. Architecture

- DDD by domain: `src/domains/{auth, reservations, guests, hotel, flowday, _shared}/`
- Each domain: `schemas.ts` (Zod), `repository.ts` (Supabase), `hooks.ts` (TanStack Query) + optional `realtime.ts`, dedicated UI banners/components.
- Strict tenant isolation via `hotel_id` + RLS policies (`get_user_hotel_id()`)
- Branded types (`TenantId`, `HotelId`, …) for compile-time safety
- Domain errors (`DomainError`, `NotFoundError`, `ConflictError`, …) + Postgrest mapping
- All currency values stored in numeric, displayed in EUR via `Intl.NumberFormat`
- Audit logs immutable via Postgres triggers
- Realtime invalidation through a single mounted bridge (`RealtimeBridge`) listening to `postgres_changes` on `reservations`/`rooms`.

## 4. What is implemented (Jan/Feb 2026)

### Phase 1 — Setup
- Repo restructured into `/app/frontend` (Vite) + `/app/backend` (FastAPI stub).
- Supervisor wired (`yarn start` on port 3000, FastAPI on 8001).
- Existing 9-page UI (Flowday, Planning, Reservations, Clients, Revenue, Finance, Analysis, Flowboard, Settings) running.

### Phase 2 — Supabase fundations
- Migration `0010_flowtym_align.sql`: `public.users`, `public.audit_logs`, fixed helpers, RPC `provision_user_for_hotel`, hotel-scoped RLS policies on every business table.
- Migration `0011_realtime.sql`: enable Postgres logical replication on `reservations`, `rooms`, `guests`, `invoices`, `payments`.
- Scripts: `yarn db:audit`, `yarn db:migrate`, `yarn tsx scripts/seed-admin.ts`.
- Typed client (`src/lib/supabase.ts` + `supabase.types.ts`).

### Phase 3 — Domains live
- **Auth**: login, getCurrentSession, onAuthStateChange, signOut, LoginPage premium, AuthProvider, RootGate, Topbar logout.
- **Hotel**: `useActiveHotel`, `useRooms`.
- **Reservations**: list/get/create/updateStatus + Zod schemas + TanStack hooks; `useCreateReservationFromForm` orchestrates guest find-or-create + reservation insert; `LiveReservationsBanner` (KPI + table snapshot).
- **Guests**: `findOrCreateGuest` repository.
- **Flowday adapter**: `useFlowdayDataset` maps reservations + rooms + guests into `FlowdayRoomRow[]` consumed by the new design (KPIs occupation/dirty rooms/arrivals/unpaid + operations table).
- **Realtime**: `useReservationsRealtime` subscribes to `postgres_changes` on `reservations` and `rooms`, invalidates TanStack Query caches automatically.

### Pages migrated to Supabase
- ✅ **Flowday** : KPIs, table d'opérations (Ali Larabi, Sophie Dubois, Pierre Bernard, Marie Martin), titre dynamique avec hôtel actif.
- ✅ **Reservations** : header, 5 KPIs (4 dossiers / 1 confirmée / 2 check-in / 2950€ / 1 à encaisser), pie chart dynamique par statut, tableau live avec 4 lignes, search + filters, Nouvelle réservation modal branché.
- ✅ **Planning** : Nouvelle réservation modal branché à Supabase (autres parties UI à migrer).
- ✅ **Revenue Integrity (SAS)** : 6 KPIs, validations récentes, flux d'anomalies, file de quarantaine, simulateur OTA, **Smart RIE — fiabilité partenaires (30j)**.
- ✅ **OTA Dispute Management (ODMS)** [NEW Feb 2026] : Centre de gestion des litiges, KPIs (ouverts / envoyés / corrigés / récupérés), tableau de fiabilité partenaire 30j, liste filtrable par statut (DRAFT/SENT/IN_REVIEW/CORRECTED/CLOSED), modal "Nouveau litige" avec composition automatique du sujet+description+email à partir d'une validation à risque, drawer détail avec timeline (status_history + messages), transitions FSM (DisputeWorkflowEngine), génération PDF de preuve client-side (jspdf + jspdf-autotable), email simulé persisté dans `ota_dispute_messages`, indicateur "Chambre fictive technique" via `quarantine_virtual_rooms`.
- ⬜ Clients, Revenue, Finance, Analyse, Flowboard, Settings : encore mock.

### Migrations DB ajoutées
- `0020_rie_*.sql`, `0021_rie_seed.sql` : RIE config + seeds.
- `0030_odms.sql` : ODMS — `ota_disputes`, `ota_dispute_messages` (immutable), `ota_dispute_status_history` (immutable), `ota_dispute_attachments`, `ota_dispute_participants`, `quarantine_virtual_rooms`, vue `partner_reliability_view`, RLS hotel-scoped, realtime publication.

### Bug fix Feb 2026
- `auth/repository.ts` `buildSession()` retourne désormais `userId = profile.id` (public.users.id) au lieu de `auth.users.id`. Corrige les contraintes FK sur `ota_disputes.created_by`, `ota_dispute_status_history.by_user_id`, `ota_dispute_messages.author_user_id`, `quarantine_reservations.resolved_by`.

### UI components
- `Toaster` global + `useToast` hook (success / destructive variants, auto-dismiss 4 s).
- Brand-aligned LoginPage (split-screen, violet accents).
- Logout button in Topbar with `data-testid`.

### State Supabase
- 5 hôtels en base ; "Mas Provencal Aix" : 10 chambres, 4 réservations (data live affichée partout).
- 9 utilisateurs auth — `walilarabi@gmail.com` (rôle `direction`) provisionné dans `public.users`.

## 5. Backlog (priority order)

### P0
- [x] **b** Wire ReservationFormModal to `useCreateReservation` (DONE — Reservations + Planning).
- [x] **c** Migrate Reservations page to live Supabase data (DONE).
- [x] **f** Realtime subscriptions on reservations/rooms (DONE).
- [x] **RIE** Revenue Integrity Engine + Smart RIE (DONE Jan/Feb 2026).
- [x] **ODMS** OTA Dispute Management UI (List + Drawer + Timeline + PDF + Email preview + FSM) (DONE Feb 2026).
- [ ] **a** Migrer la page Planning à Supabase (calendrier des chambres × dates avec drag & drop).
- [ ] **d** Module gestion des utilisateurs (rôle direction): liste collaborateurs + invitation + désactivation.
- [ ] **e** Domaine Billing (factures + paiements immuables, écritures inversées).

### P1
- [ ] Optimistic locking sur `reservations` (ajouter colonne `version` via migration + bump trigger).
- [ ] User profile self-update (mot de passe, nom, langue).
- [ ] Audit log UI (filtre par entité, période, acteur).
- [ ] Multi-hôtel switcher pour propriétaires de plusieurs établissements.
- [ ] **ODMS Relance Engine** : cron Edge Function lit `ota_disputes.due_at` et envoie relances J+2/J+5/J+10 selon `DisputeReminderEngine`.
- [ ] **ODMS envoi réel** : intégrer Resend (ou SendGrid) pour transformer la simulation locale en vrai envoi (clé `RESEND_API_KEY` à fournir par l'utilisateur).
- [ ] **Reconciliation Center** : rapprochement Finance bancaire ↔ payouts OTA ↔ disputes ouverts.

### P2 — compliance & ops
- [ ] FEC + UBL 2.1 export jobs (BullMQ + Node sidecar).
- [ ] PPF/PDP webhook receiver (HMAC verified).
- [ ] Performance: TanStack Virtual sur tableaux >200 lignes, Planning >365 jours.
- [ ] i18n (FR/EN), gestion devise non EUR.

## 6. Personas

- **Direction / owner**: full read+write, user management, exports fiscaux.
- **Receptionist**: réservations, guests, daily ops, pas de finance settings.
- **Housekeeping** (`gouvernante`, `femme_de_chambre`): tâches ménage + statut chambres.
- **Maintenance**: maintenance_tasks + room out-of-order toggles.

## 7. Known issues / quirks

- ESLint complains about TS parser (cosmetic, no runtime impact). `tsc --noEmit` passes.
- Self-service signup is disabled until a multi-tenant `provision_tenant_with_first_hotel` RPC is wired.
- Database password reset can take ~30 s to propagate to the pooler.
- The legacy `ReservationContext` mock still mirrors creates, so legacy Flowday/Planning sections that read from it stay consistent with Supabase (will be removed when those sections are fully migrated).

## 8. Operational notes

- Database password rotations: update `/app/backend/.env` `DATABASE_URL` and `/app/memory/test_credentials.md`.
- All migrations live in `/app/frontend/supabase/migrations/*.sql`. Run `yarn db:migrate`.
- Frontend hot reloads via Vite; supervisor restarts only needed on `.env` changes or new deps.
- Realtime requires the `supabase_realtime` publication to include the table — handled by migration `0011`.
