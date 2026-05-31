/**
 * FLOWTYM — DepositsPanel (T7).
 * Garanties, acomptes & arrhes — état machine : pending → captured → released | applied
 */
import React, { useState } from 'react';
import { Plus, ShieldCheck, Clock, CheckCircle, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import {
  useDeposits,
  useCreateDeposit,
  useCaptureDeposit,
  useReleaseDeposit,
} from '@/src/domains/billing/hooks';
import type { DepositRow } from '@/src/domains/billing/deposits.repository';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending:  { label: 'En attente',  icon: <Clock size={12} />,        color: 'bg-amber-50 text-amber-700 border-amber-200' },
  captured: { label: 'Capturé',     icon: <ShieldCheck size={12} />,  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  released: { label: 'Libéré',      icon: <XCircle size={12} />,      color: 'bg-gray-50 text-gray-500 border-gray-200' },
  applied:  { label: 'Imputé',      icon: <CheckCircle size={12} />,  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const TYPE_LABELS: Record<string, string> = {
  arrhes:   'Arrhes',
  acompte:  'Acompte',
  garantie: 'Garantie',
  other:    'Autre',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', card: 'CB', transfer: 'Virement', cheque: 'Chèque', ota: 'OTA', other: 'Autre',
};

// ─── Deposit Card ─────────────────────────────────────────────────────────────

function DepositCard({ deposit }: { key?: React.Key; deposit: DepositRow }) {
  const capture = useCaptureDeposit();
  const release = useReleaseDeposit();
  const cfg = STATUS_CONFIG[deposit.status] ?? STATUS_CONFIG.pending;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-purple-100 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {TYPE_LABELS[deposit.deposit_type] ?? deposit.deposit_type}
          </span>
          <p className="text-base font-bold text-gray-900 mt-0.5">{fmtEur(deposit.amount)}</p>
          <p className="text-xs text-gray-400">{METHOD_LABELS[deposit.method] ?? deposit.method} · {new Date(deposit.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <div className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border', cfg.color)}>
          {cfg.icon}
          {cfg.label}
        </div>
      </div>

      {deposit.notes && (
        <p className="text-xs text-gray-500 mb-3 italic">{deposit.notes}</p>
      )}

      <div className="flex gap-2">
        {deposit.status === 'pending' && (
          <>
            <Button
              size="sm"
              onClick={() => capture.mutate(deposit.id)}
              disabled={capture.isPending}
              className="flex-1 bg-blue-600 text-white text-xs gap-1"
            >
              {capture.isPending ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
              Capturer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => release.mutate({ id: deposit.id })}
              disabled={release.isPending}
              className="flex-1 text-xs gap-1"
            >
              {release.isPending ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
              Libérer
            </Button>
          </>
        )}
        {deposit.status === 'captured' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => release.mutate({ id: deposit.id })}
            disabled={release.isPending}
            className="flex-1 text-xs gap-1"
          >
            {release.isPending ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
            Libérer le dépôt
          </Button>
        )}
        {deposit.applied_to_invoice_id && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <ArrowRight size={10} /> Imputé sur facture
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateDepositForm({
  reservationId,
  onClose,
}: {
  reservationId?: string;
  onClose: () => void;
}) {
  const create = useCreateDeposit();
  const [form, setForm] = useState({
    amount: '',
    method: 'card',
    depositType: 'acompte',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError('Montant positif requis.'); return; }
    setError(null);
    create.mutate(
      {
        reservationId,
        amount,
        currency: 'EUR',
        method: form.method as DepositRow['method'],
        depositType: form.depositType as DepositRow['deposit_type'],
        notes: form.notes || undefined,
      },
      { onSuccess: onClose, onError: (err) => setError(err.message) },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-white border-b border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800">Nouveau dépôt</h3>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Montant *</label>
          <input
            type="number" min="0.01" step="0.01"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            placeholder="0,00"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Mode de paiement</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={form.method}
            onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
          >
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Type</label>
        <select
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          value={form.depositType}
          onChange={e => setForm(f => ({ ...f, depositType: e.target.value }))}
        >
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <input
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
        placeholder="Notes (optionnel)"
        value={form.notes}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
        <Button type="submit" disabled={create.isPending} className="flex-1 bg-purple-600 text-white gap-2">
          {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function DepositsPanel({
  reservationId,
  invoiceId,
}: {
  reservationId?: string;
  invoiceId?: string;
}) {
  const { data: deposits = [], isLoading } = useDeposits({ reservationId, invoiceId });
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = statusFilter ? deposits.filter(d => d.status === statusFilter) : deposits;
  const totalCaptured = deposits.filter(d => d.status === 'captured').reduce((s, d) => s + d.amount, 0);

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB]">
      <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-900">Garanties & Acomptes</h2>
          {totalCaptured > 0 && (
            <p className="text-xs text-blue-600 font-medium">{fmtEur(totalCaptured)} capturé(s)</p>
          )}
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="bg-purple-600 text-white gap-2 text-sm">
          <Plus size={13} /> Nouveau dépôt
        </Button>
      </div>

      {showCreate && (
        <CreateDepositForm reservationId={reservationId} onClose={() => setShowCreate(false)} />
      )}

      <div className="px-4 py-2 flex gap-2 border-b border-gray-50 bg-white shrink-0">
        {['', 'pending', 'captured', 'applied', 'released'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'text-xs px-3 py-1 rounded-full font-medium transition-colors',
              statusFilter === s ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {s === '' ? 'Tous' : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">Aucun dépôt</p>
          </div>
        ) : (
          filtered.map(deposit => <DepositCard key={deposit.id} deposit={deposit} />)
        )}
      </div>
    </div>
  );
}
