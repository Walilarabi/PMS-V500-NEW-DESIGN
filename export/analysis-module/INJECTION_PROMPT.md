# Prompt d'injection — Module Analyse

> À coller dans l'assistant IA du **projet cible**, après avoir décompressé
> `analysis-module.zip` à la racine du projet (ou dans un dossier accessible).

---

## CONTEXTE

Je veux intégrer un module de **reporting & pilotage ("Analyse")** extrait d'un
autre projet React/TypeScript (PMS hôtelier). Le package décompressé contient :

```
analysis-module/
├── README.md                         ← doc d'intégration détaillée (lis-la)
├── INJECTION_PROMPT.md               ← ce fichier
├── sql/
│   ├── analysis_tables.sql            ← 5 tables + RLS + 2 RPC (favoris/récents/alertes)
│   └── 20260629_analytics_reports_batch1.sql  ← 4 RPC analytics_* (données rapports)
└── src/                              ← miroir d'une arborescence src/ React
    ├── pages/analysis/    (24 fichiers — vues + renderers de rapports)
    ├── services/analysis/ (5 fichiers — accès data, exports, alertes)
    ├── components/analysis/ (11 fichiers — KpiCard, DataTable, charts, insights)
    ├── hooks/analysis/    (4 fichiers — data fetching, prefs)
    └── [deps partagées] lib/supabase.ts, lib/utils.ts, hooks/use-toast.ts,
        store/configStore.ts, components/revenue/RevenueHeader.tsx
```

**Le module s'expose via UN SEUL composant** : `AnalysisLayout`, piloté par 2 props.

---

## TA MISSION

Intègre ce module dans MON projet en **l'adaptant**, pas en copiant aveuglément.
Procède dans cet ordre et **montre-moi ton plan AVANT d'écrire du code** :

### 1. Audit de compatibilité (À FAIRE EN PREMIER)
Inspecte mon projet et réponds-moi sur :
- Stack : React version ? Vite/Next/CRA ? TypeScript ? **Tailwind CSS présent ?**
  (le module est 100% stylé en classes Tailwind — sans Tailwind, aucun style.)
- Ai-je déjà : un client **Supabase** ? **@tanstack/react-query** (+ QueryClientProvider) ?
  un système de **toast** ? un store de config (Zustand) ?
- Mon alias d'import (`@/`, `~/`, chemins relatifs) ?
- Mon backend est-il **Supabase** ? Si non, signale-le : il faudra abstraire la
  couche data (les services font `supabase.from(...)` / `supabase.rpc(...)`).

Puis propose-moi un **plan d'intégration** adapté à ce que tu as trouvé, en
listant précisément les conflits/doublons potentiels.

### 2. Dépendances npm
Installe (ou vérifie présence + compatibilité de version) :
```
@supabase/supabase-js@^2.105.4  @tanstack/react-query@^5.100.6
@tanstack/react-table@^8.21.3   recharts@^3.8.1   lucide-react@^0.546.0
xlsx@^0.18.5   html2pdf.js@^0.14.0   zustand@^5.0.12
```
Assure-toi qu'un `QueryClientProvider` enveloppe l'app (requis par les hooks).

### 3. Placement des fichiers
Copie le contenu de `src/` dans le `src/` de mon projet **en préservant
l'arborescence** (les imports relatifs résolvent ainsi sans réécriture).
Adapte uniquement l'alias `@/src/...` si le mien diffère (présent dans
`RevenueHeader.tsx` → `@/src/lib/utils`).

### 4. Dépendances partagées (4 fichiers — ARBITRE avec moi)
Le module embarque 4 deps qu'il importe hors de son périmètre. **Si j'ai déjà
des équivalents, NE crée pas de doublon** — rebranche les imports du module sur
les miens. Sinon, garde ceux fournis. Détail :

| Fichier fourni | Usage réel par le module | Reco |
|---|---|---|
| `lib/supabase.ts` (+ `supabase.types.ts`) | Importe `{ supabase }`, fait `(supabase as any)` partout → **pas besoin du typage `Database`** | Pointe sur MON client si j'en ai un |
| `lib/utils.ts` | helper `cn()` (clsx+tailwind-merge) | Réutilise le mien si présent |
| `hooks/use-toast.ts` | seule la fonction `toast()` est utilisée | Rebranche sur mon toast si présent |
| `store/configStore.ts` | **lit UNIQUEMENT `s.hotel?.name`** (300 lignes surdimensionnées) | Stub minimal possible : `create(() => ({ hotel: { name: 'Mon Hôtel' } }))` |
| `components/revenue/RevenueHeader.tsx` | en-tête de page | Remplace par le mien si je veux |

