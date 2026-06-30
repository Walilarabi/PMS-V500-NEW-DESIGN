/**
 * FLOWTYM — Paramètres · Préférences chambres.
 */
import React from 'react';
import { Star } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface PrefItem extends GenericListItem {
  category: 'view' | 'comfort' | 'amenity' | 'access';
}

const DEFAULTS: PrefItem[] = [
  { id: 'sea_view',    label: 'Vue sur mer', code: 'SEA',  active: true, category: 'view' },
  { id: 'mountain',    label: 'Vue montagne', code: 'MNT', active: true, category: 'view' },
  { id: 'high_floor',  label: 'Étage élevé',  code: 'HFL', active: true, category: 'comfort' },
  { id: 'low_floor',   label: 'Étage bas',    code: 'LFL', active: true, category: 'comfort' },
  { id: 'quiet',       label: 'Chambre calme', code: 'QUI', active: true, category: 'comfort' },
  { id: 'connecting',  label: 'Communicante',  code: 'CON', active: true, category: 'comfort' },
  { id: 'balcony',     label: 'Avec balcon',   code: 'BAL', active: true, category: 'amenity' },
  { id: 'bathtub',     label: 'Baignoire',     code: 'BTH', active: true, category: 'amenity' },
  { id: 'pmr',         label: 'Accès PMR',     code: 'PMR', active: true, category: 'access' },
];

const CAT_LABEL: Record<PrefItem['category'], string> = {
  view: 'Vue', comfort: 'Confort', amenity: 'Équipement', access: 'Accessibilité',
};

export const PreferencesPage: React.FC = () => (
  <GenericListPage<PrefItem>
    icon={Star}
    category="Chambres & Inventaire"
    title="Préférences"
    description="Tags de préférences appliqués aux chambres et exploités par le moteur d'attribution."
    storageKey="flowtym.preferences"
    module="inventory_planning"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Catégorie', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold">{CAT_LABEL[it.category]}</span> },
    ]}
    extraFormFields={(item, set) => (
      <label className="block">
        <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Catégorie</span>
        <select value={item.category} onChange={(e) => set({ category: e.target.value as PrefItem['category'] })}
          className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
          {(Object.keys(CAT_LABEL) as PrefItem['category'][]).map((c) => (
            <option key={c} value={c}>{CAT_LABEL[c]}</option>
          ))}
        </select>
      </label>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, category: 'comfort' })}
    capability="cli_view"
    supabaseSync
    phase2="affectation des préférences aux fiches clients pour attribution automatique à la réservation."
  />
);
