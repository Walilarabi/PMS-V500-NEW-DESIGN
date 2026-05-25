/**
 * FLOWTYM RMS — Top Critical Events
 *
 * Liste compacte des événements à fort impact à venir, triée par
 * (Impact Score × Confidence) décroissant. Chaque ligne affiche :
 *   • nom + date
 *   • Impact Score + Confidence
 *   • Indicateur recommandation RMS active (badge)
 */

import React from 'react';
import { ShieldCheck, ShieldAlert, Zap } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type {
  EnrichedMarketEvent,
  RmsRecommendation,
} from '@/src/types/marketIntelligence';

interface CriticalEventsListProps {
  enriched: EnrichedMarketEvent[];
  recommendations: Map<string, RmsRecommendation[]>;
  today: string;
}

export const CriticalEventsList: React.FC<CriticalEventsListProps> = ({
  enriched, recommendations, today,
}) => {
  const upcoming = enriched
    .filter((e) => e.event.endDate >= today && e.event.status !== 'archived' && e.event.status !== 'cancelled')
    .filter((e) => e.impactScore.score >= 50)
    .sort((a, b) =>
      (b.impactScore.score * b.confidence.score) - (a.impactScore.score * a.confidence.score),
    )
    .slice(0, 6);

  if (upcoming.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl px-3 py-4 text-center text-[12px] text-slate-400">
        Aucun événement à fort impact détecté sur la fenêtre.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {upcoming.map((e) => {
        const recos = recommendations.get(e.event.id) ?? [];
        const aggressiveCount = recos.filter((r) => r.severity === 'aggressive' || r.severity === 'maximum').length;
        return (
          <div
            key={e.event.id}
            className="px-3 py-2 rounded-lg bg-white ring-1 ring-slate-100 hover:ring-violet-200 hover:bg-violet-50/30 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-slate-900 truncate">{e.event.name}</div>
                <div className="text-[10.5px] text-slate-400 tabular-nums mt-0.5">
                  {formatDateRange(e.event.startDate, e.event.endDate)} · {e.event.venue ?? e.event.city}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <ScoreBadge label="Impact" value={e.impactScore.score} kind="impact" />
                <ScoreBadge label="Conf." value={e.confidence.score} kind="confidence" />
              </div>
            </div>
            {recos.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px]">
                <Zap className="w-3 h-3 text-violet-500" />
                <span className="text-violet-700 font-medium">
                  {recos.length} reco{recos.length > 1 ? 's' : ''} RMS
                </span>
                {aggressiveCount > 0 && (
                  <span className="text-rose-600 font-medium">
                    · {aggressiveCount} agressive{aggressiveCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

function ScoreBadge({ label, value, kind }: { label: string; value: number; kind: 'impact' | 'confidence' }) {
  const tone =
    kind === 'impact'
      ? value >= 80 ? 'rose' : value >= 60 ? 'amber' : 'slate'
      : value >= 70 ? 'emerald' : value >= 45 ? 'amber' : 'rose';
  const cls = {
    rose:    'bg-rose-50 text-rose-700 ring-rose-100',
    amber:   'bg-amber-50 text-amber-700 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    slate:   'bg-slate-50 text-slate-700 ring-slate-100',
  }[tone];
  const Icon = kind === 'impact' ? ShieldAlert : ShieldCheck;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ring-1 tabular-nums', cls)}
      title={`${label} ${value}/100`}
    >
      <Icon className="w-2.5 h-2.5" />
      {value}
    </span>
  );
}

function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const e = new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${s} → ${e}`;
}
