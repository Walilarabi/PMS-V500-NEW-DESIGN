/**
 * FLOWTYM RMS — Carte de recommandation tarifaire (Autopilote).
 *
 * Affiche une recommandation, son verdict face aux garde-fous, l'indice de
 * confiance IA, le niveau de risque, l'impact estimé (RevPAR / ADR / TO) et
 * les facteurs ayant influencé la décision.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, Check, X, ShieldCheck, ShieldAlert, ShieldX,
  ChevronDown, CalendarDays, Bed, Radio, Sparkles,
} from 'lucide-react';
import {
  evaluateRecommendation,
  type PriceRecommendation,
  type AutopilotParams,
  type RiskLevel,
} from '@/src/lib/rms/autoStrategyEngine';
import { STRATEGY_BY_ID } from '@/src/lib/rms/strategies';
import type { AutomationLevel } from '@/src/store/rmsAutomationStore';

const RISK_META: Record<RiskLevel, { label: string; cls: string }> = {
  low: { label: 'Risque faible', cls: 'text-emerald-600 bg-emerald-50' },
  medium: { label: 'Risque modéré', cls: 'text-amber-600 bg-amber-50' },
  high: { label: 'Risque élevé', cls: 'text-red-600 bg-red-50' },
};

const VERDICT_META = {
  auto: { label: 'Conforme — applicable en autopilote', icon: ShieldCheck, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  review: { label: 'Validation humaine requise', icon: ShieldAlert, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  blocked: { label: 'Bloqué par les garde-fous', icon: ShieldX, cls: 'text-red-700 bg-red-50 border-red-200' },
} as const;

function fmtSigned(v: number, unit: string): string {
  return `${v > 0 ? '+' : ''}${v}${unit}`;
}

interface RecommendationCardProps {
  reco: PriceRecommendation;
  params: AutopilotParams;
  level: AutomationLevel;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  reco,
  params,
  level,
  onApply,
  onReject,
}) => {
  const [open, setOpen] = useState(false);
  const verdict = evaluateRecommendation(reco, params);
  const vMeta = VERDICT_META[verdict.outcome];
  const strategy = STRATEGY_BY_ID[reco.strategy];
  const delta = reco.recommendedPrice - reco.currentPrice;
  const deltaPct = ((delta / reco.currentPrice) * 100).toFixed(1);
  const risk = RISK_META[reco.risk];
  const hits = verdict.checks.filter((c) => c.status === 'hit');

  // En autopilote (niveau ≥ 3) une reco conforme est poussée sans confirmation.
  const autoHandled =
    (level >= 3 && verdict.outcome === 'auto') ||
    (level === 4 && verdict.outcome === 'review');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden"
    >
      <div className="p-4">
        {/* Ligne 1 — contexte */}
        <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-gray-500">
          <span className="flex items-center gap-1 font-semibold text-gray-700">
            <CalendarDays className="w-3.5 h-3.5" /> {reco.stayDate}
          </span>
          <span className="text-gray-300">•</span>
          <span className="flex items-center gap-1">
            <Bed className="w-3.5 h-3.5" /> {reco.roomType}
          </span>
          <span className="text-gray-300">•</span>
          <span className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" /> {reco.channel}
          </span>
          {reco.isEvent && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
              ÉVÉNEMENT
            </span>
          )}
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: strategy.accent }}
          >
            {strategy.name}
          </span>
        </div>

        {/* Ligne 2 — prix + impact */}
        <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-semibold text-gray-400 line-through">
              {reco.currentPrice} €
            </span>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <span className="text-[22px] font-extrabold text-gray-900">
              {reco.recommendedPrice} €
            </span>
            <span
              className={`text-[12px] font-bold ${
                delta >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {delta >= 0 ? '+' : ''}
              {delta} € ({delta >= 0 ? '+' : ''}
              {deltaPct} %)
            </span>
          </div>
          <div className="flex items-center gap-4">
            {[
              { label: 'RevPAR', value: fmtSigned(reco.impact.revpar, ' %') },
              { label: 'ADR', value: fmtSigned(reco.impact.adr, ' %') },
              { label: 'TO', value: fmtSigned(reco.impact.occ, ' pt') },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-[10px] text-gray-400">{m.label}</div>
                <div
                  className={`text-[12.5px] font-bold ${
                    m.value.startsWith('+')
                      ? 'text-emerald-600'
                      : m.value.startsWith('-')
                        ? 'text-red-500'
                        : 'text-gray-500'
                  }`}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ligne 3 — confiance + risque + verdict */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] text-gray-400 font-medium">Confiance IA</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  reco.confidence >= params.minConfidence ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${reco.confidence}%` }}
              />
            </div>
            <span className="text-[11.5px] font-bold text-gray-700">{reco.confidence} %</span>
          </div>
          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${risk.cls}`}>
            {risk.label}
          </span>
          <span
            className={`flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${vMeta.cls}`}
          >
            <vMeta.icon className="w-3 h-3" />
            {vMeta.label}
          </span>
        </div>

        {/* Détail repliable — facteurs + garde-fous */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-[11.5px] font-semibold text-[#8B5CF6] mt-3"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? 'Masquer' : 'Voir'} le détail de la décision
          <span className="text-gray-400 font-medium">
            ({verdict.checks.length - hits.length}/{verdict.checks.length} garde-fous conformes)
          </span>
        </button>

        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                Facteurs déterminants
              </div>
              <ul className="space-y-1">
                {reco.factors.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11.5px] text-gray-600">
                    <span className="w-1 h-1 rounded-full bg-[#8B5CF6] mt-1.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="text-[11px] font-bold text-gray-700 mb-2">Garde-fous</div>
              <ul className="space-y-1">
                {verdict.checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-1.5 text-[11.5px]">
                    {c.status === 'ok' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <span className={c.status === 'ok' ? 'text-gray-500' : 'text-red-600 font-medium'}>
                      {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </div>

      {/* Barre d'action */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
        <span className="text-[11px] text-gray-500 flex-1">
          {autoHandled
            ? "Sera poussée automatiquement vers le Channel Manager"
            : verdict.outcome === 'blocked'
              ? 'Action automatique bloquée — décision manuelle requise'
              : 'En attente de validation'}
        </span>
        <button
          type="button"
          onClick={() => onReject(reco.id)}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold text-gray-500 hover:bg-gray-100 flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Rejeter
        </button>
        <button
          type="button"
          onClick={() => onApply(reco.id)}
          className="h-8 px-3.5 rounded-lg text-[12px] font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          {level === 1 ? 'Appliquer' : 'Confirmer'}
        </button>
      </div>
    </motion.div>
  );
};
