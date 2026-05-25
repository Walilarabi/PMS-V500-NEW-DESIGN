/**
 * FLOWTYM RMS — Recommendations Inbox
 *
 * Vue consolidée premium : TOUTES les recommandations RMS générées par
 * le moteur Market Intelligence sur toutes les dates, agrégées dans une
 * seule liste filtrable / actionnable par lot.
 *
 * C'est l'écran de pilotage quotidien du Revenue Manager :
 *   • voir d'un coup d'œil les recos qui demandent une action
 *   • filtrer par type / sévérité / date / statut
 *   • accepter / rejeter / reporter individuellement ou par lot
 *
 * Connecté au store events + persistence Supabase (audit trail).
 */

import React, { useMemo, useState } from 'react';
import {
  Check, X as XIcon, Clock, Filter, ListChecks, Zap, ChevronDown, ChevronUp,
  Calendar, Search,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useMarketIntelligence } from '@/src/hooks/useMarketIntelligence';
import { useEventsStore } from '@/src/store/eventsStore';
import {
  RECOMMENDATION_TYPE_LABELS,
  type RmsRecommendation,
  type RmsRecommendationSeverity,
  type RmsRecommendationType,
} from '@/src/types/marketIntelligence';
import {
  recordAction,
  upsertRecommendations,
} from '@/src/services/marketIntelligence/persistence.service';

