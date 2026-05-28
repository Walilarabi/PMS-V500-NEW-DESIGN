import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, Users, Ticket, BookOpen,
  LogOut, ChevronRight, Shield, CreditCard, FileText,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAdmin } from '@/src/domains/admin/AdminContext';
import { supabase } from '@/src/lib/supabase';
import { AdminDashboard } from './AdminDashboard';
import { AdminHotels }    from './AdminHotels';
import { AdminSupport }   from './AdminSupport';
import { AdminArticles }  from './AdminArticles';

// ─── Navigation config ────────────────────────────────────────────────────────

type AdminPage = 'dashboard' | 'hotels' | 'users' | 'support' | 'articles' | 'subscriptions' | 'billing';

interface NavItem {
  id: AdminPage;
  label: string;
  icon: React.ElementType;
  badge?: string;
  soon?: boolean;
  requiredRole?: 'super_admin' | 'billing_admin' | 'support_agent';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',     label: 'Tableau de bord',    icon: LayoutDashboard },
  { id: 'hotels',        label: 'Hôtels',             icon: Building2,    requiredRole: 'super_admin' },
  { id: 'users',         label: 'Utilisateurs',       icon: Users,        soon: true, requiredRole: 'super_admin' },
  { id: 'subscriptions', label: 'Abonnements',        icon: CreditCard,   soon: true, requiredRole: 'billing_admin' },
  { id: 'billing',       label: 'Facturation',        icon: FileText,     soon: true, requiredRole: 'billing_admin' },
  { id: 'support',       label: 'Support global',     icon: Ticket },
  { id: 'articles',      label: 'Articles d\'aide',   icon: BookOpen },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin:   { label: 'Super Admin',   color: 'bg-[#8B5CF6]/10 text-[#8B5CF6]' },
  support_agent: { label: 'Support',       color: 'bg-blue-50 text-blue-600' },
  billing_admin: { label: 'Billing Admin', color: 'bg-emerald-50 text-emerald-600' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AdminApp: React.FC = () => {
  const { admin, isSuperAdmin, isBillingAdmin } = useAdmin();
  const [page, setPage] = useState<AdminPage>('dashboard');

  const canAccess = (item: NavItem): boolean => {
    if (!item.requiredRole) return true;
    if (item.requiredRole === 'super_admin')   return isSuperAdmin;
    if (item.requiredRole === 'billing_admin') return isBillingAdmin;
    return true;
  };

  const visibleItems = NAV_ITEMS.filter(canAccess);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const roleInfo = admin ? ROLE_LABELS[admin.role] : null;

  return (
    <div className="h-screen flex overflow-hidden bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#8B5CF6] flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">Flowtym</p>
              <p className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Administration</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map(item => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.soon && setPage(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors text-left',
                  active
                    ? 'bg-[#8B5CF6] text-white'
                    : item.soon
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                <item.icon size={15} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="text-[9px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                    Bientôt
                  </span>
                )}
                {active && <ChevronRight size={13} />}
              </button>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50">
            <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-black text-[#8B5CF6]">
                {(admin?.fullName ?? admin?.email ?? 'A').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-900 truncate">{admin?.fullName ?? admin?.email}</p>
              {roleInfo && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', roleInfo.color)}>
                  {roleInfo.label}
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
          {/* Back to PMS link */}
          <a
            href="/"
            className="flex items-center justify-center gap-1.5 mt-2 text-[11px] font-bold text-gray-400 hover:text-[#8B5CF6] transition-colors py-1.5"
          >
            ← Retour au PMS hôtel
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {page === 'dashboard'     && <AdminDashboard />}
          {page === 'hotels'        && <AdminHotels />}
          {page === 'support'       && <AdminSupport />}
          {page === 'articles'      && <AdminArticles />}
          {(page === 'users' || page === 'subscriptions' || page === 'billing') && (
            <ComingSoon page={page} />
          )}
        </div>
      </main>
    </div>
  );
};

const SOON_META: Record<string, { title: string; description: string }> = {
  users:         { title: 'Gestion des utilisateurs', description: 'Création de comptes, attribution des rôles hôtel, réinitialisation de mots de passe.' },
  subscriptions: { title: 'Abonnements & Contrats',   description: 'Activation/désactivation des abonnements, ajout d\'options, édition des contrats.' },
  billing:       { title: 'Facturation',              description: 'Génération de factures, suivi des paiements, historique de facturation par hôtel.' },
};

const ComingSoon: React.FC<{ page: string }> = ({ page }) => {
  const meta = SOON_META[page] ?? { title: page, description: '' };
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-5">
        <Shield size={28} className="text-[#8B5CF6]" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{meta.title}</h2>
      <p className="text-sm text-gray-400 max-w-sm">{meta.description}</p>
      <span className="mt-5 px-4 py-2 bg-[#8B5CF6]/8 rounded-xl text-xs font-bold text-[#8B5CF6] uppercase tracking-widest">
        Prochainement
      </span>
    </div>
  );
};

export default AdminApp;
