/**
 * FLOWTYM — ConfirmMove dialog (legacy "délogement" with supplement modes).
 *
 * When a reservation is dragged to a room of DIFFERENT category, the user
 * is asked if a price differential should apply :
 *   • Auto    : (newPrice - oldPrice) * nights  → applied to total_amount
 *   • night   : custom € per night
 *   • total   : custom € total
 *   • free    : no price change (upgrade offert)
 */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, Gift } from 'lucide-react';

import { fmtEUR } from './types';

export interface ConfirmMovePayload {
  reservationId: string;
  fromVersion: number;
  fromRoomNumber: string | null;
  toRoomNumber: string;
  toRoomId: string;
  oldCategory: string | null;
  newCategory: string | null;
  oldPrice: number;
  newPrice: number;
  nights: number;
  currentTotal: number;
  newCheckIn?: string;
  newCheckOut?: string;
}

export type CustomMode = 'night' | 'total' | 'free';

interface Props {
  payload: ConfirmMovePayload | null;
  onConfirm: (deltaTotal: number, note: string) => void;
  onClose: () => void;
}

export const ConfirmMoveDialog: React.FC<Props> = ({ payload, onConfirm, onClose }) => {
  const [customizing, setCustomizing] = useState(false);
  const [mode, setMode] = useState<CustomMode>('night');
  const [supplement, setSupplement] = useState<string>('');

  const autoDiff = useMemo(() => {
    if (!payload) return 0;
    return (payload.newPrice - payload.oldPrice) * payload.nights;
  }, [payload]);

  const customDiff = useMemo(() => {
    if (!payload) return 0;
    const n = parseFloat(supplement);
    if (!Number.isFinite(n)) return 0;
    if (mode === 'free') return 0;
    if (mode === 'night') return n * payload.nights;
    return n; // total
  }, [supplement, mode, payload]);

  const finalDiff = customizing ? customDiff : autoDiff;
  const newTotal = (payload?.currentTotal ?? 0) + finalDiff;

  const reset = () => {
    setCustomizing(false);
    setMode('night');
    setSupplement('');
  };

  const handleConfirm = () => {
    if (!payload) return;
    let note = `Délogement ${payload.fromRoomNumber ?? '—'} → ${payload.toRoomNumber} `;
    if (customizing) {
      if (mode === 'free') note += '· surclassement offert';
      else if (mode === 'night') note += `· supplément ${supplement}€/nuit`;
      else note += `· supplément total ${supplement}€`;
    } else {
      note += `· tarif majoré ${payload.newPrice}€/nuit (Δ ${fmtEUR(autoDiff, 2)})`;
    }
    onConfirm(finalDiff, note);
    reset();
  };

  const handleIgnore = () => {
    if (!payload) return;
    const note = `Délogement ${payload.fromRoomNumber ?? '—'} → ${payload.toRoomNumber} sans changement de prix`;
    onConfirm(0, note);
    reset();
  };

  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          data-testid="planning-confirm-move"
        >
          <motion.div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl"
            initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-indigo-600">Délogement</p>
                <h3 className="text-lg font-bold text-gray-900 mt-1">
                  Catégorie différente détectée
                </h3>
              </div>
              <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-500" /></button>
            </header>

            <div className="rounded-xl bg-indigo-50/40 border border-indigo-100 p-3 flex items-center gap-2 mb-3 text-xs">
              <span className="font-bold text-gray-700">{payload?.fromRoomNumber ?? '—'}</span>
              <span className="text-gray-400">{payload?.oldCategory}</span>
              <ArrowRight size={14} className="text-indigo-500 mx-1" />
              <span className="font-bold text-indigo-700">{payload?.toRoomNumber}</span>
              <span className="text-indigo-400">{payload?.newCategory}</span>
              <span className="ml-auto text-[11px] text-gray-500 tabular-nums">{payload?.nights}n</span>
            </div>

            {!customizing ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Stat label="Ancien tarif" value={fmtEUR(payload?.oldPrice, 0)} />
                  <Stat label="Nouveau tarif" value={fmtEUR(payload?.newPrice, 0)} tone="indigo" />
                  <Stat label="Total actuel" value={fmtEUR(payload?.currentTotal, 0)} />
                  <Stat label="Total après" value={fmtEUR(newTotal, 0)} tone={finalDiff > 0 ? 'rose' : 'emerald'} />
                </div>
                <p className="text-xs text-gray-500 text-center mb-3">
                  Différentiel auto : <span className={`font-bold ${autoDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtEUR(autoDiff, 2)}</span>
                </p>
                <button type="button" onClick={() => setCustomizing(true)} data-testid="planning-confirm-custom" className="w-full text-[11px] font-bold text-indigo-600 hover:text-indigo-700 mb-3 underline">
                  Personnaliser le supplément
                </button>
              </>
            ) : (
              <div className="space-y-3 mb-3">
                <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                  {(['night', 'total', 'free'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      data-testid={`planning-confirm-mode-${m}`}
                      className={`flex-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                        mode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {m === 'night' ? '€/nuit' : m === 'total' ? 'Total' : 'Offert'}
                    </button>
                  ))}
                </div>
                {mode !== 'free' ? (
                  <input
                    type="number"
                    step="0.01"
                    value={supplement}
                    onChange={(e) => setSupplement(e.target.value)}
                    placeholder={mode === 'night' ? 'Supplément € / nuit' : 'Supplément total €'}
                    data-testid="planning-confirm-supplement"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm tabular-nums"
                  />
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex items-center gap-2 text-xs text-emerald-700">
                    <Gift size={14} /> Surclassement offert — aucun ajustement de prix.
                  </div>
                )}
                <p className="text-xs text-gray-500 text-center">
                  Nouveau total : <span className="font-bold text-gray-900 tabular-nums">{fmtEUR(newTotal, 0)}</span>
                </p>
              </div>
            )}

            <footer className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={handleIgnore} data-testid="planning-confirm-ignore" className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 hover:bg-gray-100">
                Ignorer le tarif
              </button>
              <button type="button" onClick={handleConfirm} data-testid="planning-confirm-submit" className="px-4 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                Confirmer le délogement
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'indigo' | 'rose' | 'emerald' }> = ({ label, value, tone }) => (
  <div className="rounded-lg bg-gray-50/70 border border-gray-100 p-2">
    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">{label}</p>
    <p className={`text-sm font-bold tabular-nums ${tone === 'indigo' ? 'text-indigo-700' : tone === 'rose' ? 'text-rose-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</p>
  </div>
);

export default ConfirmMoveDialog;
