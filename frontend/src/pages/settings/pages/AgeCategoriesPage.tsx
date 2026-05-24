/**
 * FLOWTYM — Paramètres · Catégories d'âge.
 */
import React from 'react';
import { Users } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface AgeItem extends GenericListItem {
  minAge: number;
  maxAge: number;
  pricingFactor: number;  // facteur appliqué au prix adulte (1 = même prix)
}

const DEFAULTS: AgeItem[] = [
  { id: 'baby',     label: 'Bébé',          code: 'BABY',  active: true, minAge: 0,  maxAge: 2,  pricingFactor: 0,    description: 'Gratuit, sans lit fourni' },
  { id: 'child_s',  label: 'Enfant 3-6',    code: 'CHL_S', active: true, minAge: 3,  maxAge: 6,  pricingFactor: 0.5,  description: 'Demi-tarif' },
  { id: 'child_l',  label: 'Enfant 7-11',   code: 'CHL_L', active: true, minAge: 7,  maxAge: 11, pricingFactor: 0.7,  description: '70% du tarif adulte' },
  { id: 'teen',     label: 'Adolescent',    code: 'TEEN',  active: true, minAge: 12, maxAge: 17, pricingFactor: 0.85, description: '85% du tarif adulte' },
  { id: 'adult',    label: 'Adulte',        code: 'ADL',   active: true, minAge: 18, maxAge: 64, pricingFactor: 1.0,  description: 'Tarif plein' },
  { id: 'senior',   label: 'Senior',        code: 'SEN',   active: false, minAge: 65, maxAge: 120, pricingFactor: 1.0, description: 'Pas de réduction par défaut' },
];

export const AgeCategoriesPage: React.FC = () => (
  <GenericListPage<AgeItem>
    icon={Users}
    category="Tarifs & Prestations"
    title="Catégories d'âge"
    description="Tarification par tranche d'âge pour les facturations multi-occupants."
    storageKey="flowtym.age_categories"
    module="finance_billing"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Tranche', render: (it) => `${it.minAge} - ${it.maxAge} ans` },
      { header: 'Facteur', render: (it) => <span className="font-semibold tabular-nums">×{it.pricingFactor.toFixed(2)}</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Âge min</span>
          <input type="number" min={0} max={120} value={item.minAge} onChange={(e) => set({ minAge: parseInt(e.target.value) || 0 })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Âge max</span>
          <input type="number" min={0} max={120} value={item.maxAge} onChange={(e) => set({ maxAge: parseInt(e.target.value) || 0 })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Facteur prix</span>
          <input type="number" min={0} max={2} step={0.05} value={item.pricingFactor} onChange={(e) => set({ pricingFactor: parseFloat(e.target.value) || 0 })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, minAge: 0, maxAge: 17, pricingFactor: 0.7 })}
    phase2="application automatique à la facturation multi-occupants et aux exports OTA."
  />
);
