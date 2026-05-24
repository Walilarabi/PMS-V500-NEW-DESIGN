# Module Paramètres — Guide utilisateur et architecture

Module FLOWTYM permettant la configuration complète du PMS (65 pages, 10
domaines fonctionnels).

## Pour les utilisateurs

### Navigation rapide

| Raccourci | Action |
|---|---|
| `⌘ K` / `Ctrl K` | Ouvrir la palette de recherche globale |
| `↑` `↓` | Naviguer dans les résultats |
| `Entrée` | Ouvrir la page sélectionnée |
| `Échap` | Fermer la palette / une modale |

### 10 domaines

1. **Vue d'ensemble** — Diagnostic global + alertes
2. **Établissement** — Hôtel, taxes, langues, branding, multi-hôtels
3. **Chambres & inventaire** — Typologies, chambres physiques, virtuelles, étages
4. **Tarifs & prestations** — Plans tarifaires, saisons, conditions, produits
5. **Finance & facturation** — Numérotation, fiscalité, comptabilité, debtors
6. **Distribution & OTA** — Connecteurs, channel managers, mappings, parité
7. **Housekeeping** — Statuts, checklists, staff, maintenance
8. **Automation & IA** — Règles tactiques, garde-fous, autopilot
9. **Réservations** — Conditions annulation, garanties, no-show, templates email
10. **Sécurité & administration** — Utilisateurs, rôles, audit, santé système

### Parcours critiques

#### Créer une chambre virtuelle (adjacentes / suite composée)

1. **Paramètres → Chambres & inventaire → Types de chambres**
2. Cliquer sur **« Créer une chambre virtuelle »**
3. Choisir un preset (Deux chambres adjacentes, Chambres communicantes, etc.)
4. Sélectionner les chambres physiques composantes
5. Choisir le mode (toutes requises / une suffit)
6. Valider — la chambre apparaît avec un badge bleu *« Virtuelle »*

#### Importer des plans tarifaires Excel (Folkestone / D-EDGE)

1. **Paramètres → Tarifs & prestations → Plans tarifaires**
2. Cliquer sur **« Importer Excel »** et sélectionner le fichier
3. Vérifier le rapport (X plans détectés, X avertissements)
4. Cliquer sur **« Intégrer les tarifs au système »**
5. Étape 2 : mapper les typologies Excel → chambres PMS (mapping auto suggéré)
6. Étape 3 : mapper les pensions (RO / BB / HB / FB / AI / Package)
7. Étape 4 : valider — rapport final créés/mis à jour/rejetés

#### Basculer entre plusieurs hôtels

1. **Paramètres → Établissement → Multi-hôtels**
2. La liste affiche tous les hôtels accessibles à votre compte
3. Cliquer sur **« Basculer »** sur l'hôtel cible
4. Toute l'app re-fetche les données sous le nouveau tenant

#### Vérifier la santé du système (Ops)

1. **Paramètres → Sécurité & administration → Santé du système**
2. KPIs visibles : erreurs runtime 24h, stockage local, compteurs métier
3. Onglet *Erreurs récentes* : stack traces + contexte par erreur
4. Onglet *Compteurs* : `rbac_denied`, `settings_sync_failed` (debug)

## Pour les développeurs

### Architecture

#### Patterns clés

- **`useConfigBlob<T>(namespace, default)`** — hook universel pour les pages
  config avec persistance localStorage + Supabase best-effort. Auto-réconcilie
  au mount depuis Supabase (source de vérité).
- **`GenericListPage<T>`** — composant générique pour les pages CRUD à plat
  (10+ pages héritent). Props `capability` (RBAC) et `supabaseSync` (persistance).
- **`usePagePermission(capability)`** — retourne `{ canRead, canWrite, canAdmin,
  DeniedBanner }`. Pattern : `if (!canRead) return <DeniedBanner />`.
- **`useAuditLogger()`** — wrapper qui injecte automatiquement l'acteur
  (userId + email + role) depuis `useAuth.session`.
- **`captureError(err, ctx)`** — propage les erreurs au ring buffer + audit
  critique. Branché sur `window.onerror` + `unhandledrejection` + ErrorBoundary.

#### Persistance

3 niveaux selon le type de donnée :

1. **Entités dédiées** (chambres virtuelles, sources events, audit log…) →
   tables Supabase spécifiques (`settings_*`)
2. **Configs simples key/value** (taxes, branding, numbering…) →
   `settings_config_blobs (hotel_id, namespace, data JSONB)`
3. **Local-only (UI préférences)** → `localStorage` sans sync

#### Sécurité

- **RBAC** : 22 capabilities (`set_users`, `set_rooms`, `rev_pricing`,
  `fin_invoice`…) × 5 rôles (admin, manager, receptionist, housekeeping, reader)
- Matrice persistée dans `settings_permissions_matrix` (write réservé aux admins)
- 35/36 pages protégées par `usePagePermission`
- AuditPage volontairement libre (consultation de l'audit ne nécessite pas
  d'élévation, c'est la transparence du système)

### Tests

149 tests unitaires. Patterns :

- **Services purs** : `safeMedian.test.ts`, `RateCalendarDedupEngine.test.ts`
  (mathématique testable sans React)
- **Hooks** : `useConfigBlob.test.ts` avec `renderHook`
- **Composants RBAC** : `permissionsService.component.test.tsx` (RTL)
- **Cmd+K palette** : `SettingsCommandPalette.test.tsx` (clavier + clic + fuzzy)

```bash
npm test                              # toute la suite
npx vitest src/services/settings/     # un dossier
```

### Migrations Supabase

Voir `/supabase/RUNBOOK.md` pour le déploiement complet.

```bash
supabase db push                                # 4 migrations Phase 5-7
supabase functions deploy trigger-backup        # Edge Functions
supabase functions deploy revoke-session
supabase functions deploy api-key-create
```

### ADRs

Voir le dossier `docs/adr/` pour les décisions architecturales :

- ADR-001 : `useConfigBlob` — pattern best-effort sync
- ADR-002 : `GenericListPage` — refactor RBAC + Supabase opt-in
- ADR-003 : Chambres virtuelles — composition côté client, cascade
  d'inventaire
- ADR-004 : RBAC — matrice statique vs dynamique
