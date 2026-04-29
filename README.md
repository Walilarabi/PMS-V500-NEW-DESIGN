# Modernisation de l'interface Flowtym PMS

Cette mise à jour modernise l'interface utilisateur tout en conservant la logique métier et la technologie existante (React + Tailwind + TypeScript).

## Changements visuels globaux
- **Identité visuelle** : Utilisation stricte du violet `#8B5CF6` pour les éléments interactifs.
- **Typographie** : Intégration de la police 'Inter' pour une lisibilité maximale.
- **Rayons de courbure** : Arrondis accrus (`16px` à `24px`) pour un aspect SaaS moderne.
- **Hiérarchie** : Utilisation d'ombres portées ultra-fines (`rgba(0,0,0,0.03)`) pour séparer les plans.

## Détails par page

### 1. Planning
- **Vertical Timeline** : Intégration d'une grille interactive avec indicateur "Aujourd'hui".
- **Cartes KPIs** : Résumé des revenus prévus et taux d'occupation directement au-dessus du planning.
- **Panel Latéral** : Liste rapide des chambres avec leur statut en temps réel.

### 2. Vue du Jour (Operational Today)
- **Priorités Dynamiques** : Section dédiée aux urgences (contrôles ménage, arrivées imminentes).
- **Actions Recommandées** : Colonne intelligente dans le tableau pour accélérer les opérations.
- **Filtres Avancés** : Segmentation rapide par état de chambre.

### 3. Réservations
- **Tableau Enrichi** : Visualisation claire des canaux de distribution et statuts de paiement.
- **Suivi des paiements** : Boutons de relance intégrés pour les dossiers incomplets.
- **Statistiques clés** : Nombre de dossiers actifs et CA total en en-tête.

### 4. Clients
- **Segmentation visuelle** : Utilisation d'icônes pour identifier les segments (Business, VIP, Loisirs).
- **Fidélité** : Badges avec icônes (Gemme, Couronne, Médaille) pour les clients récurrents.
- **Analyse CLV** : Visualisation de la "Customer Lifetime Value" directement dans la liste.

### 5. Revenue (Little Yielder)
- **Gestion des Règles** : Grille de cartes configurables pour le Yield Management.
- **Indicateurs de performance** : Visualisation de l'impact estimé et de l'efficacité du Yield.
- **Garde-fous** : Affichage clair des prix planchers et plafonds.

### 6. Analyse & Rapports
- **Visualisation de données** : Intégration de graphiques Recharts (Area, Pie) pour l'évolution des revenus.
- **Classements** : Tableaux de performance par nationalité et par canal.
- **Familles de rapports** : Navigation facilitée entre Exploitation, Financier et Direction.

### 7. Finance & Caisse
- **Gestion Flux** : Suivi détaillé des entrées/sorties de la petite caisse.
- **Solde en temps réel** : KPI cards avec impact visuel sur les variations de caisse.

---
*Note : Tous les composants sont réutilisables et le layout est entièrement responsive.*
