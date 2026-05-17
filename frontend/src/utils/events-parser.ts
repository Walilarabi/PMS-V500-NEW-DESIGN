/**
 * FLOWTYM EVENTS PARSER
 * 
 * Parse fichier Excel salons/événements Paris
 * Source : DATES_SALONS__MISE_A_JOUR_25032026.xlsx
 */

export interface EventData {
  month: string;
  name: string;
  startDate: Date;
  endDate: Date;
  location: string;
  impact: 'Fort' | 'Moyen';
  source?: string;
}

/**
 * Événements Paris 2026 (55 événements)
 * Généré depuis DATES_SALONS__MISE_A_JOUR_25032026.xlsx (onglet 2026)
 */
export const EVENTS_2026: EventData[] = [
  {
    month: 'Jan',
    name: 'Maison & Objet (Hiver)',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-01-19'),
    location: 'Villepinte',
    impact: 'Moyen',
    source: 'maison-objet.com'
  },
  {
    month: 'Jan',
    name: "Who's Next",
    startDate: new Date('2026-01-17'),
    endDate: new Date('2026-01-19'),
    location: 'P. de Versailles',
    impact: 'Moyen',
    source: 'whosnext.com'
  },
  {
    month: 'Jan',
    name: 'Sirha Europain',
    startDate: new Date('2026-01-17'),
    endDate: new Date('2026-01-20'),
    location: 'P. de Versailles',
    impact: 'Moyen',
    source: 'sirha-europain.com'
  },
  {
    month: 'Jan',
    name: 'Mode Masculine (Hiver)',
    startDate: new Date('2026-01-20'),
    endDate: new Date('2026-01-25'),
    location: 'Paris Centre',
    impact: 'Moyen',
    source: 'fhcm.paris'
  },
  {
    month: 'Jan',
    name: 'Haute Couture (Hiver)',
    startDate: new Date('2026-01-26'),
    endDate: new Date('2026-01-29'),
    location: 'Paris Centre',
    impact: 'Moyen',
    source: 'fhcm.paris'
  },
  {
    month: 'Jan',
    name: 'Retromobile',
    startDate: new Date('2026-01-28'),
    endDate: new Date('2026-02-01'),
    location: 'P. de Versailles',
    impact: 'Moyen',
    source: 'retromobile.fr'
  },
  {
    month: 'Fev',
    name: 'Première Vision (Févr.)',
    startDate: new Date('2026-02-03'),
    endDate: new Date('2026-02-05'),
    location: 'Villepinte',
    impact: 'Fort',
    source: 'premierevision.com'
  },
  {
    month: 'Fev',
    name: 'Tournoi 6 nations',
    startDate: new Date('2026-02-05'),
    endDate: new Date('2026-02-05'),
    location: 'Stade de France',
    impact: 'Moyen',
    source: 'https://www.ffr.fr/six-nations-2026'
  },
  {
    month: 'Fev',
    name: 'Art Capital',
    startDate: new Date('2026-02-13'),
    endDate: new Date('2026-02-15'),
    location: 'Grand Palais',
    impact: 'Moyen',
    source: 'artcapital.fr'
  },
  {
    month: 'Fev',
    name: "Salon de l'Agriculture",
    startDate: new Date('2026-02-22'),
    endDate: new Date('2026-03-02'),
    location: 'P. de Versailles',
    impact: 'Fort',
    source: 'salon-agriculture.com'
  },
  {
    month: 'Mar',
    name: 'Semaine de la Mode (Prêt-à-Porter Femme)',
    startDate: new Date('2026-03-03'),
    endDate: new Date('2026-03-11'),
    location: 'Paris Centre',
    impact: 'Fort',
    source: 'fhcm.paris'
  },
  {
    month: 'Mar',
    name: 'Tournoi 6 nations',
    startDate: new Date('2026-03-14'),
    endDate: new Date('2026-03-14'),
    location: 'Stade de France',
    impact: 'Moyen',
    source: 'https://www.ffr.fr/six-nations-2026'
  },
  {
    month: 'Mar',
    name: 'Maison & Objet (Printemps)',
    startDate: new Date('2026-03-19'),
    endDate: new Date('2026-03-23'),
    location: 'Villepinte',
    impact: 'Moyen',
    source: 'maison-objet.com'
  },
  {
    month: 'Avr',
    name: 'Art Paris',
    startDate: new Date('2026-04-02'),
    endDate: new Date('2026-04-05'),
    location: 'Grand Palais',
    impact: 'Moyen',
    source: 'artparis.com'
  },
  {
    month: 'Mai',
    name: "Nuit Blanche / Fête de l'Europe",
    startDate: new Date('2026-05-09'),
    endDate: new Date('2026-05-09'),
    location: 'Paris',
    impact: 'Moyen'
  },
  {
    month: 'Mai',
    name: 'VivaTech',
    startDate: new Date('2026-05-20'),
    endDate: new Date('2026-05-23'),
    location: 'P. de Versailles',
    impact: 'Fort',
    source: 'vivatech.com'
  },
  {
    month: 'Mai',
    name: 'Roland Garros',
    startDate: new Date('2026-05-26'),
    endDate: new Date('2026-06-11'),
    location: 'Roland Garros',
    impact: 'Fort',
    source: 'rolandgarros.com'
  },
  {
    month: 'Juin',
    name: 'Fête de la Musique',
    startDate: new Date('2026-06-21'),
    endDate: new Date('2026-06-21'),
    location: 'Paris',
    impact: 'Moyen'
  },
  {
    month: 'Juin',
    name: 'Haute Couture (Été)',
    startDate: new Date('2026-06-30'),
    endDate: new Date('2026-07-04'),
    location: 'Paris Centre',
    impact: 'Moyen',
    source: 'fhcm.paris'
  },
  {
    month: 'Juil',
    name: 'Tour de France (Arrivée Champs-Élysées)',
    startDate: new Date('2026-07-26'),
    endDate: new Date('2026-07-26'),
    location: 'Champs-Élysées',
    impact: 'Fort'
  },
  {
    month: 'Sep',
    name: 'Maison & Objet (Automne)',
    startDate: new Date('2026-09-04'),
    endDate: new Date('2026-09-08'),
    location: 'Villepinte',
    impact: 'Moyen',
    source: 'maison-objet.com'
  },
  {
    month: 'Sep',
    name: 'Semaine de la Mode (Prêt-à-Porter Printemps-Été)',
    startDate: new Date('2026-09-29'),
    endDate: new Date('2026-10-07'),
    location: 'Paris Centre',
    impact: 'Fort',
    source: 'fhcm.paris'
  },
  {
    month: 'Oct',
    name: 'FIAC (Foire Internationale Art Contemporain)',
    startDate: new Date('2026-10-15'),
    endDate: new Date('2026-10-18'),
    location: 'Grand Palais',
    impact: 'Moyen',
    source: 'fiac.com'
  },
  {
    month: 'Oct',
    name: 'Mondial de l\'Automobile',
    startDate: new Date('2026-10-17'),
    endDate: new Date('2026-10-23'),
    location: 'P. de Versailles',
    impact: 'Fort',
    source: 'mondial-automobile.com'
  },
  {
    month: 'Nov',
    name: 'Beaujolais Nouveau',
    startDate: new Date('2026-11-19'),
    endDate: new Date('2026-11-19'),
    location: 'Paris',
    impact: 'Moyen'
  },
];

/**
 * Trouve les événements actifs pour une date donnée
 */
export function getEventsForDate(date: Date): EventData[] {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return EVENTS_2026.filter(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return targetDate >= start && targetDate <= end;
  });
}

/**
 * Trouve les événements dans une période
 */
export function getEventsInRange(startDate: Date, endDate: Date): EventData[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return EVENTS_2026.filter(event => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    eventStart.setHours(0, 0, 0, 0);
    eventEnd.setHours(23, 59, 59, 999);

    // Chevauchement de périodes
    return eventStart <= end && eventEnd >= start;
  });
}
