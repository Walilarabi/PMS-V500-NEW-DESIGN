/**
 * FLOWTYM — Reconciliation Center.
 *
 * Single dashboard for two reconciliation flows :
 *   * OTA payouts (Booking / Expedia) ↔ payout_calculations from RIE
 *   * Hotel direct collections (BANK_HOTEL) ↔ reservations.total_amount
 *
 * UI : KPIs (total à rapprocher, matched count, % matched, écarts cumulés)
 *      + table of bank statements (filterable) + suggestions panel + manual
 *      override actions (mark matched / disputed / ignored).
 */
import React, { useMemo, useState } from 'react';
import {
  Banknote, RefreshCw, CheckCircle2, AlertTriangle, EyeOff, Plus, X,
  TrendingUp, Lock,
} from 'lucide-react';

import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import { useReservations } from '@/src/domains/reservations/hooks';
import {
  useBankStatements,
  useUpdateStatementStatus,
  useMatchStatement,
  useCreateBankStatement,
} from '@/src/domains/reconciliation/hooks';
import {
  suggestMatches,
  type PayoutLite,
  type ReservationLite,
  type MatchSuggestion,
} from '@/src/domains/reconciliation/engine';
import { supabase } from '@/src/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import type { BankStatement, ReconStatus } from '@/src/domains/reconciliation/repository';

const fmtEUR = (n: number, c = 'EUR'): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n);

const STATUS_TONE: Record<ReconStatus, string> = {
  UNMATCHED: 'bg-amber-50 text-amber-700 border-amber-100',
  MATCHED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  DISPUTED: 'bg-rose-50 text-rose-700 border-rose-100',
  IGNORED: 'bg-gray-100 text-gray-500 border-gray-200',
};
const STATUS_LABEL: Record<ReconStatus, string> = {
  UNMATCHED: 'À rapprocher',
  MATCHED: 'Rapproché',
  DISPUTED: 'En litige',
  IGNORED: 'Ignoré',
};

function usePayouts() {
  return useQuery<PayoutLite[]>({
    queryKey: ['payouts'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_calculations')
        .select('id, validation_id, reservation_id, partner_id, expected_payout, currency, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...d,
        expected_payout:
          d.expected_payout != null ? Number(d.expected_payout) : null,
      })) as PayoutLite[];
    },
  });
}

