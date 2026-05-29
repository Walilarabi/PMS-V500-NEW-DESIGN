/**
 * FLOWTYM — Fiche chambre (premium drawer, 8 onglets).
 *
 * Onglets :
 *   Général · Capacité · Inventaire · Équipements · Plans · Partenaires · Photos · Audit
 *
 * Persistance en Supabase (RLS hotel_id). Aucune donnée fake.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Loader2, Save, AlertCircle, Bed, Network, Camera, Clock, Users, Wrench,
  Grid, Star, Power, Plus, Trash2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';
import { listRatePlanOptions, listPartners, type PartnerSummary, type Option } from '@/src/services/settings/partners.service';
import { listRoomTypeRows, type RoomTypeRow } from '@/src/services/settings/rate-plans.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'general' | 'capacity' | 'inventory' | 'amenities' | 'plans' | 'partners' | 'photos' | 'audit';

const AMENITIES_LIST = [
  'Climatisation', 'Wi-Fi', 'Télévision', 'Minibar', 'Coffre-fort',
  'Bureau', 'Terrasse', 'Balcon', 'Baignoire', 'Douche à l\'italienne',
  'Jacuzzi', 'Vue mer', 'Vue jardin', 'Vue piscine', 'Kitchenette',
  'Salon séparé', 'Lit king-size', 'Lits jumeaux', 'Canapé-lit', 'Accessibilité PMR',
];

interface RoomTypeFull {
  id: string;
  room_type_code: string;
  room_type_name: string;
  description: string | null;
  view: string | null;
  bathroom: string;
  capacity: number;
  adults_max: number | null;
  children_max: number | null;
  babies_max: number | null;
  rooms_count: number | null;
  floor_info: string | null;
  equipment: string[];
  is_reference: boolean;
  is_active: boolean;
  is_virtual: boolean;
  virtual_kind: string | null;
  display_order: number | null;
  diff_from_ref: number;
  diff_type: 'fixed' | 'percent';
  partner_ids: string[];
  photo_urls: string[];
  created_at: string | null;
  updated_at: string | null;
}

const BLANK: Omit<RoomTypeFull, 'id' | 'created_at' | 'updated_at'> = {
  room_type_code: '',
  room_type_name: '',
  description: null,
  view: null,
  bathroom: 'Douche',
  capacity: 2,
  adults_max: 2,
  children_max: null,
  babies_max: null,
  rooms_count: null,
  floor_info: null,
  equipment: [],
  is_reference: false,
  is_active: true,
  is_virtual: false,
  virtual_kind: null,
  display_order: null,
  diff_from_ref: 0,
  diff_type: 'fixed',
  partner_ids: [],
  photo_urls: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  roomId: string | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const RoomTypeSheet: React.FC<Props> = ({ roomId, canWrite, onClose, onSaved }) => {
  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState<Omit<RoomTypeFull, 'id' | 'created_at' | 'updated_at'>>({ ...BLANK });
  const [savedId, setSavedId] = useState<string | null>(roomId);
  const [loading, setLoading] = useState(!!roomId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [planOpts, setPlanOpts] = useState<Option[]>([]);
  const [partnerList, setPartnerList] = useState<PartnerSummary[]>([]);
  const [allRooms, setAllRooms] = useState<RoomTypeRow[]>([]);

  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plans, partners, rooms] = await Promise.all([
        listRatePlanOptions(),
        listPartners(),
        listRoomTypeRows(),
      ]);
      setPlanOpts(plans);
      setPartnerList(partners);
      setAllRooms(rooms.filter((r) => r.id !== roomId));

      if (roomId) {
        const hid = await resolveHotelId();
        const { data } = await sb.from('room_types').select('*').eq('id', roomId).eq('hotel_id', hid).maybeSingle();
        if (data) {
          setForm({
            room_type_code: data.room_type_code ?? '',
            room_type_name: data.room_type_name ?? '',
            description: data.description ?? null,
            view: data.view ?? null,
            bathroom: data.bathroom ?? 'Douche',
            capacity: data.capacity ?? 2,
            adults_max: data.adults_max ?? data.capacity ?? 2,
            children_max: data.children_max ?? null,
            babies_max: data.babies_max ?? null,
            rooms_count: data.rooms_count ?? null,
            floor_info: data.floor_info ?? null,
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
            is_reference: data.is_reference ?? false,
            is_active: data.is_active ?? true,
            is_virtual: data.is_virtual ?? false,
            virtual_kind: data.virtual_kind ?? null,
            display_order: data.display_order ?? null,
            diff_from_ref: data.diff_from_ref ?? 0,
            diff_type: data.diff_type ?? 'fixed',
            partner_ids: Array.isArray(data.partner_ids) ? data.partner_ids : [],
            photo_urls: Array.isArray(data.photo_urls) ? data.photo_urls : [],
          });

          // Load partner mappings
          const { data: pMappings } = await sb.from('partner_room_mappings')
            .select('partner_id').eq('room_type_id', roomId).eq('is_active', true);
          setSelectedPartners(new Set((pMappings ?? []).map((m: { partner_id: string }) => m.partner_id)));

          // Load rate plan associations
          const { data: rpData } = await sb.from('rate_plans')
            .select('id').eq('room_type_id', roomId).eq('hotel_id', hid).is('deleted_at', null);
          setSelectedPlans(new Set((rpData ?? []).map((p: { id: string }) => p.id)));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { void load(); }, [load]);

  const f = (field: keyof typeof BLANK, val: unknown) => setForm((prev) => ({ ...prev, [field]: val }));

  const save = async () => {
    if (!form.room_type_code.trim()) { setError('Le code de la chambre est obligatoire'); return; }
    if (!form.room_type_name.trim()) { setError('Le nom de la chambre est obligatoire'); return; }
    setSaving(true);
    setError(null);
    try {
      const hid = await resolveHotelId();
      if (!hid) throw new Error('Hôtel introuvable — reconnectez-vous.');

      const payload: Record<string, unknown> = {
        hotel_id: hid,
        room_type_code: form.room_type_code.trim().toUpperCase(),
        room_type_name: form.room_type_name.trim(),
        description: form.description || null,
        view: form.view || null,
        bathroom: form.bathroom,
        capacity: form.capacity,
        adults_max: form.adults_max,
        children_max: form.children_max,
        babies_max: form.babies_max,
        rooms_count: form.rooms_count,
        floor_info: form.floor_info || null,
        equipment: form.equipment,
        is_reference: form.is_reference,
        is_active: form.is_active,
        is_virtual: form.is_virtual,
        virtual_kind: form.is_virtual ? form.virtual_kind : null,
        display_order: form.display_order,
        diff_from_ref: form.diff_from_ref,
        diff_type: form.diff_type,
        partner_ids: [...selectedPartners],
        photo_urls: form.photo_urls,
        updated_at: new Date().toISOString(),
      };
      if (savedId) payload.id = savedId;

      const { data, error: upsertError } = await sb.from('room_types')
        .upsert(payload, { onConflict: 'hotel_id,room_type_code' })
        .select('id').maybeSingle();
      if (upsertError) throw new Error(upsertError.message);
      const newId = data?.id ?? savedId;
      setSavedId(newId);

      // Sync partner mappings
      if (newId) {
        const { data: existing } = await sb.from('partner_room_mappings')
          .select('id, partner_id').eq('room_type_id', newId);
        const existingRows: { id: string; partner_id: string }[] = existing ?? [];
        const existingSet = new Set(existingRows.map((r) => r.partner_id));
        const toAdd = [...selectedPartners].filter((pid) => !existingSet.has(pid));
        const toRemove = existingRows.filter((r) => !selectedPartners.has(r.partner_id)).map((r) => r.id);
        if (toAdd.length) {
          await sb.from('partner_room_mappings').upsert(
            toAdd.map((pid) => ({ hotel_id: hid, partner_id: pid, room_type_id: newId, is_active: true })),
            { onConflict: 'hotel_id,partner_id,room_type_id' },
          );
        }
        if (toRemove.length) {
          await sb.from('partner_room_mappings').delete().in('id', toRemove);
        }
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const TABS: [Tab, string, React.ReactNode][] = [
    ['general', 'Général', null],
    ['capacity', 'Capacité', <Users key="u" className="w-3.5 h-3.5" />],
    ['inventory', 'Inventaire', <Wrench key="w" className="w-3.5 h-3.5" />],
    ['amenities', 'Équipements', null],
    ['plans', 'Plans tarifaires', <Grid key="g" className="w-3.5 h-3.5" />],
    ['partners', 'Partenaires', <Network key="n" className="w-3.5 h-3.5" />],
    ['photos', 'Photos', <Camera key="c" className="w-3.5 h-3.5" />],
    ['audit', 'Audit', <Clock key="cl" className="w-3.5 h-3.5" />],
  ];
  const locked = tab !== 'general' && !savedId;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-screen w-full max-w-[860px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 bg-slate-800 text-white shrink-0">
          <div>
            <h2 className="text-[15px] font-bold">
              {roomId ? form.room_type_name || 'Chambre' : 'Nouvelle chambre'}
            </h2>
            <p className="text-[12px] text-slate-300">
              {form.room_type_code && <span className="font-mono mr-2">{form.room_type_code}</span>}
              Fiche chambre
            </p>
          </div>
          <div className="flex items-center gap-2">
            {form.is_reference && <span className="inline-flex items-center gap-1 text-[11px] bg-amber-400/20 text-amber-100 px-2 py-0.5 rounded-full"><Star className="w-3 h-3 fill-amber-300" /> Référente</span>}
            {form.is_virtual && <span className="inline-flex items-center gap-1 text-[11px] bg-sky-400/20 text-sky-100 px-2 py-0.5 rounded-full"><Bed className="w-3 h-3" /> Virtuelle</span>}
            <span className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full', form.is_active ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-white/70')}>
              <Power className="w-3 h-3" /> {form.is_active ? 'Active' : 'Inactive'}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 ml-1"><X className="w-4 h-4" /></button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-0.5 px-4 pt-2 border-b border-slate-100 shrink-0 overflow-x-auto">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => !locked && setTab(id)}
              disabled={locked && id !== 'general'}
              className={cn('px-3 py-2 text-[12.5px] font-medium rounded-t-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                tab === id ? 'text-slate-800 border-b-2 border-slate-800 bg-slate-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <>
              {tab === 'general' && <TabGeneral form={form} f={f} canWrite={canWrite} />}
              {tab === 'capacity' && <TabCapacity form={form} f={f} canWrite={canWrite} />}
              {tab === 'inventory' && <TabInventory form={form} f={f} canWrite={canWrite} allRooms={allRooms} />}
              {tab === 'amenities' && <TabAmenities form={form} f={f} canWrite={canWrite} />}
              {tab === 'plans' && <TabPlans opts={planOpts} selected={selectedPlans} onChange={setSelectedPlans} canWrite={canWrite} />}
              {tab === 'partners' && <TabPartners partners={partnerList} selected={selectedPartners} onChange={setSelectedPartners} canWrite={canWrite} />}
              {tab === 'photos' && <TabPhotos form={form} f={f} canWrite={canWrite} />}
              {tab === 'audit' && <TabAudit roomId={savedId} />}
            </>
          )}
        </div>

        {error && (
          <div className="px-5 py-2 bg-rose-50 border-t border-rose-100 text-[12.5px] text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {canWrite && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between shrink-0">
            <button onClick={onClose} className="px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Fermer</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-[13px] font-semibold hover:bg-slate-900 inline-flex items-center gap-1.5 disabled:opacity-50 shadow-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Enregistrer
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

// ─── Onglets ──────────────────────────────────────────────────────────────────

type FormUpdater = (field: keyof typeof BLANK, val: unknown) => void;

const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-slate-500 outline-none disabled:bg-slate-50 disabled:text-slate-500 bg-white';
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
    {hint && <span className="ml-2 text-[10.5px] text-slate-400">{hint}</span>}
    {children}
  </label>
);

const TabGeneral: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean }> = ({ form, f, canWrite }) => (
  <div className="space-y-4 max-w-xl">
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nom *">
        <input value={form.room_type_name} onChange={(e) => f('room_type_name', e.target.value)} className={inputCls} disabled={!canWrite} />
      </Field>
      <Field label="Code *">
        <input value={form.room_type_code} onChange={(e) => f('room_type_code', e.target.value.toUpperCase())} className={inputCls + ' font-mono'} disabled={!canWrite} />
      </Field>
    </div>
    <Field label="Description">
      <textarea value={form.description ?? ''} onChange={(e) => f('description', e.target.value || null)}
        className={inputCls + ' min-h-[64px] resize-y'} disabled={!canWrite} rows={2} />
    </Field>
    <div className="grid grid-cols-3 gap-3">
      <Field label="Vue">
        <select value={form.view ?? ''} onChange={(e) => f('view', e.target.value || null)} className={inputCls} disabled={!canWrite}>
          <option value="">—</option>
          <option value="mer">Mer</option>
          <option value="jardin">Jardin</option>
          <option value="piscine">Piscine</option>
          <option value="ville">Ville</option>
          <option value="montagne">Montagne</option>
          <option value="parking">Parking</option>
        </select>
      </Field>
      <Field label="Salle de bain">
        <select value={form.bathroom} onChange={(e) => f('bathroom', e.target.value)} className={inputCls} disabled={!canWrite}>
          <option value="Douche">Douche</option>
          <option value="Baignoire">Baignoire</option>
          <option value="Douche + Baignoire">Douche + Baignoire</option>
          <option value="Aucune">Aucune</option>
        </select>
      </Field>
      <Field label="Ordre d'affichage">
        <input type="number" value={form.display_order ?? ''} onChange={(e) => f('display_order', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Auto" />
      </Field>
    </div>
    <div className="flex gap-4 flex-wrap">
      <label className="flex items-center gap-2 text-[13px] text-slate-700">
        <input type="checkbox" checked={form.is_active} onChange={(e) => f('is_active', e.target.checked)} disabled={!canWrite} />
        Chambre active
      </label>
      <label className="flex items-center gap-2 text-[13px] text-slate-700">
        <input type="checkbox" checked={form.is_reference} onChange={(e) => f('is_reference', e.target.checked)} disabled={!canWrite} />
        Chambre de référence
      </label>
      <label className="flex items-center gap-2 text-[13px] text-slate-700">
        <input type="checkbox" checked={form.is_virtual} onChange={(e) => f('is_virtual', e.target.checked)} disabled={!canWrite} />
        Chambre virtuelle (distribuable)
      </label>
    </div>
    {form.is_virtual && (
      <Field label="Type de virtualité">
        <select value={form.virtual_kind ?? 'custom'} onChange={(e) => f('virtual_kind', e.target.value)} className={inputCls} disabled={!canWrite}>
          <option value="adjacent">Adjacentes</option>
          <option value="connecting">Communicantes</option>
          <option value="suite_combo">Suite composée</option>
          <option value="family_combo">Combo familial</option>
          <option value="split_twin">Twin / Double</option>
          <option value="custom">Personnalisée</option>
        </select>
      </Field>
    )}
  </div>
);

const TabCapacity: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean }> = ({ form, f, canWrite }) => (
  <div className="space-y-4 max-w-xl">
    <Field label="Capacité standard (personnes)">
      <input type="number" min="1" max="20" value={form.capacity} onChange={(e) => f('capacity', parseInt(e.target.value) || 1)} className={inputCls} disabled={!canWrite} />
    </Field>
    <div className="grid grid-cols-3 gap-3">
      <Field label="Adultes max">
        <input type="number" min="0" max="20" value={form.adults_max ?? ''} onChange={(e) => f('adults_max', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucun" />
      </Field>
      <Field label="Enfants max">
        <input type="number" min="0" max="10" value={form.children_max ?? ''} onChange={(e) => f('children_max', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucun" />
      </Field>
      <Field label="Bébés max">
        <input type="number" min="0" max="5" value={form.babies_max ?? ''} onChange={(e) => f('babies_max', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucun" />
      </Field>
    </div>
    <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 p-4 text-[12.5px] text-slate-600">
      <div className="font-semibold text-slate-900 mb-1">Récapitulatif</div>
      <div>
        Capacité standard : <strong>{form.capacity}</strong> pers. —
        Adultes : <strong>{form.adults_max ?? form.capacity}</strong>,
        Enfants : <strong>{form.children_max ?? 0}</strong>,
        Bébés : <strong>{form.babies_max ?? 0}</strong>
      </div>
    </div>
  </div>
);

const TabInventory: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean; allRooms: RoomTypeRow[] }> = ({ form, f, canWrite }) => (
  <div className="space-y-4 max-w-xl">
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nombre de chambres physiques">
        <input type="number" min="1" value={form.rooms_count ?? ''} onChange={(e) => f('rooms_count', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Non renseigné" />
      </Field>
      <Field label="Étage(s)" hint="ex: 1, 2-4, RC">
        <input value={form.floor_info ?? ''} onChange={(e) => f('floor_info', e.target.value || null)} className={inputCls} disabled={!canWrite} placeholder="ex: 1, 2, 3" />
      </Field>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Écart de prix vs référence">
        <input type="number" step="0.01" value={form.diff_from_ref} onChange={(e) => f('diff_from_ref', parseFloat(e.target.value) || 0)} className={inputCls} disabled={!canWrite} />
      </Field>
      <Field label="Type d'écart">
        <select value={form.diff_type} onChange={(e) => f('diff_type', e.target.value)} className={inputCls} disabled={!canWrite}>
          <option value="fixed">Montant fixe (€)</option>
          <option value="percent">Pourcentage (%)</option>
        </select>
      </Field>
    </div>
  </div>
);

const TabAmenities: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean }> = ({ form, f, canWrite }) => {
  const toggle = (item: string) => {
    const current: string[] = Array.isArray(form.equipment) ? form.equipment : [];
    f('equipment', current.includes(item) ? current.filter((x) => x !== item) : [...current, item]);
  };
  const current: string[] = Array.isArray(form.equipment) ? form.equipment : [];
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-slate-500">{current.length} équipement(s) sélectionné(s)</p>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
        {AMENITIES_LIST.map((item) => (
          <label key={item} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg ring-1 cursor-pointer text-[12.5px] transition-colors',
            current.includes(item) ? 'bg-slate-800/5 ring-slate-300 text-slate-900 font-medium' : 'ring-slate-100 text-slate-600 hover:bg-slate-50')}>
            <input type="checkbox" checked={current.includes(item)} onChange={() => toggle(item)} disabled={!canWrite} className="shrink-0" />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
};

const TabPlans: React.FC<{ opts: Option[]; selected: Set<string>; onChange: (s: Set<string>) => void; canWrite: boolean }> = ({ opts, selected, onChange, canWrite }) => {
  const allSelected = opts.length > 0 && opts.every((o) => selected.has(o.id));
  const toggleAll = () => onChange(allSelected ? new Set() : new Set(opts.map((o) => o.id)));
  const toggle = (id: string) => {
    onChange((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  if (opts.length === 0) return <div className="text-[12.5px] text-slate-400 py-8 text-center">Aucun plan tarifaire actif.</div>;
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500">Plans tarifaires associés à cette chambre.</p>
      <div className="flex items-center justify-between">
        <label className={cn('flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3 py-2 ring-1 cursor-pointer', allSelected ? 'bg-slate-800/5 ring-slate-300 text-slate-900' : 'bg-white ring-slate-200 text-slate-700')}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canWrite} />
          Tous les plans
        </label>
        <span className="text-[12px] text-slate-500 tabular-nums">{selected.size} / {opts.length}</span>
      </div>
      <div className="rounded-xl ring-1 ring-slate-100 divide-y divide-slate-50 max-h-[46vh] overflow-y-auto">
        {opts.map((o) => (
          <label key={o.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50/60 cursor-pointer">
            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} disabled={!canWrite} />
            <span className="text-[13px] text-slate-800 flex-1">{o.name}</span>
            <span className="text-[11px] font-mono text-slate-400">{o.code}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const TabPartners: React.FC<{ partners: PartnerSummary[]; selected: Set<string>; onChange: (s: Set<string>) => void; canWrite: boolean }> = ({ partners, selected, onChange, canWrite }) => {
  const allSelected = partners.length > 0 && partners.every((p) => selected.has(p.id));
  const toggleAll = () => onChange(allSelected ? new Set() : new Set(partners.map((p) => p.id)));
  const toggle = (id: string) => {
    onChange((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  if (partners.length === 0) return <div className="text-[12.5px] text-slate-400 py-8 text-center">Aucun partenaire.</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3 py-2 ring-1 cursor-pointer', allSelected ? 'bg-slate-800/5 ring-slate-300 text-slate-900' : 'bg-white ring-slate-200 text-slate-700')}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canWrite} />
          Tous les partenaires
        </label>
        <span className="text-[12px] text-slate-500 tabular-nums">{selected.size} / {partners.length}</span>
      </div>
      <div className="rounded-xl ring-1 ring-slate-100 divide-y divide-slate-50 max-h-[46vh] overflow-y-auto">
        {partners.map((p) => (
          <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50/60 cursor-pointer">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={!canWrite} />
            <span className="text-[13px] text-slate-800 flex-1">{p.name}</span>
            <span className="text-[10.5px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{p.partner_type}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const TabPhotos: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean }> = ({ form, f, canWrite }) => {
  const [newUrl, setNewUrl] = useState('');
  const urls: string[] = Array.isArray(form.photo_urls) ? form.photo_urls : [];
  const add = () => {
    if (!newUrl.trim()) return;
    f('photo_urls', [...urls, newUrl.trim()]);
    setNewUrl('');
  };
  const remove = (idx: number) => f('photo_urls', urls.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-[12px] text-slate-500">{urls.length} photo(s) — Ajoutez des URLs d'images ou téléversez via votre CDN.</p>
      <div className="space-y-2">
        {urls.map((url, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-lg ring-1 ring-slate-200 px-3 py-2">
            <img src={url} alt="" className="w-12 h-8 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-[11.5px] text-slate-600 flex-1 truncate">{url}</span>
            {canWrite && <button onClick={() => remove(idx)} className="p-1 rounded hover:bg-rose-50 text-rose-500"><Trash2 className="w-3 h-3" /></button>}
          </div>
        ))}
      </div>
      {canWrite && (
        <div className="flex gap-2">
          <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…/image.jpg"
            className="flex-1 px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-slate-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button onClick={add} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-[12.5px] font-semibold hover:bg-slate-900 inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      )}
    </div>
  );
};

const TabAudit: React.FC<{ roomId: string | null }> = ({ roomId }) => {
  if (!roomId) return <div className="text-[12.5px] text-slate-400 py-8 text-center">Enregistrez d'abord la chambre.</div>;
  return (
    <div className="text-[12.5px] text-slate-400 py-8 text-center">
      <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
      <div className="font-medium text-slate-700">Historique des modifications</div>
      <div className="mt-1">Les logs d'audit sont disponibles dans Paramètres › Audit.</div>
    </div>
  );
};
