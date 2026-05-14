# Settings Module Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete navigable Flowtym Settings module UI for all documented sub-sections without introducing risky database writes.

**Architecture:** Route every `settings_*` `PageId` into `SettingsView`, then render a modular settings shell backed by a declarative catalog. Keep Phase 1 read/local-only for sensitive settings while preserving future boundaries for Supabase repositories, Zod schemas, RLS, and audit.

**Tech Stack:** React 19, TypeScript, TailwindCSS, lucide-react, Zustand `useConfigStore`, Vite.

---

## File Structure

- Modify `frontend/src/App.tsx`: route all settings pages to `SettingsView activePage={page}`.
- Replace `frontend/src/pages/SettingsView.tsx`: make it a thin page wrapper around the new module.
- Create `frontend/src/domains/settings/catalog.ts`: declarative section metadata, cards, tables, alerts, form fields.
- Create `frontend/src/domains/settings/SettingsModule.tsx`: shell, overview, generic section renderer, tables, forms, action bars.
- Keep existing `frontend/src/components/Configuration.tsx` and configuration subcomponents untouched for now, but no longer use them as the primary settings page.

## Task 1: Route settings sub-pages into SettingsView

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/SettingsView.tsx`

- [ ] **Step 1: Verify current routing gap**

Run:

```bash
rg "case 'settings'" frontend/src/App.tsx -n
```

Expected: only `settings` routes to `SettingsView`.

- [ ] **Step 2: Modify `SettingsView` props**

Replace the existing implementation with:

```tsx
import React from 'react';
import type { PageId } from '@/src/types';
import { SettingsModule } from '@/src/domains/settings/SettingsModule';

interface SettingsViewProps {
  activePage?: PageId;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ activePage = 'settings' }) => {
  return <SettingsModule activePage={activePage} />;
};
```

- [ ] **Step 3: Modify App routing**

In `frontend/src/App.tsx`, replace the settings switch tail with grouped settings cases:

```tsx
    // ── PARAMÈTRES ────────────────────────────────────────────────────────────
    case 'settings':
    case 'settings_hotel':
    case 'settings_multihotel':
    case 'settings_room_types':
    case 'settings_rooms':
    case 'settings_floors':
    case 'settings_room_status':
    case 'settings_preferences':
    case 'settings_products':
    case 'settings_rate_plans':
    case 'settings_conditions':
    case 'settings_seasons':
    case 'settings_age_categories':
    case 'settings_invoice':
    case 'settings_numbering':
    case 'settings_payment_modes':
    case 'settings_accounting':
    case 'settings_debtors':
    case 'settings_fiscal':
    case 'settings_hk_status':
    case 'settings_hk_checklists':
    case 'settings_hk_staff':
    case 'settings_hk_distribution':
    case 'settings_maintenance':
    case 'settings_lost_found':
    case 'settings_breakfast':
    case 'settings_pms_sync':
    case 'settings_api':
    case 'settings_connectors':
    case 'settings_users':
    case 'settings_automations':
    case 'settings_notifications':
    case 'settings_rgpd':
    case 'settings_import_export':
    case 'settings_audit':
    case 'settings_backups':
    default:
      return <SettingsView activePage={page} />;
```

- [ ] **Step 4: Verify routing compiles**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/SettingsView.tsx
git commit -m "Route all settings pages"
```

## Task 2: Create settings catalog

**Files:**
- Create: `frontend/src/domains/settings/catalog.ts`

- [ ] **Step 1: Create types and overview data**

Create `catalog.ts` with:

```ts
import type { PageId } from '@/src/types';

export type SettingsTone = 'emerald' | 'violet' | 'amber' | 'blue' | 'rose' | 'slate';

export interface SettingsMetric {
  label: string;
  value: string;
  detail: string;
  tone: SettingsTone;
}

export interface SettingsTable {
  columns: string[];
  rows: string[][];
}

export interface SettingsField {
  label: string;
  value: string;
  type?: 'text' | 'number' | 'select' | 'password' | 'checkbox';
}

export interface SettingsSection {
  id: PageId;
  title: string;
  eyebrow: string;
  description: string;
  status: string;
  actions: string[];
  metrics?: SettingsMetric[];
  alerts?: string[];
  fields?: SettingsField[];
  table?: SettingsTable;
  checklist?: string[];
}

export const settingsOverviewMetrics: SettingsMetric[] = [
  { label: 'Établissement', value: 'Hôtel Paris Centre', detail: 'Profil complet', tone: 'emerald' },
  { label: 'Chambres', value: '58 chambres', detail: '3 types incomplets', tone: 'amber' },
  { label: 'Fiscalité 2026', value: 'Conforme', detail: 'Mode Production', tone: 'emerald' },
  { label: 'PMS externe', value: 'Connecté', detail: 'Dernière sync 2 min', tone: 'blue' },
  { label: 'Housekeeping', value: '12 employés', detail: '4 checklists', tone: 'violet' },
  { label: 'API & Webhooks', value: '8 actifs', detail: '1 erreur récente', tone: 'amber' },
];

export const settingsOverviewAlerts = [
  '3 chambres sans étage configuré',
  '1 mapping PMS manquant : room_type “DLX”',
  'La clé API Channel Manager expire dans 12 jours',
  'Nouvelle version fiscale disponible : FR-2026.09',
];
```

