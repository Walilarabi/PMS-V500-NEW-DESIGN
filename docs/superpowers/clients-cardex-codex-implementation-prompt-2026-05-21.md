# PROMPT POUR CODEX – DÉVELOPPEMENT COMPLET DU MODULE CLIENTS FLOWTYM

```markdown
Tu es un développeur full‑stack senior spécialisé dans les PMS hôteliers et les systèmes CRM multi‑tenant. Tu as déjà livré des modules clients pour Mews, Apaleo et Oracle Opera. Ta mission est de **développer entièrement le module Clients de Flowtym** sur la base de l’audit et du cahier des charges fournis.

## CONTEXTE

Le module Clients est le cœur du CRM hôtelier de Flowtym. Il doit être **100% fonctionnel**, **câblé avec tous les autres modules** (Réservations, Finance, Housekeeping, SAS, Marketing) et **prêt pour la production**.

Tu disposeras de :
- L’audit complet (forces, faiblesses, lacunes)
- Le cahier des charges technique (schéma BDD, API, composants, store)
- Les règles métier critiques

## LIVRABLE ATTENDU

Tu dois générer **l’intégralité du code** du module Clients dans une réponse unique, structurée comme suit :

### 1. Schéma PostgreSQL (Prisma)
- Tables : `customers`, `customer_preferences`, `customer_tags`, `customer_segments`, `customer_incidents`, `customer_documents`, `customer_communications`, `customer_duplicates`, `gdpr_consent`
- Index, contraintes, RLS multi‑tenant
- Seed initial (données de démonstration)

### 2. Backend NestJS
- **Controllers** : CRUD clients, recherche avancée, fusion doublons, anonymisation, export
- **Services** : `CustomerService`, `CustomerMergeService`, `CustomerSearchService`, `GdprService`
- **DTOs** avec validation Zod
- **Guards** : JWT + RBAC
- **Events** : `customer.created`, `customer.updated`, `customer.merged`, `customer.anonymized`
- **Workers** (BullMQ) : détection automatique des doublons (job quotidien), calcul du score de fidélité (rolling 12 mois)

### 3. Frontend React
- **Pages** : `CustomersPage` (layout principal avec sidebar)
- **Composants** :
  - `CustomerList` (tableau avec virtualisation TanStack Virtual)
  - `CustomerDrawer` (fiche client 10 onglets)
  - `CustomerMergeWizard` (fusion de doublons)
  - `CustomerAnonymizeModal` (RGPD)
  - `CustomerTagsManager` (gestion tags)
  - `CustomerSegmentBuilder` (segments dynamiques)
  - `CustomerSearchBar` (recherche full‑text avec debounce)
- **Store Zustand** : état des filtres, cache, vues sauvegardées
- **Hooks personnalisés** : `useCustomers`, `useCustomer`, `useCustomerMerge`

### 4. Intégration avec les autres modules
- **Réservations** : auto‑complétion client, pré‑remplissage formulaire
- **Finance** : affichage des factures dans l’onglet “Facturation”
- **Housekeeping** : transmission des préférences client (chambre calme, étage élevé)
- **SAS** : détection client existant lors de l’import OTA
- **Marketing** : webhooks `customer.segment.updated` → déclenche campagne email

### 5. Règles métier critiques (implémentées)
- Un client peut être anonymisé mais **jamais supprimé** (conservation des écritures fiscales)
- Détection automatique des doublons (job quotidien) basée sur email, téléphone, nom + prénom
- Score de fidélité calculé automatiquement (rolling 12 mois) : `(nb séjours * 20) + (CA total / 100)`
- Consentement marketing obligatoire pour toute communication commerciale
- Export RGPD : génération fichier JSON de toutes les données client

### 6. UI / UX (moderne, épurée, minimaliste)
- Icônes : **Lucide React** (stroke width 1.5, taille 18px)
- Couleurs : blanc (#FFFFFF), gris clair (#F8FAFC), bleu marine (#1E3A5F) pour les accents
- Typographie : Inter (sans‑serif)
- Composants : shadcn/ui (Card, Drawer, Table, Dialog, Tabs, Badge)
- Responsive : desktop d’abord, adapté tablette

## CONTRAINTES TECHNIQUES

| Couche | Technologie |
|--------|-------------|
| Backend | NestJS + Prisma + PostgreSQL + Redis + BullMQ |
| Frontend | React 18 + TypeScript + Tailwind + Zustand + TanStack Query + TanStack Virtual |
| Validation | Zod |
| UI | shadcn/ui + Lucide Icons |
| Auth | JWT + RBAC |
| Multi‑tenant | Isolation par `tenant_id` + RLS PostgreSQL |

## FICHIERS À GÉNÉRER (liste exhaustive)

```text
backend/
├── src/
│   ├── modules/
│   │   └── customers/
│   │       ├── controllers/
│   │       │   ├── customers.controller.ts
│   │       │   └── customers.search.controller.ts
│   │       ├── services/
│   │       │   ├── customers.service.ts
│   │       │   ├── customers.merge.service.ts
│   │       │   ├── customers.search.service.ts
│   │       │   └── gdpr.service.ts
│   │       ├── dto/
│   │       │   ├── create-customer.dto.ts
│   │       │   ├── update-customer.dto.ts
│   │       │   ├── search-customers.dto.ts
│   │       │   └── merge-customers.dto.ts
│   │       ├── guards/
│   │       │   └── customers.guard.ts
│   │       ├── workers/
│   │       │   ├── duplicate-detection.worker.ts
│   │       │   └── loyalty-score.worker.ts
│   │       └── customers.module.ts
│   └── prisma/
│       └── schema.prisma (tables customers)
│
frontend/
├── src/
│   ├── modules/
│   │   └── customers/
│   │       ├── pages/
│   │       │   └── CustomersPage.tsx
│   │       ├── components/
│   │       │   ├── CustomerList.tsx
│   │       │   ├── CustomerDrawer.tsx
│   │       │   ├── CustomerMergeWizard.tsx
│   │       │   ├── CustomerAnonymizeModal.tsx
│   │       │   ├── CustomerTagsManager.tsx
│   │       │   ├── CustomerSegmentBuilder.tsx
│   │       │   └── CustomerSearchBar.tsx
│   │       ├── stores/
│   │       │   └── customers.store.ts
│   │       ├── hooks/
│   │       │   ├── useCustomers.ts
│   │       │   ├── useCustomer.ts
│   │       │   └── useCustomerMerge.ts
│   │       └── types/
│   │           └── customers.types.ts
│   └── services/
│       └── api/
│           └── customers.api.ts
```

## FORMAT DE RÉPONSE

Génère une réponse unique avec tous les fichiers dans des blocs de code délimités.

Exemple :
```sql
-- prisma/schema.prisma
...
```

```typescript
// backend/src/modules/customers/controllers/customers.controller.ts
...
```

```tsx
// frontend/src/modules/customers/pages/CustomersPage.tsx
...
```

## CONTRAINTES DE QUALITÉ

- TypeScript strict (pas de `any`)
- Gestion d’erreur exhaustive (try/catch, logging)
- Tests unitaires pour les services critiques (customer merge, duplicate detection)
- Documentation JSDoc pour les fonctions complexes

## PROCHAINES ÉTAPES (après génération)

Une fois le code généré, je l’intégrerai dans le monorepo et je le testerai avec les modules adjacents (Réservations, Finance).

**Génère maintenant le code complet du module Clients.**
```
