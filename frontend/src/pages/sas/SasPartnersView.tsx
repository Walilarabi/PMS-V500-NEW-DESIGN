/**
 * FLOWTYM — SAS Config. partenaires OTA.
 * Gestion des partenaires, commissions, et règles de scoring RIE.
 */
import React, { useState, useMemo } from 'react';
import {
  Settings, RefreshCw, Search, CheckCircle2, AlertCircle, ChevronDown,
  ChevronRight, Globe, Percent, Star,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  useSasPartners, useSasCommissions, useSasScoringRules, useSasReliability,
} from '@/src/domains/sas/hooks';
import type { SasPartnerRow, PartnerStatus, SasReliabilityRow } from '@/src/domains/sas/schemas';

// ─── Config ──────────────────────────────────────────────────────────────────

const PARTNER_STATUS_CFG: Record<PartnerStatus, { label: string; color: string; bg: string; ring: string }> = {
  active:    { label: 'Actif',    color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  suspended: { label: 'Suspendu', color: 'text-amber-700',   bg: 'bg-amber-50',   ring: 'ring-amber-200'   },
  inactive:  { label: 'Inactif',  color: 'text-slate-500',   bg: 'bg-slate-100',  ring: 'ring-slate-200'   },
};

const COLLECTION_LABEL: Record<string, string> = {
  HOTEL_COLLECT:   'Collecte hôtel',
  OTA_COLLECT:     'Collecte OTA',
  VIRTUAL_CARD:    'Carte virtuelle',
  HYBRID_COLLECT:  'Hybride',
  PAY_AT_PROPERTY: 'Paiement sur place',
};

function pct(v: number | null | undefined) {
  return typeof v === 'number' ? `${v.toFixed(1)}%` : '—';
}
function money(v: number | null | undefined) {
  return typeof v === 'number' ? new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(v) : '—';
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' });
}

// ─── Partner Card ─────────────────────────────────────────────────────────────

function PartnerCard({ partner, reliability }: { partner: SasPartnerRow; reliability?: SasReliabilityRow }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PARTNER_STATUS_CFG[partner.status];
  const { data: commissions = [] } = useSasCommissions(expanded ? partner.id : null);
  const { data: rules = [] } = useSasScoringRules(expanded ? partner.id : undefined);

  const autoRate = reliability?.auto_rate_pct;
  const avgScore = reliability?.avg_score;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
          <Globe size={18} className="text-violet-600" />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold text-slate-800">{partner.name}</p>
            <span className="font-mono text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{partner.code}</span>
            <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1', cfg.bg, cfg.ring, cfg.color)}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-400">
            <span>{partner.country ?? '—'}</span>
            <span>{partner.currency}</span>
            {partner.api_provider && <span>API: {partner.api_provider}</span>}
            {typeof autoRate === 'number' && <span>Auto-approve: {pct(autoRate)}</span>}
            {typeof avgScore === 'number' && <span>Score moy.: {avgScore.toFixed(0)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {typeof avgScore === 'number' && (
            <div className="flex items-center gap-1.5">
              <Star size={11} className="text-amber-400" />
              <span className="text-[12px] font-semibold text-slate-700">{avgScore.toFixed(0)}</span>
            </div>
          )}
          {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>

      {/* Detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/30">
          {/* Commissions */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Percent size={10} /> Commissions
            </p>
            {commissions.length === 0 ? (
              <p className="text-[12px] text-slate-400">Aucune commission configurée</p>
            ) : (
              <div className="space-y-1">
                {commissions.map(c => (
                  <div key={c.id} className="flex items-center gap-3 text-[12px] bg-white rounded-xl px-3 py-2 ring-1 ring-slate-100">
                    <span className="font-semibold text-violet-700">{pct(c.rate)}</span>
                    <span className="text-slate-500">{c.applies_to}</span>
                    <span className="text-slate-400">{fmtDate(c.valid_from)} →{c.valid_to ? fmtDate(c.valid_to) : ' ∞'}</span>
                    {c.notes && <span className="text-slate-400 truncate max-w-[120px]">{c.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scoring rules */}
          {rules.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Règles de scoring RIE</p>
              {rules.map(r => (
                <div key={r.id} className="bg-white rounded-xl px-3 py-2 ring-1 ring-slate-100 text-[11.5px] space-y-1">
                  <p className="font-semibold text-slate-700">{r.rule_name}</p>
                  <div className="flex gap-3 text-slate-500">
                    <span>Auto-approve ≥ {r.auto_approve_min}</span>
                    <span>Warning ≥ {r.warning_min}</span>
                    <span>Révision ≥ {r.manual_review_min}</span>
                    <span>Écart prix max {pct(r.price_deviation_pct)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reliability */}
          {reliability && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Fiabilité 30 jours</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Auto-approuvé',    value: pct(reliability.auto_rate_pct) },
                  { label: 'Quarantaine',       value: pct(reliability.quarantine_rate_pct) },
                  { label: 'Écart total',       value: money(reliability.total_deviation) },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl px-3 py-2 ring-1 ring-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">{s.label}</p>
                    <p className="text-[13px] font-bold text-slate-800">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export const SasPartnersView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | 'ALL'>('ALL');
  const [search, setSearch]             = useState('');

  const { data: rawPartners, isLoading, refetch } = useSasPartners();
  const { data: rawReliability } = useSasReliability();
  const partners: SasPartnerRow[] = (rawPartners ?? []) as SasPartnerRow[];
  const reliability: SasReliabilityRow[] = (rawReliability ?? []) as SasReliabilityRow[];

  const reliabilityMap = useMemo(() => {
    const m: Record<string, SasReliabilityRow> = {};
    for (const r of reliability) m[r.partner_id] = r;
    return m;
  }, [reliability]);

  const filtered = useMemo(() => {
    let list = partners;
    if (statusFilter !== 'ALL') list = list.filter(p => p.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.country ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [partners, statusFilter, search]);

  const counts = useMemo(() => ({
    active:    partners.filter(p => p.status === 'active').length,
    suspended: partners.filter(p => p.status === 'suspended').length,
    inactive:  partners.filter(p => p.status === 'inactive').length,
  }), [partners]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Settings size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Partenaires OTA</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Configuration des canaux de distribution et règles de validation</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',      value: partners.length, color: 'text-slate-700'   },
            { label: 'Actifs',     value: counts.active,   color: 'text-emerald-600' },
            { label: 'Suspendus',  value: counts.suspended,color: 'text-amber-600',   alert: counts.suspended > 0 },
            { label: 'Inactifs',   value: counts.inactive, color: 'text-slate-500'   },
          ].map(k => (
            <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-amber-200')}>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Nom, code, pays…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {(['ALL', 'active', 'suspended', 'inactive'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all', statusFilter === s ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
                {s === 'ALL' ? 'Tous' : PARTNER_STATUS_CFG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Partner list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
            <Globe size={32} className="mb-3 opacity-30" />
            <p className="text-[13px] font-medium">Aucun partenaire OTA configuré</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(filtered as SasPartnerRow[]).map((p: SasPartnerRow) => (
              <PartnerCard key={p.id} partner={p} reliability={reliabilityMap[p.id]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
