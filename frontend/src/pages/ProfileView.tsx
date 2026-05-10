/**
 * FLOWTYM — Self profile view (any authenticated user).
 *
 * Allows the current user to update their display name and password.
 * Email and role are read-only here (changeable only by direction in UsersView).
 */
import React, { useEffect, useState } from 'react';
import { Save, Lock, User as UserIcon, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';

import { useToast } from '@/src/hooks/use-toast';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { useUsers, useUpdateSelfProfile, useUpdateSelfPassword } from '@/src/domains/users/hooks';
import { USER_ROLE_LABEL } from '@/src/domains/users/repository';

const ProfileView: React.FC = () => {
  const { session } = useAuth();
  const teamQ = useUsers();
  const me = (teamQ.data ?? []).find((u) => u.auth_id && session && u.email === session.email)
         ?? (teamQ.data ?? []).find((u) => u.id === session?.userId)
         ?? null;

  const updateProfile = useUpdateSelfProfile();
  const updatePwd = useUpdateSelfPassword();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSavedBadge, setShowSavedBadge] = useState(false);

  useEffect(() => {
    setFullName(me?.full_name ?? session?.fullName ?? '');
  }, [me?.full_name, session?.fullName]);

  const onSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ full_name: fullName.trim() || null });
      toast({ title: 'Profil mis à jour', variant: 'success' });
      setShowSavedBadge(true);
      setTimeout(() => setShowSavedBadge(false), 2500);
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const onChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: 'Mot de passe trop court', description: 'Minimum 8 caractères.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Confirmation incorrecte', description: 'Les deux mots de passe ne correspondent pas.', variant: 'destructive' });
      return;
    }
    try {
      await updatePwd.mutateAsync(newPassword);
      toast({ title: 'Mot de passe mis à jour', description: 'Votre nouveau mot de passe est actif immédiatement.', variant: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="profile-page">
      <main className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <header>
          <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">Configuration · Mon compte</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="profile-title">Mon profil</h1>
          <p className="text-gray-500 text-sm mt-1">Modifiez vos informations personnelles et votre mot de passe.</p>
        </header>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5" data-testid="profile-card-identity">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><UserIcon size={20} /></div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Informations personnelles</h2>
                <p className="text-xs text-gray-500">Modifiables à tout moment.</p>
              </div>
            </div>
            {showSavedBadge && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1" data-testid="profile-saved-badge">
                <CheckCircle2 size={12} /> Enregistré
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                data-testid="profile-fullname-input"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Email (non modifiable)</label>
              <div className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
                <Mail size={14} className="text-gray-400" />
                <span data-testid="profile-email-display">{session?.email ?? '—'}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Rôle</label>
              <div className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
                <ShieldCheck size={14} className="text-gray-400" />
                <span data-testid="profile-role-display">{me?.role ? (USER_ROLE_LABEL[me.role] ?? me.role) : (session?.role ?? '—')}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Statut</label>
              <div className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${me?.is_active === false ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                <span data-testid="profile-active-display">{me?.is_active === false ? 'Désactivé' : 'Actif'}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onSaveProfile}
              disabled={updateProfile.isPending || (fullName === (me?.full_name ?? ''))}
              data-testid="profile-save-btn"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold"
            >
              <Save size={14} /> {updateProfile.isPending ? 'Enregistrement…' : 'Enregistrer le profil'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5" data-testid="profile-card-password">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Lock size={20} /></div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Mot de passe</h2>
              <p className="text-xs text-gray-500">Au moins 8 caractères. La mise à jour est immédiate.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                data-testid="profile-newpwd-input"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Confirmer</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                data-testid="profile-confirmpwd-input"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={onChangePassword}
              disabled={updatePwd.isPending || !newPassword || !confirmPassword}
              data-testid="profile-pwd-save-btn"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold"
            >
              <Lock size={14} /> {updatePwd.isPending ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProfileView;
