/**
 * FLOWTYM Revenue — Simulation Store (Mode Simulation RMS)
 *
 * Permet au Revenue Manager de mettre en pause la synchronisation auto
 * et de tester des scénarios "what-if" sans toucher au planning réel.
 *
 * Quand `active === true`, les overrides remplacent les données réelles
 * pour les dates ciblées (et seulement les champs explicitement surchargés).
 * Tous les overrides vivent en mémoire — pas de persistance localStorage
 * pour bien marquer le caractère éphémère et non destructif du mode.
 *
 * Vague B — Cockpit RMS Premium.
 */

import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Surcharges appliquées à UNE date donnée.
 * Tous les champs sont optionnels : seuls ceux explicitement définis
 * écrasent les données réelles. `null` = remettre à la valeur par défaut.
 */
export interface SimulationDateOverride {
  availability?: number | null;     // Chambres restantes
  occupancyRate?: number | null;    // TO%
  pickupRate?: number | null;       // Pickup %
  leadTimeMajority?: number | null; // Lead time médian (j)
  marketDemand?: number | null;     // Demande marché % (0-100)
  closedChannels?: string[];        // Canaux fermés ("booking", "expedia", ...)
  minStay?: number | null;          // Min Stay (nuits)
  cta?: boolean;                    // Closed To Arrival
  ctd?: boolean;                    // Closed To Departure
}

/**
 * Override appliqué à TOUTES les dates de la vue active (global).
 * Utile pour les scénarios "que se passe-t-il si la demande baisse de 20% partout".
 */
export interface SimulationGlobalOverride {
  demandShift?: number | null;      // Shift % appliqué à la demande (ex: -20 = -20pts)
  pickupShift?: number | null;      // Shift % pickup global
  closedChannels?: string[];        // Canaux fermés sur toute la période
}

/**
 * Préréglages prêts à l'emploi pour démos/pitch.
 */
export type SimulationPreset =
  | 'demand_crash'      // Crash demande -30% global
  | 'demand_surge'      // Pic demande +40% global
  | 'booking_closed'    // Fermeture Booking partout
  | 'inventory_low'     // 5 chambres restantes sur dates pression
  | 'restrictive'       // Min Stay 3 + CTA J-7 sur weekends
  | 'reset';            // Reset all

interface SimulationStore {
  /** Mode actif (true = utilise les overrides) */
  active: boolean;

  /** Overrides par date (key = date ISO yyyy-mm-dd) */
  dateOverrides: Record<string, SimulationDateOverride>;

  /** Override global (s'applique à toutes les dates) */
  globalOverride: SimulationGlobalOverride;

  /** Label du scénario actif (pour breadcrumb / banner) */
  scenarioLabel: string;

  // ─── Actions ─────────────────────────────────────────────────────
  toggleActive: () => void;
  setActive: (v: boolean) => void;
  setScenarioLabel: (label: string) => void;

  /** Surcharge UN champ pour UNE date. Passer `null` pour effacer. */
  setDateOverride: <K extends keyof SimulationDateOverride>(
    date: string,
    key: K,
    value: SimulationDateOverride[K],
  ) => void;

  /** Surcharge globale */
  setGlobalOverride: <K extends keyof SimulationGlobalOverride>(
    key: K,
    value: SimulationGlobalOverride[K],
  ) => void;

  /** Reset complet (overrides + label, ne désactive PAS le mode) */
  clearOverrides: () => void;

  /** Désactive le mode ET reset les overrides */
  exitSimulation: () => void;

  /** Applique un preset */
  applyPreset: (preset: SimulationPreset, dates: string[]) => void;

  /** Helpers de lecture */
  getDateOverride: (date: string) => SimulationDateOverride | null;
  hasAnyOverride: () => boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  active: false,
  dateOverrides: {},
  globalOverride: {},
  scenarioLabel: '',

  toggleActive: () => set(s => ({
    active: !s.active,
    scenarioLabel: s.active ? '' : (s.scenarioLabel || 'Scénario libre'),
  })),

