/**
 * FLOWTYM RMS — Event Intelligence Section
 *
 * Section intégrée dans le panneau détail événement. Affiche pour
 * l'événement donné :
 *   • Event Impact Score 0-100 + breakdown
 *   • Confidence Score + facteurs + anomalies
 *   • Reliability historique (si dispo)
 *   • Forecast d'impact attendu
 *   • Recommandations RMS explicables (causes + sévérité)
 *
 * Tout vient du hook useMarketIntelligence (orchestrateur).
 */

import React, { useState } from 'react';
import {
  Sparkles, ShieldAlert, ShieldCheck, History, Target, Zap, AlertOctagon,
  AlertTriangle, Info, Check, X as XIcon, Clock,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useMarketIntelligence } from '@/src/hooks/useMarketIntelligence';
import type { RMSMarketEvent } from '@/src/types/events';
import {
  RECOMMENDATION_TYPE_LABELS,
  type RmsRecommendation,
  type RmsRecommendationSeverity,
} from '@/src/types/marketIntelligence';
import { explainRecommendation } from '@/src/services/marketIntelligence';
import { recordAction, upsertRecommendations } from '@/src/services/marketIntelligence/persistence.service';

interface EventIntelligenceSectionProps {
  event: RMSMarketEvent;
}

export const EventIntelligenceSection: React.FC<EventIntelligenceSectionProps> = ({ event }) => {
  const intelligence = useMarketIntelligence();
  const enriched = intelligence.enriched.find((e) => e.event.id === event.id);
  const forecast = intelligence.forecasts.get(event.id);
  const recos = intelligence.recommendations.get(event.id) ?? [];

  if (!enriched) {
    return (
      <div className="text-[12px] text-slate-400 italic">
        Pas encore d'intelligence marché pour cet événement.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Score Impact + Confidence ── strip premium */}
      <div className="grid grid-cols-2 gap-2.5">
        <ScoreCard
          label="Event Impact"
          score={enriched.impactScore.score}
          sub={enriched.impactScore.classification.replace(/_/g, ' ')}
          icon={Sparkles}
        />
        <ScoreCard
          label="Confidence"
          score={enriched.confidence.score}
          sub={enriched.confidence.allowsAggressiveActions ? 'Actions agressives OK' : 'Surveillance'}
          icon={enriched.confidence.allowsAggressiveActions ? ShieldCheck : ShieldAlert}
          flipColor
        />
      </div>

      {/* Breakdown Impact Score */}
      <section>
        <SubTitle icon={Target}>Détail Impact Score (somme = score)</SubTitle>
        <div className="grid grid-cols-2 gap-1.5 mt-1.5 text-[11px]">
          {Object.entries(enriched.impactScore.breakdown).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 px-2 py-1 bg-slate-50 rounded">
              <span className="text-slate-600 truncate capitalize">{prettyKey(k)}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{(v as number).toFixed(1)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Forecast */}
      {forecast && (
        <section>
          <SubTitle icon={Target}>Forecast d'impact attendu</SubTitle>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            <ForecastTile label="ADR" value={`+${forecast.expectedAdrLift.toFixed(0)}%`} tone="violet" />
            <ForecastTile label="TO" value={`+${forecast.expectedOccupancyLift.toFixed(0)} pts`} tone="emerald" />
            <ForecastTile label="Compression" value={`${forecast.expectedCompression.toFixed(0)}/100`} tone="rose" />
          </div>
          <p className="mt-1.5 text-[10.5px] text-slate-400">
            Confidence du forecast : <span className="font-semibold text-slate-700">{forecast.confidence}%</span>
          </p>
        </section>
      )}

      {/* Reliability historique */}
      {enriched.reliability && enriched.reliability.editionsObserved > 0 && (
        <section>
          <SubTitle icon={History}>Fiabilité historique</SubTitle>
          <div className="mt-1.5 bg-slate-50 rounded-xl px-3 py-2 space-y-1.5 text-[11.5px]">
            <Row label="Éditions observées" value={`${enriched.reliability.editionsObserved}`} />
            <Row label="Reliability score" value={`${enriched.reliability.score}/100`} />
            <Row label="Tendance" value={trendLabel(enriched.reliability.trend)} />
            <Row label="Lift ADR moyen" value={`+${enriched.reliability.historicLift.adrDelta.toFixed(0)}%`} />
            <Row label="Lift TO moyen" value={`+${enriched.reliability.historicLift.occupancyDelta.toFixed(0)} pts`} />
            {enriched.reliability.shouldPrioritizeNextEdition && (
              <div className="mt-1.5 px-2 py-1 bg-violet-100 text-violet-800 rounded text-[10.5px] font-medium">
                Priorisé pour la prochaine édition (lift significatif observé).
              </div>
            )}
          </div>
        </section>
      )}

      {/* Anomalies */}
      {enriched.confidence.anomalies.length > 0 && (
        <section>
          <SubTitle icon={AlertTriangle}>Anomalies détectées (anti-bruit)</SubTitle>
          <ul className="mt-1.5 space-y-1">
            {enriched.confidence.anomalies.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                {a.severity === 'critical' ? <AlertOctagon className="w-3 h-3 text-rose-500 mt-0.5" />
                  : a.severity === 'warning' ? <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />
                  : <Info className="w-3 h-3 text-slate-400 mt-0.5" />}
                <span className="text-slate-600">
                  <span className="font-medium text-slate-700">{prettyKey(a.code)} :</span> {a.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recommandations RMS */}
      <section>
        <SubTitle icon={Zap}>Recommandations RMS ({recos.length})</SubTitle>
        {recos.length === 0 ? (
          <div className="mt-1.5 text-[11.5px] text-slate-500 italic">
            Aucune reco déclenchée à ce stade — pression marché insuffisante ou confidence trop basse.
          </div>
        ) : (
          <ul className="mt-1.5 space-y-2">
            {recos.map((r) => (
              <RecommendationItem key={r.id} reco={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* ATOMS                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function SubTitle({
  icon: Icon, children,
}: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide font-semibold text-slate-500">
      <Icon className="w-3 h-3" /> {children}
    </h4>
  );
}

function ScoreCard({
  label, score, sub, icon: Icon, flipColor,
}: {
  label: string;
  score: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  flipColor?: boolean;
}) {
  const tone = (() => {
    const s = flipColor ? 100 - score : score;
    if (s >= 80) return flipColor ? 'rose' : 'emerald';
    if (s >= 60) return 'amber';
    if (s >= 40) return 'violet';
    return 'slate';
  })();
  const colorMap = {
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    slate:   { bg: 'bg-slate-50',   text: 'text-slate-700' },
  }[tone];
  return (
    <div className={cn('rounded-xl px-3 py-2.5', colorMap.bg)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('w-3.5 h-3.5', colorMap.text)} />
        <span className="text-[10.5px] uppercase tracking-wide font-medium text-slate-500">{label}</span>
      </div>
      <div className={cn('text-[20px] font-bold tabular-nums leading-none', colorMap.text)}>
        {score}<span className="text-[12px] text-slate-400 font-normal">/100</span>
      </div>
      {sub && <div className="text-[10.5px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ForecastTile({ label, value, tone }: { label: string; value: string; tone: 'violet' | 'emerald' | 'rose' }) {
  const c = {
    violet:  'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose:    'bg-rose-50 text-rose-700',
  }[tone];
  return (
    <div className={cn('rounded-lg px-2.5 py-2', c)}>
      <div className="text-[10px] uppercase tracking-wide font-medium opacity-70">{label}</div>
      <div className="text-[15px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

const RecommendationItem: React.FC<{ reco: RmsRecommendation }> = ({ reco }) => {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected' | 'snoozed' | 'syncing'>('pending');

  const handleAction = async (action: 'accept' | 'reject' | 'snooze') => {
    setStatus('syncing');
    // Persist reco then action (best-effort, offline OK)
    await upsertRecommendations([reco]);
    const res = await recordAction({
      recommendationId: reco.id,
      action,
      appliedValue: action === 'accept' ? reco.suggestedValue : undefined,
    });
    setStatus(res.ok
      ? (action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'snoozed')
      : 'pending'); // si offline, on remet pending pour retry possible
  };

  return (
    <li className="bg-white rounded-lg ring-1 ring-slate-100 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SeverityChip severity={reco.severity} />
            <span className="text-[10.5px] uppercase tracking-wide font-medium text-slate-400">
              {RECOMMENDATION_TYPE_LABELS[reco.type]}
            </span>
          </div>
          <div className="text-[12.5px] font-semibold text-slate-900 mt-0.5">{reco.title}</div>
          <ul className="mt-1.5 space-y-0.5">
            {reco.causes.slice(0, 3).map((c, i) => (
              <li key={i} className="text-[10.5px] text-slate-600 flex items-start gap-1">
                <span className="text-slate-400">•</span>
                <span><span className="font-medium text-slate-700">{c.label} :</span> {c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Conf.</div>
          <div className="text-[12.5px] font-semibold tabular-nums text-slate-900">{reco.confidence}%</div>
        </div>
      </div>

      {/* Boutons d'action — uniquement si pending */}
      {status === 'pending' && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
          <button
            onClick={() => handleAction('accept')}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200 transition"
          >
            <Check className="w-3 h-3" /> Accepter
          </button>
          <button
            onClick={() => handleAction('reject')}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 ring-1 ring-rose-200 transition"
          >
            <XIcon className="w-3 h-3" /> Rejeter
          </button>
          <button
            onClick={() => handleAction('snooze')}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200 transition"
            title="Reporter — la reco reste visible mais ne déclenche pas d'alerte."
          >
            <Clock className="w-3 h-3" />
          </button>
        </div>
      )}
      {status === 'syncing' && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500 italic">
          Enregistrement en cours…
        </div>
      )}
      {status === 'accepted' && (
        <div className="mt-2 pt-2 border-t border-emerald-100 text-[10.5px] text-emerald-700 font-medium flex items-center gap-1">
          <Check className="w-3 h-3" /> Recommandation acceptée — à appliquer dans le RMS.
        </div>
      )}
      {status === 'rejected' && (
        <div className="mt-2 pt-2 border-t border-rose-100 text-[10.5px] text-rose-700 font-medium flex items-center gap-1">
          <XIcon className="w-3 h-3" /> Rejetée — feedback enregistré pour l'IA.
        </div>
      )}
      {status === 'snoozed' && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[10.5px] text-slate-600 font-medium flex items-center gap-1">
          <Clock className="w-3 h-3" /> Reportée — réapparaîtra à la prochaine analyse.
        </div>
      )}
    </li>
  );
};

function SeverityChip({ severity }: { severity: RmsRecommendationSeverity }) {
  const map = {
    soft:       { cls: 'bg-slate-100 text-slate-700',   label: 'Doux' },
    standard:   { cls: 'bg-violet-100 text-violet-700', label: 'Standard' },
    aggressive: { cls: 'bg-amber-100 text-amber-800',   label: 'Agressif' },
    maximum:    { cls: 'bg-rose-100 text-rose-800',     label: 'Maximum' },
  }[severity];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', map.cls)}>
      {map.label}
    </span>
  );
}

function prettyKey(k: string): string {
  return k
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function trendLabel(t: 'rising' | 'stable' | 'declining'): string {
  return t === 'rising' ? 'Croissante ↗︎' : t === 'declining' ? 'Décroissante ↘︎' : 'Stable →';
}
