/**
 * FLOWTYM RMS — Velocity Radar
 *
 * Mini-radar SVG (5 axes) qui visualise la vélocité moyenne marché
 * sur la fenêtre :
 *   • Médiane Δ J-7
 *   • Disponibilité Δ J-7
 *   • Accélération compression
 *   • Accélération pickup
 *   • Velocity Index global
 *
 * Pas de lib chart — SVG natif, déterministe, sobre.
 */

import React, { useMemo } from 'react';
import type { MarketVelocity } from '@/src/types/marketIntelligence';

interface VelocityRadarProps {
  velocity: Map<string, MarketVelocity>;
  from: string;
  to: string;
}

interface RadarAxis {
  key: string;
  label: string;
  value: number;     // 0-100 normalisé
  rawLabel: string;  // affichage tooltip
}

export const VelocityRadar: React.FC<VelocityRadarProps> = ({ velocity, from, to }) => {
  const axes = useMemo<RadarAxis[]>(() => {
    const all: MarketVelocity[] = Array.from(velocity.values()) as MarketVelocity[];
    const vs: MarketVelocity[] = all.filter(
      (v: MarketVelocity) => v.date >= from && v.date <= to,
    );
    if (vs.length === 0) return [];
    const avg = (sel: (v: MarketVelocity) => number) =>
      vs.reduce((s, v) => s + sel(v), 0) / vs.length;

    const medianD7 = avg((v) => Math.abs(v.medianDelta.d7));   // %
    const availD7 = avg((v) => Math.abs(v.availabilityDelta.d7)); // points
    const compAcc = avg((v) => Math.abs(v.compressionAcceleration));
    const pickAcc = avg((v) => Math.abs(v.pickupAcceleration));
    const idx = avg((v) => v.velocityIndex);
    return [
      { key: 'median', label: 'Médiane Δ7j', value: Math.min(100, (medianD7 / 25) * 100), rawLabel: `${medianD7.toFixed(1)}%` },
      { key: 'avail',  label: 'Dispo Δ7j',   value: Math.min(100, (availD7 / 40) * 100), rawLabel: `${availD7.toFixed(0)} pts` },
      { key: 'comp',   label: 'Accél. comp.', value: Math.min(100, (compAcc / 5) * 100), rawLabel: `${compAcc.toFixed(1)} pts/j` },
      { key: 'pick',   label: 'Accél. pickup', value: Math.min(100, (pickAcc / 10) * 100), rawLabel: `${pickAcc.toFixed(1)} res/j` },
      { key: 'index',  label: 'Velocity Idx', value: idx, rawLabel: `${idx.toFixed(0)}/100` },
    ];
  }, [velocity, from, to]);

  if (axes.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 text-center text-[12px] text-slate-400">
        Pas de données vélocité dans la fenêtre.
      </div>
    );
  }

  // Layout SVG
  const size = 180;
  const center = size / 2;
  const maxRadius = 64;
  const angles = axes.map((_, i) => (i / axes.length) * Math.PI * 2 - Math.PI / 2);

  const points = axes.map((a, i) => {
    const r = (a.value / 100) * maxRadius;
    return [center + r * Math.cos(angles[i]), center + r * Math.sin(angles[i])];
  });

  const polygon = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Grilles concentriques (4 niveaux)
  const grids = [0.25, 0.5, 0.75, 1].map((scale) => {
    const pts = axes.map((_, i) => {
      const r = scale * maxRadius;
      return `${(center + r * Math.cos(angles[i])).toFixed(1)},${(center + r * Math.sin(angles[i])).toFixed(1)}`;
    }).join(' ');
    return { pts, scale };
  });

  return (
    <div className="bg-slate-50/40 rounded-xl ring-1 ring-slate-100 p-3">
      <div className="flex items-start gap-3">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          {/* Grilles */}
          {grids.map((g, i) => (
            <polygon
              key={i}
              points={g.pts}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray={i < grids.length - 1 ? '2 2' : undefined}
            />
          ))}
          {/* Axes */}
          {axes.map((_, i) => (
            <line
              key={i}
              x1={center} y1={center}
              x2={(center + maxRadius * Math.cos(angles[i])).toFixed(1)}
              y2={(center + maxRadius * Math.sin(angles[i])).toFixed(1)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          ))}
          {/* Polygone velocity */}
          <polygon
            points={polygon}
            fill="rgba(139, 92, 246, 0.25)"
            stroke="#7c3aed"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Points */}
          {points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.5} fill="#7c3aed" />
          ))}
        </svg>
        <div className="flex-1 grid grid-cols-1 gap-1.5 text-[11px] min-w-0">
          {axes.map((a) => (
            <div key={a.key} className="flex items-center justify-between gap-2 bg-white rounded px-2 py-1 ring-1 ring-slate-100">
              <span className="text-slate-600 truncate">{a.label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{a.rawLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
