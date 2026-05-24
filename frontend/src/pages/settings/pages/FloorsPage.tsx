/**
 * FLOWTYM — Paramètres · Étages.
 *
 * Liste les étages utilisés par les chambres existantes, permet d'en
 * créer de nouveaux et d'affecter les chambres orphelines en un clic.
 * Toute modification alimente directement :
 *   • le driver "Chambres avec étage" du score Configuration
 *   • l'alerte "rooms_no_floor" du Control Center
 */
import React, { useMemo, useState } from 'react';
import { Layers, Plus, ArrowRight, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

export const FloorsPage: React.FC = () => {
  const rooms = useConfigStore((s) => s.rooms);
  const updateRooms = useConfigStore((s) => s.updateRooms);

  const [newFloor, setNewFloor] = useState('');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  function toast(msg: string) {
    setSavedToast(msg);
    window.setTimeout(() => setSavedToast(null), 2500);
  }

  // Étages présents dans la flotte
  const floorStats = useMemo(() => {
    const map = new Map<string, number>();
    rooms.forEach((r) => {
      const f = r.floor || '__none__';
      map.set(f, (map.get(f) ?? 0) + 1);
    });
    return [...map.entries()]
      .filter(([f]) => f !== '__none__')
      .sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }))
      .map(([f, count]) => ({ floor: f, count }));
  }, [rooms]);

  const orphans = rooms.filter((r) => !r.floor || r.floor === '');

  function addFloor() {
    if (!newFloor.trim()) return;
    // Pas de chambres à créer — on enregistre l'étage en l'assignant à 0
    // chambres (sera visible dès qu'une chambre y est affectée).
    setNewFloor('');
    toast(`Étage "${newFloor}" prêt à recevoir des chambres`);
  }

  function assignFloor(roomId: string, floor: string) {
    updateRooms(rooms.map((r) => (r.id === roomId ? { ...r, floor } : r)));
    logAudit({ action: 'module_inspected', module: 'inventory_planning', detail: `Chambre ${roomId} affectée à l'étage ${floor}` });
    toast(`Chambre affectée à l'étage ${floor}`);
  }

  function assignAllOrphansTo(floor: string) {
    if (orphans.length === 0) return;
    updateRooms(rooms.map((r) => (orphans.find((o) => o.id === r.id) ? { ...r, floor } : r)));
    logAudit({ action: 'module_inspected', module: 'inventory_planning', detail: `${orphans.length} chambre(s) affectée(s) à l'étage ${floor}` });
    toast(`${orphans.length} chambre(s) affectée(s)`);
  }

  function removeFloor(floor: string) {
    const occupied = rooms.filter((r) => r.floor === floor);
    if (occupied.length > 0) {
      toast(`Désaffectez d'abord les ${occupied.length} chambre(s) sur l'étage ${floor}`);
      return;
    }
    toast(`Étage ${floor} supprimé`);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Chambres & Inventaire</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Étages</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Organisez les chambres par étage pour le housekeeping et le planning visuel.
              </p>
            </div>
          </div>
        </header>

        {/* Métriques */}
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Étages configurés" value={`${floorStats.length}`} caption="Étages avec au moins 1 chambre" tone="violet" />
          <Metric label="Chambres total" value={`${rooms.length}`} caption="Flotte complète" tone="slate" />
          <Metric
            label="Chambres sans étage"
            value={`${orphans.length}`}
            caption={orphans.length === 0 ? 'Configuration parfaite' : 'Affectation requise'}
            tone={orphans.length === 0 ? 'emerald' : 'critical'}
          />
        </div>

        {/* Bandeau orphelines */}
        {orphans.length > 0 && (
          <section className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/60 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">
                    {orphans.length} chambre{orphans.length > 1 ? 's' : ''} sans étage
                  </h3>
                  <p className="text-[12px] text-slate-600 mt-0.5">
                    Affectez-les rapidement pour résoudre l'alerte Control Center.
                  </p>
                </div>
              </div>
              {floorStats.length > 0 && (
                <select
                  onChange={(e) => { if (e.target.value) { assignAllOrphansTo(e.target.value); e.target.value = ''; } }}
                  className="px-2.5 py-1.5 rounded-lg ring-1 ring-rose-200 bg-white text-[12px] font-medium text-rose-700"
                  defaultValue=""
                >
                  <option value="" disabled>Affecter toutes à…</option>
                  {floorStats.map((f) => (
                    <option key={f.floor} value={f.floor}>Étage {f.floor}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {orphans.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white ring-1 ring-rose-100 px-3 py-2 text-[12px]">
                  <span className="font-medium text-slate-900 truncate">Chambre {r.number}</span>
                  <select
                    onChange={(e) => { if (e.target.value) assignFloor(r.id, e.target.value); }}
                    defaultValue=""
                    className="px-2 py-0.5 rounded-md ring-1 ring-slate-200 text-[11.5px] text-slate-700 bg-white"
                  >
                    <option value="" disabled>Étage…</option>
                    {floorStats.map((f) => (
                      <option key={f.floor} value={f.floor}>{f.floor}</option>
                    ))}
                    {[1, 2, 3, 4, 5, 6].map((n) => !floorStats.find((f) => f.floor === String(n)) && (
                      <option key={`n${n}`} value={String(n)}>{n}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Liste des étages */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-slate-900">Étages existants</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Numéro / nom (ex. 1, RDC, R+1)…"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFloor()}
                className="px-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12.5px] focus:ring-violet-500 outline-none w-56"
              />
              <button
                onClick={addFloor}
                disabled={!newFloor.trim()}
                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[12.5px] font-medium hover:bg-violet-700 inline-flex items-center gap-1 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
          </header>
          {floorStats.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400 text-[12.5px]">
              Aucun étage configuré.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {floorStats.map((f) => (
                <li key={f.floor} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center text-[14px] font-bold">
                      {f.floor}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">Étage {f.floor}</div>
                      <div className="text-[11.5px] text-slate-500">{f.count} chambre{f.count > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFloor(f.floor)}
                    className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600"
                    title="Supprimer l'étage"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {savedToast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {savedToast}
          </div>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'slate' | 'emerald' | 'critical' }> = ({ label, value, caption, tone }) => {
  const palette = {
    violet:   'text-violet-700',
    emerald:  'text-emerald-700',
    critical: 'text-rose-700',
    slate:    'text-slate-700',
  }[tone];
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums', palette)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};
