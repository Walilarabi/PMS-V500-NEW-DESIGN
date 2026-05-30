/**
 * FLOWTYM — État UI du planning (préférences d'affichage).
 *
 * Stocke UNIQUEMENT des préférences d'interface (collapse des sidebars, mode
 * d'affichage actif) — aucune donnée PMS. Persisté en localStorage pour
 * survivre aux sessions, conformément à la règle « aucune donnée PMS en
 * localStorage » (ici ce ne sont que des préférences cosmétiques).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Modes d'affichage du planning (Phase 7). */
export type PlanningMode = 'occupation' | 'revenue' | 'housekeeping' | 'groupe' | 'maintenance';

interface PlanningUiStore {
  /** Colonne gauche (labels chambres) repliée en mode icônes. */
  leftSidebarCollapsed: boolean;
  /** Sidebar droite (intelligence RMS) repliée. */
  rightSidebarCollapsed: boolean;
  /** Mode d'affichage actif. */
  activeMode: PlanningMode;

  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarCollapsed: (v: boolean) => void;
  setRightSidebarCollapsed: (v: boolean) => void;
  setActiveMode: (mode: PlanningMode) => void;
}

export const usePlanningUiStore = create<PlanningUiStore>()(
  persist(
    (set) => ({
      leftSidebarCollapsed: false,
      rightSidebarCollapsed: true,
      activeMode: 'occupation',

      toggleLeftSidebar: () => set((s) => ({ leftSidebarCollapsed: !s.leftSidebarCollapsed })),
      toggleRightSidebar: () => set((s) => ({ rightSidebarCollapsed: !s.rightSidebarCollapsed })),
      setLeftSidebarCollapsed: (v) => set({ leftSidebarCollapsed: v }),
      setRightSidebarCollapsed: (v) => set({ rightSidebarCollapsed: v }),
      setActiveMode: (mode) => set({ activeMode: mode }),
    }),
    {
      name: 'flowtym_planning_ui',
      partialize: (state) => ({
        leftSidebarCollapsed: state.leftSidebarCollapsed,
        rightSidebarCollapsed: state.rightSidebarCollapsed,
        activeMode: state.activeMode,
      }),
    },
  ),
);
