/**
 * FLOWTYM — Paramètres · Utilisateurs & droits.
 *
 * Vraie page CRUD branchée sur useConfigStore.updateUsers.
 * Gestion des rôles (admin, receptionist, housekeeping, manager),
 * statut actif/inactif, simulation 2FA (toggle local persisté en
 * preview, à câbler au backend en Phase 2).
 *
 * Toute modification alimente le moteur de diagnostic :
 *   • driver "Au moins un administrateur actif" (score Conformité)
 *   • driver "Administrateurs actifs" (score Sécurité)
 *   • alertes "admin_no_2fa" / "no_admin"
 */
import React, { useState } from 'react';
import {
  KeyRound, Plus, Trash2, ShieldCheck, ShieldOff, CheckCircle2, AlertCircle,
  Mail, UserCheck, Pencil, Save, X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { usePermission, PermissionDeniedBanner, RequirePermission } from '@/src/services/settings/permissionsService';

type UserRole = 'admin' | 'receptionist' | 'housekeeping' | 'manager';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  receptionist: 'Réception',
  housekeeping: 'Housekeeping',
};

const ROLE_TONE: Record<UserRole, string> = {
  admin: 'bg-rose-50 text-rose-700 ring-rose-200',
  manager: 'bg-violet-50 text-violet-700 ring-violet-200',
  receptionist: 'bg-sky-50 text-sky-700 ring-sky-200',
  housekeeping: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

// 2FA toggle simulé — persisté en localStorage en attendant le backend
const TFA_KEY = 'flowtym.users.2fa';
function loadTfaMap(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(TFA_KEY) ?? '{}'); } catch { return {}; }
}
function saveTfaMap(m: Record<string, boolean>) {
  try { localStorage.setItem(TFA_KEY, JSON.stringify(m)); } catch {/* quota */}
}