- [ ] **Step 2: Add section catalog entries**

Add `settingsSections: Record<PageId, SettingsSection>` entries for every `settings_*` id. Use the module plan text as content. Keep secrets masked, e.g. `••••••••••••7842`.

- [ ] **Step 3: Verify all PageIds are represented**

Run:

```bash
rg "settings_backups|settings_fiscal|settings_pms_sync" frontend/src/domains/settings/catalog.ts
```

Expected: all three IDs appear.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/domains/settings/catalog.ts
git commit -m "Add settings module catalog"
```

## Task 3: Build SettingsModule UI

**Files:**
- Create: `frontend/src/domains/settings/SettingsModule.tsx`

- [ ] **Step 1: Create shell component**

Implement:

```tsx
import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  Settings,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import type { PageId } from '@/src/types';
import { useConfigStore } from '@/src/store/configStore';
import {
  settingsOverviewAlerts,
  settingsOverviewMetrics,
  settingsSections,
  type SettingsMetric,
  type SettingsSection,
  type SettingsTone,
} from './catalog';

interface SettingsModuleProps {
  activePage: PageId;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ activePage }) => {
  const hotelName = useConfigStore((state) => state.hotel.name);
  const section = settingsSections[activePage] ?? settingsSections.settings;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <div className="mx-auto max-w-7xl space-y-8 p-8">
        <SettingsHeader hotelName={hotelName} />
        {activePage === 'settings' ? <SettingsOverview /> : <SettingsDetail section={section} />}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add header and overview**

Add header with search input and action buttons. Add overview metrics and alerts using `settingsOverviewMetrics` and `settingsOverviewAlerts`.

- [ ] **Step 3: Add detail renderer**

Render `fields`, `table`, `metrics`, `checklist`, and `actions` from the selected section. Inputs are controlled visually with `defaultValue`; no DB writes in Phase 1.

- [ ] **Step 4: Add tone helpers**

Implement `toneClasses(tone: SettingsTone)` returning border/text/background classes for the six tones.

- [ ] **Step 5: Verify dev server markers**

Run:

```bash
curl --max-time 5 -s http://127.0.0.1:3000/src/domains/settings/SettingsModule.tsx | rg "SettingsModule|SettingsOverview|SettingsDetail"
```

Expected: markers are present once dev server is running.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/domains/settings/SettingsModule.tsx
git commit -m "Build settings module shell"
```

## Task 4: Connect section content and UX safeguards

**Files:**
- Modify: `frontend/src/domains/settings/catalog.ts`
- Modify: `frontend/src/domains/settings/SettingsModule.tsx`

- [ ] **Step 1: Add fiscal/security disclaimers**

Ensure `settings_fiscal`, `settings_api`, `settings_users`, `settings_rgpd`, and `settings_backups` include clear non-destructive Phase 1 messaging:

```ts
'Phase 1 : affichage et préparation. Toute sauvegarde durable exigera RBAC, validation Zod, RLS et audit immuable.'
```

- [ ] **Step 2: Add masked secret fields**

For API/PPF/webhooks, use field values like `••••••••••••7842`, never real keys.

- [ ] **Step 3: Add instant feedback actions**

In `SettingsModule.tsx`, action buttons should set a transient local message:

```tsx
const [message, setMessage] = React.useState<string | null>(null);
const handleAction = (label: string) => {
  setMessage(`${label} préparé — persistance sécurisée prévue en Phase 2.`);
  window.setTimeout(() => setMessage(null), 2800);
};
```

- [ ] **Step 4: Verify no secrets**

Run:

```bash
rg "sk_|service_role|SUPABASE_SERVICE|api_key=.*[A-Za-z0-9]{20}" frontend/src/domains/settings
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domains/settings/catalog.ts frontend/src/domains/settings/SettingsModule.tsx
git commit -m "Add settings UX safeguards"
```

## Task 5: Final verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 2: Serve marker check**

Run:

```bash
curl -I --max-time 5 http://127.0.0.1:3000/
curl --max-time 5 -s http://127.0.0.1:3000/src/domains/settings/catalog.ts | rg "settings_backups|Fiscalité France 2026|PMS externe"
```

Expected: HTTP 200 and markers present.

- [ ] **Step 3: Review changed files**

Run:

```bash
git diff --stat
```

Expected: only Settings module, App routing, and docs changed.

- [ ] **Step 4: Commit final fixes if any**

```bash
git add .
git commit -m "Finalize settings module phase 1"
```

Skip this commit if there are no remaining changes.
