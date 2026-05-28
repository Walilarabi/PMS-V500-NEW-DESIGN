import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, MapPin, Search, Plus, Edit2, Trash2,
  Power, CheckCircle2, XCircle, X, Save, AlertTriangle,
  Mail, Phone, Globe, Star, BedDouble, Layers,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Hotel {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  zip: string | null;
  email: string | null;
  phone: string | null;
  siret: string | null;
  tva_number: string | null;
  currency: string | null;
  timezone: string | null;
  active: boolean;
  created_at: string;
}

type FilterStatus = 'all' | 'active' | 'inactive';

const EMPTY: Omit<Hotel, 'id' | 'created_at'> = {
  name: '', city: '', country: 'France', address: '', zip: '',
  email: '', phone: '', siret: '', tva_number: '',
  currency: 'EUR', timezone: 'Europe/Paris', active: true,
};

function useHotels() {
  return useQuery<Hotel[]>({
    queryKey: ['admin-hotels-v2'],
    queryFn: async () => {
      const { data, error } = await db.from('hotels')
        .select('id, name, city, country, address, zip, email, phone, siret, tva_number, currency, timezone, active, created_at')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export const AdminHotels: React.FC = () => {
  const qc = useQueryClient();
  const { data: hotels = [], isLoading } = useHotels();

  const [search, setSearch]           = useState('');
  const [status, setStatus]           = useState<FilterStatus>('all');
  const [drawerHotel, setDrawerHotel] = useState<Hotel | null>(null);
  const [editMode, setEditMode]       = useState(false);
  const [form, setForm]               = useState<Omit<Hotel, 'id' | 'created_at'>>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Hotel | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showNew, setShowNew]         = useState(false);

  const filtered = hotels.filter(h => {
    const q = search.toLowerCase();
    const matchSearch = !q || h.name.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q) || h.email?.toLowerCase().includes(q);
    const matchStatus = status === 'all' || (status === 'active' && h.active) || (status === 'inactive' && !h.active);
    return matchSearch && matchStatus;
  });

  const upsertMut = useMutation({
    mutationFn: async (payload: { id?: string } & Omit<Hotel, 'id' | 'created_at'>) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await db.from('hotels').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await db.from('hotels').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels-v2'] });
      toast.success('Hôtel enregistré.');
      setDrawerHotel(null);
      setShowNew(false);
      setEditMode(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from('hotels').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels-v2'] });
      toast.success('Statut mis à jour.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('hotels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hotels-v2'] });
      toast.success('Hôtel supprimé.');
      setDeleteTarget(null);
      setDeleteConfirm('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setForm(EMPTY);
    setShowNew(true);
  };

  const openEdit = (h: Hotel) => {
    setForm({ name: h.name, city: h.city ?? '', country: h.country ?? 'France', address: h.address ?? '', zip: h.zip ?? '', email: h.email ?? '', phone: h.phone ?? '', siret: h.siret ?? '', tva_number: h.tva_number ?? '', currency: h.currency ?? 'EUR', timezone: h.timezone ?? 'Europe/Paris', active: h.active });
    setDrawerHotel(h);
    setEditMode(true);
  };

  const saveForm = () => {
    if (!form.name.trim()) { toast.error('Le nom est requis.'); return; }
    if (editMode && drawerHotel) {
      upsertMut.mutate({ id: drawerHotel.id, ...form });
    } else {
      upsertMut.mutate(form);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Hôtels</h1>
          <p className="text-sm text-gray-400 mt-0.5">{hotels.length} hôtel{hotels.length > 1 ? 's' : ''} sur la plateforme</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[13px] font-bold hover:bg-[#7C3AED] transition-colors shadow-sm shadow-[#8B5CF6]/30"
        >
          <Plus size={15} /> Ajouter un hôtel
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, ville, email…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]"
          />
        </div>
        {(['all','active','inactive'] as FilterStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn('px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors border',
              status === s ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50')}
          >
            {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : 'Inactifs'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Hôtel</th>
              <th className="px-4 py-3">Localisation</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Devise</th>
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
                  <button
                    onClick={() => { setDrawerHotel(h); setEditMode(false); }}
                    className="flex items-center gap-2.5 hover:opacity-80 transition-opacity text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                      <Building2 size={14} className="text-[#8B5CF6]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">{h.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{h.id.slice(0, 8)}…</div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                    <MapPin size={11} className="text-gray-300" />
                    {[h.city, h.country].filter(Boolean).join(', ') || '—'}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-[12px] text-gray-500">
                  {h.email && <div className="flex items-center gap-1"><Mail size={11} className="text-gray-300" />{h.email}</div>}
                  {h.phone && <div className="flex items-center gap-1 text-gray-400"><Phone size={11} className="text-gray-300" />{h.phone}</div>}
                  {!h.email && !h.phone && '—'}
                </td>
                <td className="px-4 py-3.5 text-[12px] font-mono text-gray-500">{h.currency ?? '—'}</td>
                <td className="px-4 py-3.5 text-center">
                  {h.active
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> Actif</span>
                    : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"><XCircle size={10} /> Inactif</span>
                  }
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors" title="Modifier"><Edit2 size={13} /></button>
                    <button onClick={() => toggleMut.mutate({ id: h.id, active: !h.active })} className={cn('p-1.5 rounded-lg transition-colors', h.active ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50')} title={h.active ? 'Suspendre' : 'Réactiver'}><Power size={13} /></button>
                    <button onClick={() => setDeleteTarget(h)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Supprimer"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Drawer: view / edit ─────────────────────────────────────────── */}
      {drawerHotel && !showNew && (
        <Drawer onClose={() => { setDrawerHotel(null); setEditMode(false); }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-base font-black text-gray-900">{editMode ? 'Modifier l\'hôtel' : drawerHotel.name}</h2>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">{drawerHotel.id}</p>
            </div>
            <div className="flex items-center gap-2">
              {!editMode && (
                <button onClick={() => openEdit(drawerHotel)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] text-[12px] font-bold hover:bg-[#8B5CF6]/20 transition-colors">
                  <Edit2 size={12} /> Modifier
                </button>
              )}
              <button onClick={() => { setDrawerHotel(null); setEditMode(false); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={15} />
              </button>
            </div>
          </div>

          {editMode ? (
            <HotelForm form={form} onChange={setForm} onSave={saveForm} onCancel={() => { setEditMode(false); setDrawerHotel(null); }} saving={upsertMut.isPending} />
          ) : (
            <HotelDetail hotel={drawerHotel} />
          )}
        </Drawer>
      )}

      {/* ── Drawer: new hotel ───────────────────────────────────────────── */}
      {showNew && (
        <Drawer onClose={() => setShowNew(false)}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-gray-900">Nouvel hôtel</h2>
            <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
          </div>
          <HotelForm form={form} onChange={setForm} onSave={saveForm} onCancel={() => setShowNew(false)} saving={upsertMut.isPending} />
        </Drawer>
      )}

      {/* ── Delete confirm modal ────────────────────────────────────────── */}
      {deleteTarget && (
        <Modal onClose={() => { setDeleteTarget(null); setDeleteConfirm(''); }}>
          <div className="text-center p-2">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">Supprimer l'hôtel ?</h3>
            <p className="text-[13px] text-gray-500 mb-4">
              Cette action est <strong>irréversible</strong>. Toutes les données liées seront supprimées.
            </p>
            <div className="flex items-center gap-2 mb-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <p className="text-[12px] text-amber-700">Tapez le nom de l'hôtel pour confirmer :</p>
            </div>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget.name}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[13px] mb-4 outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); }} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
              <button
                disabled={deleteConfirm !== deleteTarget.name || deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[13px] font-bold disabled:opacity-40 hover:bg-red-600 transition-colors"
              >
                {deleteMut.isPending ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── HotelDetail (read-only) ──────────────────────────────────────────────────

const HotelDetail: React.FC<{ hotel: Hotel }> = ({ hotel }) => (
  <div className="space-y-4 text-[13px]">
    <Section title="Général">
      <Field label="Nom"     value={hotel.name} />
      <Field label="Statut"  value={hotel.active ? 'Actif' : 'Inactif'} />
      <Field label="Devise"  value={hotel.currency} />
      <Field label="Fuseau"  value={hotel.timezone} />
      <Field label="Créé le" value={new Date(hotel.created_at).toLocaleDateString('fr-FR')} />
    </Section>
    <Section title="Adresse">
      <Field label="Adresse" value={hotel.address} />
      <Field label="CP"      value={hotel.zip} />
      <Field label="Ville"   value={hotel.city} />
      <Field label="Pays"    value={hotel.country} />
    </Section>
    <Section title="Contact">
      <Field label="Email" value={hotel.email} icon={<Mail size={12} className="text-gray-300" />} />
      <Field label="Tél."  value={hotel.phone} icon={<Phone size={12} className="text-gray-300" />} />
      <Field label="SIRET" value={hotel.siret} icon={<Globe size={12} className="text-gray-300" />} />
      <Field label="TVA"   value={hotel.tva_number} />
    </Section>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{title}</p>
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; value?: string | null; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center gap-2">
    {icon}
    <span className="text-gray-400 w-20 shrink-0">{label}</span>
    <span className="font-semibold text-gray-800">{value || '—'}</span>
  </div>
);

// ─── HotelForm ────────────────────────────────────────────────────────────────

interface FormProps {
  form: Omit<Hotel, 'id' | 'created_at'>;
  onChange: (f: Omit<Hotel, 'id' | 'created_at'>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

const HotelForm: React.FC<FormProps> = ({ form, onChange, onSave, onCancel, saving }) => {
  const set = (k: keyof typeof form, v: string | boolean) => onChange({ ...form, [k]: v });
  return (
    <div className="space-y-4">
      <FormRow label="Nom *">
        <FInput value={form.name}     onChange={v => set('name', v)}    placeholder="Nom de l'hôtel" />
      </FormRow>
      <div className="grid grid-cols-2 gap-3">
        <FormRow label="Email"><FInput value={form.email ?? ''} onChange={v => set('email', v)} placeholder="contact@hotel.com" /></FormRow>
        <FormRow label="Téléphone"><FInput value={form.phone ?? ''} onChange={v => set('phone', v)} placeholder="+33 1 XX XX XX XX" /></FormRow>
      </div>
      <FormRow label="Adresse"><FInput value={form.address ?? ''} onChange={v => set('address', v)} placeholder="Adresse" /></FormRow>
      <div className="grid grid-cols-3 gap-3">
        <FormRow label="CP"><FInput value={form.zip ?? ''} onChange={v => set('zip', v)} placeholder="75001" /></FormRow>
        <FormRow label="Ville"><FInput value={form.city ?? ''} onChange={v => set('city', v)} placeholder="Paris" /></FormRow>
        <FormRow label="Pays"><FInput value={form.country ?? ''} onChange={v => set('country', v)} placeholder="France" /></FormRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormRow label="Devise"><FInput value={form.currency ?? ''} onChange={v => set('currency', v)} placeholder="EUR" /></FormRow>
        <FormRow label="Fuseau horaire"><FInput value={form.timezone ?? ''} onChange={v => set('timezone', v)} placeholder="Europe/Paris" /></FormRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormRow label="SIRET"><FInput value={form.siret ?? ''} onChange={v => set('siret', v)} placeholder="SIRET" /></FormRow>
        <FormRow label="N° TVA"><FInput value={form.tva_number ?? ''} onChange={v => set('tva_number', v)} placeholder="FR12345678901" /></FormRow>
      </div>
      <FormRow label="Statut">
        <select
          value={form.active ? 'active' : 'inactive'}
          onChange={e => set('active', e.target.value === 'active')}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
        >
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
        </select>
      </FormRow>

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 hover:bg-[#7C3AED] flex items-center justify-center gap-2"
        >
          <Save size={13} />{saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

const FInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors"
  />
);

// ─── Drawer & Modal shells ─────────────────────────────────────────────────────

const Drawer: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
    <div className="fixed right-0 top-0 bottom-0 w-[460px] bg-white shadow-2xl z-50 flex flex-col overflow-y-auto p-6">
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
