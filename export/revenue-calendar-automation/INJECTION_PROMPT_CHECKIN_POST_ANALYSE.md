# Prompt d'injection — Module Revenue (Calendrier + Automatisation)
## Cible : Checkin flowtym — **APRÈS** injection réussie du module Analyse

> À coller dans Claude Code (ou l'assistant IA) **ouvert dans Checkin flowtym**,
> après avoir décompressé `revenue-calendar-automation.zip` dans
> `tmp/import-revenue/` du projet.

---

## CONTEXTE

J'extrais 2 features du projet **FLOWTYM PMS** (PMS hôtelier React/Vite/TS/
Supabase) pour les injecter dans le **module Revenue** de **Checkin flowtym** :

- **Calendrier tarifaire** — grille prix × chambre × plan × date, restrictions,
  inventaire, dérivation cascade.
- **Automatisation RMS** — autopilote (niveaux d'auto, garde-fous,
  recommandations) + Yield & Règles (règles tactiques, priorités, conflits).

**État du module Revenue dans Checkin** : squelette vide → j'injecte dedans,
pas de conflit fonctionnel attendu.

**⚠️ Contexte clé : le module Analyse a DÉJÀ été injecté avec succès dans
Checkin** lors d'une session précédente. Tu peux donc partir des hypothèses
suivantes (à confirmer rapidement à l'audit) :

- La stack technique (React, bundler, TS, Tailwind, alias d'import) est connue.
- Le client **Supabase** est en place et rebranché.
- **@tanstack/react-query** + `QueryClientProvider` sont montés.
- Une convention de **rebranchement** a été établie pour ces deps :
  `lib/utils.ts` (cn), système de toast, ErrorBoundary, store config.
- La fonction RLS `public.get_user_hotel_id()` existe en base (sinon Analyse
  ne marcherait pas).
- Les 5 tables `analysis_*` existent.

**Ta MISSION** : appliquer la **MÊME convention de rebranchement** établie pour
Analyse aux nouvelles deps tirées par Revenue. Tu auras moins de décisions à
prendre que pour Analyse — mais Revenue est **plus gros** (93 fichiers vs 50)
et tire **plus de deps infra** : `domains/auth/*`, `services/settings/
permissionsService`, `i18n/*`, plus l'ErrorBoundary et 8 services Revenue.

Package décompressé dans `tmp/import-revenue/` :
- `README.md` — doc d'intégration (LIS-LA, surtout §5 sur deps infra).
- `INJECTION_PROMPT.md` — version générique.
- `INJECTION_PROMPT_CHECKIN.md` — version Checkin standard (Analyse pas encore
  injectée).
- `INJECTION_PROMPT_CHECKIN_POST_ANALYSE.md` — **CE FICHIER**.
- `src/` — 93 fichiers, arborescence à préserver.
- `sql/` — 3 SQL : `calendar_tables_reference.sql` + 2 migrations RMS.

**Périmètre** : fermeture transitive sur 3 pages d'entrée (`PricingCalendar`,
`AutopilotPage`, `YieldAndRules`) → 93 fichiers, 0 import non résolu.

---

## TA MISSION

Procède dans cet ordre. **MONTRE-MOI TON PLAN AVANT d'écrire du code.**

---

### ÉTAPE 1 — Audit ciblé Checkin (rapide car Analyse déjà fait)

**A. Vérifications express (capitalise sur Analyse)**

Confirme-moi rapidement, en regardant comment Analyse a été intégré :

| Point | Action |
|---|---|
| Stack (React/bundler/TS/Tailwind) | confirme depuis l'injection Analyse |
| Alias `@` → racine ? | confirme |
| Client Supabase rebranché → quel chemin ? | note le chemin pour rebrancher Revenue dessus |
| react-query + QueryClientProvider montés | confirme |
| `cn()` helper rebranché → quel chemin ? | note |
| Toast rebranché → quel chemin ? | note |
| ErrorBoundary → existant Checkin ou copié de FLOWTYM ? | note |
| Store config (configStore) → rebranché sur quoi ? stub minimal ? | note |
| `public.get_user_hotel_id()` existe en base | confirme |

**B. NOUVELLES briques infra tirées par Revenue (pas par Analyse) — À AUDITER**

Pour chacune, dis-moi si Checkin l'a déjà :

| Brique | Pourquoi tirée par Revenue | Action si présente → si absente |
|---|---|---|
| **AuthContext** (`useAuth()`, user courant) — Revenue tire `domains/auth/*` (3 fichiers) | services Revenue lisent l'utilisateur courant pour audit + permissions | rebrancher TOUS les imports `domains/auth/*` du package sur ton auth → garder ceux du package mais adapter au schéma user Checkin |
| **Système de permissions** (`usePagePermission` ou équivalent) | les 3 pages Revenue ont un gating canRead/canWrite | rebrancher → stub `() => ({ canRead: true, canWrite: true })` |
| **i18n** (i18next, lingui, format-message…) — le package embarque `i18n/*` (4 fichiers FR/EN) | LocaleSwitcher + libellés UI | rebrancher messages.fr/en sur ton i18n → garder ceux du package |
| **motion** (framer-motion successeur, import `motion/react`) | utilisé par AutopilotPage pour animations KPI | installer si absent (version `^11.x`) |

**C. Module Revenue existant Checkin**
- Confirme l'emplacement du squelette Revenue (probablement `src/pages/revenue/`
  ou équivalent).
