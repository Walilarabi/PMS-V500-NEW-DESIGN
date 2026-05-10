/**
 * FLOWTYM — Revenue Integrity Engine — SAS Dashboard.
 *
 * Top-level page exposing :
 *   * 6 KPI widgets (today's anomalies, blocked, average score, OTAs at risk,
 *     potential losses, quarantine queue size)
 *   * Validations feed (recent runs)
 *   * Anomaly list with severity tone
 *   * Quarantine queue with approve/reject actions
 *   * In-page payload simulator (runs the engine without persisting)
 */
import React, { useMemo, useState } from 'react';
import {
  ShieldCheck, Activity, AlertTriangle, GaugeCircle, Banknote, Lock, RefreshCw,
  Search, Filter, PlayCircle, CheckCircle2, XCircle,
} from 'lucide-react';

import {
  useRieConfiguration,
  useRecentValidations,
  useOpenAnomalies,
  useQuarantineQueue,
  useValidatePayload,
  useRunValidation,
  useResolveQuarantine,
} from '@/src/domains/rie/hooks';
import type { Decision, OtaPayload, Severity, ValidationOutcome } from '@/src/domains/rie/types';
import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel } from '@/src/domains/hotel/hooks';

const fmtEUR = (n: number | null | undefined): string =>
  typeof n === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)
    : '—';

const SEVERITY_TONE: Record<Severity, string> = {
  INFO: 'bg-sky-50 text-sky-700 border-sky-100',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-100',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-100',
};

const DECISION_TONE: Record<Decision, string> = {
  AUTO_INTEGRATE: 'bg-emerald-50 text-emerald-700',
  WARNING: 'bg-amber-50 text-amber-700',
  MANUAL_REVIEW: 'bg-violet-50 text-violet-700',
  QUARANTINE: 'bg-rose-50 text-rose-700',
};

const DECISION_LABEL: Record<Decision, string> = {
  AUTO_INTEGRATE: 'Auto · Intégrée',
  WARNING: 'Vigilance',
  MANUAL_REVIEW: 'Revue manuelle',
  QUARANTINE: 'Quarantaine',
};

interface ValidationRow {
  id: string;
  reservation_id: string | null;
  partner_id: string | null;
  expected_amount: number | null;
  received_amount: number | null;
  delta_amount: number | null;
  delta_pct: number | null;
  currency: string;
  score: number;
  decision: Decision;
  collection_type: string | null;
  created_at: string;
}

interface AnomalyRow {
  id: string;
  validation_id: string;
  reservation_id: string | null;
  partner_id: string | null;
  code: string;
  severity: Severity;
  message: string;
  delta_amount: number | null;
  created_at: string;
}

interface QuarantineRow {
  id: string;
  reservation_id: string | null;
  validation_id: string | null;
  status: string;
  reason: string;
  created_at: string;
}

