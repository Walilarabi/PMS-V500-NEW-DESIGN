/**
 * FLOWTYM — SplitBillingWizard (T11).
 * Modes : % / montant fixe / règle auto
 * Prévisualisation 2 colonnes · Génération 2 vraies factures
 */
import React, { useState, useMemo } from 'react';
import { Scissors, Percent, DollarSign, Loader2, XCircle, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { useCreateInvoice, useAddInvoiceLine, useAddFolio } from '@/src/domains/billing/hooks';
import { useAuth } from '@/src/domains/auth/AuthContext';
import type { InvoiceRow, InvoiceLineRow } from '@/src/domains/billing/schemas';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

type SplitMode = 'percent' | 'fixed' | 'auto';

interface SplitBillingWizardProps {
  isOpen: boolean;
  sourceInvoice: InvoiceRow | null;
  lines: InvoiceLineRow[];
  onClose: () => void;
  onSuccess: () => void;
}

interface SplitPreview {
  labelA: string;
  labelB: string;
  linesA: InvoiceLineRow[];
  linesB: InvoiceLineRow[];
  totalA: number;
  totalB: number;
}

function computeSplit(
  lines: InvoiceLineRow[],
  mode: SplitMode,
  percentA: number,
  fixedA: number,
  labelA: string,
  labelB: string,
): SplitPreview {
  const positiveLines = lines.filter(l => l.quantity > 0 && l.source !== 'reversal');
  const totalTtc = positiveLines.reduce((s, l) => s + (l.total_ttc ?? 0), 0);

  let linesA: InvoiceLineRow[];
  let linesB: InvoiceLineRow[];

  if (mode === 'percent') {
    const targetA = totalTtc * (percentA / 100);
    let runA = 0;
    linesA = [];
    linesB = [];
    for (const l of positiveLines) {
      const ttc = l.total_ttc ?? 0;
      if (runA + ttc <= targetA + 0.01) {
        linesA.push(l);
        runA += ttc;
      } else {
        linesB.push(l);
      }
    }
  } else if (mode === 'fixed') {
    let runA = 0;
    linesA = [];
    linesB = [];
    for (const l of positiveLines) {
      const ttc = l.total_ttc ?? 0;
      if (runA + ttc <= fixedA + 0.01) {
        linesA.push(l);
        runA += ttc;
      } else {
        linesB.push(l);
      }
    }
  } else {
    // auto: split roughly 50/50
    const half = Math.ceil(positiveLines.length / 2);
    linesA = positiveLines.slice(0, half);
    linesB = positiveLines.slice(half);
  }

  return {
    labelA,
    labelB,
    linesA,
    linesB,
    totalA: linesA.reduce((s, l) => s + (l.total_ttc ?? 0), 0),
    totalB: linesB.reduce((s, l) => s + (l.total_ttc ?? 0), 0),
  };
}

export function SplitBillingWizard({
  isOpen,
  sourceInvoice,
  lines,
  onClose,
  onSuccess,
}: SplitBillingWizardProps) {
  const { session } = useAuth();
  const hotelId = session?.tenantId ?? '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<SplitMode>('percent');
  const [percentA, setPercentA] = useState(50);
  const [fixedA, setFixedA] = useState('');
  const [labelA, setLabelA] = useState('Facture A');
  const [labelB, setLabelB] = useState('Facture B');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createInvoice = useCreateInvoice();
  const addFolio = useAddFolio();
  const addLine  = useAddInvoiceLine();

  const preview = useMemo(() => {
    if (!sourceInvoice) return null;
    return computeSplit(lines, mode, percentA, parseFloat(fixedA) || 0, labelA, labelB);
  }, [lines, mode, percentA, fixedA, labelA, labelB, sourceInvoice]);

  const handleGenerate = async () => {
    if (!sourceInvoice || !preview) return;
    setError(null);
    setIsPending(true);
    try {
      // Create invoice A
      const { invoice: invA, folio: folioA } = await createInvoice.mutateAsync({
        reservationId: sourceInvoice.reservation_id ?? undefined,
        guestId:       sourceInvoice.guest_id ?? undefined,
        billToName:    labelA,
        notes:         `Fractionnement de ${sourceInvoice.invoice_number} — Partie A`,
      });
      for (const l of preview.linesA) {
        await addLine.mutateAsync({
          folioId:      folioA.id,
          invoiceId:    invA.id,
          description:  l.description,
          productCode:  l.product_code ?? undefined,
          serviceDate:  l.service_date,
          quantity:     l.quantity,
          unitPriceHt:  l.unit_price_ht,
          tvaRate:      l.tva_rate,
          source:       'manual',
        });
      }

      // Create invoice B
      const { invoice: invB, folio: folioB } = await createInvoice.mutateAsync({
        reservationId: sourceInvoice.reservation_id ?? undefined,
        guestId:       sourceInvoice.guest_id ?? undefined,
        billToName:    labelB,
        notes:         `Fractionnement de ${sourceInvoice.invoice_number} — Partie B`,
      });
      for (const l of preview.linesB) {
        await addLine.mutateAsync({
          folioId:      folioB.id,
          invoiceId:    invB.id,
          description:  l.description,
          productCode:  l.product_code ?? undefined,
          serviceDate:  l.service_date,
          quantity:     l.quantity,
          unitPriceHt:  l.unit_price_ht,
          tvaRate:      l.tva_rate,
          source:       'manual',
        });
      }
      void addFolio; // imported but only needed if we want extra folios
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération des factures.');
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen || !sourceInvoice) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Scissors size={16} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Fractionnement de facture</h2>
              <p className="text-xs text-gray-400">{sourceInvoice.invoice_number} · {fmtEur(sourceInvoice.total_ttc)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={18} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 shrink-0">
          {([1, 2, 3] as const).map(s => (
            <React.Fragment key={s}>
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', step >= s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400')}>
                {step > s ? <CheckCircle size={13} /> : s}
              </div>
              {s < 3 && <div className={cn('h-0.5 flex-1', step > s ? 'bg-purple-400' : 'bg-gray-100')} />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-4">
              <AlertCircle size={12} />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 mb-4">
              <CheckCircle size={12} />
              Deux factures générées avec succès.
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Mode de fractionnement</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'percent', icon: <Percent size={14} />, label: 'Par pourcentage' },
                  { key: 'fixed',   icon: <DollarSign size={14} />, label: 'Montant fixe' },
                  { key: 'auto',    icon: <Scissors size={14} />, label: 'Automatique (50/50)' },
                ] as const).map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={cn('flex flex-col items-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all', mode === key ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-gray-300 text-gray-600')}
                  >
                    <span className={mode === key ? 'text-purple-600' : 'text-gray-400'}>{icon}</span>
                    <span className="text-xs text-center">{label}</span>
                  </button>
                ))}
              </div>

              {mode === 'percent' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Facture A : {percentA}%</label>
                  <input
                    type="range" min={5} max={95} step={5}
                    value={percentA}
                    onChange={e => setPercentA(Number(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>A : {percentA}%</span>
                    <span>B : {100 - percentA}%</span>
                  </div>
                </div>
              )}
              {mode === 'fixed' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Montant max pour la Facture A (€)</label>
                  <input
                    type="number" min={0} step={0.01}
                    value={fixedA}
                    onChange={e => setFixedA(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Libellé Facture A</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={labelA} onChange={e => setLabelA(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Libellé Facture B</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={labelB} onChange={e => setLabelB(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Prévisualisation</h3>
              <div className="grid grid-cols-2 gap-4">
                {([{ label: preview.labelA, lines: preview.linesA, total: preview.totalA }, { label: preview.labelB, lines: preview.linesB, total: preview.totalB }] as const).map((col) => (
                  <div key={col.label} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">{col.label}</p>
                      <p className="text-sm font-bold text-purple-700">{fmtEur(col.total)}</p>
                    </div>
                    <div className="space-y-1">
                      {col.lines.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Aucune ligne</p>
                      ) : col.lines.map(l => (
                        <div key={l.id} className="flex justify-between text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                          <span className="truncate max-w-[120px]">{l.description}</span>
                          <span>{fmtEur(l.total_ttc ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {(preview.linesA.length === 0 || preview.linesB.length === 0) && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <AlertCircle size={12} />
                  Une facture est vide. Ajustez le fractionnement.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <Scissors size={40} className="mx-auto text-purple-300 mb-4" />
              <p className="text-sm font-semibold text-gray-800 mb-1">Prêt à générer</p>
              <p className="text-xs text-gray-400">Deux nouvelles factures brouillon seront créées.</p>
              <p className="text-xs text-gray-400 mt-1">La facture originale restera inchangée.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-gray-100 shrink-0">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => (s - 1) as 1|2|3)} disabled={isPending}>
              Retour
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isPending} className={step === 1 ? 'flex-1' : ''}>
            Annuler
          </Button>
          {step < 3 && (
            <Button
              onClick={() => setStep(s => (s + 1) as 1|2|3)}
              disabled={step === 2 && preview !== null && (preview.linesA.length === 0 || preview.linesB.length === 0)}
              className="flex-1 bg-purple-600 text-white gap-2"
            >
              Suivant <ArrowRight size={13} />
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="flex-1 bg-purple-600 text-white font-bold gap-2"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />}
              Générer les 2 factures
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
