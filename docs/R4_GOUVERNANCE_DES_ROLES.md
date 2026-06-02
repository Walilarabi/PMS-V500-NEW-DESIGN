# R4 — Gouvernance des Rôles (Rapport)

> **Statut** : RAPPORT UNIQUEMENT — aucune implémentation avant validation.
> **Périmètre** : Flowtym PMS · Production `hzrzkvdebaadditvbqis` · 02/06/2026
> **Objectif** : Éliminer la dette technique rôles frontend ≠ rôles base de données,
> et établir une source de vérité unique pour tous les modules futurs.

---

## TABLE DES MATIÈRES

1. [Inventaire complet des rôles](#1-inventaire-complet-des-rôles)
2. [Cartographie des droits — Matrice](#2-cartographie-des-droits--matrice)
3. [Incohérences détectées](#3-incohérences-détectées)
4. [Modèle cible recommandé](#4-modèle-cible-recommandé)
5. [Impacts](#5-impacts)
6. [Plan de migration](#6-plan-de-migration)
7. [Plan de rollback](#7-plan-de-rollback)

---

## 1. Inventaire complet des rôles

### 1.1 Couche Base de données — Enum `admin_user_role`

Source de vérité DB : `public.users.role::admin_user_role`

| # | Valeur enum | Libellé métier | Rôle en prod (nb users) |
|---|-------------|----------------|------------------------|
| 1 | `reception` | Réception | 0 users actifs en prod |
| 2 | `gouvernante` | Gouvernante | 0 |
| 3 | `femme_de_chambre` | Femme de chambre | 0 |
| 4 | `maintenance` | Maintenance | 0 |
| 5 | `breakfast` | Petit-déjeuner | 0 |
| 6 | `direction` | Direction | **1 user actif** |

**Emplacement** : `pg_enum` · `pg_type.typname = 'admin_user_role'`
**Tables utilisant cet enum** :
- `public.users.role` (NOT NULL, default `'reception'`)
- `public.user_hotels.role` (NOT NULL, default `'direction'` — **défaut dangereux**)

### 1.2 Couche Base de données — Table `platform_admins`

| Colonne | Type | Valeurs autorisées |
|---------|------|--------------------|
| `role` | `text` (non typé, pas d'enum) | `super_admin`, `support_agent`, `billing_admin` |

**Valeurs réellement en prod** : 1 entrée `role = 'super_admin'`
**Fonctions associées** :
- `public.is_platform_admin()` → `SELECT EXISTS (… WHERE id = auth.uid() …)` ⚠️ utilise `id` pas `auth_id`
- `public.platform_admin_role()` → `SELECT role … WHERE auth_id = auth.uid()` (utilise `auth_id` ✓)

### 1.3 Couche Base de données — Fonctions de résolution de rôle

| Fonction | Retour | Corps | Créée par |
|----------|--------|-------|-----------|
| `get_user_role()` | `admin_user_role` (enum typé) | `SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1` | Migration historique |
| `current_user_role()` | `text` (non typé) | Identique à `get_user_role()` | R1 (20260633) |

**Doublon détecté** : deux fonctions font exactement la même chose avec des types de retour différents.

### 1.4 Couche Base de données — Fonctions SECURITY DEFINER avec checks de rôle

| Fonction | Rôle(s) autorisé(s) | Mécanisme |
|----------|--------------------|-----------|
| `crm_gdpr_purge_guest_documents()` | `direction` uniquement | `current_user_role() NOT IN ('direction')` → exception |
| `register_attachment()` | Selon `document_role_permissions` | `can_access_document(kind, 'upload')` |
| `delete_attachment()` | Selon `document_role_permissions` | `can_access_document(kind, 'delete')` |
| `request_attachment_download()` | Selon `document_role_permissions` | `can_access_document(kind, action)` |
| `can_access_document()` | Lit `document_role_permissions` | `WHERE role = current_user_role()` |

### 1.5 Couche Base de données — Policies RLS avec vérification de rôle

| Table | Policy | Rôle(s) vérifié(s) | Fonction utilisée |
|-------|--------|-------------------|-------------------|
| `attachment_access_log` | `attach_access_select` (SELECT) | `owner`, `direction`, `admin` | `current_user_role()` |
| `competitor_sync_failures` | `sync_failures_select` (SELECT) | `direction` | `get_user_role()` |
| `lighthouse_imports` | `lighthouse_imports_insert` (INSERT) | `direction` | `get_user_role()` |
| `pricing_rules` | `pricing_rules_write` (ALL) | `direction` | `get_user_role()` |
| `promo_campaigns` | `promo_campaigns_modify` (ALL) | `direction`, `reception` | `get_user_role()` |
| `rate_plans` | `rate_plans_write` (ALL) | `direction` | `get_user_role()` |
| `rate_prices` | `rate_prices_write` (ALL) | `direction`, `reception` | `get_user_role()` |
| `rate_restrictions` | `rate_restrictions_write` (ALL) | `direction`, `reception` | `get_user_role()` |
| `rms_pricing_applications` | `rms_pricing_applications_modify` (ALL) | `direction`, `reception` | `get_user_role()` |
| `rms_pricing_recommendations` | `rms_pricing_reco_update` (UPDATE) | `direction`, `reception` | `get_user_role()` |
| `room_blocks` | `room_blocks_modify` (ALL) | `direction`, `reception` | `get_user_role()` |
| `users` | `users_admin_manage` (ALL) | `direction` | `get_user_role()` |
| `worker_runs` | `worker_runs_select` (SELECT) | `direction` | `get_user_role()` |
| `help_articles` | `help_articles_write` (ALL) | `super_admin`, `support_agent` | `platform_admin_role()` |
| `platform_admins` | `platform_admins_manage` (ALL) | `super_admin` | `platform_admin_role()` |
| 28+ tables | `platform_admin_all` (ALL) | *(plateforme)* | `is_platform_admin()` |

**Tables sans restriction de rôle** (hotel_id uniquement) : réservations, guests, chambres, housekeeping, facturation, etc. — accès à tous les rôles de l'hôtel.

### 1.6 Couche Base de données — `document_role_permissions` (R2)

| Rôle | id_doc | contract | invoice | quote | other |
|------|--------|----------|---------|-------|-------|
| `direction` | V D Del U | V D Del U | V D Del U | V D Del U | V D Del U |
| `reception` | V D — U | V D — U | V D — — | V D — U | V D — U |
| `gouvernante` | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* |
| `femme_de_chambre` | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* |
| `maintenance` | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* |
| `breakfast` | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* | *(refusé)* |

> V=view · D=download · Del=delete · U=upload · —=refusé

### 1.7 Couche Edge Functions

| Fonction | Check de rôle direct | Délégation |
|----------|---------------------|------------|
| `attachment-access` | Aucun | Délègue à `request_attachment_download()` (RPC SECURITY DEFINER) |
| `gdpr-erase-guest` | Aucun | Délègue à `crm_gdpr_purge_guest_documents()` (direction uniquement) |
| `send-whatsapp` | Aucun détecté | Vérifie JWT · authentification Supabase |

Les edge functions ne font pas de check de rôle direct : elles s'appuient sur les RPCs SECURITY DEFINER qui eux vérifient le rôle.

### 1.8 Couche Frontend — Types TypeScript

#### 1.8.1 `AppUserRole` — type principal utilisateur (LEGACY / DETTE)
**Fichier** : `frontend/src/domains/users/repository.ts:8`
```typescript
export type AppUserRole = 'owner' | 'direction' | 'admin' | 'reception' | 'housekeeping' | 'accountant' | 'rms';
```
Rôles : `owner`, `direction`, `admin`, `reception`, `housekeeping`, `accountant`, `rms`

#### 1.8.2 `AdminUserRole` — type synchronisé avec l'enum DB
**Fichier** : `frontend/src/lib/supabase.types.ts:13-19`
```typescript
export type AdminUserRole = 'reception' | 'gouvernante' | 'femme_de_chambre' | 'maintenance' | 'breakfast' | 'direction';
```
Généré depuis le schéma DB.

#### 1.8.3 `RoleId` — rôles RBAC internes
**Fichier** : `frontend/src/services/settings/permissionsService.tsx:21`
```typescript
export type RoleId = 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'reader';
```
Couche d'abstraction interne — jamais persisté en DB.

#### 1.8.4 `PlatformRole` — admin Flowtym
**Fichier** : `frontend/src/domains/admin/AdminContext.tsx:7`
```typescript
export type PlatformRole = 'super_admin' | 'support_agent' | 'billing_admin';
```

#### 1.8.5 `UserRole` — type local (Settings uniquement)
**Fichier** : `frontend/src/pages/settings/pages/UsersPage.tsx:24`
```typescript
type UserRole = 'admin' | 'receptionist' | 'housekeeping' | 'manager';
```
Type local non persisté — RBAC uniquement.

### 1.9 Couche Frontend — Constantes et labels

| Constante | Fichier | Rôles listés |
|-----------|---------|--------------|
| `ASSIGNABLE_ROLES` | `users/repository.ts:169` | `reception, gouvernante, femme_de_chambre, maintenance, breakfast, direction` (rôles DB réels ✓) |
| `USER_ROLE_LABEL` | `users/repository.ts:153` | DB réels + legacy : `owner (legacy)`, `admin (legacy)`, `housekeeping (legacy)`, `accountant (legacy)`, `rms (legacy)` |
| `ROLE_LABEL` | `UsersView.tsx:26` | **LEGACY** : `owner, direction, admin, reception, housekeeping, accountant, rms` |
| `ROLE_LABELS` | `AdminUsers.tsx:43` | Mix : `direction, reception, gouvernante, femme_de_chambre, maintenance, petit_dejeuner, revenue_manager, admin_hotel` |

### 1.10 Couche Frontend — normalizeRole()

**Fichier** : `frontend/src/services/settings/permissionsService.tsx:79-95`

```typescript
direction           → 'admin'       (RBAC)
reception           → 'receptionist'
gouvernante         → 'housekeeping'
femme_de_chambre    → 'housekeeping'
maintenance         → 'housekeeping'
breakfast           → 'housekeeping'
(inconnu)           → 'reader'      (défaut sécurisé)
```

### 1.11 Couche Frontend — Navigation et menus

La navigation (Topbar, Sidebar) est **entièrement statique** — aucun filtre par rôle.
Les permissions sont vérifiées **à l'intérieur de chaque page** via `usePermission()`.

| Module | Menu | Capabilities RBAC protégées |
|--------|------|------------------------------|
| Flowday | flowday | hk_status, hk_assign, hk_maintain |
| Réservations | reservations | res_view, res_create, res_groups |
| Clients | clients | cli_view, cli_export, cli_merge |
| Revenue/RMS | revenue | rev_view, rev_decisions, rev_pricing, rev_autopilot, rev_decisions |
| Finance | finance | fin_invoice, fin_payment, fin_close, fin_export |
| Paramètres | settings | set_hotel, set_rooms, set_users, set_api, set_integrations, set_fiscal, set_audit, set_backups, set_rgpd |
| SAS | sas | *(aucune protection RBAC trouvée)* |
| Analyse | analysis | *(aucune protection RBAC trouvée)* |
| Support | support | *(aucune protection RBAC trouvée)* |

### 1.12 Couche Frontend — Comparaisons directes role === 'xxx'

| Fichier | Ligne | Condition | Rôle testé | Risque |
|---------|-------|-----------|------------|--------|
| `ConfigSections1to7.tsx` | 113 | `user.role === 'admin'` | `admin` | Ne matchera jamais (non DB) |
| `settingsDiagnosticEngine.ts` | 169, 204, 422, 666 | `u.role === 'admin' && u.active` | `admin` | Ne matchera jamais |
| `settingsDiagnosticEngine.ts` | 661 | `u.role === 'housekeeping'` | `housekeeping` | Ne matchera jamais (DB: gouvernante/femme_de_chambre) |
| `AdminContext.tsx` | 66-68 | `admin?.role === 'super_admin'` | `super_admin` | OK (platform_admins) |
| `UsersView.tsx` | 253 | `user.role === 'owner'` | `owner` | Ne matchera jamais (non DB) |
| `HousekeepingPages.tsx` | 129 | `u.role === 'housekeeping'` | `housekeeping` | Ne matchera jamais |
| `UsersPage.tsx` | 73, 117, 276 | `u.role === 'admin'` | `admin` | Ne matchera jamais |

---

## 2. Cartographie des droits — Matrice

### 2.1 Matrice RBAC frontend (DEFAULT_PERMISSIONS)

Niveaux : `none` (0) · `read` (1) · `write` (2) · `admin` (3)

| Capability | Description | admin | manager | receptionist | housekeeping | reader |
|-----------|-------------|:-----:|:-------:|:------------:|:------------:|:------:|
| **RÉSERVATIONS** | | | | | | |
| res_view | Voir réservations | admin | admin | admin | read | read |
| res_create | Créer/modifier resa | admin | admin | admin | none | none |
| res_groups | Groupes & allotements | admin | write | read | none | none |
| **CLIENTS** | | | | | | |
| cli_view | Fiches clients | admin | admin | admin | none | read |
| cli_export | Export RGPD | admin | write | read | none | none |
| cli_merge | Fusion/suppression | admin | write | none | none | none |
| **REVENUE & RMS** | | | | | | |
| rev_view | Dashboard RMS | admin | admin | read | none | read |
| rev_decisions | Valider recos | admin | admin | none | none | none |
| rev_pricing | Calendrier tarifaire | admin | admin | none | none | none |
| rev_autopilot | Autopilote RMS | admin | write | none | none | none |
| **FINANCE** | | | | | | |
| fin_invoice | Facturer | admin | admin | write | none | none |
| fin_payment | Encaissements | admin | admin | write | none | none |
| fin_close | Clôture journalière | admin | admin | none | none | none |
| fin_export | Export comptable | admin | admin | none | none | read |
| **HOUSEKEEPING** | | | | | | |
| hk_status | Statuts chambres | admin | read | read | admin | read |
| hk_assign | Affectations personnel | admin | read | none | write | none |
| hk_maintain | Maintenance & OOO | admin | read | none | write | none |
| **PARAMÈTRES** | | | | | | |
| set_hotel | Infos établissement | admin | write | none | none | read |
| set_rooms | Chambres & inventaire | admin | write | none | read | read |
| set_users | Utilisateurs & rôles | admin | none | none | none | none |
| set_api | API & Webhooks | admin | none | none | none | none |
| set_integrations | Intégrations & OTAs | admin | write | none | none | read |
| set_fiscal | Fiscalité | admin | write | none | none | read |
| set_audit | Audit/Logs | admin | read | none | none | read |
| set_backups | Sauvegardes | admin | read | none | none | read |
| set_rgpd | RGPD | admin | read | none | none | read |

### 2.2 Matrice RLS DB (rôles réels en base)

| Table | direction | reception | gouvernante | femme_de_chambre | maintenance | breakfast |
|-------|:---------:|:---------:|:-----------:|:----------------:|:-----------:|:---------:|
| `users` (gestion) | ✅ ALL | — | — | — | — | — |
| `pricing_rules` | ✅ ALL | — | — | — | — | — |
| `rate_plans` | ✅ ALL | — | — | — | — | — |
| `rate_prices` | ✅ ALL | ✅ ALL | — | — | — | — |
| `rate_restrictions` | ✅ ALL | ✅ ALL | — | — | — | — |
| `room_blocks` | ✅ ALL | ✅ ALL | — | — | — | — |
| `promo_campaigns` | ✅ ALL | ✅ ALL | — | — | — | — |
| `rms_pricing_*` | ✅ ALL | ✅ ALL | — | — | — | — |
| `lighthouse_imports` | ✅ INSERT | — | — | — | — | — |
| `worker_runs` | ✅ SELECT | — | — | — | — | — |
| `competitor_sync_failures` | ✅ SELECT | — | — | — | — | — |
| `attachment_access_log` (SELECT) | ✅ | — | — | — | — | — |
| `reservations`, `guests`, `rooms`, etc. | ✅ hotel_id | ✅ hotel_id | ✅ hotel_id | ✅ hotel_id | ✅ hotel_id | ✅ hotel_id |

> Les rôles `gouvernante`, `femme_de_chambre`, `maintenance`, `breakfast` n'ont **aucune restriction de rôle supplémentaire** côté RLS — ils accèdent à tout ce que l'isolement multi-tenant permet.

### 2.3 Matrice documents (document_role_permissions)

| Rôle DB | Voir | Télécharger | Supprimer | Uploader |
|---------|:----:|:-----------:|:---------:|:--------:|
| `direction` | ✅ tous | ✅ tous | ✅ tous | ✅ tous |
| `reception` | ✅ tous | ✅ tous | ❌ | ✅ sauf factures |
| `gouvernante` | ❌ | ❌ | ❌ | ❌ |
| `femme_de_chambre` | ❌ | ❌ | ❌ | ❌ |
| `maintenance` | ❌ | ❌ | ❌ | ❌ |
| `breakfast` | ❌ | ❌ | ❌ | ❌ |

---

## 3. Incohérences détectées

### INC-01 — Doublon de fonctions `get_user_role()` / `current_user_role()`
**Sévérité : MOYENNE**

Deux fonctions font exactement la même chose :
```sql
get_user_role()      → admin_user_role  (enum)
current_user_role()  → text             (non typé, R1)
```
- Les RLS historiques utilisent `get_user_role()` (enum typé → cast explicite nécessaire).
- Les fonctions R1/R2/R3 utilisent `current_user_role()` (text).
- Risque : divergence si l'une est modifiée, confusion pour les développeurs futurs.
- `attachment_access_log` utilise `current_user_role()` avec des valeurs `'owner'`, `'direction'`, `'admin'` (text) — deux de ces trois valeurs ne peuvent jamais exister en DB.

### INC-02 — Rôles `owner`, `admin` dans RLS mais absents de l'enum DB
**Sévérité : HAUTE**

La policy `attach_access_select` :
```sql
current_user_role() IN ('owner'::text, 'direction'::text, 'admin'::text)
```
Les valeurs `owner` et `admin` n'existent pas dans `admin_user_role`. Cette policy est en réalité **direction uniquement**. Les chaînes `'owner'` et `'admin'` ne matcheront jamais.

### INC-03 — `AppUserRole` frontend ≠ enum DB
**Sévérité : HAUTE**

| Frontend `AppUserRole` | Présent en DB ? |
|------------------------|-----------------|
| `owner` | ❌ Absent |
| `direction` | ✅ |
| `admin` | ❌ Absent |
| `reception` | ✅ |
| `housekeeping` | ❌ (DB : `gouvernante` + `femme_de_chambre`) |
| `accountant` | ❌ Absent |
| `rms` | ❌ Absent |

Et inversement :

| DB `admin_user_role` | Présent dans `AppUserRole` ? |
|----------------------|------------------------------|
| `gouvernante` | ❌ Absent |
| `femme_de_chambre` | ❌ Absent |
| `maintenance` | ❌ Absent |
| `breakfast` | ❌ Absent |

### INC-04 — Comparaisons directes `role === 'admin'` et `role === 'housekeeping'` cassées
**Sévérité : HAUTE**

8+ endroits dans le code frontend comparent `u.role === 'admin'` ou `u.role === 'housekeeping'`. Comme ces valeurs n'existent pas en DB, ces conditions ne matchent **jamais** aucun utilisateur. Le `settingsDiagnosticEngine` est particulièrement impacté (vérifications admin actif pour les alertes).

### INC-05 — `ROLE_LABEL` dans `UsersView.tsx` affiche les anciens rôles legacy
**Sévérité : MOYENNE**

```typescript
const ROLE_LABEL = { owner, direction, admin, reception, housekeeping, accountant, rms };
```
Ce composant affiche des labels pour des rôles qui n'existent plus en base. Un utilisateur avec `role = 'gouvernante'` afficherait un label vide/undefined.

### INC-06 — `ROLE_LABELS` dans `AdminUsers.tsx` contient des rôles inexistants
**Sévérité : MOYENNE**

```typescript
{ ..., petit_dejeuner: 'Petit déjeuner', revenue_manager: 'Revenue Manager', admin_hotel: 'Admin hôtel' }
```
- `petit_dejeuner` ≠ `breakfast` (valeur DB réelle)
- `revenue_manager` et `admin_hotel` n'existent pas dans l'enum DB

### INC-07 — `user_hotels.role` défaut `'direction'` — risque de sur-privilege
**Sévérité : HAUTE**

La colonne `user_hotels.role` a pour défaut `'direction'::admin_user_role`. Si une entrée est insérée sans rôle explicite, le user hérite du rôle le plus puissant.

### INC-08 — `is_platform_admin()` utilise `id` au lieu de `auth_id`
**Sévérité : MOYENNE**

```sql
SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid() …)
```
Si `platform_admins.id` est l'UUID applicatif (≠ `auth.uid()` qui est l'UUID Supabase Auth), cette fonction retourne toujours `false`. La cohérence avec `platform_admin_role()` (qui utilise `auth_id`) est douteuse.

### INC-09 — Navigation non filtrée par rôle (UX uniquement)
**Sévérité : FAIBLE**

Tous les items de menu (Revenue, Finance, SAS, Admin) sont visibles à tous les rôles. Un agent de femme de chambre voit le menu "Revenue Manager" et "Finance". Seul le contenu de la page est protégé. Pas un problème de sécurité (les RPCs et RLS protègent les données), mais une UX dégradée.

### INC-10 — Modules SAS, Analyse, Support sans protection RBAC
**Sévérité : MOYENNE**

Aucune `usePermission()` trouvée sur les modules SAS (Revenue Integrity Engine) et Analyse. Ces modules financièrement sensibles sont accessibles à tous les rôles de l'hôtel, sans vérification.

### INC-11 — `platform_admins.role` est `text` libre (pas d'enum)
**Sévérité : FAIBLE**

Pas de contrainte de type sur `platform_admins.role` — une typo pourrait créer un rôle invalide sans erreur.

### INC-12 — Deux rôles RBAC `manager` absents de la normalisation
**Sévérité : FAIBLE**

`normalizeRole()` ne mappe aucun rôle DB vers `manager` ou `reader`. Ces RoleId RBAC ne sont donc jamais activés par un login réel — ils existent uniquement si la matrice est modifiée manuellement dans localStorage.

### Synthèse incohérences

| Code | Sévérité | Nature | Impact |
|------|----------|--------|--------|
| INC-01 | Moyenne | Doublon `get_user_role` / `current_user_role` | Confusion, risque divergence |
| INC-02 | **Haute** | RLS `owner`/`admin` ne matchent jamais | Fausse sécurité (exclusion silencieuse) |
| INC-03 | **Haute** | `AppUserRole` ≠ enum DB | Frontend/DB désynchronisés |
| INC-04 | **Haute** | Comparaisons `role === 'admin'` cassées | Fonctionnalités mortes |
| INC-05 | Moyenne | Labels UsersView legacy | UX : labels vides/undefined |
| INC-06 | Moyenne | AdminUsers : `petit_dejeuner`, `revenue_manager`, `admin_hotel` absents | UI invalide |
| INC-07 | **Haute** | `user_hotels.role` défaut `direction` | Sur-privilege silencieux |
| INC-08 | Moyenne | `is_platform_admin()` utilise `id` vs `auth_id` | Admin platform potentiellement cassé |
| INC-09 | Faible | Navigation non filtrée | UX dégradée, pas de faille sécurité |
| INC-10 | Moyenne | SAS/Analyse sans RBAC | Modules sensibles non protégés |
| INC-11 | Faible | `platform_admins.role` = text libre | Pas de validation de type |
| INC-12 | Faible | `manager`/`reader` jamais activés | RBAC incomplet |

---

## 4. Modèle cible recommandé

### 4.1 Principes directeurs

1. **Une seule source de vérité** : l'enum DB est le référentiel des rôles. Le frontend ne définit pas ses propres rôles — il lit et affiche les rôles DB.
2. **Séparation des couches** : rôles métier (DB) → RBAC interne (frontend, 5 niveaux) via `normalizeRole()` stable.
3. **Moindre privilège** : le défaut est le niveau le plus bas (`reception`), pas `direction`.
4. **Platform admins séparés** : les admins Flowtym restent dans `platform_admins`, avec un enum typé.

### 4.2 Rôles métier cibles (nouvel enum `user_role`)

| # | Slug cible | Libellé | Responsabilités | Restrictions clés |
|---|-----------|---------|-----------------|-------------------|
| 1 | `direction` | Direction | Pilotage complet : resa, tarifs, finances, RMS, users, RGPD, exports | Aucune |
| 2 | `admin_hotel` | Administrateur hôtel | Même périmètre que direction sauf : pas de RGPD effacement, pas de suppression users | Pas d'effacement RGPD |
| 3 | `reception` | Réception | Check-in/out, resa, facturation, encaissements, upload docs (sauf factures) | Pas de suppression docs, pas de tarification, pas de clôture |
| 4 | `gouvernante` | Gouvernante | Supervision housekeeping : statuts chambres, affectations, objets trouvés, maintenance | Pas d'accès resa, finance, revenue |
| 5 | `femme_de_chambre` | Femme de chambre | Mise à jour statuts chambres uniquement | Accès minimal : chambre assignée uniquement |
| 6 | `maintenance` | Maintenance | Tickets maintenance : création, mise à jour, résolution | Pas d'accès resa, finance |
| 7 | `petit_dejeuner` | Petit-déjeuner | Module petit-déjeuner : commandes, services | Pas d'accès resa, finance, revenue |
| 8 | `comptabilite` | Comptabilité | Finance, exports comptables, rapports, clôtures | Pas de resa, pas de tarifs, pas d'users |
| 9 | `revenue_manager` | Revenue Manager | RMS, tarification, distribution, calendrier | Pas de resa directe, pas de finance opérationnelle |

> **Platform Super Admin Flowtym** : reste dans `platform_admins.role = 'super_admin'` (système séparé, multi-hôtel). Ne pas mélanger avec les rôles hôtel.

### 4.3 Mapping vers RBAC frontend (normalizeRole cible)

| Rôle DB cible | RoleId RBAC | Justification |
|---------------|-------------|---------------|
| `direction` | `admin` | Accès complet |
| `admin_hotel` | `manager` | Quasi-complet sauf RGPD/users |
| `reception` | `receptionist` | Front-desk standard |
| `gouvernante` | `housekeeping` | Supervision étages |
| `femme_de_chambre` | `housekeeping` | Exécution étages |
| `maintenance` | `housekeeping` | Maintenance technique |
| `petit_dejeuner` | `housekeeping` | Service restauration |
| `comptabilite` | `manager` (subset finance) | Finance only |
| `revenue_manager` | `manager` (subset revenue) | Revenue only |

> **Note** : `comptabilite` et `revenue_manager` mappent vers `manager` mais le frontend pourrait créer deux nouveaux RoleId (`accountant`, `revenue`) pour affiner les permissions. À décider lors de la validation.

### 4.4 Matrice RBAC cible par rôle DB

| Capability | direction | admin_hotel | reception | gouvernante | femme_de_chambre | maintenance | petit_dejeuner | comptabilite | revenue_manager |
|-----------|:---------:|:-----------:|:---------:|:-----------:|:----------------:|:-----------:|:--------------:|:------------:|:---------------:|
| res_view | admin | admin | admin | read | none | none | none | read | read |
| res_create | admin | admin | admin | none | none | none | none | none | none |
| res_groups | admin | write | read | none | none | none | none | none | none |
| cli_view | admin | admin | admin | none | none | none | none | read | none |
| cli_export | admin | write | read | none | none | none | none | write | none |
| cli_merge | admin | write | none | none | none | none | none | none | none |
| rev_view | admin | admin | read | none | none | none | none | read | admin |
| rev_decisions | admin | admin | none | none | none | none | none | none | admin |
| rev_pricing | admin | admin | none | none | none | none | none | none | admin |
| rev_autopilot | admin | write | none | none | none | none | none | none | write |
| fin_invoice | admin | admin | write | none | none | none | none | admin | none |
| fin_payment | admin | admin | write | none | none | none | none | admin | none |
| fin_close | admin | admin | none | none | none | none | none | admin | none |
| fin_export | admin | admin | none | none | none | none | none | admin | none |
| hk_status | admin | read | read | admin | admin | write | read | none | none |
| hk_assign | admin | read | none | admin | none | none | none | none | none |
| hk_maintain | admin | read | none | write | none | admin | none | none | none |
| set_hotel | admin | write | none | none | none | none | none | none | none |
| set_rooms | admin | write | none | read | none | none | none | none | none |
| set_users | admin | none | none | none | none | none | none | none | none |
| set_api | admin | none | none | none | none | none | none | none | none |
| set_integrations | admin | write | none | none | none | none | none | none | none |
| set_fiscal | admin | write | none | none | none | none | none | read | none |
| set_audit | admin | read | none | none | none | none | none | read | none |
| set_backups | admin | read | none | none | none | none | none | none | none |
| set_rgpd | admin | none | none | none | none | none | none | none | none |

### 4.5 Permissions documents cibles

| Rôle DB cible | id_doc | contract | invoice | quote | other |
|---------------|--------|----------|---------|-------|-------|
| `direction` | V D Del U | V D Del U | V D Del U | V D Del U | V D Del U |
| `admin_hotel` | V D Del U | V D Del U | V D Del U | V D Del U | V D Del U |
| `reception` | V D — U | V D — U | V D — — | V D — U | V D — U |
| `gouvernante` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `femme_de_chambre` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `maintenance` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `petit_dejeuner` | — — — — | — — — — | — — — — | — — — — | — — — — |
| `comptabilite` | — — — — | V D — — | V D — — | V D — — | V D — — |
| `revenue_manager` | — — — — | V D — — | V D — — | V D — — | — — — — |

---

## 5. Impacts

### 5.1 Impact Base de données / Supabase

| Composant | Impact | Détail |
|-----------|--------|--------|
| Enum `admin_user_role` | **Moyen** | Renommer en `user_role`. Ajouter : `admin_hotel`, `petit_dejeuner`, `comptabilite`, `revenue_manager`. Renommer `breakfast` → `petit_dejeuner` (migration de données nécessaire). |
| `public.users.role` | **Moyen** | Type change si enum renommé. Migration data : `breakfast` → `petit_dejeuner`. Changer défaut : `reception` (déjà correct). |
| `public.user_hotels.role` | **Faible** | Changer défaut de `'direction'` → `'reception'` (INC-07). |
| `get_user_role()` | **Faible** | Déprécier au profit de `current_user_role()`. Ou unifier. |
| `current_user_role()` | **Faible** | Conserver, éventuellement typer `RETURNS user_role`. |
| RLS policies | **Moyen** | Ajouter `admin_hotel` partout où `direction` est autorisé (ou décider de restrictions fines). |
| `document_role_permissions` | **Faible** | Ajouter les nouvelles lignes pour `admin_hotel`, `comptabilite`, `revenue_manager`. |
| `is_platform_admin()` | **Faible** | Corriger `WHERE id = auth.uid()` → `WHERE auth_id = auth.uid()` (INC-08). |

### 5.2 Impact Frontend React

| Composant | Impact | Détail |
|-----------|--------|--------|
| `AppUserRole` | **Élevé** | Remplacer par les rôles DB réels (ou supprimer au profit de `AdminUserRole`). |
| `normalizeRole()` | **Moyen** | Ajouter mappings : `admin_hotel`→`manager`, `comptabilite`→`manager`, `revenue_manager`→`manager`. |
| `ROLE_LABEL` (UsersView) | **Moyen** | Mettre à jour pour afficher les nouveaux rôles. |
| `ROLE_LABELS` (AdminUsers) | **Moyen** | Corriger : `petit_dejeuner` (pas `breakfast`), retirer `revenue_manager`/`admin_hotel` si non en DB. |
| `USER_ROLE_LABEL` | **Moyen** | Nettoyer les legacy (owner, admin, housekeeping, accountant, rms). |
| `ASSIGNABLE_ROLES` | **Faible** | Ajouter les nouveaux rôles. |
| `settingsDiagnosticEngine.ts` | **Élevé** | Corriger 6 comparaisons `role === 'admin'` → `role === 'direction'` ou `role IN ['direction','admin_hotel']`. |
| `HousekeepingPages.tsx` | **Moyen** | Corriger `role === 'housekeeping'` → `role IN ['gouvernante','femme_de_chambre']`. |
| `UsersView.tsx` | **Moyen** | Corriger `role === 'owner'` → `role === 'direction'` (garde du propriétaire). |
| Navigation (Sidebar/Topbar) | **Moyen** | Ajouter filtrage par rôle sur les modules sensibles (Revenue, Finance, SAS). |

### 5.3 Impact RLS / Sécurité

| Scenario | Impact |
|----------|--------|
| Ajout `admin_hotel` | Les policies `direction`-only devront être revues pour permettre ou refuser `admin_hotel` selon la sensibilité. |
| Ajout `comptabilite` | Accès Finance en lecture/écriture, pas de tarification ni d'admin users. |
| Ajout `revenue_manager` | Accès RMS complet, pas de finance opérationnelle. |
| Correction INC-02 (owner/admin) | Retirer ces chaînes de `attach_access_select` — direction uniquement. |
| Correction INC-07 (défaut user_hotels) | Changer défaut `direction` → `reception` — plus sécurisé. |

### 5.4 Impact Journal 360°

Le Journal 360° (`communication_timeline_v2`) est filtré par `can_access_document(kind, 'view')`.
- Ajouter des lignes `document_role_permissions` pour `comptabilite` et `revenue_manager` exposera leurs documents dans la timeline.
- Aucune modification de la RPC elle-même requise — le filtrage est dynamique.

### 5.5 Impact CRM futur

- Les rôles `direction`, `admin_hotel`, `reception` auront accès aux modules CRM (clients, segments, tags, badges).
- `comptabilite`, `revenue_manager` : accès lecture client en contexte financier.
- `gouvernante`, `femme_de_chambre`, `maintenance`, `petit_dejeuner` : pas d'accès CRM.

### 5.6 Impact Automatisation future

- Les automatisations déclencheront des actions au nom de rôles. Il faudra que le système d'automatisation précise sous quel rôle il agit (ou avec `service_role`).
- La gouvernance des rôles établie ici sera la base de la configuration des automatisations.

---

## 6. Plan de migration

### 6.1 Ordre de migration (sans rupture de service)

#### Étape 0 — Préparation (sans impact production)
- Tagger la version courante en git (`pre-r4`)
- Documenter les rôles actuels (ce rapport ✓)
- Créer les migrations SQL et tests en sandbox

#### Étape 1 — Correction des bugs silencieux (INC-02, INC-07, INC-08)
Migrations SQL :
1. Corriger `is_platform_admin()` : `WHERE id` → `WHERE auth_id`
2. Corriger défaut `user_hotels.role` : `'direction'` → `'reception'`
3. Corriger `attach_access_select` : retirer `'owner'`, `'admin'` (déjà dead code)

Impact : aucun utilisateur affecté (ces conditions ne matchaient jamais).

#### Étape 2 — Extension de l'enum (non destructif)
```sql
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'admin_hotel';
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'petit_dejeuner';
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'comptabilite';
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'revenue_manager';
```
Les nouveaux rôles existent en DB. Aucun user n'en a encore. Rollback : impossible de retirer des valeurs d'enum sans recréer le type — d'où la nécessité de tester avant.

#### Étape 3 — Mise à jour des RLS (direction + nouveaux rôles)
```sql
-- Exemple : ajouter admin_hotel partout où direction est autorisé seul
-- Évaluer au cas par cas (certaines tables restent direction-only)
```
À définir précisément lors de l'implémentation.

#### Étape 4 — Mise à jour `document_role_permissions`
Insérer les nouvelles lignes pour `admin_hotel`, `comptabilite`, `revenue_manager`.

#### Étape 5 — Migration donnée `breakfast` → `petit_dejeuner` (si renommage souhaité)
```sql
UPDATE public.users SET role = 'petit_dejeuner' WHERE role = 'breakfast';
UPDATE public.user_hotels SET role = 'petit_dejeuner' WHERE role = 'breakfast';
```
Option B : conserver `breakfast` en DB et ajouter `petit_dejeuner` comme alias côté labels.

#### Étape 6 — Mise à jour frontend
Dans l'ordre :
1. Mettre à jour `AdminUserRole` dans `supabase.types.ts` (regénérer depuis le schéma)
2. Remplacer `AppUserRole` par `AdminUserRole` (ou les aligner)
3. Mettre à jour `normalizeRole()` pour les nouveaux rôles
4. Corriger `ROLE_LABEL`, `USER_ROLE_LABEL`, `ROLE_LABELS`, `ASSIGNABLE_ROLES`
5. Corriger les comparaisons directes `role === 'admin'` → `role IN ['direction','admin_hotel']`
6. Corriger `role === 'housekeeping'` → `role IN ['gouvernante','femme_de_chambre']`
7. Corriger `role === 'owner'` → `role === 'direction'`
8. Ajouter filtrage navigation (optionnel, UX)

#### Étape 7 — Unification `get_user_role()` / `current_user_role()`
Déprécier `get_user_role()` (old), faire pointer les RLS vers `current_user_role()` (R1).
Ou l'inverse. Décision à prendre lors de l'implémentation.

#### Étape 8 — Recette complète
Tests d'impersonation pour chaque rôle cible :
- Vérifier l'accès aux tables RLS-protégées
- Vérifier le filtrage des documents
- Vérifier les RBAC frontend (par capability)
- Vérifier la navigation

### 6.2 Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Extension enum irréversible | Haute | Moyen | Tester en sandbox avant prod. Ne pas ajouter de rôles non décidés. |
| Migration `breakfast` → `petit_dejeuner` avec users actifs | Faible (0 user actuellement) | Faible | En prod avec 0 users : migration sans risque. À faire avant premiers users. |
| RLS trop permissives après ajout `admin_hotel` | Moyenne | Haute | Revue table par table. Principe : ajouter `admin_hotel` seulement si la direction serait embarrassée de restreindre. |
| Frontend cassé si `AppUserRole` modifié | Haute | Moyenne | Passer par étapes : garder `AppUserRole` en alias pendant la transition. |
| Régression `settingsDiagnosticEngine` | Haute | Moyenne | Tests unitaires avant déploiement. |

### 6.3 Compatibilité

- Aucune migration ne retire de rôle existant en DB (non destructif).
- Le rôle `breakfast` peut coexister avec `petit_dejeuner` pendant la transition.
- Les fonctions `request_attachment_download`, `register_attachment`, `delete_attachment` n'ont pas besoin d'être modifiées (elles lisent `document_role_permissions` dynamiquement).

---

## 7. Plan de rollback

### 7.1 Rollback Étape 1 (corrections bugs)
```sql
-- Restaurer is_platform_admin() (si cassé)
CREATE OR REPLACE FUNCTION public.is_platform_admin() ...
  WHERE id = auth.uid() ...;
-- Restaurer défaut user_hotels.role
ALTER TABLE public.user_hotels ALTER COLUMN role SET DEFAULT 'direction'::admin_user_role;
-- Restaurer attach_access_select
DROP POLICY IF EXISTS attach_access_select ON public.attachment_access_log;
CREATE POLICY attach_access_select ON public.attachment_access_log FOR SELECT TO authenticated
  USING (hotel_id = get_user_hotel_id()
    AND current_user_role() IN ('owner','direction','admin'));
```

### 7.2 Rollback Étape 2 (extension enum)
L'extension d'un enum PostgreSQL est **irréversible** sans recréer le type.

Plan B : si les nouveaux rôles ne sont affectés à aucun utilisateur, leur présence dans l'enum est inoffensive. Le "rollback" consiste à ne pas les utiliser.

Plan C (destructif, uniquement en urgence) :
```sql
-- Recréer le type sans les nouvelles valeurs
-- Nécessite: modifier toutes les colonnes qui utilisent l'enum, supprimer+recréer
-- Plan complet à préparer avant l'étape 2
```

### 7.3 Rollback Étape 3 (RLS)
Chaque nouvelle policy est versionnée dans une migration numérotée avec son rollback correspondant en `supabase/rollback/`.

### 7.4 Rollback Étape 6 (frontend)
Git revert sur la branche frontend. Le frontend est découplé du DB — un rollback frontend ne casse pas la DB.

### 7.5 Snapshot pré-migration recommandé
Avant toute migration production :
1. `pg_dump` du schéma complet (pas les données — RGPD)
2. Tag git `pre-r4-migration`
3. Note des valeurs actuelles de `user_hotels.role` et `users.role`

---

## Conclusion et recommandation

**Priorité immédiate (avant tout utilisateur supplémentaire)** :
1. INC-07 : changer le défaut `user_hotels.role` de `direction` → `reception`
2. INC-04 : corriger les comparaisons `role === 'admin'` cassées dans `settingsDiagnosticEngine`
3. INC-03 : aligner `AppUserRole` sur `AdminUserRole` (DB est la vérité)

**Priorité haute (avant modules Finance/Revenue en production)** :
4. Ajouter `comptabilite` et `revenue_manager` à l'enum
5. Mettre à jour `document_role_permissions` pour ces rôles
6. Ajouter protection RBAC sur SAS et Analyse

**Priorité normale** :
7. Unifier `get_user_role()` / `current_user_role()`
8. Ajouter `admin_hotel` pour délégation sans RGPD
9. Corriger navigation (filtrage menus par rôle)

**Décidera direction/DPO** :
- Conserver `breakfast` ou renommer `petit_dejeuner`
- Niveau de restriction des RLS pour `admin_hotel` vs `direction`
- Filtrage navigation : cacher ou afficher avec "accès refusé"

> **Aucune implémentation avant validation du présent rapport.**
