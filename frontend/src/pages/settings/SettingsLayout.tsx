/**
 * FLOWTYM RMS — Settings Layout (Control Center premium).
 *
 * Architecture exacte du visuel validé :
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  Topbar globale Flowtym  (Flowday / SAS / … / Paramètres actif) │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │  Onglets horizontaux des 10 domaines Paramètres                  │
 *   ├────────────┬─────────────────────────────────────────────────────┤
 *   │            │                                                     │
 *   │  Sub-nav   │              Contenu principal                      │
 *   │  vertical  │              (Control Center ou détail)             │
 *   │            │                                                     │
 *   └────────────┴─────────────────────────────────────────────────────┘
 *
 * Règles UX :
 *   • le 1er sous-menu du domaine actif est sélectionné par défaut quand
 *     l'utilisateur change d'onglet ;
 *   • le sous-menu actif a un fond violet clair + indicateur latéral ;
 *   • tout changement met à jour `activePage` (source de vérité de App.tsx)
 *     — pas de duplication d'état.
 *
 * Le contenu principal délègue :
 *   • Vue générale (activePage = 'settings') → SettingsControlCenter
 *   • Toute autre sous-page → SettingsModule legacy (catalogue détaillé)
 */

import React, { useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import type { PageId } from '@/src/types';
import {
  SETTINGS_NAVIGATION,
  findDomainForPage,
  type SettingsDomain,
} from './settingsNavigation';
import { SettingsControlCenter } from './SettingsControlCenter';
import { SettingsModule } from '@/src/domains/settings/SettingsModule';
import { SettingsPlaceholder } from './pages/SettingsPlaceholder';
import { HotelInfoPage } from './pages/HotelInfoPage';
import { LocalTaxesPage } from './pages/LocalTaxesPage';
import { UsersPage } from './pages/UsersPage';
import { FloorsPage } from './pages/FloorsPage';
import { BackupsPage } from './pages/BackupsPage';
import { AuditPage } from './pages/AuditPage';
import { BrandingPage } from './pages/BrandingPage';
import { LanguagesPage } from './pages/LanguagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ConnectorsPage } from './pages/ConnectorsPage';

/**
 * PageIds couvertes par le catalogue SettingsModule legacy.
 * Les autres sous-pages (Branding, Langues, Fuseaux, etc.) ne sont pas
 * encore dans le catalogue ; on les route vers SettingsPlaceholder qui
 * affiche un état "Phase 2" propre avec liens vers les pages connexes.
 */
const LEGACY_CATALOG_PAGES: ReadonlySet<PageId> = new Set<PageId>([
  'settings_multihotel',
  'settings_room_types',
  'settings_rooms',
  'settings_room_status',
  'settings_preferences',
  'settings_products',
  'settings_rate_plans',
  'settings_conditions',
  'settings_seasons',
  'settings_age_categories',
  'settings_invoice',
  'settings_numbering',
  'settings_payment_modes',
  'settings_accounting',
  'settings_debtors',
  'settings_fiscal',
  'settings_hk_status',
  'settings_hk_checklists',
  'settings_hk_staff',
  'settings_hk_distribution',
  'settings_maintenance',
  'settings_lost_found',
  'settings_breakfast',
  'settings_pms_sync',
  'settings_api',
  'settings_automations',
  'settings_rgpd',
  'settings_import_export',
]);

interface SettingsLayoutProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ activePage, onNavigate }) => {
  const activeDomain = useMemo(() => findDomainForPage(activePage), [activePage]);

