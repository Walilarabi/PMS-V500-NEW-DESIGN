/**
 * FLOWTYM — Sélecteur de source d'import
 *
 * Affiché en dropdown sous le bouton « Importer ». Présente Lighthouse,
 * Expedia, Événements et la future API Lighthouse. Ne fait que router le
 * choix vers le parent — toute logique d'import est dans les providers.
 */

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, FileSpreadsheet, Sparkles, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ImportSourceMeta } from '@/src/services/import/marketDataProvider';

interface ImportSourceSelectorProps {
  sources: ImportSourceMeta[];
  onSelect: (source: ImportSourceMeta) => void;
}

const ICON_BY_KIND: Record<ImportSourceMeta['icon'], LucideIcon> = {
  lighthouse: Sparkles,
  expedia: FileSpreadsheet,
  events: Clock,
};

const STATUS_META: Record<
  ImportSourceMeta['status'],
  { label: string; tone: 'emerald' | 'sky' | 'slate' }
> = {
  file: { label: 'Import fichier', tone: 'emerald' },
  'api-ready': { label: 'API prête', tone: 'sky' },
  'api-coming-soon': { label: 'API à venir', tone: 'slate' },
};

export const ImportSourceSelector: React.FC<ImportSourceSelectorProps> = ({
  sources,
  onSelect,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.08]"
      role="menu"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Choisir une source
        </p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Le moteur RMS sera alimenté en données exploitables immédiatement.
        </p>
      </div>

      <div className="max-h-[360px] overflow-y-auto py-1">
        {sources.map((src) => {
          const Icon = ICON_BY_KIND[src.icon];
          const status = STATUS_META[src.status];
          const disabled = src.status === 'api-coming-soon';

          return (
            <button
              key={src.id}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => !disabled && onSelect(src)}
              className={cn(
                'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                disabled
                  ? 'cursor-not-allowed opacity-70'
                  : 'hover:bg-violet-50/60'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  src.icon === 'lighthouse'
                    ? 'bg-violet-100 text-violet-700'
                    : src.icon === 'expedia'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-sky-100 text-sky-700'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    Importer depuis {src.label}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                      status.tone === 'emerald' &&
                        'bg-emerald-50 text-emerald-700 ring-emerald-200',
                      status.tone === 'sky' &&
                        'bg-sky-50 text-sky-700 ring-sky-200',
                      status.tone === 'slate' &&
                        'bg-slate-100 text-slate-600 ring-slate-200'
                    )}
                  >
                    {status.tone === 'sky' ? (
                      <Wifi className="h-3 w-3" />
                    ) : status.tone === 'emerald' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {status.label}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
                  {src.description}
                </p>
                {src.acceptedFormats.length > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-slate-400">
                    Formats : {src.acceptedFormats.join(', ')}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ImportSourceSelector;
