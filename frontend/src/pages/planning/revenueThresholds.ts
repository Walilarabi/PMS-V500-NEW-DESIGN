/**
 * FLOWTYM — Revenue Calendar Thresholds
 *
 * Single source of truth for occupancy thresholds and color coding.
 * Used by RevenueCalendar, DayDetailModal, and any other component
 * that needs to color-code occupancy data.
 *
 * To change business thresholds, edit ONLY this file.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Occupancy thresholds (ordered from highest to lowest)
// ─────────────────────────────────────────────────────────────────────────────

export interface OccThreshold {
  min: number;
  bg: string;
  ring: string;
  label: string;
  labelColor: string;
  description: string;
}

export const OCC_THRESHOLDS: readonly OccThreshold[] = [
  {
    min: 90,
    bg: 'bg-rose-100',
    ring: 'ring-rose-200',
    label: 'Compression',
    labelColor: 'text-rose-600',
    description: 'Occupation ≥ 90% — risque de refus, opportunité de surclassement tarifaire',
  },
  {
    min: 75,
    bg: 'bg-orange-100',
    ring: 'ring-orange-200',
    label: 'Forte demande',
    labelColor: 'text-orange-600',
    description: 'Occupation ≥ 75% — forte demande, opportunity tarif premium',
  },
  {
    min: 50,
    bg: 'bg-emerald-100',
    ring: 'ring-emerald-200',
    label: 'Normal',
    labelColor: 'text-emerald-700',
    description: 'Occupation ≥ 50% — situation normale',
  },
  {
    min: 25,
    bg: 'bg-sky-50',
    ring: 'ring-sky-100',
    label: 'Faible',
    labelColor: 'text-sky-600',
    description: 'Occupation ≥ 25% — attention, actions commerciales recommandées',
  },
  {
    min: 0,
    bg: 'bg-gray-50',
    ring: 'ring-gray-100',
    label: 'Vide',
    labelColor: 'text-gray-400',
    description: 'Occupation < 25% — alerte, promotions / restrictions à lever',
  },
] as const;

/**
 * Returns the threshold object matching the given occupancy percentage.
 * Always returns a value (falls back to the last threshold if none matches).
 */
export function getOccThreshold(occ: number): OccThreshold {
  return (
    OCC_THRESHOLDS.find(t => occ >= t.min)
    ?? OCC_THRESHOLDS[OCC_THRESHOLDS.length - 1]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADR thresholds (for future use in rate recommendations)
// ─────────────────────────────────────────────────────────────────────────────

export interface AdrThreshold {
  min: number;
  label: string;
  bg: string;
  textColor: string;
}

/**
 * ADR thresholds relative to a hotel's base rate.
 * Multiply your base rate by the `mult` factor to get the threshold value.
 * Example: base = 100€, HIGH starts at 130€ (mult 1.3).
 */
export const ADR_THRESHOLDS_MULT = {
  PREMIUM: 1.5,  // ADR > 150% of base rate
  HIGH:    1.3,  // ADR > 130% of base rate
  NORMAL:  1.0,  // ADR ≥ base rate
  LOW:     0.8,  // ADR ≥ 80% of base rate
  VERY_LOW: 0,   // ADR < 80% of base rate
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pickup thresholds
// ─────────────────────────────────────────────────────────────────────────────

/** Number of new reservations in PICKUP_WINDOW_DAYS to be considered "high pickup" */
export const PICKUP_HIGH_THRESHOLD = 3;

/** Number of days to look back for pickup calculation */
export const PICKUP_WINDOW_DAYS = 7;
