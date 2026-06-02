/**
 * FLOWTYM — Users / Direction Module.
 *
 * Lists collaborators (Supabase `public.users`) + pending invitations.
 * Direction can : invite by email, change role, deactivate / reactivate,
 * revoke pending invitations.
 *
 * NOTE: invitation email dispatch is currently SIMULATED (persisted in
 * `user_invitations`). Resend will be wired in Phase E once the API key
 * is provided.
 */
import React, { useMemo, useState } from 'react';
import {
  Users, Mail, ShieldCheck, RefreshCw, UserPlus, Power, X, Copy, CheckCircle2,
  Crown, Shield, Hammer, BookOpen, Briefcase, Wrench, Coffee, TrendingUp,
} from 'lucide-react';

import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import {
  useUsers, useInvitations, useCreateInvitation, useRevokeInvitation,
  useSetUserActive, useSetUserRole,
} from '@/src/domains/users/hooks';
import type { AppUserRow, InvitationRow, AppUserRole } from '@/src/domains/users/repository';
import { ASSIGNABLE_ROLES } from '@/src/domains/users/repository';

// R4 : aligné sur l'enum DB admin_user_role (rôles fantômes supprimés).
const ROLE_LABEL: Record<string, string> = {
  direction: 'Direction',
  admin_hotel: 'Administrateur hôtel',
  reception: 'Réception',
  gouvernante: 'Gouvernante',
  femme_de_chambre: 'Femme de chambre',
  maintenance: 'Maintenance',
  breakfast: 'Petit-déjeuner',
  comptabilite: 'Comptabilité',
  revenue_manager: 'Revenue Manager',
};

const ROLE_TONE: Record<string, string> = {
  direction: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  admin_hotel: 'bg-rose-50 text-rose-700 border-rose-100',
  reception: 'bg-sky-50 text-sky-700 border-sky-100',
  gouvernante: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  femme_de_chambre: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-100',
  breakfast: 'bg-orange-50 text-orange-700 border-orange-100',
  comptabilite: 'bg-amber-50 text-amber-700 border-amber-100',
  revenue_manager: 'bg-pink-50 text-pink-700 border-pink-100',
};

const ROLE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  direction: Crown,
  admin_hotel: ShieldCheck,
  reception: BookOpen,
  gouvernante: Hammer,
  femme_de_chambre: Hammer,
  maintenance: Wrench,
  breakfast: Coffee,
  comptabilite: Briefcase,
  revenue_manager: TrendingUp,
};

