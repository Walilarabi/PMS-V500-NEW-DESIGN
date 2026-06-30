# Prompt d'injection — Module Analyse (Reporting & Pilotage)
## Cible : projet **Checkin flowtym**

> À coller dans Claude Code (ou l'assistant IA) **ouvert dans le projet Checkin
> flowtym**, après avoir décompressé `analysis-module.zip` quelque part dans le
> projet (idéalement `tmp/import-analysis/`).

---

## CONTEXTE

J'extrais le **module Analyse** du projet **FLOWTYM PMS** (PMS hôtelier
React/Vite/TS/Supabase) pour l'injecter dans **Checkin flowtym**.

**Ce que c'est** : module de reporting & pilotage hôtelier :
- bibliothèque de 130 rapports organisés par catégorie,
- favoris / récents / vues sauvegardées (persistance Supabase par utilisateur),
- centre d'alertes KPI (watchers de seuils + inbox de déclenchements),
- cockpit direction + daily briefing,
- exports Excel/PDF.

**Particularité importante (à comprendre avant de commencer)** :
- Le module contient le **framework complet** (navigation, biblio, favoris,
  alertes, exports, renderers, charts).
- **Mais les données des rapports** viennent d'une convention RPC :
  `analytics_<reportId>(p_start_date, p_end_date, p_granularity, p_comparison)`.
- Sans ces RPC, les rapports tombent sur un **fallback "mock vide"** (écran vide
  + warning console, non bloquant).
- Le SQL fourni implémente seulement **4 rapports chart** (21008, 51010, 51060,
  54002) — les autres restent vides tant qu'on ne crée pas leurs RPC.
- **Les fonctionnalités transverses** (favoris/récents/vues/alertes) sont
  fonctionnelles dès que les 5 tables `analysis_*` existent.

**État du module Analyse dans Checkin** : à découvrir — peut-être absent,
peut-être présent en squelette. Tu auditeras à l'étape 1.

**Stack/infra Checkin** : à découvrir aussi.

Package décompressé dans `tmp/import-analysis/` :
- `README.md` — doc d'intégration détaillée (LIS-LA en premier, surtout §7 sur
  la couche de données).
- `INJECTION_PROMPT.md` — version générique du prompt (réf).
- `INJECTION_PROMPT_CHECKIN.md` — **CE FICHIER, le prompt spécifique Checkin**.
- `src/` — 50 fichiers, arborescence à préserver.
- `sql/` :
  - `analysis_tables.sql` — 5 tables + RLS + 2 RPC (favoris/récents/alertes)
  - `20260629_analytics_reports_batch1.sql` — 4 RPC `analytics_*` (rapports chart
    alimentés)

---

## TA MISSION

Intègre ce module dans Checkin. **Procède dans cet ordre et MONTRE-MOI TON PLAN
AVANT d'écrire du code.**

---

### ÉTAPE 1 — Audit Checkin (OBLIGATOIRE EN PREMIER)

Inspecte le projet Checkin et réponds factuellement :

**A. Stack technique**
- React version ? Vite / Next / autre ?
- TypeScript ? **Tailwind CSS** (obligatoire — sans lui, aucun style) ?
- Alias d'import : `@/...` → racine ? autre forme ?

**B. Briques infra présentes (4 deps tirées par ce module)**

Pour CHACUNE, dis-moi si Checkin l'a déjà :

| Brique | Action si présente → si absente |
|---|---|
| Client **Supabase** (`lib/supabase` ou équivalent) | rebrancher → garder celle du package |
| **@tanstack/react-query** + `QueryClientProvider` à la racine | utiliser l'existante → installer + monter |
| Système de **toast** (sonner, react-hot-toast, custom…) — le module utilise `toast({...})` depuis `hooks/use-toast.ts` | rebrancher les usages → garder celle du package |
| Helper `cn()` (clsx + tailwind-merge) | rebrancher → garder |
| Store de config hôtel (Zustand ou équivalent) — le module ne lit QUE `s.hotel?.name` | rebrancher sur ton store → stub minimal possible (`create(() => ({ hotel: { name: 'Mon Hôtel' } }))`) |
| `RevenueHeader` (en-tête de page) | utiliser l'équivalent Checkin (ex. `PageHeader`) → garder |

**C. Backend**
- Checkin utilise-t-il **Supabase** ? Même projet que FLOWTYM PMS, ou un autre
  projet Supabase distinct ?
- Est-ce **multi-tenant** (`get_user_hotel_id()` requis) ou **mono-tenant** ?
- Si autre backend que Supabase : la couche DB est dans `services/analysis/*.ts`
  → il faudra l'abstraire derrière l'API de Checkin (et réimplémenter les RPC
  `analytics_*` ou les loaders custom via `registerLoader()`).

