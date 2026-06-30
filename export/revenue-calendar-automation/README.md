# Module Revenue — Calendrier Tarifaire + Automatisation

Extrait de **FLOWTYM PMS** pour injection dans un autre projet React/TypeScript.

Deux features du module Revenue, packagées ensemble car elles partagent le
même socle (store, types, engines, persistence Supabase) :

- **Calendrier tarifaire** — grille prix × chambre × plan × date, restrictions,
  inventaire, cascade de dérivation, exports.
- **Automatisation** — autopilote RMS (niveaux d'automatisation, garde-fous,
  recommandations) + règles tactiques (Yield & Règles, priorités, conflits).

> Périmètre calculé par **fermeture transitive des imports** des 3 pages
> d'entrée → **93 fichiers, 0 import non résolu**. Rien ne manque.

---

## 1. Points d'entrée (3 pages)

| Page | Fichier | Rôle |
|---|---|---|
| Calendrier tarifaire | `src/pages/revenue/PricingCalendar.tsx` | Grille de pricing |
| Autopilote RMS | `src/pages/revenue/AutopilotPage.tsx` | Automatisation autonome |
| Yield & Règles | `src/pages/revenue/YieldAndRules.tsx` | Règles tactiques / priorités |

Chacune est un composant React autonome, sans props requises :
```tsx
import PricingCalendar from '@/src/pages/revenue/PricingCalendar';
import AutopilotPage   from '@/src/pages/revenue/AutopilotPage';
import YieldAndRules   from '@/src/pages/revenue/YieldAndRules';
```
Monte-les dans ton routeur (page IDs d'origine : `rev_calendar`,
`rev_autopilot`, `rev_automation`).

---

## 2. Dépendances npm (10)

```jsonc
{
  "@supabase/supabase-js": "^2.105.4",
  "@tanstack/react-query":  "^5.100.6",   // QueryClientProvider requis à la racine
  "lucide-react":           "^0.546.0",
  "recharts":               "^3.8.1",
  "motion":                 "^11.x",       // (framer-motion successeur — import 'motion/react')
  "zustand":                "^5.0.12",
  "zod":                    "^3.x",        // validation (domains/auth)
  "clsx":                   "^2.x",
  "tailwind-merge":         "^2.x"
}
```
+ **Tailwind CSS** obligatoire (styling 100% utilitaire).
+ Un `QueryClientProvider` monté à la racine.
+ Alias `@` → racine projet (le code importe `@/src/...`). Cf. vite.config :
  `'@': path.resolve(__dirname, '.')` et tsconfig `"@/*": ["./*"]`.

---

## 3. Arborescence (93 fichiers)

```
src/
├── pages/revenue/            PricingCalendar, AutopilotPage, YieldAndRules
├── components/rms/
│   ├── calendar/   (11)      grille, cellules, modals, toast, filtres
│   ├── automation/ (4)       ActivationSlots, Guardrails, Recommendation, DecisionRow
│   ├── engines/    (4)       Cascade, PricingRules, RateCalendarDedup, VirtualRoom
│   ├── store/                rateCalendarStore.ts (Zustand)
│   ├── data/       (3)       channelData, partnerLogos, supabaseAdapter
│   ├── types/                index.ts
│   └── utils/      (2)       cn, exportPrint
├── components/revenue/
│   ├── automation/ (21)      règles tactiques, garde-fous, priorités, conflits
│   ├── RevenueHeader.tsx     en-tête de page
│   └── ChannelManagerPanel.tsx  (Channel Manager — masqué V1)
├── store/                    rmsAutomationStore.ts (Zustand)
├── services/revenue/ (8)     centralPricingEngine, guardrails, conflicts, audit…
├── services/rms/             rmsSupabasePersistence
├── services/                 rms-decisions, channel-manager
├── lib/rms/        (4)       strategies, autoStrategyEngine, calendarPriceSync, eventBus
├── data/rms/       (2)       events, mockAutomationData
├── types/revenue/  (3)       conflicts, guardrails, tacticalRules
│
└── [DÉPENDANCES INFRA — voir §5, à arbitrer avec ton projet]
    ├── lib/                  supabase, supabase.types, utils, hotelId
    ├── domains/auth/  (3)    AuthContext, repository, schemas
    ├── domains/_shared/      errors
    ├── i18n/          (4)    index, LocaleSwitcher, messages.fr, messages.en
    ├── services/settings/(4) permissions, persistence, audit, monitoring
    ├── components/ErrorBoundary.tsx
    └── types.ts, types/settings/diagnostic.ts, types/events.ts
```

