# Prompt d'injection — Module Revenue (Calendrier + Automatisation)
## Cible : projet **Checkin flowtym**

> À coller dans Claude Code (ou l'assistant IA) **ouvert dans le projet Checkin
> flowtym**, après avoir décompressé `revenue-calendar-automation.zip` quelque
> part dans le projet (idéalement `tmp/import-revenue/`).

---

## CONTEXTE

J'extrais 2 features du projet **FLOWTYM PMS** (le projet principal — PMS
hôtelier React/Vite/TS/Supabase) pour les **injecter dans le module Revenue de
Checkin flowtym** :

- **Calendrier tarifaire** — grille prix × chambre × plan × date, restrictions,
  inventaire, dérivation cascade.
- **Automatisation RMS** — autopilote (niveaux d'auto, garde-fous,
  recommandations) + Yield & Règles (règles tactiques, priorités, conflits).

**État du module Revenue dans Checkin** : il existe déjà comme **squelette
vide** (route/page créée mais sans contenu). J'injecte les 2 features dedans —
il ne devrait y avoir aucun conflit fonctionnel, mais peut-être des conflits
d'infra (auth, supabase…) qu'on découvrira à l'audit.

Le package décompressé contient :
- `README.md` — doc d'intégration détaillée (LIS-LA EN PREMIER, §5 surtout).
- `INJECTION_PROMPT.md` — version générique du prompt (réf).
- `INJECTION_PROMPT_CHECKIN.md` — **CE FICHIER, le prompt spécifique Checkin**.
- `src/` — 93 fichiers, arborescence à préserver (`src/components/...`,
  `src/pages/...` etc.).
- `sql/` — 3 SQL (calendar_tables_reference + 2 migrations RMS).

**Périmètre confirmé** : 93 fichiers calculés par fermeture transitive des
imports sur les 3 pages d'entrée → 0 import non résolu.

---

## TA MISSION

Intègre ces 2 features dans le module Revenue de Checkin. **Procède dans cet
ordre et MONTRE-MOI TON PLAN AVANT d'écrire du code.**

---

### ÉTAPE 1 — Audit Checkin (OBLIGATOIRE EN PREMIER)

Inspecte le projet Checkin et réponds-moi factuellement sur :

**A. Stack technique**
- React version ? Vite / Next / autre ?
- TypeScript ? Tailwind CSS présent ? (Tailwind est OBLIGATOIRE — sans lui, le
  module s'affichera sans aucun style.)
- Mon alias d'import : `@/...` → racine ? autre forme ? (le package importe
  `@/src/...`)

**B. Briques infra présentes (CRITIQUE — voir §5 du README pour le détail)**

Pour CHACUNE de ces deps, dis-moi si Checkin l'a déjà :

| Brique | Sa présence dans Checkin → action |
|---|---|
| Client **Supabase** (`lib/supabase.ts` ou équivalent) | si oui → rebrancher ; si non → garder celui du package + créer env vars |
| **@tanstack/react-query** + QueryClientProvider monté | si non → l'installer et l'ajouter à l'arbre React |
| **AuthContext** / hook `useAuth()` | si oui → rebrancher `domains/auth/*` du package sur le tien ; si non → garder ceux du package mais adapter à ton schéma user |
| **Permissions** (`usePagePermission` ou équivalent) | si oui → rebrancher ; si non → stub `() => ({ canRead: true, canWrite: true })` |
| **i18n** (i18next, lingui, format-message…) | si oui → rebrancher messages.fr/en ; si non → garder |
| Helper `cn()` (clsx + tailwind-merge) | si oui → rebrancher ; si non → garder |
| `ErrorBoundary` | si oui → rebrancher ; si non → garder |
| **Toast** (sonner, react-hot-toast, custom…) | si oui → rebrancher les usages |

**C. Backend**
- Checkin utilise-t-il **Supabase** ? Si oui : même projet que FLOWTYM PMS, ou
  un autre projet Supabase distinct ?