**D. Module Analyse existant**
- Vérifie si un module Analyse / Reporting / Rapports existe déjà dans Checkin
  (`src/pages/analysis/`, `src/modules/reports/`, `src/features/analytics/`…).
- S'il existe : que contient-il ? Routes ? Composants ? Squelette vide ?
- Si rien : on créera la route from scratch.

**E. Schéma DB côté Checkin (pour adapter les RPC analytics)**
Si Checkin est sur Supabase et a déjà un schéma PMS, liste-moi les tables qui
pourraient alimenter les rapports : `reservations`, `guests` (ou `customers`),
`rooms`, `room_types`, `invoices`, etc. Note les **noms exacts** des colonnes
clés (dates check-in/check-out, montants, segments, status). On en aura besoin
à l'étape 5 pour adapter les RPC.

**Présente le résultat sous forme de tableau / liste claire, et propose-moi un
PLAN D'INTÉGRATION ordonné (étapes, fichiers touchés, points qui nécessitent
ma décision). N'écris aucun code avant validation de ce plan.**

---

### ÉTAPE 2 — Dépendances npm

Installe (ou vérifie versions compatibles) :
```
@supabase/supabase-js@^2.105.4    @tanstack/react-query@^5.100.6
@tanstack/react-table@^8.21.3     recharts@^3.8.1
lucide-react@^0.546.0             xlsx@^0.18.5
html2pdf.js@^0.14.0               zustand@^5.0.12
```
Vérifie : Tailwind actif + QueryClientProvider monté à la racine.

---

### ÉTAPE 3 — Placement des fichiers

Copie `tmp/import-analysis/src/` dans le `src/` de Checkin **en préservant
l'arborescence**. Les imports relatifs et `@/src/...` résoudront sans réécriture.

- Adapte l'alias `@` si différent dans Checkin (recherche-remplace global).
- **N'écrase JAMAIS** un fichier existant de Checkin sans m'avoir consulté.

---

### ÉTAPE 4 — Arbitrage deps infra (sensible)

Pour chacune des 6 briques infra embarquées dans le package (cf. Étape 1 §B) :

- **Checkin l'a déjà** → ne copie PAS celle du package. Soit :
  - laisse le fichier du package mais réécris ses imports pour pointer sur la
    version Checkin,
  - OU supprime le fichier du package et corrige les imports dans les fichiers
    métier qui le référencent.

- **Checkin ne l'a pas** → garde la version du package.

**Cas spéciaux à signaler :**
- `store/configStore.ts` (300 lignes) : **surdimensionné** — le module ne lit
  QUE `s.hotel?.name`. Si Checkin n'a pas de store config, propose-moi un stub
  minimal de 5 lignes au lieu de copier les 300.
- `lib/supabase.types.ts` (324 lignes) : **non requis** — le module fait
  `(supabase as any)` partout. Tu peux le supprimer dans tous les cas.
- `components/revenue/RevenueHeader.tsx` : un en-tête générique. Si Checkin a
  déjà un `PageHeader`, propose de le réutiliser.

**Liste-moi précisément ce que tu vas supprimer / rebrancher AVANT de le
faire, et attends ma validation.**

---

### ÉTAPE 5 — Base de données

#### 5a. Prérequis multi-tenant

Vérifie `public.get_user_hotel_id()` côté Supabase Checkin :
```sql
SELECT proname FROM pg_proc WHERE proname = 'get_user_hotel_id';
```
- **Multi-tenant + fonction présente** → continue.
- **Multi-tenant sans la fonction** → crée-la (retourne l'UUID hôtel du user
  courant).
- **Mono-tenant** → adapte les SQL : remplace `hotel_id = public.get_user_hotel_id()`
  par ta logique (ex. `true`, filtre `auth.uid()`), et retire la colonne
  `hotel_id` si elle n'a pas de sens.

#### 5b. Déploie les tables `analysis_*`

Utilise `apply_migration` (et non `execute_sql`) du MCP Supabase pour la
traçabilité :
- `sql/analysis_tables.sql` → crée 5 tables + RLS + 2 RPC
  (`push_user_recent`, `evaluate_alert_watchers`).

→ **Dès ce point, les fonctionnalités transverses fonctionnent** : favoris,
récents, vues sauvegardées, centre d'alertes. La biblio des 130 rapports
s'affiche, navigation OK, mais les rapports affichent un état vide.

#### 5c. ⚠️ RPC `analytics_*` (LE POINT CLÉ — adapte au schéma Checkin)

Le fichier `sql/20260629_analytics_reports_batch1.sql` contient 4 RPC écrites
pour le schéma de FLOWTYM PMS (`reservations.check_in/check_out/nights/
total_amount/segment/status/room_type/guest_id`, `guests.country/nationality`,
`rooms.room_type_code`, `room_types.room_type_code/capacity`).

