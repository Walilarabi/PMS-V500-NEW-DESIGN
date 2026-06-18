# Plan d'implémentation Sprint 4 — Sécurisation comptable

**Version** : 1.0  
**Date** : 2026-06-18  
**Branche cible** : `accounting-security-sprint-4` (à créer après validation de ce plan)  
**État système** : `main` HEAD `edfb1c6` (post-merge sprint-1/2/devops-1 + plan pilote v1)  
**Validation requise avant tout développement**

---

## Sommaire

1. [Architecture cible](#1-architecture-cible)
2. [Impacts fonctionnels](#2-impacts-fonctionnels)
3. [Impacts base de données](#3-impacts-base-de-données)
4. [Impacts frontend](#4-impacts-frontend)
5. [Stratégie de migration](#5-stratégie-de-migration)
6. [Stratégie de rollback](#6-stratégie-de-rollback)
7. [Plan de tests](#7-plan-de-tests)
8. [Risques de régression](#8-risques-de-régression)
9. [Effort estimé & planification](#9-effort-estimé--planification)
10. [Décisions à valider avant développement](#10-décisions-à-valider-avant-développement)

---

## 1. Architecture cible

### 1.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                            FRONTEND                                  │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │ FacturationView    │  │ PaymentModal       │  │ AdminBilling │  │
│  │ - createInvoice()  │  │ - addPayment()     │  │              │  │
│  │ - issueInvoice()   │  │ - reversePayment() │  │              │  │
│  │ - voidInvoice()    │  │                    │  │              │  │
│  └────────┬───────────┘  └────────┬───────────┘  └──────────────┘  │
└───────────┼─────────────────────────┼─────────────────────────────────┘
            │                         │
            │  PostgREST/Supabase     │
            │                         │
            ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            DATABASE                                  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  RPC METIER (SECURITY DEFINER + guard tenant)                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                    │  │
│  │  │ register_payment │  │ next_invoice_num │  (V13)             │  │
│  │  │   [Sprint 4 P1A] │  │   [Sprint 4 P1B] │                    │  │
│  │  └────────┬─────────┘  └──────────────────┘                    │  │
│  │           │                                                     │  │
│  │           │  SET LOCAL app.invoice_recalc_active='true'         │  │
│  │           ▼                                                     │  │
│  └───────────┼─────────────────────────────────────────────────────┘  │
│              │                                                       │
│  ┌───────────▼─────────────────────────────────────────────────────┐  │
│  │  TABLES + TRIGGERS                                              │  │
│  │  ┌──────────────────────┐  ┌─────────────────────────────────┐ │  │
│  │  │ invoices              │  │ TRIGGER protect_invoice_         │ │  │
│  │  │ - paid_amount         │──▶│ financials (BEFORE UPDATE)     │ │  │
│  │  │ - total_ttc           │  │ [Sprint 4 P1A] vérifie session  │ │  │
│  │  │ - status              │  │ var pour autoriser ou bloquer   │ │  │
│  │  └──────────┬───────────┘  └─────────────────────────────────┘ │  │
│  │             ▲                                                   │  │
│  │             │ recalc_invoice_paid() (existant, à modifier)      │  │
│  │             │ ↑ pose app.invoice_recalc_active='true' avant     │  │
│  │  ┌──────────┴───────────┐                                       │  │
│  │  │ payments              │                                       │  │
│  │  └──────────────────────┘                                       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  AUDIT TRAIL (existant, append-only)                          │  │
│  │  - audit_logs (chaîne crypto SHA-256, no_update, no_delete)   │  │
│  │  - audit_alerts_invoice_financial_changes (vue nouvelle)      │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Composants livrés

| ID | Composant | Type | Localisation |
|---|---|---|---|
| V13 | Trigger `protect_invoice_financials` | DB trigger BEFORE UPDATE | `supabase/migrations/20260653_lock_invoices_post_issue.sql` |
| V14 | Fonction `protect_invoice_financials()` | DB function | idem |
| V15 | RPC `register_payment` | DB RPC SECURITY DEFINER | `supabase/migrations/20260653_lock_invoices_post_issue.sql` |
| V16 | RPC `void_invoice` | DB RPC SECURITY DEFINER | `supabase/migrations/20260653_lock_invoices_post_issue.sql` |
| V17 | Mise à jour `recalc_invoice_paid()` | DB function | `supabase/migrations/20260653_lock_invoices_post_issue.sql` |
| V18 | Guard `next_invoice_number(p_hotel_id)` | DB RPC patch | `supabase/migrations/20260654_seq_guards.sql` |
| V19 | Guard `next_contract_number(p_hotel_id)` | DB RPC patch | `supabase/migrations/20260654_seq_guards.sql` |
| V20 | Vue `audit_alerts_invoice_financial_changes` | DB view | `supabase/migrations/20260655_audit_alerts_views.sql` |
| F1 | Adaptation `addPayment()` | Frontend | `frontend/src/domains/billing/repository.ts` |
| F2 | Adaptation `reversePayment()` | Frontend | `frontend/src/domains/billing/repository.ts` |
| F3 | Adaptation `voidInvoice()` | Frontend | `frontend/src/domains/billing/repository.ts` |
| F4 | Toast d'erreur `INVOICE_FINANCIAL_FIELDS_LOCKED` | Frontend | `frontend/src/domains/billing/repository.ts` (mapping erreur) |
| T1 | Tests SQL régression | Test DB | `supabase/tests/sprint4_accounting.test.sql` |
| T2 | Tests Vitest billing | Test JS | `frontend/src/domains/billing/repository.test.ts` |
| T3 | Test E2E Playwright | Test E2E | `frontend/tests/e2e/06-billing-immutability.spec.ts` |
| T4 | Job CI `sql-regression` | CI/CD | `.github/workflows/ci.yml` (mise à jour) |

### 1.3 Machine d'états des factures (cible)

```
                ┌─────────┐
                │  draft  │ ◄── création (createInvoice)
                └────┬────┘
                     │ issueInvoice()
                     ▼
                ┌─────────┐
        ┌──────►│ issued  │
        │       └────┬────┘
        │            │ recalc_invoice_paid() quand
        │            │ paid_amount >= total_ttc
        │            ▼
        │       ┌─────────┐
        │       │  paid   │
        │       └────┬────┘
        │            │ reverse_payment() ramène
        │            │ paid_amount < total_ttc
        │            ▼ (retour à issued)
        │
        │       ┌─────────┐
        ├──────►│  sent   │ (envoi externe, optionnel)
        │       └────┬────┘
        │            │
        │            ▼
        │       ┌─────────┐
        ├──────►│ overdue │ (cron qui détecte due_date dépassée)
        │       └────┬────┘
        │            │
        ▼            ▼
   ┌─────────┐  ┌─────────┐
   │cancelled│  │ voided  │ ◄── voidInvoice() — terminal
   └─────────┘  └─────────┘
   (depuis draft uniquement)

Transitions interdites :
 - paid → draft, paid → issued (sauf via reverse_payment)
 - voided → * (terminal)
 - cancelled → * (terminal)
 - Saut direct draft → paid (forcément via issued + paiement)
```

### 1.4 Mécanisme de session var

```sql
-- Pattern dans RPC qui doit pouvoir modifier les champs verrouillés
CREATE OR REPLACE FUNCTION public.register_payment(...)
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Vérifications de sécurité (tenant, droits, montant > 0)
  -- ...

  -- 2. Insérer le payment
  INSERT INTO public.payments(...) VALUES (...);
  -- ↑ Déclenche recalc_invoice_paid() qui va UPDATE invoices

  -- 3. recalc_invoice_paid() doit également poser la session var
  --    (modification dans le trigger lui-même, voir V17)

  RETURN payment_id;
END $$;

-- Pattern dans trigger recalc_invoice_paid() existant (modification V17)
CREATE OR REPLACE FUNCTION public.recalc_invoice_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER ...
AS $$
BEGIN
  -- Pose la session var pour bypass protect_invoice_financials
  PERFORM set_config('app.invoice_recalc_active', 'true', true);  -- 'true' = LOCAL
  -- ... logique existante de recalcul ...
END $$;
```

**Caractéristiques de la session var** :
- Portée : `SET LOCAL` ou `set_config(..., true)` = **transaction uniquement**
- Jamais persistée après commit
- Inaccessible côté frontend (jamais transmise via PostgREST)
- Inspectable via `current_setting('app.invoice_recalc_active', true)` (le 2e arg `true` = retourner `''` si non défini, pas d'erreur)

---

## 2. Impacts fonctionnels

### 2.1 Cas d'usage — comportement attendu

| Cas d'usage | Avant | Après | Bypass autorisé ? |
|---|---|---|---|
| Création facture draft | UPDATE direct OK | UPDATE direct OK (status='draft' → free) | n/a |
| Émission facture (draft → issued) | UPDATE direct status | UPDATE direct status (transition autorisée par machine d'états) | n/a |
| Annulation facture draft | UPDATE direct status='cancelled' | RPC `void_invoice` ou UPDATE direct (cancellation autorisée depuis draft) | RPC pose session var |
| Annulation facture issued | UPDATE direct status='voided' | RPC `void_invoice` obligatoire | ✅ RPC pose session var |
| Encaissement paiement | INSERT payments + UPDATE invoices.status='paid' redondant | RPC `register_payment` OU INSERT payments directs (trigger fait le reste) | ✅ Trigger `recalc_invoice_paid` pose session var |
| Annulation paiement | INSERT payment négatif + UPDATE payment original | RPC `reverse_payment` (à créer ou utiliser pattern register) | ✅ |
| Modification `total_ttc` post-issue | UPDATE direct | 🚫 BLOQUÉ par trigger sauf si session var posée | Admin override uniquement (rare) |
| Modification `paid_amount` post-issue | UPDATE direct | 🚫 BLOQUÉ par trigger sauf si session var posée | Trigger recalc only |
| Modification `invoice_number` post-issue | UPDATE direct | 🚫 BLOQUÉ par trigger | ❌ Jamais |
| Création avoir (credit_note) | Insertion dans `credit_notes` | Inchangé (table séparée) | n/a |
| Refresh statut overdue (cron) | UPDATE direct status='overdue' | RPC dédié `mark_overdue_invoices` | ✅ RPC pose session var |

### 2.2 Workflows utilisateur impactés

| Workflow | Impact | Adaptation requise |
|---|---|---|
| **Réception : encaisser un paiement** | UI inchangée (toujours bouton "Encaisser") | Backend appelle RPC au lieu de INSERT/UPDATE direct |
| **Réception : modifier une facture émise** | UI nouvelle erreur | Toast clair "Facture verrouillée, créer un avoir" |
| **Comptabilité : annuler une facture émise** | UI inchangée | Backend appelle RPC `void_invoice` |
| **Comptabilité : recalculer TVA** | Cas exceptionnel | Procédure manuelle documentée (superadmin uniquement) |
| **Tous workflows lecture** | Aucun impact | n/a |

### 2.3 Erreurs métier exposées au frontend

| Code erreur | Origine | UX attendue |
|---|---|---|
| `INVOICE_FINANCIAL_FIELDS_LOCKED` | trigger V13 | Toast d'erreur : "Cette facture est en statut [X], ses champs financiers sont verrouillés. Pour corriger : émettre un avoir." |
| `INVOICE_INVALID_STATUS_TRANSITION` | trigger V13 | Toast d'erreur : "Transition de [draft] vers [paid] non autorisée." |
| `FORBIDDEN_CROSS_TENANT_SEQUENCE` (V18/V19) | RPC patched | Erreur silencieuse + log Sentry (ne devrait jamais arriver via UI) |
| `INVALID_AMOUNT` | RPC `register_payment` | Toast d'erreur : "Montant invalide." |
| `INVOICE_NOT_FOUND` | RPC `register_payment` | Toast d'erreur standard |

---

## 3. Impacts base de données

### 3.1 Objets créés / modifiés

#### Migration `20260653_lock_invoices_post_issue.sql` (Plan A)

| Action | Objet | Description |
|---|---|---|
| CREATE | `app.protect_invoice_financials()` | Fonction trigger BEFORE UPDATE |
| CREATE | trigger `trg_protect_invoice_financials` ON `public.invoices` | Trigger BEFORE UPDATE |
| CREATE OR REPLACE | `public.register_payment(p_invoice_id, p_amount, p_method, p_currency, p_reference)` | RPC SECURITY DEFINER |
| CREATE OR REPLACE | `public.void_invoice(p_invoice_id, p_reason)` | RPC SECURITY DEFINER |
| CREATE OR REPLACE | `public.recalc_invoice_paid()` | Modifié pour poser session var (V17) |
| GRANT | `register_payment` EXECUTE TO authenticated, service_role | |
| GRANT | `void_invoice` EXECUTE TO authenticated, service_role | |
| REVOKE | `register_payment`, `void_invoice` FROM anon | Sécurité |

#### Migration `20260654_seq_guards.sql` (Plans B + C)

| Action | Objet | Description |
|---|---|---|
| CREATE OR REPLACE | `public.next_invoice_number(p_hotel_id)` | Patch V18 : guard `get_user_hotel_id() = p_hotel_id OR is_platform_admin()` |
| CREATE OR REPLACE | `public.next_contract_number(p_hotel_id)` | Patch V19 : idem (passage INVOKER → DEFINER) |

#### Migration `20260655_audit_alerts_views.sql` (V20)

| Action | Objet | Description |
|---|---|---|
| CREATE | `public.audit_alerts_invoice_financial_changes` | Vue de monitoring `security_invoker=true` |
| GRANT | SELECT TO authenticated | Avec filtre `hotel_id = get_user_hotel_id() OR is_platform_admin()` |

### 3.2 Lignes de données affectées

| Effet | Volume estimé en prod |
|---|---|
| Lignes `invoices` impactées par le trigger | 19 existantes + futures (~5-50/jour/hôtel) |
| Lignes `payments` impactées par recalc modifié | 4 existantes + futures |
| Lignes `audit_logs` créées en plus | 0 (la vue ne génère pas, elle filtre) |
| Aucun DML destructif | ✅ Migration purement DDL |

### 3.3 Indexation

Aucun nouvel index nécessaire dans un premier temps. À surveiller :
- Performance du trigger sur volume (mesurée < 1 ms par invoice update en dev)
- Performance vue `audit_alerts_invoice_financial_changes` avec WHERE `payload->'diff' ?| array[...]` — l'opérateur JSON `?|` utilise GIN si disponible. À surveiller sur > 100k audit_logs.

### 3.4 Storage / volumétrie

| Élément | Avant | Après | Delta |
|---|---|---|---|
| Triggers actifs sur `invoices` | 2 | 3 | +1 |
| Lignes table | inchangé | inchangé | 0 |
| Fonctions stockées | -3 RPC | +3 RPC | +3 |
| Vues | inchangé | +1 | +1 |

Aucun impact significatif sur la volumétrie.

---

## 4. Impacts frontend

### 4.1 Inventaire des UPDATE directs actuels sur `invoices`

Audit hands-on du repo confirmé (3 occurrences seulement) :

| Fichier | Ligne | Code actuel | Statut |
|---|---|---|---|
| `frontend/src/domains/billing/repository.ts:120` (`issueInvoice`) | 122 | `.update({ status: 'issued', issued_at: now() }).eq('id', id).eq('status', 'draft')` | ✅ Compatible (transition draft→issued autorisée par trigger) |
| `frontend/src/domains/billing/repository.ts:144` (`voidInvoice`) | 146 | `.update({ status: 'voided', notes: reason }).eq('id', id).in('status', ['draft', 'issued'])` | ⚠️ Compatible draft→voided, mais issued→voided nécessite session var → **migrer vers RPC `void_invoice`** |
| `frontend/src/domains/billing/repository.ts:311` (`addPayment`) | 311-313 | `.update({ status: 'paid' }).eq('id', input.invoiceId)` | 🟢 **À retirer** : trigger `recalc_invoice_paid` fait déjà cet update automatiquement |
| `frontend/src/pages/admin/AdminBilling.tsx:212` | 212 | `.from('platform_invoices')` (TABLE DIFFÉRENTE — `platform_invoices`, pas `invoices`) | ✅ Hors scope (table abonnements plateforme, pas factures hôtel) |

**Synthèse impact frontend** : **minimal** — 1 fichier modifié, 3 fonctions adaptées.

### 4.2 Modifications attendues `repository.ts`

#### F1 — `addPayment()` (lignes 286-324)

**Avant** :
```typescript
export async function addPayment(hotelId, input) {
  // INSERT payments...
  const payment = paymentRowSchema.parse(data);
  const invoice = await getInvoice(input.invoiceId);
  if (invoice.balance <= 0 && invoice.status === 'issued') {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', input.invoiceId);  // ← REDONDANT
  }
  await writeAuditLog(...);
  return payment;
}
```

**Après** :
```typescript
export async function addPayment(hotelId, input) {
  // Utiliser la RPC register_payment qui gère tout (insert + recalc trigger fait le reste)
  const { data, error } = await supabase.rpc('register_payment', {
    p_invoice_id: input.invoiceId,
    p_amount:     input.amount,
    p_method:     input.method,
    p_reference:  input.reference ?? null,
  });
  if (error) handleBillingError(error);
  // Récupérer la ligne payment créée (le RPC retourne son id)
  const { data: payment } = await supabase.from('payments').select('*').eq('id', data).single();
  await writeAuditLog(...);
  return paymentRowSchema.parse(payment);
}
```

#### F2 — `reversePayment()` (lignes 330+)

À adapter pour appeler une RPC `reverse_payment` qui pose la session var. Ou conserver les UPDATE directs `payments` (pas concerné par le trigger sur `invoices`) et laisser le trigger recalc faire le reste — **à valider lors du développement**.

#### F3 — `voidInvoice()` (lignes 144-158)

**Avant** :
```typescript
export async function voidInvoice(id, reason) {
  await supabase.from('invoices').update({ status: 'voided', notes: reason })
    .eq('id', id).in('status', ['draft', 'issued']);
  // ...
}
```

**Après** :
```typescript
export async function voidInvoice(id, reason) {
  // Appeler la RPC pour bypass le trigger sur issued
  const { data, error } = await supabase.rpc('void_invoice', {
    p_invoice_id: id,
    p_reason: reason,
  });
  if (error) handleBillingError(error);
  // ...
}
```

#### F4 — Mapping erreurs

**Ajout dans `handleBillingError()`** :
```typescript
function handleBillingError(error) {
  if (error.message?.includes('INVOICE_FINANCIAL_FIELDS_LOCKED'))
    throw new ConflictError('Cette facture est verrouillée. Pour corriger un montant, émettez un avoir.');
  if (error.message?.includes('INVOICE_INVALID_STATUS_TRANSITION'))
    throw new ConflictError('Transition de statut non autorisée.');
  // ... cas existants ...
}
```

### 4.3 Composants UI à vérifier (sans modification a priori)

| Composant | Vérification |
|---|---|
| `FacturationView.tsx` | Appels existants à `issueInvoice/voidInvoice/addPayment` → adaptés via repository ✅ |
| `PreBillingControlPanel.tsx` | Lecture seule sur invoices ✅ |
| Modales paiement (`RegisterPaymentModal` si existant) | Appelle `addPayment()` du repo → impact transparent ✅ |
| Modales facturation (édition draft) | UI inchangée (draft = modifiable) ✅ |
| Reporting / Analyse | Lecture seule ✅ |

### 4.4 Type Supabase à régénérer

Après création des nouvelles RPC `register_payment` et `void_invoice`, regénérer les types Supabase :
```bash
npx supabase gen types typescript --project-id hzrzkvdebaadditvbqis > frontend/src/lib/supabase.types.ts
```

Cela ajoutera les signatures TypeScript des nouvelles RPC, éliminant le besoin de `as any`.

---

## 5. Stratégie de migration

### 5.1 Approche en 4 phases

Migration **incrémentale** et **rétro-compatible** à chaque phase. Permet de revenir en arrière à n'importe quelle étape sans corruption.

#### Phase 1 — Déployer les RPC + Vue audit (sans trigger)

**Durée** : J1 à J3

**Actions** :
1. Créer la migration `20260653_lock_invoices_post_issue.sql` SANS le trigger (seulement les fonctions + RPC)
2. Créer la migration `20260654_seq_guards.sql` (V18 + V19)
3. Créer la migration `20260655_audit_alerts_views.sql` (V20)
4. Appliquer en prod via `apply_migration` MCP
5. **Tester en prod (read-only)** : pentest hands-on que les nouvelles RPC fonctionnent + guards efficaces

**Compatibilité** : 100% — aucun changement de comportement utilisateur. Le frontend continue à utiliser UPDATE direct.

**Critère de validation Phase 1** :
- RPC `register_payment` testée en SQL : INSERT + recalc trigger correctement
- RPC `void_invoice` testée
- RPC `next_invoice_number(hotel_B)` depuis user A lève `42501`
- Vue `audit_alerts_invoice_financial_changes` retourne 0 ligne (état actuel propre)

#### Phase 2 — Migrer le frontend pour utiliser les RPC

**Durée** : J4 à J6

**Actions** :
1. Branche `accounting-security-sprint-4` créée
2. Modifier `repository.ts` (F1, F2, F3, F4)
3. Régénérer types Supabase
4. Tests Vitest (T2) verts
5. Test E2E (T3) sur preview Vercel
6. Code review + merge sur main
7. Auto-deploy Vercel
8. **Smoke test post-deploy** sur pilote Folkestone

**Compatibilité** : 100% rétro-compatible côté DB (les UPDATE directs continuent de fonctionner sans trigger).

**Critère de validation Phase 2** :
- Tests E2E billing passent
- Pilote Folkestone fait 1 encaissement réel via UI → vérification audit_logs OK
- Aucune erreur Sentry liée à billing depuis 48h

#### Phase 3 — Monitoring 1 semaine sans trigger

**Durée** : J7 à J14

**Actions** :
1. Exécuter quotidiennement la requête de monitoring :
   ```sql
   -- Vérifier qu'AUCUN UPDATE direct sur paid_amount/total_ttc/etc.
   -- n'est passé en bypass des RPC
   SELECT created_at, actor_user_id, payload->'diff'
   FROM public.audit_logs
   WHERE entity='invoice' AND action='updated'
     AND payload->'diff' ?| array['total_ttc','total_ht','total_tva','paid_amount']
     AND created_at > now() - interval '24h'
     -- Exclure les diffs venant des RPC (à identifier par actor pattern)
   ;
   ```
2. Si 0 occurrence non-RPC pendant 7 jours consécutifs → Phase 4
3. Si occurrence détectée → identifier le call frontend manquant, retour Phase 2

**Critère de validation Phase 3** : 7 jours consécutifs avec 0 UPDATE direct hors RPC.

#### Phase 4 — Activer le trigger

**Durée** : J15

**Actions** :
1. Créer migration `20260656_activate_invoice_lock_trigger.sql` (uniquement le `CREATE TRIGGER`)
2. Appliquer en prod (hors heures de pointe — recommandé samedi 2h du matin)
3. Smoke test immédiat : 1 paiement, 1 émission facture, 1 void facture
4. Monitoring renforcé pendant 48h

**Critère de validation Phase 4** :
- Tous les workflows critiques passent
- Aucune erreur `INVOICE_FINANCIAL_FIELDS_LOCKED` non attendue dans Sentry
- Pilote pouvant continuer son exploitation normalement

#### Phase 5 — Stabilisation 2 semaines

**Durée** : J16 à J30

**Actions** :
1. Surveillance vue `audit_alerts_invoice_financial_changes`
2. Hot-fix si bug détecté
3. Documentation utilisateur mise à jour (toast d'erreur, etc.)
4. Sprint suivant ouvert

### 5.2 Feature flag (optionnel mais recommandé)

Pour pouvoir désactiver le trigger sans rollback DB :
```sql
-- Dans le trigger
DECLARE v_disabled boolean := coalesce(
  current_setting('app.invoice_protection_disabled', true), 'false'
) = 'true';
BEGIN
  IF v_disabled THEN RETURN NEW; END IF;
  -- ... logique normale ...
END;

-- Désactivation d'urgence (admin DB)
ALTER ROLE authenticated SET app.invoice_protection_disabled = 'true';
```

Permet de désactiver instantanément en cas d'incident sans drop le trigger (rollback ALTER plus rapide qu'un DROP/CREATE).

---

## 6. Stratégie de rollback

### 6.1 Par phase

#### Rollback Phase 1 (RPC + vue déployés, pas de trigger)

**Trigger** : RPC retournent erreurs ou comportement inattendu  
**Procédure** :
```sql
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.void_invoice(uuid, text);
DROP VIEW IF EXISTS public.audit_alerts_invoice_financial_changes;
-- Restaurer la version précédente de next_invoice_number / next_contract_number
-- (récupérer depuis git history)
```
**Durée** : 15 min  
**Données impactées** : aucune  
**Risque** : nul (rétro-compatible)

#### Rollback Phase 2 (frontend migré)

**Trigger** : régression observée côté UI billing  
**Procédure** :
```bash
git revert <commit-hash-phase-2>
git push origin main  # auto-deploy Vercel
```
**Durée** : 5-10 min  
**Données impactées** : aucune  
**Risque** : nul (les RPC restent en place mais frontend revient aux UPDATE directs)

#### Rollback Phase 4 (trigger activé)

**Trigger** : erreurs `INVOICE_FINANCIAL_FIELDS_LOCKED` cassent un workflow non identifié  
**Procédure d'urgence (feature flag)** :
```sql
-- Désactivation instantanée sans toucher au schéma
ALTER ROLE authenticated SET app.invoice_protection_disabled = 'true';
-- (le trigger continue de tourner mais return NEW immédiatement)
```
**Durée** : 30 secondes  

**Procédure de rollback définitive** :
```sql
DROP TRIGGER IF EXISTS trg_protect_invoice_financials ON public.invoices;
DROP FUNCTION IF EXISTS app.protect_invoice_financials();
```
**Durée** : 1 min  
**Données impactées** : aucune (DDL pur)  
**Risque** : nul (retour à l'état avant Phase 4)

### 6.2 Rollback total Sprint 4

Si l'ensemble du Sprint 4 doit être annulé :
```sql
-- Migration de rollback complet (à préparer en parallèle, jamais appliquée sauf urgence)
DROP TRIGGER IF EXISTS trg_protect_invoice_financials ON public.invoices;
DROP FUNCTION IF EXISTS app.protect_invoice_financials();
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.void_invoice(uuid, text);
DROP VIEW IF EXISTS public.audit_alerts_invoice_financial_changes;

-- Restaurer les versions originales (recopier depuis git)
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_hotel_id uuid) ...
CREATE OR REPLACE FUNCTION public.next_contract_number(p_hotel_id uuid) ...
CREATE OR REPLACE FUNCTION public.recalc_invoice_paid() ...

-- Frontend : git revert merge commit
```

**Durée** : 30 min  
**Données impactées** : aucune (DDL pur, audit_logs préservés)

### 6.3 Procédure si corruption de données détectée pendant Sprint 4

Si malgré tout une corruption de facture est constatée :
1. **STOP** : `ALTER DATABASE ... SET default_transaction_read_only = on`
2. Identifier la facture corrompue + historique via `audit_logs WHERE entity_id='<id>' ORDER BY created_at`
3. Restaurer la valeur correcte depuis l'audit log (le diff JSON contient la valeur OLD)
4. Procédure C du PRA (restoration backup) en dernier recours

---

## 7. Plan de tests

### 7.1 Tests SQL régression (T1)

**Fichier** : `supabase/tests/sprint4_accounting.test.sql`

**Suite à couvrir** :

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT 4 — Tests régression sécurisation comptable
-- À exécuter sur staging puis prod après chaque migration
-- ════════════════════════════════════════════════════════════════════════════

-- TEST 1 : RPC register_payment normale (user A sur sa facture)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
-- créer résa + facture issued
SELECT public.register_payment('<inv>', 600, 'card');
-- assert : payments inséré, balance=0, status='paid', diff dans audit_logs
ROLLBACK;

-- TEST 2 : RPC register_payment cross-tenant (user A sur facture B) → 42501
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
DO $$ BEGIN
  PERFORM public.register_payment('<inv-of-B>', 100, 'card');
  RAISE EXCEPTION 'FAIL';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS T2';
END $$;
ROLLBACK;

-- TEST 3 : UPDATE direct total_ttc post-issue → INVOICE_FINANCIAL_FIELDS_LOCKED
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
-- créer facture issued
DO $$ BEGIN
  UPDATE public.invoices SET total_ttc=999 WHERE id='<inv>';
  RAISE EXCEPTION 'FAIL';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS T3';
END $$;
ROLLBACK;

-- TEST 4 : transition draft → issued autorisée
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
-- créer facture draft
UPDATE public.invoices SET status='issued', issued_at=now() WHERE id='<inv>';
-- assert : status='issued'
ROLLBACK;

-- TEST 5 : transition paid → draft INTERDITE
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
-- créer facture paid
DO $$ BEGIN
  UPDATE public.invoices SET status='draft' WHERE id='<inv>';
  RAISE EXCEPTION 'FAIL';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS T5';
END $$;
ROLLBACK;

-- TEST 6 : next_invoice_number cross-tenant → 42501
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
DO $$ BEGIN
  PERFORM public.next_invoice_number('<hotel B>');
  RAISE EXCEPTION 'FAIL';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS T6';
END $$;
ROLLBACK;

-- TEST 7 : next_invoice_number même hôtel → OK + incrémentation
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
SELECT public.next_invoice_number('<hotel A>'); -- assert format F-YYYY-NNNNN
ROLLBACK;

-- TEST 8 : void_invoice depuis issued → OK via RPC
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
SELECT public.void_invoice('<inv issued>', 'Annulation client');
-- assert status='voided'
ROLLBACK;

-- TEST 9 : superadmin peut override sur audit_log critique
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt superadmin>';
SET LOCAL app.invoice_admin_override = 'true';
UPDATE public.invoices SET total_ttc=999 WHERE id='<inv>';
-- assert : audit_logs contient ligne 'admin_override' avec severity 'CRITICAL'
ROLLBACK;

-- TEST 10 : vue audit_alerts_invoice_financial_changes filtre par hôtel
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '<jwt user A>';
SELECT COUNT(*) FROM public.audit_alerts_invoice_financial_changes
  WHERE hotel_id <> public.get_user_hotel_id();
-- assert : 0
ROLLBACK;
```

### 7.2 Tests Vitest frontend (T2)

**Fichier** : `frontend/src/domains/billing/repository.test.ts`

```typescript
describe('billing repository — Sprint 4', () => {
  beforeEach(/* mock supabase */);

  describe('addPayment', () => {
    it('appelle RPC register_payment avec bons arguments', async () => { ... });
    it('mappe INVOICE_NOT_FOUND → ConflictError', async () => { ... });
    it('mappe FORBIDDEN_CROSS_TENANT → ConflictError "non autorisé"', async () => { ... });
    it('mappe INVALID_AMOUNT → ConflictError', async () => { ... });
  });

  describe('voidInvoice', () => {
    it('appelle RPC void_invoice avec p_invoice_id + p_reason', async () => { ... });
    it('mappe INVOICE_FINANCIAL_FIELDS_LOCKED → ConflictError clair', async () => { ... });
  });

  describe('mapping erreurs', () => {
    it('mappe INVOICE_FINANCIAL_FIELDS_LOCKED', async () => { ... });
    it('mappe INVOICE_INVALID_STATUS_TRANSITION', async () => { ... });
  });
});
```

### 7.3 Test E2E Playwright (T3)

**Fichier** : `frontend/tests/e2e/06-billing-immutability.spec.ts`

```typescript
test.describe('Sprint 4 — immutabilité comptable', () => {
  test('encaissement paiement complet (workflow utilisateur)', async ({ page }) => {
    // Login réception
    // Aller sur Réservations → fiche d'une résa avec facture
    // Cliquer "Encaisser paiement"
    // Sélectionner méthode carte, saisir 600€
    // Valider
    // Assert : toast succès + balance affichée 0€ + status "Payée"
  });

  test('tentative modification facture émise → toast erreur clair', async ({ page }) => {
    // Login réception
    // Tenter de modifier total via outil dev (cas d'attaque XSS interne)
    // Via UI normale : aucun bouton n'autorise cette action ✓
  });

  test('voidInvoice depuis facture émise → OK avec confirmation', async ({ page }) => {
    // Cliquer "Annuler facture"
    // Modal demande raison
    // Saisir + confirmer
    // Assert : facture passe à "voided", toast succès
  });

  test('next_invoice_number génère bien le format attendu', async ({ page }) => {
    // Créer 3 factures consécutives → vérifier numéros séquentiels
  });
});
```

### 7.4 Job CI sql-regression (T4)

**Fichier** : `.github/workflows/ci.yml` (ajout d'un job)

```yaml
sql-regression:
  name: SQL regression (Sprint 4)
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v4
    - name: Setup Supabase CLI
      uses: supabase/setup-cli@v1
      with:
        version: latest
    - name: Apply migrations on staging
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN_STAGING }}
      run: supabase db push --linked --project-ref ${{ secrets.SUPABASE_STAGING_REF }}
    - name: Run SQL regression suite
      env:
        DATABASE_URL: ${{ secrets.SUPABASE_STAGING_DB_URL }}
      run: |
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
          -f supabase/tests/sprint4_accounting.test.sql
```

### 7.5 Monitoring post-déploiement

| Métrique | Seuil d'alerte | Fréquence |
|---|---|---|
| Lignes dans `audit_alerts_invoice_financial_changes` derniers 24h | > 0 | Quotidien |
| Erreurs `INVOICE_FINANCIAL_FIELDS_LOCKED` dans Sentry | > 5 / h | Temps réel |
| Erreurs `INVOICE_INVALID_STATUS_TRANSITION` dans Sentry | > 5 / h | Temps réel |
| Erreurs `42501` sur `next_invoice_number` | > 0 / h (signal d'attaque) | Temps réel |
| Lignes `audit_logs` avec `action='admin_override'` | > 0 / semaine | Hebdomadaire |

---

## 8. Risques de régression

### 8.1 Tableau d'analyse

| ID | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| RG1 | Workflow encaissement cassé en Phase 2 (RPC non appelée correctement) | Moyenne | 🔴 Critique | Tests Vitest + E2E + smoke test pilote post-deploy |
| RG2 | Trigger active en Phase 4 sans Phase 2 complète → UPDATE direct subsistant échoue | Moyenne | 🔴 Critique | Monitoring Phase 3 minimum 7 j, feature flag pour désactiver |
| RG3 | Le trigger `recalc_invoice_paid` ne pose pas la session var correctement → propre paiement bloqué | Faible | 🔴 Critique | Tests SQL T1 exhaustifs, validation manuelle DBA |
| RG4 | Performance dégradée du trigger sur volume élevé | Faible | 🟠 Moyen | Benchmark sur 1000 factures simulées en staging |
| RG5 | Conflit avec `trg_audit_invoices` existant (ordre d'exécution) | Faible | 🟠 Moyen | Triggers BEFORE/AFTER différents — pas de conflit |
| RG6 | `void_invoice` appelée sur facture `draft` retourne erreur inattendue | Faible | 🟡 Mineur | RPC accepte explicitement draft + issued |
| RG7 | Frontend cache TanStack Query non invalidé après RPC → UI affiche état stale | Moyenne | 🟡 Mineur | Invalidation explicite après RPC (pattern existant) |
| RG8 | Pilote Folkestone surpris par erreur "Facture verrouillée" si UI pas formée | Haute | 🟠 Moyen | Formation J-1 avant Phase 4 + doc utilisateur claire |
| RG9 | Cron/script externe qui faisait UPDATE direct (overdue, recalc) cassé | Faible | 🟠 Moyen | Audit des cron pg_cron actuels avant Phase 4 |
| RG10 | Conflit avec trigger `trg_fn_reservation_checkout_guard` (cumul d'invariants) | Très faible | 🟡 Mineur | Triggers ON tables différentes (reservations vs invoices), pas de conflit |
| RG11 | Erreur 42501 propagée mal à l'UI → utilisateur confus | Moyenne | 🟡 Mineur | Mapping `handleBillingError` exhaustif (F4) |
| RG12 | Migration trigger ne se déploie pas correctement (état partiel) | Très faible | 🔴 Critique | Migration idempotente (`DROP IF EXISTS` + `CREATE`) |

### 8.2 Stratégie de mitigation globale

| Type de risque | Mitigation |
|---|---|
| **Bugs trigger DB** | Tests SQL T1 + déploiement Phase 4 hors heures pointe + feature flag |
| **Bugs frontend** | Tests T2 + T3 + smoke test pilote + auto-deploy preview avant prod |
| **Régressions cachées** | Monitoring renforcé Phase 5 (2 semaines) avec daily standup billing |
| **Incidents pilote** | Astreinte dev critique pendant 48h post-Phase 4 |
| **Plan B catastrophique** | Feature flag instantané (`ALTER ROLE authenticated SET app.invoice_protection_disabled='true'`) |

### 8.3 Tests de non-régression obligatoires avant chaque phase

| Phase | Tests bloquants |
|---|---|
| 1 | T1 (suite SQL complète) verte sur staging |
| 2 | T2 (Vitest) verte + T3 (E2E) verte sur preview Vercel |
| 3 | Monitoring 7 j sans alerte |
| 4 | T1 verte sur prod + smoke test pilote manuel |
| 5 | Aucune erreur Sentry billing pendant 14 j consécutifs |

---

## 9. Effort estimé & planification

### 9.1 Charge par phase

| Phase | Activité | Effort dev | Effort QA | Effort ops |
|---|---|---|---|---|
| Pré-sprint | Validation de ce plan par le commanditaire | - | - | 1h |
| 1 | Création migrations + tests SQL + déploiement | 6h | 2h | 1h |
| 2 | Adaptation frontend + tests Vitest + E2E + merge | 4h | 3h | 30 min |
| 3 | Monitoring 7 j | 0 | 1h/jour | 30 min/jour |
| 4 | Activation trigger + smoke test | 1h | 2h | 1h |
| 5 | Stabilisation 14 j | 0 (sauf bug) | 30 min/jour | 30 min/jour |
| **Total** | | **~11h dev + 10h QA + 7h ops** | | |

Avec marge sécurité : **~20-25 jours-personne ouvrés** sur 4 semaines calendaires.

### 9.2 Calendrier prévisionnel

| Semaine | Phase |
|---|---|
| S1 (J1-J5) | Validation plan + Phase 1 (RPC + tests SQL) |
| S2 (J6-J10) | Phase 2 (frontend + tests + merge) |
| S3 (J11-J17) | Phase 3 (monitoring 7 j) |
| S4 (J18) | Phase 4 (activation trigger samedi 02:00) |
| S4-S6 (J19-J32) | Phase 5 (stabilisation 14 j) |

### 9.3 Dépendances

| Dépendance | Bloquant si non résolue |
|---|---|
| Plan validé par le commanditaire | ✅ Bloquant — ne pas démarrer dev |
| Supabase Pro activé | ⚠️ Recommandé (PITR pour rollback Phase 4) |
| Sentry actif (DSN configuré) | ⚠️ Recommandé (monitoring Phase 5) |
| Pilote Folkestone en exploitation depuis ≥ 2 semaines | ⚠️ Recommandé pour valider Phase 5 sur données réelles |

---

## 10. Décisions à valider avant développement

Cocher chaque case avant ouverture de la branche `accounting-security-sprint-4` :

```text
[ ] Architecture cible validée (§1)
[ ] Impacts fonctionnels acceptés (§2) — notamment toast "Facture verrouillée" pour l'utilisateur
[ ] Machine d'états validée (§1.3)
[ ] Approche session var validée (§1.4)
[ ] Migration en 5 phases acceptée (§5.1)
[ ] Feature flag retenu (oui/non — §5.2)
[ ] Stratégie de rollback comprise (§6)
[ ] Plan de tests T1-T4 validé (§7)
[ ] Liste des risques RG1-RG12 acceptée + mitigations (§8)
[ ] Calendrier prévisionnel S1-S6 validé (§9.2)
[ ] Ressources allouées (effort §9.1)
[ ] Window de Phase 4 défini (samedi 02:00 ou autre)
[ ] Astreinte dev J0-J2 post-Phase 4 confirmée
```

### Questions ouvertes pour décision finale

1. **`reverse_payment`** : créer un RPC dédié ou laisser UPDATE direct sur `payments` (qui n'est pas concerné par le trigger sur `invoices`) ? **Recommandation : laisser UPDATE direct dans un premier temps, créer RPC si besoin lors d'un sprint ultérieur.**

2. **Feature flag de désactivation** : activer dès Phase 4 ou attendre incident ? **Recommandation : activer dès la conception (coût quasi nul, valeur élevée en cas d'urgence).**

3. **Pilote sur Phase 2** : Phase 2 sur production direct ou sur staging d'abord ? **Recommandation : staging d'abord, prod ensuite après validation 24h.**

4. **`mark_overdue_invoices`** : créer en parallèle ou différer ? **Recommandation : différer Sprint suivant (cron quotidien indépendant).**

5. **Admin override** : conserver le mécanisme `app.invoice_admin_override` ou retirer (plus pur) ? **Recommandation : conserver pour corrections manuelles exceptionnelles (avec audit forensique).**

---

## Annexes

### A. Glossaire spécifique

| Sigle | Définition |
|---|---|
| Session var | Variable de session PostgreSQL (`set_config(..., true)` = LOCAL = transaction) |
| Feature flag | Mécanisme de désactivation runtime sans rollback de code |
| Smoke test | Test rapide de viabilité post-déploiement (vs régression complète) |
| DBA | Database Administrator |

### B. Documents liés

- `docs/PILOT_DEPLOYMENT_PLAN_v1.md` — plan de déploiement pilote
- `docs/AUDIT_LOGS_VS_RGPD.md` — conformité audit
- `docs/ops/V12-leaked-password-protection.md` — ops V12 toggle

### C. Validation requise

Ce plan doit être signé par :
- ✅ CTO Flowtym (validation technique)
- ⚠️ Direction Folkestone (impact pilote)
- ⚠️ Comptable Folkestone (impact workflow)

---

**Fin du document**  
**Version 1.0** — 2026-06-18  
**Aucun développement entrepris à ce stade — attente validation commanditaire**
