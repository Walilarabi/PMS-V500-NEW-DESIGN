/**
 * FLOWTYM — CreditNoteModal (T8).
 * Création d'un avoir depuis une facture émise.
 */
import React, { useState, useEffect } from 'react';
import { RotateCcw, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useCreateCreditNote } from '@/src/domains/billing/hooks';
import type { InvoiceRow } from '@/src/domains/billing/schemas';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

interface CreditNoteModalProps {
  isOpen: boolean;
  invoice: InvoiceRow | null;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreditNoteModal({ isOpen, invoice, onClose, onCreated }: CreditNoteModalProps) {
  const createCreditNote = useCreateCreditNote();
  const [form, setForm] = useState({
    totalHt: '',
    totalTva: '',
    reason: '',
    billToName: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && invoice) {
      setForm({
        totalHt:    invoice.total_ht.toFixed(2),
        totalTva:   invoice.total_tva.toFixed(2),
        reason:     '',
        billToName: invoice.bill_to_name ?? '',
        notes:      '',
      });
      setError(null);
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const totalHt  = parseFloat(form.totalHt) || 0;
  const totalTva = parseFloat(form.totalTva) || 0;
  const totalTtc = totalHt + totalTva;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim()) { setError('Le motif de l\'avoir est obligatoire.'); return; }
    if (totalHt <= 0)        { setError('Le montant HT doit être positif.'); return; }
    setError(null);
    createCreditNote.mutate(
      {
        originalInvoiceId: invoice.id,
        reservationId:     invoice.reservation_id ?? undefined,
        guestId:           invoice.guest_id ?? undefined,
        totalHt,
        totalTva,
        totalTtc,
        reason:            form.reason.trim(),
        billToName:        form.billToName || undefined,
        notes:             form.notes || undefined,
      },
      {
        onSuccess: () => { onCreated?.(); onClose(); },
        onError:   (err) => setError(err.message),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <RotateCcw size={18} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Créer un avoir</h2>
            <p className="text-sm text-gray-500">sur facture {invoice.invoice_number}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
            <XCircle size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-4">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Motif de l'avoir *</label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="Ex : annulation, erreur de tarif, remise commerciale…"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Montant HT *</label>
              <input
                type="number" min="0.01" step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.totalHt}
                onChange={e => setForm(f => ({ ...f, totalHt: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">TVA</label>
              <input
                type="number" min="0" step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.totalTva}
                onChange={e => setForm(f => ({ ...f, totalTva: e.target.value }))}
              />
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total TTC de l'avoir</span>
              <strong className="text-orange-700">{fmtEur(totalTtc)}</strong>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Destinataire</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder={invoice.bill_to_name ?? 'Nom du destinataire'}
              value={form.billToName}
              onChange={e => setForm(f => ({ ...f, billToName: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={createCreditNote.isPending} className="flex-1">
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createCreditNote.isPending}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold gap-2"
            >
              {createCreditNote.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RotateCcw size={13} />
              )}
              Créer l'avoir
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
