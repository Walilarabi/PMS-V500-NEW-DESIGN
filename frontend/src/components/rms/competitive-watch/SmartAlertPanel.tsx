/**
 * FLOWTYM RMS — Alerte intelligente.
 *
 * Callout d'opportunité Revenue Management produit par le moteur
 * `detectRmOpportunity`. Couleur et ton selon la sévérité.
 */

import React from 'react';
import type { RmOpportunity } from '../../../lib/rms/rmAlertEngine';

const SEVERITY_STYLE: Record<
  RmOpportunity['severity'],
  { box: string; title: string; text: string }
> = {
  critical: {
    box: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/15 border-orange-200 dark:border-orange-900/40',
    title: 'text-orange-700 dark:text-orange-300',
    text: 'text-orange-700/80 dark:text-orange-200/70',
  },
  warning: {
    box: 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-900/40',
    title: 'text-amber-700 dark:text-amber-300',
    text: 'text-amber-700/80 dark:text-amber-200/70',
  },
  info: {
    box: 'bg-blue-50 dark:bg-blue-900/15 border-blue-200 dark:border-blue-900/40',
    title: 'text-blue-700 dark:text-blue-300',
    text: 'text-blue-700/80 dark:text-blue-200/70',
  },
};

export interface SmartAlertPanelProps {
  opportunity: RmOpportunity;
  className?: string;
}

export const SmartAlertPanel: React.FC<SmartAlertPanelProps> = ({
  opportunity,
  className,
}) => {
  const style = SEVERITY_STYLE[opportunity.severity];
  return (
    <div className={`rounded-xl border p-3 flex gap-2.5 ${style.box} ${className ?? ''}`}>
      <span className="text-[16px] leading-none mt-0.5 shrink-0" aria-hidden>
        {opportunity.emoji}
      </span>
      <div className="min-w-0">
        <div className={`text-[12.5px] font-bold ${style.title}`}>
          {opportunity.title}
        </div>
        <p className={`text-[12px] leading-snug mt-0.5 ${style.text}`}>
          {opportunity.message}
        </p>
      </div>
    </div>
  );
};
