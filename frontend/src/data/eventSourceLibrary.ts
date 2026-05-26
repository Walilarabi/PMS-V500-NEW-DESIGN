/**
 * FLOWTYM RMS — Source Library Engine
 *
 * Bibliothèque officielle des sources événementielles par ville.
 *   • Le moteur de recherche itère sur ces sources pour collecter les
 *     événements influençant la demande hôtelière.
 *   • Chaque source porte une fiabilité, une fréquence, une méthode
 *     (API / iCal / scraping / Excel manuel).
 *   • La bibliothèque est maintenable : on ajoute une ville en ajoutant
 *     les sources correspondantes — le moteur s'en sert automatiquement.
 *
 * Paris : 42 sources extraites des fichiers de référence
 *   - DATES SALONS — MISE A JOUR 25-03-2026.xlsx
 *   - salon 2026.xlsx
 *
 * Pour chaque source : nom officiel, URL, type, catégorie, fiabilité.
 */

import type { EventSource, RMSMarketEvent, EventCategory, EventImpactLevel } from '../types/events';
import {
  MEGA_ARTIST_REGISTRY,
  buildConcertImpact,
  concertPriceInfluence,
  matchArtist,
} from './megaArtistRegistry';

// ─── PARIS — 42 sources de référence ──────────────────────────────────────

const baseParisSource = (
  partial: Omit<EventSource, 'city' | 'country' | 'status' | 'active' | 'lastSyncAt'>,
): EventSource => ({
  city: 'Paris',
  country: 'FR',
  status: 'ok',
  active: true,
  lastSyncAt: '2026-05-15T08:00:00Z',
  ...partial,
});

