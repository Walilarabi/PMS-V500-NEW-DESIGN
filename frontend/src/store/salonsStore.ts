/**
 * FLOWTYM — Salons Store
 *
 * Stockage Zustand persisté (localStorage) des événements salons importés.
 * Consommé par RMSTableauPro pour alimenter la colonne "Événement".
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SalonImport, SalonEvent } from '../services/salons-parser.service';
import { getEventsForDate } from '../services/salons-parser.service';

interface SalonsStore {
  importData: SalonImport | null;
  uploadStatus: 'idle' | 'parsing' | 'success' | 'error';
  uploadError: string | null;

  setImportData: (data: SalonImport) => void;
  setUploadStatus: (status: 'idle' | 'parsing' | 'success' | 'error', error?: string) => void;
  clearImport: () => void;

  getEventsForDate: (date: string) => SalonEvent[];
  hasData: () => boolean;
}

export const useSalonsStore = create<SalonsStore>()(
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

      getEventsForDate: (date) => {
        const data = get().importData;
        if (!data) return [];
        return getEventsForDate(data.events, date);
      },

      hasData: () => {
        const d = get().importData;
        return d !== null && d.events.length > 0;
      },
    }),
    {
      name: 'flowtym_salons_import',
      partialize: (state) => ({ importData: state.importData }),
    }
  )
);
