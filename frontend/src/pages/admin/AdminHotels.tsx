import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, MapPin, Search, Plus, Edit2, Trash2, Power,
  CheckCircle2, XCircle, X, Save, AlertTriangle, Mail,
  Phone, Globe, Package, CreditCard, Clock, ArrowUpRight,
  ChevronRight, Star, FileText, Rocket, Layers, UserPlus, Send, Loader2,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hotel {
  id: string; name: string; city: string | null; country: string | null;
  address: string | null; zip: string | null; email: string | null;
  phone: string | null; siret: string | null; tva_number: string | null;
  currency: string | null; timezone: string | null; active: boolean; created_at: string;
  website: string | null; stars: number | null; total_rooms: number | null; description: string | null;
  internal_notes: string | null;
}

interface HotelSub {
  id: string; plan_id: string | null; status: string; billing_cycle: string;
  started_at: string; expires_at: string | null; trial_ends_at: string | null;
  custom_price: number | null; discount_percent: number; notes: string | null;
  plan?: { id: string; name: string; color: string; price_monthly: number; price_annual: number };
}

interface Plan { id: string; name: string; color: string; price_monthly: number; price_annual: number; is_active: boolean; }

interface AddonSub {
  id: string; hotel_id: string; addon_id: string; status: string;
  quantity: number; custom_price: number | null; notes: string | null; started_at: string;
  addon?: { id: string; name: string; slug: string; price: number; billing_type: string };
}
interface AddOnItem { id: string; name: string; slug: string; price: number; billing_type: string; is_active: boolean; }

type FilterStatus = 'all' | 'active' | 'inactive';
type DrawerTab = 'general' | 'contact' | 'subscription' | 'notes';

const EMPTY: Omit<Hotel, 'id' | 'created_at'> = {
  name: '', city: '', country: 'France', address: '', zip: '',
  email: '', phone: '', siret: '', tva_number: '', website: '',
  currency: 'EUR', timezone: 'Europe/Paris', active: true,
  stars: null, total_rooms: null, description: null, internal_notes: null,
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  trial:     { label: 'Essai',      color: 'bg-blue-50 text-blue-600' },
  active:    { label: 'Actif',      color: 'bg-emerald-50 text-emerald-600' },
  past_due:  { label: 'En retard',  color: 'bg-amber-50 text-amber-600' },
  suspended: { label: 'Suspendu',   color: 'bg-red-50 text-red-500' },
  cancelled: { label: 'Annulé',     color: 'bg-gray-100 text-gray-400' },
  expired:   { label: 'Expiré',     color: 'bg-gray-100 text-gray-400' },
};

// ─── Queries ──────────────────────────────────────────────────────────────────