export const EVENT_SOURCE_LIBRARY: EventSource[] = [
  // ─── Salons professionnels (Viparis / Comexposium / GL Events) ─────────
  baseParisSource({
    id: 'src_maison_objet',
    name: 'Maison & Objet',
    type: 'salon',
    url: 'https://www.maison-objet.com/',
    method: 'api',
    syncFrequency: 'daily',
    reliabilityScore: 97,
    apiAvailable: true,
    priority: 'recommended',
    notes: 'Salon international design & art de vivre — Villepinte.',
  }),
  baseParisSource({
    id: 'src_whos_next',
    name: 'Who\'s Next',
    type: 'fashion',
    url: 'https://whosnext.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 92,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_sirha_europain',
    name: 'Sirha Europain',
    type: 'salon',
    url: 'https://www.sirha-europain.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 93,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_fhcm',
    name: 'Fédération Haute Couture et Mode (FHCM)',
    type: 'fashion',
    url: 'https://www.fhcm.paris/',
    method: 'json_feed',
    syncFrequency: 'weekly',
    reliabilityScore: 99,
    apiAvailable: true,
    priority: 'recommended',
    notes: 'Paris Fashion Week — Homme / Femme / Haute Couture.',
  }),
  baseParisSource({
    id: 'src_retromobile',
    name: 'Rétromobile',
    type: 'salon',
    url: 'https://www.retromobile.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_premiere_vision',
    name: 'Première Vision',
    type: 'fashion',
    url: 'https://www.premierevision.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 93,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_ffr_six_nations',
    name: 'FFR — Tournoi des 6 Nations',
    type: 'sport',
    url: 'https://www.ffr.fr/six-nations-2026',
    method: 'ical',
    syncFrequency: 'daily',
    reliabilityScore: 98,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_art_capital',
    name: 'Art Capital',
    type: 'culture',
    url: 'https://artcapital.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 86,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_salon_agriculture',
    name: 'Salon International de l\'Agriculture',
    type: 'salon',
    url: 'https://www.salon-agriculture.com/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 98,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_tranoi',
    name: 'Tranoï',
    type: 'fashion',
    url: 'https://www.tranoi.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 88,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_salons_tourisme',
    name: 'Salon Mondial du Tourisme',
    type: 'salon',
    url: 'https://www.salons-du-tourisme.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_pharmagora',
    name: 'Pharmagora Plus',
    type: 'congress',
    url: 'https://www.pharmagoraplus.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 89,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_franchise_expo',
    name: 'Franchise Expo Paris',
    type: 'salon',
    url: 'https://www.franchiseparis.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 91,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_all4customer',
    name: 'All4Customer Paris',
    type: 'salon',
    url: 'https://www.all4customer-paris.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_global_industrie',
    name: 'Global Industrie',
    type: 'salon',
    url: 'https://global-industrie.com/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 94,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_art_paris',
    name: 'Art Paris Art Fair',
    type: 'culture',
    url: 'https://www.artparis.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_marathon_paris',
    name: 'Schneider Electric Marathon de Paris',
    type: 'sport',
    url: 'https://www.schneiderelectricparismarathon.com/',
    method: 'scraping',
    syncFrequency: 'monthly',
    reliabilityScore: 95,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_festival_livre',
    name: 'Festival du Livre de Paris',
    type: 'culture',
    url: 'https://www.festivaldulivredeparis.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 88,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_eurodermatology',
    name: 'European Dermatology Congress',
    type: 'congress',
    url: 'https://www.eurodermatology.org/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 86,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_foire_paris',
    name: 'Foire de Paris',
    type: 'salon',
    url: 'https://www.foiredeparis.fr/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 95,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_europcr',
    name: 'EuroPCR',
    type: 'congress',
    url: 'https://www.europcr.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 92,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_roland_garros',
    name: 'FFT — Roland-Garros',
    type: 'sport',
    url: 'https://www.rolandgarros.com/',
    method: 'api',
    syncFrequency: 'daily',
    reliabilityScore: 99,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_eurosatory',
    name: 'Eurosatory',
    type: 'salon',
    url: 'https://www.eurosatory.com/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 96,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_vivatech',
    name: 'VivaTech',
    type: 'congress',
    url: 'https://vivatechnology.com/',
    method: 'api',
    syncFrequency: 'daily',
    reliabilityScore: 97,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_len_natation',
    name: 'LEN — Championnats d\'Europe de Natation',
    type: 'sport',
    url: 'https://www.len.eu/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 95,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_paris_design_week',
    name: 'Paris Design Week',
    type: 'culture',
    url: 'https://www.maison-objet.com/paris-design-week',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 92,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_nrf_retail',
    name: 'NRF Retail Big Show Europe',
    type: 'salon',
    url: 'https://promosalons.com/salons/nrf-retail-big-show-europe/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_iftm_top_resa',
    name: 'IFTM Top Resa',
    type: 'salon',
    url: 'https://www.iftm.fr/fr-fr.html',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 91,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_batimat',
    name: 'Batimat / Idéobain',
    type: 'salon',
    url: 'https://www.batimat.com/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 94,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_salon_aps',
    name: 'Salon APS (Sûreté & Sécurité)',
    type: 'salon',
    url: 'https://www.salon-aps.com/fr-fr.html',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 89,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_salon_reunir',
    name: 'Salon Réunir',
    type: 'salon',
    url: 'https://salon.reunir.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 86,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_mondial_auto',
    name: 'Mondial de l\'Auto',
    type: 'salon',
    url: 'https://www.mondial-auto.com/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 96,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_sial_paris',
    name: 'SIAL Paris',
    type: 'salon',
    url: 'https://www.sialparis.fr/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 95,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_art_basel_paris',
    name: 'Art Basel Paris',
    type: 'culture',
    url: 'https://www.artbasel.com/paris',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 96,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_paris_games_week',
    name: 'Paris Games Week',
    type: 'salon',
    url: 'https://www.parisgamesweek.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 92,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_euronaval',
    name: 'Euronaval',
    type: 'salon',
    url: 'https://www.euronaval.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 89,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_equiphotel',
    name: 'EquipHotel',
    type: 'salon',
    url: 'https://www.equiphotel.com/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 94,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_mif_expo',
    name: 'MIF Expo (Made in France)',
    type: 'salon',
    url: 'https://www.mifexpo.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 87,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_salon_maires',
    name: 'Salon des Maires et des Collectivités',
    type: 'salon',
    url: 'https://www.salondesmaires.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 91,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_all4pack',
    name: 'All4Pack',
    type: 'salon',
    url: 'https://www.all4pack.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 89,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_world_nuclear',
    name: 'World Nuclear Exhibition',
    type: 'salon',
    url: 'https://www.world-nuclear-exhibition.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 88,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_paris_je_taime',
    name: 'Paris Je t\'aime (Office du Tourisme)',
    type: 'multi',
    url: 'https://www.parisjetaime.com/',
    method: 'rss',
    syncFrequency: '6h',
    reliabilityScore: 93,
    apiAvailable: false,
    priority: 'recommended',
    notes: 'Office du Tourisme officiel — événements festifs, fériés, fêtes de fin d\'année.',
  }),

  // ─── Mega Entertainment & Concert Impact Engine ────────────────────────
  // Stades & Arenas Île-de-France / Lyon / Marseille / Nice
  baseParisSource({
    id: 'src_stade_de_france_agenda',
    name: 'Stade de France — Agenda',
    type: 'mega_concert',
    url: 'https://www.stadefrance.com/fr/agenda',
    method: 'ical',
    syncFrequency: 'daily',
    reliabilityScore: 99,
    apiAvailable: true,
    priority: 'recommended',
    notes: 'Agenda officiel — concerts internationaux à très fort impact (80 000 places).',
  }),
  baseParisSource({
    id: 'src_parc_des_princes',
    name: 'Parc des Princes',
    type: 'mega_concert',
    url: 'https://www.leparcdesprinces.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 92,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_accor_arena_agenda',
    name: 'Accor Arena (Bercy) — Agenda',
    type: 'mega_concert',
    url: 'https://www.accorarena.com/fr/agenda',
    method: 'scraping',
    syncFrequency: 'daily',
    reliabilityScore: 95,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_paris_la_defense_arena',
    name: 'Paris La Défense Arena',
    type: 'mega_concert',
    url: 'https://www.parislad.com/',
    method: 'scraping',
    syncFrequency: 'daily',
    reliabilityScore: 94,
    apiAvailable: false,
    priority: 'recommended',
    notes: '40 000 places — accueille les méga tournées (Taylor Swift, Coldplay…).',
  }),
  baseParisSource({
    id: 'src_arena_grand_paris',
    name: 'Adidas Arena (Arena Grand Paris)',
    type: 'mega_concert',
    url: 'https://adidasarena.paris/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_groupama_stadium',
    name: 'Groupama Stadium (Lyon)',
    type: 'mega_concert',
    url: 'https://www.groupama-stadium.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 92,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_orange_velodrome',
    name: 'Orange Vélodrome (Marseille)',
    type: 'mega_concert',
    url: 'https://www.orangevelodrome.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 92,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_allianz_riviera',
    name: 'Allianz Riviera (Nice)',
    type: 'mega_concert',
    url: 'https://allianz-riviera.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_ldlc_arena',
    name: 'LDLC Arena (Lyon)',
    type: 'mega_concert',
    url: 'https://ldlc-arena.com/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 88,
    apiAvailable: false,
    priority: 'standard',
  }),

  // ─── Billetteries & Agrégateurs ───────────────────────────────────────
  baseParisSource({
    id: 'src_ticketmaster',
    name: 'Ticketmaster',
    type: 'mega_concert',
    url: 'https://www.ticketmaster.fr/',
    method: 'api',
    syncFrequency: '6h',
    reliabilityScore: 97,
    apiAvailable: true,
    priority: 'recommended',
    notes: 'API officielle — discovery + détails capacité, lead time, sold-out.',
  }),
  baseParisSource({
    id: 'src_fnac_spectacles',
    name: 'Fnac Spectacles',
    type: 'mega_concert',
    url: 'https://www.fnacspectacles.com/',
    method: 'scraping',
    syncFrequency: 'daily',
    reliabilityScore: 92,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_see_tickets',
    name: 'See Tickets',
    type: 'mega_concert',
    url: 'https://www.seetickets.com/',
    method: 'scraping',
    syncFrequency: 'daily',
    reliabilityScore: 88,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_live_nation',
    name: 'Live Nation France',
    type: 'mega_concert',
    url: 'https://www.livenation.fr/',
    method: 'scraping',
    syncFrequency: 'daily',
    reliabilityScore: 96,
    apiAvailable: false,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_gdp_productions',
    name: 'GDP — Gérard Drouot Productions',
    type: 'mega_concert',
    url: 'https://gdp.fr/',
    method: 'scraping',
    syncFrequency: 'weekly',
    reliabilityScore: 89,
    apiAvailable: false,
    priority: 'standard',
  }),
  baseParisSource({
    id: 'src_aeg_presents',
    name: 'AEG Presents',
    type: 'mega_concert',
    url: 'https://www.aegpresents.com/',
    method: 'api',
    syncFrequency: 'daily',
    reliabilityScore: 95,
    apiAvailable: true,
    priority: 'standard',
  }),

  // ─── Sources artistes (APIs tournées) ─────────────────────────────────
  baseParisSource({
    id: 'src_songkick',
    name: 'Songkick',
    type: 'mega_concert',
    url: 'https://www.songkick.com/',
    method: 'api',
    syncFrequency: '6h',
    reliabilityScore: 94,
    apiAvailable: true,
    priority: 'recommended',
    notes: 'API tournées + recherche utilisateurs (signal demande très en amont).',
  }),
  baseParisSource({
    id: 'src_bandsintown',
    name: 'Bandsintown',
    type: 'mega_concert',
    url: 'https://www.bandsintown.com/',
    method: 'api',
    syncFrequency: '6h',
    reliabilityScore: 93,
    apiAvailable: true,
    priority: 'recommended',
  }),
  baseParisSource({
    id: 'src_resident_advisor',
    name: 'Resident Advisor',
    type: 'electro_concert',
    url: 'https://ra.co/',
    method: 'scraping',
    syncFrequency: 'daily',
    reliabilityScore: 91,
    apiAvailable: false,
    priority: 'standard',
    notes: 'Référence Electro / DJ — clubs, festivals, after-parties.',
  }),
  baseParisSource({
    id: 'src_pollstar',
    name: 'Pollstar',
    type: 'mega_concert',
    url: 'https://www.pollstar.com/',
    method: 'api',
    syncFrequency: 'weekly',
    reliabilityScore: 96,
    apiAvailable: true,
    priority: 'standard',
    notes: 'Référence chiffres d\'affaires tournées (boxoffice US/world).',
  }),
  baseParisSource({
    id: 'src_billboard_touring',
    name: 'Billboard Touring',
    type: 'mega_concert',
    url: 'https://www.billboard.com/c/business/touring/',
    method: 'rss',
    syncFrequency: 'weekly',
    reliabilityScore: 90,
    apiAvailable: false,
    priority: 'standard',
  }),
];

