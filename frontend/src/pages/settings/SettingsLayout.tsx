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

import React, { useMemo, useState } from 'react';
import { Menu, X as XIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { DebugPanel } from '@/src/components/DebugPanel';
import type { PageId } from '@/src/types';
import {
  SETTINGS_NAVIGATION,
  findDomainForPage,
  type SettingsDomain,
} from './settingsNavigation';
import { SettingsCommandPalette, useCommandPalette } from './SettingsCommandPalette';
import { SettingsControlCenter } from './SettingsControlCenter';
import { SettingsModule } from '@/src/domains/settings/SettingsModule';
import { SettingsPlaceholder } from './pages/SettingsPlaceholder';
import { HotelInfoPage } from './pages/HotelInfoPage';
import { LocalTaxesPage } from './pages/LocalTaxesPage';
import { UsersPage } from './pages/UsersPage';
import { FloorsPage } from './pages/FloorsPage';
import { BackupsPage } from './pages/BackupsPage';
import { AuditPage } from './pages/AuditPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { BrandingPage } from './pages/BrandingPage';
import { LanguagesPage } from './pages/LanguagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ConnectorsPage } from './pages/ConnectorsPage';
import { RgpdPage } from './pages/RgpdPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { RoomsPage } from './pages/RoomsPage';
import { RolesAccessPage } from './pages/RolesAccessPage';
import { SessionsPage } from './pages/SessionsPage';
import { RatePlansPage } from './pages/RatePlansPage';
import { PartnersPage } from './pages/PartnersPage';
import { PaymentModesPage } from './pages/PaymentModesPage';
// Wave 9 — Inventaire
import { RoomTypesPage } from './pages/RoomTypesPage';
import { RoomStatusPage } from './pages/RoomStatusPage';
import { PreferencesPage } from './pages/PreferencesPage';
// Wave 10 — Tarifs & Prestations
import { ProductsPage } from './pages/ProductsPage';
import { ConditionsPage } from './pages/ConditionsPage';
import { SeasonsPage } from './pages/SeasonsPage';
import { AgeCategoriesPage } from './pages/AgeCategoriesPage';
// Wave 11 — Finance
import { InvoicePage } from './pages/InvoicePage';
import { NumberingPage } from './pages/NumberingPage';
import { AccountingPage } from './pages/AccountingPage';
import { DebtorsPage } from './pages/DebtorsPage';
import { FiscalPage } from './pages/FiscalPage';
// Wave 12 — Housekeeping
import {
  HkStatusPage, HkChecklistsPage, HkStaffPage, HkDistributionPage,
  MaintenancePage, LostFoundPage, BreakfastPage,
} from './pages/HousekeepingPages';
// Wave 13 — Automation & Distribution
import {
  AutomationsPage, AiRulesPage, AiStrategiesPage,
  OtaMappingPage, OtaParityPage, DistributionLogsPage, PmsSyncPage,
} from './pages/AutomationPages';
// Wave 14 — Reservations
import {
  CancellationPage, GuaranteesPage, NoShowPage, EmailTemplatesPage,
} from './pages/ReservationPages';
// Wave 15 — Establishment restant
import {
  MultiHotelPage, TimezonePage, ContactPage, LegalDocsPage,
  PhotosPage, ClassificationPage, CompliancePage,
} from './pages/EstablishmentPages';
// Wave 16 — Intégrations spécifiques
import {
  PosPage, LocksPage, KioskPage, PaymentIntegPage,
  LighthouseIntegPage, ExpediaIntegPage, BookingIntegPage,
  PublicApiPage, WebhooksPage,
} from './pages/IntegrationPages';
// Wave 17 — Import / Export
import { ImportExportPage } from './pages/ImportExportPage';
import { CommunicationSettingsPage } from './pages/CommunicationSettingsPage';

/**
 * Toutes les pages Settings ont désormais leur composant dédié natif.
 * Le SettingsModule legacy n'est plus utilisé — conservé en fallback de
 * dernier recours pour les PageIds non reconnues (placeholder propre).
 */
const LEGACY_CATALOG_PAGES: ReadonlySet<PageId> = new Set<PageId>([]);

interface SettingsLayoutProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ activePage, onNavigate }) => {
  const activeDomain = useMemo(() => findDomainForPage(activePage), [activePage]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Cmd+K palette globale (Phase 6)
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();

  function handleDomainChange(d: SettingsDomain) {
    // Par défaut, on charge le premier sous-menu du nouveau domaine
    const first = d.items[0]?.id;
    if (first) onNavigate(first);
  }

  function handleSubNav(page: PageId) {
    onNavigate(page);
    setMobileMenuOpen(false);  // ferme le drawer mobile après navigation
  }

  const activeItem = activeDomain.items.find((i) => i.id === activePage);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/60">
      {/* Cmd+K palette globale */}
      <SettingsCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={onNavigate}
      />

      {/* ─── Onglets horizontaux des 10 domaines ─────────────────────── */}
      <SettingsTopTabs
        activeDomainId={activeDomain.id}
        onDomainChange={handleDomainChange}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* ─── Barre mobile : burger + breadcrumb ──────────────────────── */}
      <div className="lg:hidden shrink-0 px-4 py-2 bg-white border-b border-slate-100 flex items-center gap-2">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg hover:bg-slate-100"
          aria-label="Ouvrir le sous-menu"
        >
          <Menu className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0 text-[12.5px] text-slate-600 truncate">
          {activeDomain.label} <span className="text-slate-400">·</span>{' '}
          <span className="font-semibold text-slate-900">{activeItem?.label ?? 'Vue générale'}</span>
        </div>
      </div>