export const ReconciliationView: React.FC = () => {
  const hotelQ = useActiveHotel();
  const stmtQ = useBankStatements();
  const payoutsQ = usePayouts();
  const reservationsQ = useReservations({ limit: 200 });
  const updStatus = useUpdateStatementStatus();
  const match = useMatchStatement();
  const create = useCreateBankStatement();
  const { toast } = useToast();

  const [filter, setFilter] = useState<ReconStatus | 'ALL'>('UNMATCHED');
  const [createOpen, setCreateOpen] = useState(false);

  const statements = stmtQ.data ?? [];
  const reservations: ReservationLite[] = useMemo(
    () => (reservationsQ.data?.rows ?? []).map((r) => ({
      id: r.id,
      total_amount: r.total_amount ?? 0,
      paid_amount: r.paid_amount ?? 0,
      payment_status: r.payment_status,
      source: r.source,
      check_in: r.check_in,
      check_out: r.check_out,
    })),
    [reservationsQ.data],
  );

  const suggestions: MatchSuggestion[] = useMemo(
    () => suggestMatches(statements, payoutsQ.data ?? [], reservations),
    [statements, payoutsQ.data, reservations],
  );
  const suggestionByStmt = useMemo(() => {
    const m: Record<string, MatchSuggestion> = {};
    for (const s of suggestions) m[s.bankStatementId] = s;
    return m;
  }, [suggestions]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? statements : statements.filter((s) => s.status === filter)),
    [statements, filter],
  );

  const kpis = useMemo(() => {
    const unmatched = statements.filter((s) => s.status === 'UNMATCHED');
    const matched = statements.filter((s) => s.status === 'MATCHED');
    const matchedPct = statements.length > 0
      ? Math.round((matched.length / statements.length) * 100)
      : 0;
    const totalToReconcile = unmatched.reduce((s, x) => s + x.amount, 0);
    const totalReconciled = matched.reduce((s, x) => s + x.amount, 0);
    return { unmatched, matched, matchedPct, totalToReconcile, totalReconciled };
  }, [statements]);

  const handleApplySuggestion = async (s: MatchSuggestion) => {
    try {
      await match.mutateAsync({
        id: s.bankStatementId,
        validationId: s.kind === 'PAYOUT' ? null : null,
        reservationId: s.kind === 'RESERVATION' ? s.targetId : null,
      });
      toast({
        title: 'Rapprochement appliqué',
        description: `Confiance ${s.confidence}/100 — ${s.targetReference}`,
        variant: 'success',
      });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const handleStatus = async (id: string, status: ReconStatus) => {
    try {
      await updStatus.mutateAsync({ id, status });
      toast({ title: 'Statut mis à jour', description: STATUS_LABEL[status], variant: 'success' });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="recon-dashboard">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full space-y-5">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">
              Finance · Rapprochement
            </p>
            <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="recon-title">
              Reconciliation Center{' '}
              <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? '—'}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Rapprochement automatique payouts OTA + encaissements directs vs réservations & calculs RIE.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void stmtQ.refetch();
                void payoutsQ.refetch();
                void reservationsQ.refetch();
              }}
              data-testid="recon-refresh"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <RefreshCw size={13} className={stmtQ.isFetching ? 'animate-spin' : ''} /> Live
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              data-testid="recon-add-open"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <Plus size={13} /> Importer une ligne
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi testid="recon-kpi-unmatched" label="À rapprocher" value={String(kpis.unmatched.length)} hint={fmtEUR(kpis.totalToReconcile)} icon={AlertTriangle} tone="amber" />
          <Kpi testid="recon-kpi-matched" label="Rapprochés" value={String(kpis.matched.length)} hint={fmtEUR(kpis.totalReconciled)} icon={CheckCircle2} tone="emerald" />
          <Kpi testid="recon-kpi-pct" label="Couverture" value={`${kpis.matchedPct}%`} hint={`${statements.length} lignes`} icon={TrendingUp} tone="violet" />
          <Kpi testid="recon-kpi-suggestions" label="Suggestions auto" value={String(suggestions.length)} hint="Confiance > 40" icon={Banknote} tone="sky" />
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="recon-table">
          <header className="flex items-center justify-between p-5 border-b border-gray-100 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900">Lignes bancaires</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(['ALL', 'UNMATCHED', 'MATCHED', 'DISPUTED', 'IGNORED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  data-testid={`recon-filter-${s}`}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    filter === s
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s === 'ALL' ? 'Tous' : STATUS_LABEL[s as ReconStatus]}
                </button>
              ))}
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/70">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Source</th>
                  <th className="text-left px-4 py-3 font-semibold">Référence</th>
                  <th className="text-left px-4 py-3 font-semibold">Description</th>
                  <th className="text-right px-4 py-3 font-semibold">Montant</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold">Suggestion</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">Aucune ligne dans ce filtre.</td></tr>
                ) : (
                  filtered.map((s) => (
                    <StatementRow
                      key={s.id}
                      stmt={s}
                      suggestion={suggestionByStmt[s.id] ?? null}
                      onApplySuggestion={handleApplySuggestion}
                      onStatusChange={handleStatus}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <CreateBankStatementModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          try {
            await create.mutateAsync(input);
            toast({ title: 'Ligne importée', variant: 'success' });
            setCreateOpen(false);
          } catch (e) {
            toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
          }
        }}
      />
    </div>
  );
};

/* --------------------------------------------- KPI -------- */

interface KpiProps {
  testid?: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'amber' | 'emerald' | 'violet' | 'sky' | 'rose';
}
const TONE_BG: Record<KpiProps['tone'], string> = {
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
  sky: 'bg-sky-50 text-sky-700',
  rose: 'bg-rose-50 text-rose-700',
};
const Kpi: React.FC<KpiProps> = ({ testid, label, value, hint, icon: Icon, tone }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex items-center gap-3" data-testid={testid}>
    <span className={`grid place-items-center w-9 h-9 rounded-xl ${TONE_BG[tone]} shrink-0`}>
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-base font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[9px] text-gray-400 truncate">{hint}</p>
    </div>
  </div>
);

/* ------------------------------------------- Row --------- */

