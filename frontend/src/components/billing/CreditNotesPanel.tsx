/**
 * FLOWTYM — CreditNotesPanel (T8).
 * Liste et gestion des avoirs.
 */
import React, { useState } from 'react';
import { FileText, CheckCircle, Clock, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { useCreditNotes, useIssueCreditNote } from '@/src/domains/billing/hooks';
import { CreditNoteModal } from './CreditNoteModal';
import type { InvoiceRow } from '@/src/domains/billing/schemas';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const STATUS_CFG: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' | 'error' }> = {
  draft:  { label: 'Brouillon', variant: 'neutral' },
  issued: { label: 'Émis',      variant: 'success' },
  voided: { label: 'Annulé',    variant: 'error' },
};

export function CreditNotesPanel({
  invoice,
}: {
  invoice?: InvoiceRow | null;
}) {
  const params = invoice ? { originalInvoiceId: invoice.id } : {};
  const { data: creditNotes = [], isLoading } = useCreditNotes(params);
  const issueCn = useIssueCreditNote();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">Avoirs</h3>
        {invoice && ['issued', 'paid'].includes(invoice.status) && (
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1"
          >
            <FileText size={11} /> Créer un avoir
          </Button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={12} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
        ) : creditNotes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Aucun avoir</p>
        ) : (
          <div className="space-y-3">
            {creditNotes.map(cn => {
              const cfg = STATUS_CFG[cn.status] ?? STATUS_CFG.draft;
              return (
                <div key={cn.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cn.credit_note_number}</p>
                      <p className="text-xs text-gray-400">{new Date(cn.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-orange-600">-{fmtEur(cn.total_ttc)}</span>
                      <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 italic mb-3">{cn.reason}</p>
                  {cn.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        issueCn.mutate(cn.id, {
                          onError: (err) => setError(`Émission échouée — ${err.message}`),
                        })
                      }
                      disabled={issueCn.isPending}
                      className="w-full text-xs bg-orange-500 text-white gap-1"
                    >
                      {issueCn.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                      Émettre l'avoir
                    </Button>
                  )}
                  {cn.status === 'issued' && cn.issued_at && (
                    <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                      <CheckCircle size={10} />
                      Émis le {new Date(cn.issued_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreditNoteModal
        isOpen={showCreate}
        invoice={invoice ?? null}
        onClose={() => setShowCreate(false)}
        onCreated={() => setShowCreate(false)}
      />
    </div>
  );
}
