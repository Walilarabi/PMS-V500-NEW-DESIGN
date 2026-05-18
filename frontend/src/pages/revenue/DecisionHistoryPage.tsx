/**
 * FLOWTYM — Historique Décisions RMS
 *
 * Consulte la table rms_decisions (Supabase, append-only).
 * Affiche horodaté chaque action utilisateur sur les recommandations IA.
 */

import React, { useEffect, useState } from 'react';
import { History, CheckCircle2, XCircle, MinusCircle, AlertCircle, Loader2 } from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { fetchRmsDecisions, type RmsDecisionRecord } from '../../services/rms-decisions.service';

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

export const DecisionHistoryPage: React.FC = () => {
  const [decisions, setDecisions] = useState<RmsDecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<'all' | 'accepted' | 'rejected' | 'maintained'>('all');

  useEffect(() => {
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

  const filtered = filterAction === 'all'
    ? decisions
    : decisions.filter(d => d.action === filterAction);

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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total décisions</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Acceptées</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.accepted}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Refusées</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Maintenues</p>
            <p className="text-2xl font-bold text-gray-600">{stats.maintained}</p>
          </div>
        </div>

        {/* Filtre */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filtrer :</span>
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
          <span className="ml-auto text-xs text-gray-400">
            {filtered.length} affichées · table append-only (immutable)
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
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Horodatage</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Date séjour</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Stratégie</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Recommandation IA</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Tarif actuel</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Tarif suggéré</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Tarif final</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Confiance</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Pression</th>
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
