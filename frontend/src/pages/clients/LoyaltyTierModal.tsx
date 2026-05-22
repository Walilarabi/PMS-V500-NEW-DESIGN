/**
 * FLOWTYM — Loyalty Tier Modal (Wave C4)
 *
 * Edit a loyalty tier's thresholds, points multiplier, colour and benefits.
 * Calls crm_save_loyalty_tier RPC via useSaveLoyaltyTier mutation.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Award, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useSaveLoyaltyTier } from '@/src/services/crm/hooks';
import type { LoyaltyTier } from '@/src/services/crm/loyalty.service';

const COLOR_SWATCHES = [
  '#C4B5FD', '#9CA3AF', '#F59E0B', '#3B82F6',
  '#8B5CF6', '#10B981', '#EF4444', '#EC4899',
];

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors';

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
    {children}
  </label>
);

interface Props {
  tier: LoyaltyTier;
  onClose: () => void;
}

export const LoyaltyTierModal: React.FC<Props> = ({ tier, onClose }) => {
  const [minStays, setMinStays]     = useState(tier.min_stays);
  const [minSpent, setMinSpent]     = useState(tier.min_spent);
  const [multiplier, setMultiplier] = useState(tier.points_multiplier);
  const [color, setColor]           = useState(tier.color);
  const [benefits, setBenefits]     = useState<string[]>(
    tier.benefits.length ? tier.benefits : [''],
  );

  const save = useSaveLoyaltyTier();

  const setBenefit = (idx: number, value: string) =>
    setBenefits((b) => b.map((v, i) => (i === idx ? value : v)));

  const addBenefit    = () => setBenefits((b) => [...b, '']);
  const removeBenefit = (idx: number) =>
    setBenefits((b) => (b.length > 1 ? b.filter((_, i) => i !== idx) : ['']));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({
      id:                tier.id,
      min_stays:         Math.max(0, Math.round(minStays)),
      min_spent:         Math.max(0, minSpent),
      points_multiplier: Math.max(0, multiplier),
      color,
      benefits:          benefits.map((b) => b.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl" style={{ background: `${color}22` }}>
                <Award size={16} style={{ color }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Niveau {tier.name}</h3>
                <p className="text-[11px] text-gray-400">Conditions et avantages</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Thresholds */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Séjours min.</Label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={minStays}
                    onChange={(e) => setMinStays(parseInt(e.target.value, 10) || 0)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>CA cumulé min. (€)</Label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={minSpent}
                    onChange={(e) => setMinSpent(parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
              </div>

              <p className="text-[11px] text-gray-400 -mt-1">
                Un client atteint ce niveau lorsqu'il dépasse <strong>les deux</strong> seuils.
              </p>

              {/* Multiplier */}
              <div>
                <Label>Multiplicateur de points</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={multiplier}
                    onChange={(e) => setMultiplier(parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                  <span className="text-sm font-bold text-gray-400 shrink-0">×</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Points gagnés par euro dépensé pour les clients de ce niveau.
                </p>
              </div>

              {/* Colour */}
              <div>
                <Label>Couleur</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-lg transition-transform hover:scale-110"
                      style={{
                        background: c,
                        outline: color === c ? '2px solid #1F2937' : 'none',
                        outlineOffset: 2,
                      }}
                      aria-label={`Couleur ${c}`}
                    />
                  ))}
                </div>
              </div>

              {/* Benefits */}
              <div>
                <Label>Avantages</Label>
                <div className="space-y-2">
                  {benefits.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={b}
                        onChange={(e) => setBenefit(i, e.target.value)}
                        className={inputCls}
                        placeholder="ex: Petit-déjeuner offert"
                      />
                      <button
                        type="button"
                        onClick={() => removeBenefit(i)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                        aria-label="Retirer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addBenefit}
                  className="mt-2 flex items-center gap-1 text-[12px] font-bold text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
                >
                  <Plus size={13} /> Ajouter un avantage
                </button>
              </div>

              {save.isError && (
                <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-xl">
                  Erreur lors de l'enregistrement. Veuillez réessayer.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending && <Loader2 size={13} className="animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoyaltyTierModal;
