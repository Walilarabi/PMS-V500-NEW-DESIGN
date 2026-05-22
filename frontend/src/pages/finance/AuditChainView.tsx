/**
 * FLOWTYM — Journal d'audit chaîné (Vague F7)
 *
 * Chaque entrée du journal est scellée par une empreinte SHA-256 chaînée
 * à la précédente. La vérification recalcule toute la chaîne et révèle
 * la moindre altération ou suppression.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, Loader2, RefreshCw, Link2, Hash, Fingerprint,
  AlertTriangle, Users, Layers, FileSearch,
} from 'lucide-react';
import {
  verifyAuditChain, getAuditChainStats, listAuditChain,
  type AuditChainEntry, type AuditChainVerification, type AuditChainStats,
} from '../../services/finance/auditchain.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
const shortHash = (h: string | null) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—');

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Hash }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</span>
        <Icon className="w-4 h-4 text-violet-500" strokeWidth={1.75} />
      </div>
      <div className="text-2xl font-extrabold text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

export const AuditChainView: React.FC = () => {
  const [verification, setVerification] = useState<AuditChainVerification | null>(null);
  const [stats, setStats] = useState<AuditChainStats | null>(null);
  const [entries, setEntries] = useState<AuditChainEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string>('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [v, s, l] = await Promise.all([
        verifyAuditChain(),
        getAuditChainStats(),
        listAuditChain(150, 0),
      ]);
      setVerification(v);
      setStats(s);
      setEntries(l);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const runVerify = async () => {
    setVerifying(true);
    try { setVerification(await verifyAuditChain()); }
    finally { setVerifying(false); }
  };

  const entities = useMemo(
    () => Array.from(new Set(entries.map(e => e.entity).filter(Boolean))).sort() as string[],
    [entries],
  );
  const filtered = useMemo(
    () => (entityFilter ? entries.filter(e => e.entity === entityFilter) : entries),
    [entries, entityFilter],
  );

  const valid = verification?.valid ?? true;

  return (
    <div className="space-y-4">
      {/* Verification banner */}
      <div className={cn(
        'rounded-xl border-2 p-5 flex items-center gap-4',
        loading ? 'border-gray-200 bg-gray-50'
          : valid ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50',
      )}>
        <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
          loading ? 'bg-gray-200' : valid ? 'bg-emerald-600' : 'bg-red-600')}>
          {loading
            ? <Loader2 className="w-7 h-7 text-gray-500 animate-spin" />
            : valid
              ? <ShieldCheck className="w-7 h-7 text-white" strokeWidth={2} />
              : <ShieldAlert className="w-7 h-7 text-white" strokeWidth={2} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-lg font-extrabold',
            loading ? 'text-gray-500' : valid ? 'text-emerald-800' : 'text-red-800')}>
            {loading ? 'Vérification de la chaîne…'
              : valid ? 'Chaîne d\'audit intègre' : 'Intégrité compromise'}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {verification ? (
              valid
                ? `${verification.verified} entrée(s) vérifiée(s) — chaque empreinte SHA-256 correspond à son maillon.`
                : `Rupture détectée à l'entrée n°${verification.first_break_seq} : ${verification.break_reason}.`
            ) : 'Analyse en cours…'}
          </div>
          {verification?.last_hash && (
            <div className="text-[11px] text-gray-500 font-mono mt-1 flex items-center gap-1">
              <Fingerprint className="w-3 h-3" /> Empreinte de tête : {shortHash(verification.last_hash)}
            </div>
          )}
        </div>
        <button
          onClick={runVerify}
          disabled={verifying || loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 shadow-lg shadow-violet-600/20 shrink-0"
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Vérifier l'intégrité
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Entrées du journal" value={String(stats?.total ?? 0)} icon={Layers} />
        <KpiCard label="Entrées chaînées" value={String(stats?.chained ?? 0)} icon={Link2} />
        <KpiCard label="Acteurs distincts" value={String(stats?.actors ?? 0)} icon={Users} />
        <KpiCard label="Dernier maillon" value={`#${stats?.last_seq ?? 0}`} icon={Hash} />
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Entité :</span>
        <button
          onClick={() => setEntityFilter('')}
          className={cn('px-2.5 py-1 text-xs font-semibold rounded',
            entityFilter === '' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700')}
        >
          Toutes
        </button>
        {entities.slice(0, 8).map(e => (
          <button
            key={e}
            onClick={() => setEntityFilter(e)}
            className={cn('px-2.5 py-1 text-xs font-semibold rounded',
              entityFilter === e ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700')}
          >
            {e}
          </button>
        ))}
        <button
          onClick={reload}
          className="ml-auto p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Rafraîchir"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Chain table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <FileSearch className="w-10 h-10 mx-auto text-gray-300" strokeWidth={1.5} />
          <h3 className="text-base font-bold text-gray-700 mt-3">Aucune entrée d'audit</h3>
          <p className="text-sm text-gray-500 mt-1">Le journal se remplit à chaque opération sensible.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-3 py-2.5 text-left font-bold">#</th>
                <th className="px-3 py-2.5 text-left font-bold">Horodatage</th>
                <th className="px-3 py-2.5 text-left font-bold">Entité / Action</th>
                <th className="px-3 py-2.5 text-left font-bold">Acteur</th>
                <th className="px-3 py-2.5 text-left font-bold">Empreinte SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(e => {
                const broken = verification && !verification.valid
                  && verification.first_break_seq != null && e.seq >= verification.first_break_seq;
                return (
                  <tr key={e.id} className={cn('hover:bg-gray-50', broken && 'bg-red-50/50')}>
                    <td className="px-3 py-2 font-mono text-xs font-bold text-gray-500">{e.seq}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(e.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs font-semibold text-gray-900">{e.entity ?? '—'}</div>
                      <div className="text-[11px] text-gray-500">{e.action ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{e.actor_label ?? 'Système'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {broken
                          ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          : <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        <span className="font-mono text-[11px] text-gray-600" title={e.entry_hash}>
                          {shortHash(e.entry_hash)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex items-start gap-3 text-sm">
        <Fingerprint className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div className="text-violet-900">
          <strong>Journal d'audit infalsifiable</strong>
          <div className="text-xs text-violet-700 mt-1">
            Chaque entrée intègre l'empreinte <code className="bg-white px-1 rounded">SHA-256</code> de la
            précédente : modifier ou supprimer une entrée briserait tous les maillons suivants.
            La vérification recalcule l'intégralité de la chaîne et localise la première rupture.
          </div>
        </div>
      </div>
    </div>
  );
};
