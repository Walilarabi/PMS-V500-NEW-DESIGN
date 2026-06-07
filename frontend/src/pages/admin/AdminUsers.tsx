import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, Plus, UserX, UserCheck, Send, X, Mail, Hotel,
  Building2, Star, Trash2, Settings2, ChevronDown, Shield, Check,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ──────────────────────────────────────────────────────────────────

interface HotelAccess {
  hotel_id: string;
  hotel_name: string;
  role: string;
  is_default: boolean;
  app_ids: string[];
}

interface UserAccessRow {
  user_id: string;        // public.users.id (PK utilisé par les RPC)
  auth_id: string;
  email: string;
  full_name: string | null;
  global_role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  hotels: HotelAccess[];
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

interface PlatformApp {
  id: string;
  code: string;
  name: string;
  color: string | null;
  is_available: boolean;
  sort_order: number;
}

// ─── Référentiel rôles (enum admin_user_role) ────────────────────────────────

const ROLES = [
  'direction', 'admin_hotel', 'reception', 'comptabilite', 'revenue_manager',
  'gouvernante', 'femme_de_chambre', 'maintenance', 'breakfast',
] as const;

const ROLE_LABELS: Record<string, string> = {
  direction: 'Décideur', admin_hotel: 'Manager', reception: 'Réception',
  comptabilite: 'Comptabilité', revenue_manager: 'Revenue Manager',
  gouvernante: 'Gouvernante', femme_de_chambre: 'Femme de chambre',
  maintenance: 'Maintenance', breakfast: 'Petit-déjeuner',
};

const ROLE_COLORS: Record<string, string> = {
  direction: 'bg-purple-100 text-purple-700', admin_hotel: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',
  reception: 'bg-blue-100 text-blue-700',
  comptabilite: 'bg-emerald-100 text-emerald-700', revenue_manager: 'bg-teal-100 text-teal-700',
  gouvernante: 'bg-pink-100 text-pink-700', femme_de_chambre: 'bg-rose-100 text-rose-700',
  maintenance: 'bg-orange-100 text-orange-700', breakfast: 'bg-amber-100 text-amber-700',
};

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useUserAccess() {
  return useQuery<UserAccessRow[]>({
    queryKey: ['admin-user-access'],
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_list_user_access');
      if (error) throw error;
      return (data ?? []) as UserAccessRow[];
    },
    staleTime: 15_000,
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
  return useQuery<{ id: string; name: string; city: string | null }[]>({
    queryKey: ['admin-hotel-list'],
    queryFn: async () => {
      const { data } = await db.from('hotels').select('id, name, city').eq('active', true).order('name');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function usePlatformApps() {
  return useQuery<PlatformApp[]>({
    queryKey: ['admin-platform-apps'],
    queryFn: async () => {
      const { data } = await db
        .from('platform_apps')
        .select('id, code, name, color, is_available, sort_order')
        .order('sort_order');
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Composant principal ──────────────────────────────────────────────────────

type Tab = 'users' | 'invitations';

export const AdminUsers: React.FC = () => {
  const { data: users = [], isLoading: loadUsers } = useUserAccess();
  const { data: invites = [], isLoading: loadInvites } = useInvitations();
  const { data: hotelList = [] } = useHotelList();
  const { data: apps = [] } = usePlatformApps();

  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [hotelFilter, setHotelFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [managedId, setManagedId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => users.filter((u) => {
    const q = search.toLowerCase();
    const match = !q || u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q);
    const hMatch = !hotelFilter || u.hotels.some((h) => h.hotel_id === hotelFilter);
    return match && hMatch;
  }), [users, search, hotelFilter]);

  const filteredInvites = invites.filter((i) => {
    const q = search.toLowerCase();
    const match = !q || i.email.toLowerCase().includes(q);
    const hMatch = !hotelFilter || i.hotel_id === hotelFilter;
    return match && hMatch;
  });

  const managed = users.find((u) => u.user_id === managedId) ?? null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Utilisateurs &amp; accès</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {users.length} utilisateur{users.length > 1 ? 's' : ''} · {invites.length} invitation{invites.length > 1 ? 's' : ''} en attente
          </p>
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
        {(['users', 'invitations'] as Tab[]).map((t) => (
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Email, nom…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
        </div>
        <select
          value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
        >
          <option value="">Tous les hôtels</option>
          {hotelList.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {/* Users table */}
      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Hôtels autorisés</th>
                <th className="px-4 py-3">Rôle (défaut)</th>
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
              ) : filteredUsers.map((u) => {
                const def = u.hotels.find((h) => h.is_default) ?? u.hotels[0];
                return (
                  <tr key={u.user_id} className="hover:bg-gray-50/60">
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
                    <td className="px-4 py-3.5">
                      {u.hotels.length === 0 ? (
                        <span className="text-[11px] text-gray-300 italic">Aucun hôtel</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {u.hotels.slice(0, 3).map((h) => (
                            <span key={h.hotel_id} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {h.is_default && <Star size={9} className="text-amber-400 fill-amber-400" />}
                              {h.hotel_name}
                            </span>
                          ))}
                          {u.hotels.length > 3 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                              +{u.hotels.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {def ? (
                        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', ROLE_COLORS[def.role] ?? 'bg-gray-100 text-gray-500')}>
                          {ROLE_LABELS[def.role] ?? def.role}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-gray-500">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('fr-FR') : 'Jamais'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {u.is_active
                        ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Actif</span>
                        : <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Suspendu</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setManagedId(u.user_id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 transition-colors"
                          title="Gérer les accès"
                        >
                          <Settings2 size={13} /> Gérer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
              ) : filteredInvites.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-[13px] text-gray-900"><Mail size={13} className="text-gray-300" />{i.email}</div>
                    {i.full_name && <div className="text-[11px] text-gray-400 pl-5">{i.full_name}</div>}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-600">{i.hotel_name ?? i.hotel_id.slice(0, 8)}</td>
                  <td className="px-4 py-3.5">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', ROLE_COLORS[i.role] ?? 'bg-gray-100 text-gray-500')}>{ROLE_LABELS[i.role] ?? i.role}</span>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">{new Date(i.invited_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3.5">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
                      i.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                      i.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-gray-100 text-gray-500')}>{i.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && <InviteModal hotels={hotelList} onClose={() => setShowInvite(false)} />}
      {managed && (
        <AccessDrawer
          user={managed}
          hotels={hotelList}
          apps={apps}
          onClose={() => setManagedId(null)}
        />
      )}
    </div>
  );
};

// ─── Drawer : gestion fine des accès d'un utilisateur ─────────────────────────

const AccessDrawer: React.FC<{
  user: UserAccessRow;
  hotels: { id: string; name: string; city: string | null }[];
  apps: PlatformApp[];
  onClose: () => void;
}> = ({ user, hotels, apps, onClose }) => {
  const qc = useQueryClient();
  const [addHotelId, setAddHotelId] = useState('');
  const [addRole, setAddRole] = useState<string>('reception');
  const [expanded, setExpanded] = useState<string | null>(user.hotels.find((h) => h.is_default)?.hotel_id ?? null);

  const handlers = {
    onSuccess: (msg: string) => () => { qc.invalidateQueries({ queryKey: ['admin-user-access'] }); toast.success(msg); },
    onError: (e: Error) => toast.error(e.message),
  };

  const grantMut = useMutation({
    mutationFn: async ({ hotel_id, role }: { hotel_id: string; role: string }) => {
      const { error } = await db.rpc('admin_grant_hotel', { p_user_id: user.user_id, p_hotel_id: hotel_id, p_role: role });
      if (error) throw error;
    },
    onSuccess: handlers.onSuccess('Hôtel ajouté.'), onError: handlers.onError,
  });

  const revokeMut = useMutation({
    mutationFn: async (hotel_id: string) => {
      const { error } = await db.rpc('admin_revoke_hotel', { p_user_id: user.user_id, p_hotel_id: hotel_id });
      if (error) throw error;
    },
    onSuccess: handlers.onSuccess('Hôtel retiré.'), onError: handlers.onError,
  });

  const roleMut = useMutation({
    mutationFn: async ({ hotel_id, role }: { hotel_id: string; role: string }) => {
      const { error } = await db.rpc('admin_set_hotel_role', { p_user_id: user.user_id, p_hotel_id: hotel_id, p_role: role });
      if (error) throw error;
    },
    onSuccess: handlers.onSuccess('Rôle mis à jour.'), onError: handlers.onError,
  });

  const defaultMut = useMutation({
    mutationFn: async (hotel_id: string) => {
      const { error } = await db.rpc('admin_set_default_hotel', { p_user_id: user.user_id, p_hotel_id: hotel_id });
      if (error) throw error;
    },
    onSuccess: handlers.onSuccess('Hôtel par défaut défini.'), onError: handlers.onError,
  });

  const appMut = useMutation({
    mutationFn: async ({ hotel_id, app_id, enabled }: { hotel_id: string; app_id: string; enabled: boolean }) => {
      const { error } = await db.rpc('admin_set_app_access', { p_user_id: user.user_id, p_hotel_id: hotel_id, p_app_id: app_id, p_enabled: enabled });
      if (error) throw error;
    },
    onSuccess: handlers.onSuccess('Accès application mis à jour.'), onError: handlers.onError,
  });

  const statusMut = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await db.rpc('admin_set_user_status', { p_user_id: user.user_id, p_active: active });
      if (error) throw error;
    },
    onSuccess: handlers.onSuccess('Statut mis à jour.'), onError: handlers.onError,
  });

  const assignedIds = new Set(user.hotels.map((h) => h.hotel_id));
  const available = hotels.filter((h) => !assignedIds.has(h.id));

  const addHotel = () => {
    if (!addHotelId) { toast.error('Sélectionnez un hôtel.'); return; }
    grantMut.mutate({ hotel_id: addHotelId, role: addRole });
    setAddHotelId('');
    setAddRole('reception');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[520px] max-w-[92vw] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[15px] font-black text-[#8B5CF6] shrink-0">
              {(user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-black text-gray-900 truncate">{user.full_name || user.email}</div>
              <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Meta + statut */}
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span>Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}</span>
            <span>·</span>
            <span>{user.last_login_at ? `Vu le ${new Date(user.last_login_at).toLocaleDateString('fr-FR')}` : 'Jamais connecté'}</span>
          </div>
          <button
            onClick={() => statusMut.mutate(!user.is_active)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
              user.is_active ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100')}
          >
            {user.is_active ? <><UserX size={13} /> Suspendre</> : <><UserCheck size={13} /> Réactiver</>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!user.is_active && (
            <div className="rounded-xl bg-amber-50/60 ring-1 ring-amber-100 px-3 py-2 text-[11.5px] text-amber-700">
              Compte suspendu : l'utilisateur ne peut plus se connecter, quels que soient ses accès.
            </div>
          )}

          {/* Hôtels autorisés */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Hôtels autorisés ({user.hotels.length})
            </p>

            {user.hotels.length === 0 && (
              <div className="text-[12px] text-gray-400 italic mb-3 px-3 py-4 bg-gray-50 rounded-xl text-center">
                Aucun hôtel assigné — l'utilisateur n'a accès à rien tant qu'aucun hôtel n'est ajouté.
              </div>
            )}

            <div className="space-y-2.5">
              {user.hotels.map((h) => {
                const isOpen = expanded === h.hotel_id;
                return (
                  <div key={h.hotel_id} className="rounded-xl border border-gray-150 bg-white overflow-hidden ring-1 ring-gray-100">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <Building2 size={14} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-gray-900 truncate">{h.hotel_name}</span>
                          {h.is_default && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              <Star size={8} className="fill-amber-400 text-amber-400" /> Défaut
                            </span>
                          )}
                        </div>
                      </div>

                      <select
                        value={h.role}
                        onChange={(e) => roleMut.mutate({ hotel_id: h.hotel_id, role: e.target.value })}
                        className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 text-gray-700"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>

                      {!h.is_default && (
                        <button
                          onClick={() => defaultMut.mutate(h.hotel_id)}
                          title="Définir par défaut"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        >
                          <Star size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(isOpen ? null : h.hotel_id)}
                        title="Applications"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors"
                      >
                        <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Retirer l'accès à ${h.hotel_name} ?`)) revokeMut.mutate(h.hotel_id); }}
                        title="Retirer l'hôtel"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-50 bg-gray-50/40">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 mt-1.5">
                          Applications autorisées
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {apps.map((app) => {
                            const enabled = h.app_ids.includes(app.id);
                            const disabled = !app.is_available;
                            return (
                              <button
                                key={app.id}
                                disabled={disabled}
                                onClick={() => appMut.mutate({ hotel_id: h.hotel_id, app_id: app.id, enabled: !enabled })}
                                className={cn(
                                  'flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[11.5px] font-semibold transition-colors text-left',
                                  disabled
                                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                    : enabled
                                      ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] ring-1 ring-[#8B5CF6]/20'
                                      : 'bg-white text-gray-500 ring-1 ring-gray-150 hover:ring-gray-300',
                                )}
                                title={disabled ? 'Application bientôt disponible' : undefined}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: app.color ?? '#9CA3AF' }} />
                                  {app.name.replace(/^Flowtym /, '')}
                                </span>
                                {disabled
                                  ? <span className="text-[9px] font-bold text-gray-300">Bientôt</span>
                                  : enabled
                                    ? <Check size={13} className="shrink-0" />
                                    : <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ajouter un hôtel */}
            {available.length > 0 && (
              <div className="mt-3 flex items-end gap-2 p-3 rounded-xl bg-gray-50 ring-1 ring-gray-100">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-500 mb-1">Ajouter un hôtel</p>
                  <select
                    value={addHotelId}
                    onChange={(e) => setAddHotelId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 bg-white"
                  >
                    <option value="">Sélectionner…</option>
                    {available.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 mb-1">Rôle</p>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 bg-white"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <button
                  onClick={addHotel}
                  disabled={grantMut.isPending}
                  className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-[12px] font-bold hover:bg-[#7C3AED] disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Plus size={13} /> Ajouter
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-blue-50/50 ring-1 ring-blue-100 px-3 py-2.5 text-[11.5px] text-blue-700 flex gap-2">
            <Shield size={14} className="shrink-0 mt-0.5" />
            <span>
              Les droits sont vérifiés côté serveur (RLS + RPC). Un utilisateur ne voit, après connexion,
              que ses hôtels autorisés et, pour chaque hôtel, que les applications activées ici.
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Modal : invitation ────────────────────────────────────────────────────────

const InviteModal: React.FC<{
  hotels: { id: string; name: string }[];
  onClose: () => void;
}> = ({ hotels, onClose }) => {
  const qc = useQueryClient();
  const [invite, setInvite] = useState({ email: '', full_name: '', hotel_id: '', role: 'reception' });

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
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = () => {
    if (!invite.email.trim()) { toast.error('Email requis.'); return; }
    if (!invite.hotel_id) { toast.error('Sélectionnez un hôtel.'); return; }
    inviteMut.mutate(invite);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-[460px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-gray-900">Inviter un utilisateur</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <p className="text-[11.5px] text-gray-400 mb-4 -mt-2">
          Un email d'invitation est envoyé. À la création du compte, vous pourrez lui ajouter d'autres hôtels et applications via « Gérer ».
        </p>
        <div className="space-y-3">
          <Label label="Email *"><FInput value={invite.email} onChange={(v) => setInvite((i) => ({ ...i, email: v }))} placeholder="utilisateur@hotel.com" /></Label>
          <Label label="Nom complet"><FInput value={invite.full_name} onChange={(v) => setInvite((i) => ({ ...i, full_name: v }))} placeholder="Prénom Nom" /></Label>
          <Label label="Hôtel initial *">
            <select value={invite.hotel_id} onChange={(e) => setInvite((i) => ({ ...i, hotel_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
              <option value="">Sélectionner un hôtel…</option>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Label>
          <Label label="Rôle *">
            <select value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
          <button
            onClick={send}
            disabled={inviteMut.isPending}
            className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]"
          >
            <Send size={13} />{inviteMut.isPending ? 'Envoi…' : "Envoyer l'invitation"}
          </button>
        </div>
      </div>
    </>
  );
};

const Label: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><p className="text-[11px] font-bold text-gray-500 mb-1">{label}</p>{children}</div>
);

const FInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]" />
);
