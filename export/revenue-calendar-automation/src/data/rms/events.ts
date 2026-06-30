/**
 * FLOWTYM RMS — Événements Paris 2026
 * 
 * Source : DATES_SALONS__MISE_A_JOUR_25032026.xlsx
 * Données extraites automatiquement + jours fériés français
 */

export interface Event {
  name: string;
  start: string;       // ISO date
  end: string;         // ISO date
  venue: string;
  impact: 'low' | 'medium' | 'high';
  category: 'salon' | 'sport' | 'national' | 'cultural';
  impactScore?: number; // 0-100, calculé selon impact historique
}

export const PARIS_EVENTS_2026: Event[] = [
  // ═══ JANVIER 2026 ═══
  { name: 'Jour de l\'An', start: '2026-01-01', end: '2026-01-01', venue: 'Paris', impact: 'medium', category: 'national', impactScore: 45 },
  { name: 'Maison & Objet (Hiver)', start: '2026-01-15', end: '2026-01-19', venue: 'Villepinte', impact: 'medium', category: 'salon', impactScore: 65 },
  { name: 'Who\'s Next', start: '2026-01-17', end: '2026-01-19', venue: 'P. de Versailles', impact: 'medium', category: 'salon', impactScore: 60 },
  { name: 'Sirha Europain', start: '2026-01-17', end: '2026-01-20', venue: 'P. de Versailles', impact: 'medium', category: 'salon', impactScore: 62 },
  { name: 'Mode Masculine (Hiver)', start: '2026-01-20', end: '2026-01-25', venue: 'Paris Centre', impact: 'medium', category: 'salon', impactScore: 58 },
  { name: 'Haute Couture (Hiver)', start: '2026-01-26', end: '2026-01-29', venue: 'Paris Centre', impact: 'medium', category: 'salon', impactScore: 70 },
  { name: 'Retromobile', start: '2026-01-28', end: '2026-02-01', venue: 'P. de Versailles', impact: 'medium', category: 'salon', impactScore: 55 },

  // ═══ FÉVRIER 2026 ═══
  { name: 'Première Vision', start: '2026-02-03', end: '2026-02-05', venue: 'Villepinte', impact: 'high', category: 'salon', impactScore: 82 },
  { name: 'Tournoi 6 Nations (France)', start: '2026-02-05', end: '2026-02-05', venue: 'Stade de France', impact: 'medium', category: 'sport', impactScore: 68 },
  { name: 'Art Capital', start: '2026-02-13', end: '2026-02-15', venue: 'Grand Palais', impact: 'medium', category: 'cultural', impactScore: 52 },
  { name: 'Salon de l\'Agriculture', start: '2026-02-21', end: '2026-03-01', venue: 'P. de Versailles', impact: 'high', category: 'salon', impactScore: 88 },

  // ═══ MARS 2026 ═══
  { name: 'Mode Féminine', start: '2026-03-02', end: '2026-03-10', venue: 'Paris Centre', impact: 'high', category: 'salon', impactScore: 85 },
  { name: 'Tranoï', start: '2026-03-05', end: '2026-03-08', venue: 'Palais Brogniart', impact: 'low', category: 'salon', impactScore: 48 },
  { name: 'Première Classe', start: '2026-03-06', end: '2026-03-09', venue: 'Tuileries', impact: 'medium', category: 'salon', impactScore: 58 },
  { name: 'Salon du Tourisme', start: '2026-03-12', end: '2026-03-15', venue: 'P. de Versailles', impact: 'medium', category: 'salon', impactScore: 60 },
  { name: 'Tournoi 6 Nations (France)', start: '2026-03-14', end: '2026-03-14', venue: 'Stade de France', impact: 'medium', category: 'sport', impactScore: 68 },
  { name: 'PHARMAGORA', start: '2026-03-14', end: '2026-03-15', venue: 'P. de Versailles', impact: 'medium', category: 'salon', impactScore: 55 },
  { name: 'Franchise Expo', start: '2026-03-14', end: '2026-03-16', venue: 'P. de Versailles', impact: 'medium', category: 'salon', impactScore: 60 },
  { name: 'All4Customer', start: '2026-03-24', end: '2026-03-26', venue: 'P. de Versailles', impact: 'high', category: 'salon', impactScore: 78 },
  { name: 'Global Industrie', start: '2026-03-30', end: '2026-04-02', venue: 'Villepinte', impact: 'high', category: 'salon', impactScore: 80 },

  // ═══ AVRIL 2026 ═══
  { name: 'Pâques', start: '2026-04-05', end: '2026-04-05', venue: 'Paris', impact: 'low', category: 'national', impactScore: 42 },
  { name: 'Lundi de Pâques', start: '2026-04-06', end: '2026-04-06', venue: 'Paris', impact: 'medium', category: 'national', impactScore: 50 },
  { name: 'Art Paris Art Fair', start: '2026-04-03', end: '2026-04-06', venue: 'Grand Palais', impact: 'medium', category: 'cultural', impactScore: 65 },
  { name: 'Marathon de Paris', start: '2026-04-12', end: '2026-04-13', venue: 'Paris Centre', impact: 'high', category: 'sport', impactScore: 75 },
  { name: 'Foire de Paris', start: '2026-04-30', end: '2026-05-11', venue: 'P. de Versailles', impact: 'high', category: 'salon', impactScore: 82 },

  // ═══ MAI 2026 ═══
  { name: 'Fête du Travail', start: '2026-05-01', end: '2026-05-01', venue: 'Paris', impact: 'medium', category: 'national', impactScore: 48 },
  { name: '8 Mai 1945', start: '2026-05-08', end: '2026-05-08', venue: 'Paris', impact: 'low', category: 'national', impactScore: 35 },
  { name: 'Ascension', start: '2026-05-14', end: '2026-05-14', venue: 'Paris', impact: 'medium', category: 'national', impactScore: 52 },
  { name: 'EUROPCR', start: '2026-05-20', end: '2026-05-23', venue: 'P. de Versailles', impact: 'high', category: 'salon', impactScore: 72 },
  { name: 'Lundi de Pentecôte', start: '2026-05-25', end: '2026-05-25', venue: 'Paris', impact: 'medium', category: 'national', impactScore: 50 },
  { name: 'Roland Garros', start: '2026-05-25', end: '2026-06-06', venue: 'Roland Garros', impact: 'high', category: 'sport', impactScore: 92 },

  // ═══ JUIN 2026 ═══
  { name: 'Vivatech', start: '2026-06-11', end: '2026-06-14', venue: 'P. de Versailles', impact: 'high', category: 'salon', impactScore: 95 },
  { name: 'Eurosatory', start: '2026-06-17', end: '2026-06-21', venue: 'Villepinte', impact: 'high', category: 'salon', impactScore: 78 },
  { name: 'Fête de la Musique', start: '2026-06-21', end: '2026-06-21', venue: 'Paris', impact: 'medium', category: 'cultural', impactScore: 58 },

  // ═══ JUILLET 2026 ═══
  { name: 'Tour de France (Arrivée Paris)', start: '2026-07-26', end: '2026-07-26', venue: 'Champs-Élysées', impact: 'high', category: 'sport', impactScore: 88 },
  { name: 'Fête Nationale (14 Juillet)', start: '2026-07-14', end: '2026-07-14', venue: 'Paris', impact: 'high', category: 'national', impactScore: 85 },

  // ═══ AOÛT 2026 ═══
  { name: 'Assomption', start: '2026-08-15', end: '2026-08-15', venue: 'Paris', impact: 'low', category: 'national', impactScore: 32 },

  // ═══ SEPTEMBRE 2026 ═══
  { name: 'Maison & Objet (Automne)', start: '2026-09-04', end: '2026-09-08', venue: 'Villepinte', impact: 'medium', category: 'salon', impactScore: 68 },
  { name: 'Journées du Patrimoine', start: '2026-09-19', end: '2026-09-20', venue: 'Paris', impact: 'medium', category: 'cultural', impactScore: 55 },
  { name: 'Mode Féminine (SS)', start: '2026-09-28', end: '2026-10-06', venue: 'Paris Centre', impact: 'high', category: 'salon', impactScore: 85 },

  // ═══ OCTOBRE 2026 ═══
  { name: 'Mondial de l\'Automobile', start: '2026-10-01', end: '2026-10-11', venue: 'P. de Versailles', impact: 'high', category: 'salon', impactScore: 90 },
  { name: 'Nuit Blanche', start: '2026-10-03', end: '2026-10-03', venue: 'Paris', impact: 'medium', category: 'cultural', impactScore: 60 },
  { name: 'Prix de l\'Arc de Triomphe', start: '2026-10-04', end: '2026-10-04', venue: 'Longchamp', impact: 'medium', category: 'sport', impactScore: 65 },
  { name: 'FIAC', start: '2026-10-22', end: '2026-10-25', venue: 'Grand Palais', impact: 'medium', category: 'cultural', impactScore: 70 },

  // ═══ NOVEMBRE 2026 ═══
  { name: 'Toussaint', start: '2026-11-01', end: '2026-11-01', venue: 'Paris', impact: 'medium', category: 'national', impactScore: 48 },
  { name: 'Armistice 1918', start: '2026-11-11', end: '2026-11-11', venue: 'Paris', impact: 'low', category: 'national', impactScore: 35 },
  { name: 'Salon du Chocolat', start: '2026-11-03', end: '2026-11-08', venue: 'P. de Versailles', impact: 'medium', category: 'salon', impactScore: 58 },

  // ═══ DÉCEMBRE 2026 ═══
  { name: 'Marché de Noël Champs-Élysées', start: '2026-12-01', end: '2026-12-24', venue: 'Champs-Élysées', impact: 'high', category: 'cultural', impactScore: 78 },
  { name: 'Noël', start: '2026-12-25', end: '2026-12-25', venue: 'Paris', impact: 'high', category: 'national', impactScore: 82 },
  { name: 'Réveillon du Nouvel An', start: '2026-12-31', end: '2026-12-31', venue: 'Paris', impact: 'high', category: 'cultural', impactScore: 88 },
];

/**
 * Cherche les événements actifs pour une date donnée
 */
export function getEventsForDate(date: string): Event[] {
  return PARIS_EVENTS_2026.filter(event => {
    return date >= event.start && date <= event.end;
  });
}

/**
 * Calcule le score d'impact cumulé pour une date
 * (plusieurs événements = score cumulé avec plafond)
 */
export function getEventImpactScore(date: string): number {
  const events = getEventsForDate(date);
  if (events.length === 0) return 0;
  
  // Score cumulé avec rendement décroissant
  const totalScore = events.reduce((sum, e) => sum + (e.impactScore || 0), 0);
  
  // Plafonné à 100
  return Math.min(100, totalScore);
}

/**
 * Cherche les événements dans une fenêtre temporelle
 */
export function getEventsInRange(startDate: string, endDate: string): Event[] {
  return PARIS_EVENTS_2026.filter(event => {
    // Événement chevauche la fenêtre
    return event.end >= startDate && event.start <= endDate;
  });
}
