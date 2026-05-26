/**
 * FLOWTYM — Maintenance tickets.
 * Suivi des tickets de maintenance : création, assignation, statuts.
 */
import React, { useState, useMemo } from 'react';
import {
  Wrench, Plus, Search, RefreshCw, AlertCircle, CheckCircle2,
  Clock, ChevronDown, X, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  useMaintenanceTickets, useCreateMaintenanceTicket, useUpdateMaintenanceStatus,
} from '@/src/domains/housekeeping/index';
import type { MaintenanceTicket } from '@/src/domains/housekeeping/index';

// ─── Configs ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<MaintenanceTicket['status'], { label: string; color: string; bg: string; ring: string; icon: typeof Clock }> = {
  open:          { label: 'Ouvert',          color: 'text-red-700',    bg: 'bg-red-50',     ring: 'ring-red-200',    icon: AlertCircle  },
  in_progress:   { label: 'En cours',        color: 'text-violet-700', bg: 'bg-violet-50',  ring: 'ring-violet-200', icon: RefreshCw    },
  pending_parts: { label: 'En attente pièces',color:'text-amber-700',  bg: 'bg-amber-50',   ring: 'ring-amber-200',  icon: Clock        },
  resolved:      { label: 'Résolu',          color: 'text-emerald-700',bg: 'bg-emerald-50', ring: 'ring-emerald-200',icon: CheckCircle2 },
  closed:        { label: 'Fermé',           color: 'text-slate-600',  bg: 'bg-slate-100',  ring: 'ring-slate-200',  icon: CheckCircle2 },
  cancelled:     { label: 'Annulé',          color: 'text-slate-400',  bg: 'bg-slate-50',   ring: 'ring-slate-200',  icon: X            },
};

const PRIORITY_CFG: Record<MaintenanceTicket['priority'], { label: string; color: string; dot: string }> = {
  low:      { label: 'Basse',    color: 'text-slate-500',  dot: 'bg-slate-300' },
  normal:   { label: 'Normal',   color: 'text-blue-600',   dot: 'bg-blue-400'  },
  high:     { label: 'Haute',    color: 'text-amber-600',  dot: 'bg-amber-400' },
  urgent:   { label: 'Urgent',   color: 'text-red-600',    dot: 'bg-red-500'   },
  critical: { label: 'Critique', color: 'text-red-800',    dot: 'bg-red-700'   },
};

const CATEGORY_LABEL: Record<MaintenanceTicket['category'], string> = {
  plumbing:   'Plomberie',
  electrical: 'Électricité',
  hvac:       'Climatisation',
  furniture:  'Mobilier',
  equipment:  'Équipement',
  cleaning:   'Nettoyage',
  safety:     'Sécurité',
  general:    'Général',
};

const STATUS_TRANSITIONS: Partial<Record<MaintenanceTicket['status'], MaintenanceTicket['status'][]>> = {
  open:          ['in_progress', 'cancelled'],
  in_progress:   ['pending_parts', 'resolved'],
  pending_parts: ['in_progress', 'resolved'],
  resolved:      ['closed'],
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' });
}

// ─── Create Ticket Modal ──────────────────────────────────────────────────────

interface CreateTicketModalProps {
  onClose: () => void;
  onSubmit: (v: { title: string; description?: string; category: MaintenanceTicket['category']; priority: MaintenanceTicket['priority']; roomNumber?: string }) => void;
}

