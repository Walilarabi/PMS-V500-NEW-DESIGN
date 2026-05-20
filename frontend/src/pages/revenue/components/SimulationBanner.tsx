/**
 * FLOWTYM Revenue — SimulationBanner
 *
 * Bandeau orange persistant affiché en tête du tableau RMS quand le
 * Mode Simulation est actif. Marque visuellement que les données affichées
 * ne reflètent pas le planning réel.
 *
 * Vague B — Cockpit RMS Premium.
 */

import { FlaskConical, X, ChevronRight } from 'lucide-react';
import { useSimulationStore } from '../../../store/simulationStore';
import { cn } from '../lib/rms-theme';

interface Props {
  onOpenPanel: () => void;
}

export function SimulationBanner({ onOpenPanel }: Props) {
  const { active, scenarioLabel, hasAnyOverride, exitSimulation, dateOverrides, globalOverride } = useSimulationStore();

  if (!active) return null;

  const nbDateOverrides = Object.keys(dateOverrides).length;
  const nbGlobalKeys = Object.values(globalOverride).filter(v =>
    v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0),
  ).length;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2 border-b-2',
      'bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50',
      'border-orange-300',
    )}>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md bg-orange-200 flex items-center justify-center">
          <FlaskConical className="w-4 h-4 text-orange-700" />
        </div>
        <div className="leading-tight">
          <div className="text-xs font-bold text-orange-900 uppercase tracking-wide">
            Mode Simulation
          </div>
          <div className="text-[11px] text-orange-700">
            {scenarioLabel || 'Scénario libre'}
            {hasAnyOverride() && (
              <span className="text-orange-600 ml-1">
                · {nbDateOverrides > 0 && `${nbDateOverrides} date${nbDateOverrides > 1 ? 's' : ''} surchargée${nbDateOverrides > 1 ? 's' : ''}`}
                {nbDateOverrides > 0 && nbGlobalKeys > 0 && ' · '}
                {nbGlobalKeys > 0 && `${nbGlobalKeys} surcharge${nbGlobalKeys > 1 ? 's' : ''} globale${nbGlobalKeys > 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={onOpenPanel}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-800 bg-white border border-orange-300 rounded-md hover:bg-orange-50 transition-colors"
        >
          Paramètres
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={exitSimulation}
          title="Quitter le mode Simulation et revenir aux données réelles"
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-900 hover:bg-orange-100 rounded-md transition-colors"
        >
          <X className="w-3 h-3" />
          Quitter
        </button>
      </div>
    </div>
  );
}
