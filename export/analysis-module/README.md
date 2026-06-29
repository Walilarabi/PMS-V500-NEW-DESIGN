# Module Analyse — Package d'extraction

Extrait de **FLOWTYM PMS** pour injection dans un autre projet React/TypeScript.

Module de reporting & pilotage : bibliothèque de rapports, favoris, récents,
vues sauvegardées, centre d'alertes KPI, cockpit direction, daily briefing.

---

## 1. Contenu du package

```
analysis-module/
├── README.md                  ← ce fichier
├── sql/
│   └── analysis_tables.sql     ← schéma DB autonome (5 tables + 2 RPC + RLS)
└── src/                        ← miroir de l'arborescence src/ d'origine
    ├── pages/analysis/         ← 24 fichiers — vues + renderers de rapports
    ├── services/analysis/      ← 5 fichiers — accès données, exports, alertes
    ├── components/analysis/    ← 11 fichiers — KpiCard, DataTable, charts, insights
    ├── hooks/analysis/         ← 4 fichiers — data fetching, prefetch, prefs sync
    │
    └── [DÉPENDANCES PARTAGÉES — voir §4, supprimables si déjà présentes]
        ├── lib/supabase.ts         lib/supabase.types.ts   lib/utils.ts
        ├── hooks/use-toast.ts
        ├── store/configStore.ts
        └── components/revenue/RevenueHeader.tsx
```

**~44 fichiers cœur + 6 fichiers de dépendances partagées.**

> L'arborescence `src/` est **préservée à l'identique** : tous les imports
> relatifs (`../../lib/supabase`, `../../../../components/analysis/KpiCard`…)
> résolvent sans aucune réécriture si tu déposes le contenu de `src/` dans
> le `src/` de ton projet cible.

---

## 2. Point d'entrée unique

Le module s'expose via **un seul composant** : `AnalysisLayout`.

```tsx
import { AnalysisLayout } from '@/src/pages/analysis/AnalysisLayout';

<AnalysisLayout
  activePage={page}                       // voir page IDs ci-dessous
  onNavigateSubPage={(p) => setPage(p)}    // callback navigation interne
/>
```

### Page IDs (6)

```ts
type AnalysisPage =
  | 'analysis'            // Dashboard / vue d'ensemble
  | 'analysis_library'    // Bibliothèque (119 rapports)
  | 'analysis_favorites'  // Favoris
  | 'analysis_recent'     // Récents
  | 'analysis_saved'      // Vues sauvegardées
  | 'analysis_alerts';    // Centre d'alertes KPI
```

### Câblage type (extrait de l'App d'origine)

```tsx
const AnalysisLayout = lazy(() => import('@/src/pages/analysis/AnalysisLayout'));

switch (page) {
  case 'analysis':
  case 'analysis_library':
  case 'analysis_favorites':
  case 'analysis_recent':
  case 'analysis_saved':
  case 'analysis_alerts':
    return <AnalysisLayout activePage={page} onNavigateSubPage={setPage} />;
}
```

---

## 3. Dépendances npm

À installer dans le projet cible (versions testées en production FLOWTYM) :

```jsonc
{
  "@supabase/supabase-js": "^2.105.4",
  "@tanstack/react-query":  "^5.100.6",   // QueryClientProvider requis à la racine
  "@tanstack/react-table":  "^8.21.3",
  "recharts":               "^3.8.1",
  "lucide-react":           "^0.546.0",
  "xlsx":                   "^0.18.5",     // export Excel des rapports
  "html2pdf.js":            "^0.14.0",     // export PDF des rapports
  "zustand":                "^5.0.12"      // utilisé par configStore (voir §4)
}
```

**Prérequis runtime :**
- React 18+ et un `QueryClientProvider` (`@tanstack/react-query`) monté à la racine.
- **Tailwind CSS** — tout le styling est en classes utilitaires Tailwind.
  Si le cible n'a pas Tailwind, les composants s'afficheront sans style.
- Un système de toast branché sur l'event `app-toast` OU le `toast()` fourni
  (voir §4).

---

## 4. Dépendances partagées (4 fichiers — à arbitrer)

Le module importe 4 éléments hors de son périmètre. Ils sont **inclus** dans
`src/` pour un package autosuffisant. **Si ton projet cible possède déjà des
équivalents, supprime ces fichiers et ajuste les imports.**

| Fichier inclus | Rôle | Surface réellement utilisée |
|---|---|---|
| `lib/supabase.ts` (+ `supabase.types.ts`) | Client Supabase | Le module importe seulement `{ supabase }` et fait `(supabase as any)` partout → **le typage `Database` n'est PAS requis**. Tu peux pointer ce fichier sur ton propre client. `supabase.types.ts` est joint mais non indispensable. |
| `lib/utils.ts` | Helper `cn()` (clsx/tailwind-merge) | 6 lignes. Requis par `RevenueHeader`. |
| `hooks/use-toast.ts` | Système toast | Seule la fonction `toast()` est utilisée. Remplaçable par ton propre toast. |
| `store/configStore.ts` | Store Zustand config hôtel | **Surdimensionné** : le module ne lit QUE `s.hotel?.name`. Tu peux stubber : `create(() => ({ hotel: { name: 'Mon Hôtel' } }))`. |
| `components/revenue/RevenueHeader.tsx` | En-tête de page | Header visuel. Remplaçable par le tien. |

