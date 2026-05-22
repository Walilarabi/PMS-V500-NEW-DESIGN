/**
 * FLOWTYM RMS — Logique d'affichage des dates de la vue mensuelle.
 *
 * RÈGLE MÉTIER (source de vérité unique) :
 *   1. Mois en cours → de aujourd'hui jusqu'au dernier jour du mois inclus
 *   2. Mois futur    → mois civil complet (1 → 28 / 29 / 30 / 31)
 *   3. Jamais de dates passées dans le mois en cours
 *   4. Jamais de troncature : on respecte le nombre réel de jours du mois
 *   5. Mois passé    → aucune date
 *
 * Tous les modules (graphique marché, comparaison dynamique, tableau RMS,
 * détail jour, recommandations, exports, filtres, pagination) doivent
 * dériver leurs dates de ces fonctions — aucune date codée en dur ailleurs.
 */

export type MonthStatus = 'past' | 'current' | 'future';

export interface VisibleMonthRange {
  year: number;
  /** 0 = janvier … 11 = décembre */
  monthIndex: number;
  /** Premier jour visible (1-31). > totalDays si la plage est vide. */
  startDay: number;
  /** Dernier jour réel du mois (28 | 29 | 30 | 31). */
  endDay: number;
  /** Nombre réel de jours du mois. */
  totalDays: number;
  status: MonthStatus;
  isEmpty: boolean;
}

/** Nombre réel de jours d'un mois — gère les années bissextiles. */
export function daysInMonth(year: number, monthIndex: number): number {
  // Le jour 0 du mois suivant = dernier jour du mois courant.
  return new Date(year, monthIndex + 1, 0).getDate();
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Calcule la plage de jours visibles pour un mois donné selon la règle.
 *
 * @param year       année civile
 * @param monthIndex 0-11
 * @param today      date de référence (par défaut : maintenant)
 */
export function getVisibleMonthRange(
  year: number,
  monthIndex: number,
  today: Date = new Date(),
): VisibleMonthRange {
  const totalDays = daysInMonth(year, monthIndex);
  const ref = atMidnight(today);
  const firstOfMonth = new Date(year, monthIndex, 1);

  let status: MonthStatus;
  let startDay: number;

  if (year === ref.getFullYear() && monthIndex === ref.getMonth()) {
    // Mois en cours → de aujourd'hui à la fin du mois.
    status = 'current';
    startDay = ref.getDate();
  } else if (firstOfMonth.getTime() > ref.getTime()) {
    // Mois futur → mois civil complet.
    status = 'future';
    startDay = 1;
  } else {
    // Mois passé → aucune date.
    status = 'past';
    startDay = totalDays + 1;
  }

  return {
    year,
    monthIndex,
    startDay,
    endDay: totalDays,
    totalDays,
    status,
    isEmpty: startDay > totalDays,
  };
}

/** Vrai si une date ISO (YYYY-MM-DD) appartient à la plage visible de son mois. */
export function isDateVisible(isoDate: string, today: Date = new Date()): boolean {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const range = getVisibleMonthRange(d.getFullYear(), d.getMonth(), today);
  const day = d.getDate();
  return day >= range.startDay && day <= range.endDay;
}

/**
 * Liste ordonnée des dates ISO visibles d'un mois.
 * Réutilisable pour les exports PDF/Excel, la pagination et les filtres.
 */
export function getVisibleDates(
  year: number,
  monthIndex: number,
  today: Date = new Date(),
): string[] {
  const range = getVisibleMonthRange(year, monthIndex, today);
  const dates: string[] = [];
  const mm = String(monthIndex + 1).padStart(2, '0');
  for (let day = range.startDay; day <= range.endDay; day++) {
    dates.push(`${year}-${mm}-${String(day).padStart(2, '0')}`);
  }
  return dates;
}