export const UsersView: React.FC = () => {
  const hotelQ = useActiveHotel();
  const usersQ = useUsers();
  const invitationsQ = useInvitations();
  const setActive = useSetUserActive();
  const setRole = useSetUserRole();
  const revoke = useRevokeInvitation();
  const { toast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);

  const users = usersQ.data ?? [];
  const invitations = invitationsQ.data ?? [];

  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
    pending: invitations.filter((i) => i.status === 'PENDING').length,
  }), [users, invitations]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="users-dashboard">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full space-y-5">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">Direction · Collaborateurs</p>
            <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="users-title">
              Gestion des utilisateurs{' '}
              <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? '—'}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Inviter / désactiver / promouvoir vos collaborateurs · journal des connexions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void usersQ.refetch(); void invitationsQ.refetch(); }}
              data-testid="users-refresh"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <RefreshCw size={13} className={usersQ.isFetching ? 'animate-spin' : ''} /> Actualiser
            </button>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              data-testid="users-invite-open"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <UserPlus size={13} /> Inviter un collaborateur
            </button>
          </div>
        </header>

        {(usersQ.isError || invitationsQ.isError) && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            Erreur de chargement des utilisateurs — vérifiez votre connexion et réessayez.
          </div>
        )}

        {usersQ.isLoading && (
          <div className="rounded-lg bg-white border border-gray-100 px-4 py-6 text-center text-[12px] text-gray-400">
            Chargement des collaborateurs…
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi testid="users-kpi-total" label="Comptes" value={String(counts.total)} hint="Total" tone="indigo" icon={Users} />
          <Kpi testid="users-kpi-active" label="Actifs" value={String(counts.active)} hint="Connectables" tone="emerald" icon={CheckCircle2} />
          <Kpi testid="users-kpi-inactive" label="Inactifs" value={String(counts.inactive)} hint="Désactivés" tone="rose" icon={Power} />
          <Kpi testid="users-kpi-pending" label="Invitations en attente" value={String(counts.pending)} hint="À accepter" tone="amber" icon={Mail} />
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="users-table">
          <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Collaborateurs</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">{users.length}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/70">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 font-semibold">Rôle</th>
                  <th className="text-left px-4 py-3 font-semibold">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold">Dernière connexion</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">Aucun collaborateur — invite ton équipe.</td></tr>
                ) : users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onToggleActive={() => setActive.mutate({ id: u.id, isActive: !u.is_active }, {
                      onSuccess: () => toast({ title: u.is_active ? 'Collaborateur désactivé' : 'Collaborateur réactivé', variant: 'success' }),
                      onError: (e) => toast({ title: 'Échec', description: e.message, variant: 'destructive' }),
                    })}
                    onChangeRole={(role) => setRole.mutate({ id: u.id, role }, {
                      onSuccess: () => toast({ title: 'Rôle mis à jour', description: ROLE_LABEL[role] ?? role, variant: 'success' }),
                      onError: (e) => toast({ title: 'Échec', description: e.message, variant: 'destructive' }),
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="invitations-table">
          <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Invitations</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              {counts.pending} en attente
            </span>
          </header>
          {invitations.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">Aucune invitation envoyée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/70">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 font-semibold">Nom</th>
                    <th className="text-left px-4 py-3 font-semibold">Rôle</th>
                    <th className="text-left px-4 py-3 font-semibold">Statut</th>
                    <th className="text-left px-4 py-3 font-semibold">Envoyée</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((i) => (
                    <InvitationRowComp
                      key={i.id}
                      inv={i}
                      onRevoke={() => revoke.mutate(i.id, {
                        onSuccess: () => toast({ title: 'Invitation révoquée', variant: 'success' }),
                        onError: (e) => toast({ title: 'Échec', description: e.message, variant: 'destructive' }),
                      })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <InviteModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
};

/* ============================== KPI ============================ */

interface KpiProps { testid: string; label: string; value: string; hint: string; tone: 'indigo' | 'emerald' | 'rose' | 'amber'; icon: React.ComponentType<{ size?: number; className?: string }> }
const TONE_BG: Record<KpiProps['tone'], string> = {
  indigo: 'bg-indigo-50 text-indigo-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
  amber: 'bg-amber-50 text-amber-700',
};
const Kpi: React.FC<KpiProps> = ({ testid, label, value, hint, tone, icon: Icon }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex items-center gap-3" data-testid={testid}>
    <span className={`grid place-items-center w-9 h-9 rounded-xl ${TONE_BG[tone]} shrink-0`}>
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-base font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[9px] text-gray-400 truncate">{hint}</p>
    </div>
  </div>
);

/* ============================== User Row ====================== */

const UserRow: React.FC<{
  user: AppUserRow;
  onToggleActive: () => void;
  onChangeRole: (role: AppUserRole) => void;
}> = ({ user, onToggleActive, onChangeRole }) => {
  const RoleIcon = ROLE_ICON[user.role] ?? Users;
  return (
    <tr className="border-t border-gray-100 hover:bg-violet-50/20" data-testid={`users-row-${user.id}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">
            {(user.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">{user.full_name ?? '—'}</p>
            <p className="text-[10px] text-gray-400">{user.role === 'direction' ? '👑 ' : ''}{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[200px]">{user.email ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="inline-flex items-center gap-1.5">
          <span className={`grid place-items-center w-5 h-5 rounded ${ROLE_TONE[user.role]?.split(' ')[0] ?? 'bg-gray-100'} ${ROLE_TONE[user.role]?.split(' ')[1] ?? 'text-gray-600'}`}>
            <RoleIcon size={11} />
          </span>
          <select
            value={user.role}
            onChange={(e) => onChangeRole(e.target.value as AppUserRole)}
            data-testid={`users-role-${user.id}`}
            className={`bg-transparent text-[11px] font-bold cursor-pointer ${ROLE_TONE[user.role]?.split(' ')[1] ?? 'text-gray-700'}`}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          user.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
        }`}>
          {user.is_active ? 'Actif' : 'Désactivé'}
        </span>
      </td>
      <td className="px-4 py-3 text-[11px] text-gray-500">
        {user.last_login_at ? new Date(user.last_login_at).toLocaleString('fr-FR') : <em className="text-gray-300">jamais</em>}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onToggleActive}
          data-testid={`users-toggle-${user.id}`}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            user.is_active
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
          }`}
        >
          <Power size={11} /> {user.is_active ? 'Désactiver' : 'Réactiver'}
        </button>
      </td>
    </tr>
  );
};

/* ============================== Invitation Row =============== */

const InvitationRowComp: React.FC<{ inv: InvitationRow; onRevoke: () => void }> = ({ inv, onRevoke }) => {
  const { toast } = useToast();
  const link = `${window.location.origin}/accept-invitation?token=${inv.token}`;
  return (
    <tr className="border-t border-gray-100" data-testid={`inv-row-${inv.id}`}>
      <td className="px-4 py-3 text-xs font-mono text-gray-700">{inv.email}</td>
      <td className="px-4 py-3 text-xs text-gray-600">{inv.full_name ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_TONE[inv.role] ?? 'bg-gray-100 text-gray-600'}`}>
          {ROLE_LABEL[inv.role] ?? inv.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          inv.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100'
          : inv.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-gray-100 text-gray-500 border-gray-200'
        }`}>
          {inv.status === 'PENDING' ? 'En attente' : inv.status === 'ACCEPTED' ? 'Acceptée' : 'Révoquée'}
        </span>
      </td>
      <td className="px-4 py-3 text-[11px] text-gray-500">{new Date(inv.invited_at).toLocaleString('fr-FR')}</td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              toast({ title: 'Lien copié', description: 'Colle-le dans un email à ton collaborateur.', variant: 'success' });
            }}
            data-testid={`inv-copy-${inv.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            <Copy size={11} /> Copier lien
          </button>
          {inv.status === 'PENDING' && (
            <button
              type="button"
              onClick={onRevoke}
              data-testid={`inv-revoke-${inv.id}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700"
            >
              <X size={11} /> Révoquer
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

/* ============================== Invite Modal ================ */

const InviteModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const create = useCreateInvitation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppUserRole>('reception');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({ title: 'Email requis', variant: 'destructive' });
      return;
    }
    try {
      await create.mutateAsync({ email, fullName, role });
      toast({
        title: 'Invitation créée',
        description: 'Le lien d\u2019invitation est dans le tableau — copie-le et envoie-le par email.',
        variant: 'success',
      });
      setEmail(''); setFullName(''); setRole('reception');
      onClose();
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" data-testid="users-invite-modal" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">Direction</p>
            <h3 className="text-lg font-bold text-gray-900 mt-1">Inviter un collaborateur</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </header>
        <div className="space-y-3">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="users-invite-email"
              placeholder="prenom.nom@exemple.com"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Nom complet">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              data-testid="users-invite-name"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Rôle">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppUserRole)}
              data-testid="users-invite-role"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-[10px] text-gray-400">
          Le lien d'invitation est généré côté serveur. L'envoi email réel sera activé quand la clé Resend sera ajoutée.
        </p>
        <footer className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">Annuler</button>
          <button
            type="button"
            data-testid="users-invite-submit"
            onClick={handleSubmit}
            disabled={create.isPending}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 inline-flex items-center gap-1"
          >
            <UserPlus size={14} /> {create.isPending ? 'Envoi…' : 'Inviter'}
          </button>
        </footer>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export default UsersView;
