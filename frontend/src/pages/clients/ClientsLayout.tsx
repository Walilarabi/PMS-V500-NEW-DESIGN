/**
 * FLOWTYM — Clients / CRM Layout (Wave C1)
 *
 * Shell unifié routant toutes les pages du module Client :
 * liste clients, sociétés, segments, fusion, documents, blacklist, tiers.
 *
 * Pattern identique à FinanceLayout : App.tsx envoie activePage,
 * le layout route vers la bonne sous-vue.
 */

import React from 'react';
import {
  Users,
  Building2,
  Target,
  GitMerge,
  FileText,
  Ban,
  Handshake,
  Construction,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ClientsView } from '../ClientsView';
import { CompaniesView } from './CompaniesView';
import { TiersView } from './TiersView';
import { SegmentsView } from './SegmentsView';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export type ClientsPage =
  | 'clients'
  | 'clients_companies'
  | 'clients_segments'
  | 'clients_merge'
  | 'clients_documents'
  | 'clients_blacklist'
  | 'clients_tiers';

const PAGE_META: Record<ClientsPage, { title: string; subtitle: string }> = {
  clients:           { title: 'Fiches Clients',           subtitle: 'Base clients enrichie depuis les réservations' },
  clients_companies: { title: 'Sociétés / Agences',       subtitle: 'Entreprises, agences et tour-opérateurs' },
  clients_segments:  { title: 'Segments marketing',       subtitle: 'Segmentation dynamique et ciblage' },
  clients_merge:     { title: 'Fusion / Dédoublonnage',   subtitle: 'Détection et fusion des doublons' },
  clients_documents: { title: 'Documents & signatures',   subtitle: 'Pièces d\'identité et contrats' },
  clients_blacklist: { title: 'Blacklist / Watchlist',    subtitle: 'Clients signalés et historique incidents' },
  clients_tiers:     { title: 'Tiers / Prescripteurs',   subtitle: 'Partenaires, apporteurs d\'affaires' },
};

// Placeholder générique pour les pages non encore implémentées
const ComingSoon = ({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#F9FAFB]">
    <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
      <Icon size={32} className="text-[#8B5CF6]" />
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
    <p className="text-sm text-gray-400 max-w-sm">{subtitle}</p>
    <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-[#8B5CF6]/5 rounded-xl">
      <Construction size={14} className="text-[#8B5CF6]" />
      <span className="text-xs font-bold text-[#8B5CF6]">En cours de développement — Wave C2+</span>
    </div>
  </div>
);

export interface ClientsLayoutProps {
  activePage: ClientsPage;
}

export const ClientsLayout: React.FC<ClientsLayoutProps> = ({ activePage }) => {
  const renderPage = () => {
    switch (activePage) {
      case 'clients':
        return <ClientsView />;

      case 'clients_companies':
        return <CompaniesView />;

      case 'clients_segments':
        return <SegmentsView />;

      case 'clients_merge':
        return (
          <ComingSoon
            title="Fusion / Dédoublonnage"
            subtitle="Détection automatique des doublons par similarité de nom, email ou téléphone."
            icon={GitMerge}
          />
        );

      case 'clients_documents':
        return (
          <ComingSoon
            title="Documents & signatures"
            subtitle="Stockage sécurisé des pièces d'identité, passeports et contrats signés."
            icon={FileText}
          />
        );

      case 'clients_blacklist':
        return (
          <ComingSoon
            title="Blacklist / Watchlist"
            subtitle="Gestion des clients signalés, historique des incidents et alertes à la réservation."
            icon={Ban}
          />
        );

      case 'clients_tiers':
        return <TiersView />;

      default:
        return <ClientsView />;
    }
  };

  const meta = PAGE_META[activePage] ?? PAGE_META.clients;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#8B5CF6]/10">
            <Users size={18} className="text-[#8B5CF6]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{meta.title}</h2>
            <p className="text-[11px] text-gray-400">{meta.subtitle}</p>
          </div>
        </div>

        {/* Quick-nav tabs (visible only when relevant) */}
        <div className="hidden lg:flex items-center gap-1">
          {(
            [
              ['clients',           'Clients',       Users],
              ['clients_companies', 'Sociétés',      Building2],
              ['clients_segments',  'Segments',      Target],
              ['clients_tiers',     'Prescripteurs', Handshake],
              ['clients_blacklist', 'Blacklist',     Ban],
            ] as [ClientsPage, string, LucideIcon][]
          ).map(([page, label, Icon]) => (
            <button
              key={page}
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }))
              }
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
                activePage === page
                  ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50',
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">{renderPage()}</div>
    </div>
  );
};

export default ClientsLayout;
