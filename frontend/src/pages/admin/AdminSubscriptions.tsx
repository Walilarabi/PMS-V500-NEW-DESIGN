import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, Edit2, Power, X, Save,
  Tag, Percent, ToggleLeft, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type SubTab = 'plans' | 'addons' | 'promotions' | 'settings';

// ─── Plans ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  max_rooms: number | null;
  max_users: number | null;
  modules: string[];
  features: string[];
  support_level: string;
  is_active: boolean;
  sort_order: number;
}

function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const { data, error } = await db.from('subscription_plans').select('*').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Add-ons ──────────────────────────────────────────────────────────────────

interface AddOn {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  billing_type: string;
  is_active: boolean;
  sort_order: number;
}

function useAddOns() {
  return useQuery<AddOn[]>({
    queryKey: ['admin-addons'],
    queryFn: async () => {
      const { data, error } = await db.from('add_ons').select('*').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Promotions ───────────────────────────────────────────────────────────────

interface Promo {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

function usePromos() {
  return useQuery<Promo[]>({
    queryKey: ['admin-promos'],
    queryFn: async () => {
      const { data, error } = await db.from('promotions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Platform settings ────────────────────────────────────────────────────────

interface Setting { id: string; key: string; value: unknown; description: string | null }

function useSettings() {
  return useQuery<Setting[]>({
    queryKey: ['admin-plat-settings'],
    queryFn: async () => {
      const { data, error } = await db.from('platform_settings').select('*').order('key');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AdminSubscriptions: React.FC = () => {
  const [tab, setTab] = useState<SubTab>('plans');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">Abonnements</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestion des forfaits, add-ons et promotions</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { id: 'plans',      label: 'Forfaits' },
          { id: 'addons',     label: 'Add-ons' },
          { id: 'promotions', label: 'Promotions' },
          { id: 'settings',   label: 'Configuration' },
        ] as { id: SubTab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn('px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors',
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans'      && <PlansTab />}
      {tab === 'addons'     && <AddOnsTab />}
      {tab === 'promotions' && <PromosTab />}
      {tab === 'settings'   && <SettingsTab />}
    </div>
  );
};

// ─── Plans tab ────────────────────────────────────────────────────────────────

const PlansTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = usePlans();
  const [editing, setEditing]   = useState<Plan | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const EMPTY_PLAN: Omit<Plan, 'id'> = {
    name: '', slug: '', description: '', price_monthly: 0, price_annual: 0,
    max_rooms: null, max_users: null, modules: [], features: [], support_level: 'email', is_active: true, sort_order: 0,
  };
  const [form, setForm] = useState<Omit<Plan, 'id'>>(EMPTY_PLAN);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('Forfait enregistré.');
      setEditing(null); setShowNew(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('subscription_plans').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (p: Plan) => {
    setForm({ name: p.name, slug: p.slug, description: p.description ?? '', price_monthly: p.price_monthly, price_annual: p.price_annual, max_rooms: p.max_rooms, max_users: p.max_users, modules: p.modules, features: p.features, support_level: p.support_level, is_active: p.is_active, sort_order: p.sort_order });
    setEditing(p);
  };

  const save = () => {
    if (!form.name.trim()) { toast.error('Nom requis.'); return; }
    upsert.mutate(editing ? { id: editing.id, ...form } : form);
  };

  const SUPPORT_LEVELS: Record<string, string> = { email: 'Email', priority: 'Prioritaire', phone: 'Téléphone', csm: 'CSM dédié' };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{plans.length} forfait{plans.length > 1 ? 's' : ''}</p>
        <button onClick={() => { setForm(EMPTY_PLAN); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED]">
          <Plus size={14} /> Nouveau forfait
        </button>
      </div>

      {isLoading ? <LoadingRows /> : (
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.id} className={cn('bg-white rounded-2xl border overflow-hidden transition-colors', p.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60')}>
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50"
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              >
                <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                  <Package size={16} className="text-[#8B5CF6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px] text-gray-900">{p.name}</span>
                    {!p.is_active && <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactif</span>}
                    <span className="text-[11px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{SUPPORT_LEVELS[p.support_level] ?? p.support_level}</span>
                  </div>
                  <p className="text-[12px] text-gray-400 mt-0.5">{p.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-[15px] text-gray-900">{p.price_monthly > 0 ? `${p.price_monthly} €/mois` : 'Sur devis'}</p>
                  {p.price_annual > 0 && <p className="text-[11px] text-gray-400">{p.price_annual} €/an</p>}
                </div>
                <ChevronDown size={15} className={cn('text-gray-300 shrink-0 transition-transform', expanded === p.id && 'rotate-180')} />
              </button>

              {expanded === p.id && (
                <div className="px-5 pb-4 border-t border-gray-50 pt-4 space-y-3">
                  <div className="grid grid-cols-4 gap-3 text-[12px]">
                    <Kv label="Max chambres"  value={p.max_rooms  ? String(p.max_rooms)  : 'Illimité'} />
                    <Kv label="Max users"     value={p.max_users  ? String(p.max_users)  : 'Illimité'} />
                    <Kv label="Prix mensuel"  value={p.price_monthly > 0 ? `${p.price_monthly} €` : 'Sur devis'} />
                    <Kv label="Prix annuel"   value={p.price_annual  > 0 ? `${p.price_annual} €`  : '—'} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Fonctionnalités</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.features.map(f => (
                        <span key={f} className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] text-[12px] font-bold hover:bg-[#8B5CF6]/20"><Edit2 size={12} /> Modifier</button>
                    <button onClick={() => toggle.mutate({ id: p.id, is_active: !p.is_active })} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold', p.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')}>
                      <Power size={12} />{p.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <SideDrawer onClose={() => { setEditing(null); setShowNew(false); }} title={editing ? 'Modifier le forfait' : 'Nouveau forfait'}>
          <PlanForm form={form} onChange={setForm} onSave={save} onCancel={() => { setEditing(null); setShowNew(false); }} saving={upsert.isPending} />
        </SideDrawer>
      )}
    </>
  );
};

const PlanForm: React.FC<{
  form: Omit<Plan, 'id'>;
  onChange: (f: Omit<Plan, 'id'>) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}> = ({ form, onChange, onSave, onCancel, saving }) => {
  const s = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => onChange({ ...form, [k]: v });
  return (
    <div className="space-y-3">
      <FRow label="Nom *"><FInp value={form.name} onChange={v => s('name', v)} /></FRow>
      <FRow label="Slug *"><FInp value={form.slug} onChange={v => s('slug', v)} placeholder="essentiel" /></FRow>
      <FRow label="Description"><FInp value={form.description ?? ''} onChange={v => s('description', v)} /></FRow>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Prix mensuel (€)"><FInp value={String(form.price_monthly)} onChange={v => s('price_monthly', Number(v))} /></FRow>
        <FRow label="Prix annuel (€)"><FInp value={String(form.price_annual)} onChange={v => s('price_annual', Number(v))} /></FRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FRow label="Max chambres"><FInp value={String(form.max_rooms ?? '')} onChange={v => s('max_rooms', v ? Number(v) : null)} placeholder="Illimité" /></FRow>
        <FRow label="Max users"><FInp value={String(form.max_users ?? '')} onChange={v => s('max_users', v ? Number(v) : null)} placeholder="Illimité" /></FRow>
      </div>
      <FRow label="Support inclus">
        <select value={form.support_level} onChange={e => s('support_level', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
          {[['email','Email'],['priority','Prioritaire'],['phone','Téléphone'],['csm','CSM dédié']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FRow>
      <FRow label="Fonctionnalités (une par ligne)">
        <textarea
          value={form.features.join('\n')} rows={4}
          onChange={e => s('features', e.target.value.split('\n').filter(Boolean))}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none"
        />
      </FRow>
      <FRow label="Ordre d'affichage"><FInp value={String(form.sort_order)} onChange={v => s('sort_order', Number(v))} /></FRow>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
        <button onClick={onSave} disabled={saving} className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          <Save size={13} />{saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

// ─── Add-ons tab ──────────────────────────────────────────────────────────────

const BILLING_TYPES: Record<string, string> = { monthly: 'Mensuel', annual: 'Annuel', once: 'Ponctuel' };

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-addons'] }); toast.success('Add-on enregistré.'); setEditing(null); setShowNew(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('add_ons').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-addons'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = () => { if (!form.name.trim()) { toast.error('Nom requis.'); return; } upsert.mutate(editing ? { id: editing.id, ...form } : form); };
  const openEdit = (a: AddOn) => { setForm({ name: a.name, slug: a.slug, description: a.description ?? '', price: a.price, billing_type: a.billing_type, is_active: a.is_active, sort_order: a.sort_order }); setEditing(a); };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{addons.length} add-on{addons.length > 1 ? 's' : ''}</p>
        <button onClick={() => { setForm(EMPTY); setShowNew(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED]"><Plus size={14} /> Nouveau add-on</button>
      </div>
      {isLoading ? <LoadingRows /> : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Nom</th><th className="px-4 py-3">Prix</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {addons.map(a => (
                <tr key={a.id} className={cn('hover:bg-gray-50/60', !a.is_active && 'opacity-50')}>
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-[13px] text-gray-900">{a.name}</div>
                    {a.description && <div className="text-[11px] text-gray-400">{a.description}</div>}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-[13px] text-gray-900">{a.price > 0 ? `${a.price} €` : 'Gratuit'}</td>
                  <td className="px-4 py-3.5"><span className="text-[11px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{BILLING_TYPES[a.billing_type] ?? a.billing_type}</span></td>
                  <td className="px-4 py-3.5 text-center">{a.is_active ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Actif</span> : <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactif</span>}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10"><Edit2 size={13} /></button>
                      <button onClick={() => toggle.mutate({ id: a.id, is_active: !a.is_active })} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50"><Power size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(showNew || editing) && (
        <SideDrawer onClose={() => { setEditing(null); setShowNew(false); }} title={editing ? 'Modifier l\'add-on' : 'Nouvel add-on'}>
          <div className="space-y-3">
            <FRow label="Nom *"><FInp value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} /></FRow>
            <FRow label="Slug"><FInp value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} /></FRow>
            <FRow label="Description"><FInp value={form.description ?? ''} onChange={v => setForm(f => ({ ...f, description: v }))} /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Prix (€)"><FInp value={String(form.price)} onChange={v => setForm(f => ({ ...f, price: Number(v) }))} /></FRow>
              <FRow label="Type">
                <select value={form.billing_type} onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  <option value="monthly">Mensuel</option><option value="annual">Annuel</option><option value="once">Ponctuel</option>
                </select>
              </FRow>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setEditing(null); setShowNew(false); }} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
              <button onClick={save} disabled={upsert.isPending} className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2"><Save size={13} />{upsert.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </SideDrawer>
      )}
    </>
  );
};

// ─── Promotions tab ───────────────────────────────────────────────────────────

const PromosTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: promos = [], isLoading } = usePromos();
  const [showNew, setShowNew] = useState(false);
  const EMPTY = { code: '', description: '', discount_type: 'percentage', discount_value: 10, max_uses: null as number | null, starts_at: '', expires_at: '' };
  const [form, setForm] = useState(EMPTY);

  const create = useMutation({
    mutationFn: async (p: typeof EMPTY) => {
      const { error } = await db.from('promotions').insert({
        code: p.code.toUpperCase(), description: p.description || null, discount_type: p.discount_type,
        discount_value: p.discount_value, max_uses: p.max_uses,
        starts_at: p.starts_at || null, expires_at: p.expires_at || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-promos'] }); toast.success('Promotion créée.'); setShowNew(false); setForm(EMPTY); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('promotions').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-promos'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date().toISOString();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">{promos.length} promotion{promos.length > 1 ? 's' : ''}</p>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED]"><Plus size={14} /> Nouvelle promo</button>
      </div>
      {isLoading ? <LoadingRows /> : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Remise</th><th className="px-4 py-3">Utilisations</th><th className="px-4 py-3">Expiration</th><th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Aucune promotion.</td></tr>
              ) : promos.map(p => {
                const expired = p.expires_at ? p.expires_at < now : false;
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2"><Tag size={12} className="text-gray-300" /><span className="font-bold text-[13px] font-mono text-gray-900">{p.code}</span></div>
                      {p.description && <div className="text-[11px] text-gray-400 mt-0.5">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[13px] text-gray-900">
                      <span className="flex items-center gap-1">
                        {p.discount_type === 'percentage' ? <Percent size={12} /> : '€'}
                        {p.discount_value}{p.discount_type === 'percentage' ? '%' : ' €'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-gray-600">{p.uses_count}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                    <td className="px-4 py-3.5 text-[12px] text-gray-500">{p.expires_at ? new Date(p.expires_at).toLocaleDateString('fr-FR') : 'Sans limite'}</td>
                    <td className="px-4 py-3.5 text-center">
                      {expired || !p.is_active
                        ? <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{expired ? 'Expiré' : 'Inactif'}</span>
                        : <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Actif</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
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
      {showNew && (
        <SideDrawer onClose={() => setShowNew(false)} title="Nouvelle promotion">
          <div className="space-y-3">
            <FRow label="Code *"><FInp value={form.code} onChange={v => setForm(f => ({ ...f, code: v.toUpperCase() }))} placeholder="PROMO10" /></FRow>
            <FRow label="Description"><FInp value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Type">
                <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  <option value="percentage">Pourcentage</option><option value="fixed">Montant fixe</option>
                </select>
              </FRow>
              <FRow label="Valeur"><FInp value={String(form.discount_value)} onChange={v => setForm(f => ({ ...f, discount_value: Number(v) }))} /></FRow>
            </div>
            <FRow label="Utilisations max"><FInp value={form.max_uses !== null ? String(form.max_uses) : ''} onChange={v => setForm(f => ({ ...f, max_uses: v ? Number(v) : null }))} placeholder="Illimité" /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="Date début"><input type="date" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></FRow>
              <FRow label="Date fin"><input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></FRow>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
              <button onClick={() => create.mutate(form)} disabled={create.isPending} className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2"><Save size={13} />{create.isPending ? 'Création…' : 'Créer'}</button>
            </div>
          </div>
        </SideDrawer>
      )}
    </>
  );
};

// ─── Settings tab ─────────────────────────────────────────────────────────────

const SettingsTab: React.FC = () => {
  const qc = useQueryClient();
  const { data: settings = [], isLoading } = useSettings();
  const [edited, setEdited] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await db.from('platform_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plat-settings'] }); toast.success('Paramètre enregistré.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingRows />;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 bg-gray-50">
        <h3 className="text-[12px] font-black uppercase tracking-widest text-gray-400">Configuration globale de la plateforme</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {settings.map(s => {
          const current = edited[s.key] ?? JSON.stringify(s.value).replace(/^"|"$/g, '');
          const changed  = edited[s.key] !== undefined && edited[s.key] !== JSON.stringify(s.value).replace(/^"|"$/g, '');
          return (
            <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-900 font-mono">{s.key}</p>
                {s.description && <p className="text-[11px] text-gray-400 mt-0.5">{s.description}</p>}
              </div>
              <input
                value={current}
                onChange={e => setEdited(p => ({ ...p, [s.key]: e.target.value }))}
                className="w-48 px-3 py-1.5 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 font-mono"
              />
              {changed && (
                <button
                  onClick={() => {
                    const raw = edited[s.key];
                    let parsed: unknown = raw;
                    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                    save.mutate({ key: s.key, value: parsed });
                    setEdited(p => { const n = { ...p }; delete n[s.key]; return n; });
                  }}
                  className="px-3 py-1.5 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED]"
                >
                  <Save size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const Kv: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div><p className="text-[10px] text-gray-400 font-semibold">{label}</p><p className="font-bold text-gray-800 text-[12px]">{value}</p></div>
);

const LoadingRows: React.FC = () => (
  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
);

const SideDrawer: React.FC<{ children: React.ReactNode; onClose: () => void; title: string }> = ({ children, onClose, title }) => (
  <>
    <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
    <div className="fixed right-0 top-0 bottom-0 w-[440px] bg-white shadow-2xl z-50 flex flex-col overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
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
