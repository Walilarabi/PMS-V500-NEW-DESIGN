/**
 * FLOWTYM — État UI du planning (préférences d'affichage + filtres).
 *
 * Stocke UNIQUEMENT des préférences d'interface (collapse des sidebars, mode
 * d'affichage actif) et les valeurs de filtres sélectionnées — aucune donnée
 * PMS. Les modes d'affichage et les filtres vivent ici pour être partagés entre
 * la sidebar principale (qui les présente, maquette) et la vue Planning (qui les
 * applique), sans dupliquer la logique ni créer un second volet latéral.
 *
 * Persisté en localStorage UNIQUEMENT pour les préférences cosmétiques (collapse
 * + mode actif). Les valeurs de filtres restent en mémoire (réinitialisées à
 * chaque session) pour éviter un filtrage « fantôme » au rechargement.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Modes d'affichage du planning (Phase 7). */
export type PlanningMode = 'occupation' | 'revenue' | 'housekeeping' | 'groupe' | 'maintenance';

interface PlanningUiStore {
  /** Colonne gauche (labels chambres) repliée en mode icônes. */
  leftSidebarCollapsed: boolean;
  /** Sidebar droite (intelligence RMS + opérationnel) repliée. */
  rightSidebarCollapsed: boolean;
  /** Mode d'affichage actif. */
  activeMode: PlanningMode;

  /** Filtre étage sélectionné ('Tous' ou numéro d'étage en chaîne). */
  floorFilter: string;
  /** Filtre type/catégorie sélectionné ('Tous Types' ou valeur). */
  typeFilter: string;
  /** Filtre statut sélectionné ('Tous Statuts' ou valeur). */
  statusFilter: string;

  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarCollapsed: (v: boolean) => void;
  setRightSidebarCollapsed: (v: boolean) => void;
  setActiveMode: (mode: PlanningMode) => void;
  setFloorFilter: (v: string) => void;
  setTypeFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
}

export const usePlanningUiStore = create<PlanningUiStore>()(
  persist(
    (set) => ({
      leftSidebarCollapsed: false,
      rightSidebarCollapsed: false,
      activeMode: 'occupation',
      floorFilter: 'Tous',
      typeFilter: 'Tous Types',
      statusFilter: 'Tous Statuts',

      toggleLeftSidebar: () => set((s) => ({ leftSidebarCollapsed: !s.leftSidebarCollapsed })),
      toggleRightSidebar: () => set((s) => ({ rightSidebarCollapsed: !s.rightSidebarCollapsed })),
      setLeftSidebarCollapsed: (v) => set({ leftSidebarCollapsed: v }),
      setRightSidebarCollapsed: (v) => set({ rightSidebarCollapsed: v }),
      setActiveMode: (mode) => set({ activeMode: mode }),
      setFloorFilter: (v) => set({ floorFilter: v }),
      setTypeFilter: (v) => set({ typeFilter: v }),
      setStatusFilter: (v) => set({ statusFilter: v }),
    }),
    {
      name: 'flowtym_planning_ui',
      // Seules les préférences cosmétiques sont persistées (pas les filtres).
      partialize: (state) => ({
        leftSidebarCollapsed: state.leftSidebarCollapsed,
        rightSidebarCollapsed: state.rightSidebarCollapsed,
        activeMode: state.activeMode,
      }),
    },
  ),
);
