/**
 * FLOWTYM — Canaux de distribution (rétro-compat)
 *
 * Ce fichier ré-exporte les 34 partenaires depuis `partners.ts` sous
 * le format `{ value, label }` attendu par les anciens composants.
 * Ne jamais modifier ce fichier directement — modifier `partners.ts`.
 */
export { PARTNERS, PARTNERS_BY_ID, PARTNER_CATEGORIES, PARTNER_CATEGORY_ORDER } from './partners';
export type { Partner, PartnerCategory } from './partners';

import { PARTNERS } from './partners';

/** Format legacy `{ value, label }` — conservé pour compatibilité */
export const CHANNELS = PARTNERS.map((p) => ({
  value: p.id,
  label: p.label,
}));
