/**
 * FLOWTYM — Rapprochement bancaire CAMT.053 (Vague F6)
 *
 * Import de relevés bancaires ISO 20022 (camt.053), rapprochement
 * automatique avec les paiements et matching manuel assisté.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Landmark, Upload, Download, RefreshCw, Loader2, Zap, X, AlertCircle,
  CheckCircle2, Link2, Link2Off, EyeOff, Eye, ArrowDownLeft, ArrowUpRight,
  FileText, Search, Sparkles,
} from 'lucide-react';
import {
  parseCamt053, buildCamt053, importCamtStatement, autoMatchStatement,
  getCamtDashboard, listBankStatements, listBankTransactions,
  getMatchCandidates, confirmMatch, unmatchTransaction, setTransactionIgnored,
  seedSampleCamt,
  type CamtDashboard, type BankStatement, type BankTransaction,
  type MatchCandidate, type TxStatus,
} from '../../services/finance/camt.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const STATUS: Record<TxStatus, { label: string; color: string; bg: string }> = {
  unmatched: { label: 'À rapprocher', color: 'text-amber-700',   bg: 'bg-amber-100' },
  matched:   { label: 'Rapproché',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
  ignored:   { label: 'Ignoré',       color: 'text-gray-500',    bg: 'bg-gray-100' },
};

// ─── KPI ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string; icon: typeof Upload;
  tone: 'violet' | 'emerald' | 'amber' | 'blue' | 'red';
}) {
  const c = {
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3.5', c.bg, c.border)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">{label}</span>
        <Icon className={cn('w-4 h-4', c.text)} strokeWidth={1.75} />
      </div>
      <div className={cn('text-2xl font-extrabold', c.text)}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 font-medium mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Manual match modal ──────────────────────────────────────────────────

function MatchModal({
  tx, onClose, onMatched,
}: {
  tx: BankTransaction;
  onClose: () => void;
  onMatched: () => void;
}) {
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMatchCandidates(tx.id)
      .then(c => { if (!cancelled) setCandidates(c); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tx.id]);

  const pick = async (paymentId: string) => {
    setBusy(paymentId);
    setError(null);
    try {
      await confirmMatch(tx.id, paymentId);
      onMatched();
    } catch (e: any) {
      setError(e?.message ?? 'Échec du rapprochement');
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Rapprochement manuel</h3>
              <p className="text-xs text-gray-500">
                {fmtEur(tx.amount)} · {fmtDate(tx.booking_date)} · {tx.counterparty ?? '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé bancaire</div>
          <div className="text-xs text-gray-700 mt-0.5">{tx.remittance_info || '—'}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Recherche de paiements…
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-10 text-gray-300">
              <Search className="w-7 h-7 mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-xs font-medium">Aucun paiement candidat</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map(c => {
                const pct = Math.round(Math.max(0, Math.min(1, c.score)) * 100);
                return (
                  <div key={c.payment_id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtEur(c.amount)}</span>
                        {c.amount_delta !== 0 && (
                          <span className={cn('text-[10px] font-bold', Math.abs(c.amount_delta) < 0.01 ? 'text-emerald-600' : 'text-amber-600')}>
                            {c.amount_delta > 0 ? '+' : ''}{c.amount_delta.toFixed(2)} €
                          </span>
                        )}
                        <span className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded',
                          pct >= 80 ? 'bg-emerald-100 text-emerald-700'
                            : pct >= 50 ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-500',
                        )}>
                          {pct}%
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {fmtDate(c.payment_date)} · {c.payment_method ?? '—'}
                        {c.reference && <span className="font-mono"> · {c.reference}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => pick(c.payment_id)}
                      disabled={!!busy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 shrink-0"
                    >
                      {busy === c.payment_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      Lier
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {error && (
            <div className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

// ─── Main View ───────────────────────────────────────────────────────────

export const BankReconciliationView: React.FC = () => {
  const [dashboard, setDashboard] = useState<CamtDashboard | null>(null);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'matched'>('all');
  const [matchTarget, setMatchTarget] = useState<BankTransaction | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const reloadHeader = useCallback(async () => {
    const [d, s] = await Promise.all([getCamtDashboard(), listBankStatements()]);
    setDashboard(d);
    setStatements(s);
    return s;
  }, []);

  const reloadTx = useCallback(async (statementId: string) => {
    setTxLoading(true);
    try { setTransactions(await listBankTransactions(statementId)); }
    finally { setTxLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await reloadHeader();
      if (s.length > 0) {
        setSelectedId(s[0].id);
        await reloadTx(s[0].id);
      }
      setLoading(false);
    })();
  }, [reloadHeader, reloadTx]);

  const selectStatement = async (id: string) => {
    setSelectedId(id);
    await reloadTx(id);
  };

  const refreshAll = async () => {
    const s = await reloadHeader();
    if (selectedId && s.some(x => x.id === selectedId)) await reloadTx(selectedId);
  };

  const handleFile = async (file: File) => {
    setBusy('import');
    try {
      const text = await file.text();
      const payload = parseCamt053(text, file.name);
      const res = await importCamtStatement(payload);
      if (res.inserted === 0) {
        flash(`Aucune nouvelle écriture (${res.duplicates} doublon(s))`, 'err');
      } else {
        const match = await autoMatchStatement(res.statement_id);
        await reloadHeader();
        setSelectedId(res.statement_id);
        await reloadTx(res.statement_id);
        flash(`${res.inserted} écriture(s) importée(s) · ${match.matched} rapprochée(s) automatiquement`);
      }
    } catch (e: any) {
      flash(e?.message ?? 'Échec de l\'import', 'err');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSample = async () => {
    setBusy('sample');
    try {
      const payload = await seedSampleCamt();
      const xml = buildCamt053(payload);
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'camt053-demo.xml';
      a.click();
      URL.revokeObjectURL(url);
      flash('Relevé de démonstration téléchargé — réimportez-le pour tester');
    } catch (e: any) {
      flash(e?.message ?? 'Échec de la génération', 'err');
    } finally {
      setBusy(null);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedId) return;
    setBusy('automatch');
    try {
      const r = await autoMatchStatement(selectedId);
      await reloadHeader();
      await reloadTx(selectedId);
      flash(`${r.matched} transaction(s) rapprochée(s) sur ${r.scanned} analysée(s)`);
    } catch (e: any) {
      flash(e?.message ?? 'Échec du rapprochement', 'err');
    } finally {
      setBusy(null);
    }
  };

  const rowAction = async (txId: string, fn: () => Promise<void>, okMsg: string) => {
    setBusy(txId);
    try {
      await fn();
      await reloadHeader();
      if (selectedId) await reloadTx(selectedId);
      flash(okMsg);
    } catch (e: any) {
      flash(e?.message ?? 'Erreur', 'err');
    } finally {
      setBusy(null);
    }
  };

  const selected = statements.find(s => s.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter(t => t.status === filter);
  }, [transactions, filter]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Relevés importés" value={String(dashboard?.statements ?? 0)} icon={FileText} tone="violet" />
        <KpiCard label="Transactions" value={String(dashboard?.transactions ?? 0)} icon={Landmark} tone="blue" />
        <KpiCard label="Rapprochées" value={String(dashboard?.matched ?? 0)} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="À rapprocher" value={String(dashboard?.unmatched ?? 0)} icon={AlertCircle} tone="amber" />
        <KpiCard label="Taux matching" value={`${dashboard?.match_rate ?? 0}%`}
          sub={`${fmtEur(dashboard?.total_matched ?? 0)} lettrés`} icon={Zap} tone="violet" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xml,application/xml,text/xml"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy === 'import'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 shadow-lg shadow-violet-600/20"
        >
          {busy === 'import' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Importer CAMT.053
        </button>
        <button
          onClick={handleSample}
          disabled={busy === 'sample'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 disabled:opacity-40"
        >
          {busy === 'sample' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Relevé de démonstration
        </button>
        <button
          onClick={refreshAll}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Rafraîchir"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      ) : statements.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 flex items-center justify-center">
            <Landmark className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mt-3">Aucun relevé bancaire</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Importez un fichier <strong>CAMT.053</strong> (ISO 20022) fourni par votre banque,
            ou téléchargez un relevé de démonstration pour tester le rapprochement automatique.
          </p>
        </div>
      ) : (
        <>
          {/* Statements */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {statements.map(s => {
              const total = s.matched + s.unmatched;
              const pct = total > 0 ? Math.round((s.matched / total) * 100) : 0;
              return (
                <button
                  key={s.id}
                  onClick={() => selectStatement(s.id)}
                  className={cn(
                    'text-left rounded-xl border-2 p-3 w-64 shrink-0 transition-all',
                    selectedId === s.id ? 'border-violet-400 bg-violet-50/50' : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-violet-600 shrink-0" strokeWidth={1.75} />
                    <span className="text-xs font-bold text-gray-900 truncate">{s.statement_ref ?? 'Relevé'}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 font-mono truncate">{s.iban ?? '—'}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {fmtDate(s.from_date)} → {fmtDate(s.to_date)} · {s.entry_count} écr.
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 font-semibold">
                    {s.matched} rapprochée(s) · {s.unmatched} en attente
                  </div>
                </button>
              );
            })}
          </div>

          {/* Transactions */}
          {selected && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Filtres :</span>
                {(['all', 'unmatched', 'matched'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-semibold rounded',
                      filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700',
                    )}
                  >
                    {f === 'all' ? 'Toutes' : f === 'unmatched' ? 'À rapprocher' : 'Rapprochées'}
                  </button>
                ))}
                <span className="text-xs text-gray-500 ml-1">{filtered.length} transaction(s)</span>
                <button
                  onClick={handleAutoMatch}
                  disabled={busy === 'automatch'}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 shadow-lg shadow-violet-600/20"
                >
                  {busy === 'automatch' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Rapprocher automatiquement
                </button>
              </div>

              {txLoading ? (
                <div className="p-10 flex items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Aucune transaction pour ce filtre.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                      <th className="px-3 py-2.5 text-left font-bold">Date</th>
                      <th className="px-3 py-2.5 text-left font-bold">Contrepartie / Libellé</th>
                      <th className="px-3 py-2.5 text-right font-bold">Montant</th>
                      <th className="px-3 py-2.5 text-center font-bold">Statut</th>
                      <th className="px-3 py-2.5 text-left font-bold">Rapprochement</th>
                      <th className="px-3 py-2.5 text-center font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(t => {
                      const rowBusy = busy === t.id;
                      const isCredit = t.credit_debit === 'CRDT';
                      return (
                        <tr key={t.id} className={cn('hover:bg-gray-50', t.status === 'ignored' && 'opacity-55')}>
                          <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDate(t.booking_date)}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-gray-900 text-xs">{t.counterparty || '—'}</div>
                            <div className="text-[11px] text-gray-400 truncate max-w-[280px]">{t.remittance_info || '—'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <span className={cn('inline-flex items-center gap-1 font-bold tabular-nums',
                              isCredit ? 'text-emerald-700' : 'text-red-600')}>
                              {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                              {isCredit ? '+' : '−'}{fmtEur(t.amount)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', STATUS[t.status].bg, STATUS[t.status].color)}>
                              {STATUS[t.status].label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {t.status === 'matched' && t.payment ? (
                              <div className="text-[11px]">
                                <span className="font-semibold text-emerald-700">
                                  {fmtEur(t.payment.amount)} · {t.payment.payment_method ?? '—'}
                                </span>
                                <div className="text-gray-400">
                                  {t.match_method}
                                  {t.match_confidence != null && ` · ${Math.round(t.match_confidence * 100)}%`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              {t.status === 'matched' ? (
                                <button
                                  onClick={() => rowAction(t.id, () => unmatchTransaction(t.id), 'Rapprochement annulé')}
                                  disabled={rowBusy}
                                  title="Annuler le rapprochement"
                                  className="p-1 rounded text-amber-600 hover:bg-amber-50 disabled:opacity-40"
                                >
                                  {rowBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                                </button>
                              ) : (
                                <>
                                  {isCredit && t.status !== 'ignored' && (
                                    <button
                                      onClick={() => setMatchTarget(t)}
                                      title="Rapprocher manuellement"
                                      className="p-1 rounded text-violet-600 hover:bg-violet-50"
                                    >
                                      <Link2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => rowAction(
                                      t.id,
                                      () => setTransactionIgnored(t.id, t.status !== 'ignored'),
                                      t.status === 'ignored' ? 'Transaction réactivée' : 'Transaction ignorée',
                                    )}
                                    disabled={rowBusy}
                                    title={t.status === 'ignored' ? 'Réactiver' : 'Ignorer'}
                                    className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                                  >
                                    {rowBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : t.status === 'ignored' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
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

      {/* Info */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex items-start gap-3 text-sm">
        <Landmark className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div className="text-violet-900">
          <strong>Rapprochement bancaire ISO 20022</strong>
          <div className="text-xs text-violet-700 mt-1">
            Les relevés <code className="bg-white px-1 rounded">camt.053</code> sont analysés écriture par écriture.
            Le moteur de matching rapproche chaque crédit d'un paiement par montant exact, proximité de date
            et correspondance de référence ; les cas ambigus sont proposés en rapprochement manuel assisté.
          </div>
        </div>
      </div>

      {matchTarget && (
        <MatchModal
          tx={matchTarget}
          onClose={() => setMatchTarget(null)}
          onMatched={async () => {
            setMatchTarget(null);
            await reloadHeader();
            if (selectedId) await reloadTx(selectedId);
            flash('Transaction rapprochée');
          }}
        />
      )}
      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
};
