/**
 * FLOWTYM DESIGN SYSTEM — COLORS
 * 
 * Palette cohérente et premium pour PMS hôtelier.
 * Objectif : contrastes maîtrisés, hiérarchie visuelle, accessibilité WCAG AA.
 */

export const colors = {
  // ─── BRAND ────────────────────────────────────────────────────────────────
  brand: {
    primary: '#8B5CF6',      // Violet principal
    primaryHover: '#7C3AED',
    primaryLight: '#A78BFA',
    primaryDark: '#6D28D9',
  },

  // ─── NEUTRALS ─────────────────────────────────────────────────────────────
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // ─── STATUS COLORS ────────────────────────────────────────────────────────
  status: {
    // Réservation confirmée
    confirmed: {
      bg: '#ECFDF5',
      text: '#047857',
      border: '#A7F3D0',
      dot: '#10B981',
    },
    // Check-in effectué
    checkedIn: {
      bg: '#EFF6FF',
      text: '#1E40AF',
      border: '#BFDBFE',
      dot: '#3B82F6',
    },
    // Option/hold
    hold: {
      bg: '#FEF3C7',
      text: '#92400E',
      border: '#FDE68A',
      dot: '#F59E0B',
    },
    // Annulée
    cancelled: {
      bg: '#FEE2E2',
      text: '#991B1B',
      border: '#FECACA',
      dot: '#EF4444',
    },
    // En attente paiement
    pending: {
      bg: '#FEF3C7',
      text: '#92400E',
      border: '#FDE68A',
      dot: '#F59E0B',
    },
  },

  // ─── SEMANTIC COLORS ──────────────────────────────────────────────────────
  success: {
    50: '#ECFDF5',
    500: '#10B981',
    700: '#047857',
  },
  warning: {
    50: '#FFFBEB',
    500: '#F59E0B',
    700: '#B45309',
  },
  error: {
    50: '#FEF2F2',
    500: '#EF4444',
    700: '#B91C1C',
  },
  info: {
    50: '#EFF6FF',
    500: '#3B82F6',
    700: '#1D4ED8',
  },

  // ─── BACKGROUNDS ──────────────────────────────────────────────────────────
  bg: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    hover: '#F3F4F6',
    active: '#E5E7EB',
  },

  // ─── BORDERS ──────────────────────────────────────────────────────────────
  border: {
    light: '#F3F4F6',
    default: '#E5E7EB',
    strong: '#D1D5DB',
  },

  // ─── CHANNEL COLORS (OTA, Direct, etc.) ───────────────────────────────────
  channel: {
    booking: '#003580',
    airbnb: '#FF5A5F',
    expedia: '#FFCB05',
    direct: '#8B5CF6',
    agoda: '#E74C3C',
    tripadvisor: '#34E0A1',
    default: '#6B7280',
  },
} as const;

/**
 * Utilitaires pour générer des classes Tailwind dynamiques.
 */
export const colorClasses = {
  status: {
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    checkedIn: 'bg-blue-50 text-blue-700 border-blue-200',
    hold: 'bg-amber-50 text-amber-800 border-amber-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  channelDot: {
    booking: 'bg-[#003580]',
    airbnb: 'bg-[#FF5A5F]',
    expedia: 'bg-[#FFCB05]',
    direct: 'bg-[#8B5CF6]',
    agoda: 'bg-[#E74C3C]',
    tripadvisor: 'bg-[#34E0A1]',
    default: 'bg-gray-400',
  },
} as const;
