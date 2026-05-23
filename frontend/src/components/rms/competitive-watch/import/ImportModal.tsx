/**
 * FLOWTYM — Modal d'import pour la Veille Concurrentielle
 *
 * Orchestre l'expérience d'import : sélection fichier, parsing via provider,
 * aperçu (preview + erreurs + impact RMS), commit final ou rollback.
 *
 * Toute la logique métier est dans le provider passé en prop : ce composant
 * ne sait ni lire un fichier Excel, ni écrire dans un store Zustand.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type {
  ImportPreview,
  ImportResult,
  ImportSourceMeta,
  MarketDataProvider,
} from '@/src/services/import/marketDataProvider';
import { formatBytes } from '@/src/services/import/importValidator';

type ModalPhase = 'pick' | 'parsing' | 'preview' | 'committing' | 'done' | 'error';

interface ImportModalProps {
  open: boolean;
  source: ImportSourceMeta | null;
  provider: MarketDataProvider | null;
  onClose: () => void;
  onCommitted?: (result: ImportResult) => void;
  /** Pour revenir au sélecteur de source depuis la modal */
  onBack?: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  open,
  source,
  provider,
  onClose,
  onCommitted,
  onBack,
}) => {
  const [phase, setPhase] = useState<ModalPhase>('pick');
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPhase('pick');
    setProgress(0);
    setFile(null);
    setPreview(null);
    setPayload(null);
    setResult(null);
    setFatalError(null);
  }, []);

  // Reset à chaque réouverture / changement de source
  React.useEffect(() => {
    if (open) reset();
  }, [open, source?.id, reset]);

  const startParse = useCallback(
    async (chosen: File) => {
      if (!provider) return;
      setFile(chosen);
      setPhase('parsing');
      setProgress(5);
      setFatalError(null);

      try {
        const outcome = await provider.parse(chosen, (pct) =>
          setProgress((p) => Math.max(p, pct))
        );
        setPreview(outcome.preview);
        setPayload(outcome.payload);
        if (outcome.preview.errors.length > 0) {
          setPhase('error');
        } else {
          setPhase('preview');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inattendue';
        setFatalError(msg);
        setPhase('error');
      }
    },
    [provider]
  );

  const handleFile = useCallback(
    (chosen: File | null) => {
      if (chosen) void startParse(chosen);
    },
    [startParse]
  );

  const commit = useCallback(async () => {
    if (!provider || !preview || !file || !payload) return;
    setPhase('committing');
    try {
      const res = await provider.commit(payload, {
        fileName: file.name,
        fileSize: file.size,
      });
      setResult(res);
      setPhase('done');
      onCommitted?.(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'import';
      setFatalError(msg);
      setPhase('error');
    }
  }, [provider, preview, file, payload, onCommitted]);

  const onPick = useCallback(() => inputRef.current?.click(), []);

  const acceptStr = source?.acceptedMime ?? '';

  return (
    <AnimatePresence>
      {open && source && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[min(720px,95vw)] max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <Header
              source={source}
              phase={phase}
              fileName={file?.name}
              onBack={onBack}
              onClose={onClose}
            />

            <div className="flex-1 overflow-y-auto bg-slate-50/40 p-5">
              <input
                ref={inputRef}
                type="file"
                accept={acceptStr}
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />

              {phase === 'pick' && (
                <DropZone
                  source={source}
                  isDragOver={isDragOver}
                  onClick={onPick}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              )}

              {phase === 'parsing' && (
                <ParsingState progress={progress} fileName={file?.name ?? ''} />
              )}

              {phase === 'preview' && preview && (
                <PreviewState preview={preview} source={source} />
              )}

              {phase === 'committing' && (
                <ParsingState
                  progress={92}
                  fileName={file?.name ?? ''}
                  message="Synchronisation dans le RMS…"
                />
              )}

              {phase === 'done' && result && (
                <DoneState result={result} source={source} />
              )}

              {phase === 'error' && (
                <ErrorState
                  fatalError={fatalError}
                  preview={preview}
                  fileName={file?.name ?? null}
                  onRetry={() => {
                    if (file) startParse(file);
                  }}
                />
              )}
            </div>

            <Footer
              phase={phase}
              hasErrors={
                (preview?.errors.length ?? 0) > 0 || fatalError !== null
              }
              onClose={onClose}
              onChangeFile={onPick}
              onCancel={reset}
              onConfirm={commit}
              previewValid={preview?.validRows ?? 0}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImportModal;

/* ────────────────────────────────────────────────────────────────────────── */
/* HEADER                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const Header: React.FC<{
  source: ImportSourceMeta;
  phase: ModalPhase;
  fileName?: string;
  onBack?: () => void;
  onClose: () => void;
}> = ({ source, phase, fileName, onBack, onClose }) => (
  <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
    <div className="flex items-start gap-3">
      {onBack && phase === 'pick' && (
        <button
          onClick={onBack}
          className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          aria-label="Retour au sélecteur"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md',
          source.icon === 'lighthouse'
            ? 'bg-gradient-to-br from-violet-500 to-violet-700 shadow-violet-500/30'
            : source.icon === 'expedia'
              ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30'
              : 'bg-gradient-to-br from-sky-500 to-sky-600 shadow-sky-500/30'
        )}
      >
        <Upload className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold text-slate-900">
          Importer depuis {source.label}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">
          {fileName ? fileName : source.description}
        </p>
      </div>
    </div>
    <button
      onClick={onClose}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      aria-label="Fermer"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* DROPZONE                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const DropZone: React.FC<{
  source: ImportSourceMeta;
  isDragOver: boolean;
  onClick: () => void;
  onDragOver: React.DragEventHandler;
  onDragLeave: React.DragEventHandler;
  onDrop: React.DragEventHandler;
}> = ({ source, isDragOver, onClick, onDragOver, onDragLeave, onDrop }) => (
  <div className="space-y-4">
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition',
        isDragOver
          ? 'border-violet-400 bg-violet-50/60'
          : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
        <Upload className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-slate-900">
          Glissez votre fichier ici ou cliquez pour parcourir
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          Formats acceptés : {source.acceptedFormats.join(', ')}
        </p>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:shadow-lg"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Sélectionner un fichier
      </button>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Données mises à jour côté RMS
      </p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {source.rmsTargets.map((t) => (
          <li
            key={t}
            className="flex items-start gap-1.5 text-[12px] text-slate-600"
          >
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* PARSING                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const ParsingState: React.FC<{
  progress: number;
  fileName: string;
  message?: string;
}> = ({ progress, fileName, message }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6">
    <div className="flex items-center gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {message ?? 'Lecture et validation du fichier…'}
        </p>
        <p className="text-[12px] text-slate-500">{fileName}</p>
      </div>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
      <motion.div
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600"
      />
    </div>
    <div className="mt-2 text-right text-[11px] tabular-nums text-slate-500">
      {progress}%
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* PREVIEW                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const Stat: React.FC<{
  label: string;
  value: string | number;
  tone?: 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';
}> = ({ label, value, tone = 'slate' }) => (
  <div
    className={cn(
      'rounded-xl border p-3',
      tone === 'emerald' && 'border-emerald-200 bg-emerald-50/60',
      tone === 'amber' && 'border-amber-200 bg-amber-50/60',
      tone === 'rose' && 'border-rose-200 bg-rose-50/60',
      tone === 'violet' && 'border-violet-200 bg-violet-50/60',
      tone === 'slate' && 'border-slate-200 bg-white'
    )}
  >
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {label}
    </div>
    <div
      className={cn(
        'mt-1 text-xl font-bold tabular-nums',
        tone === 'emerald' && 'text-emerald-700',
        tone === 'amber' && 'text-amber-700',
        tone === 'rose' && 'text-rose-700',
        tone === 'violet' && 'text-violet-700',
        tone === 'slate' && 'text-slate-900'
      )}
    >
      {value}
    </div>
  </div>
);

const PreviewState: React.FC<{
  preview: ImportPreview;
  source: ImportSourceMeta;
}> = ({ preview, source }) => {
  const sampleColumns = useMemo(() => {
    if (preview.samples.length === 0) return preview.columns;
    return Object.keys(preview.samples[0].cells);
  }, [preview.samples, preview.columns]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Lignes" value={preview.totalRows} />
        <Stat label="À importer" value={preview.validRows} tone="emerald" />
        <Stat label="Ignorées" value={preview.ignoredRows} tone="slate" />
        <Stat
          label="Anomalies"
          value={
            preview.duplicates +
            preview.inconsistencies +
            preview.outliers
          }
          tone={
            preview.duplicates + preview.inconsistencies + preview.outliers > 0
              ? 'amber'
              : 'slate'
          }
        />
      </div>

      {/* Anomalies détail */}
      {(preview.duplicates > 0 ||
        preview.inconsistencies > 0 ||
        preview.outliers > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Vérifications automatiques
              </p>
              <ul className="mt-1 space-y-0.5 text-[12px] text-amber-900/80">
                {preview.duplicates > 0 && (
                  <li>• {preview.duplicates} doublon(s) détecté(s)</li>
                )}
                {preview.inconsistencies > 0 && (
                  <li>
                    • {preview.inconsistencies} plage(s) de dates incohérente(s)
                  </li>
                )}
                {preview.outliers > 0 && (
                  <li>
                    • {preview.outliers} valeur(s) potentiellement aberrante(s)
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warnings non bloquants */}
      {preview.warnings.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-sky-600" />
            <div>
              <p className="text-sm font-semibold text-sky-900">
                Avertissements ({preview.warnings.length})
              </p>
              <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto text-[12px] text-sky-900/80">
                {preview.warnings.slice(0, 6).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
                {preview.warnings.length > 6 && (
                  <li>… +{preview.warnings.length - 6} autres</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Sample table */}
      {preview.samples.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Aperçu (5 premières lignes)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {sampleColumns.map((c) => (
                    <th
                      key={c}
                      className="whitespace-nowrap px-3 py-2 text-left font-semibold"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.samples.map((row, i) => (
                  <tr key={i} className="text-slate-700">
                    {sampleColumns.map((c) => (
                      <td
                        key={c}
                        className="whitespace-nowrap px-3 py-2 tabular-nums"
                      >
                        {row.cells[c] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Impact RMS */}
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-3">
        <div className="flex items-start gap-2">
          <Zap className="mt-0.5 h-4 w-4 text-violet-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-violet-900">
              Impact sur le RMS — {source.label}
            </p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-violet-900/80">
              {preview.rmsImpact.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* DONE                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

const DoneState: React.FC<{ result: ImportResult; source: ImportSourceMeta }> = ({
  result,
  source,
}) => {
  const isPartial = result.status === 'partial';
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-start gap-3 rounded-2xl border p-4',
          isPartial
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-emerald-200 bg-emerald-50/60'
        )}
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl text-white',
            isPartial ? 'bg-amber-500' : 'bg-emerald-500'
          )}
        >
          {isPartial ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-semibold',
              isPartial ? 'text-amber-900' : 'text-emerald-900'
            )}
          >
            {isPartial
              ? 'Import terminé avec avertissements'
              : 'Import réussi — RMS synchronisé'}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-600">
            {result.importedRows} ligne(s) importée(s) depuis {result.fileName} (
            {formatBytes(result.fileSize)}).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Importées" value={result.importedRows} tone="emerald" />
        <Stat label="Ignorées" value={result.ignoredRows} tone="slate" />
        <Stat
          label="Warnings"
          value={result.warnings.length}
          tone={result.warnings.length > 0 ? 'amber' : 'slate'}
        />
        <Stat label="Erreurs" value={result.errors.length} tone="slate" />
      </div>

      {result.rollbackToken && (
        <p className="text-center text-[11px] text-slate-500">
          Un rollback est disponible dans l'historique des imports.
        </p>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* ERROR                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const ErrorState: React.FC<{
  fatalError: string | null;
  preview: ImportPreview | null;
  fileName: string | null;
  onRetry: () => void;
}> = ({ fatalError, preview, fileName, onRetry }) => {
  const errors = fatalError
    ? [fatalError]
    : preview?.errors ?? ['Erreur d\'import non identifiée.'];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-900">
              Import impossible
            </p>
            <p className="mt-0.5 text-[12px] text-rose-900/80">
              {fileName ?? 'Fichier non identifié'}
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-rose-900/90">
              {errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {fileName && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Réessayer
        </button>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* FOOTER                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const Footer: React.FC<{
  phase: ModalPhase;
  hasErrors: boolean;
  onClose: () => void;
  onChangeFile: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  previewValid: number;
}> = ({ phase, hasErrors, onClose, onChangeFile, onCancel, onConfirm, previewValid }) => {
  const isBusy = phase === 'parsing' || phase === 'committing';
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3">
      {phase === 'preview' || phase === 'error' ? (
        <button
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Recommencer
        </button>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2">
        {phase === 'preview' && (
          <button
            onClick={onChangeFile}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Changer de fichier
          </button>
        )}

        {phase === 'done' || phase === 'error' || phase === 'pick' ? (
          <button
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
        ) : (
          <button
            onClick={onClose}
            disabled={isBusy}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50',
              isBusy && 'opacity-60'
            )}
          >
            Annuler
          </button>
        )}

        {phase === 'preview' && (
          <button
            onClick={onConfirm}
            disabled={hasErrors || previewValid === 0}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-white shadow-md transition',
              hasErrors || previewValid === 0
                ? 'cursor-not-allowed bg-slate-300 shadow-none'
                : 'bg-gradient-to-br from-violet-500 to-violet-700 shadow-violet-500/30 hover:shadow-lg'
            )}
          >
            <Zap className="h-4 w-4" />
            Importer {previewValid} ligne{previewValid > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
};
