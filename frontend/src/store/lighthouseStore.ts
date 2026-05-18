/**
 * FLOWTYM — Lighthouse Store (Zustand)
 *
 * Store global qui centralise les données Lighthouse importées :
 *   - Veille concurrentielle les affiche
 *   - Tableau RMS les consomme pour alimenter ses colonnes
 *   - Modal détail par date les utilise
 *
 * Persistance : localStorage (clé "flowtym_lighthouse_import")
 * — survit aux refresh de page tant que l'utilisateur n'a pas reset.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LighthouseImport, LighthouseDayData } from '../services/lighthouse-parser.service';

interface LighthouseStore {
  // État
  importData: LighthouseImport | null;
  uploadStatus: 'idle' | 'parsing' | 'success' | 'error';
  uploadError: string | null;

  // Actions
  setImportData: (data: LighthouseImport) => void;
  setUploadStatus: (status: 'idle' | 'parsing' | 'success' | 'error', error?: string) => void;
  clearImport: () => void;

  // Sélecteurs
  getDayData: (date: string) => LighthouseDayData | null;
  getCompetitorNames: () => string[];
  getOurHotelName: () => string;
  hasData: () => boolean;
}

export const useLighthouseStore = create<LighthouseStore>()(
  persist(
    (set, get) => ({
      importData: null,
      uploadStatus: 'idle',
      uploadError: null,

      setImportData: (data) => set({
        importData: data,
        uploadStatus: 'success',
        uploadError: null,
      }),

      setUploadStatus: (status, error) => set({
        uploadStatus: status,
        uploadError: error ?? null,
      }),

      clearImport: () => set({
        importData: null,
        uploadStatus: 'idle',
        uploadError: null,
      }),

      getDayData: (date) => {
        const data = get().importData;
        if (!data) return null;
        return data.days.find(d => d.date === date) ?? null;
      },

      getCompetitorNames: () => {
        return get().importData?.competitorNames ?? [];
      },

      getOurHotelName: () => {
        return get().importData?.ourHotelName ?? 'Folkestone Opéra';
      },

      hasData: () => {
        const d = get().importData;
        return d !== null && d.days.length > 0;
      },
    }),
    {
      name: 'flowtym_lighthouse_import',
      // On ne persiste que la donnée importée (pas les états transitoires)
      partialize: (state) => ({ importData: state.importData }),
    }
  )
);
