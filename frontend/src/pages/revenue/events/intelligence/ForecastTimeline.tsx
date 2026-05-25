/**
 * FLOWTYM RMS — Forecast Timeline
 *
 * Timeline horizontale qui affiche le forecast d'impact ADR par
 * événement à venir sur la fenêtre. Tri chronologique.
 *
 * Pas de lib chart — SVG natif. Barres horizontales colorées par
 * niveau d'impact, label événement à gauche, valeurs chiffrées à droite.
 */

import React, { useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import type {
  EnrichedMarketEvent,
  MarketImpactForecast,
} from '@/src/types/marketIntelligence';

interface ForecastTimelineProps {
  forecasts: MarketImpactForecast[];
  enriched: EnrichedMarketEvent[];
  from: string;
  to: string;
}

export const ForecastTimeline: React.FC<ForecastTimelineProps> = ({
  forecasts, enriched, from, to,
}) => {
  const enrichedById = useMemo(() => {
    const m = new Map<string, EnrichedMarketEvent>();
    for (const e of enriched) m.set(e.event.id, e);
    return m;
  }, [enriched]);

  // forecasts dans la fenêtre, triés
  const visible = useMemo(() => {
    return forecasts
      .filter((f) => f.date >= from && f.date <= to)
      .map((f) => ({ f, enriched: enrichedById.get(f.contributingEventIds[0]) }))
      .filter((x): x is { f: MarketImpactForecast; enriched: EnrichedMarketEvent } => !!x.enriched)
      .filter((x) => x.f.expectedAdrLift >= 5) // on filtre les forecasts négligeables
      .sort((a, b) => a.f.date.localeCompare(b.f.date))
      .slice(0, 12); // top 12 pour rester compact
  }, [forecasts, from, to, enrichedById]);

  const maxAdr = Math.max(10, ...visible.map((v) => v.f.expectedAdrLift));

  if (visible.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-6 text-center text-[12px] text-slate-400">
        Aucun forecast significatif dans la fenêtre.
      </div>
    );
  }

  return (
    <div className="bg-slate-50/40 rounded-xl ring-1 ring-slate-100 p-3">
      <div className="space-y-1.5">
        {visible.map(({ f, enriched: en }) => {
          const widthPct = (f.expectedAdrLift / maxAdr) * 100;
          const tone = toneForAdr(f.expectedAdrLift);
          return (
            <div key={en.event.id} className="flex items-center gap-2 group">
              {/* Date + label */}
              <div className="w-32 shrink-0 min-w-0">
                <div className="text-[11.5px] font-medium text-slate-900 truncate" title={en.event.name}>
                  {en.event.name}
                </div>
                <div className="text-[9.5px] text-slate-400 tabular-nums">
                  {formatDateRange(en.event.startDate, en.event.endDate)}
                </div>
              </div>

              {/* Bar */}
              <div className="flex-1 relative h-5 bg-white rounded ring-1 ring-slate-100 overflow-hidden">
                <div
                  className={cn('absolute inset-y-0 left-0 transition-all rounded-l', tone.bar)}
                  style={{ width: `${widthPct}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2 text-[10.5px] font-semibold tabular-nums">
                  <span className={cn('relative', widthPct > 35 ? 'text-white' : 'text-slate-700')}>
                    +{f.expectedAdrLift.toFixed(0)}% ADR
                  </span>
                  <span className="ml-auto text-slate-500 tabular-nums">
                    +{f.expectedOccupancyLift.toFixed(0)} pts TO
                  </span>
                </div>
              </div>

              {/* Confidence */}
              <div className="w-12 shrink-0 text-right">
                <span className={cn('text-[10px] font-semibold tabular-nums', toneForConfidence(f.confidence))}>
                  {f.confidence}%
                </span>
                <div className="text-[8.5px] text-slate-400 leading-none">conf.</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function toneForAdr(adr: number): { bar: string } {
  if (adr >= 25) return { bar: 'bg-gradient-to-r from-rose-500 to-rose-600' };
  if (adr >= 15) return { bar: 'bg-gradient-to-r from-amber-400 to-amber-500' };
  if (adr >= 8)  return { bar: 'bg-gradient-to-r from-violet-400 to-violet-500' };
  return { bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500' };
}

function toneForConfidence(c: number): string {
  if (c >= 75) return 'text-emerald-700';
  if (c >= 50) return 'text-amber-700';
  return 'text-rose-700';
}

function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const e = new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${s} → ${e}`;
}
