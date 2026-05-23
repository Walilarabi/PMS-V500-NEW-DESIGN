/**
 * FLOWTYM — Modal d'édition / création d'un garde-fou
 */
import React, { useEffect, useState } from 'react';
import { X, Shield, AlertCircle } from 'lucide-react';
import type { Guardrail, GuardrailCategory, GuardrailId, GuardrailSeverity } from '@/src/types/revenue/guardrails.types';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { cn } from '@/src/lib/utils';

export interface GuardrailModalProps {
  guardrail: Guardrail | null;
  open: boolean;
  onClose: () => void;
  onSave?: (g: Guardrail) => void;
}

const CATEGORIES: { id: GuardrailCategory; label: string }[] = [
  { id: 'pricing', label: 'Tarification' },
  { id: 'availability', label: 'Disponibilité' },
  { id: 'restriction', label: 'Restrictions' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'quality', label: 'Qualité' },
];

export const GuardrailModal: React.FC<GuardrailModalProps> = ({ guardrail, open, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<GuardrailSeverity>('blocking');
  const [threshold, setThreshold] = useState('');
  const [thresholdValue, setThresholdValue] = useState(0);
  const [category, setCategory] = useState<GuardrailCategory>('pricing');
  const [condition, setCondition] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    if (guardrail) {
      setName(guardrail.name);
      setSeverity(guardrail.severity);
      setThreshold(guardrail.threshold);
      setThresholdValue(guardrail.thresholdValue);
      setCategory(guardrail.category);
      setCondition(guardrail.condition);
      setAction(guardrail.action);
    } else if (open) {
      setName('');
      setSeverity('blocking');
      setThreshold('');
      setThresholdValue(0);
      setCategory('pricing');
      setCondition('');
      setAction('');
    }
  }, [guardrail, open]);

  if (!open) return null;

  const submit = () => {
    if (!name.trim()) return;
    const id = (guardrail?.id ?? (`custom_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}` as GuardrailId)) as GuardrailId;
    const payload: Guardrail = guardrail
      ? { ...guardrail, name: name.trim(), severity, threshold, thresholdValue, category, condition, action }
      : {
          id,
          name: name.trim(),
          category,
          severity,
          condition: condition || 'Condition à définir',
          threshold,
          thresholdValue,
          action: action || 'Action à définir',
          coverage: { scope: 'all', detail: '100% des dates', percentage: 100 },
          status: 'active',
          blocksCount30d: 0,
          warningsCount30d: 0,
          adjustmentsCount30d: 0,
          averageDeltaLimited: 0,
          history: [],
        };
    guardrailsEngine.upsert(payload);
    onSave?.(payload);
    onClose();
  };

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

          <Field label="Catégorie">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                    category === c.id
                      ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                      : 'bg-white border-[#E5E7EB] text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Seuil affiché">
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="Ex : 110 € ou ±15%"
                className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
            </Field>
            <Field label="Valeur numérique">
              <input
                type="number"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(Number(e.target.value))}
                className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
            </Field>
          </div>

          <Field label="Condition">
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="Ex : Prix ne doit jamais descendre sous le plancher"
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </Field>

          <Field label="Action appliquée">
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Ex : Bloque toute baisse"
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
            onClick={submit}
            disabled={!name.trim()}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#8B5CF6] rounded-xl hover:bg-[#7C3AED] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