// ─── Mapping lieu abrégé → zone normalisée ────────────────────────────────

const VENUE_NORMALIZATION: Record<string, { zone: string; venue: string }> = {
  'villepinte': { zone: 'Paris Nord — Villepinte', venue: 'Parc des Expositions Paris Nord Villepinte' },
  'p. de versailles': { zone: 'Porte de Versailles', venue: 'Paris Expo Porte de Versailles' },
  'porte de versailles': { zone: 'Porte de Versailles', venue: 'Paris Expo Porte de Versailles' },
  'paris centre': { zone: 'Paris Centre', venue: 'Paris Centre' },
  'stade de france': { zone: 'Saint-Denis', venue: 'Stade de France' },
  'grand palais': { zone: 'Paris 8e', venue: 'Grand Palais' },
  'palais brogniart': { zone: 'Paris 2e', venue: 'Palais Brongniart' },
  'centre / tuileries': { zone: 'Paris Centre — Tuileries', venue: 'Carrousel du Louvre / Tuileries' },
  'tuileries': { zone: 'Paris Centre — Tuileries', venue: 'Tuileries' },
  'palais des congrès': { zone: 'Paris 17e', venue: 'Palais des Congrès de Paris' },
  'rues de paris': { zone: 'Paris', venue: 'Rues de Paris' },
  'porte d\'auteuil': { zone: 'Paris 16e', venue: 'Stade Roland-Garros' },
  'paris / st-denis': { zone: 'Paris / Saint-Denis', venue: 'La Défense Arena & Aquatic Centre' },
  'paris entier': { zone: 'Paris', venue: 'Toute la ville' },
  'parc des princes': { zone: 'Paris 16e', venue: 'Parc des Princes' },
  'accor arena': { zone: 'Paris 12e — Bercy', venue: 'Accor Arena' },
  'paris la défense arena': { zone: 'Nanterre — La Défense', venue: 'Paris La Défense Arena' },
  'adidas arena': { zone: 'Porte de la Chapelle', venue: 'Adidas Arena' },
  'groupama stadium': { zone: 'Décines-Charpieu (Lyon)', venue: 'Groupama Stadium' },
  'orange vélodrome': { zone: 'Marseille', venue: 'Orange Vélodrome' },
  'allianz riviera': { zone: 'Nice', venue: 'Allianz Riviera' },
  'ldlc arena': { zone: 'Décines-Charpieu (Lyon)', venue: 'LDLC Arena' },
};

