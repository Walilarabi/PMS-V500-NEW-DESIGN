/**
 * FLOWTYM — RefundModal (T16).
 * Remplace window.prompt() pour la saisie du motif de remboursement.
 */
import React, { useRef, useEffect } from 'react';
import { RotateCcw, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';

interface RefundModalProps {
  isOpen: boolean;
  paymentAmount: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

export function RefundModal({
  isOpen,
  paymentAmount,
  onConfirm,
  onCancel,
  isPending = false,
}: RefundModalProps) {
  const [reason, setReason] = React.useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onKeyDown={handleKey}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <RotateCcw size={18} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Confirmer le remboursement</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Montant : <strong className="text-red-600">{fmtEur(paymentAmount)}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Motif du remboursement <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={inputRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : annulation client, double paiement, erreur de saisie…"
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            disabled={isPending}
          />

          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
              className="flex-1"
            >
              <XCircle size={14} />
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!reason.trim() || isPending}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              Rembourser
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
