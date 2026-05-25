/**
 * FLOWTYM RMS — Market Alerts Panel
 *
 * Liste prioritaire des alertes intelligence marché. Tri :
 *   critical → warning → info, puis date décroissante.
 *
 * Affiche au max 6 alertes — voir tout via un bouton "Voir tout".
 */

import React, { useState } from 'react';
import {
  AlertOctagon, AlertTriangle, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { MarketIntelligenceAlert } from '@/src/types/marketIntelligence';

interface MarketAlertsPanelProps {
  alerts: MarketIntelligenceAlert[];
}

const ICON_BY_LEVEL = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
} as const;

const TONE_BY_LEVEL = {
  critical: { bg: 'bg-rose-50',    ring: 'ring-rose-100',    icon: 'text-rose-600',   border: 'border-l-rose-500' },
  warning:  { bg: 'bg-amber-50',   ring: 'ring-amber-100',   icon: 'text-amber-600',  border: 'border-l-amber-500' },
  info:     { bg: 'bg-slate-50',   ring: 'ring-slate-100',   icon: 'text-slate-500',  border: 'border-l-slate-300' },
} as const;

const RANK = { critical: 3, warning: 2, info: 1 } as const;

export const MarketAlertsPanel: React.FC<MarketAlertsPanelProps> = ({ alerts }) => {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...alerts].sort(
    (a, b) =>
      RANK[b.level] - RANK[a.level] ||
      b.emittedAt.localeCompare(a.emittedAt),
  );
  const visible = showAll ? sorted : sorted.slice(0, 6);

  if (sorted.length === 0) {
    return (
      <div className="bg-emerald-50/60 rounded-xl ring-1 ring-emerald-100 px-3 py-4 text-center">
        <div className="text-[12.5px] font-medium text-emerald-700">Aucune alerte marché</div>
        <div className="text-[11px] text-emerald-600/80 mt-0.5">Le marché est calme — surveillance active.</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {visible.map((a) => (
        <AlertRow key={a.id} alert={a} />
      ))}
      {sorted.length > 6 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full mt-1 px-3 py-1.5 rounded-lg text-[11.5px] text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1"
        >
          {showAll ? (<><ChevronUp className="w-3 h-3" /> Voir moins</>)
            : (<><ChevronDown className="w-3 h-3" /> Voir les {sorted.length - 6} autres</>)}
        </button>
      )}
    </div>
  );
};

const AlertRow: React.FC<{ alert: MarketIntelligenceAlert }> = ({ alert }) => {
  const Icon = ICON_BY_LEVEL[alert.level];
  const tone = TONE_BY_LEVEL[alert.level];
  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded-lg ring-1 border-l-2',
        tone.bg, tone.ring, tone.border,
      )}
    >
      <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', tone.icon)} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-slate-900 leading-tight truncate">
          {alert.title}
        </div>
        <div className="text-[11px] text-slate-600 leading-tight mt-0.5">{alert.detail}</div>
        {alert.refs.dates && alert.refs.dates.length > 0 && (
          <div className="mt-1 text-[10.5px] text-slate-400 tabular-nums">
            {alert.refs.dates.slice(0, 3).map((d) => formatDate(d)).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