      {/* ─── Sub-nav + contenu ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side nav desktop (visible ≥ lg) */}
        <div className="hidden lg:block">
          <SettingsSideNav
            domain={activeDomain}
            activePage={activePage}
            onNavigate={handleSubNav}
          />
        </div>
        {/* Side nav mobile (drawer overlay) */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative z-10 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-900">{activeDomain.label}</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <XIcon className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <SettingsSideNav
                domain={activeDomain}
                activePage={activePage}
                onNavigate={handleSubNav}
                fullWidth
              />
            </div>
          </div>
        )}
        <main className="flex-1 overflow-hidden flex flex-col">
          <SettingsContent activePage={activePage} onNavigate={onNavigate} />
        </main>
      </div>

      {/* ─── Debug panel — visible uniquement dans Paramètres ────────── */}
      <DebugPanel />
    </div>
  );
};

// ─── Top tabs ──────────────────────────────────────────────────────────────

const SettingsTopTabs: React.FC<{
  activeDomainId: string;
  onDomainChange: (d: SettingsDomain) => void;
  onOpenPalette?: () => void;
}> = ({ activeDomainId, onDomainChange, onOpenPalette }) => (
  <nav
    aria-label="Domaines Paramètres"
    className="shrink-0 bg-white border-b border-slate-100 overflow-x-auto flex items-stretch"
  >
    <ul className="flex items-stretch gap-1 px-4 min-w-max flex-1">
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
    {onOpenPalette && (
      <button
        onClick={onOpenPalette}
        className="shrink-0 inline-flex items-center gap-2 px-3 mx-2 my-1.5 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 text-[12px] text-slate-600 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-200 transition-colors"
        title="Recherche globale dans les Paramètres (Cmd+K)"
      >
        <span>Rechercher</span>
        <kbd className="font-mono bg-white px-1.5 py-0.5 rounded ring-1 ring-slate-200 text-[10px] text-slate-500">⌘K</kbd>
      </button>
    )}
  </nav>
);

// ─── Side nav ──────────────────────────────────────────────────────────────

