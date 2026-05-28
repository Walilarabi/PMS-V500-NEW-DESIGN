/**
 * FLOWTYM — Multi-folios (Vague F3)
 *
 * Gestion multi-folios par réservation : jusqu'à 6 folios (guest, société,
 * master, extra), transfert inter-folios par glisser-déposer, et historique
 * immuable des transferts (qui, quand, pourquoi).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from '@/src/hooks/useDebounce';
import {
  FolderOpen, Search, Plus, Loader2, ArrowLeftRight, History, X,
  GripVertical, User, Building2, Crown, Sparkles, Receipt, AlertCircle,
} from 'lucide-react';
import {
  getReservationFolios, transferPrestationFolio, upsertReservationFolio,
  getFolioTransferHistory, searchFolioReservations,
  type ReservationFolio, type FolioReservationInfo, type FolioTransfer,
  type FolioReservationPick, type FolioType, type FolioLine,
} from '../../services/finance/finance.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);

const FOLIO_TYPES: Record<FolioType, { label: string; icon: typeof User; color: string; bg: string; border: string }> = {
  guest:   { label: 'Client',  icon: User,      color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  company: { label: 'Société', icon: Building2, color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  master:  { label: 'Master',  icon: Crown,     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  extra:   { label: 'Extra',   icon: Sparkles,  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
};

interface DragPayload {
  prestationId: string;
  sourceFolio: number;
  label: string;
  amount: number;
}

interface PendingTransfer {
  prestationId: string;
  sourceFolio: number;
  targetFolio: number;
  label: string;
  amount: number;
}

// ─── Reservation Picker ──────────────────────────────────────────────────

function ReservationPicker({ onPick }: { onPick: (r: FolioReservationPick) => void }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<FolioReservationPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchFolioReservations(debouncedQuery)
      .then(r => { if (!cancelled) setResults(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  return (
    <div className="relative max-w-xl">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-violet-200">
        <Search className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher une réservation (nom, référence, chambre)…"
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">
                {loading ? 'Recherche…' : 'Aucune réservation trouvée'}
              </div>
            ) : (
              results.map(r => (
                <button
                  key={r.id}
                  onClick={() => { onPick(r); setOpen(false); setQuery(`${r.guest_name} · ${r.reference}`); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 text-left border-b border-gray-50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-violet-700">{r.room_number ?? '—'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{r.guest_name}</div>
                    <div className="text-[11px] text-gray-500 font-mono">{r.reference} · {r.status}</div>
                  </div>
                  <div className="text-[11px] text-gray-400 shrink-0">
                    {new Date(r.check_in).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    {' → '}
                    {new Date(r.check_out).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Folio Line ──────────────────────────────────────────────────────────

function FolioLineCard({
  line, sourceFolio, onDragStart, onDragEnd, dragging,
}: {
  line: FolioLine;
  sourceFolio: number;
  onDragStart: (p: DragPayload) => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart({ prestationId: line.id, sourceFolio, label: line.label, amount: line.total_amount });
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-2 cursor-grab active:cursor-grabbing transition-all hover:border-violet-300 hover:shadow-sm',
        dragging && 'opacity-40',
      )}
    >
      <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-800 truncate">{line.label}</div>
        <div className="text-[10px] text-gray-400">
          {line.quantity}× {fmtEur(line.unit_price)}
          {line.family && <span className="ml-1 text-gray-300">· {line.family}</span>}
          {' · '}
          {new Date(line.prestation_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
        </div>
      </div>
      <div className="text-xs font-bold text-gray-900 tabular-nums shrink-0">{fmtEur(line.total_amount)}</div>
    </div>
  );
}

// ─── Folio Column ────────────────────────────────────────────────────────

function FolioColumn({
  folio, onDragStart, onDragEnd, onDrop, draggingFrom, draggingPrestation,
}: {
  folio: ReservationFolio;
  onDragStart: (p: DragPayload) => void;
  onDragEnd: () => void;
  onDrop: (targetFolio: number) => void;
  draggingFrom: number | null;
  draggingPrestation: string | null;
}) {
  const [over, setOver] = useState(false);
  const type = FOLIO_TYPES[folio.folio_type] ?? FOLIO_TYPES.guest;
  const TypeIcon = type.icon;
  const isDropTarget = draggingFrom !== null && draggingFrom !== folio.folio_number;

  return (
    <div
      onDragOver={e => { if (isDropTarget) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (isDropTarget) onDrop(folio.folio_number); }}
      className={cn(
        'flex flex-col w-72 shrink-0 rounded-xl border-2 transition-all',
        over && isDropTarget ? 'border-violet-400 bg-violet-50/60 shadow-md' : cn(type.border, 'bg-white'),
        isDropTarget && !over && 'border-dashed',
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-t-lg border-b', type.bg, type.border)}>
        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
          <TypeIcon className={cn('w-4 h-4', type.color)} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gray-900 truncate">{folio.label}</div>
          <div className={cn('text-[10px] font-semibold uppercase tracking-wide', type.color)}>
            Folio {folio.folio_number} · {type.label}
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="flex-1 p-2 space-y-1.5 min-h-[120px]">
        {folio.lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-300">
            <Receipt className="w-6 h-6 mb-1" strokeWidth={1.5} />
            <span className="text-[11px] font-medium">
              {isDropTarget ? 'Déposer ici' : 'Aucune prestation'}
            </span>
          </div>
        ) : (
          folio.lines.map(line => (
            <FolioLineCard
              key={line.id}
              line={line}
              sourceFolio={folio.folio_number}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              dragging={draggingPrestation === line.id}
            />
          ))
        )}
      </div>

      {/* Total */}
      <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total TTC</span>
        <span className="text-sm font-extrabold text-gray-900 tabular-nums">{fmtEur(folio.total_ttc)}</span>
      </div>
    </div>
  );
}

