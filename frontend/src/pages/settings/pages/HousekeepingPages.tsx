/**
 * FLOWTYM — Paramètres · Housekeeping & Opérations.
 *
 * Suite de 7 pages compactes pour le pilotage opérationnel :
 *   - HkStatusPage         : statuts ménage (différent de Statuts chambres
 *                            qui couvre le statut administrant côté vente)
 *   - HkChecklistsPage     : checklists par typologie
 *   - HkStaffPage          : personnel housekeeping (sous-ensemble de Users)
 *   - HkDistributionPage   : règles d'affectation
 *   - MaintenancePage      : interventions et tickets
 *   - LostFoundPage        : objets trouvés
 *   - BreakfastPage        : reporting petit-déjeuner
 */
import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, ClipboardList, Users, Share2, Wrench, Package, Coffee, Calendar, AlertCircle, Plus,
} from 'lucide-react';
import { useConfigStore } from '@/src/store/configStore';
import {
  GenericListPage,
  SettingsPageHeader,
  SettingsMetric,
  SettingsToast,
  Phase2Notice,
  type GenericListItem,
} from './_common';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

// ─── HK Status ────────────────────────────────────────────────────────────

interface HkStatusItem extends GenericListItem {
  color: string;
  blocksRoom: boolean;
}

export const HkStatusPage: React.FC = () => (
  <GenericListPage<HkStatusItem>
    icon={CheckCircle2}
    category="Housekeeping & Opérations"
    title="Statuts ménage"
    description="Étapes opérationnelles utilisées par le module Housekeeping (différent des statuts de vente)."
    storageKey="flowtym.hk.statuses"
    module="housekeeping"
    defaults={[
      { id: 'pickup', label: 'Pickup',         code: 'PCK', active: true, color: '#7C3AED', blocksRoom: false, description: 'Sortie client validée' },
      { id: 'in_progress', label: 'En cours',  code: 'INP', active: true, color: '#F59E0B', blocksRoom: true,  description: 'Ménage en cours' },
      { id: 'to_inspect', label: 'À inspecter', code: 'INS', active: true, color: '#0EA5E9', blocksRoom: true,  description: 'Attente gouvernante' },
      { id: 'ok',     label: 'Validée',         code: 'OK',  active: true, color: '#10B981', blocksRoom: false, description: 'Prête à la vente' },
      { id: 'turn',   label: 'Turn-down',       code: 'TRN', active: true, color: '#D946EF', blocksRoom: false, description: 'Mise en couverture' },
    ]}
    extraColumns={[
      { header: 'Couleur', render: (it) => <span className="inline-block w-4 h-4 rounded ring-1 ring-slate-200" style={{ background: it.color }} /> },
      { header: 'Bloque vente', render: (it) => it.blocksRoom ? <span className="text-rose-600">✓</span> : <span className="text-slate-300">·</span> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Couleur</span>
          <input type="color" value={item.color} onChange={(e) => set({ color: e.target.value })} className="mt-1.5 w-full h-10 rounded-lg ring-1 ring-slate-200" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={item.blocksRoom} onChange={(e) => set({ blocksRoom: e.target.checked })} className="w-4 h-4 accent-violet-600" />
          Bloque la mise en vente
        </label>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, color: '#7C3AED', blocksRoom: false, description: '' })}
    phase2="application en temps réel aux opérations housekeeping et bandeau planning."
  />
);

// ─── HK Checklists ────────────────────────────────────────────────────────

interface ChecklistItem extends GenericListItem {
  roomType: string;
  taskCount: number;
  estimatedMinutes: number;
}

