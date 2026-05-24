/**
 * FLOWTYM — Modale "Créer une chambre virtuelle".
 *
 * Une chambre virtuelle n'a pas d'existence physique : elle représente
 * une combinaison de chambres réelles vendue comme une seule unité.
 * Exemples :
 *   • "Deux chambres adjacentes" (Family) — vente jointe de 2 standard
 *   • "Chambre communicante"               — porte intérieure entre 2 unités
 *   • "Suite composée"                     — chambre + salon attenant
 *   • "Twin/Double"                        — unité physique vendable des 2 façons
 *
 * Comportement métier :
 *   • la capacité est calculée à partir de la somme des composantes ;
 *   • la dispo dépend des composantes ("all" = toutes requises) ;
 *   • marquée `isVirtual = true` dans le store pour les moteurs RMS /
 *     channel manager (à propager côté connecteurs : à venir).
 */
import React, { useMemo, useState } from 'react';
import { Layers, X, Link2, Plus, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import type { RoomTypeData, VirtualRoomKind, BathroomType } from '@/src/components/rms/types';
import { syncVirtualRoomToSupabase } from '@/src/services/settings/settingsPersistence';
import { useAuditLogger } from '@/src/hooks/settings/useAuditLogger';

type Preset = {
  kind: VirtualRoomKind;
  label: string;
  description: string;
  defaultName: string;
  defaultCode: string;
  recommendedComponents: number;
  componentsRequired: 'all' | 'any';
  emoji: string;
};

const PRESETS: Preset[] = [
  {
    kind: 'adjacent',
    label: 'Deux chambres adjacentes',
    description: 'Vente jointe de 2 chambres côte à côte — idéal famille / groupe.',
    defaultName: 'Deux chambres adjacentes',
    defaultCode: 'ADJ',
    recommendedComponents: 2,
    componentsRequired: 'all',
    emoji: '🛏️🛏️',
  },
  {
    kind: 'connecting',
    label: 'Chambres communicantes',
    description: 'Deux chambres reliées par une porte intérieure (suite famille).',
    defaultName: 'Chambres communicantes',
    defaultCode: 'COM',
    recommendedComponents: 2,
    componentsRequired: 'all',
    emoji: '🚪',
  },
  {
    kind: 'suite_combo',
    label: 'Suite composée',
    description: 'Combinaison d\'une chambre standard et d\'un salon attenant.',
    defaultName: 'Suite composée',
    defaultCode: 'SUITE',
    recommendedComponents: 2,
    componentsRequired: 'all',
    emoji: '🛋️',
  },
  {
    kind: 'family_combo',
    label: 'Combo familial',
    description: 'Combinaison de chambres pour grande famille (double + single, etc.).',
    defaultName: 'Combo familial',
    defaultCode: 'FAM',
    recommendedComponents: 2,
    componentsRequired: 'all',
    emoji: '👨‍👩‍👧',
  },
  {
    kind: 'split_twin',
    label: 'Twin / Double interchangeable',
    description: 'Unité physique vendue indifféremment en lit double ou en lits jumeaux.',
    defaultName: 'Twin / Double',
    defaultCode: 'TWIN',
    recommendedComponents: 1,
    componentsRequired: 'any',
    emoji: '🔁',
  },
  {
    kind: 'custom',
    label: 'Composition personnalisée',
    description: 'Définissez votre propre combinaison.',
    defaultName: 'Chambre virtuelle',
    defaultCode: 'VIRT',
    recommendedComponents: 2,
    componentsRequired: 'all',
    emoji: '✨',
  },
];

interface VirtualRoomModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (roomTypeId: string) => void;
}