function CreateTicketModal({ onClose, onSubmit }: CreateTicketModalProps) {
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [category, setCategory]   = useState<MaintenanceTicket['category']>('general');
  const [priority, setPriority]   = useState<MaintenanceTicket['priority']>('normal');
  const [roomNumber, setRoom]     = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-[16px] font-bold text-gray-900 mb-4">Nouveau ticket maintenance</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Titre *</label>
            <input type="text" placeholder="Ex. Fuite robinet salle de bain" value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Catégorie</label>
              <select value={category} onChange={e => setCategory(e.target.value as MaintenanceTicket['category'])}
                className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 bg-white">
                {Object.entries(CATEGORY_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Priorité</label>
              <select value={priority} onChange={e => setPriority(e.target.value as MaintenanceTicket['priority'])}
                className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 bg-white">
                {Object.entries(PRIORITY_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Chambre (optionnel)</label>
            <input type="text" placeholder="ex. 205" value={roomNumber}
              onChange={e => setRoom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
              placeholder="Détails du problème…"
              className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            onClick={() => {
              if (!title.trim()) return;
              onSubmit({ title: title.trim(), description: description.trim() || undefined, category, priority, roomNumber: roomNumber.trim() || undefined });
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700"
          >
            Créer le ticket
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ticket Row ───────────────────────────────────────────────────────────────

function TicketRow({ ticket, onStatusChange }: {
  ticket: MaintenanceTicket;
  onStatusChange: (id: string, status: MaintenanceTicket['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg    = STATUS_CFG[ticket.status];
  const priCfg = PRIORITY_CFG[ticket.priority];
  const StatusIcon = cfg.icon;
  const transitions = STATUS_TRANSITIONS[ticket.status] ?? [];

  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full shrink-0', priCfg.dot)} />
          <div>
            <p className="font-semibold text-slate-800 text-[12.5px]">{ticket.title}</p>
            {ticket.description && (
              <p className="text-[11px] text-slate-400 truncate max-w-[280px]">{ticket.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[11.5px] text-slate-600">{ticket.room_number ?? '—'}</td>
      <td className="px-4 py-3 text-[11.5px] text-slate-600">{CATEGORY_LABEL[ticket.category]}</td>
      <td className="px-4 py-3">
        <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1', priCfg.color)}>
          {priCfg.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold', cfg.bg, cfg.ring, cfg.color)}>
          <StatusIcon size={10} />
          {cfg.label}
        </span>
      </td>
      <td className="px-4 py-3 text-[11px] text-slate-400">{fmtDate(ticket.created_at)}</td>
      <td className="px-4 py-3">
        {transitions.length > 0 && (
          <div className="relative">
            <button onClick={() => setOpen(!open)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
              Changer <ChevronDown size={11} />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 z-10 min-w-[160px]">
                {transitions.map(s => (
                  <button key={s} onClick={() => { onStatusChange(ticket.id, s); setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl">
                    <span className={cn('font-semibold', STATUS_CFG[s].color)}>{STATUS_CFG[s].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

const ALL_STATUSES = ['all', 'open', 'in_progress', 'pending_parts', 'resolved', 'closed'] as const;

export const MaintenanceView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('open');
  const [search, setSearch]             = useState('');
  const [showCreate, setShowCreate]     = useState(false);

  const { data: rawTickets, isLoading, refetch } = useMaintenanceTickets(statusFilter);
  const tickets: MaintenanceTicket[] = (rawTickets ?? []) as MaintenanceTicket[];
  const createTicket  = useCreateMaintenanceTicket();
  const updateStatus  = useUpdateMaintenanceStatus();

  const filtered = useMemo(() => {
    if (!search) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.room_number ?? '').toLowerCase().includes(q) ||
      CATEGORY_LABEL[t.category].toLowerCase().includes(q)
    );
  }, [tickets, search]);

  const counts = useMemo(() => ({
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    critical:    tickets.filter(t => t.priority === 'critical' || t.priority === 'urgent').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
  }), [tickets]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 ring-1 ring-orange-100 flex items-center justify-center shrink-0">
              <Wrench size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Maintenance</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Tickets de maintenance et interventions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw size={13} /> Actualiser
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-700">
              <Plus size={13} /> Nouveau ticket
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ouverts',     value: counts.open,        color: 'text-red-600',    alert: counts.open > 0    },
            { label: 'En cours',    value: counts.in_progress, color: 'text-violet-600', alert: false              },
            { label: 'Urgents',     value: counts.critical,    color: 'text-red-700',    alert: counts.critical > 0},
            { label: 'Résolus',     value: counts.resolved,    color: 'text-emerald-600',alert: false              },
          ].map(k => (
            <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Titre, chambre, catégorie…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1 flex-wrap">
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                  statusFilter === s ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
                {s === 'all' ? 'Tous' : STATUS_CFG[s as MaintenanceTicket['status']].label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <CheckCircle2 size={32} className="mb-3 text-emerald-400 opacity-70" />
              <p className="text-[13px] font-medium">Aucun ticket</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 rounded-xl bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700">
                Créer un ticket
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['Titre', 'Chambre', 'Catégorie', 'Priorité', 'Statut', 'Créé le', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(filtered as MaintenanceTicket[]).map((ticket: MaintenanceTicket) => (
                    <TicketRow
                      key={ticket.id}
                      ticket={ticket}
                      onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[11px] text-slate-400">
              {filtered.length} ticket{filtered.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onSubmit={v => createTicket.mutate(v)}
        />
      )}
    </div>
  );
};