### 5. Base de données
Si mon backend est Supabase :
- Exécute `sql/analysis_tables.sql` (5 tables + RLS + 2 RPC) **APRÈS** avoir
  réglé son prérequis : la fonction `public.get_user_hotel_id() RETURNS uuid`.
  - Multi-tenant → crée cette fonction (UUID de l'hôtel du user courant).
  - **Mono-tenant** → remplace dans le SQL tous les
    `hotel_id = public.get_user_hotel_id()` par ma logique (ex. `true` ou un
    filtre `auth.uid()`), et adapte/retire `hotel_id` si je n'en ai pas.
- Exécute `sql/20260629_analytics_reports_batch1.sql` (4 RPC qui alimentent les
  rapports chart) — **après** avoir adapté les noms de tables (voir §6).

Si mon backend N'EST PAS Supabase : abstrais `services/analysis/*` derrière une
interface data (une fonction `loadReport(ctx)` que je branche sur mon API), et
réimplémente `report-prefs.service.ts` / `alerts.service.ts` sur mon stockage.

### 6. ⚠️ Couche de données des rapports (LE POINT CLÉ)
Le module contient **130 définitions de rapports** mais les données viennent
d'une **convention RPC** : le rapport `51010` appelle `analytics_51010(p_start_date,
p_end_date, p_granularity, p_comparison)`. **Si la RPC n'existe pas → rapport vide
+ warning console** (fallback prévu, non bloquant).

- Le SQL fourni n'implémente que **4 rapports** (21008, 51010, 51060, 54002), et
  ces RPC sont écrites pour le schéma du projet source (tables `reservations`,
  `guests`, `rooms`, `room_types` avec des colonnes précises). **Tu DOIS adapter
  ces requêtes aux noms de tables/colonnes de MON schéma**, sinon elles
  échoueront. Inspecte mon schéma et réécris les `SELECT` en conséquence.
- Pour les autres rapports : ils s'afficheront vides tant que je ne fournis pas
  les RPC `analytics_<id>` correspondantes (ou des loaders via
  `registerLoader()` / `registerMockLoader()` — voir `report-data.service.ts`).
- **Fonctionne immédiatement sans RPC analytics** : navigation, bibliothèque,
  favoris, récents, vues sauvegardées, centre d'alertes KPI (dès que les 5
  tables `analysis_*` existent).

### 7. Câblage du point d'entrée
Monte `AnalysisLayout` dans mon routeur. Il gère 6 sous-vues via `activePage` :
```tsx
import { AnalysisLayout } from '@/src/pages/analysis/AnalysisLayout';

// activePage ∈ 'analysis' | 'analysis_library' | 'analysis_favorites'
//            | 'analysis_recent' | 'analysis_saved' | 'analysis_alerts'
<AnalysisLayout activePage={page} onNavigateSubPage={(p) => setPage(p)} />
```
Adapte à mon système de routing (React Router, Next, state interne…).

### 8. Vérification finale (montre-moi les résultats)
- [ ] `tsc --noEmit` / build passe sur les fichiers du module.
- [ ] La page Analyse s'affiche, navigation entre les 6 sous-vues OK.
- [ ] Tailwind applique bien les styles (pas d'écran "nu").
- [ ] Favoris / Récents / Vues / Alertes persistent (tables `analysis_*`).
- [ ] Au moins 1 rapport chart (ex. 51010) affiche des données réelles après
      adaptation de sa RPC à mon schéma.
- [ ] Console sans erreur bloquante (les warnings "RPC analytics_xxx non
      implémentée" sont attendus pour les rapports non encore branchés).

---

## RÈGLES
- **Ne casse rien d'existant** : en cas de doublon (toast, supabase, utils…),
  rebranche sur l'existant plutôt que d'écraser.
- **Adapte les requêtes SQL à MON schéma** — ne déploie pas les RPC analytics
  telles quelles sans avoir vérifié mes noms de tables/colonnes.
- **Demande-moi avant** toute décision structurante (alias, suppression d'une
  dep partagée, logique de scoping mono/multi-tenant).
- Lis `README.md` du package pour le détail complet.
