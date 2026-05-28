import React, { useState } from 'react';
import { Headphones, PlusCircle, List, BookOpen, ChevronLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card } from '@/src/components/ui/Card';
import { DocumentationView } from './DocumentationView';
import { ExternalCheckWizard } from './ExternalCheckWizard';
import { TicketForm } from './TicketForm';
import { TicketTable } from './TicketTable';
import { useSupportTickets } from '@/src/services/support/hooks';
import { useAuth } from '@/src/domains/auth/AuthContext';

type Tab = 'docs' | 'new' | 'tickets';

interface DiagnosticContext {
  externalFactorsChecked: string[];
  externalCheckResult?: string;
}

export const SupportView: React.FC = () => {
  const [tab, setTab]                 = useState<Tab>('docs');
  const [wizardDone, setWizardDone]   = useState(false);
  const [diagContext, setDiagContext] = useState<DiagnosticContext | null>(null);
  const { session } = useAuth();

  const hotelId   = session?.tenantId ?? null;
  const userEmail = session?.email ?? undefined;
  const userRole  = session?.role ?? undefined;

  const ticketsQ = useSupportTickets(hotelId);
  const newCount = ticketsQ.data?.filter(t => t.status === 'nouveau').length ?? 0;

  const handleWizardDone = (result: DiagnosticContext) => {
    setDiagContext(result);
    setWizardDone(true);
  };

  const TABS = [
    { key: 'docs'    as Tab, label: 'Documentation', icon: BookOpen,   badge: 0 },
    { key: 'new'     as Tab, label: 'Nouveau ticket', icon: PlusCircle, badge: 0 },
    { key: 'tickets' as Tab, label: 'Mes tickets',    icon: List,       badge: newCount },
  ];

  const subtitle =
    tab === 'docs'    ? 'Consultez le manuel d\'utilisation, organisé par module'
    : tab === 'new'   ? (wizardDone ? 'Signalement de problème interne' : 'Diagnostic externe — étape obligatoire')
    : 'Suivi de vos tickets';

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center">
            <Headphones size={20} className="text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Aide & Support</h1>
            <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
          {TABS.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors',
                tab === key
                  ? 'bg-[#8B5CF6] text-white shadow-sm shadow-[#8B5CF6]/30'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <Icon size={13} />
              {label}
              {badge > 0 && (
                <span className={cn(
                  'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                  tab === key ? 'bg-white text-[#8B5CF6]' : 'bg-[#8B5CF6] text-white',
                )}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab — Documentation */}
      {tab === 'docs' && <DocumentationView />}

      {/* Tab — Nouveau ticket (wizard → form) */}
      {tab === 'new' && (
        <Card className="p-6">
          {!wizardDone ? (
            <>
              <div className="mb-5">
                <h2 className="text-sm font-bold text-gray-900">Étape 1 — Vérification des facteurs externes</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  La majorité des problèmes viennent de l'environnement, pas du PMS. Vérifiez ces points avant de créer un ticket.
                </p>
              </div>
              <ExternalCheckWizard onProceed={handleWizardDone} />
            </>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Étape 2 — Signaler un problème interne</h2>
                  <p className="text-[12px] text-gray-400 mt-0.5">
                    Le contexte technique et l'analyse de risque sont collectés automatiquement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardDone(false)}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ChevronLeft size={13} />
                  Diagnostic
                </button>
              </div>
              {hotelId ? (
                <TicketForm
                  hotelId={hotelId}
                  userEmail={userEmail}
                  userRole={userRole ?? undefined}
                  currentModule="Support"
                  currentPage={window.location.pathname}
                  diagnosticContext={diagContext ?? undefined}
                  onSuccess={() => {
                    ticketsQ.refetch();
                    setTab('tickets');
                    setWizardDone(false);
                  }}
                />
              ) : (
                <p className="text-sm text-gray-400 py-8 text-center">Aucun hôtel actif — veuillez vous connecter.</p>
              )}
            </>
          )}
        </Card>
      )}

      {/* Tab — Mes tickets */}
      {tab === 'tickets' && (
        <TicketTable
          tickets={ticketsQ.data ?? []}
          isLoading={ticketsQ.isLoading}
          onRefresh={() => ticketsQ.refetch()}
        />
      )}
    </div>
  );
};

export default SupportView;
