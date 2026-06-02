# HANDOFF — R4 Gouvernance des rôles

**Branche :** `claude/friendly-mayer-6t5Th`
**Date :** 2026-06-02
**Statut :** Étape A (DB) + Étape B (Topbar) livrées et recettées. 1 dette connue ouverte.

---

## 1. Objectif de la mission

Aligner la gouvernance des rôles de bout en bout :
**rôle DB (enum Postgres) → `normalizeRole()` → `RoleId` RBAC → `hasPermission(capability)` → navigation + RLS.**

Principe directeur : **aucun rôle DB n'est référencé en dur dans l'UI**. Tout passe par les capabilities.

---

## 2. Ce qui a été livré

### Étape A — Base de données (commit `b3cb6bc`)
Migrations idempotentes + rollbacks dans `supabase/migrations/` :

| Migration | Rôle |
|---|---|
| `20260636_r4a_bug_fixes.sql` | corrections de bugs préalables |
| `20260637_r4b_extend_enum.sql` | extension de l'enum rôle DB (ajout `comptabilite`, `revenue_manager`, etc.) |
| `20260638_r4c_update_rls.sql` | mise à jour des politiques RLS |
| `20260639_r4d_document_perms.sql` | permissions documents |
| `20260640_r4e_unify_role_fn.sql` | unification fonction de normalisation rôle |

⚠️ **Migrations NON appliquées en remote** par cette session — à appliquer via le workflow Supabase habituel. Chaque migration a son rollback dans `supabase/migrations/rollback/`.

**Garde anti-élévation** : `set_user_hotel_role()` (RPC) empêche `admin_hotel` de promouvoir vers `direction`. Le frontend (`repository.ts`) appelle cette RPC, **jamais d'UPDATE direct** sur le rôle.

### Étape B — Filtrage navigation Topbar (commit `07dbe66`)
`frontend/src/components/layout/Topbar.tsx` :
- Chaque `NAV_ITEM` porte un `requires?: { caps: string[]; level: AccessLevel }` (logique **OU** sur les caps).
- Filtrage via `hasPermission(session.role, cap, level)`.
- Pas de session → tous les menus visibles (parité mode dev).
- Flowday / Paramètres / Support : **aucun gate** (toujours visibles).

`frontend/src/services/settings/permissionsService.tsx` :
- **CP-2** : `accountant.rev_view` → `none` (Revenue masqué pour comptabilité).
- **CP-3** : `revenue.res_view` → `none` (Réservations masqué pour revenue_manager).

### Recette (commit `f35f45e`)
`frontend/src/services/settings/__tests__/R4_recette.test.ts` — **93 tests, 100% passants.**
Lancer : `cd frontend && npx vitest run src/services/settings/__tests__/R4_recette.test.ts`

---

## 3. Matrice de navigation validée (état final)

| Menu | direction | admin_hotel | reception | comptabilite | revenue_manager | housekeeping ×4 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Flowday | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SAS | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ |
| Réservations | ✅ | ✅ | ✅ | ✅ | ✗ | ✅ |
| Clients | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ |
| Revenue | ✅ | ✅ | ✗ | ✗ | ✅ | ✗ |
| Finance | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ |
| Analyse | ✅ | ✅ | ✗ | ✅ | ✅ | ✗ |
| Paramètres | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Total** | **9** | **9** | **7** | **7** | **5** | **4** |

Les 4 rôles housekeeping (`gouvernante`, `femme_de_chambre`, `maintenance`, `breakfast`) convergent vers le `RoleId` `housekeeping` → barre **identique** (décision CP-1).

Mapping capability → menu :
- SAS : `res_view` ≥ write
- Réservations : `res_view` ≥ read
- Clients : `cli_view` ≥ read
- Revenue : `rev_view` ≥ read
- Finance : `fin_invoice` OU `fin_export` ≥ read
- Analyse : `rev_view` OU `fin_export` ≥ read

---

## 4. Dette ouverte (À FAIRE — bloquée sur validation)

### `RolesAccessPage.tsx` désynchronisé
`frontend/src/pages/settings/pages/RolesAccessPage.tsx` (écran admin d'édition RBAC) utilise encore **l'ancien `RoleId` à 5 valeurs** : `admin | manager | receptionist | housekeeping | reader`.

**Conséquences :**
- Ne connaît ni `accountant` ni `revenue` → un admin ne peut **pas éditer visuellement** les permissions de `comptabilite` / `revenue_manager`.
- Son `DEFAULT_MATRIX` interne a divergé de `DEFAULT_PERMISSIONS` dans `permissionsService.tsx` (commentaire « synchronisée avec RolesAccessPage.DEFAULT_MATRIX » désormais obsolète).

**Impact runtime : NUL** — `loadPermissionsMatrix()` merge par rôle ; les rôles absents du localStorage conservent leurs defaults (avec CP-2/CP-3).

**Instruction explicite du demandeur : NE PAS toucher `RolesAccessPage` avant validation.**

Travail estimé quand débloqué :
1. Étendre `RoleId` à 7 valeurs (+ `accountant`, `revenue`).
2. Ajouter les 2 entrées dans `ROLES[]` + `DEFAULT_MATRIX`.
3. Resynchroniser `DEFAULT_MATRIX` avec `DEFAULT_PERMISSIONS` (manager/receptionist ont divergé lors de R4).

---

## 5. Points de vigilance / reprise

- **Migrations à appliquer en remote** (pas fait par cette session).
- **Recette manuelle UI** non effectuée (impersonation réelle par rôle dans l'app) — la recette est automatisée (vitest) au niveau logique. Si une validation visuelle est requise, lancer l'app et impersonner chaque rôle.
- `session.role` est `string | null` (rôle DB brut) — normalisé en interne par `hasPermission`. Ne jamais comparer `session.role` à une string de rôle dans les composants.
- Fichiers **explicitement hors périmètre** (ne pas mélanger) : `UsersPage`, `HousekeepingPages`, `ConfigSections1to7`, `settingsDiagnosticEngine`.

---

## 6. Commits de la branche

```
f35f45e test(R4): recette complète — 93 tests Topbar + matrice RBAC
07dbe66 feat(R4): filtrage navigation Topbar par capability (Étape B)
b3cb6bc feat(R4): gouvernance des rôles — migrations DB + alignement frontend
31a7958 docs(r4): plan d'implémentation gouvernance des rôles (avant validation)
8c18828 docs(r4): rapport gouvernance des rôles — inventaire exhaustif + modèle cible
```

Tout est poussé sur `origin/claude/friendly-mayer-6t5Th`. **Aucune PR créée** (pas demandé).
