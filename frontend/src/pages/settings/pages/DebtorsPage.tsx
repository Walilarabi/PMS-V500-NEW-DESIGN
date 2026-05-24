/**
 * FLOWTYM — Paramètres · Débiteurs (workflow relances impayés).
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface DebtorStep extends GenericListItem {
  daysAfterDue: number;
  channel: 'email' | 'sms' | 'letter' | 'call';
  template: string;
  feesPercent: number;
}

const DEFAULTS: DebtorStep[] = [
  { id: 'r1', label: 'Premier rappel courtois',   code: 'R1', active: true, daysAfterDue: 7,  channel: 'email', template: 'gentle_reminder', feesPercent: 0 },
  { id: 'r2', label: 'Relance ferme',             code: 'R2', active: true, daysAfterDue: 21, channel: 'email', template: 'firm_reminder',   feesPercent: 0 },
  { id: 'r3', label: 'Mise en demeure',           code: 'R3', active: true, daysAfterDue: 45, channel: 'letter', template: 'formal_notice',  feesPercent: 10 },
  { id: 'r4', label: 'Procédure contentieux',     code: 'R4', active: false, daysAfterDue: 90, channel: 'letter', template: 'litigation',    feesPercent: 15 },
];

const CHANNEL_LABEL: Record<DebtorStep['channel'], string> = {
  email: 'Email', sms: 'SMS', letter: 'Courrier RAR', call: 'Appel téléphonique',
};

export const DebtorsPage: React.FC = () => (
  <GenericListPage<DebtorStep>
    icon={AlertTriangle}
    category="Finance & Facturation"
    title="Débiteurs & relances"
    description="Workflow d'escalade en cas d'impayé : rappels, mise en demeure, contentieux."
    storageKey="flowtym.debtors"
    module="finance_billing"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Délai', render: (it) => <span className="font-semibold tabular-nums">J+{it.daysAfterDue}</span> },
      { header: 'Canal', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold">{CHANNEL_LABEL[it.channel]}</span> },
      { header: 'Frais', render: (it) => it.feesPercent > 0 ? `${it.feesPercent}%` : '—' },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Délai (jours)</span>
          <input type="number" min={0} value={item.daysAfterDue} onChange={(e) => set({ daysAfterDue: parseInt(e.target.value) || 0 })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Canal</span>
          <select value={item.channel} onChange={(e) => set({ channel: e.target.value as DebtorStep['channel'] })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            {(Object.keys(CHANNEL_LABEL) as DebtorStep['channel'][]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="block col-span-2">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Frais de relance (%)</span>
          <input type="number" min={0} max={50} value={item.feesPercent} onChange={(e) => set({ feesPercent: parseInt(e.target.value) || 0 })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, daysAfterDue: 7, channel: 'email', template: '', feesPercent: 0 })}
    capability="fin_payment"
    supabaseSync
    phase2="déclenchement automatique des relances depuis le moteur de facturation."
  />
);
