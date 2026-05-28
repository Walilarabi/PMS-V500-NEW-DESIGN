/**
 * FLOWTYM — FacturationView
 * Module de facturation connecté à Supabase — invoices, folios, lignes, paiements.
 */
import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Eye, CheckCircle, XCircle, CreditCard,
  Download, Loader2, RefreshCcw, AlertCircle, RotateCcw,
  ChevronDown, ChevronRight, Banknote, Receipt,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';
import {
  useInvoices, useInvoice, useFolios, useInvoiceLines, usePayments,
  useCreateInvoice, useIssueInvoice, useVoidInvoice,
  useAddInvoiceLine, useReverseLine,
  useAddPayment, useReversePayment,
  useBillingStats,
} from '@/src/domains/billing/hooks';
import type { InvoiceRow, PaymentMethod } from '@/src/domains/billing/schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const STATUS_CONFIG: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' | 'error' }> = {
  draft:  { label: 'Brouillon',  variant: 'neutral' },
  issued: { label: 'Émise',      variant: 'warning' },
  paid:   { label: 'Soldée',     variant: 'success' },
  voided: { label: 'Annulée',    variant: 'error' },
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces', card: 'CB', transfer: 'Virement',
  cheque: 'Chèque', ota: 'OTA', other: 'Autre',
};

// ─── Invoice Detail Panel ─────────────────────────────────────────────────────

