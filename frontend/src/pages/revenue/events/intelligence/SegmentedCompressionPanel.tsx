/**
 * FLOWTYM RMS — Segmented Compression Panel
 *
 * Affiche la compression marché segmentée par cluster compset
 * (luxury / upscale / midscale / budget / lifestyle / aparthotel…).
 *
 * C'est ce qui distingue Flowtym d'un calendrier événementiel classique :
 *
 *   "Compression LUXURY 82/100 — MIDSCALE 45/100 — BUDGET 18/100
 *    → Roland-Garros impacte massivement le luxe mais peu le budget."
 *
 * Composant compact, sobre, lisible. Barres horizontales avec score
 * et classification. Affiche aussi la distribution du compset (combien
 * d'hôtels dans chaque cluster).
 */

import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  CLUSTER_LABELS,
  COMPRESSION_CLASSIFICATION_LABELS,
  type HotelCluster,
  type MarketCompressionScore,
} from '@/src/types/marketIntelligence';

interface SegmentedCompressionPanelProps {
  segmentedCompression: Map<HotelCluster, Map<string, MarketCompressionScore>>;
  compsetDistribution: Array<{ cluster: HotelCluster; count: number; share: number }>;
  from: string;
  to: string;
}

const CLUSTER_ORDER: HotelCluster[] = [
  'luxury', 'upscale', 'lifestyle', 'midscale', 'business', 'leisure', 'aparthotel', 'budget',
];

const TONE_BY_CLASSIFICATION = {
  no_compression: { bar: 'bg-slate-300',  text: 'text-slate-600',  bg: 'bg-slate-50' },
  soft:           { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  building:       { bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  strong:         { bar: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50' },
  extreme:        { bar: 'bg-rose-700',    text: 'text-rose-900',    bg: 'bg-rose-100' },
} as const;

const CLUSTER_ICON_BG: Record<HotelCluster, string> = {
  luxury:     'bg-violet-100 text-violet-700',
  upscale:    'bg-indigo-100 text-indigo-700',
  lifestyle:  'bg-fuchsia-100 text-fuchsia-700',
  midscale:   'bg-sky-100 text-sky-700',
  business:   'bg-slate-100 text-slate-700',
  leisure:    'bg-emerald-100 text-emerald-700',
  aparthotel: 'bg-amber-100 text-amber-700',
  budget:     'bg-rose-100 text-rose-700',
};

export const SegmentedCompressionPanel: React.FC<SegmentedCompressionPanelProps> = ({
  segmentedCompression,
  compsetDistribution,
  from,
  to,
}) => {
  // Agrège la compression moyenne + pic par cluster sur la fenêtre
  const rows = useMemo(() => {
    const out: Array<{
      cluster: HotelCluster;
      avg: number;
      peak: number;
      peakDate: string | null;
      classification: MarketCompressionScore['classification'];
      compsetCount: number;
      compsetShare: number;
    }> = [];

    type DistRow = { cluster: HotelCluster; count: number; share: number };
    const distByCluster = new Map<HotelCluster, DistRow>(
      compsetDistribution.map((d): [HotelCluster, DistRow] => [d.cluster, d]),
    );

    for (const cluster of CLUSTER_ORDER) {
      const scores = segmentedCompression.get(cluster);
      if (!scores || scores.size === 0) continue;

      const allScores: MarketCompressionScore[] = Array.from(scores.values()) as MarketCompressionScore[];
      const inWindow: MarketCompressionScore[] = allScores.filter(
        (s: MarketCompressionScore) => s.date >= from && s.date <= to,
      );
      if (inWindow.length === 0) continue;

      const avg = Math.round(
        inWindow.reduce((acc: number, s: MarketCompressionScore) => acc + s.score, 0) / inWindow.length,
      );
      const peakRec: MarketCompressionScore = inWindow.reduce(
        (max: MarketCompressionScore, s: MarketCompressionScore) => (s.score > max.score ? s : max),
        inWindow[0],
      );
      const dist = distByCluster.get(cluster);

      out.push({
        cluster,
        avg,
        peak: peakRec.score,
        peakDate: peakRec.date,
        classification: peakRec.classification,
        compsetCount: dist?.count ?? 0,
        compsetShare: dist?.share ?? 0,
      });
    }
    // Tri : segments les plus tendus en haut
    return out.sort((a, b) => b.avg - a.avg);
  }, [segmentedCompression, compsetDistribution, from, to]);

  if (rows.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl px-3 py-4 text-center text-[12px] text-slate-400 ring-1 ring-slate-100">
        Compression segmentée disponible uniquement avec un import Lighthouse.
        <div className="mt-1 text-[10.5px]">Importer un fichier pour activer le clustering compset.</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/40 rounded-xl ring-1 ring-slate-100 p-3 space-y-2">
      {rows.map((row) => {
        const tone = TONE_BY_CLASSIFICATION[row.classification];
        return (
          <div key={row.cluster} className="bg-white rounded-lg ring-1 ring-slate-100 px-3 py-2">
            <div className="flex items-center gap-2">
              {/* Cluster icon */}
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', CLUSTER_ICON_BG[row.cluster])}>
                <Layers className="w-3.5 h-3.5" />
              </div>
              {/* Cluster label + compset count */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-semibold text-slate-900">
                    {CLUSTER_LABELS[row.cluster]}
                  </span>
                  {row.compsetCount > 0 && (
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {row.compsetCount} hôtel{row.compsetCount > 1 ? 's' : ''} · {Math.round(row.compsetShare * 100)}% du compset
                    </span>
                  )}
                </div>
                {/* Bar + score */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', tone.bar)}
                      style={{ width: `${Math.min(100, row.avg)}%` }}
                    />
                  </div>
                  <span className={cn('text-[11px] font-bold tabular-nums shrink-0', tone.text)}>
                    {row.avg}/100
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                  <span>
                    Pic {row.peak} le {row.peakDate ? formatShortDate(row.peakDate) : '—'}
                  </span>
                  <span className={cn('font-medium', tone.text)}>
                    {COMPRESSION_CLASSIFICATION_LABELS[row.classification]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short',
  });
}
