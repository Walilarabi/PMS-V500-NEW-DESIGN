import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, Edit2, Power, X, Save, Tag, Percent,
  ChevronDown, CheckCircle2, Star, Zap, Shield, Building2,
  ArrowUpRight, Users, Layers, CreditCard, Search,
  Clock, AlertTriangle, ToggleLeft, ToggleRight, Gift,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type SubTab = 'catalog' | 'assignments' | 'addons' | 'promotions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string; name: string; slug: string; tagline: string | null; description: string | null;
  price_monthly: number; price_annual: number; price_per_room: number; setup_fee: number;
  max_rooms: number | null; max_users: number | null; max_hotels: number | null;
  modules: string[]; features: string[]; support_level: string;
  trial_days: number; is_highlighted: boolean; color: string;
  is_active: boolean; sort_order: number;
}

interface AddOn {
  id: string; name: string; slug: string; description: string | null;
  price: number; billing_type: string; is_active: boolean; sort_order: number;
}

interface HotelSub {
  id: string; hotel_id: string; plan_id: string | null;
  status: string; billing_cycle: string; started_at: string;
  expires_at: string | null; trial_ends_at: string | null;
  custom_price: number | null; notes: string | null;
  discount_percent: number; committed_months: number;
  next_billing_date: string | null; cancelled_at: string | null;
  plan?: Plan; hotel?: { name: string; city: string | null };
}

interface Promo {
  id: string; code: string; description: string | null;
  discount_type: string; discount_value: number;
  max_uses: number | null; uses_count: number;
  starts_at: string | null; expires_at: string | null; is_active: boolean;
}

interface Hotel { id: string; name: string; city: string | null; active: boolean; }

// ─── Queries ──────────────────────────────────────────────────────────────────

