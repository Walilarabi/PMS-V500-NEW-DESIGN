/**
 * FLOWTYM RMS — Modal « Raison du refus »
 *
 * Affiché quand l'utilisateur refuse une recommandation. Propose les 5 raisons
 * prédéfinies + un commentaire libre. Le feedback est journalisé pour
 * améliorer la confiance IA des règles tactiques.
 */
import React, { useState } from 'react';
import { X, AlertCircle, MessageSquare } from 'lucide-react';
import {
  REJECTION_REASONS,
  recommendationFeedback,
  type RejectionReasonCode,
  type FeedbackEntry,
} from '@/src/services/revenue/recommendationFeedback.service';
import { cn } from '@/src/lib/utils';

export interface RejectionReasonModalProps {
  open: boolean;
  onClose: () => void;
  /** Date concernée (YYYY-MM-DD). */
  date: string;
  /** Contexte de la recommandation (utilisé pour l'apprentissage). */
  context?: FeedbackEntry['context'];
  /** Callback après log réussi. */
  onLogged?: (entry: FeedbackEntry) => void;
}

export const RejectionReasonModal: React.FC<RejectionReasonModalProps> = ({
  open, onClose, date, context, onLogged,
}) => {
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode | null>(null);
  const [comment, setComment] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!reasonCode) return;
    const label = REJECTION_REASONS.find((r) => r.code === reasonCode)?.label;
    const entry = recommendationFeedback.log({
      date,
      action: 'reject',
      reasonCode,
      reasonLabel: label,
      comment: comment.trim() || undefined,
      context,
    });
    onLogged?.(entry);
    setReasonCode(null);
    setComment('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-600">
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                Pourquoi refusez-vous cette recommandation ?
              </h3>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Date : <b>{date}</b> — votre retour aide le moteur RMS à s'améliorer.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2 block">
              Raison principale
            </label>
            <div className="space-y-1.5">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setReasonCode(r.code)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-xl border text-[13px] font-medium transition-colors',
                    reasonCode === r.code
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <MessageSquare size={11} /> Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Précisez le contexte si nécessaire…"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reasonCode}
            className={cn(
              'px-3 py-1.5 text-[12px] font-semibold rounded-xl shadow-sm',
              reasonCode
                ? 'text-white bg-rose-500 hover:bg-rose-600'
                : 'text-slate-400 bg-slate-100 cursor-not-allowed',
            )}
          >
            Enregistrer le refus
          </button>
        </div>
      </div>
    </div>
  );
};
