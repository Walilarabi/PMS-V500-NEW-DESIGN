/**
 * FLOWTYM — Paramètres · Comptabilité (plan comptable & journaux).
 */
import React from 'react';
import { BookOpen } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface AccountItem extends GenericListItem {
  accountNumber: string;
  type: 'revenue' | 'expense' | 'asset' | 'liability';
  category: 'rooms' | 'fb' | 'misc' | 'tax' | 'bank';
}

const DEFAULTS: AccountItem[] = [
  { id: 'acc_706_room', label: 'Hébergement nuitées', code: '7061000', accountNumber: '7061000', active: true, type: 'revenue', category: 'rooms' },
  { id: 'acc_706_fb',   label: 'Restauration',         code: '7062000', accountNumber: '7062000', active: true, type: 'revenue', category: 'fb' },
  { id: 'acc_706_misc', label: 'Prestations diverses', code: '7068000', accountNumber: '7068000', active: true, type: 'revenue', category: 'misc' },
  { id: 'acc_445_vat10',label: 'TVA collectée 10%',    code: '4457100', accountNumber: '4457100', active: true, type: 'liability', category: 'tax' },
  { id: 'acc_445_vat20',label: 'TVA collectée 20%',    code: '4457200', accountNumber: '4457200', active: true, type: 'liability', category: 'tax' },
  { id: 'acc_445_tdj',  label: 'Taxe de séjour',       code: '4457300', accountNumber: '4457300', active: true, type: 'liability', category: 'tax' },
  { id: 'acc_512_main', label: 'Banque principale',    code: '5121000', accountNumber: '5121000', active: true, type: 'asset', category: 'bank' },
  { id: 'acc_530',      label: 'Caisse',               code: '5300000', accountNumber: '5300000', active: true, type: 'asset', category: 'bank' },
];

const TYPE_LABEL: Record<AccountItem['type'], string> = {
  revenue: 'Produit', expense: 'Charge', asset: 'Actif', liability: 'Passif',
};
const CAT_LABEL: Record<AccountItem['category'], string> = {
  rooms: 'Chambres', fb: 'F&B', misc: 'Divers', tax: 'Taxes', bank: 'Trésorerie',
};

export const AccountingPage: React.FC = () => (
  <GenericListPage<AccountItem>
    icon={BookOpen}
    category="Finance & Facturation"
    title="Comptabilité"
    description="Plan comptable de l'établissement : comptes de produits, charges, TVA et trésorerie."
    storageKey="flowtym.accounting"
    module="finance_billing"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Nº compte', render: (it) => <span className="font-mono text-[11.5px]">{it.accountNumber}</span> },
      { header: 'Type', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold">{TYPE_LABEL[it.type]}</span> },
      { header: 'Catégorie', render: (it) => <span className="text-slate-600">{CAT_LABEL[it.category]}</span> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Numéro de compte (PCG)</span>
          <input type="text" value={item.accountNumber} onChange={(e) => set({ accountNumber: e.target.value, code: e.target.value })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Type</span>
            <select value={item.type} onChange={(e) => set({ type: e.target.value as AccountItem['type'] })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              {(Object.keys(TYPE_LABEL) as AccountItem['type'][]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Catégorie</span>
            <select value={item.category} onChange={(e) => set({ category: e.target.value as AccountItem['category'] })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              {(Object.keys(CAT_LABEL) as AccountItem['category'][]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </select>
          </label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, accountNumber: '', type: 'revenue', category: 'misc' })}
    phase2="export FEC + intégration Sage / Cegid via webhooks comptables."
  />
);
