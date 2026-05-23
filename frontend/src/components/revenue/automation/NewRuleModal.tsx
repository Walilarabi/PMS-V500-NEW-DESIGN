/**
 * FLOWTYM — Modal « Nouvelle règle tactique »
 *
 * Formulaire complet (nom, catégorie, priorité, déclencheurs, actions) qui
 * crée une nouvelle règle dans le moteur tactique.
 */
import React, { useState } from 'react';
import { X, Plus, Trash2, Zap } from 'lucide-react';
import type {
  TacticalRule,
  TacticalRuleCategory,
  TacticalRuleId,
} from '@/src/types/revenue/tacticalRules.types';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { cn } from '@/src/lib/utils';

const CATEGORIES: { id: TacticalRuleCategory; label: string }[] = [
  { id: 'demand', label: 'Demande' },
  { id: 'pricing', label: 'Tarification' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'event', label: 'Événements' },
  { id: 'protection', label: 'Protection' },
];

export interface NewRuleModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (rule: TacticalRule) => void;
}

export const NewRuleModal: React.FC<NewRuleModalProps> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TacticalRuleCategory>('demand');
  const [priority, setPriority] = useState(5);
  const [iaConfidence, setIaConfidence] = useState(75);
  const [triggers, setTriggers] = useState<string[]>(['']);
  const [actions, setActions] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName(''); setDescription(''); setCategory('demand');
    setPriority(5); setIaConfidence(75); setTriggers(['']); setActions(['']);
    setError(null);
  };

  const submit = () => {
    if (!name.trim()) { setError('Le nom est requis'); return; }
    const cleanTriggers = triggers.map((t) => t.trim()).filter(Boolean);
    const cleanActions = actions.map((a) => a.trim()).filter(Boolean);
    if (cleanTriggers.length === 0) { setError('Au moins un déclencheur est requis'); return; }
    if (cleanActions.length === 0) { setError('Au moins une action est requise'); return; }

    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}_${Date.now()}` as TacticalRuleId;
    const rule: TacticalRule = {
      id,
      name: name.trim(),
      description: description.trim() || 'Règle personnalisée',
      category,
      priority,
      status: 'simulation',
      iaConfidence,
      triggers: cleanTriggers.map((label) => ({
        label,
        metric: 'custom',
        operator: '>=' as const,
        threshold: 0,
      })),
      actions: cleanActions.map((label) => ({
        label,
        type: 'price_up' as const,
        magnitude: 0.03,
      })),
      connectivity: ['Calendrier tarifaire', 'Recommandations'],
      revenueImpact30d: 0,
      revparImpact30d: 0,
      triggersCount30d: 0,
      successCount: 0,
      adjustedCount: 0,
      blockedCount: 0,
      history: [],
    };
    tacticalRulesEngine.addRule(rule);
    onCreated?.(rule);
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Nouvelle règle tactique</h3>
              <p className="text-[13px] text-gray-500">
                Créée en mode simulation. Activez-la une fois validée.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <Field label="Nom de la règle">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Boost weekend"
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </Field>

          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objectif court"
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
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
                        : 'bg-white text-gray-600 border-[#E5E7EB] hover:bg-gray-50',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Priorité">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                />
              </Field>
              <Field label="Confiance IA">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={iaConfidence}
                    onChange={(e) => setIaConfidence(Number(e.target.value))}
                    className="flex-1 accent-[#8B5CF6]"
                  />
                  <span className="text-[13px] font-semibold text-gray-700 w-10 text-right">{iaConfidence}%</span>
                </div>
              </Field>
            </div>
          </div>

          <List
            label="Déclencheurs"
            items={triggers}
            placeholder="Ex : Occupation > 80%"
            onChange={setTriggers}
          />

          <List
            label="Actions"
            items={actions}
            placeholder="Ex : ↑ Prix de 5%"
            onChange={setActions}
          />

          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-[12px] text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAFB]">
          <button
            onClick={() => { reset(); onClose(); }}
            className="px-4 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#8B5CF6] rounded-xl hover:bg-[#7C3AED] shadow-sm"
          >
            Créer la règle
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-1 block">{label}</label>
    {children}
  </div>
);

const List: React.FC<{ label: string; items: string[]; placeholder?: string; onChange: (items: string[]) => void }> = ({ label, items, placeholder, onChange }) => {
  return (
    <Field label={label}>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="flex-1 px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8B5CF6] hover:underline"
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>
    </Field>
  );
};
