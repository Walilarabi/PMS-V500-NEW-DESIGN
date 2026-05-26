/**
 * FLOWTYM — SAS File de quarantaine.
 * Réservations bloquées par le moteur RIE en attente de libération manuelle.
 */
import React, { useState, useMemo } from 'react';
import { Lock, RefreshCw, Search, CheckCircle2, AlertCircle, Unlock } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useSasQuarantine, useReleaseQuarantine, useSasPartners } from '@/src/domains/sas/hooks';
import type { SasQuarantineRow, QuarantineStatus } from '@/src/domains/sas/schemas';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<QuarantineStatus, { label: string; color: string; bg: string; ring: string }> = {
  QUARANTINED: { label: 'En quarantaine', color: 'text-red-700',    bg: 'bg-red-50',     ring: 'ring-red-200'    },
  RELEASED:    { label: 'Libérée',        color: 'text-emerald-700',bg: 'bg-emerald-50', ring: 'ring-emerald-200'},
  DISPUTED:    { label: 'Contestée',      color: 'text-amber-700',  bg: 'bg-amber-50',   ring: 'ring-amber-200'  },
  CANCELLED:   { label: 'Annulée',        color: 'text-slate-500',  bg: 'bg-slate-100',  ring: 'ring-slate-200'  },
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ─── Release Modal ────────────────────────────────────────────────────────────

function ReleaseModal({ row, onClose, onRelease }: {
  row: SasQuarantineRow;
  onClose: () => void;
  onRelease: (id: string, note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center">
            <Unlock size={16} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Libérer la quarantaine</h2>
            <p className="text-[11.5px] text-slate-500">Room virtuelle : {row.virtual_room ?? '—'}</p>
          </div>
        </div>
        <div className="bg-red-50 ring-1 ring-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-[12px] font-semibold text-red-700">Motif de blocage</p>
          <p className="text-[11.5px] text-red-600 mt-1">{row.reason}</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Note de libération *</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="Justification de la libération…"
            className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 resize-none" />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            onClick={() => { if (!note.trim()) return; onRelease(row.id, note.trim()); onClose(); }}
            className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700">
            Libérer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export const SasQuarantineView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<QuarantineStatus | 'ALL'>('QUARANTINED');
  const [search, setSearch]             = useState('');
  const [toRelease, setToRelease]       = useState<SasQuarantineRow | null>(null);

  const { data: qData, isLoading, refetch } = useSasQuarantine({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });
  const rows = qData && !Array.isArray(qData) ? qData.rows : (Array.isArray(qData) ? qData : []);
  const release = useReleaseQuarantine();

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.reason.toLowerCase().includes(q) || (r.virtual_room ?? '').toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [rows, search]);

  const counts = useMemo(() => ({
    QUARANTINED: rows.filter(r => r.status === 'QUARANTINED').length,
    RELEASED:    rows.filter(r => r.status === 'RELEASED').length,
    DISPUTED:    rows.filter(r => r.status === 'DISPUTED').length,
  }), [rows]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 ring-1 ring-red-100 flex items-center justify-center shrink-0">
              <Lock size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">File de quarantaine</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Réservations bloquées — libération manuelle requise</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'En quarantaine', value: counts.QUARANTINED, color: 'text-red-600',    alert: counts.QUARANTINED > 0 },
            { label: 'Libérées',       value: counts.RELEASED,    color: 'text-emerald-600', alert: false },
            { label: 'Contestées',     value: counts.DISPUTED,    color: 'text-amber-600',  alert: counts.DISPUTED > 0    },
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
            <input type="text" placeholder="Motif, chambre virtuelle…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {(['ALL', 'QUARANTINED', 'RELEASED', 'DISPUTED'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all', statusFilter === s ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
                {s === 'ALL' ? 'Toutes' : STATUS_CFG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
            <CheckCircle2 size={32} className="mb-3 text-emerald-400 opacity-70" />
            <p className="text-[13px] font-medium">Aucune réservation en quarantaine</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(row => {
              const cfg = STATUS_CFG[row.status];
              return (
                <div key={row.id} className={cn('bg-white rounded-2xl ring-1 px-5 py-4 shadow-sm flex items-start gap-4', cfg.ring)}>
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                    <Lock size={14} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-[11.5px] font-semibold text-violet-700">{row.id.slice(0,12).toUpperCase()}</span>
                      {row.virtual_room && <span className="text-[11px] text-slate-500">· Chambre virtuelle {row.virtual_room}</span>}
                      <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1', cfg.bg, cfg.ring, cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-slate-700 font-medium">{row.reason}</p>
                    <div className="flex gap-4 mt-1 text-[11px] text-slate-400">
                      <span>Bloqué : {fmtDate(row.quarantined_at)}</span>
                      {row.released_at && <span>Libéré : {fmtDate(row.released_at)}</span>}
                      {row.release_note && <span className="truncate max-w-[200px]">Note : {row.release_note}</span>}
                    </div>
                  </div>
                  {row.status === 'QUARANTINED' && (
                    <button
                      onClick={() => setToRelease(row)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 text-[12px] font-semibold hover:bg-emerald-100 shrink-0"
                    >
                      <Unlock size={12} /> Libérer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toRelease && (
        <ReleaseModal
          row={toRelease}
          onClose={() => setToRelease(null)}
          onRelease={(id, note) => release.mutate({ id, note })}
        />
      )}
    </div>
  );
};
