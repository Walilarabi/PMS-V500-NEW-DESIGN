/**
 * FLOWTYM — Liste canonique des 34 partenaires / OTA
 *
 * Source de vérité unique pour :
 *   - RoomManagerPanel  (distributionChannels)
 *   - RateManagerPanel  (partnerIds)
 *   - ReservationFormModal (channel / source)
 *   - RoomTypesPage / RatePlansPage (chips partenaires)
 *
 * IDs stables kebab-case — ne jamais modifier un `id` existant
 * (clé de relation en base dans la colonne `partner_ids text[]`).
 */

export type PartnerCategory =
  | 'direct'       // Vente directe hôtel
  | 'ota_global'   // OTA internationaux (Booking, Expedia, Airbnb…)
  | 'ota_fr'       // Portails & guides français
  | 'gds'          // GDS & channel managers
  | 'to'           // Tour-opérateurs & grossistes
  | 'other';       // Autres (CRM, marketing…)

export interface Partner {
  id: string;             // Slug kebab-case stable — clé de relation en base
  label: string;          // Nom affiché dans l'UI
  category: PartnerCategory;
  logoType?: string;      // Alias pour OTALogoType (optionnel)
}

export const PARTNERS: Partner[] = [
  // ── Direct ──────────────────────────────────────────────────────────────
  { id: 'direct',              label: 'Mon plan tarifaire',                  category: 'direct',     logoType: 'direct' },

  // ── OTA Globaux ─────────────────────────────────────────────────────────
  { id: 'agoda',               label: 'Agoda',                               category: 'ota_global', logoType: 'agoda' },
  { id: 'airbnb',              label: 'Airbnb',                              category: 'ota_global', logoType: 'airbnb' },
  { id: 'booking-com',         label: 'Booking.com',                         category: 'ota_global', logoType: 'booking' },
  { id: 'expedia',             label: 'Expedia',                             category: 'ota_global', logoType: 'expedia' },
  { id: 'hrs',                 label: 'HRS',                                 category: 'ota_global', logoType: 'hrs' },
  { id: 'lastminute',          label: 'lastminute.com',                      category: 'ota_global', logoType: 'lastminute' },
  { id: 'tbo-com',             label: 'TBO.com',                             category: 'ota_global', logoType: 'tbo' },
  { id: 'traveltino',          label: 'Traveltino',                          category: 'ota_global' },
  { id: 'trip-com',            label: 'Trip.com',                            category: 'ota_global', logoType: 'trip' },

  // ── Portails & guides français ──────────────────────────────────────────
  { id: 'france-hotel-guide',  label: 'France Hotel Guide',                  category: 'ota_fr' },
  { id: 'hotels-grand-paris',  label: 'Hotels Grand Paris',                  category: 'ota_fr' },
  { id: 'leboncoin-hotel',     label: 'Leboncoin Hôtel',                     category: 'ota_fr' },
  { id: 'les-guides-rivages',  label: 'Les Guides Rivages',                  category: 'ota_fr' },
  { id: 'paris-paris-com',     label: 'PARIS-PARIS.COM',                     category: 'ota_fr' },
  { id: 'payot-rivages',       label: 'Payot & Rivages / PERFERENCEMENT',    category: 'ota_fr' },

  // ── GDS & connectivité ──────────────────────────────────────────────────
  { id: 'd-edge',              label: 'D-EDGE Backoffice Connection',         category: 'gds' },
  { id: 'gds-connectivity',    label: 'GDS connectivity',                    category: 'gds' },
  { id: 'opengds-maxmind',     label: 'OpenGDS / MaxMind Technologies',      category: 'gds' },

  // ── Tour-opérateurs & grossistes ────────────────────────────────────────
  { id: 'dotw-webbeds',        label: 'DOTW Webbeds Group',                  category: 'to' },
  { id: 'his-france',          label: 'H.I.S. International Tours France',   category: 'to' },
  { id: 'hotelbeds',           label: 'Hotelbeds',                           category: 'to', logoType: 'hotelbeds' },
  { id: 'magic-holidays',      label: 'Magic Holidays',                      category: 'to', logoType: 'magic_holidays' },
  { id: 'miki-travel',         label: 'Miki Travel Ltd',                     category: 'to', logoType: 'miki' },
  { id: 'olympia-europe',      label: 'Olympia Europe',                      category: 'to', logoType: 'olympia' },
  { id: 'serhs-welcomebeds',   label: 'Serhs Tourism / Welcomebeds',         category: 'to' },
  { id: 'sunhotels-webbeds',   label: 'SunHotels Webbeds Group',             category: 'to' },
  { id: 'travco',              label: 'Travco',                              category: 'to', logoType: 'travco' },

  // ── Autres (marketing, CRM…) ────────────────────────────────────────────
  { id: 'cendyn',              label: 'Cendyn',                              category: 'other' },
  { id: 'hotel-trader',        label: 'Hotel Trader',                        category: 'other' },
  { id: 'infinite-hotel',      label: 'InfiniteHotel',                       category: 'other', logoType: 'infiniter' },
  { id: 'sas-wihp',            label: 'SAS WIHP',                            category: 'other' },
  { id: 'sofimediat',          label: 'SOFIMEDIAT',                          category: 'other' },
  { id: 'web-promotions',      label: 'web promotions-portail',              category: 'other' },
];

/** Lookup rapide par id — O(1) */
export const PARTNERS_BY_ID: Map<string, Partner> = new Map(
  PARTNERS.map((p) => [p.id, p]),
);

/** Partenaires groupés par catégorie — utile pour les `<optgroup>` */
export const PARTNER_CATEGORIES: Record<PartnerCategory, { label: string; partners: Partner[] }> = {
  direct:     { label: 'Vente directe',               partners: PARTNERS.filter((p) => p.category === 'direct') },
  ota_global: { label: 'OTA Internationaux',           partners: PARTNERS.filter((p) => p.category === 'ota_global') },
  ota_fr:     { label: 'Portails & guides français',  partners: PARTNERS.filter((p) => p.category === 'ota_fr') },
  gds:        { label: 'GDS & Channel Managers',      partners: PARTNERS.filter((p) => p.category === 'gds') },
  to:         { label: 'Tour-opérateurs & grossistes', partners: PARTNERS.filter((p) => p.category === 'to') },
  other:      { label: 'Autres partenaires',           partners: PARTNERS.filter((p) => p.category === 'other') },
};

/** Ordre d'affichage des catégories dans les selects */
export const PARTNER_CATEGORY_ORDER: PartnerCategory[] = [
  'direct', 'ota_global', 'ota_fr', 'gds', 'to', 'other',
];