const StatementRow: React.FC<{
  stmt: BankStatement;
  suggestion: MatchSuggestion | null;
  onApplySuggestion: (s: MatchSuggestion) => void;
  onStatusChange: (id: string, status: ReconStatus) => void;
}> = ({ stmt, suggestion, onApplySuggestion, onStatusChange }) => (
  <tr className="border-t border-gray-100 hover:bg-violet-50/20" data-testid={`recon-row-${stmt.id}`}>
    <td className="px-4 py-3">
      <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
        {stmt.source}
      </span>
    </td>
    <td className="px-4 py-3 text-xs font-mono text-gray-600">{stmt.external_reference ?? '—'}</td>
    <td className="px-4 py-3 text-xs text-gray-700 max-w-[240px] truncate">{stmt.description ?? '—'}</td>
    <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">{fmtEUR(stmt.amount, stmt.currency)}</td>
    <td className="px-4 py-3 text-[11px] text-gray-500">{new Date(stmt.posted_at).toLocaleDateString('fr-FR')}</td>
    <td className="px-4 py-3">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_TONE[stmt.status]}`}>
        {STATUS_LABEL[stmt.status]}
      </span>
    </td>
    <td className="px-4 py-3 text-[11px]">
      {suggestion ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
            {suggestion.confidence}%
          </span>
          <span className="text-gray-600">{suggestion.targetReference}</span>
          <span className="text-gray-400">Δ {fmtEUR(suggestion.amountDiff, stmt.currency)}</span>
        </div>
      ) : <span className="text-gray-300">—</span>}
    </td>
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end gap-1.5">
        {suggestion && stmt.status === 'UNMATCHED' && (
          <button
            type="button"
            onClick={() => onApplySuggestion(suggestion)}
            data-testid={`recon-apply-${stmt.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold"
          >
            <CheckCircle2 size={11} /> Rapprocher
          </button>
        )}
        {stmt.status !== 'DISPUTED' && (
          <button
            type="button"
            onClick={() => onStatusChange(stmt.id, 'DISPUTED')}
            data-testid={`recon-dispute-${stmt.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold"
          >
            <AlertTriangle size={11} /> Litige
          </button>
        )}
        {stmt.status !== 'IGNORED' && (
          <button
            type="button"
            onClick={() => onStatusChange(stmt.id, 'IGNORED')}
            data-testid={`recon-ignore-${stmt.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-semibold"
          >
            <EyeOff size={11} /> Ignorer
          </button>
        )}
      </div>
    </td>
  </tr>
);

/* -------------------------------------- Create modal --- */

const CreateBankStatementModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: { source: string; externalReference: string; description: string; amount: number; postedAt: string; currency: string }) => Promise<void>;
}> = ({ isOpen, onClose, onCreate }) => {
  const [source, setSource] = useState('BOOKING');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [postedAt, setPostedAt] = useState(new Date().toISOString().slice(0, 10));

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" data-testid="recon-create-modal">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Importer une ligne bancaire</h3>
          <button type="button" onClick={onClose} data-testid="recon-create-close" className="p-1 rounded hover:bg-gray-100"><X size={16} /></button>
        </header>
        <div className="space-y-3">
          <Field label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value)} data-testid="recon-create-source" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
              <option value="BOOKING">Booking.com</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="AIRBNB">Airbnb</option>
              <option value="BANK_HOTEL">Encaissement direct</option>
            </select>
          </Field>
          <Field label="Référence externe">
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} data-testid="recon-create-ref" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="BK-PAYOUT-…" />
          </Field>
          <Field label="Description">
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="recon-create-desc" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant (EUR)">
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="recon-create-amount" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </Field>
            <Field label="Date">
              <input type="date" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} data-testid="recon-create-date" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </Field>
          </div>
        </div>
        <footer className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">Annuler</button>
          <button
            type="button"
            data-testid="recon-create-submit"
            onClick={async () => {
              const n = parseFloat(amount);
              if (!Number.isFinite(n) || n <= 0) return;
              await onCreate({
                source,
                externalReference: reference || '',
                description: description || '',
                amount: n,
                postedAt,
                currency: 'EUR',
              });
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white"
          >
            Importer
          </button>
        </footer>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export default ReconciliationView;