**Avant d'appliquer ce SQL, INSPECTE le schéma de Checkin (Étape 1 §E) et
réécris les `SELECT` selon les noms réels de colonnes** :
- noms des tables (`reservations` vs `bookings` ? `guests` vs `customers` ?)
- noms des colonnes (`check_in` vs `arrival_date` ? `total_amount` vs `total` ?
  `segment` vs `market_segment` ?)
- valeurs statut (`'cancelled'`, `'no_show'` — adapte aux valeurs Checkin)

**Si Checkin n'a pas encore ces tables PMS** : signale-le-moi. Les rapports
resteront vides mais le framework fonctionnera. On câblera plus tard.

**Si tu adaptes les 4 RPC** : applique-les via `apply_migration` après audit.
Sinon : ne déploie PAS ce SQL tel quel, il échouera.

#### 5d. Autres rapports (les 126 restants)

Ils tombent sur le fallback mock vide tant qu'on ne crée pas leur RPC ou ne
les branche pas via `registerLoader()` dans `report-data.service.ts`. **Hors
scope de cette injection initiale** — à faire au fur et à mesure.

---

### ÉTAPE 6 — Câblage du module Analyse dans Checkin

Le module s'expose via **UN SEUL composant** : `AnalysisLayout`.

```tsx
import { AnalysisLayout } from '@/src/pages/analysis/AnalysisLayout';

<AnalysisLayout
  activePage={page}                       // l'une des 6 page IDs ci-dessous
  onNavigateSubPage={(p) => setPage(p)}    // callback nav interne
/>
```

**Page IDs (6)** :
```
'analysis'             // Dashboard
'analysis_library'     // Bibliothèque (130 rapports)
'analysis_favorites'   // Favoris
'analysis_recent'      // Récents
'analysis_saved'       // Vues sauvegardées
'analysis_alerts'      // Centre d'alertes KPI
```

**Câblage** :
1. Localise le module Analyse de Checkin (Étape 1 §D). S'il n'existe pas,
   crée un dossier `src/pages/analysis/` ou équivalent (selon convention
   Checkin).
2. Ajoute la route principale → rend `<AnalysisLayout activePage={page}
   onNavigateSubPage={...} />`.
3. Adapte au système de routing de Checkin (React Router, Next App Router,
   state interne…).
4. Si Checkin a un menu latéral / nav globale, ajoute une entrée "Analyse"
   pointant sur ces 6 sous-pages.

---

### ÉTAPE 7 — Vérification finale

Lance et montre-moi le résultat de :

- [ ] `npm install` propre.
- [ ] `tsc --noEmit` (ou équivalent) : 0 erreur sur les fichiers du module.
- [ ] `npm run build` réussit.
- [ ] L'app démarre, la route `/analysis` charge sans erreur console.
- [ ] **Bibliothèque** : les 130 rapports s'affichent par catégorie, recherche
      fonctionne.
- [ ] **Favoris / Récents / Vues / Alertes** : sous-vues accessibles,
      persistance OK (clic favori → reload → toujours là).
- [ ] Si 5c appliqué : ouvre l'un des 4 rapports (21008, 51010, 51060, 54002),
      sélectionne une plage, **vérifie que des données réelles s'affichent**.
- [ ] Tailwind appliqué (pas d'écran nu).
- [ ] Exports Excel/PDF fonctionnels sur un rapport (test rapide).
- [ ] Console : pas d'erreur bloquante. Les warnings "RPC analytics_xxx non
      implémentée" sont **attendus** pour les 126 rapports non câblés.

Si une étape échoue, montre-moi le détail (stack, message d'erreur, capture)
avant correction.

---

## RÈGLES STRICTES

1. **Audit avant code** : présente l'Étape 1 et un plan validé AVANT de toucher
   au moindre fichier.
2. **Ne casse rien** dans Checkin : doublon (auth, supabase, toast, utils,
   header…) → rebranche sur l'existant, ne crée pas de seconde instance.
3. **Demande-moi avant** toute décision structurante : suppression de fichier
   du package, choix mono/multi-tenant, modification de SQL, alias.
4. **Adapte le SQL `analytics_*` au schéma Checkin** AVANT de l'exécuter — ne
   déploie pas tel quel.
5. **Incrémente** : après chaque étape majeure, montre le résultat (diff,
   build status, capture) avant de continuer.
6. **Lis `README.md` du package** — surtout §7 (couche de données rapports) —
   avant de commencer.

## SI TU ES BLOQUÉ

Arrête-toi, explique le problème factuellement (fichier, ligne, conflit),
propose 2-3 options avec leurs trade-offs, attends ma décision.

Mieux vaut s'arrêter et demander que produire du code que je devrai défaire.
