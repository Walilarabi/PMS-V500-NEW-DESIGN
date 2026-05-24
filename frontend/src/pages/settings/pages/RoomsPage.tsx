/**
 * FLOWTYM — Paramètres · Chambres.
 *
 * CRUD complet sur l'inventaire des chambres physiques de
 * l'établissement. Branché sur useConfigStore.updateRooms.
 *
 * Toute modification alimente :
 *   • driver "Chambres avec étage" → score Configuration
 *   • alerte "rooms_no_floor" → Control Center
 *   • le module Inventaire & Planning (compteur de chambres)
 */
import React, { useMemo, useState } from 'react';
import {
  Bed, Plus, Search, Trash2, Pencil, Save, X, CheckCircle2, AlertCircle, Sparkles,
  Filter, ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore, type Room } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

type RoomStatus = Room['status'];

const STATUS_LABEL: Record<RoomStatus, string> = {
  clean: 'Propre',
  dirty: 'À nettoyer',
  inspected: 'Inspectée',
  out_of_order: 'Hors service',
  maintenance: 'Maintenance',
};

const STATUS_TONE: Record<RoomStatus, string> = {
  clean: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  dirty: 'bg-amber-50 text-amber-700 ring-amber-200',
  inspected: 'bg-violet-50 text-violet-700 ring-violet-200',
  out_of_order: 'bg-rose-50 text-rose-700 ring-rose-200',
  maintenance: 'bg-slate-50 text-slate-700 ring-slate-200',
};

const ROOM_CATEGORIES = ['Standard', 'Supérieure', 'Deluxe', 'Suite', 'Suite Junior', 'Penthouse'];
const ROOM_TYPES = ['Simple', 'Double', 'Twin', 'Triple', 'Quadruple', 'Suite'];

