/**
 * FLOWTYM RMS — Légende de graphique.
 *
 * Légende horizontale réutilisable : carrés, lignes pleines, lignes
 * pointillées, points et pastilles dégradées.
 */

import React from 'react';

export type LegendMarker = 'square' | 'line' | 'dashed' | 'dot' | 'gradient';

export interface LegendItem {
  label: string;
  color: string;
  /** Couleur de fin pour le marqueur dégradé. */
  colorTo?: string;
  marker: LegendMarker;
}

function Marker({ item }: { item: LegendItem }) {
  switch (item.marker) {
    case 'square':
      return (
        <span
          className="inline-block w-3 h-3 rounded-[3px] shrink-0"
          style={{ backgroundColor: item.color }}
        />
      );
    case 'dot':
      return (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
      );
    case 'line':
      return (
        <span
          className="inline-block w-5 h-[3px] rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
      );
    case 'dashed':
      return (
        <span
          className="inline-block w-5 h-0 shrink-0"
          style={{ borderTop: `2.5px dashed ${item.color}` }}
        />
      );
    case 'gradient':
      return (
        <span
          className="inline-block w-5 h-3 rounded-[3px] shrink-0"
          style={{
            background: `linear-gradient(90deg, ${item.color}, ${item.colorTo ?? item.color})`,
          }}
        />
      );
    default:
      return null;
  }
}

export interface ChartLegendProps {
  items: LegendItem[];
  className?: string;
}

export const ChartLegend: React.FC<ChartLegendProps> = ({ items, className }) => (
  <div className={`flex items-center gap-x-5 gap-y-2 flex-wrap ${className ?? ''}`}>
    {items.map((item) => (
      <span key={item.label} className="flex items-center gap-2 whitespace-nowrap">
        <Marker item={item} />
        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
          {item.label}
        </span>
      </span>
    ))}
  </div>
);