  function handleDomainChange(d: SettingsDomain) {
    // Par défaut, on charge le premier sous-menu du nouveau domaine
    const first = d.items[0]?.id;
    if (first) onNavigate(first);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/60">
      {/* ─── Onglets horizontaux des 10 domaines ─────────────────────── */}
      <SettingsTopTabs
        activeDomainId={activeDomain.id}
        onDomainChange={handleDomainChange}
      />

      {/* ─── Sub-nav + contenu ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <SettingsSideNav
          domain={activeDomain}
          activePage={activePage}
          onNavigate={onNavigate}
        />
        <main className="flex-1 overflow-hidden flex flex-col">
          <SettingsContent activePage={activePage} onNavigate={onNavigate} />
        </main>
      </div>
    </div>
  );
};

// ─── Top tabs ──────────────────────────────────────────────────────────────

const SettingsTopTabs: React.FC<{
  activeDomainId: string;
  onDomainChange: (d: SettingsDomain) => void;
}> = ({ activeDomainId, onDomainChange }) => (
  <nav
    aria-label="Domaines Paramètres"
    className="shrink-0 bg-white border-b border-slate-100 overflow-x-auto"
  >
    <ul className="flex items-stretch gap-1 px-4 min-w-max">
      {SETTINGS_NAVIGATION.map((d) => {
        const Icon = d.icon;
        const active = d.id === activeDomainId;
        return (
          <li key={d.id}>
            <button
              onClick={() => onDomainChange(d)}
              className={cn(
                'relative inline-flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-medium transition-colors',
                'border-b-2 -mb-px',
                active
                  ? 'text-violet-700 border-violet-600 bg-violet-50/60'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50',
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', active ? 'text-violet-600' : 'text-slate-400')} />
              <span className="whitespace-nowrap">{d.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

// ─── Side nav ──────────────────────────────────────────────────────────────

const SettingsSideNav: React.FC<{
  domain: SettingsDomain;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}> = ({ domain, activePage, onNavigate }) => (
  <aside
    aria-label={`Sous-menu ${domain.label}`}
    className="shrink-0 w-64 bg-white border-r border-slate-100 overflow-y-auto"
  >
    <div className="px-4 py-4 border-b border-slate-50">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
        Domaine
      </div>
      <div className="mt-1 text-[13.5px] font-semibold text-slate-900">{domain.label}</div>
    </div>
    <ul className="py-2 px-2">
      {domain.items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activePage;
        return (
          <li key={item.id}>
            <button
              onClick={() => onNavigate(item.id)}
              className={cn(
                'group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors relative',
                active
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              {/* Indicateur latéral subtil quand actif */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-violet-600" />
              )}
              <Icon
                className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  active ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600',
                )}
              />
              <span className="truncate">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  </aside>
);

// ─── Content router ────────────────────────────────────────────────────────

/**
 * Aiguille la PageId vers le bon composant :
 *   • 'settings' (Vue générale)         → SettingsControlCenter (cockpit vivant)
 *   • 'settings_hotel'                  → HotelInfoPage (éditeur réel)
 *   • 'settings_taxes_local'            → LocalTaxesPage (éditeur réel)
 *   • Pages legacy du catalogue         → SettingsModule
 *   • Toutes les autres (Phase 2)       → SettingsPlaceholder
 */
const SettingsContent: React.FC<{
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}> = ({ activePage, onNavigate }) => {
  if (activePage === 'settings') return <SettingsControlCenter />;
  if (activePage === 'settings_hotel') return <HotelInfoPage onNavigate={onNavigate} />;
  if (activePage === 'settings_taxes_local') return <LocalTaxesPage />;
  if (activePage === 'settings_users') return <UsersPage />;
  if (activePage === 'settings_floors') return <FloorsPage />;
  if (activePage === 'settings_backups') return <BackupsPage />;
  if (activePage === 'settings_audit') return <AuditPage />;
  if (activePage === 'settings_branding') return <BrandingPage />;
  if (activePage === 'settings_languages') return <LanguagesPage />;
  if (activePage === 'settings_notifications') return <NotificationsPage />;
  if (activePage === 'settings_connectors') return <ConnectorsPage />;
  if (LEGACY_CATALOG_PAGES.has(activePage)) return <SettingsModule activePage={activePage} />;
  return <SettingsPlaceholder activePage={activePage} onNavigate={onNavigate} />;
};
