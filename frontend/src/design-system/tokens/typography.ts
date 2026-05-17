/**
 * FLOWTYM DESIGN SYSTEM — TYPOGRAPHY
 * 
 * Scale typographique premium pour un PMS enterprise.
 * Objectif : lisibilité maximale sur desktop, hiérarchie claire, sensation haut de gamme.
 * 
 * Référence : Inter (chargée depuis Google Fonts dans index.html)
 * Philosophie : +20% vs standards actuels, poids medium par défaut pour clarté.
 */

export const typography = {
  // ─── HEADINGS ─────────────────────────────────────────────────────────────
  heading: {
    h1: 'text-[32px] font-semibold leading-[1.2] tracking-tight',
    h2: 'text-[24px] font-semibold leading-[1.3] tracking-tight',
    h3: 'text-[20px] font-semibold leading-[1.4]',
    h4: 'text-[18px] font-medium leading-[1.4]',
  },

  // ─── BODY ─────────────────────────────────────────────────────────────────
  body: {
    // Taille standard pour le contenu principal
    lg: 'text-[16px] font-normal leading-[1.6]',
    base: 'text-[15px] font-normal leading-[1.6]',
    sm: 'text-[14px] font-normal leading-[1.5]',
    xs: 'text-[13px] font-normal leading-[1.5]',
  },

  // ─── UI COMPONENTS ────────────────────────────────────────────────────────
  ui: {
    // Boutons, badges, labels
    button: {
      lg: 'text-[16px] font-semibold leading-none tracking-tight',
      md: 'text-[15px] font-semibold leading-none tracking-tight',
      sm: 'text-[14px] font-medium leading-none',
    },
    badge: 'text-[13px] font-medium leading-none uppercase tracking-wide',
    label: 'text-[14px] font-medium leading-none',
    caption: 'text-[13px] font-normal leading-tight text-gray-500',
  },

  // ─── NAVIGATION ───────────────────────────────────────────────────────────
  nav: {
    // Menu principal et sous-menus — +20% vs actuel
    primary: 'text-[16px] font-medium leading-none',
    secondary: 'text-[15px] font-normal leading-none',
    
    // Sidebar sections
    section: 'text-[13px] font-semibold leading-none uppercase tracking-widest text-gray-400',
  },

  // ─── DATA TABLES ──────────────────────────────────────────────────────────
  table: {
    header: 'text-[14px] font-semibold leading-none uppercase tracking-wide text-gray-600',
    cell: 'text-[15px] font-normal leading-tight',
    cellBold: 'text-[15px] font-semibold leading-tight',
    cellMuted: 'text-[14px] font-normal leading-tight text-gray-500',
  },

  // ─── PLANNING GRID ────────────────────────────────────────────────────────
  planning: {
    // Numéros de chambre
    roomNumber: 'text-[15px] font-semibold leading-none',
    roomType: 'text-[13px] font-normal leading-none text-gray-500',
    
    // Cartes réservation
    guestName: 'text-[14px] font-semibold leading-tight',
    reservationMeta: 'text-[12px] font-normal leading-tight text-gray-600',
    reservationId: 'text-[11px] font-mono leading-none text-gray-400',
    
    // Timeline dates
    dateDay: 'text-[14px] font-semibold leading-none',
    dateMonth: 'text-[12px] font-normal leading-none text-gray-500',
  },

  // ─── UTILITIES ────────────────────────────────────────────────────────────
  mono: 'font-mono',
  truncate: 'truncate',
  ellipsis: 'overflow-hidden text-ellipsis whitespace-nowrap',
} as const;

/**
 * Helper pour combiner plusieurs classes typo.
 * Usage : cn(typography.body.base, typography.truncate)
 */
export type TypographyToken = typeof typography[keyof typeof typography];