export const HkChecklistsPage: React.FC = () => (
  <GenericListPage<ChecklistItem>
    icon={ClipboardList}
    category="Housekeeping & Opérations"
    title="Checklists"
    description="Listes de tâches par typologie de chambre — temps standard et nombre de points de contrôle."
    storageKey="flowtym.hk.checklists"
    module="housekeeping"
    defaults={[
      { id: 'std',    label: 'Chambre standard', code: 'STD', active: true, roomType: 'Standard', taskCount: 24, estimatedMinutes: 30 },
      { id: 'sup',    label: 'Chambre supérieure', code: 'SUP', active: true, roomType: 'Supérieure', taskCount: 28, estimatedMinutes: 38 },
      { id: 'suite',  label: 'Suite', code: 'STE', active: true, roomType: 'Suite', taskCount: 38, estimatedMinutes: 60 },
      { id: 'turn',   label: 'Turn-down', code: 'TRN', active: true, roomType: 'Toutes', taskCount: 8, estimatedMinutes: 10 },
    ]}
    extraColumns={[
      { header: 'Typologie', render: (it) => it.roomType },
      { header: 'Points', render: (it) => <span className="font-semibold tabular-nums">{it.taskCount}</span> },
      { header: 'Temps', render: (it) => <span className="text-slate-600 tabular-nums">{it.estimatedMinutes} min</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Typologie</span>
          <input type="text" value={item.roomType} onChange={(e) => set({ roomType: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Tâches</span>
          <input type="number" min={0} value={item.taskCount} onChange={(e) => set({ taskCount: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Temps (min)</span>
          <input type="number" min={0} value={item.estimatedMinutes} onChange={(e) => set({ estimatedMinutes: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, roomType: '', taskCount: 0, estimatedMinutes: 0 })}
    phase2="éditeur de tâches granulaires + signature numérique gouvernante."
  />
);

// ─── HK Staff ──────────────────────────────────────────────────────────────

export const HkStaffPage: React.FC = () => {
  const users = useConfigStore((s) => s.users);
  const updateUsers = useConfigStore((s) => s.updateUsers);
  const staff = users.filter((u) => u.role === 'housekeeping');
  const [toast, setToast] = useState<string | null>(null);

  function add() {
    const name = prompt('Nom du nouveau membre housekeeping ?');
    if (!name) return;
    const email = prompt('Email ?') ?? '';
    updateUsers([...users, { id: `hk_${Date.now()}`, name, email, role: 'housekeeping', active: true }]);
    logAudit({ action: 'module_inspected', module: 'housekeeping', detail: `Membre HK ajouté : ${name}` });
    setToast('Membre ajouté');
    window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Users}
          category="Housekeeping & Opérations"
          title="Personnel"
          description="Membres de l'équipe housekeeping (vue dérivée de Utilisateurs avec rôle housekeeping)."
          action={
            <button onClick={add} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          }
        />

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <SettingsMetric label="Membres actifs" value={`${staff.filter((u) => u.active).length}`} caption={`/${staff.length} au total`} />
          <SettingsMetric label="Capacité estimée" value={`${staff.filter((u) => u.active).length * 14}`} caption="Chambres / jour (14 par agent)" tone="emerald" />
          <SettingsMetric label="Temps moyen / chambre" value="32 min" caption="Standard hôtellerie" tone="slate" />
        </div>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {staff.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-[12.5px]">
              Aucun membre housekeeping. Cliquez sur "Ajouter" ou créez-en depuis la page Utilisateurs.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {staff.map((u) => (
                <li key={u.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[13px] font-semibold">{u.name.slice(0, 1).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900">{u.name}</div>
                    <div className="text-[11.5px] text-slate-500">{u.email}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold ${u.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {u.active ? 'Actif' : 'Inactif'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Phase2Notice><strong>Phase 2 :</strong> gestion des plannings, contrats, congés et performances par agent.</Phase2Notice>
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

// ─── HK Distribution (règles d'affectation) ──────────────────────────────

interface DistributionRule extends GenericListItem {
  trigger: 'by_floor' | 'by_category' | 'by_priority' | 'manual';
  floors: string;
  maxRoomsPerAgent: number;
}

export const HkDistributionPage: React.FC = () => (
  <GenericListPage<DistributionRule>
    icon={Share2}
    category="Housekeeping & Opérations"
    title="Affectations"
    description="Règles d'attribution automatique des chambres aux membres de l'équipe."
    storageKey="flowtym.hk.distribution"
    module="housekeeping"
    defaults={[
      { id: 'r1', label: 'Étages 1-2 → Marie', code: 'R1', active: true, trigger: 'by_floor', floors: '1, 2', maxRoomsPerAgent: 14 },
      { id: 'r2', label: 'Étages 3-4 → Paul', code: 'R2', active: true, trigger: 'by_floor', floors: '3, 4', maxRoomsPerAgent: 14 },
      { id: 'r3', label: 'Suites uniquement → Senior', code: 'R3', active: true, trigger: 'by_category', floors: '*', maxRoomsPerAgent: 6 },
    ]}
    extraColumns={[
      { header: 'Déclencheur', render: (it) => <span className="text-slate-700">{it.trigger}</span> },
      { header: 'Étages', render: (it) => <span className="font-mono text-[11.5px]">{it.floors}</span> },
      { header: 'Max / agent', render: (it) => <span className="font-semibold tabular-nums">{it.maxRoomsPerAgent}</span> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Déclencheur</span>
          <select value={item.trigger} onChange={(e) => set({ trigger: e.target.value as DistributionRule['trigger'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="by_floor">Par étage</option>
            <option value="by_category">Par catégorie</option>
            <option value="by_priority">Par priorité</option>
            <option value="manual">Manuel</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Étages concernés</span>
          <input type="text" value={item.floors} onChange={(e) => set({ floors: e.target.value })} placeholder="1, 2, 3 ou *" className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Max chambres / agent</span>
          <input type="number" min={1} max={50} value={item.maxRoomsPerAgent} onChange={(e) => set({ maxRoomsPerAgent: parseInt(e.target.value) || 14 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, trigger: 'by_floor', floors: '*', maxRoomsPerAgent: 14 })}
    phase2="moteur d'optimisation : équilibrage temps réel selon disponibilité et complexité."
  />
);

// ─── Maintenance ───────────────────────────────────────────────────────────

interface MaintItem extends GenericListItem {
  category: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'tech' | 'other';
  estimatedHours: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export const MaintenancePage: React.FC = () => (
  <GenericListPage<MaintItem>
    icon={Wrench}
    category="Housekeeping & Opérations"
    title="Maintenance"
    description="Catalogue des types d'intervention technique et temps standard."
    storageKey="flowtym.maintenance"
    module="housekeeping"
    defaults={[
      { id: 'leak', label: 'Fuite plomberie',       code: 'PLM', active: true, category: 'plumbing',   estimatedHours: 2, priority: 'urgent' },
      { id: 'light', label: 'Ampoule à changer',    code: 'LGT', active: true, category: 'electrical', estimatedHours: 0.25, priority: 'low' },
      { id: 'hvac', label: 'Clim défectueuse',      code: 'CLM', active: true, category: 'hvac',       estimatedHours: 1.5, priority: 'high' },
      { id: 'tv',   label: 'TV / Connectique',      code: 'TV',  active: true, category: 'tech',       estimatedHours: 0.5, priority: 'medium' },
      { id: 'furn', label: 'Mobilier endommagé',    code: 'FRN', active: true, category: 'furniture',  estimatedHours: 1, priority: 'medium' },
    ]}
    extraColumns={[
      { header: 'Catégorie', render: (it) => <span className="capitalize text-slate-700">{it.category}</span> },
      { header: 'Temps', render: (it) => <span className="font-mono">{it.estimatedHours}h</span> },
      { header: 'Priorité', render: (it) => {
        const colors = { low: 'bg-slate-100 text-slate-600', medium: 'bg-sky-100 text-sky-700', high: 'bg-amber-100 text-amber-700', urgent: 'bg-rose-100 text-rose-700' };
        return <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${colors[it.priority]}`}>{it.priority}</span>;
      } },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Catégorie</span>
          <select value={item.category} onChange={(e) => set({ category: e.target.value as MaintItem['category'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="plumbing">Plomberie</option>
            <option value="electrical">Électrique</option>
            <option value="hvac">CVC / clim</option>
            <option value="furniture">Mobilier</option>
            <option value="tech">Technique / IT</option>
            <option value="other">Autre</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Temps (h)</span>
          <input type="number" min={0} step={0.25} value={item.estimatedHours} onChange={(e) => set({ estimatedHours: parseFloat(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Priorité</span>
          <select value={item.priority} onChange={(e) => set({ priority: e.target.value as MaintItem['priority'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="low">Faible</option>
            <option value="medium">Moyenne</option>
            <option value="high">Élevée</option>
            <option value="urgent">Urgente</option>
          </select>
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, category: 'other', estimatedHours: 1, priority: 'medium' })}
    phase2="système de tickets avec SLA, escalade automatique et photos attachées."
  />
);

// ─── Lost & Found ─────────────────────────────────────────────────────────

interface LostFoundItem extends GenericListItem {
  category: 'document' | 'electronics' | 'clothing' | 'valuable' | 'other';
  foundDate: string;
  roomNumber: string;
  status: 'awaiting' | 'returned' | 'donated' | 'destroyed';
}

export const LostFoundPage: React.FC = () => (
  <GenericListPage<LostFoundItem>
    icon={Package}
    category="Housekeeping & Opérations"
    title="Objets trouvés"
    description="Suivi des objets oubliés par les clients et workflow de restitution."
    storageKey="flowtym.lost_found"
    module="housekeeping"
    defaults={[
      { id: 'lf_1', label: 'Chargeur iPhone', code: 'TEC', active: true, category: 'electronics', foundDate: '2026-05-12', roomNumber: '305', status: 'awaiting' },
      { id: 'lf_2', label: 'Passeport français', code: 'DOC', active: true, category: 'document',  foundDate: '2026-05-10', roomNumber: '412', status: 'returned' },
      { id: 'lf_3', label: 'Veste de costume', code: 'CLO', active: true, category: 'clothing',    foundDate: '2026-05-05', roomNumber: '201', status: 'awaiting' },
    ]}
    extraColumns={[
      { header: 'Chambre', render: (it) => <span className="font-mono">{it.roomNumber}</span> },
      { header: 'Trouvé le', render: (it) => new Date(it.foundDate).toLocaleDateString('fr-FR') },
      { header: 'Statut', render: (it) => {
        const colors = { awaiting: 'bg-amber-100 text-amber-700', returned: 'bg-emerald-100 text-emerald-700', donated: 'bg-sky-100 text-sky-700', destroyed: 'bg-rose-100 text-rose-700' };
        const labels = { awaiting: 'En attente', returned: 'Restitué', donated: 'Donné', destroyed: 'Détruit' };
        return <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${colors[it.status]}`}>{labels[it.status]}</span>;
      } },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Catégorie</span>
          <select value={item.category} onChange={(e) => set({ category: e.target.value as LostFoundItem['category'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="document">Document</option>
            <option value="electronics">Électronique</option>
            <option value="clothing">Vêtement</option>
            <option value="valuable">Valeur</option>
            <option value="other">Autre</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Chambre</span>
          <input type="text" value={item.roomNumber} onChange={(e) => set({ roomNumber: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Trouvé le</span>
          <input type="date" value={item.foundDate} onChange={(e) => set({ foundDate: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Statut</span>
          <select value={item.status} onChange={(e) => set({ status: e.target.value as LostFoundItem['status'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="awaiting">En attente</option>
            <option value="returned">Restitué</option>
            <option value="donated">Donné</option>
            <option value="destroyed">Détruit</option>
          </select>
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, category: 'other', foundDate: new Date().toISOString().slice(0, 10), roomNumber: '', status: 'awaiting' })}
    phase2="photo de l'objet + envoi email automatique au client si identifiable."
  />
);

// ─── Breakfast ─────────────────────────────────────────────────────────────

interface BreakfastItem extends GenericListItem {
  pricePerPerson: number;
  serviceHours: string;
  capacity: number;
  bookable: boolean;
}

export const BreakfastPage: React.FC = () => (
  <GenericListPage<BreakfastItem>
    icon={Coffee}
    category="Housekeeping & Opérations"
    title="Petit-déjeuner"
    description="Configuration du service petit-déjeuner : prix, horaires, capacité, options."
    storageKey="flowtym.breakfast"
    module="housekeeping"
    defaults={[
      { id: 'bf_buffet', label: 'Buffet salle restaurant', code: 'BUF', active: true, pricePerPerson: 22, serviceHours: '07:00 - 10:30', capacity: 60, bookable: true },
      { id: 'bf_room',   label: 'Room service',             code: 'RS',  active: true, pricePerPerson: 28, serviceHours: '06:30 - 11:00', capacity: 20, bookable: true },
      { id: 'bf_lite',   label: 'Continental léger',        code: 'LCT', active: false, pricePerPerson: 12, serviceHours: '08:00 - 10:00', capacity: 30, bookable: false },
    ]}
    extraColumns={[
      { header: 'Prix / pers.', render: (it) => <span className="font-semibold">{it.pricePerPerson} €</span> },
      { header: 'Horaire', render: (it) => <span className="font-mono text-[11.5px]">{it.serviceHours}</span> },
      { header: 'Capacité', render: (it) => <span className="tabular-nums">{it.capacity}</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Prix / personne (€)</span>
          <input type="number" min={0} step={0.5} value={item.pricePerPerson} onChange={(e) => set({ pricePerPerson: parseFloat(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Horaires</span>
          <input type="text" value={item.serviceHours} onChange={(e) => set({ serviceHours: e.target.value })} placeholder="07:00 - 10:30" className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Capacité (couverts)</span>
          <input type="number" min={0} value={item.capacity} onChange={(e) => set({ capacity: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-slate-700 mt-6">
          <input type="checkbox" checked={item.bookable} onChange={(e) => set({ bookable: e.target.checked })} className="w-4 h-4 accent-violet-600" />
          Réservable à l'avance
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, pricePerPerson: 0, serviceHours: '', capacity: 0, bookable: true })}
    phase2="comptage automatique des couverts via check-in et facturation auto."
  />
);
