import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, Plus, UserX, UserCheck,
  Send, X, Save, Mail, Hotel,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface UserRow {
  id: string;
  auth_id: string;
  hotel_id: string;
  hotel_name?: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface InviteRow {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  invited_at: string;
}

// R4 : aligné sur l'enum DB admin_user_role. 'petit_dejeuner' (typo) → 'breakfast',
// ajout de 'comptabilite'.
const ROLES = [
  'direction','admin_hotel','reception','gouvernante','femme_de_chambre',
  'maintenance','breakfast','comptabilite','revenue_manager',
] as const;

const ROLE_LABELS: Record<string, string> = {
  direction: 'Direction', admin_hotel: 'Admin hôtel', reception: 'Réception',
  gouvernante: 'Gouvernante', femme_de_chambre: 'Femme de chambre', maintenance: 'Maintenance',
  breakfast: 'Petit-déjeuner', comptabilite: 'Comptabilité', revenue_manager: 'Revenue Manager',
};

const ROLE_COLORS: Record<string, string> = {
  direction: 'bg-purple-100 text-purple-700', admin_hotel: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',
  reception: 'bg-blue-100 text-blue-700',
  gouvernante: 'bg-pink-100 text-pink-700', femme_de_chambre: 'bg-rose-100 text-rose-700',
  maintenance: 'bg-orange-100 text-orange-700', breakfast: 'bg-amber-100 text-amber-700',
  comptabilite: 'bg-emerald-100 text-emerald-700', revenue_manager: 'bg-teal-100 text-teal-700',
};

function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: users, error } = await db
        .from('users')
        .select('id, auth_id, hotel_id, email, full_name, role, is_active, last_login_at, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const { data: hotels } = await db.from('hotels').select('id, name');
      const hotelMap: Record<string, string> = {};
      (hotels ?? []).forEach((h: { id: string; name: string }) => { hotelMap[h.id] = h.name; });
      return (users ?? []).map((u: UserRow) => ({ ...u, hotel_name: hotelMap[u.hotel_id] }));
    },
    staleTime: 30_000,
  });
}

function useInvitations() {
  return useQuery<InviteRow[]>({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      const { data, error } = await db
        .from('user_invitations')
        .select('id, hotel_id, email, full_name, role, status, invited_at')
        .neq('status', 'ACCEPTED')
        .order('invited_at', { ascending: false });
      if (error) throw error;
      const { data: hotels } = await db.from('hotels').select('id, name');
      const hotelMap: Record<string, string> = {};
      (hotels ?? []).forEach((h: { id: string; name: string }) => { hotelMap[h.id] = h.name; });
      return (data ?? []).map((i: InviteRow) => ({ ...i, hotel_name: hotelMap[i.hotel_id] }));
    },
    staleTime: 30_000,
  });
}