---

## 4. Base de données

**RPC requis (prérequis) :** `public.get_user_hotel_id() RETURNS uuid`
(scoping multi-tenant utilisé par toutes les RLS). Mono-tenant → remplace par
ta logique.

**Tables fournies dans `sql/` :**
- `calendar_tables_reference.sql` → `rate_prices`, `rate_restrictions`,
  `pricing_rules` (spécifiques au calendrier — DDL + RLS).
- `20260520_rms_enterprise.sql` → `rms_tactical_rules`, `rms_guardrails`,
  `rms_priority_hierarchy`, `rms_audit_log` (automatisation).
- `20260518_rms_decisions.sql` → `rms_decisions` (journal décisions RMS).

**Tables attendues côté cible (PMS de base — NON fournies) :**
`rooms`, `room_types`, `rate_plans` — un PMS standard les a déjà. Le module lit
aussi `users` et `settings_*` via les deps infra (permissions/persistence) — à
neutraliser si tu rebranches ces deps (voir §5).

---

## 5. ⚠️ Dépendances infra tirées par la closure (à arbitrer)

Contrairement au module Analyse, ce module tire des briques transverses que ton
projet possède probablement déjà. **Ne crée pas de doublon** — rebranche sur les
tiennes ou stubbe :

| Dep infra | Pourquoi tirée | Reco |
|---|---|---|
| `domains/auth/*` (AuthContext…) | `rmsEnterprisePersistence` / services lisent l'user courant | Rebranche sur TON auth (fournir `useAuth()` équivalent) |
| `services/settings/permissionsService` | gating `canRead/canWrite` sur les pages | Remplace par ta logique de permissions, ou stub `() => ({canRead:true,canWrite:true})` |
| `services/settings/settingsPersistence` | persistance config annexe | Stub si non utilisé par les écrans voulus |
| `i18n/*` | `LocaleSwitcher` + libellés | Garde, ou remplace par ton i18n |
| `lib/supabase.ts` | client Supabase | Pointe sur TON client |
| `lib/utils.ts` (`cn`) | clsx+tailwind-merge | Réutilise le tien |
| `components/ErrorBoundary.tsx` | wrap des pages | Réutilise le tien |
| `ChannelManagerPanel` + `channel-manager.service` | Channel Manager (masqué V1) | Supprimable si tu n'actives pas le CM |

---

## 6. Checklist d'intégration

- [ ] Copier `src/` dans le `src/` cible (préserve l'arborescence).
- [ ] Installer les deps npm (§2) + Tailwind + QueryClientProvider.
- [ ] Vérifier l'alias `@` → racine.
- [ ] Arbitrer les deps infra (§5) : rebrancher auth / permissions / supabase / i18n.
- [ ] Régler `get_user_hotel_id()` puis exécuter les 3 SQL de `sql/`.
- [ ] Vérifier la présence de `rooms` / `room_types` / `rate_plans` côté cible.
- [ ] Câbler les 3 pages dans le routeur.
- [ ] `tsc --noEmit` / build OK ; calendrier affiche la grille ; autopilote charge.

---

## 7. Notes

- Stores Zustand : `rateCalendarStore` (calendrier) et `rmsAutomationStore`
  (automatisation) — autonomes, persistance Supabase via les services inclus.
- `supabaseAdapter.ts` + `rmsSupabasePersistence.ts` centralisent les accès DB du
  calendrier/automation — c'est là qu'il faut regarder pour adapter le schéma.
- Le `centralPricingEngine.service.ts` est le pont prix RMS → calendrier.
- Aucun test n'est inclus (les `.test.ts` ont été exclus de la closure runtime).
- Tables `rate_prices` (8740 lignes en prod) / `rate_restrictions` (1840) :
  volumineuses — prévois des index (fournis dans le DDL de référence).

*Extrait le 2026-06-29 — fermeture transitive de 3 pages d'entrée, 93 fichiers.*
