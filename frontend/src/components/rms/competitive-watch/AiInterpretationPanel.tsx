/**
 * FLOWTYM RMS — Panneau d'interprétation IA.
 *
 * Analyse marché générée à partir des deltas de comparaison + callout
 * d'alerte intelligente.
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import {
  getComparisonData, COMPARE_PERIODS, KPI_CARDS,
} from '../../../data/rms/mockCompetitiveWatchData';
import type { ComparePeriodKey } from '../../../data/rms/mockCompetitiveWatchData';
import { generateAiInterpretation } from '../../../lib/rms/aiInterpretationEngine';
import { detectRmOpportunity } from '../../../lib/rms/rmAlertEngine';
import { SmartAlertPanel } from './SmartAlertPanel';

function euro(value: string): number {
  return parseInt(value.replace(/[^\d-]/g, ''), 10) || 0;
}

export interface AiInterpretationPanelProps {
  period: ComparePeriodKey;
  selectedLabel: string;
}

export const AiInterpretationPanel: React.FC<AiInterpretationPanelProps> = ({
  period,
  selectedLabel,
}) => {
  const { interpretation, opportunity } = useMemo(() => {
    const periodMeta = COMPARE_PERIODS.find((p) => p.key === period) ?? COMPARE_PERIODS[0];
    const days = getComparisonData(period);
    const day = days.find((d) => d.label === selectedLabel) ?? days[0];

    if (!day) {
      return { interpretation: null, opportunity: null };
    }

    const demandDelta = day.demandToday - day.demandPast;
    const medianDelta = day.medianToday - day.medianPast;

    const ourPrice = euro(KPI_CARDS.find((k) => k.id === 'notre-tarif')?.value ?? '326');
    const median = euro(KPI_CARDS.find((k) => k.id === 'tarif-median')?.value ?? '340');
    const gap = ourPrice - median;

    return {
      interpretation: generateAiInterpretation({
        compareLabel: periodMeta.label,
        demandDelta,
        medianDelta,
        gap,
      }),
      opportunity: detectRmOpportunity({
        ourPrice,
        medianCompset: median,
        demand: day.demandToday,
        demandDelta,
      }),
    };
  }, [period, selectedLabel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 flex flex-col"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-300" />
        </span>
        <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-slate-50">
          Interprétation IA
        </h3>
      </div>

      {interpretation ? (
        <>
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 flex-1">
            {interpretation.segments.map((seg, i) => (
              <span
                key={i}
                className={seg.bold ? 'font-bold text-slate-900 dark:text-slate-100' : undefined}
              >
                {seg.text}
              </span>
            ))}
            <span aria-hidden> {interpretation.emoji}</span>
          </p>
          {opportunity && <SmartAlertPanel opportunity={opportunity} className="mt-3" />}
        </>
      ) : (
        <p className="text-[12.5px] text-slate-400 dark:text-slate-500">
          Aucune donnée à interpréter pour la période affichée.
        </p>
      )}
    </motion.div>
  );
};