/* ────────────────────────────────────────────────────────────────────────── */
/* TYPES UI                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

type StatusFilter = 'all' | 'pending' | 'acted';
type LocalStatus = 'pending' | 'accepted' | 'rejected' | 'snoozed' | 'syncing';

interface EnrichedReco {
  reco: RmsRecommendation;
  eventName: string;
  eventId: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export const RecommendationsInbox: React.FC = () => {
  const intelligence = useMarketIntelligence();
  const events = useEventsStore((s) => s.events);

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<RmsRecommendationSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<RmsRecommendationType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [localStatus, setLocalStatus] = useState<Record<string, LocalStatus>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  // Aplatit toutes les recos avec nom événement
  const allRecos = useMemo<EnrichedReco[]>(() => {
    const eventById = new Map(events.map((e) => [e.id, e]));
    const out: EnrichedReco[] = [];
    for (const [eventId, recos] of intelligence.recommendations.entries()) {
      const ev = eventById.get(eventId);
      for (const r of recos) {
        out.push({
          reco: r,
          eventId,
          eventName: ev?.name ?? '—',
        });
      }
    }
    return out;
  }, [intelligence.recommendations, events]);

  // Filtres appliqués
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRecos.filter(({ reco, eventName }) => {
      if (severityFilter !== 'all' && reco.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && reco.type !== typeFilter) return false;
      const ls = localStatus[reco.id] ?? 'pending';
      if (statusFilter === 'pending' && ls !== 'pending' && ls !== 'syncing') return false;
      if (statusFilter === 'acted' && (ls === 'pending' || ls === 'syncing')) return false;
      if (q) {
        const blob = `${eventName} ${reco.title} ${reco.type}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).sort((a, b) =>
      severityRank(b.reco.severity) - severityRank(a.reco.severity) ||
      a.reco.targetDate.localeCompare(b.reco.targetDate) ||
      b.reco.confidence - a.reco.confidence,
    );
  }, [allRecos, severityFilter, typeFilter, statusFilter, localStatus, search]);

  // Stats header
  const stats = useMemo(() => {
    const pending = allRecos.filter((r) => (localStatus[r.reco.id] ?? 'pending') === 'pending').length;
    const aggressive = allRecos.filter((r) => r.reco.severity === 'aggressive' || r.reco.severity === 'maximum').length;
    const byType = new Map<RmsRecommendationType, number>();
    for (const r of allRecos) byType.set(r.reco.type, (byType.get(r.reco.type) ?? 0) + 1);
    return { total: allRecos.length, pending, aggressive, byType };
  }, [allRecos, localStatus]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filtered.map((r) => r.reco.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // Actions
  const handleSingle = async (reco: RmsRecommendation, action: 'accept' | 'reject' | 'snooze') => {
    setLocalStatus((prev) => ({ ...prev, [reco.id]: 'syncing' }));
    await upsertRecommendations([reco]);
    const res = await recordAction({
      recommendationId: reco.id,
      action,
      appliedValue: action === 'accept' ? reco.suggestedValue : undefined,
    });
    setLocalStatus((prev) => ({
      ...prev,
      [reco.id]: res.ok
        ? (action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'snoozed')
        : 'pending',
    }));
  };

  const handleBulk = async (action: 'accept' | 'reject' | 'snooze') => {
    if (selectedIds.size === 0) return;
    setBulkRunning(true);
    const targets = filtered.filter((r) => selectedIds.has(r.reco.id));
    // Mark syncing
    setLocalStatus((prev) => {
      const next = { ...prev };
      for (const t of targets) next[t.reco.id] = 'syncing';
      return next;
    });
    // Persist en batch
    await upsertRecommendations(targets.map((t) => t.reco));
    // Sequential actions (audit trail propre)
    for (const t of targets) {
      const res = await recordAction({
        recommendationId: t.reco.id,
        action,
        appliedValue: action === 'accept' ? t.reco.suggestedValue : undefined,
      });
      setLocalStatus((prev) => ({
        ...prev,
        [t.reco.id]: res.ok
          ? (action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'snoozed')
          : 'pending',
      }));
    }
    clearSelection();
    setBulkRunning(false);
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-sm">
            <ListChecks className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Inbox Recommandations RMS</h3>
            <p className="text-[11.5px] text-slate-500">
              {stats.pending} en attente · {stats.total} au total · {stats.aggressive} agressives
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar — filtres + bulk actions */}
      <div className="px-5 py-3 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (événement, titre)…"
              className="w-full pl-8 pr-3 py-1.5 text-[12.5px] rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-500 outline-none"
            />
          </div>

          {/* Status filter */}
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {(['pending', 'acted', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-1 text-[11.5px] font-medium rounded-md',
                  statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {s === 'pending' ? 'À traiter' : s === 'acted' ? 'Traitées' : 'Tout'}
              </button>
            ))}
          </div>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
            className="px-2.5 py-1.5 text-[12px] rounded-lg ring-1 ring-slate-200 bg-white outline-none"
          >
            <option value="all">Toutes sévérités</option>
            <option value="maximum">Maximum</option>
            <option value="aggressive">Agressive</option>
            <option value="standard">Standard</option>
            <option value="soft">Douce</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-2.5 py-1.5 text-[12px] rounded-lg ring-1 ring-slate-200 bg-white outline-none"
          >
            <option value="all">Tous types</option>
            {Object.entries(RECOMMENDATION_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>

        {/* Bulk action bar (visible si sélection) */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 ring-1 ring-violet-200">
            <span className="text-[12px] font-medium text-violet-900">
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="flex-1" />
            <button
              disabled={bulkRunning}
              onClick={() => handleBulk('accept')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> Accepter tout
            </button>
            <button
              disabled={bulkRunning}
              onClick={() => handleBulk('reject')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            >
              <XIcon className="w-3 h-3" /> Rejeter tout
            </button>
            <button
              disabled={bulkRunning}
              onClick={() => handleBulk('snooze')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
            >
              <Clock className="w-3 h-3" /> Reporter
            </button>
            <button
              onClick={clearSelection}
              className="text-[11.5px] text-violet-700 hover:underline"
            >
              Effacer
            </button>
          </div>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-slate-400">
          <ListChecks className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <div className="font-medium text-slate-500">Aucune recommandation correspondante</div>
          <div className="text-[11.5px] mt-1">
            {allRecos.length === 0
              ? 'Le moteur n\'a rien à proposer pour le moment.'
              : 'Ajustez les filtres pour voir plus de résultats.'}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {/* Select all row */}
          <div className="px-5 py-2 flex items-center gap-3 bg-slate-50/60">
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length}
              onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
              className="w-3.5 h-3.5 accent-violet-600"
            />
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
              {filtered.length} recommandation{filtered.length > 1 ? 's' : ''}
            </span>
          </div>

          {filtered.map(({ reco, eventName, eventId }) => (
            <RecoRow
              key={reco.id}
              reco={reco}
              eventName={eventName}
              eventId={eventId}
              selected={selectedIds.has(reco.id)}
              onToggleSelect={() => toggleSelect(reco.id)}
              localStatus={localStatus[reco.id] ?? 'pending'}
              onAction={(a) => handleSingle(reco, a)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* ROW                                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

interface RecoRowProps {
  reco: RmsRecommendation;
  eventName: string;
  eventId: string;
  selected: boolean;
  onToggleSelect: () => void;
  localStatus: LocalStatus;
  onAction: (a: 'accept' | 'reject' | 'snooze') => void;
}

const RecoRow: React.FC<RecoRowProps> = ({
  reco, eventName, selected, onToggleSelect, localStatus, onAction,
}) => {
  const [expanded, setExpanded] = useState(false);
  const acted = localStatus === 'accepted' || localStatus === 'rejected' || localStatus === 'snoozed';

  return (
    <div className={cn(
      'px-5 py-3 hover:bg-slate-50/60 transition-colors',
      selected && 'bg-violet-50/40',
      acted && 'opacity-70',
    )}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={acted}
          className="mt-1 w-3.5 h-3.5 accent-violet-600 shrink-0"
        />

        {/* Sévérité chip + type */}
        <div className="shrink-0 w-24">
          <SeverityChip severity={reco.severity} />
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 font-medium truncate">
            {RECOMMENDATION_TYPE_LABELS[reco.type]}
          </div>
        </div>

        {/* Contenu principal */}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-slate-900">{reco.title}</div>
          <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3 h-3 text-violet-500" />
              {eventName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formatDateFr(reco.targetDate)}
              {reco.targetEndDate && reco.targetEndDate !== reco.targetDate && ` → ${formatDateFr(reco.targetEndDate)}`}
            </span>
          </div>

          {/* Causes (expanded) */}
          {expanded && reco.causes.length > 0 && (
            <ul className="mt-2 space-y-0.5 px-2 py-1.5 bg-slate-50 rounded">
              {reco.causes.slice(0, 5).map((c, i) => (
                <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                  <span className="text-slate-400">•</span>
                  <span><span className="font-medium text-slate-700">{c.label} :</span> {c.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Confidence */}
        <div className="shrink-0 text-right w-14">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Conf.</div>
          <div className={cn(
            'text-[13px] font-semibold tabular-nums',
            reco.confidence >= 70 ? 'text-emerald-700' : reco.confidence >= 50 ? 'text-amber-700' : 'text-rose-700',
          )}>
            {reco.confidence}%
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1">
          {localStatus === 'pending' && (
            <>
              <button
                onClick={() => onAction('accept')}
                className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200"
                title="Accepter"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAction('reject')}
                className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 ring-1 ring-rose-200"
                title="Rejeter"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAction('snooze')}
                className="p-1.5 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200"
                title="Reporter"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {localStatus === 'syncing' && (
            <span className="text-[10.5px] text-slate-500 italic px-2">Sync…</span>
          )}
          {localStatus === 'accepted' && (
            <span className="text-[10.5px] font-semibold text-emerald-700 px-2 inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Acceptée
            </span>
          )}
          {localStatus === 'rejected' && (
            <span className="text-[10.5px] font-semibold text-rose-700 px-2 inline-flex items-center gap-1">
              <XIcon className="w-3 h-3" /> Rejetée
            </span>
          )}
          {localStatus === 'snoozed' && (
            <span className="text-[10.5px] font-semibold text-slate-600 px-2 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> Reportée
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
            title={expanded ? 'Réduire' : 'Voir détails'}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const SeverityChip: React.FC<{ severity: RmsRecommendationSeverity }> = ({ severity }) => {
  const map = {
    soft:       { cls: 'bg-slate-100 text-slate-700',   label: 'Doux' },
    standard:   { cls: 'bg-violet-100 text-violet-700', label: 'Standard' },
    aggressive: { cls: 'bg-amber-100 text-amber-800',   label: 'Agressif' },
    maximum:    { cls: 'bg-rose-100 text-rose-800',     label: 'Maximum' },
  }[severity];
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
      map.cls,
    )}>
      {map.label}
    </span>
  );
};

function severityRank(s: RmsRecommendationSeverity): number {
  switch (s) {
    case 'maximum':    return 4;
    case 'aggressive': return 3;
    case 'standard':   return 2;
    case 'soft':       return 1;
  }
}

function formatDateFr(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
}
