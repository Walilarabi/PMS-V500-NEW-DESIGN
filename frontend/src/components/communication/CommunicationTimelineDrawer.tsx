/**
 * FLOWTYM — Drawer du Journal Unifié (L3), utilisé depuis Flowday (menu ⋮).
 * Réutilise le pattern drawer droit de ClientProfile360 et embarque
 * CommunicationTimeline. La timeline n'est chargée qu'à l'ouverture (lazy).
 */
import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { CommunicationTimeline } from './CommunicationTimeline';
import type { TimelineScope } from '@/src/services/communication/timeline.service';

export interface CommunicationTimelineDrawerProps {
  open: boolean;
  onClose: () => void;
  scope: TimelineScope;
  /** Sous-titre (ex: nom du client · chambre). */
  subtitle?: string;
}

export const CommunicationTimelineDrawer: React.FC<CommunicationTimelineDrawerProps> = ({ open, onClose, scope, subtitle }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          className="fixed inset-0 z-40 bg-black/30"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.aside
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[500px] flex-col bg-white shadow-2xl"
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Journal des communications</span>
              {subtitle && <p className="truncate text-sm font-semibold text-slate-700">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <CommunicationTimeline scope={scope} enabled={open} className="h-full" />
          </div>
        </motion.aside>
      </>
    )}
  </AnimatePresence>
);

export default CommunicationTimelineDrawer;
