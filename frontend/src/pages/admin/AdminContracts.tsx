import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FilePlus, Plus, Download, Send, X, Save, Search } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Contract {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  number: string;
  status: string;
  title: string;
  body: string | null;
  plan_id: string | null;
  signed_at: string | null;
  expires_at: string | null;
  sent_at: string | null;
  version: number;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Brouillon', color: 'bg-gray-100 text-gray-500' },
  sent:      { label: 'Envoyé',    color: 'bg-blue-50 text-blue-600' },
  signed:    { label: 'Signé',     color: 'bg-emerald-50 text-emerald-600' },
  expired:   { label: 'Expiré',    color: 'bg-orange-50 text-orange-600' },
  cancelled: { label: 'Annulé',    color: 'bg-gray-100 text-gray-400' },
};

function useContracts() {
  return useQuery<Contract[]>({
    queryKey: ['admin-contracts'],
    queryFn: async () => {
      const { data, error } = await db.from('platform_contracts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const { data: hotels } = await db.from('hotels').select('id, name');
      const hm: Record<string, string> = {};
      (hotels ?? []).forEach((h: { id: string; name: string }) => { hm[h.id] = h.name; });
      return (data ?? []).map((c: Contract) => ({ ...c, hotel_name: hm[c.hotel_id] }));
    },
    staleTime: 30_000,
  });
}

function useHotelList() {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin-hotel-list'],
    queryFn: async () => { const { data } = await db.from('hotels').select('id, name').order('name'); return data ?? []; },
    staleTime: 60_000,
  });
}

function nextContractNumber(existing: Contract[]): string {
  const y = new Date().getFullYear();
  const prefix = `CTR-${y}-`;
  const nums = existing.filter(c => c.number.startsWith(prefix)).map(c => parseInt(c.number.replace(prefix, ''), 10)).filter(n => !isNaN(n));
  return `${prefix}${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(4,'0')}`;
}

export const AdminContracts: React.FC = () => {
  const qc = useQueryClient();
  const { data: contracts = [], isLoading } = useContracts();
  const { data: hotelList = [] }            = useHotelList();
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const EMPTY = { hotel_id: '', title: '', body: '', expires_at: '' };
  const [form, setForm] = useState(EMPTY);

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase();
    const m = !q || c.number.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.hotel_name?.toLowerCase().includes(q);
    const s = statusF === 'all' || c.status === statusF;
    return m && s;
  });

  const createMut = useMutation({
    mutationFn: async (f: typeof EMPTY) => {
      const { error } = await db.from('platform_contracts').insert({
        hotel_id: f.hotel_id, number: nextContractNumber(contracts),
        status: 'draft', title: f.title, body: f.body || null, expires_at: f.expires_at || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-contracts'] }); toast.success('Contrat créé.'); setShowNew(false); setForm(EMPTY); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...rest }: { id: string } & Partial<Contract>) => {
      const { error } = await db.from('platform_contracts').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-contracts'] }); toast.success('Contrat mis à jour.'); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = (c: Contract) => {
    updateMut.mutate({ id: c.id, status: 'sent', sent_at: new Date().toISOString() });
    toast.success('Contrat marqué comme envoyé.');
  };

  const handleSign = (c: Contract) => {
    updateMut.mutate({ id: c.id, status: 'signed', signed_at: new Date().toISOString() });
    toast.success('Contrat marqué comme signé.');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Contrats</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contracts.length} contrat{contracts.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[13px] font-bold hover:bg-[#7C3AED] shadow-sm">
          <Plus size={15} /> Nouveau contrat
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N°, titre, hôtel…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
        </div>
        {(['all', ...Object.keys(STATUS_META)]).map(s => (
          <button key={s} onClick={() => setStatusF(s)}
            className={cn('px-3 py-2 rounded-xl text-[12px] font-semibold border transition-colors',
              statusF === s ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50')}>
            {s === 'all' ? 'Tous' : STATUS_META[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">N°</th><th className="px-4 py-3">Hôtel</th><th className="px-4 py-3">Titre</th><th className="px-4 py-3">Expiration</th><th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Aucun contrat.</td></tr>
            ) : filtered.map(c => {
              const meta = STATUS_META[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-500' };
              return (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3.5 font-mono text-[12px] font-bold text-gray-900">{c.number}</td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-700">{c.hotel_name ?? c.hotel_id.slice(0,8)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-semibold text-gray-800">{c.title}</td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3.5 text-center"><span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', meta.color)}>{meta.label}</span></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.status === 'draft' && <button onClick={() => handleSend(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50" title="Marquer comme envoyé"><Send size={13} /></button>}
                      {c.status === 'sent'  && <button onClick={() => handleSign(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50" title="Marquer comme signé"><FilePlus size={13} /></button>}
                      <button className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50" title="Télécharger PDF"><Download size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowNew(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-gray-900">Nouveau contrat</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              <Lbl label="Hôtel *">
                <select value={form.hotel_id} onChange={e => setForm(f => ({ ...f, hotel_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  <option value="">Sélectionner…</option>
                  {hotelList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Lbl>
              <Lbl label="Titre *"><FInp value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Contrat d'abonnement Flowtym" /></Lbl>
              <Lbl label="Date d'expiration"><input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></Lbl>
              <Lbl label="Corps du contrat">
                <textarea value={form.body} rows={10} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Saisir les clauses contractuelles…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none font-mono" />
              </Lbl>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
              <button
                onClick={() => { if (!form.hotel_id || !form.title.trim()) { toast.error('Hôtel et titre requis.'); return; } createMut.mutate(form); }}
                disabled={createMut.isPending}
                className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                <Save size={13} />{createMut.isPending ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Lbl: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><p className="text-[11px] font-bold text-gray-500 mb-1">{label}</p>{children}</div>
);

const FInp: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]" />
);
