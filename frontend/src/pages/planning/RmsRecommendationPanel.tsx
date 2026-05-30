/**
 * FLOWTYM — Panneau recommandations RMS (maquette #17, sidebar droite).
 *
 * Liste les recommandations tarifaires `pending`, groupées par confiance.
 * Chaque carte expose deux actions réelles :
 *   - Appliquer : écrit le prix recommandé dans rate_prices (via le hook).
 *   - Rejeter   : marque la recommandation rejetée.
 *
 * États loading / error / empty gérés. Aucune donnée fictive.
 */
import React from 'react';
import { TrendingUp, TrendingDown, Check, X, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useRmsRecommendations, type RmsRecommendation } from '@/src/hooks/planning/useRmsRecommendations';

function fmtEuro(n: number | null): string {
  if (n == null) return '—';
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

function confidenceTone(score: number | null): { label: string; cls: string } {
  const s = score ?? 0;
  if (s >= 80) return { label: 'Élevée', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  if (s >= 50) return { label: 'Moyenne', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return { label: 'Faible', cls: 'bg-gray-50 text-gray-500 ring-gray-200' };
}

interface RecoCardProps {
  rec: RmsRecommendation;
  onApply: () => void;
  onReject: () => void;
  busy: boolean;
}

const RecoCard: React.FC<RecoCardProps> = ({ rec, onApply, onReject, busy }) => {
  const up = (rec.delta_percent ?? 0) >= 0;
  const conf = confidenceTone(rec.confidence_score);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">{rec.date}</span>
        <span className={cn('text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ring-1 ring-inset', conf.cls)}>
          {conf.label} {rec.confidence_score != null ? `${rec.confidence_score}%` : ''}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-gray-400 line-through">{fmtEuro(rec.current_price)}</span>
        <span className={cn('inline-flex items-center gap-0.5 text-lg font-black', up ? 'text-emerald-600' : 'text-rose-600')}>
          {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          {fmtEuro(rec.recommended_price)}
        </span>
        {rec.delta_percent != null && (
          <span className={cn('text-[11px] font-black', up ? 'text-emerald-500' : 'text-rose-500')}>
            {up ? '+' : ''}{rec.delta_percent.toFixed(1)}%
          </span>
        )}
      </div>

      {rec.warnings && rec.warnings.length > 0 && (
        <div className="flex items-start gap-1 mb-2 text-[10px] text-amber-600">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{rec.warnings[0]}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onApply}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wide hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
        >
          <Check size={13} /> Appliquer
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-xl border border-gray-200 text-gray-500 text-[11px] font-black uppercase tracking-wide hover:bg-gray-50 disabled:opacity-50 transition-all"
        >
          <X size={13} /> Rejeter
        </button>
      </div>
    </div>
  );
};

export function RmsRecommendationPanel({
  startDate,
  rangeDays,
}: {
  startDate: Date | string;
  rangeDays: number;
}) {
  const { recommendations, count, isLoading, isError, apply, reject, pendingActionId } =
    useRmsRecommendations(startDate, rangeDays);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
        <Sparkles size={15} className="text-indigo-500" />
        <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Recommandations RMS</span>
        {count > 0 && (
          <span className="ml-auto text-[10px] font-black text-white bg-indigo-600 rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
        {isLoading && (
          <div className="space-y-2.5" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="text-center py-8 text-rose-500 text-xs font-semibold">
            Impossible de charger les recommandations.
          </div>
        )}

        {!isLoading && !isError && count === 0 && (
          <div className="text-center py-10 px-4" role="status">
            <Sparkles className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-[12px] font-bold text-gray-500">Aucune recommandation en attente</p>
            <p className="mt-1 text-[10px] text-gray-400">Le RMS n'a rien à proposer sur cette période.</p>
          </div>
        )}

        {!isLoading && !isError && recommendations.map((rec) => (
          <RecoCard
            key={rec.id}
            rec={rec}
            busy={pendingActionId === rec.id}
            onApply={() => apply.mutate(rec)}
            onReject={() => reject.mutate({ id: rec.id, reason: 'Rejetée depuis le planning' })}
          />
        ))}
      </div>
    </div>
  );
}
