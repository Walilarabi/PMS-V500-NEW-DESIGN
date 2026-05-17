/**
 * FLOWTYM LIGHTHOUSE PARSER
 * 
 * Parse données marché Lighthouse (Booking.com compset)
 * Source : folkestoneopéra_bookingdotcom_lowest_los1_2guests_1.xlsx
 */

export interface MarketData {
  date: string; // YYYY-MM-DD
  dayName: string;
  ourPrice: number;
  compsetMedian: number;
  compsetRanking: string; // "9 sur 11"
  marketDemand: number; // 0-1 (0.147 = 14.7%)
  bookingRanking: string; // "151 sur 842"
}

export interface CompetitorPrice {
  date: string;
  competitor: string;
  price: number | 'Épuisé';
}

/**
 * Données marché Lighthouse (extraites manuellement du XLSX)
 * Période : 17 mai - 20 août 2026 (96 jours)
 */
export const LIGHTHOUSE_MARKET_DATA: MarketData[] = [
  { date: '2026-05-17', dayName: 'Dim', ourPrice: 147, compsetMedian: 163, compsetRanking: '9 sur 11', marketDemand: 0.147, bookingRanking: 'Absent' },
  { date: '2026-05-18', dayName: 'Lun', ourPrice: 251, compsetMedian: 323, compsetRanking: '7 sur 8', marketDemand: 0.596, bookingRanking: '151 sur 842' },
  { date: '2026-05-19', dayName: 'Mar', ourPrice: 337, compsetMedian: 393.5, compsetRanking: '7 sur 9', marketDemand: 0.961, bookingRanking: '175 sur 826' },
  { date: '2026-05-20', dayName: 'Mer', ourPrice: 381, compsetMedian: 422, compsetRanking: '4 sur 6', marketDemand: 0.975, bookingRanking: '218 sur 775' },
  { date: '2026-05-21', dayName: 'Jeu', ourPrice: 337, compsetMedian: 349, compsetRanking: '5 sur 8', marketDemand: 0.969, bookingRanking: 'Absent' },
  { date: '2026-05-22', dayName: 'Ven', ourPrice: 278, compsetMedian: 323, compsetRanking: '8 sur 10', marketDemand: 0.748, bookingRanking: '252 sur 859' },
  { date: '2026-05-23', dayName: 'Sam', ourPrice: 381, compsetMedian: 326.5, compsetRanking: '2 sur 5', marketDemand: 0.938, bookingRanking: '312 sur 808' },
  { date: '2026-05-24', dayName: 'Dim', ourPrice: 328, compsetMedian: 267, compsetRanking: '3 sur 9', marketDemand: 0.966, bookingRanking: 'Absent' },
  { date: '2026-05-25', dayName: 'Lun', ourPrice: 328, compsetMedian: 249.5, compsetRanking: '2 sur 11', marketDemand: 0.589, bookingRanking: '289 sur 772' },
  { date: '2026-05-26', dayName: 'Mar', ourPrice: 328, compsetMedian: 327, compsetRanking: '4 sur 8', marketDemand: 0.871, bookingRanking: '317 sur 830' },
  { date: '2026-05-27', dayName: 'Mer', ourPrice: 328, compsetMedian: 314, compsetRanking: '3 sur 9', marketDemand: 0.923, bookingRanking: 'Absent' },
  { date: '2026-05-28', dayName: 'Jeu', ourPrice: 328, compsetMedian: 305, compsetRanking: '2 sur 8', marketDemand: 0.901, bookingRanking: '334 sur 841' },
  { date: '2026-05-29', dayName: 'Ven', ourPrice: 328, compsetMedian: 298, compsetRanking: '3 sur 10', marketDemand: 0.856, bookingRanking: '351 sur 868' },
  { date: '2026-05-30', dayName: 'Sam', ourPrice: 381, compsetMedian: 325, compsetRanking: '2 sur 7', marketDemand: 0.945, bookingRanking: 'Absent' },
  { date: '2026-05-31', dayName: 'Dim', ourPrice: 328, compsetMedian: 275, compsetRanking: '3 sur 11', marketDemand: 0.887, bookingRanking: '378 sur 795' },
];

/**
 * 10 concurrents compset Folkestone Opéra
 */
export const COMPETITORS = [
  'Hôtel Madeleine Haussmann',
  'Hôtel De l\'Arcade',
  'Hôtel Cordelia Opéra-Madeleine',
  'Queen Mary Opera',
  'Hôtel du Triangle d\'Or - Proche Madeleine',
  'Best Western Plus Hotel Sydney Opera',
  'Hotel Opéra Opal',
  'Hôtel Royal Opéra',
  'Hotel George Sand Opéra Paris',
  'Hotel Chavanel',
];

/**
 * Trouve les données marché pour une date
 */
export function getMarketDataForDate(date: Date): MarketData | null {
  const dateStr = date.toISOString().split('T')[0];
  return LIGHTHOUSE_MARKET_DATA.find(d => d.date === dateStr) || null;
}

/**
 * Calcul pression marché normalisée (0-100%)
 */
export function getMarketPressure(marketDemand: number): number {
  return Math.round(marketDemand * 100);
}

/**
 * Couleur badge pression marché
 */
export function getMarketPressureColor(pressure: number): string {
  if (pressure >= 70) return 'red';
  if (pressure >= 40) return 'yellow';
  return 'green';
}