export const UsersPage: React.FC = () => {
  const users = useConfigStore((s) => s.users) as User[];
  const updateUsers = useConfigStore((s) => s.updateUsers);

  const [tfaMap, setTfaMap] = useState<Record<string, boolean>>(() => loadTfaMap());
  const [editing, setEditing] = useState<User | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<User>({ id: '', name: '', email: '', role: 'receptionist', active: true });
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // RBAC — page protégée : lecture min "read", écriture/admin requise pour CRUD
  const canRead = usePermission('set_users', 'read');
  const canWrite = usePermission('set_users', 'write');

  // ─── Métriques ────────────────────────────────────────────────────────
  const admins = users.filter((u) => u.role === 'admin' && u.active);
  const adminsWithoutTfa = admins.filter((u) => !tfaMap[u.id]).length;
  const activeCount = users.filter((u) => u.active).length;

  function toast(msg: string) {
    setSavedToast(msg);
    window.setTimeout(() => setSavedToast(null), 2500);
  }

  function startAdd() {
    setDraft({
      id: `user_${Date.now()}`,
      name: '',
      email: '',
      role: 'receptionist',
      active: true,
    });
    setAdding(true);
    setEditing(null);
  }

  function startEdit(u: User) {
    setDraft({ ...u });
    setEditing(u);
    setAdding(false);
  }

  function cancelEdit() {
    setEditing(null);
    setAdding(false);
  }

  function save() {
    if (!draft.name.trim() || !draft.email.trim()) return;
    if (adding) {
      updateUsers([...users, draft]);
      logAudit({ action: 'module_inspected', module: 'security_backups', detail: `Utilisateur créé : ${draft.name} (${ROLE_LABEL[draft.role]})` });
      toast(`Utilisateur ${draft.name} créé`);
    } else if (editing) {
      updateUsers(users.map((u) => (u.id === editing.id ? draft : u)));
      logAudit({ action: 'module_inspected', module: 'security_backups', detail: `Utilisateur modifié : ${draft.name}` });
      toast(`Utilisateur ${draft.name} modifié`);
    }
    cancelEdit();
  }

  function remove(u: User) {
    if (u.role === 'admin' && admins.length === 1) {
      toast('Impossible de supprimer le dernier administrateur');
      return;
    }
    updateUsers(users.filter((x) => x.id !== u.id));
    logAudit({ action: 'module_inspected', module: 'security_backups', detail: `Utilisateur supprimé : ${u.name}` });
    toast(`Utilisateur ${u.name} supprimé`);
  }

  function toggleActive(u: User) {
    updateUsers(users.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
    toast(u.active ? `${u.name} désactivé` : `${u.name} activé`);
  }

  function toggle2FA(u: User) {
    const next = { ...tfaMap, [u.id]: !tfaMap[u.id] };
    setTfaMap(next);
    saveTfaMap(next);
    logAudit({ action: 'module_inspected', module: 'security_backups', detail: `2FA ${next[u.id] ? 'activé' : 'désactivé'} pour ${u.name}` });
  }

  if (!canRead) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50/60">
        <div className="w-full px-6 pt-6 pb-10">
          <PermissionDeniedBanner capability="set_users" required="read" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Sécurité & Administration</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Utilisateurs & droits</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Gérez les comptes, rôles et l'authentification renforcée (2FA).
              </p>
            </div>
          </div>
          <RequirePermission capability="set_users" level="write">
            <button
              onClick={startAdd}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
            >
              <Plus className="w-3.5 h-3.5" /> Nouvel utilisateur
            </button>
          </RequirePermission>
        </header>

        {/* Métriques */}
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Comptes actifs" value={`${activeCount}`} caption={`/${users.length} total`} tone="violet" />
          <MetricTile
            label="Administrateurs"
            value={`${admins.length}`}
            caption={admins.length === 0 ? 'Aucun admin actif !' : admins.length > 3 ? 'Trop d\'admins' : 'OK'}
            tone={admins.length === 0 ? 'critical' : admins.length > 3 ? 'attention' : 'emerald'}
          />
          <MetricTile
            label="2FA activé"
            value={`${admins.filter((u) => tfaMap[u.id]).length}/${admins.length}`}
            caption={adminsWithoutTfa > 0 ? `${adminsWithoutTfa} admin sans 2FA` : 'Tous protégés'}
            tone={adminsWithoutTfa > 0 ? 'attention' : 'emerald'}
          />
          <MetricTile label="Comptes désactivés" value={`${users.length - activeCount}`} caption="Conservés en audit" tone="slate" />
        </div>

        {/* Table utilisateurs */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Utilisateur</th>
                <th className="px-3 py-2.5 font-medium">Rôle</th>
                <th className="px-3 py-2.5 font-medium">Statut</th>
                <th className="px-3 py-2.5 font-medium">2FA</th>
                <th className="px-3 py-2.5 font-medium text-right w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Aucun utilisateur configuré. Cliquez sur "Nouvel utilisateur" pour commencer.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[12px] font-semibold shrink-0">
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{u.name}</div>
                        <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold', ROLE_TONE[u.role])}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold',
                        u.active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-slate-100 text-slate-500 ring-slate-200',
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', u.active ? 'bg-emerald-500' : 'bg-slate-300')} />
                      {u.active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    {u.role === 'admin' && u.active ? (
                      <button
                        onClick={() => toggle2FA(u)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset',
                          tfaMap[u.id]
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200',
                        )}
                      >
                        {tfaMap[u.id] ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                        {tfaMap[u.id] ? 'Activé' : 'Non configuré'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => canWrite && startEdit(u)}
                        disabled={!canWrite}
                        className={cn(
                          'p-1.5 rounded-md text-slate-500',
                          canWrite ? 'hover:bg-slate-100' : 'opacity-30 cursor-not-allowed',
                        )}
                        title={canWrite ? 'Modifier' : 'Permission requise : set_users (write)'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => canWrite && remove(u)}
                        disabled={!canWrite}
                        className={cn(
                          'p-1.5 rounded-md',
                          canWrite ? 'hover:bg-rose-50 text-rose-600' : 'text-rose-300 opacity-40 cursor-not-allowed',
                        )}
                        title={canWrite ? 'Supprimer' : 'Permission requise : set_users (write)'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Mini banner Phase 2 */}
        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[12px] text-violet-800 flex items-start gap-2">
          <UserCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Phase 2 :</strong> intégration SSO (Google / Microsoft), permissions granulaires
            (RBAC), authentification 2FA réelle via TOTP, et politique de mots de passe seront ajoutés
            dans la prochaine vague.
          </div>
        </div>

        {/* Toast */}
        {savedToast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {savedToast}
          </div>
        )}
      </div>

      {/* Modal édition / création */}
      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45" onClick={cancelEdit}>
          <div onClick={(e) => e.stopPropagation()} className="w-[460px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-slate-900">
                {adding ? 'Nouvel utilisateur' : 'Modifier l\'utilisateur'}
              </h2>
              <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <FormField label="Nom complet" required>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="userinput"
                  placeholder="Marie Dupont"
                />
              </FormField>
              <FormField label="Email" required>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className="userinput"
                  placeholder="marie.dupont@hotel.fr"
                />
              </FormField>
              <FormField label="Rôle">
                <select
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}
                  className="userinput"
                >
                  {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </FormField>
              <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  className="w-4 h-4 accent-violet-600"
                />
                Compte actif
              </label>
              {draft.role === 'admin' && !draft.active && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 ring-1 ring-amber-100 px-3 py-2 text-[11.5px] text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
                  Un compte administrateur désactivé ne pourra plus accéder au PMS.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex justify-end gap-2">
              <button onClick={cancelEdit} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
                Annuler
              </button>
              <button
                onClick={save}
                disabled={!draft.name.trim() || !draft.email.trim()}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" /> {adding ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .userinput {
          width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
          background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
          outline: none; font-size: 13px;
        }
        .userinput:focus { box-shadow: inset 0 0 0 2px #7c3aed; }
      `}</style>
    </div>
  );
};

const MetricTile: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'emerald' | 'attention' | 'critical' | 'slate' }> = ({ label, value, caption, tone }) => {
  const palette = {
    violet:    { v: 'text-violet-700' },
    emerald:   { v: 'text-emerald-700' },
    attention: { v: 'text-amber-700' },
    critical:  { v: 'text-rose-700' },
    slate:     { v: 'text-slate-700' },
  }[tone];
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums', palette.v)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
      {required && <span className="text-rose-500 text-[11px]">*</span>}
    </div>
    {children}
  </label>
);