function InvoicePanel({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { data: folios = [] } = useFolios(invoiceId);
  const { data: lines = [] } = useInvoiceLines(invoiceId);
  const { data: payments = [] } = usePayments(invoiceId);

  const issueInvoice  = useIssueInvoice();
  const voidInvoice   = useVoidInvoice();
  const addLine       = useAddInvoiceLine();
  const reverseLine   = useReverseLine();
  const addPayment    = useAddPayment();
  const reversePayment = useReversePayment();

  const [showAddLine, setShowAddLine] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [lineForm, setLineForm] = useState({ description: '', quantity: '1', unitPrice: '', tvaRate: '10', serviceDate: new Date().toISOString().split('T')[0] });
  const [payForm, setPayForm] = useState({ amount: '', method: 'card' as PaymentMethod, reference: '' });
  const [voidReason, setVoidReason] = useState('');
  const [showVoid, setShowVoid] = useState(false);

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" /> Chargement…
      </div>
    );
  }

  const folio = folios[0];
  const cfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
  const canEdit = invoice.status === 'draft';
  const canIssue = invoice.status === 'draft' && (invoice.total_ttc ?? 0) > 0;
  const canPay = invoice.status === 'issued';

  const handleAddLine = () => {
    if (!folio) return;
    addLine.mutate({
      folioId: folio.id,
      invoiceId,
      description: lineForm.description,
      serviceDate: lineForm.serviceDate,
      quantity: parseFloat(lineForm.quantity) || 1,
      unitPriceHt: parseFloat(lineForm.unitPrice) || 0,
      tvaRate: parseFloat(lineForm.tvaRate) || 10,
      source: 'manual',
    }, { onSuccess: () => { setShowAddLine(false); setLineForm({ description: '', quantity: '1', unitPrice: '', tvaRate: '10', serviceDate: new Date().toISOString().split('T')[0] }); } });
  };

  const handleAddPayment = () => {
    addPayment.mutate({
      invoiceId,
      amount: parseFloat(payForm.amount) || 0,
      method: payForm.method,
      reference: payForm.reference || undefined,
    }, { onSuccess: () => { setShowAddPayment(false); setPayForm({ amount: '', method: 'card', reference: '' }); } });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex items-start justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-bold text-gray-900">{invoice.invoice_number}</h3>
            <Badge variant={cfg.variant} className="text-[10px] font-bold px-2 py-0.5">{cfg.label}</Badge>
          </div>
          {invoice.bill_to_name && <p className="text-sm text-gray-500">{invoice.bill_to_name}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
          <XCircle size={16} />
        </button>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-3 gap-3 p-6 border-b border-gray-50 shrink-0">
        {[
          { label: 'Total TTC', value: fmtEur(invoice.total_ttc), color: 'text-gray-900' },
          { label: 'Payé', value: fmtEur(invoice.paid_amount), color: 'text-emerald-600' },
          { label: 'Solde', value: fmtEur(invoice.balance ?? 0), color: (invoice.balance ?? 0) > 0 ? 'text-red-500' : 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="p-3 bg-gray-50 rounded-2xl">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
            <p className={cn('text-lg font-bold', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lignes */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lignes</h4>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowAddLine(v => !v)} className="gap-1.5 text-xs font-bold">
                <Plus size={12} /> Ajouter
              </Button>
            )}
          </div>

          {showAddLine && (
            <div className="p-4 bg-gray-50 rounded-2xl mb-3 space-y-3">
              <input value={lineForm.description} onChange={e => setLineForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={lineForm.quantity} onChange={e => setLineForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Qté" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                <input type="number" value={lineForm.unitPrice} onChange={e => setLineForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="Prix HT" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                <input type="number" value={lineForm.tvaRate} onChange={e => setLineForm(f => ({ ...f, tvaRate: e.target.value }))} placeholder="TVA %" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>
              <input type="date" value={lineForm.serviceDate} onChange={e => setLineForm(f => ({ ...f, serviceDate: e.target.value }))} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none w-full" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddLine} disabled={addLine.isPending || !lineForm.description || !lineForm.unitPrice} className="bg-[#8B5CF6] text-white font-bold flex-1">
                  {addLine.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Valider'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddLine(false)}>Annuler</Button>
              </div>
            </div>
          )}

          {lines.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Aucune ligne</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {lines.map(line => (
                <div key={line.id} className={cn('flex items-center justify-between py-3', line.source === 'reversal' && 'opacity-50')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{line.description}</p>
                    <p className="text-[10px] text-gray-400">{line.service_date} · {line.quantity}× {fmtEur(line.unit_price_ht)} HT · TVA {line.tva_rate}%</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={cn('text-sm font-bold', (line.total_ttc ?? 0) < 0 ? 'text-red-500' : 'text-gray-900')}>
                      {fmtEur(line.total_ttc ?? 0)}
                    </span>
                    {canEdit && line.source !== 'reversal' && (
                      <button onClick={() => reverseLine.mutate({ lineId: line.id, invoiceId })} className="p-1 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-colors" title="Annuler cette ligne">
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paiements */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Paiements</h4>
            {canPay && (
              <Button size="sm" variant="outline" onClick={() => setShowAddPayment(v => !v)} className="gap-1.5 text-xs font-bold">
                <CreditCard size={12} /> Encaisser
              </Button>
            )}
          </div>

          {showAddPayment && (
            <div className="p-4 bg-gray-50 rounded-2xl mb-3 space-y-3">
              <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="Montant" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value as PaymentMethod }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="Référence (optionnel)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddPayment} disabled={addPayment.isPending || !payForm.amount} className="bg-[#8B5CF6] text-white font-bold flex-1">
                  {addPayment.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Encaisser'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddPayment(false)}>Annuler</Button>
              </div>
            </div>
          )}

          {payments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Aucun paiement</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {payments.map(pay => (
                <div key={pay.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{METHOD_LABELS[pay.method] ?? pay.method}</p>
                    <p className="text-[10px] text-gray-400">{new Date(pay.collected_at).toLocaleDateString('fr-FR')} {pay.reference && `· ${pay.reference}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-sm font-bold', pay.amount < 0 ? 'text-red-500' : 'text-emerald-600')}>
                      {fmtEur(pay.amount)}
                    </span>
                    <Badge variant={pay.status === 'reversed' ? 'error' : 'success'} className="text-[10px]">
                      {pay.status === 'reversed' ? 'Annulé' : 'OK'}
                    </Badge>
                    {pay.status === 'completed' && (
                      <button onClick={() => { const r = prompt('Motif du remboursement ?'); if (r) reversePayment.mutate({ paymentId: pay.id, invoiceId, reason: r }); }} className="p-1 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-colors" title="Rembourser">
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
        {canIssue && (
          <Button onClick={() => issueInvoice.mutate(invoiceId)} disabled={issueInvoice.isPending} className="flex-1 bg-[#8B5CF6] text-white font-bold gap-2 shadow-lg shadow-[#8B5CF6]/20">
            {issueInvoice.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Émettre la facture
          </Button>
        )}
        {(invoice.status === 'draft' || invoice.status === 'issued') && (
          <Button variant="outline" onClick={() => setShowVoid(v => !v)} className="gap-2 text-red-500 border-red-100 hover:bg-red-50 font-bold">
            <XCircle size={14} /> Annuler
          </Button>
        )}
      </div>

      {showVoid && (
        <div className="p-4 border-t border-red-100 bg-red-50 space-y-3">
          <input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Motif d'annulation obligatoire" className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
          <Button onClick={() => { if (voidReason) { voidInvoice.mutate({ id: invoiceId, reason: voidReason }); setShowVoid(false); } }} disabled={!voidReason || voidInvoice.isPending} className="w-full bg-red-500 text-white font-bold">
            Confirmer l'annulation
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export const FacturationView = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const { data: invoicesData, isLoading, refetch, isFetching } = useInvoices({
    status: statusFilter || undefined,
    limit:  PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });
  const { data: stats } = useBillingStats();
  const createInvoice = useCreateInvoice();

  useEffect(() => { setPage(1); }, [statusFilter]);

  const invoices   = invoicesData?.rows ?? [];
  const totalInv   = invoicesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalInv / PER_PAGE));

  return (
    <div className="flex h-full overflow-hidden bg-[#F9FAFB]">
      {/* Left — liste */}
      <div className={cn('flex flex-col', selectedId ? 'w-[55%]' : 'w-full')}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#8B5CF6] rounded-xl text-white shadow-lg shadow-[#8B5CF6]/20">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Facturation</h1>
              <p className="text-xs text-gray-400 font-medium">{totalInv} factures</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 font-bold">
              <RefreshCcw size={13} className={cn(isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={() => setShowCreate(true)} className="bg-[#8B5CF6] text-white gap-2 font-bold shadow-lg shadow-[#8B5CF6]/20">
              <Plus size={16} /> Nouvelle facture
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 p-6 shrink-0">
          {[
            { label: 'Émises', value: fmtEur(stats?.totalIssued ?? 0), sub: `${stats?.countIssued ?? 0} factures`, color: 'text-amber-600', bg: 'bg-amber-50', icon: <Receipt size={16} className="text-amber-500" /> },
            { label: 'Soldées', value: fmtEur(stats?.totalPaid ?? 0), sub: `${stats?.countPaid ?? 0} factures`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle size={16} className="text-emerald-500" /> },
            { label: 'En attente', value: fmtEur(stats?.totalBalance ?? 0), sub: 'à encaisser', color: 'text-red-600', bg: 'bg-red-50', icon: <AlertCircle size={16} className="text-red-500" /> },
            { label: 'Brouillons', value: stats?.countDraft ?? 0, sub: 'à émettre', color: 'text-gray-600', bg: 'bg-gray-50', icon: <FileText size={16} className="text-gray-400" /> },
          ].map(k => (
            <Card key={k.label} className="p-4 bg-white border-transparent shadow-sm">
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-xl shrink-0', k.bg)}>{k.icon}</div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{k.label}</p>
                  <p className={cn('text-xl font-bold mt-0.5', k.color)}>{k.value}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{k.sub}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="px-6 mb-4 flex gap-1 shrink-0">
          {[['', 'Toutes'], ['draft', 'Brouillons'], ['issued', 'Émises'], ['paid', 'Soldées'], ['voided', 'Annulées']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all', statusFilter === v ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-gray-500 hover:bg-white')}>
              {l}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto mx-6 mb-6">
          <Card className="bg-white border-transparent shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                <Loader2 size={18} className="animate-spin" /> Chargement…
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText size={32} className="mb-3 opacity-20" />
                <p className="text-sm font-bold">Aucune facture</p>
                <p className="text-xs mt-1 opacity-60">Créez votre première facture</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F9FAFB] border-b border-gray-50">
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <th className="px-5 py-4">N° Facture</th>
                      <th className="px-5 py-4">Client</th>
                      <th className="px-5 py-4">Statut</th>
                      <th className="px-5 py-4">Total TTC</th>
                      <th className="px-5 py-4">Solde</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoices.map(inv => {
                      const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
                      return (
                        <tr key={inv.id} className={cn('hover:bg-gray-50/60 transition-colors cursor-pointer text-sm', selectedId === inv.id && 'bg-[#8B5CF6]/5')} onClick={() => setSelectedId(inv.id === selectedId ? null : inv.id)}>
                          <td className="px-5 py-4 font-mono text-xs font-bold text-gray-700">{inv.invoice_number}</td>
                          <td className="px-5 py-4 text-gray-600">{inv.bill_to_name ?? '—'}</td>
                          <td className="px-5 py-4"><Badge variant={cfg.variant} className="text-[10px] font-bold px-2 py-0.5">{cfg.label}</Badge></td>
                          <td className="px-5 py-4 font-bold text-gray-900">{fmtEur(inv.total_ttc)}</td>
                          <td className="px-5 py-4">
                            <span className={cn('font-bold text-sm', (inv.balance ?? 0) > 0 ? 'text-red-500' : 'text-emerald-600')}>
                              {fmtEur(inv.balance ?? 0)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString('fr-FR')}</td>
                          <td className="px-5 py-4">
                            <ChevronRight size={14} className={cn('text-gray-300 transition-transform', selectedId === inv.id && 'rotate-90 text-[#8B5CF6]')} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-500">
                <span>
                  {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalInv)} sur {totalInv}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                  <span className="px-2 font-medium">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Right — detail panel */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '45%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-gray-100 bg-white overflow-hidden flex flex-col shrink-0"
          >
            <InvoicePanel invoiceId={selectedId} onClose={() => setSelectedId(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal création facture */}
      <AnimatePresence>
        {showCreate && (
          <CreateInvoiceModal
            onClose={() => setShowCreate(false)}
            onCreate={async (input) => {
              await createInvoice.mutateAsync(input);
              setShowCreate(false);
            }}
            isLoading={createInvoice.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Create Invoice Modal ─────────────────────────────────────────────────────

function CreateInvoiceModal({
  onClose, onCreate, isLoading,
}: {
  onClose: () => void;
  onCreate: (input: { billToName?: string; billToAddress?: string; billToVat?: string; notes?: string; dueDate?: string }) => Promise<void>;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({ billToName: '', billToAddress: '', billToVat: '', notes: '', dueDate: '' });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="bg-white w-full max-w-md rounded-[28px] shadow-2xl p-8 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Nouvelle facture</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400"><XCircle size={16} /></button>
        </div>
        {[
          { key: 'billToName', label: 'Nom client / société', placeholder: 'Ex: Société Dupont SAS' },
          { key: 'billToAddress', label: 'Adresse', placeholder: 'Adresse de facturation' },
          { key: 'billToVat', label: 'N° TVA intracommunautaire', placeholder: 'FR00000000000' },
          { key: 'dueDate', label: "Date d'échéance", placeholder: '', type: 'date' },
          { key: 'notes', label: 'Notes', placeholder: 'Observations internes' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
            <input
              type={f.type ?? 'text'}
              value={(form as Record<string, string>)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-bold">Annuler</Button>
          <Button onClick={() => onCreate(form)} disabled={isLoading} className="flex-1 bg-[#8B5CF6] text-white font-bold gap-2 shadow-lg shadow-[#8B5CF6]/20">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
