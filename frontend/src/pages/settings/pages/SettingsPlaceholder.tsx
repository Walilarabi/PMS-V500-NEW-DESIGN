/**
 * FLOWTYM — Settings · placeholder Phase 2 pour les sous-pages
 * sans backend implémenté.
 *
 * Affiché par le content router quand l'utilisateur navigue vers une
 * sous-page Paramètres qui n'a pas encore d'implémentation dédiée.
 * Lit la navigation pour récupérer le libellé, l'icône et le domaine
 * d'appartenance — pas de chaîne en dur.
 */
import React from 'react';
import { ArrowLeft, Construction, ExternalLink } from 'lucide-react';
import type { PageId } from '@/src/types';
import { findDomainForPage, SETTINGS_NAVIGATION } from '../settingsNavigation';

interface SettingsPlaceholderProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export const SettingsPlaceholder: React.FC<SettingsPlaceholderProps> = ({ activePage, onNavigate }) => {
  const domain = findDomainForPage(activePage);
  const item = domain.items.find((i) => i.id === activePage);
  const Icon = item?.icon ?? Construction;
  const DomainIcon = domain.icon;
  const otherSubs = domain.items.filter((i) => i.id !== activePage).slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-400">
              <DomainIcon className="w-3 h-3" />
              {domain.label}
            </div>
            <h1 className="text-[22px] font-bold text-slate-950 leading-tight">{item?.label ?? 'Paramètres'}</h1>
            <p className="text-[12.5px] text-slate-500 mt-1">
              Cette page est en cours d'implémentation dans la roadmap Flowtym.
            </p>
          </div>
        </header>

        {/* Bandeau Phase 2 */}
        <section className="rounded-2xl ring-1 ring-amber-200 bg-amber-50/60 p-5 flex items-start gap-3">
          <Construction className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-amber-900">Disponible en Phase 2</div>
            <p className="text-[12.5px] text-amber-800 mt-1 leading-relaxed">
              L'interface visuelle et les contrôles métier de cette page sont prévus dans la prochaine vague
              de livraison. La structure de routage et la navigation sont en place — il ne reste qu'à
              implémenter les contrôles spécifiques (formulaires, intégrations, validations).
            </p>
            <p className="text-[12px] text-amber-700 mt-2">
              En attendant, consultez les pages connexes ci-dessous ou revenez au Control Center pour piloter
              votre PMS.
            </p>
          </div>
        </section>

        {/* Pages connexes du même domaine */}
        {otherSubs.length > 0 && (
          <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-3">
              Autres pages de {domain.label}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {otherSubs.map((it) => {
                const I = it.icon;
                return (
                  <button
                    key={it.id}
                    onClick={() => onNavigate(it.id)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-700 transition-colors text-left text-[12.5px] font-medium text-slate-700 group"
                  >
                    <I className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-500" />
                    <span className="flex-1 truncate">{it.label}</span>
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-violet-500" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Retour Vue générale */}
        <div className="flex justify-start">
          <button
            onClick={() => onNavigate('settings')}
            className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour Control Center
          </button>
        </div>
      </div>
    </div>
  );
};
