/**
 * FLOWTYM RMS — Distribution des tarifs compset.
 *
 * Barre horizontale segmentée par palier de demande (6 segments unis)
 * + légende température.
 */

import React from 'react';
import { COMPSET_DISTRIBUTION } from '../../../data/rms/mockCompetitiveWatchData';
import { DEMAND_BANDS } from '../../../lib/rms/chartColors';

export interface CompsetDistributionBarProps {
  className?: string;
}

export const CompsetDistributionBar: React.FC<CompsetDistributionBarProps> = ({
  className,
}) => (
  <div className={className}>
    <h4 className="text-[13px] font-bold text-slate-900 dark:text-slate-50 mb-2.5">
      Distribution tarifs compset
    </h4>

    {/* Barre segmentée */}
    <div className="flex w-full h-7 rounded-lg overflow-hidden">
      {COMPSET_DISTRIBUTION.map((seg) => {
        const band = DEMAND_BANDS[seg.tierIndex];
        return (
          <div
            key={seg.tierIndex}
            className="flex items-center justify-center"
            style={{ width: `${seg.pct}%`, backgroundColor: band.color }}
            title={`${band.label} · ${seg.pct}%`}
          >
            <span className="text-[11px] font-bold text-white">{seg.pct}%</span>
          </div>
        );
      })}
    </div>

    {/* Légende */}
    <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2.5">
      {DEMAND_BANDS.map((band) => (
        <span key={band.tier} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: band.color }}
          />
          <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
            {band.label}
          </span>
        </span>
      ))}
    </div>
  </div>
);