- Que contient-il déjà ? (route, layout, header, navigation entre sous-pages)
- Existe-t-il déjà un `RevenueHeader` Checkin ? Si oui → on rebranche dessus
  (même règle que pour Analyse).

**D. Backend**
- Confirme : même projet Supabase que celui utilisé pour Analyse.
- Confirme : multi-tenant ou mono ?
- Tables PMS de base (`rooms`, `room_types`, `rate_plans`) présentes côté
  Checkin ? **C'est critique** — le calendrier en dépend (`rooms` et
  `room_types` pour la grille, `rate_plans` pour les plans tarifaires).

**Présente le résultat sous forme de tableau / liste claire, et propose-moi un
PLAN D'INTÉGRATION ordonné. Attends ma validation avant tout edit.**

---

### ÉTAPE 2 — Dépendances npm additionnelles

Par rapport à Analyse, Revenue ajoute :
```
motion@^11                  # framer-motion successeur (import 'motion/react')
zod@^3                       # validation schemas auth/services
```
Les autres sont déjà installées (lucide-react, supabase-js, react-query,
zustand, recharts si Analyse les utilise).

À vérifier en plus si pas déjà là :
```
recharts@^3.8.1
```

---

### ÉTAPE 3 — Placement des fichiers

Copie `tmp/import-revenue/src/` dans le `src/` de Checkin **en préservant
l'arborescence**.