// ─── Transfer Confirmation Modal ─────────────────────────────────────────

function TransferModal({
  pending, onConfirm, onCancel, loading,
}: {
  pending: PendingTransfer;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Transfert de prestation</h3>
            <p className="text-xs text-gray-500">Folio {pending.sourceFolio} → Folio {pending.targetFolio}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 truncate">{pending.label}</span>
          <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0 ml-2">{fmtEur(pending.amount)}</span>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
            Motif du transfert (optionnel)
          </label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex: Refacturation sur le compte société"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>

        <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Le transfert est tracé de façon immuable (qui, quand, pourquoi) dans l'historique.</span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Folio Modal ─────────────────────────────────────────────────────

function AddFolioModal({
  nextNumber, onConfirm, onCancel, loading,
}: {
  nextNumber: number;
  onConfirm: (label: string, type: FolioType) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FolioType>('extra');
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Nouveau folio</h3>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
            Intitulé du folio
          </label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={`Folio ${nextNumber}`}
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
            Type de folio
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FOLIO_TYPES) as FolioType[]).map(t => {
              const c = FOLIO_TYPES[t];
              const Icon = c.icon;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all',
                    type === t ? cn(c.border, c.bg) : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <Icon className={cn('w-4 h-4', type === t ? c.color : 'text-gray-400')} strokeWidth={1.75} />
                  <span className={cn('text-sm font-semibold', type === t ? c.color : 'text-gray-600')}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(label.trim() || `Folio ${nextNumber}`, type)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer le folio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transfer History Timeline ───────────────────────────────────────────

function TransferHistory({ transfers }: { transfers: FolioTransfer[] }) {
  if (transfers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-300">
        <History className="w-7 h-7 mx-auto mb-1.5" strokeWidth={1.5} />
        <p className="text-xs font-medium">Aucun transfert enregistré</p>
      </div>
    );
  }
  return (
    <div className="space-y-0">
      {transfers.map((t, i) => (
        <div key={t.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-3.5 h-3.5 text-violet-600" />
            </div>
            {i < transfers.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
          </div>
          <div className="flex-1 pb-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-800 truncate">{t.description ?? 'Prestation'}</span>
              <span className="text-xs font-bold text-gray-900 tabular-nums shrink-0">{fmtEur(t.amount_ttc ?? 0)}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{t.reason ?? 'Transfert inter-folios'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {new Date(t.transferred_at).toLocaleString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────

export const FoliosView: React.FC = () => {
  const [reservation, setReservation] = useState<FolioReservationInfo | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [folios, setFolios] = useState<ReservationFolio[]>([]);
  const [transfers, setTransfers] = useState<FolioTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [pending, setPending] = useState<PendingTransfer | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [showAddFolio, setShowAddFolio] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const loadFolios = useCallback(async (resId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [res, hist] = await Promise.all([
        getReservationFolios(resId),
        getFolioTransferHistory(resId),
      ]);
      setReservation(res.reservation);
      setFolios(res.folios ?? []);
      setTransfers(hist);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement des folios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (reservationId) loadFolios(reservationId);
  }, [reservationId, loadFolios]);

  const handlePick = (r: FolioReservationPick) => {
    setReservationId(r.id);
  };

  const handleDrop = (targetFolio: number) => {
    if (!drag || drag.sourceFolio === targetFolio) { setDrag(null); return; }
    setPending({
      prestationId: drag.prestationId,
      sourceFolio: drag.sourceFolio,
      targetFolio,
      label: drag.label,
      amount: drag.amount,
    });
    setDrag(null);
  };

  const confirmTransfer = async (reason: string) => {
    if (!pending || !reservationId) return;
    setTransferLoading(true);
    try {
      await transferPrestationFolio(pending.prestationId, pending.targetFolio, reason || undefined);
      setPending(null);
      await loadFolios(reservationId);
    } catch (e: any) {
      setError(e?.message ?? 'Échec du transfert');
    } finally {
      setTransferLoading(false);
    }
  };

  const nextFolioNumber = useMemo(() => {
    const used = new Set(folios.map(f => f.folio_number));
    for (let i = 1; i <= 6; i++) if (!used.has(i)) return i;
    return 0;
  }, [folios]);

  const confirmAddFolio = async (label: string, type: FolioType) => {
    if (!reservationId || nextFolioNumber === 0) return;
    setAddLoading(true);
    try {
      await upsertReservationFolio(reservationId, nextFolioNumber, label, type);
      setShowAddFolio(false);
      await loadFolios(reservationId);
    } catch (e: any) {
      setError(e?.message ?? 'Échec de création du folio');
    } finally {
      setAddLoading(false);
    }
  };

  const grandTotal = useMemo(() => folios.reduce((s, f) => s + Number(f.total_ttc || 0), 0), [folios]);

  return (
    <div className="space-y-4">
      {/* Picker */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-violet-600" strokeWidth={1.75} />
          <h3 className="text-sm font-bold text-gray-900">Sélectionner une réservation</h3>
        </div>
        <ReservationPicker onPick={handlePick} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!reservationId && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mt-3">Gestion multi-folios</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Recherchez une réservation pour répartir ses prestations sur plusieurs folios
            (client, société, master, extra) et transférer des lignes par glisser-déposer.
          </p>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement des folios…
        </div>
      )}

      {reservationId && !loading && reservation && (
        <>
          {/* Reservation banner */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-base font-bold text-gray-900">{reservation.guest_name}</div>
              <div className="text-xs text-gray-500 font-mono">{reservation.reference}</div>
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-semibold">Chambre</span> {reservation.room_number ?? '—'}
            </div>
            <div className="text-xs text-gray-600">
              {new Date(reservation.check_in).toLocaleDateString('fr-FR')}
              {' → '}
              {new Date(reservation.check_out).toLocaleDateString('fr-FR')}
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total folios</div>
                <div className="text-lg font-extrabold text-gray-900 tabular-nums">{fmtEur(grandTotal)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Solde résa</div>
                <div className={cn('text-lg font-extrabold tabular-nums', Number(reservation.solde) > 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {fmtEur(reservation.solde)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            {/* Folios board */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-violet-600" strokeWidth={1.75} />
                  Folios — glisser-déposer pour transférer
                </h3>
                {nextFolioNumber > 0 && (
                  <button
                    onClick={() => setShowAddFolio(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter folio
                  </button>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {folios.map(f => (
                  <FolioColumn
                    key={f.folio_number}
                    folio={f}
                    onDragStart={setDrag}
                    onDragEnd={() => setDrag(null)}
                    onDrop={handleDrop}
                    draggingFrom={drag?.sourceFolio ?? null}
                    draggingPrestation={drag?.prestationId ?? null}
                  />
                ))}
                {folios.length === 0 && (
                  <div className="text-sm text-gray-400 py-8 px-4">Aucun folio actif pour cette réservation.</div>
                )}
              </div>
            </div>

            {/* History */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-violet-600" strokeWidth={1.75} />
                Historique des transferts
              </h3>
              <TransferHistory transfers={transfers} />
            </div>
          </div>
        </>
      )}

      {pending && (
        <TransferModal
          pending={pending}
          loading={transferLoading}
          onConfirm={confirmTransfer}
          onCancel={() => setPending(null)}
        />
      )}
      {showAddFolio && nextFolioNumber > 0 && (
        <AddFolioModal
          nextNumber={nextFolioNumber}
          loading={addLoading}
          onConfirm={confirmAddFolio}
          onCancel={() => setShowAddFolio(false)}
        />
      )}
    </div>
  );
};
