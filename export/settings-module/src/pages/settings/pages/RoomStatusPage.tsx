/**
 * FLOWTYM — Paramètres · Statuts chambres.
 */
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface StatusItem extends GenericListItem {
  housekeepingFlow: 'available' | 'cleaning' | 'maintenance' | 'inspected';
  bookable: boolean;
}

const DEFAULTS: StatusItem[] = [
  { id: 'clean',        label: 'Propre',     code: 'CLN', description: 'Chambre nettoyée et prête.', active: true, housekeepingFlow: 'available',  bookable: true },
  { id: 'dirty',        label: 'À nettoyer', code: 'DRT', description: 'Sortie client, ménage à faire.', active: true, housekeepingFlow: 'cleaning', bookable: false },
  { id: 'inspected',    label: 'Inspectée',  code: 'INS', description: 'Validée par la gouvernante.', active: true, housekeepingFlow: 'inspected', bookable: true },
  { id: 'out_of_order', label: 'Hors service', code: 'OOO', description: 'Indisponible — défaut majeur.', active: true, housekeepingFlow: 'maintenance', bookable: false },
  { id: 'maintenance',  label: 'Maintenance', code: 'MNT', description: 'Intervention technique en cours.', active: true, housekeepingFlow: 'maintenance', bookable: false },
];

export const RoomStatusPage: React.FC = () => (
  <GenericListPage<StatusItem>
    icon={CheckCircle2}
    category="Chambres & Inventaire"
    title="Statuts chambres"
    description="Workflow housekeeping et impact disponibilité du moteur de réservation."
    storageKey="flowtym.room_statuses"
    module="housekeeping"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Flow HK', render: (it) => <span className="capitalize text-slate-700">{it.housekeepingFlow}</span> },
      { header: 'Vendable', render: (it) => it.bookable ? <span className="text-emerald-600">✓</span> : <span className="text-rose-500">✗</span> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Flow housekeeping</span>
          <select value={item.housekeepingFlow} onChange={(e) => set({ housekeepingFlow: e.target.value as StatusItem['housekeepingFlow'] })}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="available">Disponible</option>
            <option value="cleaning">Nettoyage</option>
            <option value="inspected">Inspection</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={item.bookable} onChange={(e) => set({ bookable: e.target.checked })} className="w-4 h-4 accent-violet-600" />
          Vendable (incluse dans la disponibilité OTA)
        </label>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', description: '', active: true, housekeepingFlow: 'available', bookable: true })}
    capability="set_rooms"
    supabaseSync
    phase2="application au moteur housekeeping et propagation OTA en temps réel."
  />
);