function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ['admin-plans-v2'],
    queryFn: async () => {
      const { data, error } = await db.from('subscription_plans').select('*').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useAddOns() {
  return useQuery<AddOn[]>({
    queryKey: ['admin-addons-v2'],
    queryFn: async () => {
      const { data, error } = await db.from('add_ons').select('*').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useHotelSubs() {
  return useQuery<HotelSub[]>({
    queryKey: ['admin-hotel-subs'],
    queryFn: async () => {
      const { data, error } = await db
        .from('hotel_subscriptions')
        .select(`*, plan:subscription_plans(id,name,slug,color,price_monthly), hotel:hotels(name,city)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

function useHotels() {
  return useQuery<Hotel[]>({
    queryKey: ['admin-hotel-list-sub'],
    queryFn: async () => {
      const { data } = await db.from('hotels').select('id,name,city,active').order('name');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function usePromos() {
  return useQuery<Promo[]>({
    queryKey: ['admin-promos-v2'],
    queryFn: async () => {
      const { data, error } = await db.from('promotions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPORT_LABELS: Record<string, string> = { email: 'Email', priority: 'Email + Chat', phone: 'Téléphone', csm: 'CSM dédié' };
const STATUS_META: Record<string, { label: string; color: string }> = {
  trial:     { label: 'Essai',      color: 'bg-blue-50 text-blue-600' },
  active:    { label: 'Actif',      color: 'bg-emerald-50 text-emerald-600' },
  past_due:  { label: 'En retard',  color: 'bg-amber-50 text-amber-600' },
  suspended: { label: 'Suspendu',   color: 'bg-red-50 text-red-500' },
  cancelled: { label: 'Annulé',     color: 'bg-gray-100 text-gray-400' },
  expired:   { label: 'Expiré',     color: 'bg-gray-100 text-gray-400' },
};
const BILLING_TYPES: Record<string, string> = { monthly: 'Mensuel', annual: 'Annuel', once: 'Ponctuel' };

// ─── Main component ───────────────────────────────────────────────────────────

export const AdminSubscriptions: React.FC = () => {
  const [tab, setTab] = useState<SubTab>('catalog');
  const { data: subs = [] } = useHotelSubs();

  const active  = subs.filter(s => s.status === 'active').length;
  const trial   = subs.filter(s => s.status === 'trial').length;
  const pastDue = subs.filter(s => s.status === 'past_due').length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Abonnements</h1>
          <p className="text-sm text-gray-400 mt-0.5">Catalogue, assignations et promotions</p>
        </div>
        <div className="flex items-center gap-2">
          <Stat label="Actifs"      val={active}  color="text-emerald-600 bg-emerald-50" />
          <Stat label="Essai"       val={trial}   color="text-blue-600 bg-blue-50" />
          {pastDue > 0 && <Stat label="En retard" val={pastDue} color="text-amber-600 bg-amber-50" />}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { id: 'catalog',     label: 'Catalogue',    icon: Package },
          { id: 'assignments', label: 'Assignations', icon: Building2 },
          { id: 'addons',      label: 'Add-ons',      icon: Zap },
          { id: 'promotions',  label: 'Promotions',   icon: Gift },
        ] as { id: SubTab; label: string; icon: React.ElementType }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors',
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
            <t.icon size={12} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'catalog'     && <CatalogTab />}
      {tab === 'assignments' && <AssignmentsTab />}
      {tab === 'addons'      && <AddOnsTab />}
      {tab === 'promotions'  && <PromosTab />}
    </div>
  );
};

const Stat: React.FC<{ label: string; val: number; color: string }> = ({ label, val, color }) => (
  <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold', color)}>
    <span className="text-base font-black leading-none">{val}</span>
    <span className="text-[11px]">{label}</span>
  </div>
);

// ─── Catalog Tab ─────────────────────────────────────────────────────────────

const CatalogTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = usePlans();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const EMPTY: Omit<Plan, 'id'> = {
    name: '', slug: '', tagline: '', description: '',
    price_monthly: 0, price_annual: 0, price_per_room: 0, setup_fee: 0,
    max_rooms: null, max_users: null, max_hotels: 1,
    modules: [], features: [], support_level: 'email',
    trial_days: 14, is_highlighted: false, color: '#8B5CF6', is_active: true, sort_order: 0,
  };
  const [form, setForm] = useState<Omit<Plan, 'id'>>(EMPTY);

  const upsert = useMutation({
    mutationFn: async (p: { id?: string } & Omit<Plan, 'id'>) => {
      const { id, ...rest } = p;
      if (id) {
        const { error } = await db.from('subscription_plans').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await db.from('subscription_plans').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans-v2'] }); toast.success('Forfait enregistré.'); setEditing(null); setShowNew(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('subscription_plans').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans-v2'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (p: Plan) => {
    setForm({ ...p });
    setEditing(p);
  };

  const save = () => {
    if (!form.name.trim()) { toast.error('Nom requis.'); return; }
    upsert.mutate(editing ? { id: editing.id, ...form } : form);
  };

  if (isLoading) return <Skeleton />;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{plans.length} forfait{plans.length !== 1 ? 's' : ''} dans le catalogue</p>
        <button onClick={() => { setForm(EMPTY); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED]">
          <Plus size={14} /> Nouveau forfait
        </button>
      </div>

      {/* Visual plan cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(p => <PlanCard key={p.id} plan={p} expanded={expanded === p.id}
          onToggleExpand={() => setExpanded(expanded === p.id ? null : p.id)}
          onEdit={() => openEdit(p)} onToggle={() => toggle.mutate({ id: p.id, is_active: !p.is_active })} />)}
      </div>

      {(showNew || editing) && (
        <Drawer onClose={() => { setEditing(null); setShowNew(false); }} title={editing ? `Modifier — ${editing.name}` : 'Nouveau forfait'}>
          <PlanForm form={form} onChange={setForm} onSave={save} onCancel={() => { setEditing(null); setShowNew(false); }} saving={upsert.isPending} />
        </Drawer>
      )}
    </>
  );
};

const PlanCard: React.FC<{ plan: Plan; expanded: boolean; onToggleExpand: () => void; onEdit: () => void; onToggle: () => void }> = ({
  plan: p, expanded, onToggleExpand, onEdit, onToggle,
}) => (
  <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all', p.is_highlighted ? 'border-[#8B5CF6] ring-1 ring-[#8B5CF6]/20' : 'border-gray-100', !p.is_active && 'opacity-55')}>
    {p.is_highlighted && (
      <div className="bg-[#8B5CF6] text-white text-center text-[10px] font-black uppercase tracking-widest py-1">⭐ Recommandé</div>
    )}
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (p.color ?? '#8B5CF6') + '18' }}>
            <Package size={16} style={{ color: p.color ?? '#8B5CF6' }} />
          </div>
          <div>
            <h3 className="font-black text-[14px] text-gray-900">{p.name}</h3>
            {p.tagline && <p className="text-[11px] text-gray-400 leading-tight">{p.tagline}</p>}
          </div>
        </div>
        {!p.is_active && <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactif</span>}
      </div>

      <div className="mb-4">
        {p.price_monthly > 0 ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-gray-900">{p.price_monthly} €</span>
              <span className="text-[12px] text-gray-400">/mois</span>
            </div>
            {p.price_annual > 0 && (
              <p className="text-[11px] text-emerald-600 font-semibold">{p.price_annual} €/an · économise {Math.round(100 - (p.price_annual / (p.price_monthly * 12)) * 100)}%</p>
            )}
          </>
        ) : (
          <div className="text-xl font-black text-gray-900">Sur devis</div>
        )}
        {p.setup_fee > 0 && <p className="text-[11px] text-gray-400">+ {p.setup_fee} € frais d'installation</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat icon={Building2} label="Chambres" value={p.max_rooms ? String(p.max_rooms) : '∞'} />
        <MiniStat icon={Users}     label="Users"    value={p.max_users  ? String(p.max_users)  : '∞'} />
        <MiniStat icon={Clock}     label="Essai"    value={`${p.trial_days}j`} />
      </div>

      <div className="flex items-center gap-2 mb-4 text-[11px]">
        <Shield size={12} className="text-gray-400" />
        <span className="text-gray-500">{SUPPORT_LABELS[p.support_level] ?? p.support_level}</span>
      </div>

      {/* Features (collapsed) */}
      <button onClick={onToggleExpand} className="w-full flex items-center justify-between text-[11px] text-gray-400 hover:text-gray-600 py-1 border-t border-gray-50">
        <span>{p.features.length} fonctionnalités</span>
        <ChevronDown size={13} className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1.5">
          {p.features.map(f => (
            <li key={f} className="flex items-start gap-1.5 text-[11px] text-gray-600">
              <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>

    <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-50 bg-gray-50/50">
      <button onClick={onEdit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors">
        <Edit2 size={11} /> Modifier
      </button>
      <button onClick={onToggle}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
          p.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50')}>
        <Power size={11} />{p.is_active ? 'Désactiver' : 'Activer'}
      </button>
    </div>
  </div>
);

const MiniStat: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="bg-gray-50 rounded-xl p-2 text-center">
    <Icon size={11} className="text-gray-400 mx-auto mb-0.5" />
    <div className="font-black text-[12px] text-gray-900">{value}</div>
    <div className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</div>
  </div>
);

// ─── Plan Form ────────────────────────────────────────────────────────────────

const PlanForm: React.FC<{
  form: Omit<Plan, 'id'>; onChange: (f: Omit<Plan, 'id'>) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}> = ({ form, onChange, onSave, onCancel, saving }) => {
  const s = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => onChange({ ...form, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Nom *"><FInp value={form.name} onChange={v => s('name', v)} placeholder="Flow Pro" /></FRow>
        <FRow label="Slug *"><FInp value={form.slug} onChange={v => s('slug', v)} placeholder="flow-pro" /></FRow>
      </div>
      <FRow label="Tagline"><FInp value={form.tagline ?? ''} onChange={v => s('tagline', v)} placeholder="Performance revenue et opérations" /></FRow>
      <FRow label="Description">
        <textarea value={form.description ?? ''} rows={2} onChange={e => s('description', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none" />
      </FRow>

      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 pt-2">Tarification</div>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Prix mensuel (€)"><FInp value={String(form.price_monthly)} onChange={v => s('price_monthly', Number(v))} /></FRow>
        <FRow label="Prix annuel (€)"><FInp value={String(form.price_annual)} onChange={v => s('price_annual', Number(v))} /></FRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Frais installation (€)"><FInp value={String(form.setup_fee)} onChange={v => s('setup_fee', Number(v))} /></FRow>
        <FRow label="Essai gratuit (jours)"><FInp value={String(form.trial_days)} onChange={v => s('trial_days', Number(v))} /></FRow>
      </div>

      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 pt-2">Limites</div>
      <div className="grid grid-cols-3 gap-3">
        <FRow label="Max chambres"><FInp value={String(form.max_rooms ?? '')} onChange={v => s('max_rooms', v ? Number(v) : null)} placeholder="∞" /></FRow>
        <FRow label="Max users"><FInp value={String(form.max_users ?? '')} onChange={v => s('max_users', v ? Number(v) : null)} placeholder="∞" /></FRow>
        <FRow label="Max hôtels"><FInp value={String(form.max_hotels ?? '')} onChange={v => s('max_hotels', v ? Number(v) : null)} placeholder="∞" /></FRow>
      </div>

      <FRow label="Support inclus">
        <select value={form.support_level} onChange={e => s('support_level', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
          <option value="email">Email 48h</option>
          <option value="priority">Email + Chat 24h</option>
          <option value="phone">Téléphone prioritaire</option>
          <option value="csm">CSM dédié</option>
        </select>
      </FRow>

      <FRow label="Fonctionnalités (une par ligne)">
        <textarea value={form.features.join('\n')} rows={6} onChange={e => s('features', e.target.value.split('\n'))}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none font-mono" />
      </FRow>

      <div className="grid grid-cols-2 gap-3">
        <FRow label="Couleur"><input type="color" value={form.color ?? '#8B5CF6'} onChange={e => s('color', e.target.value)}
          className="w-full h-9 rounded-xl border border-gray-200 cursor-pointer" /></FRow>
        <FRow label="Ordre d'affichage"><FInp value={String(form.sort_order)} onChange={v => s('sort_order', Number(v))} /></FRow>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_highlighted} onChange={e => s('is_highlighted', e.target.checked)} className="rounded" />
          <span className="text-[12px] font-semibold text-gray-700">Recommandé (badge ⭐)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => s('is_active', e.target.checked)} className="rounded" />
          <span className="text-[12px] font-semibold text-gray-700">Actif</span>
        </label>
      </div>

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

// ─── Assignments Tab ───────────────────────────────────────────────────────────

const AssignmentsTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: subs = [], isLoading } = useHotelSubs();
  const { data: plans = [] }           = usePlans();
  const { data: hotels = [] }          = useHotels();
  const [showNew, setShowNew]          = useState(false);
  const [search, setSearch]            = useState('');
  const [statusF, setStatusF]          = useState('all');
  const [editingSub, setEditingSub]    = useState<HotelSub | null>(null);

  const assignedHotelIds = new Set(subs.map(s => s.hotel_id));
  const unassigned = hotels.filter(h => !assignedHotelIds.has(h.id));

  const EMPTY_FORM = { hotel_id: '', plan_id: '', status: 'trial', billing_cycle: 'monthly', custom_price: '', discount_percent: '0', committed_months: '1', notes: '', trial_ends_at: '', expires_at: '' };
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = subs.filter(s => {
    const q = search.toLowerCase();
    const hotel = s.hotel as { name: string; city: string | null } | undefined;
    const m = !q || hotel?.name?.toLowerCase().includes(q) || s.plan?.name?.toLowerCase().includes(q);
    const f = statusF === 'all' || s.status === statusF;
    return m && f;
  });

  const upsert = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM & { id?: string }) => {
      const { id, ...raw } = payload;
      const body = {
        hotel_id: raw.hotel_id, plan_id: raw.plan_id || null,
        status: raw.status, billing_cycle: raw.billing_cycle,
        custom_price: raw.custom_price ? Number(raw.custom_price) : null,
        discount_percent: Number(raw.discount_percent),
        committed_months: Number(raw.committed_months),
        notes: raw.notes || null,
        trial_ends_at: raw.trial_ends_at || null,
        expires_at: raw.expires_at || null,
        updated_at: new Date().toISOString(),
      };
      if (id) {
        const { error } = await db.from('hotel_subscriptions').update(body).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await db.from('hotel_subscriptions').insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotel-subs'] });
      qc.invalidateQueries({ queryKey: ['admin-dash-v2'] });
      toast.success('Abonnement enregistré.');
      setShowNew(false);
      setEditingSub(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();
      const { error } = await db.from('hotel_subscriptions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-hotel-subs'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (s: HotelSub) => {
    setForm({
      hotel_id: s.hotel_id, plan_id: s.plan_id ?? '',
      status: s.status, billing_cycle: s.billing_cycle,
      custom_price: s.custom_price != null ? String(s.custom_price) : '',
      discount_percent: String(s.discount_percent ?? 0),
      committed_months: String(s.committed_months ?? 1),
      notes: s.notes ?? '',
      trial_ends_at: s.trial_ends_at ? s.trial_ends_at.split('T')[0] : '',
      expires_at: s.expires_at ? s.expires_at.split('T')[0] : '',
    });
    setEditingSub(s);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="relative min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hôtel, forfait…"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
          </div>
          <select value={statusF} onChange={e => setStatusF(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
            <option value="all">Tous statuts</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={() => { setForm({ ...EMPTY_FORM, hotel_id: unassigned[0]?.id ?? '' }); setShowNew(true); }}
          disabled={hotels.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED] disabled:opacity-40">
          <Plus size={14} /> Assigner un abonnement
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Hôtel</th>
              <th className="px-4 py-3">Forfait</th>
              <th className="px-4 py-3">Cycle</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Expiration</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Aucun abonnement trouvé.</td></tr>
            ) : filtered.map(s => {
              const meta = STATUS_META[s.status] ?? STATUS_META.active;
              const plan = s.plan as Plan | undefined;
              const hotel = s.hotel as { name: string; city: string | null } | undefined;
              const price = s.custom_price != null ? s.custom_price : (s.billing_cycle === 'annual' ? plan?.price_annual : plan?.price_monthly);
              return (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                        <Building2 size={12} className="text-[#8B5CF6]" />
                      </div>
                      <div>
                        <div className="font-bold text-[13px] text-gray-900">{hotel?.name ?? '—'}</div>
                        {hotel?.city && <div className="text-[10px] text-gray-400">{hotel.city}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {plan ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: (plan.color ?? '#8B5CF6') + '18', color: plan.color ?? '#8B5CF6' }}>
                        {plan.name}
                      </span>
                    ) : <span className="text-gray-400 text-[12px]">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500 capitalize">{s.billing_cycle}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-gray-900">
                    {price != null ? `${price} €` : '—'}
                    {(s.discount_percent ?? 0) > 0 && <span className="ml-1 text-[10px] font-bold text-emerald-600">-{s.discount_percent}%</span>}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">
                    {s.status === 'trial' && s.trial_ends_at ? `Essai jusqu'au ${new Date(s.trial_ends_at).toLocaleDateString('fr-FR')}` : s.expires_at ? new Date(s.expires_at).toLocaleDateString('fr-FR') : 'Sans limite'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', meta.color)}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10" title="Modifier"><Edit2 size={13} /></button>
                      {s.status === 'trial' && <button onClick={() => changeStatus.mutate({ id: s.id, status: 'active' })} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50" title="Activer"><CheckCircle2 size={13} /></button>}
                      {s.status === 'active' && <button onClick={() => changeStatus.mutate({ id: s.id, status: 'suspended' })} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50" title="Suspendre"><Power size={13} /></button>}
                      {s.status === 'suspended' && <button onClick={() => changeStatus.mutate({ id: s.id, status: 'active' })} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50" title="Réactiver"><ArrowUpRight size={13} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unassigned hotels banner */}
      {unassigned.length > 0 && (
        <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-100 rounded-2xl">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <p className="text-[12px] text-amber-700">
            <strong>{unassigned.length} hôtel{unassigned.length > 1 ? 's' : ''}</strong> sans abonnement :{' '}
            {unassigned.slice(0, 3).map(h => h.name).join(', ')}{unassigned.length > 3 ? `…` : ''}
          </p>
          <button onClick={() => { setForm({ ...EMPTY_FORM, hotel_id: unassigned[0]?.id ?? '' }); setShowNew(true); }}
            className="ml-auto text-[12px] font-bold text-amber-700 underline whitespace-nowrap">Assigner →</button>
        </div>
      )}

      {(showNew || editingSub) && (
        <Drawer onClose={() => { setShowNew(false); setEditingSub(null); setForm(EMPTY_FORM); }}
          title={editingSub ? 'Modifier l\'abonnement' : 'Assigner un abonnement'}>
          <SubForm form={form} onChange={setForm} plans={plans} hotels={hotels}
            isEdit={!!editingSub} saving={upsert.isPending}
            onSave={() => upsert.mutate(editingSub ? { id: editingSub.id, ...form } : form)}
            onCancel={() => { setShowNew(false); setEditingSub(null); setForm(EMPTY_FORM); }} />
        </Drawer>
      )}
    </>
  );
};

const SubForm: React.FC<{
  form: Record<string, string>; onChange: (f: Record<string, string>) => void;
  plans: Plan[]; hotels: Hotel[]; isEdit: boolean; saving: boolean;
  onSave: () => void; onCancel: () => void;
}> = ({ form, onChange, plans, hotels, isEdit, saving, onSave, onCancel }) => {
  const s = (k: string, v: string) => onChange({ ...form, [k]: v });
  const selectedPlan = plans.find(p => p.id === form.plan_id);
  const basePrice = form.billing_cycle === 'annual' ? selectedPlan?.price_annual : selectedPlan?.price_monthly;
  const discountedPrice = basePrice ? Math.round(basePrice * (1 - Number(form.discount_percent) / 100)) : null;

  return (
    <div className="space-y-4">
      {!isEdit && (
        <FRow label="Hôtel *">
          <select value={form.hotel_id} onChange={e => s('hotel_id', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
            <option value="">Sélectionner un hôtel</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}{h.city ? ` — ${h.city}` : ''}</option>)}
          </select>
        </FRow>
      )}

      <FRow label="Forfait">
        <select value={form.plan_id} onChange={e => s('plan_id', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
          <option value="">Sans forfait</option>
          {plans.filter(p => p.is_active).map(p => (
            <option key={p.id} value={p.id}>{p.name} — {p.price_monthly > 0 ? `${p.price_monthly} €/mois` : 'Sur devis'}</option>
          ))}
        </select>
      </FRow>

      {selectedPlan && basePrice != null && basePrice > 0 && (
        <div className="flex items-center gap-2 p-3 bg-[#8B5CF6]/5 rounded-xl border border-[#8B5CF6]/20 text-[12px]">
          <Layers size={13} className="text-[#8B5CF6]" />
          <span className="text-gray-600">Prix catalogue : <strong>{basePrice} €</strong></span>
          {Number(form.discount_percent) > 0 && <span className="text-emerald-600 font-bold">→ {discountedPrice} € (-{form.discount_percent}%)</span>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FRow label="Statut">
          <select value={form.status} onChange={e => s('status', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </FRow>
        <FRow label="Cycle de facturation">
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

      <div className="grid grid-cols-2 gap-3">
        <FRow label="Fin d'essai"><input type="date" value={form.trial_ends_at} onChange={e => s('trial_ends_at', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></FRow>
        <FRow label="Expiration"><input type="date" value={form.expires_at} onChange={e => s('expires_at', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></FRow>
      </div>

      <FRow label="Notes internes">
        <textarea value={form.notes} rows={2} onChange={e => s('notes', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none" />
      </FRow>

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
        <button onClick={onSave} disabled={saving || (!form.hotel_id && !isEdit)}
          className="flex-1 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]">
          <Save size={13} />{saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

// ─── Add-ons Tab ───────────────────────────────────────────────────────────────

const AddOnsTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: addons = [], isLoading } = useAddOns();
  const [editing, setEditing] = useState<AddOn | null>(null);
  const [showNew, setShowNew] = useState(false);
  const EMPTY: Omit<AddOn, 'id'> = { name: '', slug: '', description: '', price: 0, billing_type: 'monthly', is_active: true, sort_order: 0 };
  const [form, setForm] = useState<Omit<AddOn, 'id'>>(EMPTY);

  const upsert = useMutation({
    mutationFn: async (p: { id?: string } & Omit<AddOn, 'id'>) => {
      const { id, ...rest } = p;
      if (id) { const { error } = await db.from('add_ons').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
      else    { const { error } = await db.from('add_ons').insert(rest); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-addons-v2'] }); toast.success('Add-on enregistré.'); setEditing(null); setShowNew(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('add_ons').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-addons-v2'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = () => { if (!form.name.trim()) { toast.error('Nom requis.'); return; } upsert.mutate(editing ? { id: editing.id, ...form } : form); };
  const openEdit = (a: AddOn) => { setForm({ name: a.name, slug: a.slug, description: a.description ?? '', price: a.price, billing_type: a.billing_type, is_active: a.is_active, sort_order: a.sort_order }); setEditing(a); };

  const CATEGORIES: { label: string; slugs: string[] }[] = [
    { label: 'Utilisateurs & Sites', slugs: ['extra-user', 'extra-hotel'] },
    { label: 'Revenue & Distribution', slugs: ['channel-manager', 'booking-engine', 'ai-pricing', 'competitive-watch'] },
    { label: 'Data & Intégrations', slugs: ['bi-analytics', 'api-access'] },
    { label: 'Support & Formation', slugs: ['csm-support', 'extra-training'] },
    { label: 'Onboarding & Conseil', slugs: ['onboarding-standard', 'onboarding-premium', 'onboarding-enterprise', 'rm-audit', 'pms-migration'] },
  ];

  const addonsBySlug: Record<string, AddOn> = {};
  addons.forEach(a => { addonsBySlug[a.slug] = a; });

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{addons.length} add-on{addons.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setForm(EMPTY); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED]">
          <Plus size={14} /> Nouvel add-on
        </button>
      </div>

      {isLoading ? <Skeleton /> : (
        <div className="space-y-4">
          {CATEGORIES.map(cat => {
            const catAddons = cat.slugs.map(s => addonsBySlug[s]).filter(Boolean);
            const extras = addons.filter(a => !CATEGORIES.flatMap(c => c.slugs).includes(a.slug));
            const items = cat.label === CATEGORIES[CATEGORIES.length - 1].label ? [...catAddons, ...extras] : catAddons;
            if (items.length === 0) return null;
            return (
              <div key={cat.label} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{cat.label}</p>
                </div>
                <table className="w-full text-left">
                  <tbody className="divide-y divide-gray-50">
                    {items.map(a => (
                      <tr key={a.id} className={cn('hover:bg-gray-50/60', !a.is_active && 'opacity-50')}>
                        <td className="px-4 py-3.5 w-1/2">
                          <div className="font-bold text-[13px] text-gray-900">{a.name}</div>
                          {a.description && <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{a.description}</div>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-black text-[14px] text-gray-900">{a.price > 0 ? `${a.price} €` : 'Gratuit'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[11px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{BILLING_TYPES[a.billing_type] ?? a.billing_type}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {a.is_active ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Actif</span>
                            : <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactif</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10"><Edit2 size={13} /></button>
                            <button onClick={() => toggle.mutate({ id: a.id, is_active: !a.is_active })} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50">
                              {a.is_active ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {(showNew || editing) && (
        <Drawer onClose={() => { setEditing(null); setShowNew(false); }} title={editing ? 'Modifier l\'add-on' : 'Nouvel add-on'}>
          <div className="space-y-3">
            <FRow label="Nom *"><FInp value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} /></FRow>
            <FRow label="Slug"><FInp value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} /></FRow>
            <FRow label="Description">
              <textarea value={form.description ?? ''} rows={3} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none" />
            </FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Prix (€)"><FInp value={String(form.price)} onChange={v => setForm(f => ({ ...f, price: Number(v) }))} /></FRow>
              <FRow label="Type de facturation">
                <select value={form.billing_type} onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  <option value="monthly">Mensuel</option><option value="annual">Annuel</option><option value="once">Ponctuel</option>
                </select>
              </FRow>
            </div>
            <FRow label="Ordre"><FInp value={String(form.sort_order)} onChange={v => setForm(f => ({ ...f, sort_order: Number(v) }))} /></FRow>
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => { setEditing(null); setShowNew(false); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
              <button onClick={save} disabled={upsert.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]">
                <Save size={13} />{upsert.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
};

// ─── Promotions Tab ───────────────────────────────────────────────────────────

const PromosTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: promos = [], isLoading } = usePromos();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const EMPTY = { code: '', description: '', discount_type: 'percentage', discount_value: '10', max_uses: '', starts_at: '', expires_at: '' };
  const [form, setForm] = useState(EMPTY);
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const upsert = useMutation({
    mutationFn: async (p: typeof EMPTY & { id?: string }) => {
      const { id, ...raw } = p;
      const body = {
        code: raw.code.toUpperCase().trim(),
        description: raw.description || null,
        discount_type: raw.discount_type,
        discount_value: Number(raw.discount_value),
        max_uses: raw.max_uses ? Number(raw.max_uses) : null,
        starts_at: raw.starts_at || null,
        expires_at: raw.expires_at || null,
      };
      if (!body.code) throw new Error('Code requis');
      if (id) { const { error } = await db.from('promotions').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
      else    { const { error } = await db.from('promotions').insert(body); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-promos-v2'] }); toast.success('Promotion enregistrée.'); setShowNew(false); setEditing(null); setForm(EMPTY); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('promotions').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-promos-v2'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (p: Promo) => {
    setForm({ code: p.code, description: p.description ?? '', discount_type: p.discount_type, discount_value: String(p.discount_value), max_uses: p.max_uses ? String(p.max_uses) : '', starts_at: p.starts_at ? p.starts_at.split('T')[0] : '', expires_at: p.expires_at ? p.expires_at.split('T')[0] : '' });
    setEditing(p);
  };

  const now = new Date().toISOString();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{promos.length} promotion{promos.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setForm(EMPTY); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED]">
          <Plus size={14} /> Nouvelle promotion
        </button>
      </div>

      {isLoading ? <Skeleton /> : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Remise</th>
                <th className="px-4 py-3">Utilisations</th><th className="px-4 py-3">Validité</th>
                <th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Aucune promotion créée.</td></tr>
              ) : promos.map(p => {
                const expired = p.expires_at ? p.expires_at < now : false;
                const exhausted = p.max_uses != null && p.uses_count >= p.max_uses;
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Tag size={12} className="text-gray-300" />
                        <span className="font-black text-[13px] font-mono text-gray-900">{p.code}</span>
                      </div>
                      {p.description && <div className="text-[11px] text-gray-400 mt-0.5 ml-5">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-black text-[14px] text-gray-900 flex items-center gap-1">
                        {p.discount_type === 'percentage' ? <Percent size={12} className="text-gray-400" /> : '€'}
                        {p.discount_value}{p.discount_type === 'percentage' ? '%' : ' €'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-gray-600">
                      {p.uses_count}{p.max_uses != null ? ` / ${p.max_uses}` : ''}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-gray-500">
                      {p.starts_at && <div className="text-[11px] text-gray-400">Début : {new Date(p.starts_at).toLocaleDateString('fr-FR')}</div>}
                      {p.expires_at ? new Date(p.expires_at).toLocaleDateString('fr-FR') : 'Sans limite'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {expired ? <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Expiré</span>
                        : exhausted ? <span className="text-[11px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Épuisé</span>
                        : !p.is_active ? <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactif</span>
                        : <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Actif</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10"><Edit2 size={13} /></button>
                        <button onClick={() => toggle.mutate({ id: p.id, is_active: !p.is_active })} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50"><Power size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showNew || editing) && (
        <Drawer onClose={() => { setShowNew(false); setEditing(null); setForm(EMPTY); }} title={editing ? 'Modifier la promotion' : 'Nouvelle promotion'}>
          <div className="space-y-3">
            <FRow label="Code promo *"><FInp value={form.code} onChange={v => s('code', v.toUpperCase().replace(/\s/g, ''))} placeholder="FLOW30" /></FRow>
            <FRow label="Description"><FInp value={form.description} onChange={v => s('description', v)} placeholder="30% de réduction 3 mois" /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Type de remise">
                <select value={form.discount_type} onChange={e => s('discount_type', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  <option value="percentage">Pourcentage (%)</option><option value="fixed">Montant fixe (€)</option>
                </select>
              </FRow>
              <FRow label={`Valeur (${form.discount_type === 'percentage' ? '%' : '€'})`}>
                <FInp value={form.discount_value} onChange={v => s('discount_value', v)} />
              </FRow>
            </div>
            <FRow label="Utilisations max"><FInp value={form.max_uses} onChange={v => s('max_uses', v)} placeholder="Illimité" /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Date de début"><input type="date" value={form.starts_at} onChange={e => s('starts_at', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></FRow>
              <FRow label="Date de fin"><input type="date" value={form.expires_at} onChange={e => s('expires_at', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></FRow>
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => { setShowNew(false); setEditing(null); setForm(EMPTY); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
              <button onClick={() => upsert.mutate(editing ? { id: editing.id, ...form } : form)} disabled={upsert.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]">
                <Save size={13} />{upsert.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const Drawer: React.FC<{ children: React.ReactNode; onClose: () => void; title: string }> = ({ children, onClose, title }) => (
  <>
    <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
    <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <h2 className="text-base font-black text-gray-900">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
      </div>
      {children}
    </div>
  </>
);

const FRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><p className="text-[11px] font-bold text-gray-500 mb-1">{label}</p>{children}</div>
);

const FInp: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]" />
);

const Skeleton: React.FC = () => (
  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
);
