/**
 * FLOWTYM — Paramètres · Conditions d'annulation et de paiement.
 */
import React from 'react';
import { FileText } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface ConditionItem extends GenericListItem {
  type: 'cancellation' | 'payment' | 'guarantee';
  freeUntilHours: number;       // h avant arrivée
  penaltyPercent: number;       // % de la rés.
  depositPercent: number;       // acompte exigé
}

const DEFAULTS: ConditionItem[] = [
  { id: 'flex_24h',  label: 'Annulation gratuite J-1', code: 'FLEX24', active: true, type: 'cancellation', freeUntilHours: 24,  penaltyPercent: 100, depositPercent: 0 },
  { id: 'flex_72h',  label: 'Annulation gratuite J-3', code: 'FLEX72', active: true, type: 'cancellation', freeUntilHours: 72,  penaltyPercent: 100, depositPercent: 0 },
  { id: 'flex_7d',   label: 'Annulation gratuite J-7', code: 'FLEX7D', active: true, type: 'cancellation', freeUntilHours: 168, penaltyPercent: 100, depositPercent: 0 },
  { id: 'nr',        label: 'Non remboursable',         code: 'NR',     active: true, type: 'cancellation', freeUntilHours: 0,  penaltyPercent: 100, depositPercent: 100 },
  { id: 'deposit_30',label: 'Acompte 30% à la résa',    code: 'DEP30',  active: true, type: 'payment',      freeUntilHours: 72, penaltyPercent: 30,  depositPercent: 30 },
  { id: 'cb_guar',   label: 'Garantie CB',              code: 'CB_GUAR',active: true, type: 'guarantee',    freeUntilHours: 0,  penaltyPercent: 0,   depositPercent: 0 },
];

const TYPE_LABEL: Record<ConditionItem['type'], string> = {
  cancellation: 'Annulation', payment: 'Paiement', guarantee: 'Garantie',
};

export const ConditionsPage: React.FC = () => (
  <GenericListPage<ConditionItem>
    icon={FileText}
    category="Tarifs & Prestations"
    title="Conditions"
    description="Conditions d'annulation, de paiement et de garantie associées aux plans tarifaires."
    storageKey="flowtym.conditions"
    module="pms_reservations"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Type', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold">{TYPE_LABEL[it.type]}</span> },
      { header: 'Gratuite jusqu\'à', render: (it) => it.freeUntilHours > 0 ? `J-${Math.floor(it.freeUntilHours / 24)} ${it.freeUntilHours % 24}h` : '—' },
      { header: 'Pénalité', render: (it) => `${it.penaltyPercent}%` },
      { header: 'Acompte', render: (it) => `${it.depositPercent}%` },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Type</span>
          <select value={item.type} onChange={(e) => set({ type: e.target.value as ConditionItem['type'] })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            {(Object.keys(TYPE_LABEL) as ConditionItem['type'][]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Gratuite (heures)</span>
            <input type="number" min={0} value={item.freeUntilHours} onChange={(e) => set({ freeUntilHours: parseInt(e.target.value) || 0 })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Pénalité (%)</span>
            <input type="number" min={0} max={100} value={item.penaltyPercent} onChange={(e) => set({ penaltyPercent: parseInt(e.target.value) || 0 })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Acompte (%)</span>
            <input type="number" min={0} max={100} value={item.depositPercent} onChange={(e) => set({ depositPercent: parseInt(e.target.value) || 0 })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, type: 'cancellation', freeUntilHours: 24, penaltyPercent: 100, depositPercent: 0 })}
    phase2="application automatique aux moteurs OTA + facturation + relances pour no-show."
  />
);
