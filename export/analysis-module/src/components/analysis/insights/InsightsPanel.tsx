/**
 * FLOWTYM — Insights Panel
 *
 * Panneau affichant 1 à N insights actionnables au-dessus d'un rapport.
 * Insights sont calculés par chaque renderer via une fonction dédiée.
 */

import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { SEVERITY_STYLE, type Insight } from './types';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export interface InsightsPanelProps {
  insights: Insight[];
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-violet-50/50 to-blue-50/30 rounded-lg border border-violet-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-violet-600" />
        <h3 className="text-xs font-bold text-violet-900 uppercase tracking-wider">
          Insights actionnables ({insights.length})
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map(insight => {
          const style = SEVERITY_STYLE[insight.severity];
          const Icon = style.icon;
          return (
            <div
              key={insight.id}
              className={cn(
                'rounded-lg border p-3',
                style.bg,
                style.border,
              )}
            >
              <div className="flex items-start gap-2 mb-1">
                <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', style.iconColor)} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-xs font-bold', style.text)}>{insight.title}</div>
                </div>
              </div>
              <p className={cn('text-[11px] leading-relaxed', style.text, 'opacity-90')}>{insight.message}</p>
              {insight.action && (
                <button
                  onClick={() => {
                    if (insight.action?.page) {
                      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: insight.action.page } }));
                    } else if (insight.action?.href) {
                      window.location.href = insight.action.href;
                    }
                  }}
                  className={cn(
                    'mt-2 inline-flex items-center gap-1 text-[11px] font-bold hover:underline',
                    style.text
                  )}
                >
                  {insight.action.label}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
