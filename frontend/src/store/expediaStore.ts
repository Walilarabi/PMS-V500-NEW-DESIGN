/**
 * FLOWTYM — Expedia Store (Zustand)
 *
 * Stockage Zustand persisté (localStorage) des données Expedia importées.
 * Consommé par RMSTableauPro pour enrichir le calcul de pression marché.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExpediaImport, ExpediaDayData } from '../services/expedia-parser.service';
import { getExpediaDataForDate } from '../services/expedia-parser.service';

interface ExpediaStore {
  importData: ExpediaImport | null;
  uploadStatus: 'idle' | 'parsing' | 'success' | 'error';
  uploadError: string | null;

  setImportData: (data: ExpediaImport) => void;
  setUploadStatus: (status: 'idle' | 'parsing' | 'success' | 'error', error?: string) => void;
  clearImport: () => void;

  getDataForDate: (date: string) => ExpediaDayData | null;
  hasData: () => boolean;
}

export const useExpediaStore = create<ExpediaStore>()(
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

      getDataForDate: (date) => {
        const data = get().importData;
        if (!data) return null;
        return getExpediaDataForDate(data, date);
      },

      hasData: () => {
        const d = get().importData;
        return d !== null && d.days.length > 0;
      },
    }),
    {
      name: 'flowtym_expedia_import',
      partialize: (state) => ({ importData: state.importData }),
    }
  )
);
