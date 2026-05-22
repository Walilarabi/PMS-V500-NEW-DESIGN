/**
 * FLOWTYM — Cash Management (Vague F8)
 *
 * Prévision de trésorerie sur horizon glissant, postes prévisionnels
 * manuels, taux de change multi-devises et exports comptables Sage/Cegid.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle, Loader2, Plus, X,
  RefreshCw, Coins, FileDown, Pencil, Trash2, CheckCircle2, AlertCircle,
  CalendarClock, ArrowDownUp,
} from 'lucide-react';
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  getCashflowForecast, listCashflowEntries, saveCashflowEntry, deleteCashflowEntry,
  listCurrencyRates, upsertCurrencyRate, getAccountingJournal,
  buildSageCsv, buildCegidCsv, downloadText,
  type CashflowForecast, type CashflowEntry, type CurrencyRate,
  type FlowDirection, type Recurrence,
} from '../../services/finance/cashflow.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmtCur = (v: number, cur: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v ?? 0);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Ponctuel', weekly: 'Hebdomadaire', monthly: 'Mensuel',
};

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200';

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

function KpiCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string; icon: typeof Wallet;
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
      <div className={cn('text-xl font-extrabold tabular-nums', c.text)}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 font-medium mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Entry modal ─────────────────────────────────────────────────────────

function EntryModal({
  entry, onClose, onSaved,
}: {
  entry: CashflowEntry | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [label, setLabel] = useState(entry?.label ?? '');
  const [direction, setDirection] = useState<FlowDirection>(entry?.direction ?? 'outflow');
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [category, setCategory] = useState(entry?.category ?? '');
  const [date, setDate] = useState(entry?.expected_date ?? new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<Recurrence>(entry?.recurrence ?? 'monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!label.trim()) { setError('Libellé requis'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Montant invalide'); return; }
    setBusy(true);
    setError(null);
    try {
      await saveCashflowEntry({
        id: entry?.id ?? null,
        label: label.trim(), direction, amount: amt,
        category: category.trim() || null, expected_date: date,
        recurrence, is_active: entry?.is_active ?? true,
      });
      onSaved(entry ? 'Poste mis à jour' : 'Poste ajouté');
    } catch (e: any) {
      setError(e?.message ?? 'Échec'); setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{entry ? 'Modifier le poste' : 'Nouveau poste prévisionnel'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Libellé</label>
            <input value={label} onChange={e => setLabel(e.target.value)} autoFocus className={inputCls} placeholder="Ex: Loyer mensuel" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setDirection('inflow')}
              className={cn('flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-sm font-bold',
                direction === 'inflow' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500')}>
              <TrendingUp className="w-4 h-4" /> Entrée
            </button>
            <button onClick={() => setDirection('outflow')}
              className={cn('flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-sm font-bold',
                direction === 'outflow' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500')}>
              <TrendingDown className="w-4 h-4" /> Sortie
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Montant (€)</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} placeholder="0,00" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Échéance</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Catégorie</label>
              <input value={category} onChange={e => setCategory(e.target.value)} className={inputCls} placeholder="Ex: Charges fixes" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Récurrence</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)} className={inputCls}>
                <option value="none">Ponctuel</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
              </select>
            </div>
          </div>
          {error && <div className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">Annuler</button>
            <button onClick={submit} disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 flex items-center justify-center gap-2 disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {entry ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chart tooltip ───────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
      <div className="font-bold text-gray-900 mb-1">{fmtDate(label)}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-bold tabular-nums">{fmtCur(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────

const HORIZONS = [30, 60, 90, 180];

export const CashManagementView: React.FC = () => {
  const [horizon, setHorizon] = useState(90);
  const [currency, setCurrency] = useState('EUR');
  const [forecast, setForecast] = useState<CashflowForecast | null>(null);
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEntry, setEditEntry] = useState<CashflowEntry | null | undefined>(undefined);
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});
  const [expFrom, setExpFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [expTo, setExpTo] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const flash = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [f, e, r] = await Promise.all([
        getCashflowForecast(horizon, currency),
        listCashflowEntries(),
        listCurrencyRates(),
      ]);
      setForecast(f);
      setEntries(e);
      setRates(r);
    } catch (err: any) {
      flash(err?.message ?? 'Erreur de chargement', 'err');
    } finally {
      setLoading(false);
    }
  }, [horizon, currency]);

  useEffect(() => { reload(); }, [reload]);

  const afterEntry = async (msg: string) => {
    setEditEntry(undefined);
    flash(msg);
    await reload();
  };

  const removeEntry = async (id: string) => {
    setBusy(id);
    try { await deleteCashflowEntry(id); flash('Poste supprimé'); await reload(); }
    catch (e: any) { flash(e?.message ?? 'Erreur', 'err'); }
    finally { setBusy(null); }
  };

  const saveRate = async (quote: string) => {
    const v = parseFloat(rateDraft[quote]);
    if (!Number.isFinite(v) || v <= 0) { flash('Taux invalide', 'err'); return; }
    setBusy(quote);
    try {
      await upsertCurrencyRate(quote, v);
      flash(`Taux ${quote} mis à jour`);
      setRateDraft(d => { const n = { ...d }; delete n[quote]; return n; });
      await reload();
    } catch (e: any) { flash(e?.message ?? 'Erreur', 'err'); }
    finally { setBusy(null); }
  };

  const exportAccounting = async (format: 'sage' | 'cegid') => {
    setBusy(format);
    try {
      const lines = await getAccountingJournal(expFrom, expTo);
      if (lines.length === 0) { flash('Aucune écriture sur la période', 'err'); return; }
      const content = format === 'sage' ? buildSageCsv(lines) : buildCegidCsv(lines);
      downloadText(`export-${format}-${expFrom}_${expTo}.csv`, content);
      flash(`${lines.length} ligne(s) exportée(s) au format ${format === 'sage' ? 'Sage' : 'Cegid'}`);
    } catch (e: any) {
      flash(e?.message ?? 'Échec de l\'export', 'err');
    } finally {
      setBusy(null);
    }
  };

  const cur = forecast?.currency ?? 'EUR';
  const chartData = useMemo(
    () => (forecast?.series ?? []).map(p => ({ ...p, outflowNeg: -p.outflow })),
    [forecast],
  );
  const lowBalance = forecast ? forecast.summary.min_balance < 0 : false;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Horizon :</span>
        {HORIZONS.map(h => (
          <button key={h} onClick={() => setHorizon(h)}
            className={cn('px-2.5 py-1 text-xs font-semibold rounded',
              horizon === h ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700')}>
            {h} j
          </button>
        ))}
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-3 mr-1">Devise :</span>
        <select value={currency} onChange={e => setCurrency(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs font-semibold focus:outline-none">
          <option value="EUR">EUR</option>
          {rates.map(r => <option key={r.id} value={r.quote_currency}>{r.quote_currency}</option>)}
        </select>
        <button onClick={reload}
          className="ml-auto p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title="Rafraîchir">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Trésorerie actuelle" value={fmtCur(forecast?.opening_balance ?? 0, cur)} icon={Wallet} tone="violet" />
        <KpiCard label="Entrées prévues" value={fmtCur(forecast?.summary.total_inflow ?? 0, cur)} icon={TrendingUp} tone="emerald" />
        <KpiCard label="Sorties prévues" value={fmtCur(forecast?.summary.total_outflow ?? 0, cur)} icon={TrendingDown} tone="red" />
        <KpiCard label={`Solde à ${horizon}j`} value={fmtCur(forecast?.summary.end_balance ?? 0, cur)} icon={CalendarClock}
          tone={(forecast?.summary.end_balance ?? 0) < 0 ? 'red' : 'blue'} />
        <KpiCard label="Plancher de trésorerie" value={fmtCur(forecast?.summary.min_balance ?? 0, cur)}
          sub={forecast?.summary.min_balance_date ? `le ${fmtDate(forecast.summary.min_balance_date)}` : undefined}
          icon={AlertTriangle} tone={lowBalance ? 'red' : 'amber'} />
      </div>

      {lowBalance && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Trésorerie projetée négative le {fmtDate(forecast!.summary.min_balance_date)} — anticipez un financement ou décalez des sorties.
        </div>
      )}

      {/* Forecast chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ArrowDownUp className="w-4 h-4 text-violet-600" strokeWidth={1.75} />
          Prévision de trésorerie — {horizon} jours
        </h3>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Calcul de la projection…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={10}
                tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                minTickGap={28} />
              <YAxis stroke="#94A3B8" fontSize={10}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={42} />
              <Tooltip content={<ChartTooltip currency={cur} />} />
              <Bar dataKey="inflow" name="Entrées" fill="#10B981" radius={[2, 2, 0, 0]} barSize={6} />
              <Bar dataKey="outflowNeg" name="Sorties" fill="#EF4444" radius={[0, 0, 2, 2]} barSize={6} />
              <Area type="monotone" dataKey="balance" name="Solde projeté" stroke="#8B5CF6"
                strokeWidth={2} fill="url(#balGrad)" />
              <Line type="monotone" dataKey={() => 0} stroke="#CBD5E1" strokeWidth={1} dot={false} legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Manual entries */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Postes prévisionnels</h3>
            <button onClick={() => setEditEntry(null)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
          {entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              Aucun poste — ajoutez loyers, salaires, abonnements pour affiner la projection.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {entries.map(e => (
                <div key={e.id} className={cn('flex items-center gap-3 px-4 py-2.5', !e.is_active && 'opacity-50')}>
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                    e.direction === 'inflow' ? 'bg-emerald-100' : 'bg-red-100')}>
                    {e.direction === 'inflow'
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">{e.label}</div>
                    <div className="text-[10px] text-gray-400">
                      {RECURRENCE_LABEL[e.recurrence]} · dès le {fmtDate(e.expected_date)}
                      {e.category && ` · ${e.category}`}
                    </div>
                  </div>
                  <span className={cn('text-xs font-bold tabular-nums shrink-0',
                    e.direction === 'inflow' ? 'text-emerald-700' : 'text-red-600')}>
                    {e.direction === 'inflow' ? '+' : '−'}{fmtCur(e.amount, 'EUR')}
                  </span>
                  <button onClick={() => setEditEntry(e)} className="p-1 text-gray-400 hover:text-violet-600 shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeEntry(e.id)} disabled={busy === e.id}
                    className="p-1 text-gray-400 hover:text-red-600 shrink-0 disabled:opacity-40">
                    {busy === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Currency rates */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <Coins className="w-4 h-4 text-violet-600" strokeWidth={1.75} />
            <h3 className="text-sm font-bold text-gray-900">Taux de change</h3>
            <span className="text-[11px] text-gray-400">1 EUR = …</span>
          </div>
          {rates.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Aucune devise configurée.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rates.map(r => {
                const draft = rateDraft[r.quote_currency];
                const dirty = draft !== undefined && draft !== String(r.rate);
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-sm font-bold text-gray-900 w-12">{r.quote_currency}</span>
                    <input
                      type="number" step="0.0001"
                      value={draft ?? String(r.rate)}
                      onChange={ev => setRateDraft(d => ({ ...d, [r.quote_currency]: ev.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <span className="text-[10px] text-gray-400 w-20">maj {fmtDate(r.as_of)}</span>
                    <button onClick={() => saveRate(r.quote_currency)} disabled={!dirty || busy === r.quote_currency}
                      className="px-2 py-1 rounded text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-30">
                      {busy === r.quote_currency ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Accounting exports */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FileDown className="w-4 h-4 text-violet-600" strokeWidth={1.75} />
          Exports comptables
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Du</label>
            <input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Au</label>
            <input type="date" value={expTo} onChange={e => setExpTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none" />
          </div>
          <button onClick={() => exportAccounting('sage')} disabled={busy === 'sage'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40">
            {busy === 'sage' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Export Sage
          </button>
          <button onClick={() => exportAccounting('cegid')} disabled={busy === 'cegid'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 disabled:opacity-40">
            {busy === 'cegid' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Export Cegid
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2.5">
          Génère les écritures de ventes (factures) et de trésorerie (encaissements) sur la période,
          aux formats d'import Sage (JJ/MM/AAAA, débit/crédit) et Cegid (AAAAMMJJ, sens D/C).
        </p>
      </div>

      {editEntry !== undefined && (
        <EntryModal entry={editEntry} onClose={() => setEditEntry(undefined)} onSaved={afterEntry} />
      )}
      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
};
