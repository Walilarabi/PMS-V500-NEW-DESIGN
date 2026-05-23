/**
 * FLOWTYM RMS — Barre de contrôles Veille Concurrentielle
 *
 * Contrôles fonctionnels (chaque bouton mute le store de préférences) :
 *   - Sélecteur de période (7j / 15j / 30j / 60j / 90j / Mois)
 *   - Navigation mois précédent / mois suivant (active uniquement en mode Mois)
 *   - Sélecteur de source (Lighthouse / Expedia / Mix intelligent)
 *   - Reset
 *
 * Aucun bouton décoratif. Chaque interaction provoque un recalcul des données
 * via `useCompetitiveWatchData()`.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Layers,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  RANGE_KIND_LABEL,
  SOURCE_LABEL,
  useCompetitiveWatchPrefs,
  type CompetitiveSource,
  type RangeKind,
} from '../../../store/competitiveWatchPrefsStore';
import { useLighthouseStore } from '../../../store/lighthouseStore';
import { useExpediaStore } from '../../../store/expediaStore';

const RANGE_OPTIONS: RangeKind[] = ['days7', 'days15', 'days30', 'days60', 'days90', 'month'];

const SOURCE_OPTIONS: Array<{
  id: CompetitiveSource;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'lighthouse', icon: Database },
  { id: 'expedia', icon: FileSpreadsheet },
  { id: 'mix', icon: Sparkles },
];

export const LighthouseFiltersBar: React.FC = () => {
  const range = useCompetitiveWatchPrefs((s) => s.range);
  const source = useCompetitiveWatchPrefs((s) => s.source);
  const setRangeKind = useCompetitiveWatchPrefs((s) => s.setRangeKind);
  const shiftMonth = useCompetitiveWatchPrefs((s) => s.shiftMonth);
  const setSource = useCompetitiveWatchPrefs((s) => s.setSource);
  const reset = useCompetitiveWatchPrefs((s) => s.reset);

  const hasLighthouse = useLighthouseStore((s) => !!s.importData);
  const hasExpedia = useExpediaStore((s) => !!s.importData);

  const [rangeOpen, setRangeOpen] = React.useState(false);
  const rangeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!rangeOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!rangeRef.current?.contains(e.target as Node)) setRangeOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [rangeOpen]);

  const monthLabel = React.useMemo(() => {
    if (range.kind !== 'month') return RANGE_KIND_LABEL[range.kind];
    if (!range.monthKey) return 'Mois';
    const [y, m] = range.monthKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [range]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
      className="flex items-center justify-between gap-3 flex-wrap"
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Sélecteur de période */}
        <div ref={rangeRef} className="relative">
          <button
            type="button"
            onClick={() => setRangeOpen((o) => !o)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
          >
            <CalendarDays className="w-4 h-4 text-violet-500" />
            <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              {range.kind === 'month' ? monthLabel : RANGE_KIND_LABEL[range.kind]}
            </span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform',
                rangeOpen && 'rotate-180'
              )}
            />
          </button>
          <AnimatePresence>
            {rangeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              >
                {RANGE_OPTIONS.map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setRangeKind(k);
                      setRangeOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-700',
                      range.kind === k
                        ? 'font-semibold text-violet-600 dark:text-violet-300'
                        : 'text-slate-700 dark:text-slate-200'
                    )}
                  >
                    {RANGE_KIND_LABEL[k]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation prev / next (active uniquement en mode Mois) */}
        <div className="inline-flex h-10 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <button
            type="button"
            aria-label="Période précédente"
            disabled={range.kind !== 'month'}
            onClick={() => shiftMonth(-1)}
            className={cn(
              'h-full px-3 flex items-center justify-center transition-colors',
              range.kind === 'month'
                ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 select-none">
            Nav
          </span>
          <button
            type="button"
            aria-label="Période suivante"
            disabled={range.kind !== 'month'}
            onClick={() => shiftMonth(1)}
            className={cn(
              'h-full px-3 flex items-center justify-center transition-colors',
              range.kind === 'month'
                ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Sélecteur de source */}
        <div
          role="radiogroup"
          aria-label="Source de données"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5"
        >
          {SOURCE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = source === opt.id;
            const isAvailable =
              opt.id === 'mix' ? hasLighthouse || hasExpedia
                : opt.id === 'lighthouse' ? hasLighthouse
                : hasExpedia;
            return (
              <button
                key={opt.id}
                role="radio"
                aria-checked={isActive}
                onClick={() => setSource(opt.id)}
                disabled={!isAvailable}
                title={
                  isAvailable
                    ? `Source : ${SOURCE_LABEL[opt.id]}`
                    : `${SOURCE_LABEL[opt.id]} — aucun import disponible`
                }
                className={cn(
                  'h-9 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors',
                  !isAvailable && 'opacity-40 cursor-not-allowed',
                  isActive && isAvailable
                    ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {SOURCE_LABEL[opt.id]}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={reset}
        className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Réinitialiser
      </button>
    </motion.div>
  );
};