export const VirtualRoomModal: React.FC<VirtualRoomModalProps> = ({ open, onClose, onCreated }) => {
  const { roomTypes, addRoomType } = useRateCalendarStore();
  const physicalRooms = useMemo(() => roomTypes.filter((rt) => !rt.isVirtual), [roomTypes]);
  const audit = useAuditLogger();

  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [name, setName] = useState(PRESETS[0].defaultName);
  const [code, setCode] = useState(PRESETS[0].defaultCode);
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [componentsRequired, setComponentsRequired] = useState<'all' | 'any'>(PRESETS[0].componentsRequired);
  const [bathroom, setBathroom] = useState<BathroomType>('Douche');
  const [error, setError] = useState<string | null>(null);

  function applyPreset(p: Preset) {
    setPreset(p);
    setName(p.defaultName);
    setCode(p.defaultCode);
    setComponentsRequired(p.componentsRequired);
  }

  function toggleComponent(id: string) {
    setSelectedIds((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]);
  }

  const components = useMemo(
    () => selectedIds.map((id) => physicalRooms.find((r) => r.roomTypeId === id)).filter(Boolean) as RoomTypeData[],
    [selectedIds, physicalRooms],
  );

  // Capacité = somme des capacités des composantes (mode "all") ou max (mode "any")
  const computedCapacity = useMemo(() => {
    if (components.length === 0) return 0;
    if (componentsRequired === 'any') return Math.max(...components.map((c) => c.capacity ?? 0));
    return components.reduce((s, c) => s + (c.capacity ?? 0), 0);
  }, [components, componentsRequired]);

  function handleCreate() {
    setError(null);
    if (!name.trim()) { setError('Nom de la chambre virtuelle requis'); return; }
    if (!code.trim()) { setError('Code de la chambre virtuelle requis'); return; }
    if (selectedIds.length === 0) { setError('Sélectionnez au moins une chambre physique composante'); return; }
    if (preset.kind !== 'split_twin' && selectedIds.length < 2) {
      setError('Une chambre virtuelle doit composer au moins 2 chambres physiques (sauf Twin/Double)');
      return;
    }
    if (roomTypes.some((r) => r.roomTypeCode.toLowerCase() === code.trim().toLowerCase())) {
      setError(`Le code "${code}" existe déjà — choisissez un code unique`);
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    const finalDescription = description.trim() || `Chambre virtuelle composée de ${components.map((c) => c.roomTypeName).join(' + ')}.`;
    const componentIds = [...selectedIds];

    addRoomType({
      roomName: name.trim(),
      roomCode: trimmedCode,
      capacity: computedCapacity,
      bathroom,
      equipment: [],
      view: '',
      description: finalDescription,
      isReference: false,
      assignedRatePlanIds: [],
      distributionChannels: ['Direct'],
      diffFromRef: 0,
      diffType: 'fixed',
      isVirtual: true,
      virtualKind: preset.kind,
      virtualComposition: {
        componentRoomTypeIds: componentIds,
        componentsRequired,
      },
    });

    // Synchro Supabase best-effort — n'altère pas l'UX si offline
    void syncVirtualRoomToSupabase({
      roomTypeId: `rt_${trimmedCode.toLowerCase()}`,
      roomTypeName: name.trim(),
      roomTypeCode: trimmedCode,
      virtualKind: preset.kind,
      componentRoomTypeIds: componentIds,
      componentsRequired,
      capacity: computedCapacity,
      bathroom,
      description: finalDescription,
      isActive: true,
    });

    audit({
      action: 'virtual_room_created',
      module: 'inventory_planning',
      detail: `${name.trim()} (${trimmedCode}) — ${preset.label}`,
      meta: {
        roomTypeCode: trimmedCode,
        virtualKind: preset.kind,
        components: componentIds,
        componentsRequired,
        capacity: computedCapacity,
      },
    });

    onCreated?.(`rt_${code.toLowerCase()}`);
    handleClose();
  }

  function handleClose() {
    setPreset(PRESETS[0]);
    setName(PRESETS[0].defaultName);
    setCode(PRESETS[0].defaultCode);
    setDescription('');
    setSelectedIds([]);
    setComponentsRequired(PRESETS[0].componentsRequired);
    setBathroom('Douche');
    setError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900">Créer une chambre virtuelle</h3>
              <p className="text-[11.5px] text-slate-500">
                Combinez plusieurs chambres physiques en une seule unité vendable (adjacentes, communicantes, suite, etc.).
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* Type de combinaison */}
          <section>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-2">Type de combinaison</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-xl ring-1 transition-all flex items-start gap-2.5',
                    preset.kind === p.kind
                      ? 'ring-violet-500 bg-violet-50/60'
                      : 'ring-slate-200 hover:ring-slate-300 bg-white',
                  )}
                >
                  <span className="text-lg leading-none shrink-0" aria-hidden>{p.emoji}</span>
                  <span className="min-w-0">
                    <span className={cn('block text-[13px] font-semibold', preset.kind === p.kind ? 'text-violet-900' : 'text-slate-900')}>
                      {p.label}
                    </span>
                    <span className="block text-[11.5px] text-slate-500 mt-0.5 leading-snug">{p.description}</span>
                  </span>
                  {preset.kind === p.kind && (
                    <Check className="w-4 h-4 text-violet-600 shrink-0 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Identité */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Nom de la chambre virtuelle</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
                placeholder="Ex : Deux chambres adjacentes"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Code court</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none font-mono uppercase"
                placeholder="ADJ"
              />
            </div>
          </section>

          {/* Composantes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                Chambres physiques composantes
                <span className="ml-2 text-slate-400 normal-case font-normal">
                  ({selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''})
                </span>
              </div>
              <div className="inline-flex bg-slate-100 rounded-lg p-0.5 text-[11.5px] font-medium">
                <button
                  type="button"
                  onClick={() => setComponentsRequired('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-colors',
                    componentsRequired === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}
                  title="Toutes les composantes doivent être disponibles"
                >
                  Toutes requises
                </button>
                <button
                  type="button"
                  onClick={() => setComponentsRequired('any')}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-colors',
                    componentsRequired === 'any' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}
                  title="Au moins une composante disponible suffit"
                >
                  Une suffit
                </button>
              </div>
            </div>
            {physicalRooms.length === 0 ? (
              <div className="rounded-xl ring-1 ring-amber-100 bg-amber-50/60 px-4 py-3 text-[12px] text-amber-800">
                Aucune chambre physique disponible — créez d'abord vos typologies dans le calendrier tarifaire.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto pr-1 rounded-xl ring-1 ring-slate-100 p-2 bg-slate-50/40">
                {physicalRooms.map((r) => {
                  const selected = selectedIds.includes(r.roomTypeId);
                  return (
                    <label
                      key={r.roomTypeId}
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors',
                        selected ? 'bg-violet-50 ring-1 ring-violet-200' : 'bg-white hover:bg-slate-50 ring-1 ring-transparent',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleComponent(r.roomTypeId)}
                        className="w-3.5 h-3.5 accent-violet-600 shrink-0"
                      />
                      <span className="w-8 h-8 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-[10.5px] font-bold shrink-0">
                        {r.roomTypeCode}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium text-slate-900 truncate">{r.roomTypeName}</span>
                        <span className="block text-[10.5px] text-slate-500">{r.capacity} pers. · {r.bathroom}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* Résumé */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryStat label="Composantes" value={`${selectedIds.length}`} />
            <SummaryStat label="Capacité calculée" value={`${computedCapacity} pers.`} tone="violet" />
            <SummaryStat label="Mode disponibilité" value={componentsRequired === 'all' ? 'Toutes requises' : 'Une suffit'} />
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-slate-400 font-medium">Sanitaire</label>
              <select
                value={bathroom}
                onChange={(e) => setBathroom(e.target.value as BathroomType)}
                className="w-full mt-0.5 px-2 py-1.5 text-[12.5px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
              >
                <option value="Douche">Douche</option>
                <option value="Baignoire">Baignoire</option>
                <option value="Les deux">Les deux</option>
                <option value="Aucune">Aucune</option>
              </select>
            </div>
          </section>

          <section>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ex : Idéale pour familles — 2 chambres connectées avec accès direct."
              className="w-full px-3 py-2 text-[12.5px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none resize-none"
            />
          </section>

          {/* Aperçu / explication */}
          <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-3 py-2.5 text-[11.5px] text-violet-900 flex items-start gap-2">
            <Link2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Comportement métier</div>
              <p className="text-violet-800/90 mt-0.5">
                Cette chambre virtuelle est marquée <strong>non physique</strong> et ne sera pas comptée dans l'inventaire global.
                Sa disponibilité dépend des composantes sélectionnées ({componentsRequired === 'all' ? 'toutes requises' : 'une suffit'}),
                et toute vente verrouille automatiquement les unités physiques correspondantes.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-[12px] rounded-xl px-3 py-2 ring-1 bg-rose-50 ring-rose-100 text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={handleClose} className="px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-[13px] font-medium text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Créer la chambre virtuelle
          </button>
        </div>
      </div>
    </div>
  );
};

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: 'violet' }) {
  const color = tone === 'violet' ? 'text-violet-700' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className={cn('text-[14px] font-semibold tabular-nums mt-0.5', color)}>{value}</div>
    </div>
  );
}