function useHotelList() {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin-hotel-list'],
    queryFn: async () => {
      const { data } = await db.from('hotels').select('id, name').order('name');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

type Tab = 'users' | 'invitations';

export const AdminUsers: React.FC = () => {
  const qc = useQueryClient();
  const { data: users = [],   isLoading: loadUsers }  = useUsers();
  const { data: invites = [],  isLoading: loadInvites } = useInvitations();
  const { data: hotelList = [] } = useHotelList();

  const [tab, setTab]       = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [hotelFilter, setHotelFilter] = useState('');
  const [showInvite, setShowInvite]   = useState(false);
  const [invite, setInvite] = useState({ email: '', full_name: '', hotel_id: '', role: 'reception' });

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    const match = !q || u.email.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
    const hMatch = !hotelFilter || u.hotel_id === hotelFilter;
    return match && hMatch;
  });

  const filteredInvites = invites.filter(i => {
    const q = search.toLowerCase();
    const match = !q || i.email.toLowerCase().includes(q);
    const hMatch = !hotelFilter || i.hotel_id === hotelFilter;
    return match && hMatch;
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('users').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Statut mis à jour.'); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const inviteMut = useMutation({
    mutationFn: async (payload: typeof invite) => {
      const { error } = await db.from('user_invitations').insert({
        hotel_id: payload.hotel_id,
        email: payload.email,
        full_name: payload.full_name || null,
        role: payload.role,
        status: 'PENDING',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invitations'] });
      toast.success('Invitation envoyée.');
      setShowInvite(false);
      setInvite({ email: '', full_name: '', hotel_id: '', role: 'reception' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendInvite = () => {
    if (!invite.email.trim()) { toast.error('Email requis.'); return; }
    if (!invite.hotel_id)    { toast.error('Sélectionnez un hôtel.'); return; }
    inviteMut.mutate(invite);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} utilisateur{users.length > 1 ? 's' : ''} · {invites.length} invitation{invites.length > 1 ? 's' : ''} en attente</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[13px] font-bold hover:bg-[#7C3AED] transition-colors shadow-sm"
        >
          <Plus size={15} /> Inviter un utilisateur
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['users','invitations'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            {t === 'users' ? `Utilisateurs (${users.length})` : `Invitations (${invites.length})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Email, nom…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
        </div>
        <select
          value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
        >
          <option value="">Tous les hôtels</option>
          {hotelList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {/* Users table */}
      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Hôtel</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Dernière connexion</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loadUsers ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Chargement…</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Aucun utilisateur.</td></tr>
              ) : filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[12px] font-black text-[#8B5CF6]">
                        {(u.full_name || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-gray-900">{u.full_name || '—'}</div>
                        <div className="text-[11px] text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-600">
                    <span className="flex items-center gap-1"><Hotel size={11} className="text-gray-300" />{u.hotel_name ?? u.hotel_id.slice(0,8)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-500')}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('fr-FR') : 'Jamais'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {u.is_active
                      ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Actif</span>
                      : <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Désactivé</span>
                    }
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => toggleMut.mutate({ id: u.id, is_active: !u.is_active })}
                        className={cn('p-1.5 rounded-lg transition-colors', u.is_active ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50')}
                        title={u.is_active ? 'Désactiver' : 'Réactiver'}
                      >
                        {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invitations table */}
      {tab === 'invitations' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Hôtel</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loadInvites ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Chargement…</td></tr>
              ) : filteredInvites.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">Aucune invitation en attente.</td></tr>
              ) : filteredInvites.map(i => (
                <tr key={i.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-[13px] text-gray-900"><Mail size={13} className="text-gray-300" />{i.email}</div>
                    {i.full_name && <div className="text-[11px] text-gray-400 pl-5">{i.full_name}</div>}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-600">{i.hotel_name ?? i.hotel_id.slice(0,8)}</td>
                  <td className="px-4 py-3.5">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', ROLE_COLORS[i.role] ?? 'bg-gray-100 text-gray-500')}>{ROLE_LABELS[i.role] ?? i.role}</span>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">{new Date(i.invited_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3.5">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
                      i.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                      i.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-gray-100 text-gray-500'
                    )}>{i.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invite modal ─────────────────────────────────────────────────── */}
      {showInvite && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowInvite(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-[460px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-gray-900">Inviter un utilisateur</h2>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              <Label label="Email *"><FInput value={invite.email} onChange={v => setInvite(i => ({ ...i, email: v }))} placeholder="utilisateur@hotel.com" /></Label>
              <Label label="Nom complet"><FInput value={invite.full_name} onChange={v => setInvite(i => ({ ...i, full_name: v }))} placeholder="Prénom Nom" /></Label>
              <Label label="Hôtel *">
                <select value={invite.hotel_id} onChange={e => setInvite(i => ({ ...i, hotel_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  <option value="">Sélectionner un hôtel…</option>
                  {hotelList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Label>
              <Label label="Rôle *">
                <select value={invite.role} onChange={e => setInvite(i => ({ ...i, role: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </Label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
              <button
                onClick={sendInvite}
                disabled={inviteMut.isPending}
                className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]"
              >
                <Send size={13} />{inviteMut.isPending ? 'Envoi…' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Label: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><p className="text-[11px] font-bold text-gray-500 mb-1">{label}</p>{children}</div>
);

const FInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]" />
);
