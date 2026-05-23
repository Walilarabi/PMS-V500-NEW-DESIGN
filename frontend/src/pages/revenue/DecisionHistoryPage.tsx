/**
 * FLOWTYM — Historique Décisions RMS
 *
 * Consulte la table rms_decisions (Supabase, append-only).
 * Affiche horodaté chaque action utilisateur sur les recommandations IA.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, CheckCircle2, XCircle, MinusCircle, AlertCircle, Loader2, Download, Search } from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { RmsEnterpriseFeed } from '@/src/components/revenue/automation/RmsEnterpriseFeed';
import { fetchRmsDecisions, type RmsDecisionRecord } from '../../services/rms-decisions.service';
import { subscribeRmsEvent } from '../../lib/rms/eventBus';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

const ACTION_LABEL: Record<string, string> = {
  accepted: 'Accepté',
  rejected: 'Refusé',
  maintained: 'Maintenu',
};

function ActionBadge({ action }: { action: string }) {
  const config = {
    accepted: { icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200' },
    maintained: { icon: MinusCircle, color: 'bg-gray-50 text-gray-700 border-gray-200' },
  }[action] ?? { icon: AlertCircle, color: 'bg-gray-50 text-gray-700 border-gray-200' };

  const Icon = config.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border',
      config.color
    )}>
      <Icon className="w-3 h-3" />
      {ACTION_LABEL[action] ?? action}
    </span>
  );
}

type SortKey = 'created_at' | 'stay_date' | 'current_price' | 'suggested_price' | 'final_price' | 'confidence_score' | 'market_pressure_percent';

export const DecisionHistoryPage: React.FC = () => {
  const [decisions, setDecisions] = useState<RmsDecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<'all' | 'accepted' | 'rejected' | 'maintained'>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const refresh = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRmsDecisions({ limit: 500 })
      .then(data => {
        if (!cancelled) {
          setDecisions(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // Premier chargement
  useEffect(() => {
    return refresh();
  }, [refresh]);

  // Invalidation temps réel : refetch dès qu'une décision est enregistrée ou
  // rejetée ailleurs dans le Revenue (Tableau RMS, Autopilote, moteur tactique).
  useEffect(() => {
    const onChange = () => refresh();
    const unsubs = [
      subscribeRmsEvent('rms-decision:accepted', onChange),
      subscribeRmsEvent('rms-decision:rejected', onChange),
      subscribeRmsEvent('autopilot:pushed', onChange),
      subscribeRmsEvent('autopilot:rollback', onChange),
      subscribeRmsEvent('tactical-rule:triggered', onChange),
    ];
    return () => unsubs.forEach((u) => u());
  }, [refresh]);

  const filtered = useMemo(() => {
    let list = decisions;
    if (filterAction !== 'all') list = list.filter(d => d.action === filterAction);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(d =>
        d.stay_date.toLowerCase().includes(q) ||
        d.strategy.toLowerCase().includes(q) ||
        d.recommendation.toLowerCase().includes(q)
      );
    }
    if (dateFrom) list = list.filter(d => d.created_at.slice(0, 10) >= dateFrom);
    if (dateTo) list = list.filter(d => d.created_at.slice(0, 10) <= dateTo);

    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return list;
  }, [decisions, filterAction, search, dateFrom, dateTo, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const arrow = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = [
      'Horodatage', 'Date séjour', 'Action', 'Stratégie', 'Recommandation',
      'Tarif actuel', 'Tarif suggéré', 'Tarif final', 'Confiance %', 'Pression %',
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = filtered.map(d => [
      d.created_at,
      d.stay_date,
      ACTION_LABEL[d.action] ?? d.action,
      d.strategy,
      d.recommendation,
      d.current_price,
      d.suggested_price,
      d.final_price,
      d.confidence_score ?? '',
      d.market_pressure_percent ?? '',
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decisions_rms_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Stats globales
  const stats = {
    total: decisions.length,
    accepted: decisions.filter(d => d.action === 'accepted').length,
    rejected: decisions.filter(d => d.action === 'rejected').length,
    maintained: decisions.filter(d => d.action === 'maintained').length,
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] min-h-0">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={History}
          title="Historique Décisions RMS"
          subtitle="Audit horodaté immutable de toutes les validations sur les recommandations IA"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 space-y-5">

        {/* Flux moteur RMS Enterprise (règles tactiques + autopilote + garde-fous) */}
        <RmsEnterpriseFeed limit={5} />

        {/* Stats — cliquables pour pivoter le filtre */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setFilterAction('all')}
            className={cn(
              'bg-white rounded-lg border p-4 text-left transition-all',
              filterAction === 'all' ? 'border-gray-700 ring-2 ring-gray-200' : 'border-gray-200 hover:border-gray-400'
            )}
          >
            <p className="text-xs text-gray-500 mb-1">Total décisions</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </button>
          <button
            onClick={() => setFilterAction('accepted')}
            className={cn(
              'bg-white rounded-lg border p-4 text-left transition-all',
              filterAction === 'accepted' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200 hover:border-emerald-300'
            )}
          >
            <p className="text-xs text-gray-500 mb-1">Acceptées</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.accepted}</p>
          </button>
          <button
            onClick={() => setFilterAction('rejected')}
            className={cn(
              'bg-white rounded-lg border p-4 text-left transition-all',
              filterAction === 'rejected' ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 hover:border-red-300'
            )}
          >
            <p className="text-xs text-gray-500 mb-1">Refusées</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </button>
          <button
            onClick={() => setFilterAction('maintained')}
            className={cn(
              'bg-white rounded-lg border p-4 text-left transition-all',
              filterAction === 'maintained' ? 'border-gray-500 ring-2 ring-gray-300' : 'border-gray-200 hover:border-gray-400'
            )}
          >
            <p className="text-xs text-gray-500 mb-1">Maintenues</p>
            <p className="text-2xl font-bold text-gray-600">{stats.maintained}</p>
          </button>
        </div>

        {/* Filtres avancés + actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Filtres :</span>
          {(['all', 'accepted', 'rejected', 'maintained'] as const).map(action => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                filterAction === action
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 border border-gray-300'
              )}
            >
              {action === 'all' ? 'Toutes' : ACTION_LABEL[action]}
            </button>
          ))}

          <div className="h-6 w-px bg-gray-200 mx-1" />

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Date séjour, stratégie..."
              className="pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none w-56"
            />
          </div>

          <label className="text-xs text-gray-600 flex items-center gap-1">
            Du
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-1">
            au
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </label>

          {(search || dateFrom || dateTo || filterAction !== 'all') && (
            <button
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterAction('all'); }}
              className="text-xs text-gray-500 hover:text-red-600 underline"
            >
              Réinitialiser
            </button>
          )}

          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="ml-auto px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 flex items-center gap-1.5 font-semibold"
            title="Exporter en CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter CSV
          </button>

          <span className="text-xs text-gray-400 w-full mt-1">
            {filtered.length} / {decisions.length} affichées · table append-only (immutable)
          </span>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm">Chargement de l'historique…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-900">Impossible de charger l'historique</p>
              <p className="text-red-700 mt-1">{error}</p>
              <p className="text-red-600 mt-2 text-xs">
                Vérifiez que la table <code>rms_decisions</code> est créée (migration <code>20260518_rms_decisions.sql</code>)
                et que vous êtes authentifié à un hôtel.
              </p>
            </div>
          </div>
        )}

        {/* Liste vide */}
        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium">Aucune décision enregistrée</p>
            <p className="text-xs mt-1">
              Les décisions apparaîtront ici dès que vous validerez des recommandations dans le tableau RMS.
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th onClick={() => toggleSort('created_at')} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Horodatage{arrow('created_at')}</th>
                    <th onClick={() => toggleSort('stay_date')} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Date séjour{arrow('stay_date')}</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Stratégie</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Recommandation IA</th>
                    <th onClick={() => toggleSort('current_price')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Tarif actuel{arrow('current_price')}</th>
                    <th onClick={() => toggleSort('suggested_price')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Tarif suggéré{arrow('suggested_price')}</th>
                    <th onClick={() => toggleSort('final_price')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Tarif final{arrow('final_price')}</th>
                    <th onClick={() => toggleSort('confidence_score')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Confiance{arrow('confidence_score')}</th>
                    <th onClick={() => toggleSort('market_pressure_percent')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Pression{arrow('market_pressure_percent')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap font-mono text-xs">
                        {formatDateTime(d.created_at)}
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                        {d.stay_date}
                      </td>
                      <td className="px-3 py-2"><ActionBadge action={d.action} /></td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{d.strategy}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{d.recommendation}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{Math.round(d.current_price)}€</td>
                      <td className="px-3 py-2 text-right text-blue-600 font-semibold">{Math.round(d.suggested_price)}€</td>
                      <td className={cn(
                        'px-3 py-2 text-right font-bold',
                        d.action === 'accepted' ? 'text-emerald-600' :
                        d.action === 'rejected' ? 'text-red-600' :
                        'text-gray-600'
                      )}>
                        {Math.round(d.final_price)}€
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 text-xs">
                        {d.confidence_score !== null ? `${d.confidence_score}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 text-xs">
                        {d.market_pressure_percent !== null ? `${d.market_pressure_percent}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-gray-400">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Cette table est immutable (append-only). Une décision enregistrée ne peut être ni modifiée ni supprimée.
            Pour corriger, ré-effectuez une nouvelle décision sur la même date — l'historique complet sera conservé.
          </span>
        </div>
      </div>
    </div>
  );
};
