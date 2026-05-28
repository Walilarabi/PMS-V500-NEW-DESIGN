import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Eye, X, Bot, Shield, Layers, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { RISK_COLORS, type RiskScore } from '@/src/services/support/risk';
import type { SupportTicket, TicketStatus } from '@/src/services/support/support.service';
import { useUpdateTicketStatus } from '@/src/services/support/hooks';

const STATUS_META: Record<TicketStatus, { label: string; colors: string }> = {
  nouveau:             { label: 'Nouveau',             colors: 'bg-blue-50 text-blue-600 border-blue-100' },
  en_analyse:          { label: 'En analyse',          colors: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20' },
  attente_utilisateur: { label: 'Attente utilisateur', colors: 'bg-amber-50 text-amber-600 border-amber-100' },
  en_correction:       { label: 'En correction',       colors: 'bg-orange-50 text-orange-600 border-orange-100' },
  resolu:              { label: 'Résolu',              colors: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  ferme:               { label: 'Fermé',               colors: 'bg-gray-100 text-gray-400 border-gray-200' },
};

const PRIORITY_DOT: Record<string, string> = {
  bloquant: 'bg-red-500',
  eleve:    'bg-orange-400',
  moyen:    'bg-amber-400',
  faible:   'bg-gray-300',
};

function useAllTickets() {
  return useQuery<SupportTicket[]>({
    queryKey: ['admin-all-tickets'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupportTicket[];
    },
    staleTime: 30_000,
  });
}

const TicketDrawer: React.FC<{ ticket: SupportTicket; onClose: () => void }> = ({ ticket, onClose }) => {
  const diag = ticket.diagnostic_details;
  const risk = diag?.riskAnalysis;
  const s    = STATUS_META[ticket.status];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <span className="text-xs font-bold text-gray-400">{ticket.ticket_number}</span>
            <h3 className="text-sm font-bold text-gray-900 mt-0.5">{ticket.module} — {ticket.feature}</h3>
            {ticket.user_email && <p className="text-[12px] text-gray-400">{ticket.user_email}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className={cn('text-[11px] font-bold px-2 py-1 rounded-full border', s.colors)}>{s.label}</span>
            {ticket.risk_score && (
              <span className={cn('px-2 py-1 rounded-full text-[11px] font-bold border',
                RISK_COLORS[ticket.risk_score as RiskScore].bg,
                RISK_COLORS[ticket.risk_score as RiskScore].text,
                RISK_COLORS[ticket.risk_score as RiskScore].border,
              )}>
                Risque {RISK_COLORS[ticket.risk_score as RiskScore].label}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[ticket.priority])} />
              {ticket.priority}
            </span>
          </div>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Description</h4>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{ticket.description}</p>
          </section>

          {ticket.steps.length > 0 && (
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Étapes</h4>
              <ol className="space-y-1.5">
                {ticket.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {risk && (
            <section>
              <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                <Shield size={11} /> Analyse de risque
              </h4>
              <div className={cn('rounded-xl p-4 border space-y-2',
                RISK_COLORS[risk.score].border, RISK_COLORS[risk.score].bg)}>
                <div className="flex flex-wrap gap-4 text-[12px]">
                  <div><span className="text-gray-400">Temps : </span><span className={cn('font-bold', RISK_COLORS[risk.score].text)}>{risk.estimatedTime}</span></div>
                  <div><span className="text-gray-400">Rollback : </span><span className={cn('font-bold', risk.rollbackPossible ? 'text-emerald-600' : 'text-red-600')}>{risk.rollbackPossible ? 'Oui' : 'Non'}</span></div>
                </div>
                {risk.affectedModules.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <Layers size={11} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {risk.affectedModules.map(m => (
                        <span key={m} className="px-2 py-0.5 bg-white/70 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-200">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={11} className={cn(RISK_COLORS[risk.score].text, 'mt-0.5 shrink-0')} />
                  <p className={cn('text-[12px]', RISK_COLORS[risk.score].text)}>{risk.strategy}</p>
                </div>
              </div>
            </section>
          )}

          {ticket.claude_response && (
            <section>
              <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8B5CF6] mb-2">
                <Bot size={12} /> Analyse Claude
              </h4>
              <div className="bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 rounded-xl p-4">
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.claude_response}</p>
              </div>
            </section>
          )}

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Contexte</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['Hôtel',       ticket.hotel_id?.slice(0, 8) + '…'],
                ['Utilisateur', ticket.user_email],
                ['Rôle',        ticket.user_role],
                ['Module actif',ticket.current_module],
                ['Page',        ticket.current_page],
              ].filter(([, v]) => v).map(([label, value], i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-2.5 py-2">
                  <div className="text-[9px] font-bold uppercase text-gray-400">{label}</div>
                  <div className="text-[11px] font-medium text-gray-700 truncate">{value}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export const AdminSupport: React.FC = () => {
  const { data: tickets = [], isLoading, refetch } = useAllTickets();
  const updateStatus = useUpdateTicketStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = tickets
    .filter(t => statusFilter === 'all' || t.status === statusFilter)
    .sort((a, b) => {
      const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? d : -d;
    });

  const selected = tickets.find(t => t.id === selectedId);
  const stats = {
    total:    tickets.length,
    open:     tickets.filter(t => !['resolu','ferme'].includes(t.status)).length,
    critique: tickets.filter(t => t.risk_score === 'critique' && !['resolu','ferme'].includes(t.status)).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Support global</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {stats.total} tickets · {stats.open} ouvert{stats.open > 1 ? 's' : ''}
            {stats.critique > 0 && <span className="text-red-600 font-bold"> · {stats.critique} critique{stats.critique > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700">
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', ...Object.keys(STATUS_META)] as const).map(k => (
          <button key={k} type="button"
            onClick={() => setStatusFilter(k as TicketStatus | 'all')}
            className={cn('text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors',
              statusFilter === k ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}>
            {k === 'all' ? 'Tous' : STATUS_META[k as TicketStatus].label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Hôtel / Utilisateur</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Priorité</th>
              <th className="px-4 py-3">Risque</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 cursor-pointer select-none" onClick={() => setSortAsc(v => !v)}>
                <span className="flex items-center gap-1">Date {sortAsc ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}</span>
              </th>
              <th className="px-4 py-3 text-center">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td className="px-4 py-8 text-gray-400 text-sm" colSpan={8}>Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-12 text-center text-gray-400 text-sm" colSpan={8}>Aucun ticket.</td></tr>
            ) : filtered.map(t => {
              const sm = STATUS_META[t.status];
              return (
                <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-[12px] text-gray-500 font-bold whitespace-nowrap">{t.ticket_number || '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="text-[12px] font-mono text-gray-400">{t.hotel_id?.slice(0, 8)}…</div>
                    <div className="text-[12px] text-gray-500 truncate max-w-[150px]">{t.user_email || '—'}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-[13px] font-bold text-gray-900">{t.module}</div>
                    <div className="text-[11px] text-gray-400 truncate max-w-[140px]">{t.feature}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-1.5 text-[12px] text-gray-600">
                      <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[t.priority])} />
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {t.risk_score ? (
                      <span className={cn('px-2 py-0.5 rounded-lg text-[11px] font-bold border',
                        RISK_COLORS[t.risk_score as RiskScore].bg,
                        RISK_COLORS[t.risk_score as RiskScore].text,
                        RISK_COLORS[t.risk_score as RiskScore].border)}>
                        {RISK_COLORS[t.risk_score as RiskScore].label}
                      </span>
                    ) : <span className="text-[11px] text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <select value={t.status}
                      onChange={e => updateStatus.mutate({ id: t.id, status: e.target.value as TicketStatus })}
                      className={cn('text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer appearance-none outline-none', sm.colors)}>
                      {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button onClick={() => setSelectedId(t.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors">
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <TicketDrawer ticket={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
};
