# R4 — Plan d'Implémentation Gouvernance des Rôles

> **Statut** : PLAN UNIQUEMENT — aucune implémentation avant validation.
> **Base** : Rapport R4 validé + arbitrages du 02/06/2026.
> **Périmètre** : Production `hzrzkvdebaadditvbqis` + frontend `claude/friendly-mayer-6t5Th`.

---

## TABLE DES MATIÈRES

1. [Enum cible](#1-enum-cible)
2. [Mapping ancien → nouveau](#2-mapping-ancien--nouveau)
3. [Matrice modules × rôles](#3-matrice-modules--rôles)
4. [Matrice documents × rôles](#4-matrice-documents--rôles)
5. [Matrice actions sensibles × rôles](#5-matrice-actions-sensibles--rôles)
6. [Fichiers frontend à corriger](#6-fichiers-frontend-à-corriger)
7. [Policies / RPC / Edge Functions à corriger](#7-policies--rpc--edge-functions-à-corriger)
8. [Stratégie de migration](#8-stratégie-de-migration)
9. [Stratégie de rollback](#9-stratégie-de-rollback)
10. [Recette prévue](#10-recette-prévue)

---

## 1. Enum cible

### 1.1 Enum DB `admin_user_role` (après migration)

Valeurs existantes conservées + 3 nouvelles valeurs ajoutées via `ADD VALUE` :

| Valeur DB | Label UI | Statut | Niveau |
|-----------|----------|--------|--------|
| `direction` | Direction | Existant ✓ | 1 — Complet |
| `admin_hotel` | Administrateur hôtel | **NOUVEAU** | 2 — Opérationnel étendu |
| `reception` | Réception | Existant ✓ | 3 — Front-desk |
| `gouvernante` | Gouvernante | Existant ✓ | 4 — Supervision étages |
| `femme_de_chambre` | Femme de chambre | Existant ✓ | 5 — Exécution étages |
| `maintenance` | Maintenance | Existant ✓ | 6 — Technique |
| `breakfast` | Petit-déjeuner | Existant ✓ (label UI changé) | 7 — Restauration |
| `comptabilite` | Comptabilité | **NOUVEAU** | 8 — Finance seule |
| `revenue_manager` | Revenue Manager | **NOUVEAU** | 9 — RMS seul |

> **Arbitrage** : `breakfast` conservé tel quel en DB. Seul le label UI change de
> "Restauration" → "Petit-déjeuner". Aucune migration de données.

### 1.2 Platform admins (inchangé, table séparée)

| Valeur `platform_admins.role` | Usage | Statut |
|-------------------------------|-------|--------|
| `super_admin` | Accès total Flowtym | Existant ✓ |
| `support_agent` | Help articles | Existant ✓ |
| `billing_admin` | Facturation plateforme | Existant ✓ |

> Les platform admins restent dans `platform_admins` — aucun croisement avec l'enum hôtel.

### 1.3 RoleId RBAC frontend (après migration)

Extension du type `RoleId` existant — 5 → 7 valeurs :

| RoleId RBAC | Rôle(s) DB mappé(s) | Justification |
|-------------|----------------------|---------------|
| `admin` | `direction` | Accès complet hôtel |
| `manager` | `admin_hotel` | Opérationnel étendu |
| `receptionist` | `reception` | Front-desk |
| `housekeeping` | `gouvernante`, `femme_de_chambre`, `maintenance`, `breakfast` | Opérations hôtel |
| `reader` | *(inconnu / défaut)* | Moindre privilège |
| `accountant` | `comptabilite` | **NOUVEAU** — Finance seule |
| `revenue` | `revenue_manager` | **NOUVEAU** — RMS seul |

---

## 2. Mapping ancien → nouveau

### 2.1 Rôles DB : aucune migration de données (ADD VALUE uniquement)

Les utilisateurs existants conservent leur rôle. Aucun `UPDATE users SET role = ...` nécessaire.

### 2.2 Rôles frontend legacy → rôles DB réels

Ces rôles n'existent **pas en base** — ils n'apparaissent que dans le code TypeScript. Plan de remplacement :

| Ancien rôle frontend (`AppUserRole`) | Nouveau rôle DB | Action |
|--------------------------------------|-----------------|--------|
| `owner` | N/A (supprimé) | Dead code — la condition `role === 'owner'` affichait `👑` mais ne matchait jamais en DB. Remplacer par `role === 'direction'`. |
| `admin` | `admin_hotel` ou `direction` | Dead code — `role === 'admin'` ne matchait jamais. Remplacer par `['direction','admin_hotel'].includes(role)`. |
| `housekeeping` | `gouvernante` / `femme_de_chambre` | Dead code. Remplacer par `['gouvernante','femme_de_chambre','maintenance','breakfast'].includes(role)`. |
| `accountant` | `comptabilite` | Legacy label — remplacer dans `USER_ROLE_LABEL`. |
| `rms` | `revenue_manager` | Legacy label — remplacer dans `USER_ROLE_LABEL`. |
| `direction` | `direction` ✓ | Déjà correct. |
| `reception` | `reception` ✓ | Déjà correct. |

### 2.3 `normalizeRole()` — mapping complet cible

```typescript
// Rôles DB cibles → RoleId RBAC
'direction'        → 'admin'
'admin_hotel'      → 'manager'       // NOUVEAU
'reception'        → 'receptionist'
'gouvernante'      → 'housekeeping'
'femme_de_chambre' → 'housekeeping'
'maintenance'      → 'housekeeping'
'breakfast'        → 'housekeeping'
'comptabilite'     → 'accountant'    // NOUVEAU
'revenue_manager'  → 'revenue'       // NOUVEAU
(inconnu)          → 'reader'        // défaut sécurisé
```

---

## 3. Matrice modules × rôles

### 3.1 Matrice RBAC complète (DEFAULT_PERMISSIONS cible)

Niveaux : `none(0)` · `read(1)` · `write(2)` · `admin(3)`

| Capability | admin | manager | receptionist | accountant | revenue | housekeeping | reader |
|-----------|:-----:|:-------:|:------------:|:----------:|:-------:|:------------:|:------:|
| **RÉSERVATIONS** | | | | | | | |
| `res_view` | admin | admin | admin | read | read | read | read |
| `res_create` | admin | admin | admin | none | none | none | none |
| `res_groups` | admin | write | read | none | none | none | none |
| **CLIENTS** | | | | | | | |
| `cli_view` | admin | admin | admin | read | none | none | read |
| `cli_export` | admin | write | read | write | none | none | none |
| `cli_merge` | admin | write | none | none | none | none | none |
| **REVENUE & RMS** | | | | | | | |
| `rev_view` | admin | admin | none | read | admin | none | none |
| `rev_decisions` | admin | admin | none | none | admin | none | none |
| `rev_pricing` | admin | admin | none | none | admin | none | none |
| `rev_autopilot` | admin | write | none | none | write | none | none |
| **FINANCE** | | | | | | | |
| `fin_invoice` | admin | admin | write | admin | none | none | none |
| `fin_payment` | admin | admin | write | admin | none | none | none |
| `fin_close` | admin | admin | none | admin | none | none | none |
| `fin_export` | admin | admin | none | admin | none | none | none |
| **HOUSEKEEPING** | | | | | | | |
| `hk_status` | admin | read | read | none | none | admin | read |
| `hk_assign` | admin | read | none | none | none | write | none |
| `hk_maintain` | admin | read | none | none | none | write | none |
| **PARAMÈTRES** | | | | | | | |
| `set_hotel` | admin | write | none | none | none | none | none |
| `set_rooms` | admin | write | none | none | none | read | none |
| `set_users` | admin | write | none | none | none | none | none |
| `set_api` | admin | none | none | none | none | none | none |
| `set_integrations` | admin | write | none | none | none | none | none |
| `set_fiscal` | admin | write | none | read | none | none | none |
| `set_audit` | admin | read | none | read | read | none | none |
| `set_backups` | admin | read | none | none | none | none | none |
| `set_rgpd` | admin | none | none | none | none | none | none |

> **Notes clés** :
> - `receptionist` : `rev_view` passe de `read` → `none` (la réception ne gère pas le Revenue).
> - `accountant` : accès Finance complet (`admin`) + lecture Réservations/Clients (contexte facturation).
> - `revenue` : accès Revenue complet (`admin`) + lecture Réservations (contexte tarifaire).
> - `set_users` = `write` pour `manager` (admin_hotel gère les users hôtel) avec restriction anti-élévation (voir §7.3).
> - `set_rgpd` = `none` pour `manager` (admin_hotel ne peut pas exécuter l'effacement RGPD).

### 3.2 Visibilité navigation (Topbar — menus filtrés)

Chaque item de navigation obtient un `requiredCapability` et un `requiredLevel`. Le menu est masqué si `hasPermission(role, capability, level) === false`.

| Menu | `requiredCapability` | `requiredLevel` | Rôles qui voient le menu |
|------|---------------------|-----------------|--------------------------|
| `flowday` | *(aucun)* | — | Tous |
| `sas` | `rev_view` | `admin` | direction, admin_hotel, revenue_manager |
| `reservations` | `res_view` | `read` | direction, admin_hotel, reception, gouvernante, femme_de_chambre, comptabilite |
| `clients` | `cli_view` | `read` | direction, admin_hotel, reception, comptabilite |
| `revenue` | `rev_view` | `read` | direction, admin_hotel, revenue_manager |
| `finance` | `fin_invoice` | `read` | direction, admin_hotel, reception, comptabilite |
| `analysis` | `set_audit` | `read` | direction, admin_hotel, comptabilite, revenue_manager |
| `settings` | `set_hotel` | `read` | direction, admin_hotel |
| `support` | *(aucun)* | — | Tous |

> **Garantie** : le filtrage frontend est UX uniquement. Les RLS/RPCs protègent les données indépendamment.

---

## 4. Matrice documents × rôles

### 4.1 `document_role_permissions` cible (en base)

V=view · D=download · Del=delete · U=upload · —=refusé

| Rôle DB | `id_doc` | `contract` | `invoice` | `quote` | `other` |
|---------|:--------:|:----------:|:---------:|:-------:|:-------:|
| `direction` | V D Del U | V D Del U | V D Del U | V D Del U | V D Del U |
| `admin_hotel` | **— — — —** | V D Del U | V D Del U | V D Del U | V D Del U |
| `reception` | V D — U | V D — U | V D — — | V D — U | V D — U |
| `gouvernante` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `femme_de_chambre` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `maintenance` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `breakfast` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `comptabilite` | **— — — —** | V D — — | V D — — | V D — — | V D — — |
| `revenue_manager` | **— — — —** | V D — — | V D — — | V D — — | — — — — |

> **Points clés arbitrages** :
> - `admin_hotel` : aucun accès aux documents d'identité (`id_doc` = tout refusé).
> - `comptabilite` : contrats/factures/devis en lecture+téléchargement uniquement. Aucun id_doc.
> - `revenue_manager` : contrats/factures/devis en lecture+téléchargement (contexte tarifaire). Aucun id_doc.
> - gouvernante/femme_de_chambre/maintenance/breakfast : aucun document (inchangé).

---

## 5. Matrice actions sensibles × rôles

| Action sensible | direction | admin_hotel | reception | gouvernante | femme_de_chambre | maintenance | breakfast | comptabilite | revenue_manager |
|-----------------|:---------:|:-----------:|:---------:|:-----------:|:----------------:|:-----------:|:---------:|:------------:|:---------------:|
| **RGPD : effacement guest** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Accès documents identité** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Upload documents identité** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Supprimer documents** | ✅ | ✅ (sauf id) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Gérer users hôtel** | ✅ | ✅ (*) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Élever rôle ≥ admin_hotel** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lire audit log accès docs** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Modifier pricing_rules** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Modifier rate_plans** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Modifier rate_prices** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Import Lighthouse** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Clôture journalière** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Export comptable** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Recommandations RMS** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Campagnes promotionnelles** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Lire worker_runs** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Accès platform admin** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> (*) `admin_hotel` peut gérer les utilisateurs **sauf** élever un rôle vers `direction` ou `admin_hotel`
> (garde anti-élévation via fonction SECURITY DEFINER — voir §7.3).

---

## 6. Fichiers frontend à corriger

### 6.1 `frontend/src/services/settings/permissionsService.tsx`

**Changements** : 3 sections à modifier.

**A. Type `RoleId` (ligne 21)** — ajouter 2 valeurs :
```typescript
// AVANT
export type RoleId = 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'reader';

// APRÈS
export type RoleId = 'admin' | 'manager' | 'receptionist' | 'accountant' | 'revenue' | 'housekeeping' | 'reader';
```

**B. `DEFAULT_PERMISSIONS` (lignes 33-75)** — ajouter 2 entrées, modifier `receptionist` :
```typescript
const DEFAULT_PERMISSIONS: Record<RoleId, Record<string, AccessLevel>> = {
  admin: {},
  manager: {
    res_view: 'admin', res_create: 'admin', res_groups: 'write',
    cli_view: 'admin', cli_export: 'write', cli_merge: 'write',
    rev_view: 'admin', rev_decisions: 'admin', rev_pricing: 'admin', rev_autopilot: 'write',
    fin_invoice: 'admin', fin_payment: 'admin', fin_close: 'admin', fin_export: 'admin',
    hk_status: 'read', hk_assign: 'read', hk_maintain: 'read',
    set_hotel: 'write', set_rooms: 'write', set_users: 'write', set_api: 'none',
    set_integrations: 'write', set_fiscal: 'write', set_audit: 'read',
    set_backups: 'read', set_rgpd: 'none',
  },
  receptionist: {
    res_view: 'admin', res_create: 'admin', res_groups: 'read',
    cli_view: 'admin', cli_export: 'read', cli_merge: 'none',
    rev_view: 'none',   // ← CHANGÉ : 'read' → 'none' (reception ne gère pas le Revenue)
    rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'write', fin_payment: 'write', fin_close: 'none', fin_export: 'none',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_rooms: 'none', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  // NOUVEAU : accountant (comptabilite)
  accountant: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'read', cli_export: 'write', cli_merge: 'none',
    rev_view: 'read', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'admin', fin_payment: 'admin', fin_close: 'admin', fin_export: 'admin',
    hk_status: 'none', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_rooms: 'none', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'read', set_audit: 'read',
    set_backups: 'none', set_rgpd: 'none',
  },
  // NOUVEAU : revenue (revenue_manager)
  revenue: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'none', cli_export: 'none', cli_merge: 'none',
    rev_view: 'admin', rev_decisions: 'admin', rev_pricing: 'admin', rev_autopilot: 'write',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'none', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_rooms: 'none', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'read',
    set_backups: 'none', set_rgpd: 'none',
  },
  housekeeping: {
    // inchangé
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'none', cli_export: 'none', cli_merge: 'none',
    rev_view: 'none', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'admin', hk_assign: 'write', hk_maintain: 'write',
    set_hotel: 'none', set_rooms: 'read', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  reader: {
    // inchangé
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'read', cli_export: 'none', cli_merge: 'none',
    rev_view: 'read', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'read',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'read', set_rooms: 'read', set_users: 'none', set_api: 'none',
    set_integrations: 'read', set_fiscal: 'read', set_audit: 'read',
    set_backups: 'read', set_rgpd: 'read',
  },
};
```

**C. `normalizeRole()` (lignes 79-95)** — ajouter 3 mappings, nettoyer legacy :
```typescript
function normalizeRole(role: string | null | undefined): RoleId {
  if (!role) return 'reader';
  const r = role.toLowerCase();
  // Rôles RBAC internes (compatibilité localStorage)
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'receptionist') return 'receptionist';
  if (r === 'accountant') return 'accountant';
  if (r === 'revenue') return 'revenue';
  if (r === 'housekeeping') return 'housekeeping';
  // Rôles DB (enum admin_user_role) — source de vérité
  if (r === 'direction') return 'admin';
  if (r === 'admin_hotel') return 'manager';           // NOUVEAU
  if (r === 'reception') return 'receptionist';
  if (r === 'gouvernante') return 'housekeeping';
  if (r === 'femme_de_chambre') return 'housekeeping';
  if (r === 'maintenance') return 'housekeeping';
  if (r === 'breakfast') return 'housekeeping';
  if (r === 'comptabilite') return 'accountant';       // NOUVEAU
  if (r === 'revenue_manager') return 'revenue';       // NOUVEAU
  return 'reader';
}
```

---

### 6.2 `frontend/src/domains/users/repository.ts`

**A. Type `AppUserRole` (ligne 8)** — aligner sur l'enum DB :
```typescript
// AVANT
export type AppUserRole = 'owner' | 'direction' | 'admin' | 'reception' | 'housekeeping' | 'accountant' | 'rms';

// APRÈS — synchronisé avec admin_user_role DB
export type AppUserRole =
  | 'direction'
  | 'admin_hotel'
  | 'reception'
  | 'gouvernante'
  | 'femme_de_chambre'
  | 'maintenance'
  | 'breakfast'
  | 'comptabilite'
  | 'revenue_manager';
```

**B. `USER_ROLE_LABEL` (lignes 153-166)** — supprimer legacy, ajouter nouveaux rôles :
```typescript
export const USER_ROLE_LABEL: Record<string, string> = {
  direction: 'Direction',
  admin_hotel: 'Administrateur hôtel',       // NOUVEAU
  reception: 'Réception',
  gouvernante: 'Gouvernante',
  femme_de_chambre: 'Femme de chambre',
  maintenance: 'Maintenance',
  breakfast: 'Petit-déjeuner',               // label changé
  comptabilite: 'Comptabilité',              // NOUVEAU
  revenue_manager: 'Revenue Manager',        // NOUVEAU
};
// Legacy supprimé : owner, admin, housekeeping, accountant, rms
```

**C. `ASSIGNABLE_ROLES` (lignes 169-171)** — ajouter les nouveaux rôles :
```typescript
export const ASSIGNABLE_ROLES: AppUserRole[] = [
  'direction',
  'admin_hotel',        // NOUVEAU
  'reception',
  'gouvernante',
  'femme_de_chambre',
  'maintenance',
  'breakfast',
  'comptabilite',       // NOUVEAU
  'revenue_manager',    // NOUVEAU
];
```

---

### 6.3 `frontend/src/lib/supabase.types.ts`

**`AdminUserRole` (lignes 13-19)** — ajouter 3 nouvelles valeurs (ou regénérer depuis schema) :
```typescript
export type AdminUserRole =
  | 'reception'
  | 'gouvernante'
  | 'femme_de_chambre'
  | 'maintenance'
  | 'breakfast'
  | 'direction'
  | 'admin_hotel'       // NOUVEAU
  | 'comptabilite'      // NOUVEAU
  | 'revenue_manager';  // NOUVEAU
```

---

### 6.4 `frontend/src/pages/UsersView.tsx`

**A. `ROLE_LABEL` (lignes 26-34)** — remplacer l'ancienne map legacy :
```typescript
const ROLE_LABEL: Record<string, string> = {
  direction: 'Direction',
  admin_hotel: 'Administrateur hôtel',
  reception: 'Réception',
  gouvernante: 'Gouvernante',
  femme_de_chambre: 'Femme de chambre',
  maintenance: 'Maintenance',
  breakfast: 'Petit-déjeuner',
  comptabilite: 'Comptabilité',
  revenue_manager: 'Revenue Manager',
};
// Supprimer : owner, admin, housekeeping, accountant, rms
```

**B. `ROLE_TONE` et `ROLE_ICON` (lignes 36-53)** — mettre à jour les couleurs/icônes pour les nouveaux rôles.

**C. Condition `role === 'owner'` (ligne 253)** — corriger :
```typescript
// AVANT
<p className="text-[10px] text-gray-400">{user.role === 'owner' ? '👑 ' : ''}{ROLE_LABEL[user.role] ?? user.role}</p>

// APRÈS — 'owner' ne peut jamais apparaître en DB
<p className="text-[10px] text-gray-400">{user.role === 'direction' ? '👑 ' : ''}{ROLE_LABEL[user.role] ?? user.role}</p>
```

---

### 6.5 `frontend/src/pages/admin/AdminUsers.tsx`

**`ROLE_LABELS` (lignes 43-48)** — corriger les rôles invalides :
```typescript
const ROLE_LABELS: Record<string, string> = {
  direction: 'Direction',
  admin_hotel: 'Admin hôtel',          // CORRIGÉ (était 'admin_hotel' mais pas en DB)
  reception: 'Réception',
  gouvernante: 'Gouvernante',
  femme_de_chambre: 'Femme de chambre',
  maintenance: 'Maintenance',
  breakfast: 'Petit-déjeuner',         // CORRIGÉ (était 'petit_dejeuner' — typo)
  comptabilite: 'Comptabilité',        // NOUVEAU
  revenue_manager: 'Revenue Manager',  // CORRIGÉ (existait mais pas en DB)
};
// Supprimer : petit_dejeuner (typo), admin_hotel (sera correct une fois en DB)
```

---

### 6.6 `frontend/src/services/settings/settingsDiagnosticEngine.ts`

**4 corrections de comparaisons cassées** :

| Ligne | Code actuel (cassé) | Code cible |
|-------|---------------------|------------|
| 169 | `u.role === 'admin' && u.active` | `['direction', 'admin_hotel'].includes(u.role) && u.active` |
| 204 | `u.role === 'admin' && u.active` | `['direction', 'admin_hotel'].includes(u.role) && u.active` |
| 422 | `u.role === 'admin' && u.active` | `['direction', 'admin_hotel'].includes(u.role) && u.active` |
| 661 | `u.role === 'housekeeping'` | `['gouvernante', 'femme_de_chambre', 'maintenance', 'breakfast'].includes(u.role)` |
| 666 | `u.role === 'admin' && u.active` | `['direction', 'admin_hotel'].includes(u.role) && u.active` |

---

### 6.7 `frontend/src/pages/settings/pages/HousekeepingPages.tsx`

**Ligne 129** :
```typescript
// AVANT
done: s.users.some((u) => u.role === 'housekeeping')

// APRÈS
done: s.users.some((u) => ['gouvernante', 'femme_de_chambre', 'maintenance', 'breakfast'].includes(u.role))
```

---

### 6.8 `frontend/src/components/configuration/ConfigSections1to7.tsx`

**Ligne 113** :
```typescript
// AVANT
user.role === 'admin'

// APRÈS
['direction', 'admin_hotel'].includes(user.role)
```

---

### 6.9 `frontend/src/pages/settings/pages/UsersPage.tsx`

**Lignes 73, 117, 276** :
```typescript
// AVANT
u.role === 'admin'

// APRÈS
['direction', 'admin_hotel'].includes(u.role)
```

---

### 6.10 `frontend/src/components/layout/Topbar.tsx`

**Structure NAV_ITEMS** — ajouter `requiredCapability` et `requiredLevel` :
```typescript
type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  defaultPage: PageId;
  hasBadge?: boolean;
  requiredCapability?: string;    // NOUVEAU
  requiredLevel?: AccessLevel;    // NOUVEAU
};

const NAV_ITEMS: NavItem[] = [
  { id: 'flowday',      label: 'Flowday',     icon: Zap,        defaultPage: 'flowboard' },
  { id: 'sas',          label: 'SAS',          icon: Shield,     defaultPage: 'sas_incoming',   hasBadge: true,  requiredCapability: 'rev_view',   requiredLevel: 'admin' },
  { id: 'reservations', label: 'Réservations', icon: Calendar,   defaultPage: 'reservations',                    requiredCapability: 'res_view',   requiredLevel: 'read' },
  { id: 'clients',      label: 'Clients',      icon: Users,      defaultPage: 'clients',                         requiredCapability: 'cli_view',   requiredLevel: 'read' },
  { id: 'revenue',      label: 'Revenue',      icon: TrendingUp, defaultPage: 'rev_dashboard',                   requiredCapability: 'rev_view',   requiredLevel: 'read' },
  { id: 'finance',      label: 'Finance',      icon: CreditCard, defaultPage: 'facturation',                     requiredCapability: 'fin_invoice', requiredLevel: 'read' },
  { id: 'analysis',     label: 'Analyse',      icon: BarChart2,  defaultPage: 'analysis',                        requiredCapability: 'set_audit',  requiredLevel: 'read' },
  { id: 'settings',     label: 'Paramètres',   icon: Settings,   defaultPage: 'settings',                        requiredCapability: 'set_hotel',  requiredLevel: 'read' },
  { id: 'support',      label: 'Support',      icon: Headphones, defaultPage: 'support' },
];
```

**Logique de rendu dans `Topbar`** — filtrer les items :
```typescript
// Dans le composant Topbar, avant le render
const auth = useAuth();
const visibleNav = NAV_ITEMS.filter((item) => {
  if (!item.requiredCapability) return true;
  if (!auth.session) return true; // mode dev
  return hasPermission(auth.session.role, item.requiredCapability, item.requiredLevel ?? 'read');
});

// Remplacer {NAV_ITEMS.map(...)} par {visibleNav.map(...)}
```

---

## 7. Policies / RPC / Edge Functions à corriger

### 7.1 Migrations SQL DB — récapitulatif

5 migrations distinctes (ordre obligatoire — voir §8) :

| Fichier | Nature | Contenu |
|---------|--------|---------|
| `20260636_r4a_bug_fixes.sql` | Corrections bugs | INC-07 défaut user_hotels · INC-08 is_platform_admin · INC-02 attach_access_select |
| `20260637_r4b_extend_enum.sql` | Extension enum | ADD VALUE pour 3 nouveaux rôles (transaction séparée — limitation PG) |
| `20260638_r4c_update_rls.sql` | RLS policies | Ajouter admin_hotel/revenue_manager/comptabilite aux policies existantes |
| `20260639_r4d_document_perms.sql` | Permissions docs | Nouvelles lignes document_role_permissions |
| `20260640_r4e_unify_role_fn.sql` | Unification fonctions | Déprécier get_user_role(), aligner RLS sur current_user_role() |

---

### 7.2 Migration `20260636_r4a_bug_fixes.sql`

**INC-07** : changer le défaut `user_hotels.role` :
```sql
ALTER TABLE public.user_hotels
  ALTER COLUMN role SET DEFAULT 'reception'::admin_user_role;
```

**INC-08** : corriger `is_platform_admin()` (`id` → `auth_id`) :
```sql
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE auth_id = auth.uid() AND is_active = true
  );
$$;
```

**INC-02** : corriger `attach_access_select` (retirer `owner` et `admin` fantômes) :
```sql
DROP POLICY IF EXISTS attach_access_select ON public.attachment_access_log;
CREATE POLICY attach_access_select ON public.attachment_access_log
  FOR SELECT TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.current_user_role() IN ('direction', 'admin_hotel')
    -- admin_hotel ajouté ici MAIS uniquement après r4b (enum étendu).
    -- NOTE : si r4a est appliqué avant r4b, utiliser uniquement 'direction'.
    -- Voir stratégie de migration §8 pour l'ordre exact.
  );
```

> **Important** : La correction d'`attach_access_select` inclut `admin_hotel` qui n'existe pas encore dans l'enum au moment de r4a. Deux options :
> - **Option A** (recommandée) : fusionner r4a et r4b dans l'ordre, ou appliquer r4a avec `direction` uniquement, puis mettre à jour la policy dans r4c après l'extension de l'enum.
> - **Option B** : dans r4a, corriger uniquement `is_platform_admin` et le défaut `user_hotels.role`. La correction `attach_access_select` va dans r4c.

---

### 7.3 Migration `20260637_r4b_extend_enum.sql`

⚠️ **Transaction séparée obligatoire** : `ALTER TYPE ... ADD VALUE` ne peut pas être exécuté dans une transaction avec d'autres DDL en PostgreSQL. Supabase `apply_migration` gère chaque appel dans sa propre transaction.

```sql
-- Aucune autre instruction dans ce fichier
ALTER TYPE public.admin_user_role ADD VALUE IF NOT EXISTS 'admin_hotel';
ALTER TYPE public.admin_user_role ADD VALUE IF NOT EXISTS 'comptabilite';
ALTER TYPE public.admin_user_role ADD VALUE IF NOT EXISTS 'revenue_manager';
```

---

### 7.4 Migration `20260638_r4c_update_rls.sql`

Policies à mettre à jour (ajouter les nouveaux rôles) :

```sql
-- 1. attachment_access_log : direction + admin_hotel (retirer owner/admin fantômes)
DROP POLICY IF EXISTS attach_access_select ON public.attachment_access_log;
CREATE POLICY attach_access_select ON public.attachment_access_log
  FOR SELECT TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.current_user_role() IN ('direction', 'admin_hotel')
  );

-- 2. users_admin_manage : direction + admin_hotel
DROP POLICY IF EXISTS users_admin_manage ON public.users;
CREATE POLICY users_admin_manage ON public.users FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role)
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role)
  );

-- 3. pricing_rules_write : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS pricing_rules_write ON public.pricing_rules;
CREATE POLICY pricing_rules_write ON public.pricing_rules FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 4. rate_plans_write : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS rate_plans_write ON public.rate_plans;
CREATE POLICY rate_plans_write ON public.rate_plans FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 5. rate_prices_write : direction + admin_hotel + reception + revenue_manager
DROP POLICY IF EXISTS rate_prices_write ON public.rate_prices;
CREATE POLICY rate_prices_write ON public.rate_prices FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role)
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 6. rate_restrictions_write : idem rate_prices
DROP POLICY IF EXISTS rate_restrictions_write ON public.rate_restrictions;
CREATE POLICY rate_restrictions_write ON public.rate_restrictions FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role)
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 7. room_blocks_modify : direction + admin_hotel + reception
DROP POLICY IF EXISTS room_blocks_modify ON public.room_blocks;
CREATE POLICY room_blocks_modify ON public.room_blocks FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role)
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role)
  );

-- 8. promo_campaigns_modify : direction + admin_hotel + reception + revenue_manager
DROP POLICY IF EXISTS promo_campaigns_modify ON public.promo_campaigns;
CREATE POLICY promo_campaigns_modify ON public.promo_campaigns FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role)
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'reception'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 9. rms_pricing_applications_modify : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS rms_pricing_applications_modify ON public.rms_pricing_applications;
CREATE POLICY rms_pricing_applications_modify ON public.rms_pricing_applications FOR ALL TO authenticated
  USING (
    (recommendation_id IN (
      SELECT r.id FROM rms_pricing_recommendations r
      WHERE r.rate_plan_id IN (
        SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()
      )
    ))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  )
  WITH CHECK (
    (recommendation_id IN (
      SELECT r.id FROM rms_pricing_recommendations r
      WHERE r.rate_plan_id IN (
        SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()
      )
    ))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 10. rms_pricing_reco_update : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS rms_pricing_reco_update ON public.rms_pricing_recommendations;
CREATE POLICY rms_pricing_reco_update ON public.rms_pricing_recommendations FOR UPDATE TO authenticated
  USING (
    (rate_plan_id IN (
      SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()
    ))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  )
  WITH CHECK (
    (rate_plan_id IN (
      SELECT rate_plans.id FROM rate_plans WHERE rate_plans.hotel_id = public.get_user_hotel_id()
    ))
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 11. lighthouse_imports_insert : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS lighthouse_imports_insert ON public.lighthouse_imports;
CREATE POLICY lighthouse_imports_insert ON public.lighthouse_imports FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  );

-- 12. worker_runs_select : direction + admin_hotel
DROP POLICY IF EXISTS worker_runs_select ON public.worker_runs;
CREATE POLICY worker_runs_select ON public.worker_runs FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role)
  );

-- 13. competitor_sync_failures_select : direction + admin_hotel + revenue_manager
DROP POLICY IF EXISTS sync_failures_select ON public.competitor_sync_failures;
CREATE POLICY sync_failures_select ON public.competitor_sync_failures FOR SELECT TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role, 'revenue_manager'::admin_user_role)
  );
```

---

### 7.5 Migration `20260639_r4d_document_perms.sql`

```sql
-- Ajouter admin_hotel (tous sauf id_doc)
INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload)
SELECT 'admin_hotel', k, true, true, true, true
FROM unnest(ARRAY['contract','invoice','quote','other']) k
ON CONFLICT (role, kind) DO UPDATE
  SET can_view=true, can_download=true, can_delete=true, can_upload=true;
-- id_doc : refusé pour admin_hotel (pas de ligne = deny by default)

-- Ajouter comptabilite (contrats/factures/devis en lecture/download uniquement)
INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload) VALUES
  ('comptabilite', 'contract', true, true, false, false),
  ('comptabilite', 'invoice',  true, true, false, false),
  ('comptabilite', 'quote',    true, true, false, false),
  ('comptabilite', 'other',    true, true, false, false)
ON CONFLICT (role, kind) DO UPDATE
  SET can_view=EXCLUDED.can_view, can_download=EXCLUDED.can_download,
      can_delete=EXCLUDED.can_delete, can_upload=EXCLUDED.can_upload;
-- id_doc : aucune ligne = refusé

-- Ajouter revenue_manager (contrats/factures/devis lecture/download)
INSERT INTO public.document_role_permissions (role, kind, can_view, can_download, can_delete, can_upload) VALUES
  ('revenue_manager', 'contract', true, true, false, false),
  ('revenue_manager', 'invoice',  true, true, false, false),
  ('revenue_manager', 'quote',    true, true, false, false)
ON CONFLICT (role, kind) DO UPDATE
  SET can_view=EXCLUDED.can_view, can_download=EXCLUDED.can_download,
      can_delete=EXCLUDED.can_delete, can_upload=EXCLUDED.can_upload;
-- id_doc, other : aucune ligne = refusé
```

---

### 7.6 Migration `20260640_r4e_unify_role_fn.sql`

Unification des deux fonctions redondantes. `current_user_role()` (R1) devient la référence unique.

```sql
-- Aligner get_user_role() sur current_user_role() (même logique, type text unifié)
-- Les RLS actuelles utilisent get_user_role() avec cast ::admin_user_role.
-- Option retenue : conserver les deux fonctions mais les faire appeler la même logique.
-- Évite de modifier les 13 policies existantes en une seule migration.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS admin_user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;
COMMENT ON FUNCTION public.get_user_role() IS
  'Dépréciée — préférer current_user_role(). Conservée pour compatibilité RLS existantes.';

-- current_user_role() reste inchangée (text, STABLE SECURITY DEFINER)
-- Dans une phase ultérieure, migrer toutes les RLS vers current_user_role() et supprimer get_user_role().
```

### 7.7 Fonction anti-élévation de rôle (admin_hotel)

Nouvelle fonction SECURITY DEFINER pour empêcher `admin_hotel` de promouvoir vers `direction` ou `admin_hotel` :

```sql
-- À inclure dans r4c ou dans une migration dédiée
CREATE OR REPLACE FUNCTION public.set_user_hotel_role(p_user_id uuid, p_new_role admin_user_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor_role admin_user_role;
  v_hotel uuid;
BEGIN
  v_hotel := public.get_user_hotel_id();
  IF v_hotel IS NULL THEN RAISE EXCEPTION 'Aucun hôtel actif'; END IF;
  v_actor_role := public.get_user_role();
  -- Seul direction peut attribuer direction ou admin_hotel
  IF v_actor_role = 'admin_hotel'
     AND p_new_role IN ('direction'::admin_user_role, 'admin_hotel'::admin_user_role) THEN
    RAISE EXCEPTION 'Permission refusée : admin_hotel ne peut pas attribuer ce rôle';
  END IF;
  -- Vérifier que l'utilisateur cible est dans le même hôtel
  UPDATE public.users
  SET role = p_new_role
  WHERE id = p_user_id AND hotel_id = v_hotel;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable ou hors hôtel';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_hotel_role(uuid, admin_user_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_hotel_role(uuid, admin_user_role) TO authenticated;
```

> Le frontend (`useSetUserRole`) devra appeler `set_user_hotel_role()` RPC au lieu d'un `UPDATE` direct. La RLS `users_admin_manage` reste la garde multi-hôtel ; la fonction est la garde anti-élévation.

### 7.8 `crm_gdpr_purge_guest_documents()` — inchangée

La restriction `direction` uniquement est maintenue. `admin_hotel` ne peut pas exécuter le RGPD — arbitrage validé.

### 7.9 Edge Functions — aucune modification

- `attachment-access` : délègue à `request_attachment_download()` — la RLS et les `document_role_permissions` gèrent le filtre. Aucun changement.
- `gdpr-erase-guest` : délègue à `crm_gdpr_purge_guest_documents()` — `direction` uniquement. Aucun changement.
- `send-whatsapp` : aucun rôle check. Aucun changement.

---

## 8. Stratégie de migration

### 8.1 Ordre des étapes (sans rupture de production)

```
Étape 1 : r4a — Corrections bugs (INC-07, INC-08) — sans enum
Étape 2 : r4b — Extension enum (ADD VALUE) — transaction séparée seule
Étape 3 : r4c — Mise à jour RLS (après enum étendu)
Étape 4 : r4d — Permissions documents (nouvelles lignes)
Étape 5 : r4e — Unification fonctions rôle
Étape 6 : Frontend — Types, labels, normalizeRole (deploy)
Étape 7 : Frontend — Corrections comparaisons directes (deploy)
Étape 8 : Frontend — Filtrage navigation (deploy)
Étape 9 : Recette complète
```

### 8.2 Fenêtre de migration sans impact utilisateur

Chaque migration DB est additive (ADD VALUE, nouveaux INSERT, DROP+CREATE POLICY). Aucun UPDATE de données. Les utilisateurs existants (uniquement `direction`) ne sont pas affectés.

La migration frontend est un deploy standard (CI/CD). Pendant la fenêtre de déploiement frontend, les nouvelles policies RLS sont déjà actives — les rôles `admin_hotel`, `comptabilite`, `revenue_manager` n'ont pas encore d'utilisateurs affectés.

### 8.3 Séparation DB / Frontend

- Migrations DB : indépendantes du frontend (production Supabase).
- Frontend : deploy séparé, peut être déployé avant ou après les migrations DB.
- Compatibilité : le frontend actuel fonctionne avec la DB après migrations (aucun rôle existant n'est supprimé).

---

## 9. Stratégie de rollback

### 9.1 Rollback r4a (corrections bugs)

```sql
-- Rétablir défaut user_hotels.role
ALTER TABLE public.user_hotels
  ALTER COLUMN role SET DEFAULT 'direction'::admin_user_role;

-- Rétablir is_platform_admin (version originale avec id)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid() AND is_active = true);
$$;

-- Rétablir attach_access_select (version originale avec owner/admin)
DROP POLICY IF EXISTS attach_access_select ON public.attachment_access_log;
CREATE POLICY attach_access_select ON public.attachment_access_log
  FOR SELECT TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.current_user_role() IN ('owner', 'direction', 'admin')
  );
```

### 9.2 Rollback r4b (extension enum)

**Irréversible** en PostgreSQL standard : `ALTER TYPE ... DROP VALUE` n'existe pas.

Plan de mitigation :
- Les nouvelles valeurs ne sont jamais attribuées à aucun utilisateur → leur présence dans l'enum est inoffensive.
- Si la migration r4b est appliquée et r4c n'a pas encore été appliquée, la production continue de fonctionner normalement (aucun utilisateur avec les nouveaux rôles).
- En cas de besoin absolu de suppression : recréer l'enum sans les nouvelles valeurs (opération lourde, uniquement en urgence, nécessite un snapshot préalable).

**Garantie avant r4b** : snapshot du schéma + validation en sandbox.

### 9.3 Rollback r4c (RLS)

Chaque policy mise à jour a sa version précédente documentée dans `supabase/rollback/20260638_r4c_rollback.sql`. Syntaxe : DROP + CREATE avec l'ancienne définition.

### 9.4 Rollback r4d (document permissions)

```sql
DELETE FROM public.document_role_permissions WHERE role IN ('admin_hotel', 'comptabilite', 'revenue_manager');
```

### 9.5 Rollback r4e (fonctions)

```sql
-- Restaurer get_user_role() sans commentaire
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS admin_user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;
```

### 9.6 Rollback frontend

Git revert sur les commits frontend. Les rôles legacy (AppUserRole ancienne, ROLE_LABEL ancienne) sont restaurés. Les nouvelles valeurs d'enum en DB sont ignorées (elles n'ont pas d'utilisateurs affectés).

---

## 10. Recette prévue

### 10.1 Méthode

Impersonation via `set_config('request.jwt.claims', '{"sub":"<auth_id>","role":"authenticated"}', false)` — identique aux recettes R1/R2/R3.

Un utilisateur de test sera créé pour chaque nouveau rôle (`admin_hotel`, `comptabilite`, `revenue_manager`), puis supprimé en fin de recette.

### 10.2 Scénarios de test par rôle

**`direction` (régression — doit rester inchangé)** :
- ✅ Accès total toutes tables RLS
- ✅ Tous documents (y compris id_doc)
- ✅ Effacement RGPD (`crm_gdpr_purge_guest_documents`)
- ✅ Gestion users (peut promouvoir direction/admin_hotel)
- ✅ Lire `attachment_access_log`

**`admin_hotel` (nouveau)** :
- ✅ Accès pricing_rules, rate_plans, rate_prices
- ✅ Gestion users (`users_admin_manage`)
- ❌ Promotion vers `direction` ou `admin_hotel` bloquée (`set_user_hotel_role`)
- ❌ Accès id_doc refusé (document_role_permissions)
- ❌ Effacement RGPD refusé (`crm_gdpr_purge_guest_documents`)
- ❌ `attachment_access_log` — visible si ajouté à la policy, sinon refusé

**`reception` (régression)** :
- ✅ Réservations, clients, facturation, encaissements
- ✅ Accès id_doc (view, download, upload — pas delete)
- ❌ pricing_rules refusé
- ❌ rate_plans refusé
- ✅ rate_prices, rate_restrictions (inchangé)

**`comptabilite` (nouveau)** :
- ✅ Finance : invoices, payments, clôture, export
- ✅ Documents : contract/invoice/quote en view/download
- ❌ id_doc refusé
- ❌ pricing_rules refusé
- ❌ Effacement RGPD refusé
- ✅ `set_audit: read` (logs d'audit accessibles)

**`revenue_manager` (nouveau)** :
- ✅ pricing_rules, rate_plans, rate_prices, rms_pricing_*
- ✅ lighthouse_imports (veille marché)
- ✅ Documents : contract/invoice/quote en view/download
- ❌ id_doc refusé
- ❌ Finance opérationnelle (fin_close, fin_payment) refusée
- ❌ Effacement RGPD refusé

**`gouvernante` / `femme_de_chambre` / `maintenance` / `breakfast` (régression)** :
- ✅ Accès tables housekeeping (hotel_id uniquement — inchangé)
- ❌ pricing_rules refusé (inchangé)
- ❌ Documents : tous refusés (inchangé)

### 10.3 Tests frontend

- `settingsDiagnosticEngine` : vérifier que la détection "admin actif" fonctionne avec `direction` et `admin_hotel`.
- `HousekeepingPages` : vérifier que le filtre personnel inclut `gouvernante`, `femme_de_chambre`, `maintenance`, `breakfast`.
- `UsersView` : vérifier que les nouveaux rôles s'affichent avec leur label correct.
- Navigation : vérifier que `gouvernante` ne voit pas Revenue/Finance/SAS dans le Topbar.

### 10.4 Nettoyage recette

Tous les utilisateurs de test créés pour la recette seront supprimés en fin de session. Les entrées `document_role_permissions` sont de la configuration, pas des données de test — elles restent.

---

## Résumé exécutif

| Composant | Changements | Criticité |
|-----------|-------------|-----------|
| **Enum DB** | +3 valeurs (ADD VALUE non destructif) | Faible |
| **RLS** | 13 policies DROP+CREATE | Moyenne |
| **document_role_permissions** | +8 lignes INSERT | Faible |
| **is_platform_admin()** | Correctif `id` → `auth_id` | Haute (bug silencieux) |
| **user_hotels.role** | Défaut `direction` → `reception` | Haute (sécurité) |
| **get_user_role()** | Dépréciation commentée | Faible |
| **set_user_hotel_role()** | Nouvelle fonction anti-élévation | Haute |
| **permissionsService.tsx** | +2 RoleId, +2 entrées matrix, normalizeRole | Haute |
| **AppUserRole** | Aligner sur enum DB | Haute |
| **6 fichiers frontend** | Corrections comparaisons mortes | Haute |
| **Topbar.tsx** | Filtrage navigation par capability | Moyenne |
| **Edge Functions** | Aucune modification | — |

> **Aucune implémentation avant validation de ce plan.**
