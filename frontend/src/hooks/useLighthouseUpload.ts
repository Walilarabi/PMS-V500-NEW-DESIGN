/**
 * useLighthouseUpload
 * 
 * Hook dédié au parsing du fichier Excel Lighthouse.
 * Utilise la librairie xlsx (déjà installée) pour lire le fichier
 * côté client, extraire les colonnes attendues et retourner
 * des LighthouseData[] prêts à l'emploi.
 * 
 * Format attendu :
 *   Ligne 5 = headers
 *   Col B = Jour
 *   Col C = Date
 *   Col D = Votre hôtel le plus bas
 *   Col E = Tarif le plus bas, médiane du compset
 *   Col F = Classement des tarifs du compset
 *   Col G = Demande du marché
 *   Col H = Booking.com Classement
 *   Col I = Jours fériés
 *   Col J = Événements
 */

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { LighthouseData } from '../../data/lighthouse-real-data';

export interface UploadStatus {
  state: 'idle' | 'parsing' | 'success' | 'error';
  fileName: string | null;
  importedAt: string | null;
  rowCount: number;
  errorMessage: string | null;
}

interface UseLighthouseUploadResult {
  uploadStatus: UploadStatus;
  handleFile: (file: File) => Promise<LighthouseData[]>;
  reset: () => void;
}

export function useLighthouseUpload(): UseLighthouseUploadResult {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    state: 'idle',
    fileName: null,
    importedAt: null,
    rowCount: 0,
    errorMessage: null,
  });

  const handleFile = useCallback(async (file: File): Promise<LighthouseData[]> => {
    setUploadStatus({
      state: 'parsing',
      fileName: file.name,
      importedAt: null,
      rowCount: 0,
      errorMessage: null,
    });

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

      // Lire la première feuille
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // Convertir en tableau de tableaux
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

      const results: LighthouseData[] = [];

      // Headers en ligne 5 (index 4), données à partir de ligne 6 (index 5)
      for (let i = 5; i < raw.length; i++) {
        const row = raw[i] as unknown[];
        if (!row || row.length < 3) continue;

        // Col B = index 1 (Jour), Col C = index 2 (Date)
        const dayName = row[1];
        const rawDate = row[2];

        if (!dayName || !rawDate) continue;

        // Parser la date (peut être un objet Date ou un serial Excel ou une string)
        let dateStr = '';
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString().slice(0, 10);
        } else if (typeof rawDate === 'number') {
          // Serial Excel → Date JS
          const d = XLSX.SSF.parse_date_code(rawDate);
          if (d) {
            const month = String(d.m).padStart(2, '0');
            const day = String(d.d).padStart(2, '0');
            dateStr = `${d.y}-${month}-${day}`;
          }
        } else if (typeof rawDate === 'string') {
          // "2026-05-17 00:00:00" ou "2026-05-17"
          dateStr = rawDate.slice(0, 10);
        }

        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

        const ourPrice = parseFloat(String(row[3] ?? '0')) || 0;
        const compsetMedian = parseFloat(String(row[4] ?? '0')) || 0;
        const marketDemand = parseFloat(String(row[6] ?? '0')) || 0;

        results.push({
          date: dateStr,
          dayName: String(dayName),
          ourPrice,
          compsetMedian,
          marketDemand,
          ranking: String(row[5] ?? ''),
          bookingRank: String(row[7] ?? ''),
          holidays: String(row[8] ?? ''),
          events: String(row[9] ?? ''),
        });
      }

      if (results.length === 0) {
        throw new Error('Aucune donnée valide trouvée. Vérifiez que le fichier est un export Lighthouse (format attendu : headers en ligne 5, données à partir de ligne 6).');
      }

      setUploadStatus({
        state: 'success',
        fileName: file.name,
        importedAt: new Date().toLocaleString('fr-FR'),
        rowCount: results.length,
        errorMessage: null,
      });

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue lors du parsing';
      setUploadStatus({
        state: 'error',
        fileName: file.name,
        importedAt: null,
        rowCount: 0,
        errorMessage: message,
      });
      return [];
    }
  }, []);

  const reset = useCallback(() => {
    setUploadStatus({
      state: 'idle',
      fileName: null,
      importedAt: null,
      rowCount: 0,
      errorMessage: null,
    });
  }, []);

  return { uploadStatus, handleFile, reset };
}