export const RevenueIntegrityView: React.FC = () => {
  const cfgQ = useRieConfiguration();
  const validationsQ = useRecentValidations(50);
  const anomaliesQ = useOpenAnomalies(100);
  const quarantineQ = useQuarantineQueue(100);
  const hotelQ = useActiveHotel();

  const validations = (validationsQ.data ?? []) as ValidationRow[];
  const anomalies = (anomaliesQ.data ?? []) as AnomalyRow[];
  const quarantine = (quarantineQ.data ?? []) as QuarantineRow[];

  const partnerById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of cfgQ.data?.partners ?? []) m[p.id] = p.code;
    return m;
  }, [cfgQ.data]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const today = validations.filter((v) => v.created_at?.slice(0, 10) === todayKey);
  const todayAnomalies = anomalies.filter((a) => a.created_at?.slice(0, 10) === todayKey);
  const blocked = validations.filter((v) => v.decision === 'QUARANTINE').length;
  const avgScore = validations.length
    ? Math.round(validations.reduce((s, v) => s + (v.score ?? 0), 0) / validations.length)
    : 0;
  const potentialLoss = validations
    .filter((v) => v.decision === 'QUARANTINE' || v.decision === 'MANUAL_REVIEW')
    .reduce((s, v) => s + Math.abs(v.delta_amount ?? 0), 0);
  const otaAtRisk = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of validations) {
      if (v.decision === 'QUARANTINE' || v.decision === 'MANUAL_REVIEW' || v.decision === 'WARNING') {
        const k = v.partner_id ?? 'unknown';
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [validations]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="rie-dashboard">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full space-y-6">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">
              SAS · Revenue Integrity Engine
            </p>
            <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="rie-title">
              Revenue Integrity{' '}
              <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? '—'}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Validation OTA, scoring, audit financier et quarantaine — temps réel, immuable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void validationsQ.refetch();
                void anomaliesQ.refetch();
                void quarantineQ.refetch();
              }}
              data-testid="rie-refresh"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} className={validationsQ.isFetching ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
        </header>

        {/* KPI grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiTile testid="rie-kpi-today-anomalies" label="Anomalies du jour" value={String(todayAnomalies.length)} hint={`${anomalies.length} cumulées`} icon={AlertTriangle} tone="amber" />
          <KpiTile testid="rie-kpi-blocked" label="Réservations bloquées" value={String(blocked)} hint="Quarantaine" icon={Lock} tone="rose" />
          <KpiTile testid="rie-kpi-avg-score" label="Score moyen" value={`${avgScore}/100`} hint={`${validations.length} validations`} icon={GaugeCircle} tone="violet" />
          <KpiTile testid="rie-kpi-loss" label="Pertes potentielles" value={fmtEUR(potentialLoss)} hint="Écarts à valider" icon={Banknote} tone="emerald" />
          <KpiTile testid="rie-kpi-today-runs" label="Validations du jour" value={String(today.length)} hint="Live · Supabase" icon={Activity} tone="sky" />
          <KpiTile testid="rie-kpi-quarantine" label="File quarantaine" value={String(quarantine.length)} hint="À traiter" icon={ShieldCheck} tone="violet" />
        </section>

        {/* OTA at risk row */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" /> OTA à risque
          </h2>
          {otaAtRisk.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun OTA à risque sur l'historique récent.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {otaAtRisk.map(([pid, count]) => (
                <div
                  key={pid}
                  className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3"
                  data-testid={`rie-ota-risk-${partnerById[pid] ?? pid}`}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">
                      {partnerById[pid] ?? 'Inconnu'}
                    </p>
                    <p className="text-xs text-gray-500">Validations à vérifier</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-700 tabular-nums">{count}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <section className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Activity size={14} className="text-violet-600" /> Validations récentes
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Search size={12} /> {validations.length} dernières
              </div>
            </header>
            <ValidationsTable rows={validations} partnerById={partnerById} />
          </section>

          <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" /> Flux d'anomalies
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Filter size={12} /> {anomalies.length}
              </div>
            </header>
            <AnomalyFeed rows={anomalies.slice(0, 30)} />
          </section>
        </div>

        <QuarantineSection rows={quarantine} />

        <SimulatorPanel />
      </main>
    </div>
  );
};

/* --------------------------------------------------------------------- */

interface KpiTileProps {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'amber' | 'rose' | 'emerald' | 'violet' | 'sky';
  testid?: string;
}

const TONE_BG: Record<KpiTileProps['tone'], string> = {
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
  sky: 'bg-sky-50 text-sky-700',
};

const KpiTile: React.FC<KpiTileProps> = ({ label, value, hint, icon: Icon, tone, testid }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3" data-testid={testid}>
    <span className={`grid place-items-center w-10 h-10 rounded-xl ${TONE_BG[tone]} shrink-0`}>
      <Icon size={18} />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  </div>
);

/* --------------------------------------------------------------------- */

const ValidationsTable: React.FC<{ rows: ValidationRow[]; partnerById: Record<string, string> }> = ({ rows, partnerById }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-100">
    <table className="min-w-full text-sm" data-testid="rie-validations-table">
      <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/70">
        <tr>
          <th className="text-left px-3 py-2 font-semibold">OTA</th>
          <th className="text-left px-3 py-2 font-semibold">Collecte</th>
          <th className="text-right px-3 py-2 font-semibold">Attendu</th>
          <th className="text-right px-3 py-2 font-semibold">Reçu</th>
          <th className="text-right px-3 py-2 font-semibold">Écart</th>
          <th className="text-center px-3 py-2 font-semibold">Score</th>
          <th className="text-left px-3 py-2 font-semibold">Décision</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="text-center text-gray-400 py-6 text-xs">
              Aucune validation. Lance une simulation depuis le panneau ci-dessous.
            </td>
          </tr>
        ) : (
          rows.map((v) => (
            <tr key={v.id} className="border-t border-gray-100 hover:bg-violet-50/20 transition-colors" data-testid={`rie-validation-${v.id}`}>
              <td className="px-3 py-2 font-semibold text-gray-800">{v.partner_id ? partnerById[v.partner_id] ?? '—' : '—'}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{v.collection_type ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-800">{fmtEUR(v.expected_amount)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-800">{fmtEUR(v.received_amount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={Math.abs(v.delta_amount ?? 0) > 0.5 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                  {fmtEUR(v.delta_amount)}
                </span>
              </td>
              <td className="px-3 py-2 text-center font-bold tabular-nums">
                <span className={v.score >= 95 ? 'text-emerald-600' : v.score >= 85 ? 'text-amber-600' : v.score >= 70 ? 'text-violet-600' : 'text-rose-600'}>
                  {v.score}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${DECISION_TONE[v.decision]}`}>
                  {DECISION_LABEL[v.decision]}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

/* --------------------------------------------------------------------- */

const AnomalyFeed: React.FC<{ rows: AnomalyRow[] }> = ({ rows }) => (
  <div className="space-y-2 max-h-[420px] overflow-y-auto" data-testid="rie-anomaly-feed">
    {rows.length === 0 ? (
      <p className="text-xs text-gray-400 py-6 text-center">Aucune anomalie détectée.</p>
    ) : (
      rows.map((a) => (
        <div
          key={a.id}
          className={`rounded-xl border px-3 py-2 ${SEVERITY_TONE[a.severity]}`}
          data-testid={`rie-anomaly-${a.code}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider">{a.code}</span>
            <span className="text-[10px] opacity-70">{new Date(a.created_at).toLocaleTimeString('fr-FR')}</span>
          </div>
          <p className="text-xs mt-0.5">{a.message}</p>
        </div>
      ))
    )}
  </div>
);

/* --------------------------------------------------------------------- */

const QuarantineSection: React.FC<{ rows: QuarantineRow[] }> = ({ rows }) => {
  const resolve = useResolveQuarantine();
  const { toast } = useToast();
  const handleResolve = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await resolve.mutateAsync({ id, status, reason: status === 'APPROVED' ? 'Approuvé par direction' : 'Rejet manuel' });
      toast({ title: 'Quarantaine résolue', description: `Réservation ${status === 'APPROVED' ? 'approuvée' : 'rejetée'}`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
    }
  };
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" data-testid="rie-quarantine-section">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Lock size={14} className="text-rose-500" /> File de quarantaine
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">
            {rows.length} ouverte{rows.length > 1 ? 's' : ''}
          </span>
        </h2>
      </header>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">Aucune réservation en quarantaine. Tout est sous contrôle ✓</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((q) => (
            <div key={q.id} className="rounded-xl border border-rose-100 bg-rose-50/30 p-3" data-testid={`rie-quarantine-${q.id}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-rose-700">Réservation #{q.reservation_id?.slice(0, 8) ?? q.id.slice(0, 8)}</p>
                <span className="text-[10px] text-gray-500">{new Date(q.created_at).toLocaleString('fr-FR')}</span>
              </div>
              <p className="text-xs text-gray-700 mb-3 line-clamp-3">{q.reason}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleResolve(q.id, 'APPROVED')}
                  data-testid={`rie-quarantine-approve-${q.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <CheckCircle2 size={12} /> Approuver
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(q.id, 'REJECTED')}
                  data-testid={`rie-quarantine-reject-${q.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                >
                  <XCircle size={12} /> Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

/* --------------------------------------------------------------------- */
/*                         Simulator panel (test)                         */
/* --------------------------------------------------------------------- */

const SAMPLE_PAYLOADS: Record<string, OtaPayload> = {
  'Booking · Genius cohérent': {
    reference: 'SIM-BK-001',
    partner_code: 'BOOKING',
    currency: 'EUR',
    base_rate_per_night: 120,
    nights: 3,
    taxes: 18,
    promotion_code: 'GENIUS',
    promotion_amount: 36,
    commission_amount: 47.7,
    total_received: 342,
    expected_payout: 294.3,
    payment_collect: 'HOTEL',
  },
  'Expedia · OTA collect normal': {
    reference: 'SIM-EX-002',
    partner_code: 'EXPEDIA',
    currency: 'EUR',
    base_rate_per_night: 150,
    nights: 2,
    taxes: 18,
    promotion_code: 'MEMBER_RATE',
    promotion_amount: 24,
    commission_amount: 49.68,
    total_received: 294,
    expected_payout: 244.32,
    payment_collect: 'OTA',
    virtual_card: { present: true },
  },
  'Booking · sous-paiement (anomalie)': {
    reference: 'SIM-BK-003',
    partner_code: 'BOOKING',
    currency: 'EUR',
    base_rate_per_night: 200,
    nights: 4,
    taxes: 32,
    promotion_code: undefined,
    promotion_amount: 0,
    commission_amount: 124.8,
    total_received: 700,
    expected_payout: 707.2,
    payment_collect: 'HOTEL',
  },
  'Expedia · devise USD (FX + commission)': {
    reference: 'SIM-EX-004',
    partner_code: 'EXPEDIA',
    currency: 'USD',
    base_rate_per_night: 200,
    nights: 2,
    taxes: 25,
    promotion_amount: 0,
    commission_amount: 76.5,
    total_received: 425,
    expected_payout: 348.5,
    payment_collect: 'OTA',
  },
};

const SimulatorPanel: React.FC = () => {
  const [picked, setPicked] = useState<keyof typeof SAMPLE_PAYLOADS>('Booking · Genius cohérent');
  const [outcome, setOutcome] = useState<ValidationOutcome | null>(null);
  const { validate, configurationLoaded } = useValidatePayload();
  const run = useRunValidation();
  const { toast } = useToast();

  const handleSimulate = () => {
    const o = validate(SAMPLE_PAYLOADS[picked]);
    setOutcome(o);
  };

  const handleRunPersisted = async () => {
    try {
      const res = await run.mutateAsync({ payload: SAMPLE_PAYLOADS[picked], reservationId: null });
      setOutcome(res.outcome);
      toast({
        title: `Validation persistée — Score ${res.outcome.score}/100`,
        description: `Décision: ${DECISION_LABEL[res.outcome.decision]}`,
        variant: res.outcome.decision === 'AUTO_INTEGRATE' ? 'success' : 'default',
      });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" data-testid="rie-simulator">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <PlayCircle size={14} className="text-violet-600" /> Simulateur de payload OTA
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Lance le moteur sur un payload type. "Persister" écrit dans `reservation_validations` (audit immuable) et invalide les caches du dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value as keyof typeof SAMPLE_PAYLOADS)}
            data-testid="rie-simulator-select"
            className="bg-[#F7F6FB] border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700"
          >
            {Object.keys(SAMPLE_PAYLOADS).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSimulate}
            disabled={!configurationLoaded}
            data-testid="rie-simulator-dry-run"
            className="inline-flex items-center gap-2 bg-violet-100 hover:bg-violet-200 text-violet-800 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Dry-run
          </button>
          <button
            type="button"
            onClick={handleRunPersisted}
            disabled={!configurationLoaded || run.isPending}
            data-testid="rie-simulator-persist"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {run.isPending ? 'Persistance…' : 'Persister'}
          </button>
        </div>
      </header>

      {outcome && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="rie-simulator-output">
          <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Décomposition</p>
            <dl className="mt-2 space-y-1 text-xs text-gray-700">
              <Row label="Base" value={fmtEUR(outcome.breakdown.base_amount)} />
              <Row label="Promotions" value={`- ${fmtEUR(outcome.breakdown.promotion_amount)}`} />
              <Row label="Taxes" value={`+ ${fmtEUR(outcome.breakdown.tax_amount)}`} />
              <Row label="Commission" value={fmtEUR(outcome.breakdown.commission_amount)} />
              <Row label="FX adjust." value={fmtEUR(outcome.breakdown.fx_adjustment)} />
              <Row label="Arrondis" value={fmtEUR(outcome.breakdown.rounding_amount)} />
              <Row label="Attendu" value={<strong>{fmtEUR(outcome.breakdown.expected_amount)}</strong>} />
              <Row label="Reçu" value={<strong>{fmtEUR(outcome.breakdown.received_amount)}</strong>} />
              <Row label="Écart" value={<span className={Math.abs(outcome.breakdown.delta_amount) > 0.5 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{fmtEUR(outcome.breakdown.delta_amount)} ({(outcome.breakdown.delta_pct * 100).toFixed(2)} %)</span>} />
            </dl>
          </div>

          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            <p className="text-[10px] uppercase tracking-wider text-violet-700 font-semibold">Scoring & décision</p>
            <p className="text-3xl font-bold mt-2 text-gray-900 tabular-nums">{outcome.score}<span className="text-sm text-gray-400 font-normal">/100</span></p>
            <p className="text-xs text-gray-500 mt-1">Seuils auto≥{outcome.thresholds.auto} · warn≥{outcome.thresholds.warning} · manual≥{outcome.thresholds.manual}</p>
            <span className={`inline-flex items-center mt-3 px-3 py-1 rounded-full text-[11px] font-semibold ${DECISION_TONE[outcome.decision]}`}>
              {DECISION_LABEL[outcome.decision]}
            </span>
            <div className="mt-3 text-[11px] text-gray-600">
              <p><strong>Collecte :</strong> {outcome.breakdown.collection_type}</p>
              <p><strong>Détection :</strong> {outcome.breakdown.detection_path}</p>
              <p><strong>Promotions :</strong> {outcome.breakdown.promotions_applied.join(', ') || '—'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 max-h-[280px] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Anomalies détectées</p>
            {outcome.anomalies.length === 0 ? (
              <p className="text-xs text-gray-500 mt-2">Aucune anomalie · réservation propre ✓</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {outcome.anomalies.map((a, i) => (
                  <li key={`${a.code}-${i}`} className={`rounded-lg border px-2 py-1.5 text-xs ${SEVERITY_TONE[a.severity]}`}>
                    <p className="font-bold">{a.code}</p>
                    <p>{a.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-gray-500">{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
);

export default RevenueIntegrityView;