- Si autre backend : la couche DB du module est dans
  `components/rms/data/supabaseAdapter.ts` + `services/rms/rmsSupabasePersistence.ts`
  + `services/revenue/*.ts` — il faudra l'abstraire derrière l'API de Checkin.

**D. Module Revenue existant**
- Localise le squelette Revenue dans Checkin (probablement `src/pages/revenue/`
  ou `src/modules/revenue/` ou `src/features/revenue/`).
- Que contient-il déjà ? (routes, layout, header, navigation entre sous-pages…)
- Si un `RevenueHeader` existe déjà dans Checkin, on rebranche dessus au lieu de
  copier celui du package.
- Si un routing Revenue existe, on connecte les 3 pages à ses routes ; sinon, on
  les ajoute.

**Présente-moi le résultat sous forme de tableau / liste claire, et propose-moi
un PLAN D'INTÉGRATION adapté (étapes ordonnées, fichiers touchés, points qui
nécessitent ma décision). N'écris aucun code avant validation de ce plan.**

---

### ÉTAPE 2 — Dépendances npm

Installe (ou vérifie versions compatibles) dans Checkin :
```
@supabase/supabase-js@^2.105.4   @tanstack/react-query@^5.100.6
lucide-react@^0.546.0            recharts@^3.8.1
motion@^11                        zustand@^5.0.12
zod@^3                            clsx@^2                tailwind-merge@^2
```
Vérifie aussi : Tailwind actif (sinon installe), QueryClientProvider monté
(sinon ajoute-le à la racine).

---

### ÉTAPE 3 — Placement des fichiers

Copie le contenu de `tmp/import-revenue/src/` dans le `src/` de Checkin **en
préservant l'arborescence**. Les imports relatifs (`../../components/...`,
`@/src/...`) résoudront ainsi sans réécriture.

Adapte seulement si :
- l'alias `@` de Checkin diffère → renomme les imports `@/src/...` en
  conséquence (recherche-remplace global) ;
- un fichier du package existe déjà dans Checkin → **NE pas écraser** sans
  m'avoir consulté (cf. §4 ci-dessous).

---

### ÉTAPE 4 — Arbitrage deps infra (le point sensible)

Selon ce que tu as trouvé à l'audit Étape 1 §B, pour CHAQUE brique infra
embarquée dans le package, applique la règle suivante :

- **Checkin l'a déjà** → ne copie PAS celle du package. À la place :
  - laisse les fichiers du package, mais réécris leurs imports pour pointer
    sur la version Checkin (ex. `import { useAuth } from '@/auth/AuthContext'`
    au lieu de `domains/auth/AuthContext`).
  - OU mieux : supprime carrément le fichier du package et corrige les imports
    dans les fichiers métier qui le référencent.

- **Checkin ne l'a pas** → garde la version du package telle quelle.

**Liste précisément les fichiers du package que tu vas supprimer / rebrancher
AVANT de le faire, et fais-moi valider.**

Cas particulier : **`ChannelManagerPanel` + `channel-manager.service`** —
Channel Manager masqué en V1 du PMS. Si Checkin n'a pas vocation à activer le
CM, **supprime ces 2 fichiers** (ils sont importés en `[CM]` commentés dans
`PricingCalendar.tsx`, donc inoffensifs si on retire les imports).

---

### ÉTAPE 5 — Base de données

**Prérequis SQL** : la fonction `public.get_user_hotel_id() RETURNS uuid` doit
exister dans le Supabase de Checkin. Vérifie-le :
```sql
SELECT proname FROM pg_proc WHERE proname = 'get_user_hotel_id';
```
- Si OUI → continue.
- Si NON et Checkin est **multi-tenant** → crée-la (UUID hôtel du user courant).
- Si NON et Checkin est **mono-tenant** → adapte les 3 SQL avant de les
  exécuter (remplace `hotel_id = public.get_user_hotel_id()` par ta logique,
  ex. `true`, ou un filtre `auth.uid()`).

