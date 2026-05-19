/**
 * FLOWTYM — LighthouseFileBanner
 *
 * Bandeau "Fichier Lighthouse actif" compact et repliable.
 * Affiche par défaut un résumé sur une seule ligne. Au clic → expand avec détails complets.
 *
 * Remplace le gros bandeau qui prenait trop de place dans la veille concurrentielle.
 */

import { useState } from 'react';
import {
  CheckCircle2, FileSpreadsheet, X, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export interface LighthouseFileBannerProps {
  fileName: string;
  importedAt: string;          // ISO timestamp
  daysCount: number;
  competitorsCount: number;
  warnings: string[];
  onClear: () => void;
}

export function LighthouseFileBanner({
  fileName, importedAt, daysCount, competitorsCount, warnings, onClear,
}: LighthouseFileBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const importedDate = new Date(importedAt);
  const dateShort = importedDate.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
  const dateFull = importedDate.toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── Vue compacte (par défaut) ─────────────────────────────────────────
  return (
    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg overflow-hidden">
      {/* Header compact : une seule ligne */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-emerald-100/50 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
        }
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />

        <span className="text-sm font-semibold text-emerald-900 truncate flex items-center gap-1.5">
          <FileSpreadsheet className="w-3 h-3" />
          {fileName}
        </span>

        <span className="text-xs text-emerald-700">
          · {dateShort}
        </span>

        <span className="text-xs text-emerald-700">
          · <span className="font-semibold">{daysCount}</span> jours
        </span>

        <span className="text-xs text-emerald-700">
          · <span className="font-semibold">{competitorsCount}</span> concurrents
        </span>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 uppercase tracking-wide">
          Actif
        </span>

        {warnings.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {warnings.length} alerte{warnings.length > 1 ? 's' : ''}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-emerald-500 hover:text-emerald-800 p-0.5 rounded hover:bg-emerald-200 transition-colors cursor-pointer"
            title="Retirer l'import"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>

      {/* ─── Vue détaillée (au clic) ───────────────────────────────── */}
      {expanded && (
        <div className="px-4 py-3 border-t border-emerald-200 bg-white/50 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Fichier complet</p>
            <p className="text-sm font-medium text-gray-900 flex items-center gap-1 mt-0.5">
              <FileSpreadsheet className="w-3 h-3" />
              {fileName}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Importé le</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{dateFull}</p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Couverture</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              <span className="font-bold">{daysCount}</span> jours analysés
            </p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Compset</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              <span className="font-bold">{competitorsCount}</span> hôtels concurrents
            </p>
          </div>

          {warnings.length > 0 && (
            <div className="md:col-span-4 mt-2 pt-2 border-t border-amber-200 bg-amber-50/50 -mx-4 -mb-3 px-4 py-2">
              <p className="text-[10px] text-amber-700 uppercase tracking-wide font-semibold flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3" />
                Avertissements lors de l'import
              </p>
              <ul className="text-xs text-amber-900 space-y-0.5 list-disc list-inside">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
