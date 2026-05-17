/**
 * PLANNING V2 DESIGN SYSTEM
 * 
 * Single source of truth pour toutes les dimensions, couleurs, typographie.
 * Aucun hardcoding de valeurs ailleurs dans le code.
 */

export const PLANNING_DESIGN = {
  // ── GRILLE ──────────────────────────────────────────────────────────────
  grid: {
    rowHeight: 56,           // Hauteur fixe ligne (inclut borders)
    cellWidth: 140,          // Largeur cellule jour
    roomColumnWidth: 160,    // Largeur colonne chambres (fixe)
    gutter: 1,               // Espacement inter-cellules
    headerHeight: 48,        // Hauteur header dates
  },

  // ── CARTES RÉSERVATION ─────────────────────────────────────────────────
  card: {
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    minHeight: 48,           // Toujours < rowHeight - (2 × gutter)
    maxHeight: 48,
    shadowClass: 'shadow-sm',
    hoverShadowClass: 'shadow-md',
  },

  // ── COULEURS STATUTS ───────────────────────────────────────────────────
  status: {
    confirmed: {
      bg: '#ecfdf5',         // Emerald 50
      border: '#10b981',     // Emerald 500
      text: '#065f46',       // Emerald 900
    },
    pending: {
      bg: '#fef3c7',         // Amber 100
      border: '#f59e0b',     // Amber 500
      text: '#78350f',       // Amber 900
    },
    cancelled: {
      bg: '#fee2e2',         // Red 100
      border: '#ef4444',     // Red 500
      text: '#991b1b',       // Red 900
    },
    option: {
      bg: '#f3e8ff',         // Violet 100
      border: '#8b5cf6',     // Violet 500
      text: '#5b21b6',       // Violet 900
    },
    checkedIn: {
      bg: '#dbeafe',         // Blue 100
      border: '#3b82f6',     // Blue 500
      text: '#1e3a8a',       // Blue 900
    },
    checkedOut: {
      bg: '#f3f4f6',         // Gray 100
      border: '#9ca3af',     // Gray 400
      text: '#374151',       // Gray 700
    },
  },

  // ── TYPOGRAPHIE ────────────────────────────────────────────────────────
  typography: {
    // Menus et navigation (+20% vs actuel)
    menu: {
      size: 15,              // px (était 12.5)
      weight: 500,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    submenu: {
      size: 14,
      weight: 400,
      lineHeight: 1.5,
    },

    // Grille planning
    grid: {
      client: {
        size: 13,
        weight: 500,
        lineHeight: 1.3,
      },
      room: {
        size: 14,
        weight: 600,
        lineHeight: 1.2,
      },
      details: {
        size: 11,
        weight: 400,
        lineHeight: 1.3,
      },
      badge: {
        size: 10,
        weight: 600,
        lineHeight: 1,
      },
    },

    // Headers
    header: {
      h1: { size: 24, weight: 700 },
      h2: { size: 20, weight: 600 },
      h3: { size: 16, weight: 600 },
    },
  },

  // ── ESPACEMENTS ────────────────────────────────────────────────────────
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  // ── ANIMATIONS ─────────────────────────────────────────────────────────
  animation: {
    duration: {
      fast: 150,             // ms
      normal: 200,
      slow: 300,
    },
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Tailwind default
  },

  // ── Z-INDEX ────────────────────────────────────────────────────────────
  zIndex: {
    base: 1,
    card: 10,
    cardHover: 20,
    dropdown: 100,
    modal: 1000,
    tooltip: 2000,
  },
} as const;

// ── HELPERS TYPOGRAPHIQUES ────────────────────────────────────────────────

/**
 * Génère le style inline pour une typo donnée.
 */
export function getTypographyStyle(
  variant: keyof typeof PLANNING_DESIGN.typography
): React.CSSProperties {
  const config = PLANNING_DESIGN.typography[variant];
  if (!config || typeof config !== 'object') return {};

  return {
    fontSize: `${(config as any).size}px`,
    fontWeight: (config as any).weight,
    lineHeight: (config as any).lineHeight,
    letterSpacing: (config as any).letterSpacing,
  };
}

/**
 * Classe Tailwind pour une typo donnée (alternative au style inline).
 */
export function getTypographyClass(variant: 'client' | 'room' | 'details' | 'badge'): string {
  const sizeMap = {
    client: 'text-[13px]',
    room: 'text-[14px]',
    details: 'text-[11px]',
    badge: 'text-[10px]',
  };
  const weightMap = {
    client: 'font-medium',
    room: 'font-semibold',
    details: 'font-normal',
    badge: 'font-semibold',
  };

  return `${sizeMap[variant]} ${weightMap[variant]}`;
}

// ── HELPERS COULEURS ──────────────────────────────────────────────────────

export type ReservationStatus = 
  | 'confirmed' 
  | 'pending' 
  | 'cancelled' 
  | 'option' 
  | 'checkedIn' 
  | 'checkedOut';

/**
 * Retourne les couleurs pour un statut donné.
 */
export function getStatusColors(status: ReservationStatus) {
  return PLANNING_DESIGN.status[status];
}

/**
 * Génère le style inline pour une carte réservation selon son statut.
 */
export function getCardStyle(status: ReservationStatus): React.CSSProperties {
  const colors = getStatusColors(status);
  return {
    backgroundColor: colors.bg,
    borderLeftColor: colors.border,
    borderLeftWidth: `${PLANNING_DESIGN.card.borderLeftWidth}px`,
    borderRadius: `${PLANNING_DESIGN.card.borderRadius}px`,
    padding: `${PLANNING_DESIGN.card.padding}px`,
    height: `${PLANNING_DESIGN.card.minHeight}px`,
    overflow: 'hidden',
  };
}
