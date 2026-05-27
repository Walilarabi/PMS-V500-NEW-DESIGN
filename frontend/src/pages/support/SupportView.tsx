import React, { useState } from 'react';
import { Headphones, PlusCircle, List } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card } from '@/src/components/ui/Card';
import { TicketForm } from './TicketForm';
import { TicketTable } from './TicketTable';
import { useSupportTickets } from '@/src/services/support/hooks';
import { useAuth } from '@/src/domains/auth/AuthContext';

type Tab = 'form' | 'tickets';

export const SupportView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('form');
  const { session } = useAuth();

  const hotelId   = session?.tenantId ?? null;
  const userEmail = session?.email ?? undefined;
  const userRole  = session?.role ?? undefined;

  const ticketsQ = useSupportTickets(hotelId);
  const newCount = ticketsQ.data?.filter(t => t.status === 'nouveau').length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center">
            <Headphones size={20} className="text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Support technique</h1>
            <p className="text-sm text-gray-400 mt-0.5">Signalez un problème ou demandez une assistance</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
          {([
            { key: 'form'    as Tab, label: 'Nouveau ticket', icon: PlusCircle, badge: 0 },
            { key: 'tickets' as Tab, label: 'Mes tickets',    icon: List,       badge: newCount },
          ]).map(({ key, label, icon: Icon, badge }) => (
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

      {/* Content */}
      {tab === 'form' ? (
        <Card className="p-6">
          <div className="mb-5">
            <h2 className="text-sm font-bold text-gray-900">Signaler un problème</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">
              Remplissez les champs ci-dessous. Le contexte technique est collecté automatiquement — inutile d'ajouter une capture si les informations sont claires.
            </p>
          </div>
          {hotelId ? (
            <TicketForm
              hotelId={hotelId}
              userEmail={userEmail}
              userRole={userRole ?? undefined}
              currentModule="Support"
              currentPage={window.location.pathname}
              onSuccess={() => {
                ticketsQ.refetch();
                setTab('tickets');
              }}
            />
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">Aucun hôtel actif — veuillez vous connecter.</p>
          )}
        </Card>
      ) : (
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
