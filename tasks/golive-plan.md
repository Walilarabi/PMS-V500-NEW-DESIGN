# FLOWTYM — PLAN GO LIVE FOLKESTONE OPÉRA
## Release Manager · 10 jours · 1 juin 2026

> Règle : un bloqueur à la fois. On ne passe au suivant que sur validation explicite.
> Périmètre : aucune nouvelle feature, aucun design, RMS/events/rapports hors scope.

---

## CLASSIFICATION P0 / P1 / P2

### P0 — L'hôtel ne peut pas ouvrir

| # | Bloqueur | Symptôme en prod | Sprint |
|---|----------|-----------------|--------|
| P0-1 | `next_invoice_number` RPC manquant | Toute création de facture crash | 1 |
| P0-2 | Anti-surbooking — contrainte DB non confirmée | 2 réservations sur même chambre/dates simultanées → les 2 passent | 1 |
| P0-3 | `closure_start/execute_step/rollback` RPCs absents | Clôture journalière crash au démarrage | 1 |
| P0-4 | Génération nuitées recouchants absente | Nuitées non facturées automatiquement | 1 |
| P0-5 | `version` column sur reservations non confirmée | Check-in/check-out crash si colonne absente | 1 |

### P1 — L'hôtel peut ouvrir mais avec risque opérationnel

| # | Bloqueur | Symptôme | Sprint |
|---|----------|----------|--------|
| P1-1 | `deposits` table manquante | Acomptes/garanties CB silencieusement perdus | 2 |
| P1-2 | `credit_notes` table manquante | Avoirs impossibles sur annulations | 2 |
| P1-3 | `house_accounts` table manquante | Comptes internes non fonctionnels | 2 |
| P1-4 | Checkout sans garde-fou solde non nul | Client part sans payer — aucune alerte | 2 |
| P1-5 | Maintenance → chambre non bloquée auto | Chambre hors service peut être réservée | 3 |
| P1-6 | Checkout → HK non déclenchée auto | Chambre libérée non mise en ménage | 3 |
| P1-7 | Audit chaîne financière fin de journée | Clôture sans vérification soldes ouverts | 3 |

### P2 — Améliorations post-pilote

| # | Sujet | Sprint |
|---|-------|--------|
| P2-1 | Channel Manager réel (D-EDGE tokens + HTTP) | 4 |
| P2-2 | Dashboard Flowboard sur données réelles | Post-pilote |
| P2-3 | Export FEC conforme | Post-pilote |

---

## SPRINT 1 (J0–J2) — Facturation + Surbooking + Clôture

### Fichiers concernés

**Migrations à créer :**
- `supabase/migrations/20260613_golive_billing_core.sql`
  - Crée `next_invoice_number(p_hotel_id UUID)` → TEXT
  - Crée `issue_invoice(p_invoice_id UUID)` → déclenche verrouillage + TVA
  - Ajoute `version INTEGER DEFAULT 1` sur `reservations` si absent
  - Ajoute contrainte EXCLUDE anti-surbooking sur `reservations`

- `supabase/migrations/20260614_golive_closure_rpcs.sql`
  - Crée `closure_start(p_closure_date DATE)` → UUID
  - Crée `closure_execute_step(p_closure_id UUID, p_step INTEGER)` → JSONB
  - Crée `closure_rollback(p_closure_id UUID)` → JSONB
  - Crée `generate_night_audit_lines(p_closure_id UUID)` → INTEGER

**Frontend à modifier :**
- Aucun (les RPCs existent côté code, ils appellent juste des fonctions absentes)

### Tests à exécuter après chaque migration

**Sprint 1 — Tests smoke :**
1. Créer une facture → vérifier invoice_number généré (format `F-2026-0001`)
2. Tenter de créer 2 réservations simultanées sur même chambre/dates → vérifier ConflictError
3. Vérifier que `version` column existe et est incrémentée au check-in
4. Démarrer une clôture → vérifier que `closure_start` retourne un UUID valide
5. Exécuter step 1 → vérifier retour JSON `{ success: true }`

---

## SPRINT 2 (J3–J5) — Dépôts + Avoirs + Checkout guard

**Migrations à créer :**
- `supabase/migrations/20260615_golive_deposits_credits.sql`

**Frontend à modifier :**
- `src/domains/reservations/repository.ts` — checkOutReservation : vérifier solde avant
- `src/components/modals/CheckOutModal.tsx` (ou équivalent) — bloquer si solde > 0

---

## SPRINT 3 (J6–J8) — Liaisons automatiques

**Fichiers frontend :**
- `src/domains/reservations/repository.ts` — après checkOut → créer HK task
- `src/domains/housekeeping/index.ts` — createAutoHkTask(roomId, scheduledFor)
- `src/pages/flowday/MaintenanceView.tsx` — après création ticket → bloquer chambre en planning

---

## SPRINT 4 (J9–J10) — Channel Manager réel

- `src/services/channel-manager.service.ts` — remplacer simulateProviderCall par vraie HTTP
- `supabase/migrations/20260616_channel_manager_tables.sql`

---

## ORDRE D'EXÉCUTION STRICT

```
J0 : Migration 20260613_golive_billing_core.sql → tests smoke facturation
     → Validation humaine

J1 : Migration 20260614_golive_closure_rpcs.sql → tests smoke clôture
     → Validation humaine

J2 : Tests d'intégration complets Sprint 1 + push branche
     → Validation humaine

J3 : Migration 20260615_golive_deposits_credits.sql → tests acomptes/avoirs
     → Validation humaine

J4 : Frontend checkout guard + tests
     → Validation humaine

J5 : Push Sprint 2 + test end-to-end facturation complète
     → Validation humaine

J6 : Maintenance → auto room block
     → Validation humaine

J7 : Checkout → auto HK task
     → Validation humaine

J8 : Audit chaîne financière + rapport go/no-go
     → Validation humaine

J9–J10 : Channel Manager réel (conditionnel)
```
