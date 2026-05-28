/**
 * FLOWTYM — E-facture & PPF (Vague F4)
 *
 * Génération de factures électroniques au format UBL 2.1, transmission au
 * Portail Public de Facturation (PPF) avec retry à backoff exponentiel,
 * et suivi du cycle de vie réglementaire (réforme e-facture 2026).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from '@/src/hooks/useDebounce';
import {
  FileCode2, Send, RefreshCw, Loader2, Plus, Search, X, Download,
  AlertCircle, CheckCircle2, Clock, FileText, ShieldCheck, History,
  ArrowRight, Hourglass, Ban, ScrollText,
} from 'lucide-react';
import {
  getEInvoiceDashboard, listEInvoices, getEInvoiceDetail,
  issueEInvoiceFromReservation, registerEInvoiceXml, submitEInvoice,
  advanceEInvoice, buildUbl21,
  type EInvoiceDashboard, type EInvoiceListRow, type EInvoiceDetail,
  type EInvoiceLifecycle, type EInvoiceTransmission,
} from '../../services/finance/einvoice.service';
import { searchFolioReservations, type FolioReservationPick } from '../../services/finance/finance.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

// ─── Status config ───────────────────────────────────────────────────────

const LIFECYCLE: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: 'Brouillon',        color: 'text-gray-600',    bg: 'bg-gray-100' },
  deposited:      { label: 'Déposée',          color: 'text-blue-700',    bg: 'bg-blue-100' },
  received:       { label: 'Reçue PPF',        color: 'text-blue-700',    bg: 'bg-blue-100' },
  made_available: { label: 'Mise à dispo.',    color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  approved:       { label: 'Approuvée',        color: 'text-emerald-700', bg: 'bg-emerald-100' },
  disputed:       { label: 'En litige',        color: 'text-amber-700',   bg: 'bg-amber-100' },
  refused:        { label: 'Refusée',          color: 'text-red-700',     bg: 'bg-red-100' },
  payment_sent:   { label: 'Paiement transmis',color: 'text-cyan-700',    bg: 'bg-cyan-100' },
  cashed:         { label: 'Encaissée',        color: 'text-emerald-800', bg: 'bg-emerald-200' },
};

const TRANSMISSION: Record<EInvoiceTransmission, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: 'text-gray-600',    bg: 'bg-gray-100' },
  sending: { label: 'Envoi…',     color: 'text-blue-700',    bg: 'bg-blue-100' },
  sent:    { label: 'Transmise',  color: 'text-emerald-700', bg: 'bg-emerald-100' },
  failed:  { label: 'Échec',      color: 'text-red-700',     bg: 'bg-red-100' },
};

// Transitions de cycle de vie autorisées (côté destinataire / PPF aval)
const NEXT_STATES: Record<string, EInvoiceLifecycle[]> = {
  received:       ['made_available'],
  made_available: ['approved', 'disputed', 'refused'],
  approved:       ['payment_sent'],
  disputed:       ['approved', 'refused'],
  payment_sent:   ['cashed'],
};

function Badge({ cfg }: { cfg: { label: string; color: string; bg: string } }) {
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap', cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

// ─── Issue Modal (réservation → e-facture) ───────────────────────────────

function IssueModal({
  onClose, onIssued,
}: {
  onClose: () => void;
  onIssued: (submissionId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<FolioReservationPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<FolioReservationPick | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    searchFolioReservations(debouncedQuery)
      .then(r => { if (!cancelled) setResults(r); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handleIssue = async () => {
    if (!picked) return;
    setIssuing(true);
    setError(null);
    try {
      const res = await issueEInvoiceFromReservation(picked.id, 'ubl_2.1');
      onIssued(res.submission_id);
    } catch (e: any) {
      setError(e?.message ?? 'Échec de la création de la facture');
      setIssuing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Émettre une facture électronique</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Sélectionnez une réservation : la facture est générée puis préparée pour transmission au PPF.
        </p>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-violet-200">
          <Search className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPicked(null); }}
            placeholder="Nom, référence, chambre…"
            className="flex-1 text-sm focus:outline-none bg-transparent"
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
        </div>

        <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              {searching ? 'Recherche…' : 'Aucune réservation'}
            </div>
          ) : (
            results.map(r => (
              <button
                key={r.id}
                onClick={() => setPicked(r)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50',
                  picked?.id === r.id && 'bg-violet-50',
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-violet-700">{r.room_number ?? '—'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{r.guest_name}</div>
                  <div className="text-[11px] text-gray-500 font-mono">{r.reference}</div>
                </div>
                {picked?.id === r.id && <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0" />}
              </button>
            ))
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">
            Annuler
          </button>
          <button
            onClick={handleIssue}
            disabled={!picked || issuing}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
          >
            {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode2 className="w-4 h-4" />}
            Générer la facture
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────

function DetailModal({
  submissionId, onClose, onChanged,
}: {
  submissionId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<EInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'xml' | 'timeline'>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDetail(await getEInvoiceDetail(submissionId)); }
    catch (e: any) { setError(e?.message ?? 'Erreur de chargement'); }
    finally { setLoading(false); }
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  const xml = useMemo(() => {
    if (!detail) return '';
    return detail.submission.ubl_xml ?? buildUbl21(detail);
  }, [detail]);

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); await load(); onChanged(); }
    catch (e: any) { setError(e?.message ?? 'Échec de l\'opération'); }
    finally { setBusy(false); }
  };

  const handleGenerate = () => detail && runAction(() => registerEInvoiceXml(submissionId, buildUbl21(detail)));
  const handleSubmit = () => runAction(() => submitEInvoice(submissionId));
  const handleAdvance = (to: EInvoiceLifecycle) => runAction(() => advanceEInvoice(submissionId, to));

  const downloadXml = () => {
    if (!detail) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail.invoice.invoice_number}-ubl.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sub = detail?.submission;
  const nextStates = sub ? (NEXT_STATES[sub.lifecycle_status] ?? []) : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col" style={{ height: 'min(680px, 90vh)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <FileCode2 className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {detail?.invoice.invoice_number ?? 'Facture électronique'}
              </h3>
              <p className="text-xs text-gray-500">{detail?.invoice.guest_name ?? ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {([['overview', 'Synthèse', ShieldCheck], ['xml', 'UBL 2.1', ScrollText], ['timeline', 'Cycle de vie', History]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                tab === k ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100',
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
            </div>
          ) : !detail || !sub ? (
            <div className="text-center text-sm text-red-600">{error ?? 'Introuvable'}</div>
          ) : tab === 'overview' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Format" value={sub.format.toUpperCase().replace('_', ' ')} />
                <Field label="Référence PPF" value={sub.ppf_reference ?? '—'} mono />
                <Field label="Date d'émission" value={fmtDate(detail.invoice.issue_date)} />
                <Field label="Échéance" value={fmtDate(detail.invoice.due_date)} />
                <Field label="Empreinte SHA-256" value={sub.payload_hash ? sub.payload_hash.slice(0, 24) + '…' : '—'} mono />
                <Field label="Tentatives" value={`${sub.attempt_count} / ${sub.max_attempts}`} />
              </div>

              <div className="flex items-center gap-2">
                <Badge cfg={TRANSMISSION[sub.transmission_status]} />
                <Badge cfg={LIFECYCLE[sub.lifecycle_status] ?? LIFECYCLE.draft} />
              </div>

              {/* Totaux */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total HT', value: fmtEur(detail.invoice.total_ht) },
                  { label: 'TVA', value: fmtEur(detail.invoice.total_tva) },
                  { label: 'Total TTC', value: fmtEur(detail.invoice.total_ttc) },
                ].map(t => (
                  <div key={t.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.label}</div>
                    <div className="text-base font-extrabold text-gray-900 tabular-nums mt-0.5">{t.value}</div>
                  </div>
                ))}
              </div>

              {/* Lignes */}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Lignes ({detail.lines.length})
                </div>
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {detail.lines.map((l, i) => (
                    <div key={l.id ?? i} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="text-gray-700 truncate">{l.label}</span>
                      <span className="text-gray-400 shrink-0 ml-2">
                        {l.quantity}× · TVA {l.tva_rate}% ·{' '}
                        <span className="font-bold text-gray-800">{fmtEur(l.total_amount)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {sub.last_error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <strong>Dernière erreur :</strong> {sub.last_error}
                    {sub.next_retry_at && (
                      <div className="mt-0.5">Prochaine tentative : {fmtDateTime(sub.next_retry_at)}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'xml' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Document UBL 2.1 {sub.ubl_xml ? '(enregistré)' : '(aperçu)'}
                </span>
                <button
                  onClick={downloadXml}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100"
                >
                  <Download className="w-3.5 h-3.5" /> Télécharger
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-[11px] leading-relaxed overflow-auto font-mono whitespace-pre-wrap break-all">
                {xml}
              </pre>
            </div>
          ) : (
            <div>
              {detail.events.length === 0 ? (
                <div className="text-center py-8 text-gray-300">
                  <History className="w-7 h-7 mx-auto mb-1.5" strokeWidth={1.5} />
                  <p className="text-xs font-medium">Aucun événement</p>
                </div>
              ) : (
                detail.events.map((e, i) => (
                  <div key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      {i < detail.events.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="flex-1 pb-4 min-w-0">
                      <div className="text-xs font-semibold text-gray-800">{e.message ?? e.event_type}</div>
                      {(e.from_status || e.to_status) && (
                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                          {e.from_status && <span>{LIFECYCLE[e.from_status]?.label ?? e.from_status}</span>}
                          {e.from_status && e.to_status && <ArrowRight className="w-3 h-3" />}
                          {e.to_status && <span className="font-semibold">{LIFECYCLE[e.to_status]?.label ?? e.to_status}</span>}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(e.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && detail && sub && (
          <div className="px-6 py-3 border-t border-gray-100 shrink-0 space-y-2">
            {error && (
              <div className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!sub.ubl_xml && (
                <button
                  onClick={handleGenerate}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode2 className="w-3.5 h-3.5" />}
                  Générer & enregistrer l'UBL
                </button>
              )}
              {sub.ubl_xml && sub.transmission_status !== 'sent' && (
                <SubmitButton sub={sub} busy={busy} onSubmit={handleSubmit} />
              )}
              {sub.transmission_status === 'sent' && nextStates.map(s => (
                <button
                  key={s}
                  onClick={() => handleAdvance(s)}
                  disabled={busy}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border disabled:opacity-40',
                    s === 'refused' || s === 'disputed'
                      ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
                  )}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  {LIFECYCLE[s].label}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-gray-400">
                {sub.transmission_status === 'sent' ? 'Facture transmise au PPF' : 'Non transmise'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</div>
      <div className={cn('text-sm font-semibold text-gray-800 mt-0.5', mono && 'font-mono text-xs')}>{value}</div>
    </div>
  );
}

// ─── Submit / Retry button avec backoff ──────────────────────────────────

function SubmitButton({
  sub, busy, onSubmit,
}: {
  sub: { transmission_status: EInvoiceTransmission; next_retry_at: string | null; attempt_count: number; max_attempts: number };
  busy: boolean;
  onSubmit: () => void;
}) {
  const [, force] = useState(0);
  const isFailed = sub.transmission_status === 'failed';
  const exhausted = sub.attempt_count >= sub.max_attempts;
  const retryAt = sub.next_retry_at ? new Date(sub.next_retry_at).getTime() : 0;
  const waiting = isFailed && retryAt > Date.now();

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  if (exhausted) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-red-700 bg-red-50 border border-red-200">
        <Ban className="w-3.5 h-3.5" /> Tentatives épuisées
      </span>
    );
  }

  if (waiting) {
    const secs = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
        <Hourglass className="w-3.5 h-3.5" /> Backoff — réessai dans {mm}:{ss}
      </span>
    );
  }

  return (
    <button
      onClick={onSubmit}
      disabled={busy}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40',
        isFailed ? 'bg-amber-600 hover:bg-amber-700' : 'bg-violet-600 hover:bg-violet-700',
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isFailed ? <RefreshCw className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
      {isFailed ? `Réessayer (tentative ${sub.attempt_count + 1})` : 'Transmettre au PPF'}
    </button>
  );
}

// ─── KPI strip ───────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: typeof Send;
  tone: 'violet' | 'emerald' | 'amber' | 'red' | 'blue';
}) {
  const c = {
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3.5', c.bg, c.border)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">{label}</span>
        <Icon className={cn('w-4 h-4', c.text)} strokeWidth={1.75} />
      </div>
      <div className={cn('text-2xl font-extrabold', c.text)}>{value}</div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────

export const EInvoiceView: React.FC = () => {
  const [dashboard, setDashboard] = useState<EInvoiceDashboard | null>(null);
  const [rows, setRows] = useState<EInvoiceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'failed' | 'sent'>('all');
  const [showIssue, setShowIssue] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([getEInvoiceDashboard(), listEInvoices()]);
      setDashboard(d);
      setRows(l);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const quickGenerate = async (row: EInvoiceListRow) => {
    setRowBusy(row.submission_id);
    setError(null);
    try {
      const detail = await getEInvoiceDetail(row.submission_id);
      await registerEInvoiceXml(row.submission_id, buildUbl21(detail));
      await reload();
    } catch (e: any) {
      setError(e?.message ?? 'Échec de génération UBL');
    } finally {
      setRowBusy(null);
    }
  };

  const quickSubmit = async (row: EInvoiceListRow) => {
    setRowBusy(row.submission_id);
    setError(null);
    try {
      await submitEInvoice(row.submission_id);
      await reload();
    } catch (e: any) {
      setError(e?.message ?? 'Échec de transmission');
    } finally {
      setRowBusy(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => r.transmission_status === filter);
  }, [rows, filter]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="E-factures" value={String(dashboard?.total ?? 0)} icon={FileText} tone="violet" />
        <KpiCard label="Transmises" value={String(dashboard?.transmitted ?? 0)} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="En attente" value={String(dashboard?.pending ?? 0)} icon={Clock} tone="blue" />
        <KpiCard label="En échec" value={String(dashboard?.failed ?? 0)} icon={AlertCircle} tone="red" />
        <KpiCard label="Conformité" value={`${dashboard?.compliance_rate ?? 100}%`} icon={ShieldCheck} tone="amber" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Filtres :</span>
        {(['all', 'pending', 'failed', 'sent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded',
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700',
            )}
          >
            {f === 'all' ? 'Toutes' : f === 'pending' ? 'En attente' : f === 'failed' ? 'En échec' : 'Transmises'}
          </button>
        ))}
        {dashboard && dashboard.retry_waiting > 0 && (
          <span className="ml-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 font-semibold flex items-center gap-1">
            <Hourglass className="w-3 h-3" /> {dashboard.retry_waiting} en backoff
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={reload}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            title="Rafraîchir"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowIssue(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> Émettre une e-facture
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 flex items-center justify-center">
            <FileCode2 className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mt-3">Aucune facture électronique</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Émettez votre première e-facture depuis une réservation : génération UBL 2.1
            et transmission au Portail Public de Facturation.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-3 py-2.5 text-left font-bold">Facture</th>
                <th className="px-3 py-2.5 text-left font-bold">Client</th>
                <th className="px-3 py-2.5 text-right font-bold">Total TTC</th>
                <th className="px-3 py-2.5 text-center font-bold">Transmission</th>
                <th className="px-3 py-2.5 text-center font-bold">Cycle de vie</th>
                <th className="px-3 py-2.5 text-center font-bold">Tent.</th>
                <th className="px-3 py-2.5 text-left font-bold">Réf. PPF</th>
                <th className="px-3 py-2.5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => {
                const busy = rowBusy === r.submission_id;
                return (
                  <tr key={r.submission_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs font-bold text-gray-800">{r.invoice_number}</div>
                      <div className="text-[10px] text-gray-400">{fmtDate(r.issue_date)} · {r.format.toUpperCase()}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 truncate max-w-[160px]">{r.guest_name}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums">{fmtEur(r.total_ttc)}</td>
                    <td className="px-3 py-2.5 text-center"><Badge cfg={TRANSMISSION[r.transmission_status]} /></td>
                    <td className="px-3 py-2.5 text-center"><Badge cfg={LIFECYCLE[r.lifecycle_status] ?? LIFECYCLE.draft} /></td>
                    <td className="px-3 py-2.5 text-center text-xs tabular-nums text-gray-500">
                      {r.attempt_count}/{r.max_attempts}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-gray-500">{r.ppf_reference ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {!r.has_xml ? (
                          <button
                            onClick={() => quickGenerate(r)}
                            disabled={busy}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 disabled:opacity-40"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCode2 className="w-3 h-3" />}
                            UBL
                          </button>
                        ) : r.transmission_status !== 'sent' ? (
                          <RowSubmit row={r} busy={busy} onSubmit={() => quickSubmit(r)} />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                        <button
                          onClick={() => setDetailId(r.submission_id)}
                          className="px-2 py-1 rounded text-[11px] font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100"
                        >
                          Détail
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info bandeau */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex items-start gap-3 text-sm">
        <ShieldCheck className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div className="text-violet-900">
          <strong>Réforme e-facture 2026 — Portail Public de Facturation</strong>
          <div className="text-xs text-violet-700 mt-1">
            Les factures sont générées au format <code className="bg-white px-1 rounded">UBL 2.1</code> (norme EN 16931),
            scellées par empreinte SHA-256 puis transmises au PPF. En cas d'échec transitoire, la transmission
            est automatiquement reprogrammée avec un backoff exponentiel (2, 4, 8, 16, 32 min).
          </div>
        </div>
      </div>

      {showIssue && (
        <IssueModal
          onClose={() => setShowIssue(false)}
          onIssued={(id) => { setShowIssue(false); reload(); setDetailId(id); }}
        />
      )}
      {detailId && (
        <DetailModal
          submissionId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
};

function RowSubmit({ row, busy, onSubmit }: {
  row: EInvoiceListRow; busy: boolean; onSubmit: () => void;
}) {
  const [, force] = useState(0);
  const isFailed = row.transmission_status === 'failed';
  const exhausted = row.attempt_count >= row.max_attempts;
  const retryAt = row.next_retry_at ? new Date(row.next_retry_at).getTime() : 0;
  const waiting = isFailed && retryAt > Date.now();

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  if (exhausted) {
    return <span className="px-2 py-1 rounded text-[11px] font-bold text-red-700 bg-red-50 border border-red-200">Épuisé</span>;
  }
  if (waiting) {
    const secs = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return (
      <span className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
        <Hourglass className="w-3 h-3" /> {mm}:{ss}
      </span>
    );
  }
  return (
    <button
      onClick={onSubmit}
      disabled={busy}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-white disabled:opacity-40',
        isFailed ? 'bg-amber-600 hover:bg-amber-700' : 'bg-violet-600 hover:bg-violet-700',
      )}
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : isFailed ? <RefreshCw className="w-3 h-3" /> : <Send className="w-3 h-3" />}
      {isFailed ? 'Réessayer' : 'Transmettre'}
    </button>
  );
}