export const RoomsPage: React.FC = () => {
  const rooms = useConfigStore((s) => s.rooms);
  const updateRooms = useConfigStore((s) => s.updateRooms);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'all'>('all');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number' | 'floor' | 'price'>('number');
  const [editing, setEditing] = useState<Room | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Room>({
    id: '', number: '', type: 'Double', category: 'Standard', floor: '1', status: 'clean', price: 120,
  });
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  // ─── Filtres & tri ────────────────────────────────────────────────────
  const floors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => { if (r.floor) set.add(r.floor); });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  }, [rooms]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = rooms.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterFloor !== 'all' && r.floor !== filterFloor) return false;
      if (q && !`${r.number} ${r.type} ${r.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (sortBy === 'number') return a.number.localeCompare(b.number, 'fr', { numeric: true });
      if (sortBy === 'floor') return (a.floor || '').localeCompare(b.floor || '', 'fr', { numeric: true });
      if (sortBy === 'price') return (b.price ?? 0) - (a.price ?? 0);
      return 0;
    });
    return arr;
  }, [rooms, search, filterStatus, filterFloor, sortBy]);

  // ─── Métriques ────────────────────────────────────────────────────────
  const orphans = rooms.filter((r) => !r.floor).length;
  const outOfService = rooms.filter((r) => r.status === 'out_of_order' || r.status === 'maintenance').length;
  const avgPrice = rooms.length === 0 ? 0
    : Math.round(rooms.reduce((s, r) => s + (r.price ?? 0), 0) / rooms.length);

  function startAdd() {
    const nextNum = String(Math.max(0, ...rooms.map((r) => parseInt(r.number, 10) || 0)) + 1);
    setDraft({
      id: `room_${Date.now()}`,
      number: nextNum,
      type: 'Double',
      category: 'Standard',
      floor: floors[0] ?? '1',
      status: 'clean',
      price: 120,
    });
    setAdding(true);
    setEditing(null);
  }

  function startEdit(r: Room) {
    setDraft({ ...r });
    setEditing(r);
    setAdding(false);
  }

  function cancel() {
    setEditing(null);
    setAdding(false);
  }

  function save() {
    if (!draft.number.trim()) return;
    if (adding && rooms.some((r) => r.number === draft.number)) {
      notify(`La chambre ${draft.number} existe déjà`);
      return;
    }
    if (adding) {
      updateRooms([...rooms, draft]);
      logAudit({ action: 'module_inspected', module: 'inventory_planning', detail: `Chambre ${draft.number} créée (${draft.type} ${draft.category}, étage ${draft.floor})` });
      notify(`Chambre ${draft.number} créée`);
    } else if (editing) {
      updateRooms(rooms.map((r) => (r.id === editing.id ? draft : r)));
      logAudit({ action: 'module_inspected', module: 'inventory_planning', detail: `Chambre ${draft.number} mise à jour` });
      notify(`Chambre ${draft.number} mise à jour`);
    }
    cancel();
  }

  function remove(r: Room) {
    if (!confirm(`Supprimer la chambre ${r.number} ? Cette action est irréversible.`)) return;
    updateRooms(rooms.filter((x) => x.id !== r.id));
    logAudit({ action: 'module_inspected', module: 'inventory_planning', detail: `Chambre ${r.number} supprimée` });
    notify(`Chambre ${r.number} supprimée`);
  }

  function quickStatus(r: Room, status: RoomStatus) {
    updateRooms(rooms.map((x) => (x.id === r.id ? { ...x, status } : x)));
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Bed className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Chambres & Inventaire</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Chambres</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Inventaire physique de l'établissement — typologie, étage, statut housekeeping, prix de base.
              </p>
            </div>
          </div>
          <button
            onClick={startAdd}
            className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une chambre
          </button>
        </header>

        {/* Métriques */}
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Total chambres" value={`${rooms.length}`} caption={`${floors.length} étage${floors.length > 1 ? 's' : ''}`} tone="violet" />
          <Metric
            label="Prix moyen"
            value={`${avgPrice}€`}
            caption="Prix de base / nuit"
            tone="emerald"
          />
          <Metric
            label="Sans étage"
            value={`${orphans}`}
            caption={orphans === 0 ? 'Configuration complète' : 'Affectation requise'}
            tone={orphans === 0 ? 'emerald' : 'critical'}
          />
          <Metric
            label="Hors service"
            value={`${outOfService}`}
            caption={outOfService === 0 ? 'Toutes en service' : 'Indisponibles à la vente'}
            tone={outOfService === 0 ? 'slate' : 'attention'}
          />
        </div>

        {/* Toolbar */}
        <section className="flex flex-wrap items-center gap-2 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher numéro, type, catégorie…"
              className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-500 outline-none text-[13px]"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as RoomStatus | 'all')}
            className="px-2.5 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px]"
          >
            <option value="all">Tous statuts</option>
            {(Object.keys(STATUS_LABEL) as RoomStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            className="px-2.5 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px]"
          >
            <option value="all">Tous étages</option>
            {floors.map((f) => <option key={f} value={f}>Étage {f}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2.5 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px] inline-flex items-center"
          >
            <option value="number">Tri : numéro</option>
            <option value="floor">Tri : étage</option>
            <option value="price">Tri : prix ↓</option>
          </select>
          <span className="ml-auto text-[11px] text-slate-500 inline-flex items-center gap-1">
            <Filter className="w-3 h-3" /> {filtered.length} / {rooms.length}
          </span>
        </section>

        {/* Table */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center text-slate-400">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <div className="text-[13px] font-medium text-slate-700">
                {rooms.length === 0 ? 'Aucune chambre configurée' : 'Aucun résultat'}
              </div>
              <div className="text-[12px] text-slate-500 mt-1">
                {rooms.length === 0
                  ? 'Cliquez sur "Ajouter une chambre" pour démarrer l\'inventaire.'
                  : 'Modifiez les filtres pour élargir la recherche.'}
              </div>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium w-20">N°</th>
                  <th className="px-3 py-2.5 font-medium">Type / Catégorie</th>
                  <th className="px-3 py-2.5 font-medium w-24">Étage</th>
                  <th className="px-3 py-2.5 font-medium w-40">Statut HK</th>
                  <th className="px-3 py-2.5 font-medium text-right w-24">Prix base</th>
                  <th className="px-3 py-2.5 font-medium text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center text-[13px] font-bold">
                        {r.number}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900 text-[12.5px]">{r.type}</div>
                      <div className="text-[11px] text-slate-500">{r.category}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.floor ? (
                        <span className="text-[12px] font-semibold text-slate-700">Étage {r.floor}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-full px-2 py-0.5">
                          <AlertCircle className="w-3 h-3" /> Sans étage
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={r.status}
                        onChange={(e) => quickStatus(r, e.target.value as RoomStatus)}
                        className={cn('px-2 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset focus:outline-none', STATUS_TONE[r.status])}
                      >
                        {(Object.keys(STATUS_LABEL) as RoomStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                      {r.price ? `${r.price}€` : <span className="text-slate-400 font-normal">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Modifier">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(r)} className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>

      {/* Modal édition */}
      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45" onClick={cancel}>
          <div onClick={(e) => e.stopPropagation()} className="w-[480px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-slate-900">
                {adding ? 'Nouvelle chambre' : `Modifier chambre ${editing?.number}`}
              </h2>
              <button onClick={cancel} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              <RoomField label="Numéro" required>
                <input
                  type="text"
                  value={draft.number}
                  onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                  className="roomi"
                  placeholder="305"
                />
              </RoomField>
              <RoomField label="Étage">
                <input
                  list="floors-datalist"
                  type="text"
                  value={draft.floor}
                  onChange={(e) => setDraft({ ...draft, floor: e.target.value })}
                  className="roomi"
                  placeholder="3"
                />
                <datalist id="floors-datalist">
                  {floors.map((f) => <option key={f} value={f} />)}
                </datalist>
              </RoomField>
              <RoomField label="Type">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="roomi">
                  {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </RoomField>
              <RoomField label="Catégorie">
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="roomi">
                  {ROOM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </RoomField>
              <RoomField label="Statut housekeeping">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RoomStatus })} className="roomi">
                  {(Object.keys(STATUS_LABEL) as RoomStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </RoomField>
              <RoomField label="Prix de base (€/nuit)">
                <input
                  type="number"
                  min={0}
                  value={draft.price ?? 0}
                  onChange={(e) => setDraft({ ...draft, price: parseFloat(e.target.value) || 0 })}
                  className="roomi"
                  placeholder="120"
                />
              </RoomField>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex justify-end gap-2">
              <button onClick={cancel} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
                Annuler
              </button>
              <button onClick={save} disabled={!draft.number.trim()} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40">
                <Save className="w-3.5 h-3.5" /> {adding ? 'Créer' : 'Enregistrer'}
              </button>
            </div>

            <style>{`
              .roomi {
                width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
                background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
                outline: none; font-size: 13px;
              }
              .roomi:focus { box-shadow: inset 0 0 0 2px #7c3aed; }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'emerald' | 'critical' | 'attention' | 'slate' }> = ({ label, value, caption, tone }) => {
  const color = {
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    critical: 'text-rose-700',
    attention: 'text-amber-700',
    slate: 'text-slate-700',
  }[tone];
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums', color)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};

const RoomField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
      {required && <span className="text-rose-500 text-[11px]">*</span>}
    </div>
    {children}
  </label>
);