**Tables PMS de base** : vérifie que Checkin a déjà `rooms`, `room_types`,
`rate_plans`. Si non, signale-le-moi — le calendrier en dépend (et ces tables
ne sont pas fournies dans le package).

**Déploie alors, dans l'ordre, sur le Supabase de Checkin :**
1. `sql/calendar_tables_reference.sql` (rate_prices, rate_restrictions,
   pricing_rules) — relis le DDL et adapte si Checkin a une convention
   différente sur les types/contraintes.
2. `sql/20260520_rms_enterprise.sql` (rms_tactical_rules, rms_guardrails,
   rms_priority_hierarchy, rms_audit_log).
3. `sql/20260518_rms_decisions.sql` (rms_decisions).

Utilise `apply_migration` (et pas `execute_sql`) du MCP Supabase pour préserver
la traçabilité côté Checkin.

---

### ÉTAPE 6 — Câblage du module Revenue de Checkin

Une fois les fichiers placés et l'infra rebranchée :

1. Localise le squelette Revenue de Checkin (Étape 1 §D).
2. Ajoute les 3 routes pour les 3 pages d'entrée :
   ```tsx
   import PricingCalendar from '@/src/pages/revenue/PricingCalendar';
   import AutopilotPage   from '@/src/pages/revenue/AutopilotPage';
   import YieldAndRules   from '@/src/pages/revenue/YieldAndRules';
   ```
3. Si le squelette Revenue de Checkin a déjà une navigation interne (menu
   latéral, tabs…), ajoute 3 entrées :
   - "Calendrier tarifaire" → `PricingCalendar`
   - "Autopilote RMS" → `AutopilotPage`
   - "Yield & Règles" → `YieldAndRules`
4. Aucune prop n'est requise — ces composants sont autonomes.

---

### ÉTAPE 7 — Vérification finale

Lance et montre-moi le résultat de :

- [ ] `npm install` propre (pas de warnings de peer deps majeurs).
- [ ] `tsc --noEmit` (ou équivalent) : 0 erreur sur les fichiers du module.
- [ ] `npm run build` réussit.
- [ ] L'app démarre sans erreur console à l'import des 3 pages.
- [ ] **Calendrier tarifaire** : la grille s'affiche, navigation date OK,
      stores Zustand chargent.
- [ ] **Autopilote** : niveaux d'automatisation visibles, garde-fous chargés.
- [ ] **Yield & Règles** : tableau des règles s'affiche.
- [ ] Tailwind correctement appliqué (pas d'écran nu).
- [ ] Console : pas d'erreur bloquante. Les warnings résiduels sont attendus si
      tables DB encore vides.

Si une étape échoue, montre-moi le détail (stack trace, message d'erreur) avant
de tenter une correction.

---

## RÈGLES STRICTES

1. **Audit avant code** : présente-moi le résultat de l'Étape 1 et un plan
   d'intégration validé AVANT de toucher au moindre fichier.
2. **Ne casse rien** dans Checkin : en cas de doublon (auth, supabase, toast,
   utils…), rebranche sur l'existant — ne crée pas de seconde instance.
3. **Demande-moi avant** toute décision structurante : suppression d'un fichier
   du package, modification d'une convention de schéma DB, choix mono/multi-
   tenant, changement d'alias d'import.
4. **Adapte le SQL** au schéma de Checkin AVANT de l'exécuter — ne déploie pas
   tel quel sans avoir vérifié les conventions de Checkin.
5. **Présente les étapes incrémentalement** : après chaque étape majeure,
   montre-moi le résultat (diff, build status, screenshot) avant de continuer.
6. **Lis `README.md` du package** — surtout §5 (deps infra) — avant de
   commencer. Ne procède pas sur des suppositions.

---

## SI TU ES BLOQUÉ

Si tu trouves un blocage qui demande mon arbitrage :
- arrête-toi,
- explique-moi le problème factuellement (fichier, ligne, conflit),
- propose 2 ou 3 options avec leurs trade-offs,
- attends ma décision avant de continuer.

Mieux vaut s'arrêter et demander que produire du code que je devrai défaire.
