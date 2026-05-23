/**
 * FLOWTYM RMS — Modale d'import d'événements (Excel / CSV / API / Lighthouse).
 *
 * Centralise l'import (initialement présent dans Veille Concurrentielle).
 * Détecte les doublons, ne supprime jamais l'historique, ne met à jour que
 * les événements futurs.
 */
import React, { useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, Database, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { parseSalonsExcel } from '@/src/services/salons-parser.service';
import { useEventsStore } from '@/src/store/eventsStore';
import type { RMSMarketEvent } from '@/src/types/events';
import { scoreToLevel } from '@/src/services/event-impact.engine';

type ImportSource = 'excel' | 'csv' | 'api' | 'lighthouse';

interface EventImportModalProps {
  open: boolean;
  onClose: () => void;
}

const SOURCES: { id: ImportSource; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'excel', label: 'Excel', desc: 'Dates Salons multi-feuilles', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV', desc: 'Format simple ; séparateur virgule', icon: FileSpreadsheet },
  { id: 'lighthouse', label: 'Lighthouse', desc: 'Import événements depuis l\'export', icon: Sparkles },
  { id: 'api', label: 'API externe', desc: 'JSON / iCal / Webhooks', icon: Database },
];

export const EventImportModal: React.FC<EventImportModalProps> = ({ open, onClose }) => {
  const { bulkUpsert } = useEventsStore();
  const [active, setActive] = useState<ImportSource>('excel');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleExcel(file: File) {
    setLoading(true);
    setFeedback(null);
    try {
      const buf = await file.arrayBuffer();
      const result = parseSalonsExcel(buf, file.name);
      const events: RMSMarketEvent[] = result.events.map((e) => {
        const impact = {
          demand: 10, adr: 8, occupancy: 6, pickup: 9, revpar: 9,
          compression: 40, confidence: 75,
          level: 'medium' as const,
        };
        const lvl = scoreToLevel(40);
        return {
          id: `evt_imp_${e.startDate}_${e.name}`.replace(/\W+/g, '_').toLowerCase(),
          name: e.name,
          category: 'salon',
          status: 'active',
          city: e.location || 'Paris',
          country: 'FR',
          startDate: e.startDate,
          endDate: e.endDate,
          impact: { ...impact, level: lvl },
          influencePrice: 6,
          sources: ['import_excel'],
          primarySource: file.name,
          rmsSynced: false,
          history: [{ at: new Date().toISOString(), action: 'imported' as const, source: file.name }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      const stats = bulkUpsert(events);
      setFeedback({
        ok: true,
        msg: `${stats.added} ajoutés · ${stats.updated} mis à jour · ${stats.duplicates} doublons fusionnés · ${result.warnings.length} avertissements`,
      });
    } catch (e) {
      setFeedback({ ok: false, msg: `Erreur import : ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[640px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Importer des événements</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Fusion intelligente — l'historique n'est jamais supprimé.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-2 px-6 pt-5">
          {SOURCES.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === active;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  'text-left rounded-xl ring-1 px-3 py-3 transition-all',
                  isActive
                    ? 'ring-violet-300 bg-violet-50/60 shadow-sm'
                    : 'ring-slate-200 bg-white hover:ring-slate-300',
                )}
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', isActive ? 'bg-violet-600 text-white' : 'bg-slate-50 text-slate-500')}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-[13px] font-semibold text-slate-900">{s.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{s.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {active === 'excel' && (
            <DropZone
              accept=".xlsx,.xls"
              loading={loading}
              hint="Glissez votre fichier Dates Salons ou utilisez le bouton ci-dessous."
              onSelect={handleExcel}
              fileRef={fileRef}
            />
          )}
          {active === 'csv' && (
            <DropZone
              accept=".csv"
              loading={loading}
              hint="Fichier CSV — colonnes : Nom, Début, Fin, Ville, Catégorie."
              onSelect={(file) => handleExcel(file)}
              fileRef={fileRef}
            />
          )}
          {active === 'lighthouse' && (
            <DropZone
              accept=".xlsx"
              loading={loading}
              hint="Export Lighthouse — la feuille 'Événements' sera extraite."
              onSelect={handleExcel}
              fileRef={fileRef}
            />
          )}
          {active === 'api' && (
            <div className="rounded-xl ring-1 ring-slate-200 px-4 py-5 text-[12.5px] text-slate-600 bg-slate-50/40">
              Connectez votre source API/Webhook depuis <strong>Paramètres → Connecteurs</strong>.
              Le moteur synchronisera ensuite les événements automatiquement selon la fréquence définie.
            </div>
          )}

          {feedback && (
            <div className={cn(
              'mt-4 flex items-start gap-2 text-[12.5px] rounded-xl px-3 py-2.5 ring-1',
              feedback.ok
                ? 'bg-emerald-50 ring-emerald-100 text-emerald-700'
                : 'bg-rose-50 ring-rose-100 text-rose-700',
            )}>
              {feedback.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
              <span>{feedback.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function DropZone({
  accept,
  loading,
  hint,
  onSelect,
  fileRef,
}: {
  accept: string;
  loading: boolean;
  hint: string;
  onSelect: (file: File) => void;
  fileRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div
      onClick={() => fileRef.current?.click()}
      className={cn(
        'rounded-xl ring-1 ring-dashed ring-slate-300 hover:ring-violet-400 hover:bg-violet-50/30 transition-all',
        'px-5 py-8 text-center cursor-pointer',
        loading && 'opacity-60 cursor-wait',
      )}
    >
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
      <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3 ring-1 ring-violet-100">
        <Upload className="w-5 h-5" />
      </div>
      <div className="text-[13px] font-semibold text-slate-900">Cliquer pour sélectionner un fichier</div>
      <div className="text-[12px] text-slate-500 mt-1">{hint}</div>
    </div>
  );
}