export function normalizeVenue(raw: string): { zone: string; venue: string } {
  const k = raw.trim().toLowerCase();
  return VENUE_NORMALIZATION[k] ?? { zone: raw, venue: raw };
}

// ─── Mapping source URL/nom → sourceId de la bibliothèque ─────────────────

const SOURCE_URL_TO_ID: Array<[RegExp, string]> = [
  [/maison-objet\.com\/paris-design-week/i, 'src_paris_design_week'],
  [/maison-objet\.com/i, 'src_maison_objet'],
  [/whosnext/i, 'src_whos_next'],
  [/sirha-europain/i, 'src_sirha_europain'],
  [/fhcm/i, 'src_fhcm'],
  [/retromobile/i, 'src_retromobile'],
  [/premierevision/i, 'src_premiere_vision'],
  [/ffr\.fr\/six-nations/i, 'src_ffr_six_nations'],
  [/artcapital/i, 'src_art_capital'],
  [/salon-agriculture/i, 'src_salon_agriculture'],
  [/tranoi/i, 'src_tranoi'],
  [/salons-du-tourisme/i, 'src_salons_tourisme'],
  [/pharmagoraplus/i, 'src_pharmagora'],
  [/franchiseparis/i, 'src_franchise_expo'],
  [/all4customer/i, 'src_all4customer'],
  [/global-industrie/i, 'src_global_industrie'],
  [/artparis/i, 'src_art_paris'],
  [/schneiderelectricparismarathon|paris-marathon/i, 'src_marathon_paris'],
  [/festivaldulivredeparis/i, 'src_festival_livre'],
  [/eurodermatology/i, 'src_eurodermatology'],
  [/foiredeparis/i, 'src_foire_paris'],
  [/europcr/i, 'src_europcr'],
  [/rolandgarros/i, 'src_roland_garros'],
  [/eurosatory/i, 'src_eurosatory'],
  [/vivatechnology|vivatech/i, 'src_vivatech'],
  [/len\.eu/i, 'src_len_natation'],
  [/nrf-retail-big-show/i, 'src_nrf_retail'],
  [/iftm\.fr/i, 'src_iftm_top_resa'],
  [/batimat/i, 'src_batimat'],
  [/salon-aps/i, 'src_salon_aps'],
  [/salon\.reunir/i, 'src_salon_reunir'],
  [/mondial-auto/i, 'src_mondial_auto'],
  [/sialparis/i, 'src_sial_paris'],
  [/artbasel\.com\/paris/i, 'src_art_basel_paris'],
  [/parisgamesweek/i, 'src_paris_games_week'],
  [/euronaval/i, 'src_euronaval'],
  [/equiphotel/i, 'src_equiphotel'],
  [/mifexpo/i, 'src_mif_expo'],
  [/salondesmaires/i, 'src_salon_maires'],
  [/all4pack/i, 'src_all4pack'],
  [/world-nuclear-exhibition/i, 'src_world_nuclear'],
  [/parisjetaime/i, 'src_paris_je_taime'],
];

