/**
 * RestrictionsModal — Poser des restrictions tarifaires sur une date.
 * Upsert dans rate_restrictions (hotel_id, room_type_code, stay_date).
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldOff, X, Check, Info } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/domains/auth/AuthContext';

interface Props {
  isOpen: boolean;
  dateStr: string | null;
  roomTypes: string[];
  onClose: () => void;
  onSaved?: () => void;
}

interface RestrictionForm {
  roomTypeCode: string;
  cta: boolean;
  ctd: boolean;
  minStay: string;
  maxStay: string;
  stopSell: boolean;
}

const Toggle: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}> = ({ label, description, checked, onChange, danger }) => (
  <div
    className={cn(
      'flex items-center justify-between rounded-xl border p-3 cursor-pointer transition',
      checked && danger ? 'border-red-200 bg-red-50' : checked ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'
    )}
    onClick={() => onChange(!checked)}
    role="checkbox"
    aria-checked={checked}
    tabIndex={0}
    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') onChange(!checked); }}
  >
    <div className="min-w-0">
      <div className={cn('text-sm font-semibold', checked && danger ? 'text-red-700' : checked ? 'text-violet-700' : 'text-slate-700')}>
        {label}
      </div>
      <div className="text-[11px] text-slate-500">{description}</div>
    </div>
    <div className={cn(
      'ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition',
      checked && danger ? 'border-red-500 bg-red-500' : checked ? 'border-violet-500 bg-violet-500' : 'border-slate-300 bg-white'
    )}>
      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
    </div>
  </div>
);

export const RestrictionsModal: React.FC<Props> = ({ isOpen, dateStr, roomTypes, onClose, onSaved }) => {
  const { session } = useAuth();
  const qc = useQueryClient();

  const allTypes = roomTypes.length ? roomTypes : ['DBL', 'SGL', 'STE'];

  const [form, setForm] = useState<RestrictionForm>({
    roomTypeCode: allTypes[0] ?? 'DBL',
    cta: false,
    ctd: false,
    minStay: '',
    maxStay: '',
    stopSell: false,
  });
  const [applyAll, setApplyAll] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setForm({ roomTypeCode: allTypes[0] ?? 'DBL', cta: false, ctd: false, minStay: '', maxStay: '', stopSell: false });
      setApplyAll(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dateStr]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!dateStr) throw new Error('Date requise');
      const hotelId = session?.tenantId;
      if (!hotelId) throw new Error('Hôtel introuvable — reconnectez-vous');

      const typesToApply = applyAll ? allTypes : [form.roomTypeCode];

      const upsertRows = typesToApply.map(rt => ({
        hotel_id: hotelId,
        room_type_code: rt,
        stay_date: dateStr,
        cta: form.cta,
        ctd: form.ctd,
        min_stay: form.minStay ? parseInt(form.minStay, 10) : null,
        max_stay: form.maxStay ? parseInt(form.maxStay, 10) : null,
        inventory: 0,
        sold: 0,
        inventory_override: form.stopSell ? 'stop_sell' : null,
        version: 1,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('rate_restrictions')
        .upsert(upsertRows, { onConflict: 'hotel_id,room_type_code,stay_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rate-restrictions'] });
      toast.success('Restrictions enregistrées');
      onSaved?.();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const hasAnyRestriction = form.cta || form.ctd || !!form.minStay || !!form.maxStay || form.stopSell;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <ShieldOff size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ajouter une restriction</h3>
                  <p className="text-[11px] text-slate-500">{dateStr ?? 'Date non définie'}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Room type selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type de chambre</span>
                  <button
                    onClick={() => setApplyAll(v => !v)}
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-md transition',
                      applyAll ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {applyAll ? '✓ Tous les types' : 'Appliquer à tous'}
                  </button>
                </div>
                {!applyAll && (
                  <div className="flex flex-wrap gap-1.5">
                    {allTypes.map(rt => (
                      <button
                        key={rt}
                        onClick={() => setForm(f => ({ ...f, roomTypeCode: rt }))}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition',
                          form.roomTypeCode === rt
                            ? 'border-violet-400 bg-violet-600 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {rt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Restrictions */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Restrictions</span>

                <Toggle
                  label="CTA — Closed to Arrival"
                  description="Interdit les arrivées ce jour"
                  checked={form.cta}
                  onChange={v => setForm(f => ({ ...f, cta: v }))}
                />
                <Toggle
                  label="CTD — Closed to Departure"
                  description="Interdit les départs ce jour"
                  checked={form.ctd}
                  onChange={v => setForm(f => ({ ...f, ctd: v }))}
                />
                <Toggle
                  label="Stop Sell"
                  description="Ferme toute disponibilité pour ce jour"
                  checked={form.stopSell}
                  onChange={v => setForm(f => ({ ...f, stopSell: v }))}
                  danger
                />
              </div>

              {/* Min/Max stay */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Séjour min (nuits)</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={form.minStay}
                    onChange={e => setForm(f => ({ ...f, minStay: e.target.value }))}
                    placeholder="—"
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Séjour max (nuits)</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={form.maxStay}
                    onChange={e => setForm(f => ({ ...f, maxStay: e.target.value }))}
                    placeholder="—"
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </label>
              </div>

              {!hasAnyRestriction && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  <Info size={12} />
                  Activez au moins une restriction avant de sauvegarder.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                onClick={onClose}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                disabled={saveMut.isPending || !hasAnyRestriction}
                onClick={() => saveMut.mutate()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition"
              >
                <ShieldOff size={14} />
                {saveMut.isPending ? 'Enregistrement…' : 'Appliquer'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
