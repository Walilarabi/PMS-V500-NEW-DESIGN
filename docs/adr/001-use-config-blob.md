# ADR-001 — `useConfigBlob<T>` : pattern best-effort sync localStorage ↔ Supabase

**Date** : 2026-05-24
**Statut** : Accepté
**Contexte** : Phase 5 — module Paramètres

## Problème

Le module Paramètres compte ~40 pages avec persistance. Trois exigences :

1. **UX instantanée** — écrire localement sans attendre le réseau
2. **Multi-tenant** — synchroniser avec Supabase pour partage entre devices
3. **Robustesse offline** — l'app doit rester utilisable sans connexion

Les approches naïves :
- Tout en localStorage → pas de multi-device, pas de tenant isolation
- Tout en Supabase synchrone → UI bloque sur le réseau, échec si offline
- React Query / TanStack Query → trop lourd pour ~20 configs simples key/value

## Décision

Implémenter un hook unique `useConfigBlob<T>(namespace, default)` avec pattern
**"best-effort sync"** :

1. Lecture initiale **synchrone localStorage** (rendu instantané)
2. Au mount, **fetch Supabase en background** ; si remote existe, on l'applique
   (Supabase = source de vérité finale)
3. À chaque `setX`, écriture **immédiate localStorage** + sync Supabase
   **best-effort** (async, ne bloque pas, log si échec)
4. Une **table générique** `settings_config_blobs (hotel_id, namespace,
   data JSONB)` côté Supabase évite une table par module

## Conséquences

### Positives
- Pages migrées en 30 min chacune (1 hook, 1 import)
- App reste utilisable offline (mode dégradé local-only)
- 1 seule table Supabase pour ~10 configs simples (vs 10 tables)
- Tests unitaires triviaux (mock du service Supabase)

### Négatives
- **Pas de conflit resolution** — si deux devices écrivent simultanément,
  le dernier gagne (acceptable pour des configs paramètres faibles fréquence)
- **Pas de validation schema** côté DB — le blob est `JSONB` libre.
  Mitigation : Zod schemas côté client pour les configs critiques (à faire)

### Acceptées comme dette
- L'audit côté serveur ne voit pas les changements locaux tant que le sync
  Supabase n'a pas eu lieu. Mitigation : retry transparent au prochain mount.

## Alternatives considérées

- **TanStack Query + Supabase Realtime** : trop lourd, broadcast inutile
  pour des configs paramètres
- **Yjs / CRDT** : overkill, conflits rarissimes sur ce périmètre
- **Custom protocol avec versioning** : à reconsidérer en Phase 8 si besoin
  de conflict resolution réelle

## Implémentation

- `frontend/src/hooks/settings/useConfigBlob.ts` (98 lignes)
- `frontend/src/services/settings/settingsPersistence.ts` (helpers async)
- Migration : `supabase/migrations/20260526_settings_config_blobs.sql`

## Pages utilisatrices (au 2026-05-26)

LanguagesPage, BrandingPage, NumberingPage, PaymentModesPage,
NotificationsPage, ApiKeysPage, BackupsPage, RgpdPage, InvoicePage, +
~22 instances via `GenericListPage.supabaseSync` (ProductsPage,
SeasonsPage, ConditionsPage, etc.).
