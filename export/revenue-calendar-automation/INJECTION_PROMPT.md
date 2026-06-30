# Prompt d'injection — Module Revenue (Calendrier tarifaire + Automatisation)

> À coller dans l'assistant IA du **projet cible**, après avoir décompressé
> `revenue-calendar-automation.zip` à la racine du projet.

---

Je veux intégrer deux features d'un module Revenue (PMS hôtelier React/TS) :
le **Calendrier tarifaire** et l'**Automatisation RMS** (autopilote + règles
tactiques). Le package décompressé contient `README.md` (lis-le), un dossier
`src/` (93 fichiers, arborescence à préserver), et `sql/` (schéma DB).

**Périmètre** : calculé par fermeture transitive de 3 pages d'entrée —
`PricingCalendar.tsx`, `AutopilotPage.tsx`, `YieldAndRules.tsx`. 93 fichiers,
10 deps npm, 0 import non résolu.

**MISSION — adapte, ne copie pas aveuglément. Montre-moi ton PLAN AVANT de coder.**

### 1. Audit compat (EN PREMIER)
Inspecte mon projet et réponds : React version ? bundler ? **Tailwind présent ?**
(obligatoire). Ai-je déjà : client **Supabase**, **@tanstack/react-query** +
QueryClientProvider, un **auth context**, un système de **permissions**, de
l'**i18n**, un helper `cn()`, un `ErrorBoundary` ? Mon alias d'import ? Mon
backend est-il **Supabase** ? Liste les **doublons/conflits** puis propose un
plan adapté.

### 2. Deps npm
Installe / vérifie : `@supabase/supabase-js@^2.105.4`,
`@tanstack/react-query@^5.100.6`, `lucide-react@^0.546.0`, `recharts@^3.8.1`,
`motion` (import `motion/react`), `zustand@^5.0.12`, `zod`, `clsx`,
`tailwind-merge`. Assure un `QueryClientProvider` à la racine + Tailwind actif +
alias `@` → racine projet (`@/*` → `./*`).

### 3. Placement
Copie `src/` dans mon `src/` en **préservant l'arborescence** (les imports
relatifs + `@/src/...` résolvent ainsi). N'adapte que l'alias si le mien diffère.

### 4. ⚠️ Dépendances infra (LE POINT SENSIBLE — arbitre avec moi)
La fermeture tire des briques transverses que j'ai probablement déjà.
**NE crée pas de doublon** — rebranche sur les miennes ou stub. Pour CHACUNE,
demande-moi si j'en ai une avant de garder celle du package :
- `domains/auth/*` (AuthContext) → rebranche sur MON auth (`useAuth()` équivalent).
- `services/settings/permissionsService` → ma logique de permissions, ou stub
  `usePagePermission = () => ({ canRead: true, canWrite: true })`.
- `services/settings/settingsPersistence` → stub si écrans concernés non utilisés.
- `i18n/*` → garde ou remplace par mon i18n.
- `lib/supabase.ts` → pointe sur MON client (le module fait souvent `as any`,
  pas besoin du typage `Database`).
- `lib/utils.ts` (`cn`), `components/ErrorBoundary.tsx` → réutilise les miens.
- `ChannelManagerPanel` + `channel-manager.service` → **supprimables** (Channel
  Manager masqué V1) si je ne l'active pas.

### 5. Base de données
Prérequis : `public.get_user_hotel_id() RETURNS uuid` (multi-tenant). Mono-tenant
→ remplace les `hotel_id = get_user_hotel_id()` par ma logique.
- Exécute `sql/calendar_tables_reference.sql` (rate_prices, rate_restrictions,
  pricing_rules) — **adapte les types/contraintes à mon schéma**.
- Exécute `sql/20260520_rms_enterprise.sql` (rms_tactical_rules, rms_guardrails,
  rms_priority_hierarchy, rms_audit_log) et `sql/20260518_rms_decisions.sql`.
- Vérifie que j'ai déjà `rooms`, `room_types`, `rate_plans` (PMS de base). Sinon,
  signale-le : le calendrier en dépend.
- Si mon backend N'EST PAS Supabase : la couche DB est centralisée dans
  `components/rms/data/supabaseAdapter.ts` + `services/rms/rmsSupabasePersistence.ts`
  + `services/revenue/*` — abstrais-les derrière mon API.

### 6. Câblage
Monte les 3 pages dans mon routeur :
```tsx
import PricingCalendar from '@/src/pages/revenue/PricingCalendar';
import AutopilotPage   from '@/src/pages/revenue/AutopilotPage';
import YieldAndRules   from '@/src/pages/revenue/YieldAndRules';
```
(aucune prop requise ; adapte à React Router / Next / state interne).

### 7. Vérif finale (montre les résultats)
- [ ] build / `tsc --noEmit` OK sur les fichiers du module.
- [ ] Calendrier tarifaire : la grille s'affiche, navigation dates OK.
- [ ] Autopilote : la page charge, niveaux d'automatisation visibles.
- [ ] Yield & Règles : tableau des règles s'affiche.
- [ ] Tailwind appliqué (pas d'écran nu).
- [ ] Stores Zustand (rateCalendarStore, rmsAutomationStore) chargent sans erreur.
- [ ] Console sans erreur bloquante.

### RÈGLES
- Ne casse rien d'existant : doublon → rebranche sur l'existant.
- Adapte le SQL à MON schéma avant déploiement.
- Demande-moi AVANT toute décision structurante (auth, permissions, alias,
  suppression d'une dep infra, mono vs multi-tenant).
- Lis `README.md` (§5 surtout) pour le détail des deps infra.
