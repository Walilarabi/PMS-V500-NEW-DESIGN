/**
 * FLOWTYM — Caisse multi-coffres (Vague F7)
 *
 * Gestion de plusieurs coffres : mouvements espèces, transferts
 * inter-coffres atomiques, comptages avec ajustement d'écart, grand livre
 * immuable par coffre.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, Vault, Landmark, Coins, Wine, UtensilsCrossed, Box,
  Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ClipboardCheck,
  Loader2, X, RefreshCw, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  listCashSafes, createCashSafe, recordCashMovement, transferCash,
  countCash, getCashLedger, getCashDashboard,
  type CashSafe, type CashMovement, type CashDashboard,
  type SafeType, type MovementKind,
} from '../../services/finance/cashsafes.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const SAFE_TYPES: Record<SafeType, { label: string; icon: typeof Wallet; color: string; bg: string; border: string }> = {
  main_safe:  { label: 'Coffre-fort',       icon: Vault,            color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  reception:  { label: 'Caisse réception',  icon: Landmark,         color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  petty_cash: { label: 'Petite caisse',     icon: Coins,            color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  bar:        { label: 'Bar',               icon: Wine,             color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  restaurant: { label: 'Restaurant',        icon: UtensilsCrossed,  color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  other:      { label: 'Autre',             icon: Box,              color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200' },
};

const KIND: Record<MovementKind, { label: string; color: string; bg: string; sign: 1 | -1 }> = {
  deposit:      { label: 'Dépôt',           color: 'text-emerald-700', bg: 'bg-emerald-100', sign: 1 },
  withdrawal:   { label: 'Retrait',         color: 'text-red-700',     bg: 'bg-red-100',     sign: -1 },
  transfer_in:  { label: 'Transfert reçu',  color: 'text-blue-700',    bg: 'bg-blue-100',    sign: 1 },
  transfer_out: { label: 'Transfert émis',  color: 'text-amber-700',   bg: 'bg-amber-100',   sign: -1 },
  adjustment:   { label: 'Ajustement',      color: 'text-gray-600',    bg: 'bg-gray-100',    sign: 1 },
};

// ─── Toast ───────────────────────────────────────────────────────────────

function Toast({ msg, tone }: { msg: string; tone: 'ok' | 'err' }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[300] px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2',
      tone === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
    )}>
      {tone === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

function ModalShell({ title, icon: Icon, children, onClose }: {
  title: string; icon: typeof Wallet; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Icon className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200';

// ─── Movement modal ──────────────────────────────────────────────────────

function MovementModal({
  safe, kind, onClose, onDone,
}: {
  safe: CashSafe; kind: 'deposit' | 'withdrawal';
  onClose: () => void; onDone: (msg: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDeposit = kind === 'deposit';

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError('Montant invalide'); return; }
    setBusy(true);
    setError(null);
    try {
      await recordCashMovement({ safeId: safe.id, kind, amount: amt, category: category || undefined, reason: reason || undefined });
      onDone(`${isDeposit ? 'Dépôt' : 'Retrait'} de ${fmtEur(amt)} enregistré`);
    } catch (e: any) {
      setError(e?.message ?? 'Échec'); setBusy(false);
    }
  };

  return (
    <ModalShell title={`${isDeposit ? 'Dépôt' : 'Retrait'} — ${safe.name}`} icon={isDeposit ? ArrowDownToLine : ArrowUpFromLine} onClose={onClose}>
      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Solde actuel</span>
        <span className="text-sm font-bold text-gray-900">{fmtEur(safe.balance)}</span>
      </div>
      <Field label="Montant (€)">
        <input type="number" min="0" step="0.01" value={amount} autoFocus
          onChange={e => setAmount(e.target.value)} className={inputCls} placeholder="0,00" />
      </Field>
      <Field label="Catégorie">
        <input value={category} onChange={e => setCategory(e.target.value)} className={inputCls}
          placeholder={isDeposit ? 'Ex: Encaissement réception' : 'Ex: Achat fournitures'} />
      </Field>
      <Field label="Motif / note">
        <input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} placeholder="Détail du mouvement" />
      </Field>
      {error && <div className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">Annuler</button>
        <button onClick={submit} disabled={busy}
          className={cn('flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40',
            isDeposit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700')}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isDeposit ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
          Valider
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Transfer modal ──────────────────────────────────────────────────────

function TransferModal({
  source, safes, onClose, onDone,
}: {
  source: CashSafe; safes: CashSafe[];
  onClose: () => void; onDone: (msg: string) => void;
}) {
  const targets = safes.filter(s => s.id !== source.id && s.is_active);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError('Montant invalide'); return; }
    if (!targetId) { setError('Sélectionnez un coffre destination'); return; }
    setBusy(true);
    setError(null);
    try {
      await transferCash(source.id, targetId, amt, reason || undefined);
      onDone(`Transfert de ${fmtEur(amt)} effectué`);
    } catch (e: any) {
      setError(e?.message ?? 'Échec'); setBusy(false);
    }
  };

  return (
    <ModalShell title={`Transfert — depuis ${source.name}`} icon={ArrowLeftRight} onClose={onClose}>
      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Disponible</span>
        <span className="text-sm font-bold text-gray-900">{fmtEur(source.balance)}</span>
      </div>
      <Field label="Coffre destination">
        <select value={targetId} onChange={e => setTargetId(e.target.value)} className={inputCls}>
          {targets.length === 0 && <option value="">Aucun autre coffre</option>}
          {targets.map(s => <option key={s.id} value={s.id}>{s.name} — {fmtEur(s.balance)}</option>)}
        </select>
      </Field>
      <Field label="Montant (€)">
        <input type="number" min="0" step="0.01" value={amount} autoFocus
          onChange={e => setAmount(e.target.value)} className={inputCls} placeholder="0,00" />
      </Field>
      <Field label="Motif">
        <input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} placeholder="Ex: Dégagement de caisse vers le coffre" />
      </Field>
      {error && <div className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">Annuler</button>
        <button onClick={submit} disabled={busy || targets.length === 0}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 flex items-center justify-center gap-2 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
          Transférer
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Count modal ─────────────────────────────────────────────────────────

const DENOMS: { key: string; label: string; value: number }[] = [
  { key: 'b500', label: '500 €', value: 500 }, { key: 'b200', label: '200 €', value: 200 },
  { key: 'b100', label: '100 €', value: 100 }, { key: 'b50', label: '50 €', value: 50 },
  { key: 'b20', label: '20 €', value: 20 }, { key: 'b10', label: '10 €', value: 10 },
  { key: 'b5', label: '5 €', value: 5 }, { key: 'c2', label: '2 €', value: 2 },
  { key: 'c1', label: '1 €', value: 1 }, { key: 'c050', label: '0,50 €', value: 0.5 },
  { key: 'c020', label: '0,20 €', value: 0.2 }, { key: 'c010', label: '0,10 €', value: 0.1 },
];

function CountModal({
  safe, onClose, onDone,
}: {
  safe: CashSafe; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counted = useMemo(
    () => DENOMS.reduce((s, d) => s + (parseInt(counts[d.key] || '0') || 0) * d.value, 0),
    [counts],
  );
  const variance = counted - safe.balance;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const denom: Record<string, number> = {};
      for (const d of DENOMS) {
        const q = parseInt(counts[d.key] || '0') || 0;
        if (q > 0) denom[d.label] = q;
      }
      const r = await countCash(safe.id, Math.round(counted * 100) / 100, denom, notes || undefined);
      onDone(r.variance === 0
        ? 'Comptage validé — aucun écart'
        : `Comptage validé — écart de ${fmtEur(r.variance)} ajusté`);
    } catch (e: any) {
      setError(e?.message ?? 'Échec'); setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Comptage — {safe.name}</h3>
              <p className="text-xs text-gray-500">Saisissez le nombre de coupures et pièces</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-2">
            {DENOMS.map(d => (
              <div key={d.key} className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-500 w-12 text-right">{d.label}</span>
                <input
                  type="number" min="0" value={counts[d.key] ?? ''}
                  onChange={e => setCounts(c => ({ ...c, [d.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Note</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Observation éventuelle" />
          </div>
          {error && <div className="mt-3 text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 shrink-0">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Théorique</div>
              <div className="text-sm font-bold text-gray-800">{fmtEur(safe.balance)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Compté</div>
              <div className="text-sm font-bold text-gray-900">{fmtEur(counted)}</div>
            </div>
            <div className={cn('rounded-lg p-2 text-center',
              Math.abs(variance) < 0.005 ? 'bg-emerald-50' : 'bg-amber-50')}>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Écart</div>
              <div className={cn('text-sm font-bold', Math.abs(variance) < 0.005 ? 'text-emerald-700' : 'text-amber-700')}>
                {variance > 0 ? '+' : ''}{fmtEur(variance)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">Annuler</button>
            <button onClick={submit} disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 flex items-center justify-center gap-2 disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
              Valider le comptage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create safe modal ───────────────────────────────────────────────────

function CreateSafeModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SafeType>('petty_cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setError('Nom requis'); return; }
    setBusy(true);
    setError(null);
    try {
      await createCashSafe(name.trim(), type);
      onDone(`Coffre « ${name.trim()} » créé`);
    } catch (e: any) {
      setError(e?.message ?? 'Échec'); setBusy(false);
    }
  };

  return (
    <ModalShell title="Nouveau coffre" icon={Plus} onClose={onClose}>
      <Field label="Nom du coffre">
        <input value={name} onChange={e => setName(e.target.value)} autoFocus className={inputCls} placeholder="Ex: Caisse bar" />
      </Field>
      <Field label="Type">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SAFE_TYPES) as SafeType[]).map(t => {
            const c = SAFE_TYPES[t]; const Icon = c.icon;
            return (
              <button key={t} onClick={() => setType(t)}
                className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all',
                  type === t ? cn(c.border, c.bg) : 'border-gray-200 hover:border-gray-300')}>
                <Icon className={cn('w-4 h-4', type === t ? c.color : 'text-gray-400')} strokeWidth={1.75} />
                <span className={cn('text-xs font-semibold', type === t ? c.color : 'text-gray-600')}>{c.label}</span>
              </button>
            );
          })}
        </div>
      </Field>
      {error && <div className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">Annuler</button>
        <button onClick={submit} disabled={busy}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 flex items-center justify-center gap-2 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Créer
        </button>
      </div>
    </ModalShell>
  );
}

// ─── KPI ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: typeof Wallet;
  tone: 'violet' | 'emerald' | 'red' | 'amber' | 'blue';
}) {
  const c = {
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3.5', c.bg, c.border)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">{label}</span>
        <Icon className={cn('w-4 h-4', c.text)} strokeWidth={1.75} />
      </div>
      <div className={cn('text-2xl font-extrabold tabular-nums', c.text)}>{value}</div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────

type ModalState =
  | { type: 'movement'; safe: CashSafe; kind: 'deposit' | 'withdrawal' }
  | { type: 'transfer'; safe: CashSafe }
  | { type: 'count'; safe: CashSafe }
  | { type: 'create' }
  | null;

export const CashRegisterView: React.FC = () => {
  const [dashboard, setDashboard] = useState<CashDashboard | null>(null);
  const [safes, setSafes] = useState<CashSafe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const flash = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const reload = useCallback(async (keepSelection?: string) => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([getCashDashboard(), listCashSafes()]);
      setDashboard(d);
      setSafes(s);
      const sel = keepSelection ?? selectedId ?? s[0]?.id ?? null;
      setSelectedId(sel);
      if (sel) {
        setLedgerLoading(true);
        setLedger(await getCashLedger(sel));
        setLedgerLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const selectSafe = async (id: string) => {
    setSelectedId(id);
    setLedgerLoading(true);
    try { setLedger(await getCashLedger(id)); }
    finally { setLedgerLoading(false); }
  };

  const afterAction = async (msg: string) => {
    setModal(null);
    flash(msg);
    await reload(selectedId ?? undefined);
  };

  const selected = safes.find(s => s.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Coffres actifs" value={String(dashboard?.safes ?? 0)} icon={Vault} tone="violet" />
        <KpiCard label="Trésorerie totale" value={fmtEur(dashboard?.total_balance ?? 0)} icon={Wallet} tone="blue" />
        <KpiCard label="Entrées du jour" value={fmtEur(dashboard?.in_today ?? 0)} icon={TrendingUp} tone="emerald" />
        <KpiCard label="Sorties du jour" value={fmtEur(dashboard?.out_today ?? 0)} icon={TrendingDown} tone="red" />
        <KpiCard label="Écart comptage 30j" value={fmtEur(dashboard?.variance_30d ?? 0)} icon={ClipboardCheck} tone="amber" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <Vault className="w-4 h-4 text-violet-600" strokeWidth={1.75} /> Mes coffres
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => reload(selectedId ?? undefined)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title="Rafraîchir">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20">
            <Plus className="w-3.5 h-3.5" /> Nouveau coffre
          </button>
        </div>
      </div>

      {loading && safes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      ) : (
        <>
          {/* Safe cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {safes.map(s => {
              const cfg = SAFE_TYPES[s.safe_type] ?? SAFE_TYPES.other;
              const Icon = cfg.icon;
              return (
                <div
                  key={s.id}
                  onClick={() => selectSafe(s.id)}
                  className={cn(
                    'rounded-xl border-2 p-4 cursor-pointer transition-all',
                    selectedId === s.id ? 'border-violet-400 bg-violet-50/40 shadow-md' : cn(cfg.border, 'bg-white hover:shadow-sm'),
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                      <Icon className={cn('w-5 h-5', cfg.color)} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{s.name}</div>
                      <div className={cn('text-[11px] font-semibold', cfg.color)}>{cfg.label}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-gray-900 tabular-nums">{fmtEur(s.balance)}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {s.movements_today} mouvement(s) aujourd'hui
                    {s.last_count_at && ` · compté le ${new Date(s.last_count_at).toLocaleDateString('fr-FR')}`}
                  </div>
                  <div className="flex gap-1.5 mt-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal({ type: 'movement', safe: s, kind: 'deposit' })}
                      title="Dépôt" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100">
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setModal({ type: 'movement', safe: s, kind: 'withdrawal' })}
                      title="Retrait" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100">
                      <ArrowUpFromLine className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setModal({ type: 'transfer', safe: s })}
                      title="Transfert" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setModal({ type: 'count', safe: s })}
                      title="Comptage" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100">
                      <ClipboardCheck className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ledger */}
          {selected && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Grand livre — {selected.name}</h3>
                <span className="text-xs text-gray-400">{ledger.length} mouvement(s)</span>
              </div>
              {ledgerLoading ? (
                <div className="p-10 flex items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
                </div>
              ) : ledger.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Aucun mouvement sur ce coffre.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                      <th className="px-3 py-2.5 text-left font-bold">Date</th>
                      <th className="px-3 py-2.5 text-left font-bold">Type</th>
                      <th className="px-3 py-2.5 text-left font-bold">Motif</th>
                      <th className="px-3 py-2.5 text-right font-bold">Montant</th>
                      <th className="px-3 py-2.5 text-right font-bold">Solde après</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ledger.map(m => {
                      const k = KIND[m.kind];
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(m.performed_at)}</td>
                          <td className="px-3 py-2">
                            <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', k.bg, k.color)}>
                              {k.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {m.reason || m.category || '—'}
                            {m.counterpart_name && <span className="text-gray-400"> · {m.counterpart_name}</span>}
                          </td>
                          <td className={cn('px-3 py-2 text-right font-bold tabular-nums', k.sign > 0 ? 'text-emerald-700' : 'text-red-600')}>
                            {k.sign > 0 ? '+' : '−'}{fmtEur(m.amount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-semibold">{fmtEur(m.balance_after)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {modal?.type === 'movement' && (
        <MovementModal safe={modal.safe} kind={modal.kind} onClose={() => setModal(null)} onDone={afterAction} />
      )}
      {modal?.type === 'transfer' && (
        <TransferModal source={modal.safe} safes={safes} onClose={() => setModal(null)} onDone={afterAction} />
      )}
      {modal?.type === 'count' && (
        <CountModal safe={modal.safe} onClose={() => setModal(null)} onDone={afterAction} />
      )}
      {modal?.type === 'create' && (
        <CreateSafeModal onClose={() => setModal(null)} onDone={afterAction} />
      )}
      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
};