### Variables d'environnement (si tu gardes `lib/supabase.ts` tel quel)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

(Vérifie les noms exacts dans `lib/supabase.ts` et adapte à ton bundler.)

---

## 5. Base de données (Supabase / PostgreSQL)

Exécute **`sql/analysis_tables.sql`** sur ta base. Il crée :

**5 tables** (toutes avec RLS activé) :
- `analysis_alert_watchers` — seuils de surveillance KPI
- `analysis_alert_triggers` — historique des déclenchements (inbox)
- `analysis_user_favorites` — favoris par utilisateur
- `analysis_user_recent` — rapports récemment consultés
- `analysis_saved_views` — vues + filtres sauvegardés

**2 fonctions RPC** :
- `push_user_recent(p_report_id TEXT)` — appelée par `report-prefs.service.ts`
- `evaluate_alert_watchers()` — appelée par `alerts.service.ts`

### ⚠️ Prérequis SQL : `get_user_hotel_id()`

Toutes les policies RLS et `evaluate_alert_watchers()` dépendent d'une fonction
**`public.get_user_hotel_id() RETURNS uuid`** (multi-tenant FLOWTYM) qui
**n'est PAS incluse** (helper app-wide).

- **Projet multi-hôtel :** crée cette fonction (retourne l'UUID de l'hôtel de
  l'utilisateur courant) avant d'exécuter le script.
- **Projet mono-tenant :** remplace dans `analysis_tables.sql` les
  `hotel_id = public.get_user_hotel_id()` par ta propre logique de scoping
  (ex. `true`, ou un filtre `auth.uid()`), et retire la colonne `hotel_id`
  si inutile.

---

## 6. Checklist d'intégration

- [ ] Copier le contenu de `src/` dans le `src/` du projet cible.
- [ ] Installer les deps npm (§3).
- [ ] Vérifier l'alias `@/src` (ou adapter `RevenueHeader.tsx` qui importe `@/src/lib/utils`).
- [ ] Monter un `QueryClientProvider` à la racine si absent.
- [ ] Arbitrer les 4 deps partagées (§4) : garder ou rebrancher sur les tiennes.
- [ ] Exécuter `sql/analysis_tables.sql` (après avoir réglé `get_user_hotel_id`).
- [ ] Câbler `<AnalysisLayout>` dans le routeur (§2).
- [ ] Vérifier Tailwind actif.
- [ ] Brancher le toast (`app-toast` event ou `toast()`).

---

## 7. ⚠️ Couche de données des rapports — À LIRE

C'est le point le plus important pour évaluer ce que tu reçois réellement.

Le module contient **130 définitions de rapports** (`pages/analysis/reports/registry.ts`)
et leurs renderers. **Mais les données de ces rapports ne sont PAS embarquées.**

Le chargement suit une **convention RPC** (`services/analysis/report-data.service.ts`) :

```
Pour le rapport "51.010" → appelle la RPC Supabase "analytics_51_010"
  avec (p_start_date, p_end_date, p_granularity, p_comparison)
→ si la RPC existe : affiche les lignes retournées
→ si la RPC n'existe pas : fallback "mock vide" + warning, rapport affiché vide
```

**Aucune RPC `analytics_*` n'est fournie dans `sql/analysis_tables.sql`** (il y
en a 0 dans les migrations du repo source). Concrètement :

| Tu reçois (portable, fonctionnel) | Tu dois fournir côté cible |
|---|---|
| Le **framework** complet : navigation, bibliothèque, favoris, récents, vues sauvegardées, alertes, exports Excel/PDF, renderers, charts, insights | Les **RPC `analytics_<reportId>`** qui produisent les données métier de chaque rapport, OU des loaders custom via `registerLoader()` / `registerMockLoader()` |

→ **Tel quel, les rapports s'afficheront vides** (avec un warning console
`RPC analytics_xxx non implémentée`) tant que tu n'as pas créé les RPC
correspondantes ou enregistré des loaders. Les fonctionnalités transverses
(favoris, récents, vues, alertes KPI) sont, elles, **100% fonctionnelles** dès
que les 5 tables `analysis_*` existent.

### Ce qui marche immédiatement (après §6)
- Navigation, recherche, bibliothèque de rapports (structure/catégories)
- Favoris / Récents / Vues sauvegardées (tables `analysis_*`)
- Centre d'alertes KPI (`evaluate_alert_watchers`)
- Exports Excel/PDF (sur données présentes)

### Ce qui nécessite ton backend
- Le **contenu chiffré** de chaque rapport → une RPC `analytics_<id>` par rapport
  voulu, ou un loader custom. Voir le contrat de params dans
  `report-data.service.ts` (lignes 42-74).

## 8. Notes diverses

- Le module utilise `(supabase as any)` sur les accès data → aucune dépendance
  au schéma typé complet (`supabase.types.ts` joint mais non indispensable).
- Aucun test n'est inclus (le module n'en avait pas de dédiés à l'origine).
- Les services `analysis/*` ne touchent QUE les 5 tables `analysis_*` —
  vérifié exhaustivement. Pas de dépendance cachée à d'autres tables métier.

---

*Extrait le 2026-06-29 depuis la branche `claude/modest-ramanujan-yM0ab`.*
