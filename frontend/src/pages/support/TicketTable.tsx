import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Eye, RefreshCw, X, Bot,
  AlertTriangle, Bug, Lightbulb, MessageSquare,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useUpdateTicketStatus } from '@/src/services/support/hooks';
import type { SupportTicket, TicketStatus, TicketClassification } from '@/src/services/support/support.service';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<TicketStatus, { label: string; colors: string }> = {
  nouveau:              { label: 'Nouveau',              colors: 'bg-blue-50 text-blue-600 border-blue-100' },
  en_analyse:           { label: 'En analyse',           colors: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20' },
  attente_utilisateur:  { label: 'Attente utilisateur',  colors: 'bg-amber-50 text-amber-600 border-amber-100' },
  en_correction:        { label: 'En correction',        colors: 'bg-orange-50 text-orange-600 border-orange-100' },
  resolu:               { label: 'Résolu',               colors: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  ferme:                { label: 'Fermé',                colors: 'bg-gray-100 text-gray-400 border-gray-200' },
};

const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  bloquant: { label: 'Bloquant', dot: 'bg-red-500' },
  eleve:    { label: 'Élevé',    dot: 'bg-orange-400' },
  moyen:    { label: 'Moyen',    dot: 'bg-amber-400' },
  faible:   { label: 'Faible',   dot: 'bg-gray-300' },
};

const CLASSIF_META: Record<TicketClassification, { label: string; icon: React.ElementType; color: string }> = {
  bug:          { label: 'Bug',          icon: Bug,          color: 'text-red-500' },
  amelioration: { label: 'Amélioration', icon: Lightbulb,    color: 'text-amber-500' },
  question:     { label: 'Question',     icon: MessageSquare, color: 'text-blue-500' },
};

const STATUSES = Object.entries(STATUS_META) as [TicketStatus, (typeof STATUS_META)[TicketStatus]][];

// ─── Row detail modal ─────────────────────────────────────────────────────────

const TicketDetail: React.FC<{ ticket: SupportTicket; onClose: () => void }> = ({ ticket, onClose }) => {
  const status = STATUS_META[ticket.status];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <span className="text-xs font-bold text-gray-400">{ticket.ticket_number}</span>
            <h3 className="text-sm font-bold text-gray-900 mt-0.5">{ticket.module} — {ticket.feature}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Méta */}
          <div className="flex flex-wrap gap-2">
            <span className={cn('text-[11px] font-bold px-2 py-1 rounded-full border', status.colors)}>
              {status.label}
            </span>
            {ticket.classification && (
              <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border bg-gray-50 border-gray-100', CLASSIF_META[ticket.classification].color)}>
                {React.createElement(CLASSIF_META[ticket.classification].icon, { size: 11 })}
                {CLASSIF_META[ticket.classification].label}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
              <span className={cn('w-2 h-2 rounded-full', PRIORITY_META[ticket.priority]?.dot)} />
              {PRIORITY_META[ticket.priority]?.label}
            </span>
            <span className="text-[11px] text-gray-400">{new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {/* Description */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Description</h4>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 leading-relaxed">{ticket.description}</p>
          </section>

          {/* Étapes */}
          {ticket.steps.length > 0 && (
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Étapes pour reproduire</h4>
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

          {/* Résultats */}
          {(ticket.expected_result || ticket.actual_result) && (
            <div className="grid grid-cols-2 gap-3">
              {ticket.expected_result && (
                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Attendu</h4>
                  <p className="text-[12px] text-gray-600 bg-emerald-50 rounded-xl p-3 border border-emerald-100">{ticket.expected_result}</p>
                </section>
              )}
              {ticket.actual_result && (
                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Obtenu</h4>
                  <p className="text-[12px] text-gray-600 bg-red-50 rounded-xl p-3 border border-red-100">{ticket.actual_result}</p>
                </section>
              )}
            </div>
          )}

          {/* Analyse Claude */}
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

          {/* Contexte technique */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Contexte technique</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ticket.user_email    && ['Utilisateur', ticket.user_email],
                ticket.user_role     && ['Rôle', ticket.user_role],
                ticket.current_module && ['Module actif', ticket.current_module],
                ticket.current_page  && ['Page', ticket.current_page],
                ticket.browser_info  && ['Navigateur', ticket.browser_info.userAgent?.split(' ').slice(-2).join(' ')],
                ticket.related_entity_id && ['Entité liée', ticket.related_entity_id],
              ].filter(Boolean).map(([label, value], i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-2.5 py-2">
                  <div className="text-[9px] font-bold uppercase text-gray-400">{label as string}</div>
                  <div className="text-[11px] font-medium text-gray-700 truncate">{value as string}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

// ─── Main table ───────────────────────────────────────────────────────────────

interface TicketTableProps {
  tickets: SupportTicket[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const TicketTable: React.FC<TicketTableProps> = ({ tickets, isLoading, onRefresh }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [sortAsc, setSortAsc] = useState(false);

  const updateStatus = useUpdateTicketStatus();

  const filtered = tickets
    .filter(t => statusFilter === 'all' || t.status === statusFilter)
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? diff : -diff;
    });

  const selected = tickets.find(t => t.id === selectedId);

  // Stats strip
  const stats = {
    total:   tickets.length,
    nouveau: tickets.filter(t => t.status === 'nouveau').length,
    bloquant: tickets.filter(t => t.priority === 'bloquant' && t.status !== 'resolu' && t.status !== 'ferme').length,
    resolu:  tickets.filter(t => t.status === 'resolu').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total tickets',   value: stats.total,   color: 'text-gray-700' },
          { label: 'Nouveaux',        value: stats.nouveau,  color: 'text-blue-600' },
          { label: 'Bloquants actifs',value: stats.bloquant, color: 'text-red-600' },
          { label: 'Résolus',         value: stats.resolu,   color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn('text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors', statusFilter === 'all' ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}
          >
            Tous
          </button>
          {STATUSES.map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn('text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors', statusFilter === key ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}
            >
              {meta.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Module / Fonctionnalité</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Priorité</th>
              <th className="px-4 py-3">Statut</th>
              <th
                className="px-4 py-3 cursor-pointer hover:text-gray-600 flex items-center gap-1"
                onClick={() => setSortAsc(v => !v)}
              >
                Date {sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </th>
              <th className="px-4 py-3 text-center">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td className="px-4 py-8 text-gray-400 text-sm" colSpan={7}>Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-12 text-center text-gray-400 text-sm" colSpan={7}>Aucun ticket trouvé.</td></tr>
            ) : filtered.map(t => {
              const s  = STATUS_META[t.status];
              const pr = PRIORITY_META[t.priority];
              const cl = t.classification ? CLASSIF_META[t.classification] : null;

              return (
                <tr key={t.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="px-4 py-3.5 font-mono text-[12px] text-gray-500 font-bold whitespace-nowrap">
                    {t.ticket_number || '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-gray-900 text-[13px]">{t.module}</div>
                    <div className="text-[12px] text-gray-400 truncate max-w-[200px]">{t.feature}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    {cl ? (
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold', cl.color)}>
                        {React.createElement(cl.icon, { size: 11 })} {cl.label}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', pr?.dot)} />
                      {pr?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={t.status}
                      onChange={e => updateStatus.mutate({ id: t.id, status: e.target.value as TicketStatus })}
                      className={cn('text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer appearance-none outline-none', s.colors)}
                    >
                      {STATUSES.map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    <span className="ml-1 text-gray-300">{new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selected && (
        <TicketDetail ticket={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
};
