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
          <SettingsContent activePage={activePage} />
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

const SettingsContent: React.FC<{ activePage: PageId }> = ({ activePage }) => {
  if (activePage === 'settings') return <SettingsControlCenter />;
  return <SettingsModule activePage={activePage} />;
};
