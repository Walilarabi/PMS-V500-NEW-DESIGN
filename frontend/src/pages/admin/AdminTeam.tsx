import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Plus, X, Save, UserX, UserCheck, Crown, Headphones, CreditCard,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AdminMember {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLES = ['super_admin', 'billing_admin', 'support_agent'] as const;
type Role = typeof ROLES[number];

const ROLE_META: Record<Role, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  super_admin:   { label: 'Super Admin',   color: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',  icon: Crown,      desc: 'Accès complet à toutes les fonctionnalités' },
  billing_admin: { label: 'Billing Admin', color: 'bg-emerald-50 text-emerald-600',   icon: CreditCard, desc: 'Abonnements, facturation et contrats' },
  support_agent: { label: 'Support',       color: 'bg-blue-50 text-blue-600',          icon: Headphones, desc: 'Support, tickets et mode impersonation' },
};

function useTeam() {
  return useQuery<AdminMember[]>({
    queryKey: ['admin-team'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_admins')
        .select('id, email, role, is_active, created_at')
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export const AdminTeam: React.FC = () => {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useTeam();
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'support_agent' as Role });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('platform_admins').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-team'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changRoleMut = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await db.from('platform_admins').update({ role }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-team'] }); toast.success('Rôle mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteMut = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const existing = members.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (existing) throw new Error('Cet email est déjà membre de l\'équipe.');
      // L'insert direct échouait : platform_admins.auth_id est NOT NULL et n'est
      // connu qu'après création/lookup du compte Auth. On délègue à l'edge function
      // service-role `invite-platform-admin` (lookup/invite → auth_id → upsert).
      const { data, error } = await supabase.functions.invoke('invite-platform-admin', {
        body: { email, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-team'] });
      toast.success('Membre ajouté à l\'équipe.');
      setShowInvite(false);
      setForm({ email: '', role: 'support_agent' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeCount = members.filter(m => m.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Équipe Flowtym</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {members.length} admin{members.length > 1 ? 's' : ''} · <span className="text-emerald-600 font-semibold">{activeCount} actifs</span>
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[13px] font-bold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/30">
          <Plus size={15} /> Ajouter un membre
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-3">
        {ROLES.map(r => {
          const meta = ROLE_META[r];
          const count = members.filter(m => m.role === r && m.is_active).length;
          return (
            <div key={r} className={cn('flex items-center gap-3 p-3 rounded-xl border', meta.color.replace('text-', 'border-').replace('bg-', 'bg-') + '/40')}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', meta.color)}>
                <meta.icon size={14} />
              </div>
              <div>
                <div className="text-[12px] font-black text-gray-900">{meta.label}</div>
                <div className="text-[10px] text-gray-400">{count} actif{count > 1 ? 's' : ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Ajouté le</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Chargement…</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">Aucun membre.</td></tr>
            ) : members.map(m => {
              const meta = ROLE_META[m.role as Role] ?? ROLE_META.support_agent;
              return (
                <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black shrink-0', meta.color)}>
                        {m.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-[13px] font-semibold text-gray-900">{m.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={m.role}
                      onChange={e => changRoleMut.mutate({ id: m.id, role: e.target.value })}
                      className={cn('text-[11px] font-bold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer', meta.color)}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">
                    {new Date(m.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {m.is_active
                      ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Actif</span>
                      : <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Désactivé</span>
                    }
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => toggleMut.mutate({ id: m.id, is_active: !m.is_active })}
                      disabled={toggleMut.isPending}
                      className={cn('p-1.5 rounded-lg transition-colors', m.is_active
                        ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                        : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50')}
                      title={m.is_active ? 'Désactiver' : 'Réactiver'}>
                      {m.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Permission reference */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50 bg-gray-50">
          <Shield size={14} className="text-[#8B5CF6]" />
          <h3 className="text-[12px] font-black uppercase tracking-widest text-gray-600">Matrice des permissions</h3>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-gray-400 font-bold">
                <th className="text-left py-2 pr-4 font-black">Module</th>
                {ROLES.map(r => <th key={r} className={cn('text-center py-2 px-3 rounded-t-lg', ROLE_META[r].color)}>{ROLE_META[r].label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { module: 'Tableau de bord', super_admin: true,  billing_admin: true,  support_agent: true },
                { module: 'Hôtels',          super_admin: true,  billing_admin: false, support_agent: false },
                { module: 'Utilisateurs',    super_admin: true,  billing_admin: false, support_agent: false },
                { module: 'Abonnements',     super_admin: true,  billing_admin: true,  support_agent: false },
                { module: 'Facturation',     super_admin: true,  billing_admin: true,  support_agent: false },
                { module: 'Contrats',        super_admin: true,  billing_admin: true,  support_agent: false },
                { module: 'Mode Support',    super_admin: true,  billing_admin: false, support_agent: true },
                { module: 'Tickets',         super_admin: true,  billing_admin: false, support_agent: true },
                { module: 'Articles d\'aide',super_admin: true,  billing_admin: false, support_agent: true },
                { module: 'Logs',            super_admin: true,  billing_admin: false, support_agent: false },
                { module: 'Paramètres',      super_admin: true,  billing_admin: false, support_agent: false },
                { module: 'Équipe',          super_admin: true,  billing_admin: false, support_agent: false },
              ].map(row => (
                <tr key={row.module} className="hover:bg-gray-50/50">
                  <td className="py-2.5 pr-4 text-gray-600 font-semibold">{row.module}</td>
                  {ROLES.map(r => (
                    <td key={r} className="text-center py-2.5 px-3">
                      {row[r]
                        ? <span className="text-emerald-500 font-black">✓</span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowInvite(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-[440px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-gray-900">Ajouter un membre</h2>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Email *</label>
                <input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@flowtym.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[13px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-2">Rôle *</label>
                <div className="space-y-2">
                  {ROLES.map(r => {
                    const meta = ROLE_META[r];
                    const selected = form.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, role: r }))}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                          selected ? 'border-[#8B5CF6] bg-[#8B5CF6]/5' : 'border-gray-200 hover:border-gray-300'
                        )}>
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', meta.color)}>
                          <meta.icon size={13} />
                        </div>
                        <div>
                          <div className="text-[12px] font-black text-gray-900">{meta.label}</div>
                          <div className="text-[10px] text-gray-400">{meta.desc}</div>
                        </div>
                        {selected && <div className="ml-auto w-4 h-4 rounded-full bg-[#8B5CF6] flex items-center justify-center"><span className="text-white text-[9px] font-black">✓</span></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
              <button
                onClick={() => {
                  if (!form.email.trim()) { toast.error('Email requis.'); return; }
                  inviteMut.mutate(form);
                }}
                disabled={inviteMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#7C3AED]">
                <Save size={13} />{inviteMut.isPending ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