**⚠️ Avant de copier, applique cette règle** :
- Si un fichier du package **existe déjà à l'identique dans Checkin** (parce
  que Analyse l'avait déjà copié ou rebranché), **NE LE RÉÉCRIS PAS**. Compare
  d'abord :
  - `lib/supabase.ts`, `lib/supabase.types.ts`, `lib/utils.ts`
  - `components/ErrorBoundary.tsx`
  - `store/configStore.ts` (si Analyse l'a stubé)
  - `domains/auth/*` (si Analyse l'avait tiré aussi)
  - `i18n/*` (idem)

Pour chaque conflit, **liste-moi le fichier + ta proposition (skip / merge /
remplacer) AVANT de l'appliquer**.

---

### ÉTAPE 4 — Arbitrage deps infra (le point sensible)

Applique la **même convention** que celle établie pour Analyse :

#### Briques DÉJÀ arbitrées par Analyse → réutilise telles quelles
- Client Supabase : tous les imports `lib/supabase` du nouveau code → pointer
  vers le chemin Checkin que tu as noté à l'étape 1.
- `cn()` helper → idem.
- Toast → idem.
- ErrorBoundary → idem.
- Store config → idem (stub minimal si c'est ce qui a été fait pour Analyse).

#### NOUVELLES briques à arbitrer (Revenue-spécifiques)

**`domains/auth/*` (AuthContext + repository + schemas)**
- Si Checkin a déjà un `useAuth()` / `AuthContext` → réécris les imports des
  fichiers Revenue qui consomment `domains/auth/*` pour pointer sur l'auth
  Checkin. Adapte les noms de champs si le schéma user diffère.
- Si Checkin n'a pas d'auth réel → garde les 3 fichiers du package et stubbe
  pour retourner un user fictif.
- **Liste-moi tous les fichiers Revenue qui importent `domains/auth/*` AVANT
  de les modifier.**

**`services/settings/permissionsService` (gating canRead/canWrite)**
- Si Checkin a un système de permissions → rebranche les `usePagePermission`
  sur celui-ci.
- Si non → stub minimal :
  ```ts
  export function usePagePermission(_pageId: string) {
    return {
      canRead: true,
      canWrite: true,
      DeniedBanner: () => null,
    };
  }
  ```

**`i18n/*` (4 fichiers FR/EN + LocaleSwitcher)**
- Si Checkin a un i18n → fusionne les clés `messages.fr.ts` / `messages.en.ts`
  dans le tien, ou rebranche les usages via le hook i18n de Checkin.
- Si non → garde tel quel.

**Cas particuliers**
- **`ChannelManagerPanel` + `channel-manager.service`** : Channel Manager
  masqué V1 du PMS. Si Checkin n'active pas le CM → **supprime ces 2 fichiers**
  (imports `[CM]` commentés dans `PricingCalendar.tsx`, inoffensifs si on les
  retire complètement).
- **`services/settings/settingsPersistence`** : persistance config annexe — si
  les écrans Revenue concernés ne sont pas utilisés → stub.
- **`services/settings/monitoringService`** : capture erreurs window. Si
  Checkin a déjà Sentry ou équivalent → désactive l'installation.

**Avant tout edit, présente-moi un tableau** :
```
| fichier package | action | détail |
|---|---|---|
| domains/auth/AuthContext.tsx | SUPPRIMER | Checkin a useAuth() dans @/auth/AuthContext, je rebranche 14 imports |
| services/settings/permissionsService.tsx | STUBBER | ... |
| ChannelManagerPanel.tsx | SUPPRIMER | CM pas activé sur Checkin |
| i18n/* | GARDER | Checkin n'a pas d'i18n |
...
```

Attends ma validation avant exécution.

---

### ÉTAPE 5 — Base de données

#### 5a. Prérequis
Confirmé à l'étape 1 : `public.get_user_hotel_id()` existe (Analyse l'utilise).

#### 5b. Tables PMS de base
Confirme la présence dans Checkin de :
- `rooms` — pour la grille calendrier (rooms × dates)
- `room_types` — pour les types et capacités
- `rate_plans` — pour les plans tarifaires

Si une seule manque → signale-le-moi. Le calendrier en dépend
fondamentalement.

#### 5c. Déploie les 3 SQL (via `apply_migration` du MCP Supabase)
Dans l'ordre :
1. `sql/calendar_tables_reference.sql` → crée `rate_prices`,
   `rate_restrictions`, `pricing_rules`. **Relis le DDL et adapte si Checkin
   a des conventions différentes** (types, noms de contraintes, indexes).
2. `sql/20260520_rms_enterprise.sql` → `rms_tactical_rules`, `rms_guardrails`,
   `rms_priority_hierarchy`, `rms_audit_log`.
3. `sql/20260518_rms_decisions.sql` → `rms_decisions`.

Si Checkin est mono-tenant : adapte chaque RLS (`hotel_id =
get_user_hotel_id()` → ta logique) avant déploiement.

---

### ÉTAPE 6 — Câblage du module Revenue

1. Localise le squelette Revenue de Checkin (confirmé étape 1).
2. Ajoute les 3 routes pour les pages d'entrée — aucune prop requise :
   ```tsx
   import PricingCalendar from '@/src/pages/revenue/PricingCalendar';
   import AutopilotPage   from '@/src/pages/revenue/AutopilotPage';
   import YieldAndRules   from '@/src/pages/revenue/YieldAndRules';
   ```
3. Si le squelette Revenue a une navigation interne (tabs, menu latéral, etc.) :
   ajoute 3 entrées — "Calendrier tarifaire", "Autopilote RMS",
   "Yield & Règles".
4. Réutilise le `RevenueHeader` Checkin si existant (rebranchement comme pour
   Analyse).

---

### ÉTAPE 7 — Vérification finale

Lance et montre-moi :
- [ ] `npm install` propre, pas de peer deps majeures cassées.
- [ ] `tsc --noEmit` (ou équivalent) : 0 erreur sur les fichiers Revenue.
- [ ] `npm run build` réussit.
- [ ] L'app démarre sans erreur console à l'import des 3 pages.
- [ ] **Calendrier tarifaire** : grille affichée, navigation date OK, store
      Zustand `rateCalendarStore` charge sans erreur, cellules cliquables.
- [ ] **Autopilote RMS** : les niveaux d'automatisation s'affichent, garde-fous
      chargés depuis Supabase, recommandations visibles (peuvent être vides si
      tables vides).
- [ ] **Yield & Règles** : tableau des règles s'affiche, modal nouvelle règle
      ouvrable.
- [ ] Tailwind appliqué.
- [ ] Pas de doublon dans la console (1 seul AuthContext, 1 seul QueryClient,
      etc.).
- [ ] Stores Zustand `rateCalendarStore` + `rmsAutomationStore` n'entrent pas
      en conflit avec ceux d'Analyse.

Si une étape échoue, montre-moi le détail (stack, message d'erreur) AVANT
correction.

---

## RÈGLES STRICTES

1. **Audit avant code** : présente le résultat de l'étape 1 + plan
   d'intégration validé par moi AVANT tout edit.
2. **Réutilise la convention Analyse** : tout ce qui a déjà été arbitré pour
   Analyse (Supabase, cn, toast, ErrorBoundary, store config…) → applique
   exactement le même rebranchement à Revenue. Pas de divergence de stratégie
   entre les 2 modules.
3. **Ne casse rien** : ni Analyse (déjà en place), ni Checkin. En cas de
   conflit de fichier déjà copié par Analyse → SKIP, ne réécris pas.
4. **Demande-moi avant** : suppression d'un fichier package (notamment
   `ChannelManagerPanel`), choix mono/multi-tenant, modification d'un SQL,
   adaptation d'un schéma user.
5. **Adapte le SQL au schéma Checkin** AVANT exécution.
6. **Incrémente** : après chaque étape majeure, montre résultat (diff, build,
   capture) avant de continuer.
7. **Lis `README.md`** (§5 surtout) avant de commencer.

## SI TU ES BLOQUÉ

Arrête-toi, explique factuellement (fichier, ligne, conflit), propose 2-3
options + trade-offs, attends ma décision.

Mieux vaut s'arrêter et demander que produire du code que je devrai défaire.
