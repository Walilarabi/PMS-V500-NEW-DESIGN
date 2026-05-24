/**
 * FLOWTYM — Paramètres · Prestations (produits annexes).
 */
import React from 'react';
import { Package } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface ProductItem extends GenericListItem {
  price: number;
  vatRate: number;
  type: 'food' | 'drink' | 'service' | 'amenity' | 'transfer';
}

const DEFAULTS: ProductItem[] = [
  { id: 'breakfast',  label: 'Petit-déjeuner buffet', code: 'BFAST', price: 18,  vatRate: 10, active: true, type: 'food' },
  { id: 'dinner',     label: 'Dîner gastronomique',   code: 'DIN',   price: 65,  vatRate: 10, active: true, type: 'food' },
  { id: 'wine',       label: 'Bouteille de vin',      code: 'WINE',  price: 35,  vatRate: 20, active: true, type: 'drink' },
  { id: 'transfer',   label: 'Transfert aéroport',    code: 'TRSF',  price: 80,  vatRate: 10, active: true, type: 'transfer' },
  { id: 'spa',        label: 'Accès SPA',             code: 'SPA',   price: 25,  vatRate: 20, active: true, type: 'service' },
  { id: 'late_co',    label: 'Late check-out',        code: 'LCO',   price: 50,  vatRate: 10, active: true, type: 'service' },
  { id: 'bath_robe',  label: 'Peignoir',              code: 'ROBE',  price: 12,  vatRate: 20, active: false, type: 'amenity' },
];

const TYPE_LABEL: Record<ProductItem['type'], string> = {
  food: 'F&B Solid', drink: 'F&B Liquide', service: 'Service', amenity: 'Aménité', transfer: 'Transport',
};

export const ProductsPage: React.FC = () => (
  <GenericListPage<ProductItem>
    icon={Package}
    category="Tarifs & Prestations"
    title="Prestations"
    description="Produits et services annexes facturables : F&B, transferts, services SPA, late check-out."
    storageKey="flowtym.products"
    module="finance_billing"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Type', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold">{TYPE_LABEL[it.type]}</span> },
      { header: 'Prix', render: (it) => <span className="font-semibold tabular-nums">{it.price.toFixed(2)} €</span> },
      { header: 'TVA', render: (it) => <span className="tabular-nums">{it.vatRate}%</span> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Type</span>
          <select value={item.type} onChange={(e) => set({ type: e.target.value as ProductItem['type'] })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            {(Object.keys(TYPE_LABEL) as ProductItem['type'][]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Prix (€)</span>
            <input type="number" min={0} step={0.5} value={item.price} onChange={(e) => set({ price: parseFloat(e.target.value) || 0 })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">TVA (%)</span>
            <input type="number" min={0} max={30} step={0.5} value={item.vatRate} onChange={(e) => set({ vatRate: parseFloat(e.target.value) || 0 })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, price: 0, vatRate: 10, type: 'service' })}
    capability="fin_invoice"
    supabaseSync
    phase2="intégration au moteur de facturation et aux templates email."
  />
);
