# ADR-002 — RBAC : matrice statique par rôle, persistée côté tenant

**Date** : 2026-05-25
**Statut** : Accepté
**Contexte** : Phase 5 — sécurité prod

## Problème

Le PMS expose ~35 pages avec mutations sensibles (CRUD users, plans
tarifaires, intégrations OTA, sauvegardes, RGPD…). Avant Phase 5, aucune
page n'avait de garde-fou — n'importe quel utilisateur authentifié
pouvait tout faire.

Exigences :

1. **5 rôles** distincts (admin, manager, receptionist, housekeeping, reader)
2. **4 niveaux** d'accès par capability (none / read / write / admin)
3. **Granularité par capability** (pas par module entier — trop grossier)
4. **Modifiable par tenant** (un hôtel peut avoir des règles différentes)
5. **Mode dev sans session** doit rester fonctionnel

## Décision

Matrice **statique en code** pour les defaults + **persistée par tenant**
côté Supabase pour les overrides.

```
PermissionsMatrix = Record<RoleId, Record<CapabilityId, AccessLevel>>
```

- 22 capabilities (`set_users`, `set_rooms`, `set_integrations`, `set_fiscal`,
  `set_backups`, `set_rgpd`, `rev_pricing`, `fin_invoice`, `fin_payment`,
  `cli_view`, etc.)
- Defaults définis dans `permissionsService.tsx` (source de vérité unique)
- Override par tenant via `settings_permissions_matrix` (RLS admin only)
- `RolesAccessPage` UI permet de modifier la matrice live
- Hook `usePermission(capability, level)` → boolean, instrumenté avec
  `captureMetric('rbac_denied', { capability, role })` à chaque refus

### Mode dev

Si `useAuth.session === null` (pas de session) → autorise tout
(`hasPermission` retourne true). Permet le dev local sans Supabase.

En prod : `RootGate` redirige vers login si pas authentifié → cette
condition n'est jamais hit.

## Conséquences

### Positives
- **35/36 pages protégées** en 1 jour
- Helper `usePagePermission(capability)` retourne tout le nécessaire
  (`canRead`, `canWrite`, `canAdmin`, `DeniedBanner`)
- Pattern partout identique → faible cognitive load
- Metrics RBAC traçables (`rbac_denied` cumulatif par capability/rôle)
- Matrice modifiable par l'admin sans redéploiement

### Négatives
- **22 capabilities, c'est statique** — ajout d'une nouvelle capability
  nécessite déploiement. Acceptable car les capabilities sont des
  invariants métier (pas des droits dynamiques par utilisateur)
- **Rôles aussi statiques** — pas de rôles custom (acceptable pour un
  PMS, pas un IAM générique)

### Risques mitigés
- **UI seule, pas de serveur** : un user peut bypass via console / API
  directe. Mitigation : RLS Supabase + Edge Functions vérifient aussi.
  Le RBAC client est une UX, pas une sécurité.

## Alternatives considérées

- **CASL / casl-mongoose** : trop générique, ajoute 50+ Ko bundle
- **Casbin policies** : overkill, syntaxe lourde
- **Permissions par utilisateur** (pas par rôle) : ne scale pas (5
  rôles × 22 caps = 110 lignes, vs N users × 22 caps = explose)

## Implémentation

- `frontend/src/services/settings/permissionsService.tsx`
- `frontend/src/pages/settings/pages/RolesAccessPage.tsx` (UI matrice)
- Migration : `supabase/migrations/20260524_settings_phase2.sql`
  (table `settings_permissions_matrix`)