function useHotels() {
  return useQuery<Hotel[]>({
    queryKey: ['admin-hotels-v3'],
    queryFn: async () => {
      const { data, error } = await db.from('hotels')
        .select('id,name,city,country,address,zip,email,phone,siret,tva_number,currency,timezone,active,created_at,website,stars,total_rooms,description,internal_notes')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

function useHotelSub(hotelId: string | null) {
  return useQuery<HotelSub | null>({
    queryKey: ['admin-hotel-sub', hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await db.from('hotel_subscriptions')
        .select('*, plan:subscription_plans(id,name,color,price_monthly,price_annual)')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ['admin-plans-v2'],
    queryFn: async () => {
      const { data } = await db.from('subscription_plans').select('id,name,color,price_monthly,price_annual,is_active').order('sort_order');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useHotelAddons(hotelId: string | null) {
  return useQuery<AddonSub[]>({
    queryKey: ['admin-hotel-addons', hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data: rows, error } = await db
        .from('hotel_addon_subscriptions')
        .select('id, hotel_id, addon_id, status, quantity, custom_price, notes, started_at')
        .eq('hotel_id', hotelId)
        .neq('status', 'cancelled')
        .order('created_at');
      if (error) throw error;
      if (!rows?.length) return [];
      const addonIds = [...new Set(rows.map((r: AddonSub) => r.addon_id))];
      const { data: addonData } = await db
        .from('add_ons').select('id,name,slug,price,billing_type').in('id', addonIds);
      const addonMap: Record<string, AddOnItem> = {};
      (addonData ?? []).forEach((a: AddOnItem) => { addonMap[a.id] = a; });
      return rows.map((r: AddonSub) => ({ ...r, addon: addonMap[r.addon_id] }));
    },
    staleTime: 30_000,
  });
}

function useAddOnsCatalog() {
  return useQuery<AddOnItem[]>({
    queryKey: ['admin-addons-v2'],
    queryFn: async () => {
      const { data } = await db.from('add_ons').select('id,name,slug,price,billing_type,is_active').eq('is_active', true).order('sort_order');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

interface PlatformApp { id: string; code: string; name: string; description: string | null; color: string | null; is_available: boolean; }

function usePlatformApps() {
  return useQuery<PlatformApp[]>({
    queryKey: ['platform-apps'],
    queryFn: async () => {
      const { data, error } = await db.from('platform_apps')
        .select('id,code,name,description,color,is_available').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AdminHotels: React.FC = () => {
  const qc = useQueryClient();
  const { data: hotels = [], isLoading } = useHotels();
  const [search, setSearch]           = useState('');
  const [status, setStatus]           = useState<FilterStatus>('all');
  const [drawerHotel, setDrawerHotel] = useState<Hotel | null>(null);
  const [drawerTab, setDrawerTab]     = useState<DrawerTab>('general');
  const [editMode, setEditMode]       = useState(false);
  const [form, setForm]               = useState<Omit<Hotel, 'id' | 'created_at'>>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Hotel | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const filtered = hotels.filter(h => {
    const q = search.toLowerCase();
    const m = !q || h.name.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q) || h.email?.toLowerCase().includes(q);
    const s = status === 'all' || (status === 'active' && h.active) || (status === 'inactive' && !h.active);
    return m && s;
  });

  const upsertMut = useMutation({
    mutationFn: async (payload: { id?: string } & Omit<Hotel, 'id' | 'created_at'>) => {
      const { id, ...rest } = payload;
      if (id) { const { error } = await db.from('hotels').update(rest).eq('id', id); if (error) throw error; }
      else    { const { error } = await db.from('hotels').insert(rest); if (error) throw error; }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels-v3'] });
      qc.invalidateQueries({ queryKey: ['admin-dash-v2'] });
      toast.success('Hôtel enregistré.');
      setDrawerHotel(null); setShowNew(false); setEditMode(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from('hotels').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-hotels-v3'] }); qc.invalidateQueries({ queryKey: ['admin-dash-v2'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('hotels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels-v3'] }); qc.invalidateQueries({ queryKey: ['admin-dash-v2'] });
      toast.success('Hôtel supprimé.'); setDeleteTarget(null); setDeleteConfirm('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openView = (h: Hotel, tab: DrawerTab = 'general') => {
    setDrawerHotel(h); setEditMode(false); setDrawerTab(tab);
  };

  const openEdit = (h: Hotel) => {
    setForm({ name: h.name, city: h.city ?? '', country: h.country ?? 'France', address: h.address ?? '', zip: h.zip ?? '', email: h.email ?? '', phone: h.phone ?? '', siret: h.siret ?? '', tva_number: h.tva_number ?? '', currency: h.currency ?? 'EUR', timezone: h.timezone ?? 'Europe/Paris', active: h.active, website: h.website ?? '', stars: h.stars, total_rooms: h.total_rooms, description: h.description, internal_notes: h.internal_notes });
    setDrawerHotel(h); setEditMode(true); setDrawerTab('general');
  };

  const openNew = () => { setForm(EMPTY); setShowNew(true); };

  const saveForm = () => {
    if (!form.name.trim()) { toast.error('Le nom est requis.'); return; }
    if (editMode && drawerHotel) upsertMut.mutate({ id: drawerHotel.id, ...form });
    else upsertMut.mutate(form);
  };

  const activeCount   = hotels.filter(h => h.active).length;
  const inactiveCount = hotels.filter(h => !h.active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Hôtels</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {hotels.length} établissement{hotels.length !== 1 ? 's' : ''} · <span className="text-emerald-600 font-semibold">{activeCount} actifs</span>
            {inactiveCount > 0 && <span className="text-gray-400"> · {inactiveCount} inactifs</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/30">
            <Rocket size={15} /> Onboarding hôtel
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[13px] font-bold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/30">
            <Plus size={15} /> Ajouter un hôtel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, ville, email…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
        </div>
        {(['all','active','inactive'] as FilterStatus[]).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={cn('px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors border',
              status === s ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50')}>
            {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : 'Inactifs'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Établissement</th>
              <th className="px-4 py-3">Localisation</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Config</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Aucun hôtel trouvé.</td></tr>
            ) : filtered.map(h => (
              <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3.5">
                  <button onClick={() => openView(h)} className="flex items-center gap-2.5 hover:opacity-80 text-left">
                    <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                      <Building2 size={15} className="text-[#8B5CF6]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900 flex items-center gap-1">
                        {h.name}
                        {h.stars && <span className="flex items-center gap-0.5 text-amber-400 text-[10px]">
                          {Array.from({ length: h.stars }).map((_, i) => <Star key={i} size={9} fill="currentColor" />)}
                        </span>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{h.id.slice(0, 8)}…</div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                    <MapPin size={11} className="text-gray-300" />
                    {[h.city, h.country].filter(Boolean).join(', ') || '—'}
                  </div>
                  {h.total_rooms && <div className="text-[11px] text-gray-400 ml-4">{h.total_rooms} chambres</div>}
                </td>
                <td className="px-4 py-3.5 text-[12px] text-gray-500">
                  {h.email && <div className="flex items-center gap-1"><Mail size={11} className="text-gray-300" />{h.email}</div>}
                  {h.phone && <div className="flex items-center gap-1 text-gray-400"><Phone size={11} className="text-gray-300" />{h.phone}</div>}
                  {!h.email && !h.phone && '—'}
                </td>
                <td className="px-4 py-3.5 text-[11px] text-gray-500">
                  <div className="font-mono">{h.currency ?? '—'}</div>
                  <div className="text-gray-400">{h.timezone?.replace('Europe/', '') ?? '—'}</div>
                </td>
                <td className="px-4 py-3.5 text-center">
                  {h.active
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> Actif</span>
                    : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"><XCircle size={10} /> Inactif</span>}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openView(h, 'subscription')} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50" title="Abonnement"><Package size={13} /></button>
                    <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10" title="Modifier"><Edit2 size={13} /></button>
                    <button onClick={() => toggleMut.mutate({ id: h.id, active: !h.active })} className={cn('p-1.5 rounded-lg', h.active ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50')} title={h.active ? 'Suspendre' : 'Réactiver'}><Power size={13} /></button>
                    <button onClick={() => setDeleteTarget(h)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" title="Supprimer"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer: view/edit */}
      {drawerHotel && !showNew && (
        <HotelDrawer
          hotel={drawerHotel} tab={drawerTab} editMode={editMode} form={form}
          saving={upsertMut.isPending}
          onTabChange={setDrawerTab}
          onEdit={() => openEdit(drawerHotel)}
          onChange={setForm}
          onSave={saveForm}
          onClose={() => { setDrawerHotel(null); setEditMode(false); }}
          onCancelEdit={() => { setEditMode(false); }}
        />
      )}

      {/* Drawer: new hotel */}
      {showNew && (
        <Drawer onClose={() => setShowNew(false)}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-gray-900">Nouvel hôtel</h2>
            <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
          </div>
          <HotelForm form={form} onChange={setForm} onSave={saveForm} onCancel={() => setShowNew(false)} saving={upsertMut.isPending} />
        </Drawer>
      )}

      {/* Onboarding wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onClose={() => setShowOnboarding(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['admin-hotels-v3'] });
            qc.invalidateQueries({ queryKey: ['admin-dash-v3'] });
            setShowOnboarding(false);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal onClose={() => { setDeleteTarget(null); setDeleteConfirm(''); }}>
          <div className="text-center p-2">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">Supprimer l'hôtel ?</h3>
            <p className="text-[13px] text-gray-500 mb-4">Cette action est <strong>irréversible</strong>. Toutes les données seront supprimées.</p>
            <div className="flex items-center gap-2 mb-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <p className="text-[12px] text-amber-700">Tapez <strong>{deleteTarget.name}</strong> pour confirmer :</p>
            </div>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={deleteTarget.name}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[13px] mb-4 outline-none focus:ring-2 focus:ring-red-300" />
            <div className="flex gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); }} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
              <button disabled={deleteConfirm !== deleteTarget.name || deleteMut.isPending} onClick={() => deleteMut.mutate(deleteTarget.id)}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[13px] font-bold disabled:opacity-40 hover:bg-red-600">
                {deleteMut.isPending ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Onboarding wizard (créer hôtel + apps + premier contact) ─────────────────

const ONB_ROLES = [
  { id: 'hotel_admin', label: 'Admin Hôtel', desc: 'Accès à toutes les applications souscrites' },
  { id: 'pms_manager', label: 'Manager PMS', desc: 'Accès Flowtym PMS uniquement' },
  { id: 'rh_manager',  label: 'Manager RH',  desc: 'Accès Flowtym RH uniquement' },
];

const OnboardingWizard: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const { data: apps = [] } = usePlatformApps();
  const available = apps.filter(a => a.is_available);
  const [hotel, setHotel] = useState({ name: '', company: '', siret: '', address: '', city: '', country: 'France', email: '', phone: '', notes: '' });
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [contact, setContact] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'hotel_admin' });
  const setH = (k: string, v: string) => setHotel(f => ({ ...f, [k]: v }));
  const setC = (k: string, v: string) => setContact(f => ({ ...f, [k]: v }));
  const toggleApp = (code: string) =>
    setSelectedApps(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code]);

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('invite-hotel-primary-contact', {
        body: { hotel, apps: selectedApps, contact },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: { apps_activated?: string[]; already_existed?: boolean }) => {
      const list = (data?.apps_activated ?? []).join(' + ');
      toast.success(
        data?.already_existed
          ? `Accès mis à jour — ${contact.email} (${list}).`
          : `Hôtel créé · invitation envoyée à ${contact.email} (${list}).`,
        { duration: 6000 },
      );
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handle = () => {
    if (!hotel.name.trim())        { toast.error("Le nom de l'hôtel est requis."); return; }
    if (selectedApps.length === 0) { toast.error('Sélectionnez au moins une application.'); return; }
    if (!contact.email.trim())     { toast.error("L'email du contact est requis."); return; }
    submit.mutate();
  };

  return (
    <Drawer onClose={onClose}>
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Rocket size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">Onboarding hôtel</h2>
            <p className="text-[11px] text-gray-400">Créer l'hôtel, activer les apps, inviter le 1er contact</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
      </div>

      <div className="space-y-5">
        {/* 1. Hôtel */}
        <div>
          <div className="flex items-center gap-2 mb-3"><Building2 size={13} className="text-[#8B5CF6]" /><span className="text-[11px] font-black uppercase tracking-widest text-gray-500">1 · Hôtel</span></div>
          <div className="space-y-3">
            <FRow label="Nom commercial *"><FInp value={hotel.name} onChange={v => setH('name', v)} placeholder="Hôtel de la Paix" /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Société"><FInp value={hotel.company} onChange={v => setH('company', v)} placeholder="SARL Exploitation" /></FRow>
              <FRow label="SIRET"><FInp value={hotel.siret} onChange={v => setH('siret', v)} /></FRow>
            </div>
            <FRow label="Adresse"><FInp value={hotel.address} onChange={v => setH('address', v)} /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Ville"><FInp value={hotel.city} onChange={v => setH('city', v)} /></FRow>
              <FRow label="Pays"><FInp value={hotel.country} onChange={v => setH('country', v)} /></FRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Email principal"><FInp value={hotel.email} onChange={v => setH('email', v)} placeholder="contact@hotel.fr" /></FRow>
              <FRow label="Téléphone"><FInp value={hotel.phone} onChange={v => setH('phone', v)} placeholder="+33…" /></FRow>
            </div>
          </div>
        </div>

        {/* 2. Applications */}
        <div>
          <div className="flex items-center gap-2 mb-3"><Layers size={13} className="text-[#8B5CF6]" /><span className="text-[11px] font-black uppercase tracking-widest text-gray-500">2 · Applications à activer *</span></div>
          <div className="space-y-2">
            {available.map(a => {
              const on = selectedApps.includes(a.code);
              return (
                <button key={a.id} type="button" onClick={() => toggleApp(a.code)}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                    on ? 'border-emerald-500 bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300')}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: (a.color ?? '#8B5CF6') + '1A', color: a.color ?? '#8B5CF6' }}>
                    <Package size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[12px] font-black text-gray-900">{a.name}</div>
                    <div className="text-[10px] text-gray-400">{a.description}</div>
                  </div>
                  <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center', on ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300')}>
                    {on && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                </button>
              );
            })}
            {available.length === 0 && <p className="text-[12px] text-gray-400 py-2">Aucune application disponible.</p>}
          </div>
        </div>

        {/* 3. Premier contact */}
        <div>
          <div className="flex items-center gap-2 mb-3"><UserPlus size={13} className="text-[#8B5CF6]" /><span className="text-[11px] font-black uppercase tracking-widest text-gray-500">3 · Premier contact</span></div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Prénom"><FInp value={contact.first_name} onChange={v => setC('first_name', v)} /></FRow>
              <FRow label="Nom"><FInp value={contact.last_name} onChange={v => setC('last_name', v)} /></FRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Email *"><FInp value={contact.email} onChange={v => setC('email', v)} placeholder="manager@hotel.fr" /></FRow>
              <FRow label="Téléphone"><FInp value={contact.phone} onChange={v => setC('phone', v)} /></FRow>
            </div>
            <FRow label="Rôle initial">
              <div className="space-y-2">
                {ONB_ROLES.map(r => {
                  const on = contact.role === r.id;
                  return (
                    <button key={r.id} type="button" onClick={() => setC('role', r.id)}
                      className={cn('w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-colors',
                        on ? 'border-[#8B5CF6] bg-[#8B5CF6]/5' : 'border-gray-200 hover:border-gray-300')}>
                      <div className="flex-1">
                        <div className="text-[12px] font-bold text-gray-900">{r.label}</div>
                        <div className="text-[10px] text-gray-400">{r.desc}</div>
                      </div>
                      {on && <div className="w-4 h-4 rounded-full bg-[#8B5CF6] flex items-center justify-center"><CheckCircle2 size={11} className="text-white" /></div>}
                    </button>
                  );
                })}
              </div>
            </FRow>
          </div>
        </div>

        {/* Récap + action */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-500 flex items-start gap-2">
          <Send size={13} className="text-gray-400 shrink-0 mt-0.5" />
          <span>Un email d'invitation sera envoyé au contact pour créer son mot de passe et accéder à {selectedApps.length ? selectedApps.join(' + ') : '…'}. Les apps non souscrites resteront inaccessibles.</span>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={handle} disabled={submit.isPending}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-emerald-700">
            {submit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            {submit.isPending ? 'Création…' : 'Créer & inviter'}
          </button>
        </div>
      </div>
    </Drawer>
  );
};

// ─── Hotel Drawer with tabs ───────────────────────────────────────────────────

const DRAWER_TABS: { id: DrawerTab; label: string; icon: React.ElementType }[] = [
  { id: 'general',      label: 'Général',      icon: Building2 },
  { id: 'contact',      label: 'Contact',      icon: Phone },
  { id: 'subscription', label: 'Abonnement',   icon: Package },
  { id: 'notes',        label: 'Notes',        icon: FileText },
];

const HotelDrawer: React.FC<{
  hotel: Hotel; tab: DrawerTab; editMode: boolean;
  form: Omit<Hotel, 'id' | 'created_at'>; saving: boolean;
  onTabChange: (t: DrawerTab) => void;
  onEdit: () => void; onChange: (f: Omit<Hotel, 'id' | 'created_at'>) => void;
  onSave: () => void; onClose: () => void; onCancelEdit: () => void;
}> = ({ hotel, tab, editMode, form, saving, onTabChange, onEdit, onChange, onSave, onClose, onCancelEdit }) => (
  <Drawer onClose={onClose}>
    {/* Header */}
    <div className="flex items-start justify-between mb-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
          <Building2 size={18} className="text-[#8B5CF6]" />
        </div>
        <div>
          <h2 className="text-base font-black text-gray-900">{hotel.name}</h2>
          <p className="text-[11px] text-gray-400 font-mono">{hotel.id}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!editMode && tab !== 'subscription' && (
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] text-[12px] font-bold hover:bg-[#8B5CF6]/20">
            <Edit2 size={12} /> Modifier
          </button>
        )}
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
      </div>
    </div>

    {/* Tab nav */}
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl mb-5 shrink-0">
      {DRAWER_TABS.map(t => (
        <button key={t.id} onClick={() => { onTabChange(t.id); if (editMode && t.id !== 'general') onCancelEdit(); }}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex-1 justify-center',
            tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
          <t.icon size={11} />{t.label}
        </button>
      ))}
    </div>

    {/* Tab content */}
    {tab === 'general' && (
      editMode ? (
        <HotelForm form={form} onChange={onChange} onSave={onSave} onCancel={onCancelEdit} saving={saving} />
      ) : (
        <HotelGeneralView hotel={hotel} />
      )
    )}
    {tab === 'contact'      && <HotelContactView hotel={hotel} />}
    {tab === 'subscription' && <HotelSubscriptionTab hotelId={hotel.id} hotelName={hotel.name} />}
    {tab === 'notes'        && <HotelNotesView hotel={hotel} />}
  </Drawer>
);

// ─── Tab content components ───────────────────────────────────────────────────

const HotelGeneralView: React.FC<{ hotel: Hotel }> = ({ hotel }) => (
  <div className="space-y-4">
    <Section title="Établissement">
      <Field label="Nom"        value={hotel.name} />
      <Field label="Étoiles"    value={hotel.stars ? `${hotel.stars} ★` : '—'} />
      <Field label="Chambres"   value={hotel.total_rooms ? String(hotel.total_rooms) : '—'} />
      <Field label="Statut"     value={hotel.active ? 'Actif' : 'Inactif'} />
      <Field label="Créé le"    value={new Date(hotel.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })} />
    </Section>
    <Section title="Localisation">
      <Field label="Adresse" value={[hotel.address, hotel.zip, hotel.city].filter(Boolean).join(', ')} />
      <Field label="Pays"    value={hotel.country} />
    </Section>
    <Section title="Configuration">
      <Field label="Devise"   value={hotel.currency} />
      <Field label="Fuseau"   value={hotel.timezone} />
      <Field label="SIRET"    value={hotel.siret} />
      <Field label="N° TVA"   value={hotel.tva_number} />
    </Section>
    {hotel.description && (
      <Section title="Description">
        <p className="text-[12px] text-gray-600 leading-relaxed">{hotel.description}</p>
      </Section>
    )}
  </div>
);

const HotelContactView: React.FC<{ hotel: Hotel }> = ({ hotel }) => (
  <div className="space-y-4">
    <Section title="Coordonnées">
      <Field label="Email" value={hotel.email} icon={<Mail size={12} className="text-gray-300" />} />
      <Field label="Tél."  value={hotel.phone} icon={<Phone size={12} className="text-gray-300" />} />
      <Field label="Site"  value={hotel.website} icon={<Globe size={12} className="text-gray-300" />} />
    </Section>
    <Section title="Facturation">
      <Field label="SIRET"  value={hotel.siret} />
      <Field label="N° TVA" value={hotel.tva_number} />
      <Field label="Devise" value={hotel.currency} />
    </Section>
  </div>
);

const HotelNotesView: React.FC<{ hotel: Hotel }> = ({ hotel }) => {
  const qc = useQueryClient();
  const [text, setText] = useState(hotel.internal_notes ?? '');
  const [dirty, setDirty] = useState(false);

  const saveMut = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await db.from('hotels').update({ internal_notes: notes || null }).eq('id', hotel.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels-v3'] });
      toast.success('Notes enregistrées.'); setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleChange = (v: string) => { setText(v); setDirty(v !== (hotel.internal_notes ?? '')); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notes internes</p>
        {dirty && (
          <button
            onClick={() => saveMut.mutate(text)}
            disabled={saveMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B5CF6] text-white rounded-xl text-[11px] font-bold hover:bg-[#7C3AED] disabled:opacity-60">
            <Save size={11} />{saveMut.isPending ? '…' : 'Enregistrer'}
          </button>
        )}
      </div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={12}
        placeholder="Historique des échanges, conditions particulières, contacts clés, observations commerciales…"
        className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-[12px] text-gray-800 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] resize-none leading-relaxed placeholder:text-gray-300"
      />
      {hotel.internal_notes && (
        <p className="text-[10px] text-gray-300">
          Dernière modification · {new Date(hotel.created_at).toLocaleDateString('fr-FR')}
        </p>
      )}
    </div>
  );
};

const HotelSubscriptionTab: React.FC<{ hotelId: string; hotelName: string }> = ({ hotelId, hotelName }) => {
  const qc = useQueryClient();
  const { data: sub, isLoading } = useHotelSub(hotelId);
  const { data: plans = [] }     = usePlans();
  const [assigning, setAssigning] = useState(false);
  const [form, setForm] = useState({ plan_id: '', status: 'trial', billing_cycle: 'monthly', custom_price: '', discount_percent: '0', trial_ends_at: '', expires_at: '', notes: '' });
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const assign = useMutation({
    mutationFn: async () => {
      const body = {
        hotel_id: hotelId,
        plan_id: form.plan_id || null,
        status: form.status,
        billing_cycle: form.billing_cycle,
        custom_price: form.custom_price ? Number(form.custom_price) : null,
        discount_percent: Number(form.discount_percent),
        notes: form.notes || null,
        trial_ends_at: form.trial_ends_at || null,
        expires_at: form.expires_at || null,
      };
      const { error } = await db.from('hotel_subscriptions').insert(body);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotel-sub', hotelId] });
      qc.invalidateQueries({ queryKey: ['admin-hotel-subs'] });
      qc.invalidateQueries({ queryKey: ['admin-dash-v2'] });
      toast.success(`Abonnement assigné à ${hotelName}.`);
      setAssigning(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      if (!sub) return;
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();
      if (status === 'active') updates.started_at = new Date().toISOString();
      const { error } = await db.from('hotel_subscriptions').update(updates).eq('id', sub.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-hotel-sub', hotelId] }); qc.invalidateQueries({ queryKey: ['admin-hotel-subs'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-center py-8 text-sm text-gray-400">Chargement…</div>;

  if (assigning) {
    const selectedPlan = plans.find(p => p.id === form.plan_id);
    const basePrice = form.billing_cycle === 'annual' ? selectedPlan?.price_annual : selectedPlan?.price_monthly;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[13px] font-black text-gray-800">Assigner un abonnement</h3>
          <button onClick={() => setAssigning(false)} className="text-[11px] text-gray-400 hover:text-gray-600 underline">Annuler</button>
        </div>
        <FRow label="Forfait">
          <select value={form.plan_id} onChange={e => s('plan_id', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
            <option value="">Sans forfait assigné</option>
            {plans.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} — {p.price_monthly > 0 ? `${p.price_monthly} €/mois` : 'Sur devis'}</option>)}
          </select>
        </FRow>
        {selectedPlan && basePrice != null && basePrice > 0 && (
          <div className="text-[12px] p-2.5 bg-[#8B5CF6]/5 rounded-xl border border-[#8B5CF6]/15 text-[#8B5CF6] font-semibold">
            Prix catalogue : {basePrice} € / {form.billing_cycle === 'annual' ? 'an' : 'mois'}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FRow label="Statut initial">
            <select value={form.status} onChange={e => s('status', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
              <option value="trial">Essai gratuit</option>
              <option value="active">Actif</option>
            </select>
          </FRow>
          <FRow label="Cycle">
            <select value={form.billing_cycle} onChange={e => s('billing_cycle', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
              <option value="monthly">Mensuel</option>
              <option value="annual">Annuel</option>
            </select>
          </FRow>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FRow label="Prix personnalisé (€)"><FInp value={form.custom_price} onChange={v => s('custom_price', v)} placeholder="Catalogue" /></FRow>
          <FRow label="Remise (%)"><FInp value={form.discount_percent} onChange={v => s('discount_percent', v)} placeholder="0" /></FRow>
        </div>
        {form.status === 'trial' && (
          <FRow label="Fin d'essai"><input type="date" value={form.trial_ends_at} onChange={e => s('trial_ends_at', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></FRow>
        )}
        <FRow label="Notes"><FInp value={form.notes} onChange={v => s('notes', v)} placeholder="Notes internes…" /></FRow>
        <button onClick={() => assign.mutate()} disabled={assign.isPending}
          className="w-full py-2.5 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]">
          <Save size={13} />{assign.isPending ? 'Enregistrement…' : 'Créer l\'abonnement'}
        </button>
      </div>
    );
  }

  if (!sub && !assigning) {
    return (
      <div className="space-y-6">
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Package size={24} className="text-amber-500" />
          </div>
          <h3 className="text-[14px] font-black text-gray-900 mb-1">Sans abonnement</h3>
          <p className="text-[12px] text-gray-400 mb-5">Cet hôtel n'a pas encore d'abonnement actif.</p>
          <button onClick={() => setAssigning(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8B5CF6] text-white rounded-xl text-[13px] font-bold hover:bg-[#7C3AED]">
            <Plus size={14} /> Assigner un abonnement
          </button>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <AddOnsSection hotelId={hotelId} />
        </div>
      </div>
    );
  }

  if (!sub) return null;

  const plan = sub.plan as Plan | undefined;
  const meta = STATUS_META[sub.status] ?? STATUS_META.active;
  const price = sub.custom_price != null ? sub.custom_price : (sub.billing_cycle === 'annual' ? plan?.price_annual : plan?.price_monthly);

  return (
    <div className="space-y-4">
      {/* Plan card */}
      <div className="rounded-2xl border p-4" style={{ borderColor: (plan?.color ?? '#8B5CF6') + '30', backgroundColor: (plan?.color ?? '#8B5CF6') + '08' }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Forfait actuel</p>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black text-gray-900">{plan?.name ?? 'Sans forfait'}</span>
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', meta.color)}>{meta.label}</span>
            </div>
          </div>
          {price != null && price > 0 && (
            <div className="text-right">
              <div className="text-[18px] font-black text-gray-900">{price} €</div>
              <div className="text-[11px] text-gray-400">/{sub.billing_cycle === 'annual' ? 'an' : 'mois'}</div>
              {(sub.discount_percent ?? 0) > 0 && <div className="text-[11px] text-emerald-600 font-bold">-{sub.discount_percent}%</div>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div><span className="text-gray-400">Depuis :</span> <span className="font-semibold text-gray-700">{new Date(sub.started_at).toLocaleDateString('fr-FR')}</span></div>
          {sub.trial_ends_at && sub.status === 'trial' && <div><span className="text-gray-400">Fin essai :</span> <span className="font-semibold text-blue-600">{new Date(sub.trial_ends_at).toLocaleDateString('fr-FR')}</span></div>}
          {sub.expires_at && <div><span className="text-gray-400">Expire :</span> <span className="font-semibold text-gray-700">{new Date(sub.expires_at).toLocaleDateString('fr-FR')}</span></div>}
          <div><span className="text-gray-400">Cycle :</span> <span className="font-semibold text-gray-700 capitalize">{sub.billing_cycle}</span></div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {sub.status === 'trial' && (
            <button onClick={() => changeStatus.mutate({ status: 'active' })} disabled={changeStatus.isPending}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[12px] font-bold hover:bg-emerald-100 disabled:opacity-60">
              <CheckCircle2 size={13} /> Activer
            </button>
          )}
          {sub.status === 'active' && (
            <button onClick={() => changeStatus.mutate({ status: 'suspended' })} disabled={changeStatus.isPending}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-amber-50 text-amber-700 text-[12px] font-bold hover:bg-amber-100 disabled:opacity-60">
              <Power size={13} /> Suspendre
            </button>
          )}
          {sub.status === 'suspended' && (
            <button onClick={() => changeStatus.mutate({ status: 'active' })} disabled={changeStatus.isPending}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[12px] font-bold hover:bg-emerald-100 disabled:opacity-60">
              <ArrowUpRight size={13} /> Réactiver
            </button>
          )}
          {sub.status !== 'cancelled' && (
            <button onClick={() => changeStatus.mutate({ status: 'cancelled' })} disabled={changeStatus.isPending}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-red-50 text-red-600 text-[12px] font-bold hover:bg-red-100 disabled:opacity-60">
              <XCircle size={13} /> Annuler
            </button>
          )}
          <button onClick={() => setAssigning(true)}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] text-[12px] font-bold hover:bg-[#8B5CF6]/20 col-span-2">
            <Package size={13} /> Changer de forfait
          </button>
        </div>
      </div>

      {sub.notes && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Notes internes</p>
          <p className="text-[12px] text-gray-600">{sub.notes}</p>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <AddOnsSection hotelId={hotelId} />
      </div>
    </div>
  );
};

// ─── Add-ons section ──────────────────────────────────────────────────────────

const AddOnsSection: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const qc = useQueryClient();
  const { data: addons = [] } = useHotelAddons(hotelId);
  const { data: catalog = [] } = useAddOnsCatalog();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ addon_id: '', quantity: '1', custom_price: '', notes: '' });
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('hotel_addon_subscriptions').insert({
        hotel_id: hotelId, addon_id: form.addon_id,
        quantity: Number(form.quantity) || 1,
        custom_price: form.custom_price ? Number(form.custom_price) : null,
        notes: form.notes || null, status: 'active',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotel-addons', hotelId] });
      toast.success('Add-on ajouté.');
      setAdding(false);
      setForm({ addon_id: '', quantity: '1', custom_price: '', notes: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('hotel_addon_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-hotel-addons', hotelId] }); toast.success('Add-on retiré.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedAddon = catalog.find(a => a.id === form.addon_id);
  const effectivePrice = form.custom_price ? Number(form.custom_price) : selectedAddon?.price;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Add-ons actifs</p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[11px] font-bold text-[#8B5CF6] hover:underline">
            <Plus size={11} /> Ajouter
          </button>
        )}
      </div>

      {addons.length === 0 && !adding && (
        <p className="text-[12px] text-gray-400 text-center py-3 bg-gray-50 rounded-xl">Aucun add-on actif.</p>
      )}

      {addons.map(a => {
        const unit = a.addon?.billing_type === 'once' ? 'unique' : 'mois';
        const unitPrice = a.custom_price ?? a.addon?.price ?? 0;
        const total = unitPrice * a.quantity;
        return (
          <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50">
            <div>
              <div className="text-[12px] font-bold text-gray-800">{a.addon?.name ?? a.addon_id.slice(0, 8)}</div>
              <div className="text-[11px] text-gray-400">
                {a.quantity > 1 ? `×${a.quantity} · ` : ''}{total > 0 ? `${total} €/${unit}` : 'Inclus'}
              </div>
            </div>
            <button onClick={() => removeMut.mutate(a.id)} disabled={removeMut.isPending}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Retirer">
              <X size={12} />
            </button>
          </div>
        );
      })}

      {adding && (
        <div className="p-3 rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-black text-gray-700">Ajouter un add-on</p>
            <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
          </div>
          <FRow label="Add-on">
            <select value={form.addon_id} onChange={e => s('addon_id', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
              <option value="">Choisir un add-on…</option>
              {catalog.map(a => <option key={a.id} value={a.id}>{a.name} — {a.price} €/{a.billing_type === 'once' ? 'unique' : 'mois'}</option>)}
            </select>
          </FRow>
          <div className="grid grid-cols-2 gap-2">
            <FRow label="Quantité"><FInp value={form.quantity} onChange={v => s('quantity', v)} placeholder="1" /></FRow>
            <FRow label="Prix perso. (€)"><FInp value={form.custom_price} onChange={v => s('custom_price', v)} placeholder="Catalogue" /></FRow>
          </div>
          {selectedAddon && effectivePrice != null && (
            <div className="text-[11px] text-[#8B5CF6] font-semibold px-1">
              Total : {effectivePrice * (Number(form.quantity) || 1)} €/{selectedAddon.billing_type === 'once' ? 'unique' : 'mois'}
            </div>
          )}
          <FRow label="Notes"><FInp value={form.notes} onChange={v => s('notes', v)} placeholder="Notes internes…" /></FRow>
          <button
            onClick={() => { if (!form.addon_id) { toast.error('Sélectionnez un add-on.'); return; } addMut.mutate(); }}
            disabled={addMut.isPending}
            className="w-full py-2 rounded-xl bg-[#8B5CF6] text-white text-[12px] font-bold disabled:opacity-60 flex items-center justify-center gap-1.5 hover:bg-[#7C3AED]">
            <Plus size={12} />{addMut.isPending ? 'Ajout…' : "Ajouter l'add-on"}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Hotel Form ────────────────────────────────────────────────────────────────

const HotelForm: React.FC<{
  form: Omit<Hotel, 'id' | 'created_at'>; onChange: (f: Omit<Hotel, 'id' | 'created_at'>) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}> = ({ form, onChange, onSave, onCancel, saving }) => {
  const set = (k: keyof typeof form, v: string | boolean | number | null) => onChange({ ...form, [k]: v });
  return (
    <div className="space-y-4">
      <FRow label="Nom de l'établissement *">
        <FInp value={form.name} onChange={v => set('name', v)} placeholder="Hôtel de la Paix" />
      </FRow>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Étoiles"><FInp value={String(form.stars ?? '')} onChange={v => set('stars', v ? Number(v) : null)} placeholder="3" /></FRow>
        <FRow label="Nbre de chambres"><FInp value={String(form.total_rooms ?? '')} onChange={v => set('total_rooms', v ? Number(v) : null)} placeholder="50" /></FRow>
      </div>
      <FRow label="Description">
        <textarea value={form.description ?? ''} rows={2} onChange={e => set('description', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none" />
      </FRow>

      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 pt-1">Contact</div>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Email"><FInp value={form.email ?? ''} onChange={v => set('email', v)} placeholder="contact@hotel.fr" /></FRow>
        <FRow label="Téléphone"><FInp value={form.phone ?? ''} onChange={v => set('phone', v)} placeholder="+33 1 XX XX XX XX" /></FRow>
      </div>
      <FRow label="Site web"><FInp value={form.website ?? ''} onChange={v => set('website', v)} placeholder="https://hotel.fr" /></FRow>

      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 pt-1">Adresse</div>
      <FRow label="Adresse"><FInp value={form.address ?? ''} onChange={v => set('address', v)} /></FRow>
      <div className="grid grid-cols-3 gap-3">
        <FRow label="CP"><FInp value={form.zip ?? ''} onChange={v => set('zip', v)} placeholder="75001" /></FRow>
        <FRow label="Ville"><FInp value={form.city ?? ''} onChange={v => set('city', v)} /></FRow>
        <FRow label="Pays"><FInp value={form.country ?? ''} onChange={v => set('country', v)} /></FRow>
      </div>

      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 pt-1">Configuration</div>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Devise"><FInp value={form.currency ?? ''} onChange={v => set('currency', v)} placeholder="EUR" /></FRow>
        <FRow label="Fuseau horaire"><FInp value={form.timezone ?? ''} onChange={v => set('timezone', v)} placeholder="Europe/Paris" /></FRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="SIRET"><FInp value={form.siret ?? ''} onChange={v => set('siret', v)} /></FRow>
        <FRow label="N° TVA"><FInp value={form.tva_number ?? ''} onChange={v => set('tva_number', v)} /></FRow>
      </div>
      <FRow label="Statut">
        <select value={form.active ? 'active' : 'inactive'} onChange={e => set('active', e.target.value === 'active')}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
          <option value="active">Actif</option><option value="inactive">Inactif</option>
        </select>
      </FRow>
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]">
          <Save size={13} />{saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{title}</p>
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; value?: string | null; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center gap-2">
    {icon}
    <span className="text-[11px] text-gray-400 w-20 shrink-0">{label}</span>
    <span className="font-semibold text-[12px] text-gray-800">{value || '—'}</span>
  </div>
);

const FRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><label className="block text-[11px] font-bold text-gray-500 mb-1">{label}</label>{children}</div>
);

const FInp: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]" />
);

const Drawer: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
    <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-white shadow-2xl z-50 flex flex-col overflow-y-auto p-6">
      {children}
    </div>
  </>
);

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-[420px] p-6">
      {children}
    </div>
  </>
);
