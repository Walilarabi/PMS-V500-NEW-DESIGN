/**
 * FLOWTYM — Modal d'édition / création d'un garde-fou
 */
import React, { useEffect, useState } from 'react';
import { X, Shield, AlertCircle } from 'lucide-react';
import type { Guardrail, GuardrailSeverity } from '@/src/types/revenue/guardrails.types';
import { cn } from '@/src/lib/utils';

export interface GuardrailModalProps {
  guardrail: Guardrail | null;
  open: boolean;
  onClose: () => void;
  onSave?: (g: Guardrail) => void;
}

export const GuardrailModal: React.FC<GuardrailModalProps> = ({ guardrail, open, onClose }) => {
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<GuardrailSeverity>('blocking');
  const [threshold, setThreshold] = useState('');

  useEffect(() => {
    if (guardrail) {
      setName(guardrail.name);
      setSeverity(guardrail.severity);
      setThreshold(guardrail.threshold);
    } else if (open) {
      setName('');
      setSeverity('blocking');
      setThreshold('');
    }
  }, [guardrail, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {guardrail ? 'Modifier le garde-fou' : 'Nouveau garde-fou'}
              </h3>
              <p className="text-[13px] text-gray-500">
                Les garde-fous sont prioritaires sur toutes les autres règles.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <Field label="Nom du garde-fou">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Plancher tarifaire Suites"
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </Field>

          <Field label="Sévérité">
            <div className="flex gap-2">
              {(['blocking', 'warning', 'auto_adjust'] as GuardrailSeverity[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={cn(
                    'text-[13px] font-semibold px-3 py-1.5 rounded-xl border transition-colors',
                    severity === s
                      ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                      : 'bg-white border-[#E5E7EB] text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {s === 'blocking' ? 'Bloquant' : s === 'warning' ? 'Avertissement' : 'Ajustement auto'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Seuil / valeur">
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Ex : 110 € ou ±15%"
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </Field>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2 text-[12px] text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              Un garde-fou bloquant ne peut jamais être ignoré, même par l'autopilote ou la stratégie globale.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAFB]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#8B5CF6] rounded-xl hover:bg-[#7C3AED] shadow-sm"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-[12px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5 block">{label}</label>
    {children}
  </div>
);