export function resolveSourceId(raw: string): string | null {
  if (!raw) return null;
  for (const [re, id] of SOURCE_URL_TO_ID) if (re.test(raw)) return id;
  return null;
}

// ─── Catégorie auto par source ────────────────────────────────────────────

export function categoryForSource(sourceId: string, name: string): EventCategory {
  const src = EVENT_SOURCE_LIBRARY.find((s) => s.id === sourceId);
  if (src && src.type !== 'multi') return src.type as EventCategory;
  const n = name.toLowerCase();
  if (/marathon|tournoi|6 nations|natation|roland/.test(n)) return 'sport';
  if (/mode|couture|fashion|tranoi|premiere vision/.test(n)) return 'fashion';
  if (/art|design|livre|musée/.test(n)) return 'culture';
  if (/foire|salon|expo/.test(n)) return 'salon';
  if (/congrès|dermatology|europcr|pharma/.test(n)) return 'congress';
  if (/noël|pâques|fin d'année/.test(n)) return 'holiday';
  return 'other';
}

// ─── Mapping impact ───────────────────────────────────────────────────────

export function impactFromBadge(badge: string): { level: 'low' | 'medium' | 'high' | 'critical'; price: number } {
  const b = (badge || '').toLowerCase();
  if (b.includes('fort') || b.includes('🔴')) return { level: 'high', price: 14 };
  if (b.includes('moyen') || b.includes('🟠')) return { level: 'medium', price: 8 };
  if (b.includes('faible')) return { level: 'low', price: 4 };
  return { level: 'low', price: 3 };
}

// ─── Seed Paris — événements 2026 extraits des fichiers de référence ──────

interface RawEvent {
  name: string;
  start: string;
  end: string;
  venueRaw: string;
  impactBadge: string;
  sourceRaw: string;
}

const RAW_PARIS_2026: RawEvent[] = [
  { name: 'Maison & Objet (Hiver)', start: '2026-01-15', end: '2026-01-19', venueRaw: 'Villepinte', impactBadge: '🟠 Moyen', sourceRaw: 'maison-objet.com' },
  { name: 'Who\'s Next', start: '2026-01-17', end: '2026-01-19', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'whosnext.com' },
  { name: 'Sirha Europain', start: '2026-01-17', end: '2026-01-20', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'sirha-europain.com' },
  { name: 'Mode Masculine (Hiver)', start: '2026-01-20', end: '2026-01-25', venueRaw: 'Paris Centre', impactBadge: '🟠 Moyen', sourceRaw: 'fhcm.paris' },
  { name: 'Haute Couture (Hiver)', start: '2026-01-26', end: '2026-01-29', venueRaw: 'Paris Centre', impactBadge: '🟠 Moyen', sourceRaw: 'fhcm.paris' },
  { name: 'Rétromobile', start: '2026-01-28', end: '2026-02-01', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'retromobile.fr' },
  { name: 'Première Vision (Févr.)', start: '2026-02-03', end: '2026-02-05', venueRaw: 'Villepinte', impactBadge: '🔴 Fort', sourceRaw: 'premierevision.com' },
  { name: 'Tournoi 6 Nations', start: '2026-02-05', end: '2026-02-05', venueRaw: 'Stade de France', impactBadge: '🟠 Moyen', sourceRaw: 'https://www.ffr.fr/six-nations-2026' },
  { name: 'Art Capital', start: '2026-02-13', end: '2026-02-15', venueRaw: 'Grand Palais', impactBadge: '🟠 Moyen', sourceRaw: 'artcapital.fr' },
  { name: 'Salon de l\'Agriculture', start: '2026-02-21', end: '2026-03-01', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'salon-agriculture.com' },
  { name: 'Mode Féminine (Mars)', start: '2026-03-02', end: '2026-03-10', venueRaw: 'Paris Centre', impactBadge: '🔴 Fort', sourceRaw: 'fhcm.paris' },
  { name: 'Tranoï', start: '2026-03-05', end: '2026-03-08', venueRaw: 'Palais Brogniart', impactBadge: '🟠 Moyen', sourceRaw: 'tranoi.com' },
  { name: 'Première Classe', start: '2026-03-06', end: '2026-03-09', venueRaw: 'Centre / Tuileries', impactBadge: '🟠 Moyen', sourceRaw: 'premierevision.com' },
  { name: 'Salon Mondial du Tourisme', start: '2026-03-12', end: '2026-03-15', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'salons-du-tourisme.com' },
  { name: 'Tournoi 6 Nations', start: '2026-03-14', end: '2026-03-14', venueRaw: 'Stade de France', impactBadge: '🟠 Moyen', sourceRaw: 'https://www.ffr.fr/six-nations-2026' },
  { name: 'Pharmagora', start: '2026-03-14', end: '2026-03-15', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'https://www.pharmagoraplus.com/' },
  { name: 'Franchise Expo Paris', start: '2026-03-14', end: '2026-03-16', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'franchiseparis.com' },
  { name: 'All4Customer', start: '2026-03-24', end: '2026-03-26', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'https://www.all4customer-paris.com/' },
  { name: 'Global Industrie', start: '2026-03-30', end: '2026-04-02', venueRaw: 'Villepinte', impactBadge: '🔴 Fort', sourceRaw: 'global-industrie.com' },
  { name: 'Pâques', start: '2026-04-05', end: '2026-04-05', venueRaw: 'Paris Entier', impactBadge: '🟠 Faible', sourceRaw: 'parisjetaime.com' },
  { name: 'Art Paris Art Fair', start: '2026-04-09', end: '2026-04-12', venueRaw: 'Grand Palais', impactBadge: '🟠 Moyen', sourceRaw: 'artparis.com' },
  { name: 'Marathon de Paris', start: '2026-04-11', end: '2026-04-12', venueRaw: 'Rues de Paris', impactBadge: '🟠 Faible', sourceRaw: 'schneiderelectricparismarathon.com' },
  { name: 'Festival du Livre de Paris', start: '2026-04-17', end: '2026-04-19', venueRaw: 'Grand Palais', impactBadge: '🟠 Moyen', sourceRaw: 'festivaldulivredeparis.fr' },
  { name: 'European Dermatology Congress', start: '2026-04-27', end: '2026-04-29', venueRaw: 'Palais des Congrès', impactBadge: '🟠 Moyen', sourceRaw: 'https://www.eurodermatology.org/' },
  { name: 'Foire de Paris', start: '2026-04-30', end: '2026-05-11', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'foiredeparis.fr' },
  { name: 'EuroPCR', start: '2026-05-19', end: '2026-05-22', venueRaw: 'Palais des Congrès', impactBadge: '🔴 Fort', sourceRaw: 'europcr.com' },
  { name: 'Roland-Garros', start: '2026-05-24', end: '2026-06-07', venueRaw: 'Porte d\'Auteuil', impactBadge: '🔴 Fort', sourceRaw: 'rolandgarros.com' },
  { name: 'Eurosatory', start: '2026-06-15', end: '2026-06-19', venueRaw: 'Villepinte', impactBadge: '🔴 Fort', sourceRaw: 'eurosatory.com' },
  { name: 'VivaTech', start: '2026-06-17', end: '2026-06-20', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'vivatechnology.com' },
  { name: 'Mode Masculine (Juin)', start: '2026-06-23', end: '2026-06-28', venueRaw: 'Paris Centre', impactBadge: '🔴 Fort', sourceRaw: 'fhcm.paris' },
  { name: 'Haute Couture (Juillet)', start: '2026-07-06', end: '2026-07-09', venueRaw: 'Paris Centre', impactBadge: '🔴 Fort', sourceRaw: 'fhcm.paris' },
  { name: 'Championnats d\'Europe de Natation', start: '2026-07-25', end: '2026-08-08', venueRaw: 'Paris / St-Denis', impactBadge: '🟠 Moyen', sourceRaw: 'len.eu' },
  { name: 'Maison & Objet (Sept.)', start: '2026-09-03', end: '2026-09-07', venueRaw: 'Villepinte', impactBadge: '🔴 Fort', sourceRaw: 'maison-objet.com' },
  { name: 'Paris Design Week', start: '2026-09-03', end: '2026-09-12', venueRaw: 'Paris Centre', impactBadge: '🟠 Moyen', sourceRaw: 'maison-objet.com/paris-design-week' },
  { name: 'Who\'s Next (Sept.)', start: '2026-09-05', end: '2026-09-07', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'whosnext.com' },
  { name: 'NRF Retail Big Show Europe', start: '2026-09-15', end: '2026-09-17', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'https://promosalons.com/salons/nrf-retail-big-show-europe/' },
  { name: 'IFTM Top Resa', start: '2026-09-15', end: '2026-09-17', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'https://www.iftm.fr/fr-fr.html' },
  { name: 'Batimat / Idéobain', start: '2026-09-28', end: '2026-10-01', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'batimat.com' },
  { name: 'Salon APS (Sûreté & Sécurité)', start: '2026-09-28', end: '2026-09-30', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'https://www.salon-aps.com/fr-fr.html' },
  { name: 'Mode Féminine (Oct.)', start: '2026-09-28', end: '2026-10-06', venueRaw: 'Paris Centre', impactBadge: '🔴 Fort', sourceRaw: 'fhcm.paris' },
  { name: 'Salon Réunir', start: '2026-09-29', end: '2026-09-30', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'https://salon.reunir.com/' },
  { name: 'Mondial de l\'Auto', start: '2026-10-12', end: '2026-10-18', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'mondial-auto.com' },
  { name: 'SIAL Paris', start: '2026-10-17', end: '2026-10-21', venueRaw: 'Villepinte', impactBadge: '🔴 Fort', sourceRaw: 'sialparis.fr' },
  { name: 'Art Basel Paris', start: '2026-10-23', end: '2026-10-25', venueRaw: 'Grand Palais', impactBadge: '🟠 Moyen', sourceRaw: 'artbasel.com/paris' },
  { name: 'Paris Games Week', start: '2026-10-30', end: '2026-11-02', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'parisgamesweek.com' },
  { name: 'Euronaval', start: '2026-11-03', end: '2026-11-06', venueRaw: 'Villepinte', impactBadge: '🔴 Fort', sourceRaw: 'euronaval.fr' },
  { name: 'EquipHotel', start: '2026-11-02', end: '2026-11-05', venueRaw: 'P. de Versailles', impactBadge: '🔴 Fort', sourceRaw: 'equiphotel.com' },
  { name: 'MIF Expo (Made in France)', start: '2026-11-12', end: '2026-11-15', venueRaw: 'P. de Versailles', impactBadge: '🟠 Faible', sourceRaw: 'mifexpo.fr' },
  { name: 'Salon des Maires', start: '2026-11-24', end: '2026-11-26', venueRaw: 'P. de Versailles', impactBadge: '🟠 Moyen', sourceRaw: 'salondesmaires.com' },
  { name: 'All4Pack', start: '2026-11-24', end: '2026-11-26', venueRaw: 'Villepinte', impactBadge: '🔴 Fort', sourceRaw: 'all4pack.com' },
  { name: 'World Nuclear Exhibition', start: '2026-12-07', end: '2026-12-09', venueRaw: 'Villepinte', impactBadge: '🟠 Moyen', sourceRaw: 'world-nuclear-exhibition.com' },
  { name: 'Noël', start: '2026-12-24', end: '2026-12-25', venueRaw: 'Paris Entier', impactBadge: '🟠 Faible', sourceRaw: 'parisjetaime.com' },
  { name: 'Fin d\'année', start: '2026-12-26', end: '2026-12-31', venueRaw: 'Paris Entier', impactBadge: '🔴 Fort', sourceRaw: 'parisjetaime.com' },
];

function impactCoefficients(level: 'low' | 'medium' | 'high' | 'critical') {
  switch (level) {
    case 'critical': return { demand: 38, adr: 32, occupancy: 20, pickup: 30, revpar: 38, compression: 88, confidence: 95 };
    case 'high':     return { demand: 26, adr: 22, occupancy: 14, pickup: 22, revpar: 24, compression: 72, confidence: 90 };
    case 'medium':   return { demand: 14, adr: 11, occupancy: 8,  pickup: 12, revpar: 13, compression: 50, confidence: 86 };
    case 'low':      return { demand: 6,  adr: 4,  occupancy: 3,  pickup: 5,  revpar: 5,  compression: 22, confidence: 80 };
  }
}

const SEED_PARIS_SALONS: RMSMarketEvent[] = RAW_PARIS_2026.map((r, idx) => {
  const sourceId = resolveSourceId(r.sourceRaw) ?? 'src_paris_je_taime';
  const source = EVENT_SOURCE_LIBRARY.find((s) => s.id === sourceId)!;
  const venue = normalizeVenue(r.venueRaw);
  const impact = impactFromBadge(r.impactBadge);
  const coefs = impactCoefficients(impact.level);
  const id = `evt_paris_${r.start}_${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.slice(0, 80);

  // Statuts réalistes : passé=confirmed, imminents=active, lointain=estimated
  const today = new Date().toISOString().slice(0, 10);
  const isPast = r.end < today;
  const isImminent = r.start <= today || (r.start > today && r.start <= new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const status: import('../types/events').EventStatus =
    isPast      ? 'confirmed' :
    isImminent  ? 'active' :
    idx % 7 === 0 ? 'estimated' :
    idx % 5 === 0 ? 'new' :
    'confirmed';

  return {
    id,
    name: r.name,
    category: categoryForSource(sourceId, r.name),
    status,
    city: 'Paris',
    country: 'FR',
    zone: venue.zone,
    venue: venue.venue,
    startDate: r.start,
    endDate: r.end,
    impact: { ...coefs, level: impact.level },
    influencePrice: impact.price,
    sources: [sourceId],
    primarySource: source.name,
    rmsSynced: isPast || !['new', 'estimated'].includes(status),
    syncedAt: isPast ? '2026-05-15T08:00:00Z' : undefined,
    history: [
      { at: '2026-03-25T00:00:00Z', action: 'imported' as const, source: 'DATES SALONS — MISE A JOUR 25-03-2026.xlsx' },
      { at: '2026-05-15T08:00:00Z', action: 'synced' as const, source: source.name },
    ],
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-05-15T08:00:00Z',
  };
});

// ─── MEGA CONCERTS — Stade de France 2026 (source: Live Nation / Stade de France) ──

interface RawConcert {
  artist: string;
  dates: string[];   // ISO YYYY-MM-DD
  venueRaw: string;
  /** Override d'impact si le moteur d'artistes n'a pas le bon tier (rare). */
  forceLevel?: EventImpactLevel;
  sourceId: string;
  withArtists?: string[];
}

const RAW_PARIS_CONCERTS: RawConcert[] = [
  {
    artist: 'Fally Ipupa',
    dates: ['2026-05-02', '2026-05-03'],
    venueRaw: 'stade de france',
    sourceId: 'src_stade_de_france_agenda',
  },
  {
    artist: 'Jul',
    dates: ['2026-05-16', '2026-05-17'],
    venueRaw: 'stade de france',
    sourceId: 'src_stade_de_france_agenda',
  },
  {
    artist: 'Aya Nakamura',
    dates: ['2026-05-29', '2026-05-30', '2026-05-31'],
    venueRaw: 'stade de france',
    sourceId: 'src_stade_de_france_agenda',
  },
  {
    artist: 'David Guetta',
    dates: ['2026-06-11', '2026-06-12', '2026-06-13'],
    venueRaw: 'stade de france',
    sourceId: 'src_live_nation',
  },
  {
    artist: 'Bruno Mars',
    dates: ['2026-06-18', '2026-06-20', '2026-06-21'],
    venueRaw: 'stade de france',
    sourceId: 'src_live_nation',
  },
  {
    artist: 'System of a Down',
    dates: ['2026-07-02', '2026-07-04'],
    venueRaw: 'stade de france',
    sourceId: 'src_live_nation',
    withArtists: ['Queens of the Stone Age', 'Acid Bath'],
  },
  {
    artist: 'The Weeknd',
    dates: ['2026-07-08', '2026-07-10', '2026-07-11', '2026-07-12'],
    venueRaw: 'stade de france',
    sourceId: 'src_live_nation',
  },
  {
    artist: 'BTS',
    dates: ['2026-07-17', '2026-07-18'],
    venueRaw: 'stade de france',
    sourceId: 'src_aeg_presents',
    forceLevel: 'hyper_compression',
  },
  {
    artist: 'PLK',
    dates: ['2026-09-04', '2026-09-05'],
    venueRaw: 'accor arena',
    sourceId: 'src_accor_arena_agenda',
  },
];

/**
 * Construit les événements concert à partir des configurations brutes.
 * Chaque artiste est résolu dans MEGA_ARTIST_REGISTRY pour récupérer son
 * tier/popularité ; le moteur calcule ensuite l'impact RMS attendu.
 *
 * Les dates non consécutives (ex. 18/06, 20/06, 21/06 — Bruno Mars) sont
 * fusionnées en un seul événement multi-soirs avec startDate = min(dates)
 * et endDate = max(dates), pour faciliter l'affichage calendrier.
 */
const SEED_PARIS_CONCERTS: RMSMarketEvent[] = RAW_PARIS_CONCERTS.map((rc) => {
  const artist = matchArtist(rc.artist) ?? MEGA_ARTIST_REGISTRY[0];
  const dateCount = rc.dates.length;
  const venueCapacity = rc.venueRaw.toLowerCase().includes('stade de france') ? 1
    : rc.venueRaw.toLowerCase().includes('arena') ? 0.55
    : 0.4;
  const impactCoefs = buildConcertImpact(artist, dateCount, venueCapacity);
  const level: EventImpactLevel = rc.forceLevel
    ?? (artist.tier === 'hyper_global'
        ? 'hyper_compression'
        : artist.tier === 'global'
          ? 'critical'
          : 'high');
  const venue = normalizeVenue(rc.venueRaw);
  const source = EVENT_SOURCE_LIBRARY.find((s) => s.id === rc.sourceId)!;

  const start = rc.dates.slice().sort()[0];
  const end = rc.dates.slice().sort().reverse()[0];
  const suffix = rc.withArtists?.length ? ` (+${rc.withArtists.join(', ')})` : '';
  const id = `evt_concert_${start}_${artist.id}`;

  return {
    id,
    name: `${artist.name}${suffix}${dateCount > 1 ? ` — ${dateCount} dates` : ''}`,
    category: artist.category,
    status: 'active',
    city: 'Paris',
    country: 'FR',
    zone: venue.zone,
    venue: venue.venue,
    startDate: start,
    endDate: end,
    impact: { ...impactCoefs, level },
    influencePrice: concertPriceInfluence(artist, dateCount),
    description: `${artist.name} — ${dateCount} date${dateCount > 1 ? 's' : ''} à ${venue.venue}.${
      artist.tier === 'hyper_global' ? ' Phénomène mondial : déclenche le palier Hyper Compression et une stratégie pricing agressive.' :
      artist.tier === 'global' ? ' Tournée internationale — fort impact ADR / TO attendu.' :
      ''
    }`,
    sources: [rc.sourceId],
    primarySource: source.name,
    rmsSynced: true,
    syncedAt: '2026-05-15T08:00:00Z',
    history: [
      { at: '2026-04-01T10:00:00Z', action: 'imported', source: source.name },
      { at: '2026-05-15T08:00:00Z', action: 'synced', source: source.name },
    ],
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-05-15T08:00:00Z',
  };
});

/** Seed final = salons (52) + méga concerts (9) — bibliothèque Paris complète. */
export const SEED_PARIS_EVENTS: RMSMarketEvent[] = [
  ...SEED_PARIS_SALONS,
  ...SEED_PARIS_CONCERTS,
];
