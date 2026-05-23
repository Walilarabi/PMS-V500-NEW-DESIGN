/**
 * FLOWTYM — Bandeau « Simulation manuelle active »
 *
 * Affiché en haut de Pricing & Recommandations quand au moins une date a une
 * disponibilité override manuelle. Indique le délai restant, donne accès à
 * une réactivation immédiate et liste les dates concernées.
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { pricingPlanningSync, SUSPEND_DURATION_MS } from '@/src/services/revenue/pricingPlanningSync.service';
import { cn } from '@/src/lib/utils';

function formatTimeLeft(expiresAt: number): string {
  const remaining = Math.max(0, expiresAt - Date.now());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}min ${String(seconds).padStart(2, '0')}s`;
}

export const OverrideStatusBanner: React.FC<{ className?: string }> = ({ className }) => {
  // Snapshot stable via version()
  useSyncExternalStore(
    (cb) => pricingPlanningSync.subscribe(cb),
    () => pricingPlanningSync.version(),
    () => pricingPlanningSync.version(),
  );

  // Re-render chaque seconde pour le compte à rebours
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1);
      pricingPlanningSync.cleanupExpired();
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const overrides = pricingPlanningSync.all();
  if (overrides.length === 0) return null;

  // Date d'expiration la plus proche → affichée principalement
  const nearestExpiry = Math.min(...overrides.map((o) => o.expiresAt));

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-900/20 dark:border-amber-700/40',
        className,
      )}
    >
      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
        <AlertTriangle size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-bold text-amber-900 dark:text-amber-100">
          Simulation manuelle active — sync planning suspendue {Math.round(SUSPEND_DURATION_MS / 60_000)} min
        </div>
        <div className="text-[11.5px] text-amber-700 dark:text-amber-200 flex items-center gap-2 mt-0.5">
          <Clock size={11} />
          <span>
            <b>{overrides.length}</b> date{overrides.length > 1 ? 's' : ''} concernée{overrides.length > 1 ? 's' : ''}
            {' · '}
            Sync auto dans <b className="tabular-nums">{formatTimeLeft(nearestExpiry)}</b>
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => pricingPlanningSync.resumeAll()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-amber-900 bg-white border border-amber-200 rounded-lg hover:bg-amber-100 shadow-sm shrink-0"
      >
        <RotateCcw size={11} />
        Réactiver la sync
      </button>
    </div>
  );
};
