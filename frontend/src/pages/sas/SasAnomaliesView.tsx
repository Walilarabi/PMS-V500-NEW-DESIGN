/**
 * FLOWTYM — SAS Anomalies détectées par le moteur RIE.
 * Affiche les validations avec anomalies : price mismatch, commission error, etc.
 */
import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, RefreshCw, Search, XCircle, AlertCircle, CheckCircle2, Eye,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useSasValidations, useSasPartners } from '@/src/domains/sas/hooks';
import type { SasValidationRow, RieDecision, AnomalyType } from '@/src/domains/sas/schemas';

// ─── Config ──────────────────────────────────────────────────────────────────

const DECISION_CFG: Record<RieDecision, { label: string; color: string; bg: string; ring: string; icon: typeof AlertTriangle }> = {
  AUTO_APPROVED: { label: 'Auto-approuvé', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', icon: CheckCircle2 },
  WARNING:       { label: 'Avertissement', color: 'text-amber-700',   bg: 'bg-amber-50',   ring: 'ring-amber-200',  icon: AlertTriangle},
  MANUAL_REVIEW: { label: 'Révision',      color: 'text-violet-700',  bg: 'bg-violet-50',  ring: 'ring-violet-200', icon: Eye          },
  QUARANTINED:   { label: 'Quarantaine',   color: 'text-red-700',     bg: 'bg-red-50',     ring: 'ring-red-200',    icon: AlertCircle  },
  BLOCKED:       { label: 'Bloqué',        color: 'text-red-900',     bg: 'bg-red-100',    ring: 'ring-red-300',    icon: XCircle      },
};

const ANOMALY_TYPE_LABEL: Record<AnomalyType, string> = {
  PRICE_MISMATCH:          'Écart de prix',
  COMMISSION_ERROR:        'Erreur commission',
  TAX_ERROR:               'Erreur TVA',
  PROMOTION_ERROR:         'Erreur promo',
  PAYOUT_ERROR:            'Erreur paiement',
  CURRENCY_ERROR:          'Erreur devise',
  ROUNDING_ERROR:          'Erreur arrondi',
  MAPPING_ERROR:           'Erreur mapping',
  COLLECTION_MODEL_ERROR:  'Erreur modèle collecte',
};

const SEVERITY_CFG = {
  LOW:      { color: 'text-slate-500',  dot: 'bg-slate-300' },
  MEDIUM:   { color: 'text-amber-600',  dot: 'bg-amber-400' },
  HIGH:     { color: 'text-red-600',    dot: 'bg-red-500'   },
  CRITICAL: { color: 'text-red-800',    dot: 'bg-red-700'   },
};

function money(v: number | null | undefined) {
  return typeof v === 'number' ? new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(v) : '—';
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
function pct(v: number | null | undefined) {
  return typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—';
}

// ─── Anomaly Detail Panel ────────────────────────────────────────────────────

function AnomalyPanel({ row, onClose, partnerName }: {
  row: SasValidationRow; onClose: () => void; partnerName: string;
}) {
  const cfg = DECISION_CFG[row.decision];
  const DecIcon = cfg.icon;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Validation RIE</p>
            <p className="text-[15px] font-bold text-slate-900">{row.id.slice(0, 12).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 text-[12px] font-semibold', cfg.bg, cfg.ring, cfg.color)}>
            <DecIcon size={12} /> {cfg.label} — Score : {Math.round(row.score)}
          </div>
          {/* Financier */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Financier</p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div><span className="text-slate-400">Attendu : </span><span className="font-semibold text-slate-800">{money(row.expected_amount)}</span></div>
              <div><span className="text-slate-400">Reçu : </span><span className="font-semibold text-slate-800">{money(row.received_amount)}</span></div>
              <div><span className="text-slate-400">Écart : </span><span className={cn('font-semibold', (row.deviation ?? 0) !== 0 ? 'text-red-600' : 'text-emerald-600')}>{money(row.deviation)}</span></div>
              <div><span className="text-slate-400">Écart % : </span><span className={cn('font-semibold', (row.deviation_pct ?? 0) !== 0 ? 'text-red-600' : 'text-emerald-600')}>{pct(row.deviation_pct)}</span></div>
              <div><span className="text-slate-400">Commission : </span>{money(row.commission_amount)}</div>
              <div><span className="text-slate-400">Partenaire : </span>{partnerName}</div>
            </div>
          </div>
          {/* Anomalies list */}
          {(row.anomalies ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Anomalies détectées</p>
              {(row.anomalies ?? []).map((a, i) => {
                const sev = SEVERITY_CFG[a.severity] ?? SEVERITY_CFG.MEDIUM;
                return (
                  <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                    <span className={cn('w-2 h-2 rounded-full mt-1 shrink-0', sev.dot)} />
                    <div>
                      <p className={cn('text-[11.5px] font-semibold', sev.color)}>
                        {ANOMALY_TYPE_LABEL[a.type] ?? a.type}
                      </p>
                      <p className="text-[11px] text-slate-500">{a.description}</p>
                      {typeof a.deviation === 'number' && <p className="text-[10.5px] text-slate-400">Écart : {a.deviation > 0 ? '+' : ''}{a.deviation.toFixed(2)} €</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-slate-400">Validé le : {fmtDate(row.validated_at)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

const FILTER_DECISIONS: (RieDecision | 'ALL')[] = ['ALL', 'WARNING', 'MANUAL_REVIEW', 'QUARANTINED', 'BLOCKED'];

export const SasAnomaliesView: React.FC = () => {
  const [decisionFilter, setDecisionFilter] = useState<RieDecision | 'ALL'>('ALL');
  const [search, setSearch]                  = useState('');
  const [selected, setSelected]              = useState<SasValidationRow | null>(null);

  const { data: vData, isLoading, refetch } = useSasValidations({
    decision: decisionFilter === 'ALL' ? undefined : decisionFilter,
  });
  const validations = vData && !Array.isArray(vData) ? vData.rows : (Array.isArray(vData) ? vData : []);
  const { data: partners = [] } = useSasPartners();

  const partnerMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of partners) m[p.id] = p.name;
    return m;
  }, [partners]);

  const anomalyRows = useMemo(() => {
    return validations.filter(v => v.decision !== 'AUTO_APPROVED');
  }, [validations]);

  const filtered = useMemo(() => {
    let list = anomalyRows;
    if (decisionFilter !== 'ALL') list = list.filter(v => v.decision === decisionFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.id.toLowerCase().includes(q) ||
        (v.partner_id ? (partnerMap[v.partner_id] ?? '').toLowerCase().includes(q) : false)
      );
    }
    return list;
  }, [anomalyRows, decisionFilter, search, partnerMap]);

  const kpis = useMemo(() => ({
    total:        anomalyRows.length,
    warnings:     anomalyRows.filter(v => v.decision === 'WARNING').length,
    manual:       anomalyRows.filter(v => v.decision === 'MANUAL_REVIEW').length,
    quarantined:  anomalyRows.filter(v => v.decision === 'QUARANTINED').length,
  }), [anomalyRows]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 ring-1 ring-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Anomalies SAS</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Écarts détectés par le moteur Revenue Integrity</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total anomalies',    value: kpis.total,       color: 'text-slate-700'   },
            { label: 'Avertissements',     value: kpis.warnings,    color: 'text-amber-600',  alert: kpis.warnings > 0   },
            { label: 'Révision manuelle',  value: kpis.manual,      color: 'text-violet-600', alert: kpis.manual > 0     },
            { label: 'Quarantaine',        value: kpis.quarantined, color: 'text-red-600',    alert: kpis.quarantined > 0},
          ].map(k => (
            <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="ID validation, partenaire…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {FILTER_DECISIONS.map(d => (
              <button key={d} onClick={() => setDecisionFilter(d)}
                className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all', decisionFilter === d ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
                {d === 'ALL' ? 'Toutes' : DECISION_CFG[d].label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <CheckCircle2 size={32} className="mb-3 text-emerald-400 opacity-70" />
              <p className="text-[13px] font-medium">Aucune anomalie détectée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['Validation ID', 'Partenaire', 'Attendu', 'Reçu', 'Écart', 'Score', 'Anomalies', 'Décision', 'Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(row => {
                    const cfg = DECISION_CFG[row.decision];
                    const DIcon = cfg.icon;
                    const hasCritical = (row.anomalies ?? []).some(a => a.severity === 'CRITICAL' || a.severity === 'HIGH');
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => setSelected(row)}>
                        <td className="px-4 py-3 font-mono text-[11px] text-violet-700">{row.id.slice(0,12).toUpperCase()}</td>
                        <td className="px-4 py-3 text-slate-600">{row.partner_id ? (partnerMap[row.partner_id] ?? '—') : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{money(row.expected_amount)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{money(row.received_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('font-semibold', (row.deviation ?? 0) !== 0 ? 'text-red-600' : 'text-emerald-600')}>
                            {money(row.deviation)} {row.deviation_pct != null && <span className="text-[10px] opacity-70">({pct(row.deviation_pct)})</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className={cn('h-full rounded-full', row.score >= 80 ? 'bg-emerald-400' : row.score >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                                style={{ width: `${Math.min(100, row.score)}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600">{Math.round(row.score)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px]">
                          {(row.anomalies ?? []).length > 0 ? (
                            <span className={cn('font-semibold', hasCritical ? 'text-red-600' : 'text-amber-600')}>
                              {(row.anomalies ?? []).length} anomalie{(row.anomalies ?? []).length > 1 ? 's' : ''}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold', cfg.bg, cfg.ring, cfg.color)}>
                            <DIcon size={10} /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400">{fmtDate(row.validated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[11px] text-slate-400">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <AnomalyPanel
          row={selected}
          onClose={() => setSelected(null)}
          partnerName={selected.partner_id ? (partnerMap[selected.partner_id] ?? '—') : '—'}
        />
      )}
    </div>
  );
};
