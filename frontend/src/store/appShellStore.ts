/**
 * FLOWTYM — État UI de la coquille applicative (app shell).
 *
 * Contient UNIQUEMENT l'état de la sidebar de navigation principale (repliée ou
 * non). Persisté en localStorage afin de conserver la préférence de l'utilisateur
 * entre les sessions. Aucune donnée PMS.
 *
 * Ce store est partagé entre App.tsx (qui rend la Sidebar) et les pages qui
 * exposent un bouton « replier la navigation » — par ex. le bouton Collapse en
 * haut à droite du Planning. Cela évite de remonter l'état via des props ou des
 * CustomEvents, et garantit qu'un seul interrupteur pilote la sidebar gauche.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppShellStore {
  /** Sidebar de navigation principale repliée en mode icônes. */
  navCollapsed: boolean;
  toggleNav: () => void;
  setNavCollapsed: (v: boolean) => void;
}

export const useAppShellStore = create<AppShellStore>()(
  persist(
    (set) => ({
      navCollapsed: false,
      toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
      setNavCollapsed: (v) => set({ navCollapsed: v }),
    }),
    { name: 'flowtym_app_shell' },
  ),
);
