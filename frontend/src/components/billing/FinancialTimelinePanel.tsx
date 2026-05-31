/**
 * FLOWTYM — FinancialTimelinePanel (T10).
 * Timeline unifiée : factures · paiements · avoirs · dépôts
 * Requête vue financial_timeline · Filtrage · Export texte
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  Clock, Download, Filter, Loader2, FileText, CreditCard,
  RotateCcw, ShieldCheck, TrendingDown, TrendingUp,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric',
});

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'invoice' | 'payment' | 'credit_note' | 'deposit';

interface TimelineEvent {
  event_type: EventType;
  entity_id: string;
  hotel_id: string;
  reservation_id: string | null;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  event_at: string;
  description: string | null;
}

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<EventType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = {
  invoice:     { label: 'Facture',    icon: <FileText size={13} />,    color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  payment:     { label: 'Paiement',   icon: <CreditCard size={13} />,  color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
  credit_note: { label: 'Avoir',      icon: <RotateCcw size={13} />,   color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  deposit:     { label: 'Dépôt',      icon: <ShieldCheck size={13} />, color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
};

// ─── Data hook ────────────────────────────────────────────────────────────────

function useFinancialTimeline(limit = 100) {
  const { status } = useAuth();
  return useQuery<TimelineEvent[]>({
    queryKey: ['financial_timeline', limit],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('financial_timeline')
        .select('*')
        .order('event_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportTimeline(events: TimelineEvent[]) {
  const lines = [
    'DATE\t\t\tTYPE\t\tRÉFÉRENCE\tSTATUT\t\tMONTANT',
    '─'.repeat(80),
    ...events.map(e =>
      `${fmtDate(e.event_at)}\t${EVENT_CONFIG[e.event_type]?.label ?? e.event_type}\t\t${e.reference}\t${e.status}\t\t${fmtEur(e.amount)}`,
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `timeline_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { key?: React.Key; event: TimelineEvent }) {
  const cfg = EVENT_CONFIG[event.event_type] ?? EVENT_CONFIG.invoice;
  const isNegative = event.amount < 0;
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border', cfg.bg)}>
      {/* Timeline dot */}
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border', cfg.bg, cfg.color.replace('text-', 'border-'))}>
        <span className={cfg.color}>{cfg.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-xs text-gray-600 font-mono">{event.reference}</span>
          </div>
          <span className={cn('text-sm font-bold shrink-0', isNegative ? 'text-orange-600' : 'text-gray-900')}>
            {isNegative ? <TrendingDown size={11} className="inline mr-0.5" /> : <TrendingUp size={11} className="inline mr-0.5" />}
            {fmtEur(event.amount)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400">{fmtDate(event.event_at)}</span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/60', cfg.color)}>
            {event.status}
          </span>
          {event.description && (
            <span className="text-[11px] text-gray-400 italic truncate max-w-[180px]">{event.description}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function FinancialTimelinePanel() {
  const { data: events = [], isLoading } = useFinancialTimeline(200);
  const [typeFilter, setTypeFilter] = useState<EventType | ''>('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let ev = events;
    if (typeFilter) ev = ev.filter(e => e.event_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      ev = ev.filter(e =>
        e.reference.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q),
      );
    }
    return ev;
  }, [events, typeFilter, search]);

  const totals = useMemo(() => {
    const payments = events.filter(e => e.event_type === 'payment' && e.amount > 0)
                           .reduce((s, e) => s + e.amount, 0);
    const issued   = events.filter(e => e.event_type === 'invoice' && ['issued','paid'].includes(e.status))
                           .reduce((s, e) => s + e.amount, 0);
    return { payments, issued };
  }, [events]);

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB]">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-purple-500" />
            <h2 className="text-base font-bold text-gray-900">Timeline financière</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTimeline(filtered)}
            disabled={filtered.length === 0}
            className="gap-1.5 text-xs"
          >
            <Download size={12} />
            Exporter
          </Button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-emerald-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-500 font-medium uppercase">Total encaissé</p>
            <p className="text-base font-bold text-emerald-700">{fmtEur(totals.payments)}</p>
          </div>
          <div className="bg-purple-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-500 font-medium uppercase">Total facturé</p>
            <p className="text-base font-bold text-purple-700">{fmtEur(totals.issued)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter('')}
            className={cn('text-xs px-3 py-1 rounded-full font-medium transition-colors', typeFilter === '' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
          >
            Tous ({events.length})
          </button>
          {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][]).map(([k, cfg]) => {
            const count = events.filter(e => e.event_type === k).length;
            return (
              <button
                key={k}
                onClick={() => setTypeFilter(k)}
                className={cn('text-xs px-3 py-1 rounded-full font-medium transition-colors flex items-center gap-1', typeFilter === k ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
              >
                {cfg.icon}
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-50 bg-white shrink-0">
        <div className="relative">
          <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
            placeholder="Filtrer par référence, description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">Aucun événement{search || typeFilter ? ' correspondant' : ''}</p>
          </div>
        ) : (
          filtered.map(event => (
            <EventRow key={event.entity_id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