const SettingsSideNav: React.FC<{
  domain: SettingsDomain;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  fullWidth?: boolean;
}> = ({ domain, activePage, onNavigate, fullWidth }) => (
  <aside
    aria-label={`Sous-menu ${domain.label}`}
    className={cn(
      'bg-white border-r border-slate-100 overflow-y-auto',
      fullWidth ? 'w-full flex-1' : 'shrink-0 w-64',
    )}
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
  if (activePage === 'settings_system_health') return <SystemHealthPage />;
  if (activePage === 'settings_branding') return <BrandingPage />;
  if (activePage === 'settings_languages') return <LanguagesPage />;
  if (activePage === 'settings_notifications') return <NotificationsPage />;
  if (activePage === 'settings_connectors') return <ConnectorsPage />;
  if (activePage === 'settings_rgpd') return <RgpdPage />;
  if (activePage === 'settings_api') return <ApiKeysPage />;
  if (activePage === 'settings_rooms') return <RoomsPage />;
  if (activePage === 'settings_roles') return <RolesAccessPage />;
  if (activePage === 'settings_sessions') return <SessionsPage />;
  if (activePage === 'settings_rate_plans') return <RatePlansPage onNavigate={onNavigate} />;
  if (activePage === 'settings_partners') return <PartnersPage />;
  if (activePage === 'settings_payment_modes') return <PaymentModesPage />;

  // ─── Wave 9 — Inventaire ──────────────────────────────────────────────
  if (activePage === 'settings_room_types') return <RoomTypesPage onNavigate={onNavigate} />;
  if (activePage === 'settings_room_status') return <RoomStatusPage />;
  if (activePage === 'settings_preferences') return <PreferencesPage />;

  // ─── Wave 10 — Tarifs & Prestations ───────────────────────────────────
  if (activePage === 'settings_products') return <ProductsPage />;
  if (activePage === 'settings_conditions') return <ConditionsPage />;
  if (activePage === 'settings_seasons') return <SeasonsPage />;
  if (activePage === 'settings_age_categories') return <AgeCategoriesPage />;

  // ─── Wave 11 — Finance ────────────────────────────────────────────────
  if (activePage === 'settings_invoice') return <InvoicePage />;
  if (activePage === 'settings_numbering') return <NumberingPage />;
  if (activePage === 'settings_accounting') return <AccountingPage />;
  if (activePage === 'settings_debtors') return <DebtorsPage />;
  if (activePage === 'settings_fiscal') return <FiscalPage />;

  // ─── Wave 12 — Housekeeping ───────────────────────────────────────────
  if (activePage === 'settings_hk_status') return <HkStatusPage />;
  if (activePage === 'settings_hk_checklists') return <HkChecklistsPage />;
  if (activePage === 'settings_hk_staff') return <HkStaffPage />;
  if (activePage === 'settings_hk_distribution') return <HkDistributionPage />;
  if (activePage === 'settings_maintenance') return <MaintenancePage />;
  if (activePage === 'settings_lost_found') return <LostFoundPage />;
  if (activePage === 'settings_breakfast') return <BreakfastPage />;

  // ─── Wave 13 — Automation & Distribution ──────────────────────────────
  if (activePage === 'settings_automations') return <AutomationsPage />;
  if (activePage === 'settings_ai_rules') return <AiRulesPage />;
  if (activePage === 'settings_ai_strategies') return <AiStrategiesPage />;
  if (activePage === 'settings_ota_mapping') return <OtaMappingPage />;
  if (activePage === 'settings_ota_parity') return <OtaParityPage />;
  if (activePage === 'settings_distribution_logs') return <DistributionLogsPage />;
  if (activePage === 'settings_pms_sync') return <PmsSyncPage />;

  // ─── Wave 14 — Réservations ───────────────────────────────────────────
  if (activePage === 'settings_cancellation') return <CancellationPage />;
  if (activePage === 'settings_guarantees') return <GuaranteesPage />;
  if (activePage === 'settings_no_show') return <NoShowPage />;
  if (activePage === 'settings_email_templates') return <EmailTemplatesPage />;
  if (activePage === 'settings_communication') return <CommunicationSettingsPage />;

  // ─── Wave 15 — Établissement restant ──────────────────────────────────
  if (activePage === 'settings_multihotel') return <MultiHotelPage />;
  if (activePage === 'settings_timezone') return <TimezonePage />;
  if (activePage === 'settings_contact') return <ContactPage />;
  if (activePage === 'settings_legal_docs') return <LegalDocsPage />;
  if (activePage === 'settings_photos') return <PhotosPage />;
  if (activePage === 'settings_classification') return <ClassificationPage />;
  if (activePage === 'settings_compliance') return <CompliancePage />;

  // ─── Wave 16 — Intégrations spécifiques ───────────────────────────────
  if (activePage === 'settings_pos') return <PosPage />;
  if (activePage === 'settings_locks') return <LocksPage />;
  if (activePage === 'settings_kiosk') return <KioskPage />;
  if (activePage === 'settings_payment_integ') return <PaymentIntegPage />;
  if (activePage === 'settings_lighthouse_integ') return <LighthouseIntegPage />;
  if (activePage === 'settings_expedia_integ') return <ExpediaIntegPage />;
  if (activePage === 'settings_booking_integ') return <BookingIntegPage />;
  if (activePage === 'settings_public_api') return <PublicApiPage />;
  if (activePage === 'settings_webhooks') return <WebhooksPage />;

  // ─── Wave 17 — Import / Export ────────────────────────────────────────
  if (activePage === 'settings_import_export') return <ImportExportPage />;

  if (LEGACY_CATALOG_PAGES.has(activePage)) return <SettingsModule activePage={activePage} />;
  return <SettingsPlaceholder activePage={activePage} onNavigate={onNavigate} />;
};
