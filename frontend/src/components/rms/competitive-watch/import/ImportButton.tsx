/**
 * FLOWTYM — Bouton « Importer » de la Veille Concurrentielle
 *
 * Orchestre : dropdown de sélection de source ⇢ modal d'import via provider ⇢
 * toast de succès. Aucun parsing ici, seulement de la composition d'UI.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ChevronDown, Upload } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  getProvider,
  listImportSources,
  type ImportSourceMeta,
} from '@/src/services/import/marketDataProvider';
import { ImportSourceSelector } from './ImportSourceSelector';
import { ImportModal } from './ImportModal';

interface ImportButtonProps {
  className?: string;
}

interface ToastState {
  visible: boolean;
  label: string;
  sublabel?: string;
}

export const ImportButton: React.FC<ImportButtonProps> = ({ className }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<ImportSourceMeta | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, label: '' });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const sources = useMemo(() => listImportSources(), []);
  const provider = activeSource ? getProvider(activeSource.id) : null;

  // Click outside : ferme le dropdown
  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handlePickSource = useCallback((source: ImportSourceMeta) => {
    setActiveSource(source);
    setMenuOpen(false);
    setModalOpen(true);
  }, []);

  const handleBackToSelector = useCallback(() => {
    setModalOpen(false);
    setActiveSource(null);
    setMenuOpen(true);
  }, []);

  const handleCommitted = useCallback((label: string, sublabel?: string) => {
    setToast({ visible: true, label, sublabel });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4200);
  }, []);

  return (
    <div ref={wrapperRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13.5px] font-semibold text-white shadow-md transition-all',
          'bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] shadow-violet-500/25',
          'hover:shadow-lg hover:shadow-violet-500/30 hover:from-[#7C3AED] hover:to-[#5B21B6]'
        )}
      >
        <Upload className="h-4 w-4" strokeWidth={2.2} />
        Importer
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            menuOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <div className="absolute right-0 top-full z-40 mt-2">
            <ImportSourceSelector sources={sources} onSelect={handlePickSource} />
          </div>
        )}
      </AnimatePresence>

      <ImportModal
        open={modalOpen}
        source={activeSource}
        provider={provider}
        onClose={() => setModalOpen(false)}
        onBack={handleBackToSelector}
        onCommitted={(res) =>
          handleCommitted(
            `Import ${activeSource?.label ?? ''} terminé`,
            `${res.importedRows} ligne(s) injectée(s) dans le RMS`
          )
        }
      />

      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            role="status"
            className="fixed bottom-6 right-6 z-[70] flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-xl shadow-slate-900/[0.10]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="max-w-[280px]">
              <p className="text-sm font-semibold text-slate-900">{toast.label}</p>
              {toast.sublabel && (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {toast.sublabel}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImportButton;
