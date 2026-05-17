/**
 * FLOWTYM DESIGN SYSTEM — SPACING & SHADOWS
 * 
 * Scale d'espacements cohérente et ombres premium pour profondeur visuelle.
 */

export const spacing = {
  // ─── SPACING SCALE ────────────────────────────────────────────────────────
  // Basé sur une échelle 4px (Tailwind standard)
  px: '1px',
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px

  // ─── COMPONENT-SPECIFIC ───────────────────────────────────────────────────
  card: {
    padding: 'p-6',          // Padding interne carte
    gap: 'gap-4',            // Gap entre éléments carte
  },
  
  grid: {
    cellPadding: 'px-3 py-2',     // Padding cellule planning
    cardPadding: 'px-2 py-1.5',   // Padding carte réservation
    gap: 'gap-1',                 // Gap entre cellules
  },

  list: {
    itemPadding: 'px-6 py-4',    // Padding item liste
    gap: 'gap-2',                // Gap entre items
  },

  button: {
    sm: 'px-3 py-1.5',
    md: 'px-5 py-2.5',
    lg: 'px-6 py-3',
  },

  section: {
    padding: 'p-8',
    gap: 'gap-6',
  },
} as const;

/**
 * Système d'ombres progressif pour hiérarchie visuelle.
 */
export const shadows = {
  // Ombres par niveau d'élévation
  none: 'shadow-none',
  sm: 'shadow-sm',              // Cartes simples, items liste
  md: 'shadow-md',              // Cartes élevées, dropdowns
  lg: 'shadow-lg',              // Modals, popovers
  xl: 'shadow-xl',              // Overlays majeurs

  // Ombres contextuelles
  card: 'shadow-sm hover:shadow-md transition-shadow duration-200',
  cardElevated: 'shadow-md hover:shadow-lg transition-shadow duration-200',
  
  // Ombres de focus (accessibilité)
  focus: 'ring-2 ring-offset-2 ring-brand-primary/50',
  
  // Glow subtil pour éléments interactifs
  glow: 'shadow-[0_0_20px_rgba(139,92,246,0.15)]',
} as const;

/**
 * Border radius cohérent.
 */
export const radius = {
  none: 'rounded-none',
  sm: 'rounded-sm',          // 2px
  md: 'rounded-md',          // 6px — défaut pour la plupart des composants
  lg: 'rounded-lg',          // 8px
  xl: 'rounded-xl',          // 12px
  full: 'rounded-full',      // Pills, avatars
  
  // Contextuels
  card: 'rounded-lg',
  button: 'rounded-md',
  badge: 'rounded-md',
  input: 'rounded-md',
} as const;

/**
 * Transitions fluides et cohérentes.
 */
export const transitions = {
  fast: 'transition-all duration-150 ease-out',
  base: 'transition-all duration-200 ease-out',
  slow: 'transition-all duration-300 ease-out',
  
  // Par propriété
  colors: 'transition-colors duration-200 ease-out',
  shadow: 'transition-shadow duration-200 ease-out',
  transform: 'transition-transform duration-200 ease-out',
  opacity: 'transition-opacity duration-200 ease-out',
} as const;
