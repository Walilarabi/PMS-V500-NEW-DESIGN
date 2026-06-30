/**
 * FLOWTYM RMS — Ligne du journal de décisions (audit trail).
 *
 * Trace une décision automatique : horodatage, ajustement tarifaire,
 * stratégie, confiance, statut de synchronisation Channel Manager et
 * possibilité de rollback.
 */

import React, { useState } from 'react';
import {
  ArrowRight, RotateCcw, Check, Loader2, AlertTriangle, Clock,
  Undo2, ChevronDown,
} from 'lucide-react';
import { STRATEGY_BY_ID } from '@/src/lib/rms/strategies';
import type { DecisionLogEntry, SyncStatus } from '@/src/store/rmsAutomationStore';

const SYNC_META: Record<SyncStatus, { label: string; cls: string }> = {
  pending: { label: 'Non transmis', cls: 'text-gray-500 bg-gray-100' },
  syncing: { label: 'Synchronisation…', cls: 'text-amber-600 bg-amber-50' },
  synced: { label: 'Channel Manager OK', cls: 'text-emerald-600 bg-emerald-50' },
  failed: { label: 'Échec de synchro', cls: 'text-red-600 bg-red-50' },
};

const STATUS_META: Record<DecisionLogEntry['status'], { label: string; cls: string }> = {
  applied: { label: 'Appliquée', cls: 'text-emerald-700' },
  rejected: { label: 'Rejetée', cls: 'text-gray-500' },
  rolled_back: { label: 'Annulée', cls: 'text-red-600' },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const meta = SYNC_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}
    >
      {status === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'synced' && <Check className="w-3 h-3" />}
      {status === 'failed' && <AlertTriangle className="w-3 h-3" />}
      {status === 'pending' && <Clock className="w-3 h-3" />}
      {meta.label}
    </span>
  );
}

interface DecisionRowProps {
  entry: DecisionLogEntry;
  onRollback: (id: string) => void;
  onRetrySync: (id: string) => void;
}

export const DecisionRow: React.FC<DecisionRowProps> = ({ entry, onRollback, onRetrySync }) => {
  const [open, setOpen] = useState(false);
  const strategy = STRATEGY_BY_ID[entry.strategy];
  const status = STATUS_META[entry.status];
  const isRollback = entry.kind === 'rollback';
  const delta = entry.newPrice - entry.oldPrice;
  const canRollback = entry.kind === 'decision' && entry.status === 'applied';

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 ${
        isRollback ? 'border-red-200/70 bg-red-50/40' : 'border-gray-200/80 bg-white'
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            isRollback ? 'bg-red-100' : 'bg-gray-100'
          }`}
        >
          {isRollback ? (
            <Undo2 className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <span
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: strategy.accent }}
            />
          )}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-800">
            {entry.roomType}
            <span className="text-gray-300">·</span>
            <span className="text-gray-500 font-medium">{entry.channel}</span>
          </div>
          <div className="text-[10.5px] text-gray-400">
            Séjour {entry.stayDate} · {fmtTime(entry.timestamp)} · Niveau {entry.level}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[12px] font-semibold text-gray-400 line-through">
            {entry.oldPrice} €
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-[14px] font-extrabold text-gray-900">{entry.newPrice} €</span>
          <span
            className={`text-[11px] font-bold ${
              delta >= 0 ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {delta} €
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={`text-[10.5px] font-bold ${status.cls}`}>{status.label}</span>
        <span className="text-gray-300">·</span>
        <SyncBadge status={entry.syncStatus} />
        <span className="text-gray-300">·</span>
        <span className="text-[10.5px] text-gray-400">Confiance {entry.confidence} %</span>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[10.5px] font-semibold text-[#8B5CF6] flex items-center gap-0.5"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          Facteurs
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {entry.syncStatus === 'failed' && (
            <button
              type="button"
              onClick={() => onRetrySync(entry.id)}
              className="h-7 px-2 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Relancer
            </button>
          )}
          {canRollback && (
            <button
              type="button"
              onClick={() => onRollback(entry.id)}
              className="h-7 px-2 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 flex items-center gap-1"
            >
              <Undo2 className="w-3 h-3" /> Rollback
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          {entry.note && (
            <div className="text-[11px] text-gray-500 italic mb-1">{entry.note}</div>
          )}
          <ul className="space-y-0.5">
            {entry.factors.map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-[11px] text-gray-500">
                <span className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 mt-1.5 text-[10.5px]">
            <span className="text-gray-400">Impact estimé :</span>
            <span className="font-semibold text-gray-600">
              RevPAR {entry.impact.revpar > 0 ? '+' : ''}
              {entry.impact.revpar} %
            </span>
            <span className="font-semibold text-gray-600">
              ADR {entry.impact.adr > 0 ? '+' : ''}
              {entry.impact.adr} %
            </span>
            <span className="font-semibold text-gray-600">
              TO {entry.impact.occ > 0 ? '+' : ''}
              {entry.impact.occ} pt
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
