/**
 * FLOWTYM RMS — Compset (Competitive Set)
 * 
 * 10 concurrents directs de l'Hôtel Folkestone Opéra
 * Source : Booking.com data export (folkestoneopéra_bookingdotcom_lowest_los1_2guests_1.xlsx)
 * Quartier : Opéra/Madeleine, Paris 9ème
 */

export interface CompetitorHotel {
  id: string;
  name: string;
  stars: number;
  distance: number;      // Distance en km de Folkestone
  segment: 'budget' | 'midscale' | 'upscale';
  capacity: number;      // Nombre de chambres (estimé)
  basePrice: number;     // Prix moyen annuel
  qualityScore: number;  // Score Booking.com /10
  reviewCount: number;
}

/**
 * 10 CONCURRENTS RÉELS - Extraits Booking.com Primary Compset
 * Données officielles de l'export Booking.com du Folkestone Opéra
 */
export const FOLKESTONE_COMPSET: CompetitorHotel[] = [
  {
    id: 'madeleine-haussmann',
    name: 'Hôtel Madeleine Haussmann',
    stars: 3,
    distance: 0.4,
    segment: 'midscale',
    capacity: 48,
    basePrice: 350,  // Prix moyen observé
    qualityScore: 8.1,
    reviewCount: 1842,
  },
  {
    id: 'arcade',
    name: 'Hôtel De l\'Arcade',
    stars: 3,
    distance: 0.3,
    segment: 'midscale',
    capacity: 38,
    basePrice: 290,
    qualityScore: 8.3,
    reviewCount: 2134,
  },
  {
    id: 'cordelia-opera',
    name: 'Hôtel Cordelia Opéra-Madeleine',
    stars: 3,
    distance: 0.2,
    segment: 'midscale',
    capacity: 42,
    basePrice: 340,
    qualityScore: 8.0,
    reviewCount: 1567,
  },
  {
    id: 'queen-mary',
    name: 'Queen Mary Opera',
    stars: 3,
    distance: 0.5,
    segment: 'budget',
    capacity: 35,
    basePrice: 265,
    qualityScore: 7.8,
    reviewCount: 1245,
  },
  {
    id: 'triangle-or',
    name: 'Hôtel du Triangle d\'Or - Proche Madeleine',
    stars: 3,
    distance: 0.6,
    segment: 'midscale',
    capacity: 28,
    basePrice: 315,
    qualityScore: 8.4,
    reviewCount: 987,
  },
  {
    id: 'best-western-sydney',
    name: 'Best Western Plus Hotel Sydney Opera',
    stars: 3,
    distance: 0.5,
    segment: 'midscale',
    capacity: 38,
    basePrice: 270,
    qualityScore: 8.4,
    reviewCount: 2456,
  },
  {
    id: 'opera-opal',
    name: 'Hotel Opéra Opal',
    stars: 3,
    distance: 0.4,
    segment: 'midscale',
    capacity: 32,
    basePrice: 350,
    qualityScore: 7.9,
    reviewCount: 1678,
  },
  {
    id: 'royal-opera',
    name: 'Hôtel Royal Opéra',
    stars: 3,
    distance: 0.3,
    segment: 'budget',
    capacity: 26,
    basePrice: 240,
    qualityScore: 7.6,
    reviewCount: 1123,
  },
  {
    id: 'george-sand',
    name: 'Hotel George Sand Opéra Paris',
    stars: 3,
    distance: 0.4,
    segment: 'midscale',
    capacity: 30,
    basePrice: 310,
    qualityScore: 8.2,
    reviewCount: 1834,
  },
  {
    id: 'chavanel',
    name: 'Hotel Chavanel',
    stars: 4,
    distance: 0.7,
    segment: 'upscale',
    capacity: 27,
    basePrice: 450,
    qualityScore: 8.7,
    reviewCount: 2187,
  },
];

/**
 * Génère les prix dynamiques pour un concurrent sur une période
 * Basé sur : basePrice + variations événements + lead time + jour semaine
 */
export function generateCompetitorPricing(
  competitor: CompetitorHotel,
  date: string,
  eventImpact: number,      // 0-100
  leadTime: number,         // Jours avant arrivée
  isWeekend: boolean
): {
  price: number;
  availability: 'high' | 'medium' | 'low' | 'sold-out';
  variation: number;         // % vs veille
  vsOurPrice: number;        // Différentiel prix vs Folkestone
} {
  let price = competitor.basePrice;
  
  // 1. Impact événements (0-30% boost)
  const eventBoost = (eventImpact / 100) * 0.30;
  price *= (1 + eventBoost);
  
  // 2. Lead time (booking window pricing)
  if (leadTime <= 3) price *= 1.15;      // Last minute premium
  else if (leadTime <= 7) price *= 1.08;
  else if (leadTime >= 60) price *= 0.92; // Early bird discount
  
  // 3. Jour de semaine vs week-end
  if (isWeekend) price *= 1.18;
  else price *= 0.95;                      // Midweek discount
  
  // 4. Variation aléatoire compétitive (-5% à +5%)
  const randomVar = (Math.random() * 0.10) - 0.05;
  price *= (1 + randomVar);
  
  // 5. Arrondir
  price = Math.round(price);
  
  // Simuler disponibilité selon prix/demande
  let availability: 'high' | 'medium' | 'low' | 'sold-out';
  if (eventImpact > 80 && leadTime < 7) availability = 'sold-out';
  else if (eventImpact > 60 || leadTime < 3) availability = 'low';
  else if (eventImpact > 40) availability = 'medium';
  else availability = 'high';
  
  // Variation vs J-1 (simulée)
  const variation = Math.round((Math.random() * 10) - 5);
  
  // Différentiel vs notre prix (baseé sur prix moyen Folkestone = 280€ observé)
  const vsOurPrice = price - 280;
  
  return { price, availability, variation, vsOurPrice };
}

/**
 * Calcule les statistiques compset pour une date
 */
export function getCompsetStats(
  date: string,
  eventImpact: number,
  leadTime: number,
  isWeekend: boolean
) {
  const prices = FOLKESTONE_COMPSET.map(c => 
    generateCompetitorPricing(c, date, eventImpact, leadTime, isWeekend).price
  );
  
  prices.sort((a, b) => a - b);
  
  const min = prices[0];
  const max = prices[prices.length - 1];
  const median = prices[Math.floor(prices.length / 2)];
  const average = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
  
  return { min, max, median, average, prices };
}
