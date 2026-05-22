/**
 * FLOWTYM — GDPR Request Modal (Wave C8)
 *
 * Create a new GDPR request (access / erasure / portability / …)
 * or resolve an existing one inline.
 */

import React, { useState } from 'react';
import { X, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useCreateGdprRequest, useResolveGdprRequest } from '@/src/services/crm/hooks';
import {
  REQUEST_TYPE_META,
  REQUEST_STATUS_META,
  type GdprRequest,
  type GdprRequestType,
  type GdprRequestStatus,
} from '@/src/services/crm/gdpr.service';
import { useGuests } from '@/src/domains/guests/hooks';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

interface Props {
  /** null → create mode; GdprRequest → resolve mode */
  request: GdprRequest | null;
  onClose: () => void;
}

export const GdprRequestModal: React.FC<Props> = ({ request, onClose }) => {
  const isResolve = request !== null;

  // ── Create mode state ──────────────────────────────────────────────────────
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [selectedGuestName, setSelectedGuestName] = useState('');
  const [requestType, setRequestType] = useState<GdprRequestType>('access');
  const [notes, setNotes]             = useState('');

  // ── Resolve mode state ─────────────────────────────────────────────────────
  const [newStatus, setNewStatus]   = useState<GdprRequestStatus>('completed');
  const [resolution, setResolution] = useState('');

  const guestsQ  = useGuests({ search: guestSearch, limit: 8 });
  const create   = useCreateGdprRequest();
  const resolve  = useResolveGdprRequest();

  const handleCreate = async () => {
    if (!selectedGuestId) return;
    await create.mutateAsync({ guestId: selectedGuestId, requestType, notes });
    onClose();
  };

  const handleResolve = async () => {
    if (!request) return;
    await resolve.mutateAsync({
      requestId: request.id,
      status:    newStatus,
      resolution,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8B5CF6]/10">
              <ShieldCheck size={16} className="text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-gray-900">
                {isResolve ? 'Traiter la demande RGPD' : 'Nouvelle demande RGPD'}
              </h2>
              {isResolve && (
                <p className="text-[11px] text-gray-400">
                  {request.guest_name ?? '—'} · {REQUEST_TYPE_META[request.request_type]?.label}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {isResolve ? (
            /* ── Resolve form ─────────────────────────────────────────────── */
            <>
              {/* Status selector */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Nouveau statut
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['processing', 'completed', 'rejected'] as GdprRequestStatus[]).map((s) => {
                    const meta = REQUEST_STATUS_META[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewStatus(s)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-[12px] font-bold transition-all',
                          newStatus === s
                            ? 'border-current'
                            : 'border-gray-100 text-gray-400 hover:border-gray-200',
                        )}
                        style={
                          newStatus === s
                            ? { color: meta.color, backgroundColor: meta.bg, borderColor: meta.color + '40' }
                            : undefined
                        }
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resolution note */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Note de résolution
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={3}
                  placeholder="Décrivez l'action prise…"
                  className="w-full text-[12px] border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#8B5CF6] resize-none"
                />
              </div>

              {/* Existing info */}
              {request.notes && (
                <div className="p-3 bg-gray-50 rounded-xl text-[11px] text-gray-500">
                  <span className="font-bold text-gray-700">Note initiale : </span>
                  {request.notes}
                </div>
              )}
            </>
          ) : (
            /* ── Create form ──────────────────────────────────────────────── */
            <>
              {/* Guest search */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Client concerné
                </label>
                {selectedGuestId ? (
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-[#8B5CF6]" />
                      <span className="text-[12px] font-bold text-gray-900">{selectedGuestName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedGuestId(''); setSelectedGuestName(''); setGuestSearch(''); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                      placeholder="Rechercher un client…"
                      className="w-full text-[12px] border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#8B5CF6]"
                    />
                    {guestSearch.length > 1 && (
                      <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden">
                        {guestsQ.isLoading ? (
                          <div className="p-3 text-center text-[11px] text-gray-400">Recherche…</div>
                        ) : (guestsQ.data?.rows ?? []).length === 0 ? (
                          <div className="p-3 text-center text-[11px] text-gray-400">Aucun résultat</div>
                        ) : (
                          (guestsQ.data?.rows ?? []).map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setSelectedGuestId(g.id);
                                setSelectedGuestName(
                                  [g.first_name, g.last_name].filter(Boolean).join(' '),
                                );
                                setGuestSearch('');
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-0"
                            >
                              <div className="w-7 h-7 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[10px] font-bold text-[#8B5CF6] shrink-0">
                                {(g.first_name?.[0] ?? g.last_name?.[0] ?? '?').toUpperCase()}
                              </div>
                              <div>
                                <div className="text-[12px] font-bold text-gray-900">
                                  {[g.first_name, g.last_name].filter(Boolean).join(' ')}
                                </div>
                                <div className="text-[10px] text-gray-400">{g.email ?? '—'}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Request type */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Type de demande
                </label>
                <div className="space-y-1.5">
                  {(Object.entries(REQUEST_TYPE_META) as [GdprRequestType, typeof REQUEST_TYPE_META[GdprRequestType]][]).map(
                    ([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRequestType(key)}
                        className={cn(
                          'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all',
                          requestType === key
                            ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/5'
                            : 'border-gray-100 hover:border-gray-200',
                        )}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
                          style={{ background: meta.color }}
                        />
                        <div>
                          <div className="text-[12px] font-bold text-gray-900">{meta.label}</div>
                          <div className="text-[10px] text-gray-400">{meta.description}</div>
                        </div>
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Notes (facultatif)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Contexte, référence e-mail…"
                  className="w-full text-[12px] border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#8B5CF6] resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          {isResolve ? (
            <Button
              size="sm"
              onClick={handleResolve}
              disabled={resolve.isPending}
            >
              {resolve.isPending && <Loader2 size={12} className="animate-spin" />}
              Enregistrer
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!selectedGuestId || create.isPending}
            >
              {create.isPending && <Loader2 size={12} className="animate-spin" />}
              Créer la demande
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GdprRequestModal;
