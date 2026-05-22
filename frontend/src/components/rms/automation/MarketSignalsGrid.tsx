/**
 * FLOWTYM RMS — Grille des signaux marché temps réel.
 *
 * Affiche les 12 signaux exploités par le moteur de sélection automatique
 * de stratégie, avec jauge normalisée et mise en avant des signaux décisifs.
 */

import React from 'react';
import {
  SIGNAL_META,
  signalLevel,
  type MarketSignals,
} from '@/src/lib/rms/autoStrategyEngine';
import type { SignalKey } from '@/src/lib/rms/strategies';

interface MarketSignalsGridProps {
  signals: MarketSignals;
  /** Signaux décisifs à mettre en avant. */
  highlightKeys?: SignalKey[];
  /** Nombre de colonnes (responsive max). */
  columns?: 3 | 4 | 6;
}

const COLS: Record<3 | 4 | 6, string> = {
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
};

export const MarketSignalsGrid: React.FC<MarketSignalsGridProps> = ({
  signals,
  highlightKeys = [],
  columns = 6,
}) => {
  return (
    <div className={`grid ${COLS[columns]} gap-2.5`}>
      {SIGNAL_META.map((meta) => {
        const raw = signals[meta.key];
        const level = signalLevel(meta, raw);
        const highlighted = highlightKeys.includes(meta.key);
        return (
          <div
            key={meta.key}
            className={`rounded-xl border p-2.5 transition-colors ${
              highlighted
                ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/[0.04]'
                : 'border-gray-200/80 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10.5px] font-medium text-gray-400 truncate">
                {meta.short}
              </span>
              {highlighted && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] shrink-0" />
              )}
            </div>
            <div className="text-[14px] font-bold text-gray-900 mt-0.5 leading-tight">
              {meta.format(raw)}
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  highlighted ? 'bg-[#8B5CF6]' : 'bg-gray-300'
                }`}
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
