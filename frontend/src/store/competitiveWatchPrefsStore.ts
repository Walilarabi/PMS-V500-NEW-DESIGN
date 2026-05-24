/**
 * FLOWTYM RMS — Préférences Veille Concurrentielle
 *
 * Partagé entre les widgets de la Veille (barre de filtres, hook de données,
 * en-tête, bandeau de traçabilité). Évite le prop drilling à 9 niveaux.
 *
 * Persisté en localStorage : l'utilisateur retrouve sa période / source au
 * prochain chargement de la page.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CompetitiveSource = 'lighthouse' | 'expedia' | 'mix';

export type RangeKind =
  | 'days7'
  | 'days15'
  | 'days30'
  | 'days60'
  | 'days90'
  | 'month';

export interface CompetitiveRange {
  kind: RangeKind;
  /** Pour `month` uniquement : 'YYYY-MM'. */
  monthKey?: string;
  /** Pour `daysN` : ancre = aujourd'hui par défaut, ou ISO date. */
  anchor?: string;
}

interface CompetitiveWatchPrefs {
  range: CompetitiveRange;
  source: CompetitiveSource;

  setRange: (range: CompetitiveRange) => void;
  setRangeKind: (kind: RangeKind) => void;
  shiftMonth: (delta: number) => void;
  setSource: (source: CompetitiveSource) => void;
  reset: () => void;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return currentMonthKey();
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DEFAULT_RANGE: CompetitiveRange = {
  kind: 'month',
  monthKey: currentMonthKey(),
};

export const useCompetitiveWatchPrefs = create<CompetitiveWatchPrefs>()(
  persist(
    (set, get) => ({
      range: DEFAULT_RANGE,
      source: 'lighthouse',

      setRange: (range) => set({ range }),
      setRangeKind: (kind) => {
        const current = get().range;
        if (kind === 'month') {
          set({ range: { kind, monthKey: current.monthKey ?? currentMonthKey() } });
        } else {
          set({ range: { kind, anchor: current.anchor ?? new Date().toISOString().slice(0, 10) } });
        }
      },
      shiftMonth: (delta) => {
        const current = get().range;
        if (current.kind === 'month') {
          set({
            range: {
              kind: 'month',
              monthKey: shiftMonthKey(current.monthKey ?? currentMonthKey(), delta),
            },
          });
        } else {
          // Pour daysN, on décale l'ancre de N jours
          const days = parseInt(current.kind.replace('days', ''), 10) || 30;
          const anchorDate = new Date(current.anchor ?? new Date().toISOString().slice(0, 10));
          anchorDate.setDate(anchorDate.getDate() + delta * days);
          set({
            range: {
              kind: current.kind,
              anchor: anchorDate.toISOString().slice(0, 10),
            },
          });
        }
      },
      setSource: (source) => set({ source }),
      reset: () => set({ range: DEFAULT_RANGE, source: 'lighthouse' }),
    }),
    {
      name: 'flowtym_competitive_watch_prefs',
      partialize: (s) => ({ range: s.range, source: s.source }),
    }
  )
);

/**
 * Résout la fenêtre temporelle [start, end] (ISO) à partir d'un range.
 * Pure function — utile pour les tests et l'adaptateur.
 */
export function resolveRangeWindow(
  range: CompetitiveRange,
  today: Date = new Date()
): { start: string; end: string; label: string } {
  if (range.kind === 'month') {
    const monthKey = range.monthKey ?? currentMonthKey();
    const [y, m] = monthKey.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0); // dernier jour du mois
    const monthLabel = start.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      label: monthLabel,
    };
  }

  // Fenêtre forward : "7 jours" = aujourd'hui → aujourd'hui + 6 jours.
  // (Bug fix Phase 4 — auparavant la fenêtre était en lookback, ce qui
  // donnait des dates passées et le sélecteur semblait "ne pas marcher".)
  const days = parseInt(range.kind.replace('days', ''), 10) || 30;
  const anchor = range.anchor ? new Date(range.anchor) : new Date(today);
  const start = new Date(anchor);
  const end = new Date(anchor);
  end.setDate(end.getDate() + (days - 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `${days} prochains jours`,
  };
}

export const RANGE_KIND_LABEL: Record<RangeKind, string> = {
  days7: '7 jours',
  days15: '15 jours',
  days30: '30 jours',
  days60: '60 jours',
  days90: '90 jours',
  month: 'Mois',
};

export const SOURCE_LABEL: Record<CompetitiveSource, string> = {
  lighthouse: 'Lighthouse',
  expedia: 'Expedia',
  mix: 'Mix intelligent',
};
