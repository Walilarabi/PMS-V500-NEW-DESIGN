# Flowtym Settings Module Phase 1 Design

## 1. Analyse du besoin

Le module Paramètres doit devenir le centre de configuration complet de Flowtym PMS. Le cahier des charges couvre l'établissement, le multi-hôtels, l'inventaire, les tarifs, la finance, la fiscalité France 2026, le housekeeping, la synchronisation PMS, les API/webhooks, les connecteurs, les utilisateurs/droits, l'automatisation, les notifications, le RGPD, l'audit et les sauvegardes.

L'existant contient déjà tous les `PageId` `settings_*` et la navigation latérale complète dans `Sidebar.tsx`, mais `App.tsx` route uniquement `settings` vers `SettingsView`. Le composant `Configuration` actuel est partiel et regroupe seulement quelques onglets.

La Phase 1 rend le module complet navigable et exploitable en UI, sans encore écrire les réglages sensibles en base. Cela respecte les règles jointes : éviter une modification DB massive improvisée, préserver l'intégrité métier, garder une UX rapide, et ne pas exposer de secrets.

## 2. Risques potentiels

### Métier
- Les paramètres chambres, tarifs et fiscalité influencent les réservations, la disponibilité, la facturation et la conformité.
- Une persistance prématurée sans transactions/audit peut créer des incohérences.
- Les suppressions doivent être interdites sur les objets utilisés par des réservations futures ou des tarifs actifs.

### Sécurité
- Les sous-modules API, PMS sync, webhooks et utilisateurs manipulent secrets, rôles et droits.
- Les secrets doivent rester masqués côté UI.
- Les actions critiques exigent RBAC et audit immuable avant persistance réelle.

### Performance
- Le module est large. Un composant monolithique ralentirait le rendu et deviendrait difficile à maintenir.
- La recherche paramètres doit filtrer localement sans fetch inutile.
- Les listes doivent rester paginables/virtualisables en Phase 2.

### Architecture
- L'actuel `Configuration` est partiel et trop éloigné de l'arborescence officielle.
- La Phase 1 doit isoler les données de démonstration et la présentation pour faciliter la future persistance Supabase.

### UX
- La sidebar contient déjà tous les sous-menus ; cliquer un sous-menu doit afficher la section correspondante.
- Aucun bouton sensible ne doit faire croire qu'une action réelle a été exécutée si elle est encore simulée.

## 3. Proposition d'architecture

### Phase 1 livrée maintenant
- Modifier `App.tsx` pour router tous les `settings_*` vers `SettingsView activePage={page}`.
- Remplacer `SettingsView` par un shell de paramètres moderne, orienté sous-modules.
- Créer une configuration déclarative de sections dans `frontend/src/domains/settings/catalog.ts`.
- Créer des composants UI settings focalisés dans `frontend/src/domains/settings/SettingsModule.tsx`.
- Conserver `useConfigStore` pour les données hôtel/chambres/users existantes.
- Ajouter uniquement des actions UI non destructives : diagnostic, export simulé, sauvegarde locale.

### Phase 2 hors périmètre immédiat
- Créer `settings` repository/hooks Supabase.
- Ajouter migrations dédiées pour tables manquantes.
- Brancher progressivement hôtel, chambres, fiscalité, PMS sync, API, RBAC avec Zod, RLS et audit.

## 4. Solution recommandée

Implémenter Phase 1 comme un module UI complet et modulaire :
- Overview avec KPIs et alertes.
- Une page par `PageId` settings.
- Tables et fiches synthétiques pour les sous-modules listés dans le cahier des charges.
- États de conformité visibles mais non destructifs.
- Secrets masqués.
- Messages indiquant qu'une persistance durable sera branchée en Phase 2.

Cette approche donne rapidement un module complet utilisable, tout en évitant de compromettre les règles de sécurité, d'audit et de multi-tenant.

## 5. Optimisations possibles

- Lazy-load par familles de paramètres si le bundle augmente trop.
- Virtualiser les tables chambres/utilisateurs/audit si elles dépassent 100 lignes.
- Ajouter une recherche client-side mémorisée par `useMemo`.
- Préparer `domains/settings/repository.ts` avec `select` explicites, pagination et RLS en Phase 2.
- Ajouter optimistic save avec rollback lorsque les endpoints settings seront disponibles.

## 6. Critères d'acceptation Phase 1

- Tous les `PageId` `settings_*` affichent une section spécifique, plus de placeholder global.
- La vue d'ensemble contient les cartes et alertes du cahier des charges.
- Les sections principales du plan sont représentées : établissement, multi-hôtels, inventaire, tarifs, finance, fiscalité, housekeeping, PMS sync, API, connecteurs, utilisateurs, automatisations, notifications, RGPD, import/export, audit, sauvegardes.
- La navigation existante reste inchangée.
- `npm run build` depuis `/workspace` passe.
- Aucun secret réel n'est ajouté au code.
- Aucun accès DB critique nouveau n'est introduit en Phase 1.