  setActive: (v) => set(s => ({
    active: v,
    scenarioLabel: v ? (s.scenarioLabel || 'Scénario libre') : '',
  })),

  setScenarioLabel: (label) => set({ scenarioLabel: label }),

  setDateOverride: (date, key, value) => set(s => {
    const current = s.dateOverrides[date] ?? {};
    const next = { ...current, [key]: value };
    // Si toutes les clés sont null/undefined, on supprime l'entrée
    const allEmpty = Object.values(next).every(v => v === null || v === undefined);
    const nextOverrides = { ...s.dateOverrides };
    if (allEmpty) {
      delete nextOverrides[date];
    } else {
      nextOverrides[date] = next;
    }
    return { dateOverrides: nextOverrides };
  }),

  setGlobalOverride: (key, value) => set(s => ({
    globalOverride: { ...s.globalOverride, [key]: value },
  })),

  clearOverrides: () => set({
    dateOverrides: {},
    globalOverride: {},
    scenarioLabel: 'Scénario libre',
  }),

  exitSimulation: () => set({
    active: false,
    dateOverrides: {},
    globalOverride: {},
    scenarioLabel: '',
  }),

  applyPreset: (preset, dates) => {
    if (preset === 'reset') {
      set({ dateOverrides: {}, globalOverride: {}, scenarioLabel: 'Scénario libre' });
      return;
    }

    if (preset === 'demand_crash') {
      set({
        globalOverride: { demandShift: -30 },
        dateOverrides: {},
        scenarioLabel: 'Crash demande (-30 pts)',
      });
      return;
    }

    if (preset === 'demand_surge') {
      set({
        globalOverride: { demandShift: 40 },
        dateOverrides: {},
        scenarioLabel: 'Pic demande (+40 pts)',
      });
      return;
    }

    if (preset === 'booking_closed') {
      set({
        globalOverride: { closedChannels: ['booking'] },
        dateOverrides: {},
        scenarioLabel: 'Booking.com fermé',
      });
      return;
    }

    if (preset === 'inventory_low') {
      const overrides: Record<string, SimulationDateOverride> = {};
      for (const d of dates) {
        overrides[d] = { availability: 5 };
      }
      set({
        dateOverrides: overrides,
        globalOverride: {},
        scenarioLabel: 'Inventaire critique (5 chambres)',
      });
      return;
    }

    if (preset === 'restrictive') {
      const overrides: Record<string, SimulationDateOverride> = {};
      for (const d of dates) {
        const dt = new Date(d + 'T12:00:00');
        const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
        if (isWeekend) {
          overrides[d] = { minStay: 3, cta: true };
        }
      }
      set({
        dateOverrides: overrides,
        globalOverride: {},
        scenarioLabel: 'Restrictif weekends (Min Stay 3 + CTA)',
      });
      return;
    }
  },

  getDateOverride: (date) => get().dateOverrides[date] ?? null,

  hasAnyOverride: () => {
    const s = get();
    if (Object.keys(s.dateOverrides).length > 0) return true;
    const g = s.globalOverride;
    return Object.values(g).some(v => v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0));
  },
}));

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS PUBLIQUES (utilisés par EFFET 2 dans RMSTableauPro)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Applique les overrides simulation à une valeur réelle.
 * Renvoie la valeur originale si le mode est inactif ou si aucun override.
 */
export function applySimulationOverride<T>(
  active: boolean,
  realValue: T,
  overrideValue: T | null | undefined,
): T {
  if (!active) return realValue;
  if (overrideValue === null || overrideValue === undefined) return realValue;
  return overrideValue;
}

/**
 * Applique un shift global à une valeur numérique (% delta absolu).
 * Borne le résultat entre 0 et 100 pour les pourcentages.
 */
export function applySimulationShift(
  active: boolean,
  realValue: number,
  shiftPercent: number | null | undefined,
  clamp01_100 = true,
): number {
  if (!active) return realValue;
  if (shiftPercent === null || shiftPercent === undefined) return realValue;
  const next = realValue + shiftPercent;
  return clamp01_100 ? Math.max(0, Math.min(100, next)) : next;
}
