import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, Users, Ticket, BookOpen,
  LogOut, Shield, CreditCard, FileText, Settings,
  Activity, HeadphonesIcon, Package, ChevronRight,
  FilePlus,
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { cn } from '@/src/lib/utils';
import { useAdmin } from '@/src/domains/admin/AdminContext';
import { supabase } from '@/src/lib/supabase';
import { AdminDashboard }    from './AdminDashboard';
import { AdminHotels }       from './AdminHotels';
import { AdminUsers }        from './AdminUsers';
import { AdminSupport }      from './AdminSupport';
import { AdminArticles }     from './AdminArticles';
import { AdminSubscriptions }from './AdminSubscriptions';
import { AdminBilling }      from './AdminBilling';
import { AdminContracts }    from './AdminContracts';
import { AdminSupportMode }  from './AdminSupportMode';
import { AdminLogs }         from './AdminLogs';
import { AdminSettings }     from './AdminSettings';
import { AdminTeam }         from './AdminTeam';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminPage =
  | 'dashboard' | 'hotels' | 'users'
  | 'subscriptions' | 'billing' | 'contracts'
  | 'support_mode' | 'support' | 'articles'
  | 'logs' | 'settings' | 'team';

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavItem {
  id: AdminPage;
  label: string;
  icon: React.ElementType;
  requiredRole?: 'super_admin' | 'billing_admin' | 'support_agent';
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Vue d\'ensemble',
    items: [
      { id: 'dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Clients',
    items: [
      { id: 'hotels',  label: 'Hôtels',          icon: Building2, requiredRole: 'super_admin' },
      { id: 'users',   label: 'Utilisateurs',    icon: Users,     requiredRole: 'super_admin' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { id: 'subscriptions', label: 'Abonnements', icon: Package,   requiredRole: 'billing_admin' },
      { id: 'billing',       label: 'Facturation',  icon: CreditCard,requiredRole: 'billing_admin' },
      { id: 'contracts',     label: 'Contrats',     icon: FilePlus,  requiredRole: 'billing_admin' },
    ],
  },
  {
    label: 'Support',
    items: [
      { id: 'support_mode', label: 'Mode support',     icon: HeadphonesIcon },
      { id: 'support',      label: 'Tickets globaux',  icon: Ticket },
      { id: 'articles',     label: 'Articles d\'aide', icon: BookOpen },
    ],
  },
  {
    label: 'Plateforme',
    items: [
      { id: 'logs',     label: 'Logs & Activité',  icon: Activity,  requiredRole: 'super_admin' },
      { id: 'settings', label: 'Paramètres',        icon: Settings,  requiredRole: 'super_admin' },
      { id: 'team',     label: 'Équipe admin',      icon: Shield,    requiredRole: 'super_admin' },
    ],
  },
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const roleInfo = admin ? ROLE_LABELS[admin.role] : null;

  return (
    <div className="h-screen flex overflow-hidden bg-[#F9FAFB]">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#8B5CF6] flex items-center justify-center shadow-md shadow-[#8B5CF6]/30">
              <Shield size={15} className="text-white" />
            </div>
            <div>
              <p className="text-[13px] font-black text-gray-900 leading-tight">Flowtym</p>
              <p className="text-[9px] font-bold text-[#8B5CF6] uppercase tracking-widest">Administration</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-3 overflow-y-auto">
          {NAV_GROUPS.map(group => {
            const visible = group.items.filter(canAccess);
            if (!visible.length) return null;
            return (
              <div key={group.label}>
                <p className="px-3 mb-1 text-[9px] font-black uppercase tracking-widest text-gray-300">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visible.map(item => {
                    const active = page === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPage(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors text-left',
                          active
                            ? 'bg-[#8B5CF6] text-white shadow-sm shadow-[#8B5CF6]/30'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
                        )}
                      >
                        <item.icon size={14} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {active && <ChevronRight size={12} className="opacity-60" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="p-2 border-t border-gray-100 space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50">
            <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/15 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-black text-[#8B5CF6]">
                {(admin?.fullName ?? admin?.email ?? 'A').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-gray-900 truncate">{admin?.fullName ?? admin?.email}</p>
              {roleInfo && (
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md', roleInfo.color)}>
                  {roleInfo.label}
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <LogOut size={13} />
            </button>
          </div>
          <a
            href="/"
            className="flex items-center justify-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-[#8B5CF6] transition-colors py-1"
          >
            ← Retour au PMS hôtel
          </a>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {page === 'dashboard'     && <AdminDashboard onNavigate={setPage} />}
          {page === 'hotels'        && <AdminHotels />}
          {page === 'users'         && <AdminUsers />}
          {page === 'subscriptions' && <AdminSubscriptions />}
          {page === 'billing'       && <AdminBilling />}
          {page === 'contracts'     && <AdminContracts />}
          {page === 'support_mode'  && <AdminSupportMode />}
          {page === 'support'       && <AdminSupport />}
          {page === 'articles'      && <AdminArticles />}
          {page === 'logs'          && <AdminLogs />}
          {page === 'settings'      && <AdminSettings />}
          {page === 'team'          && <AdminTeam />}
        </div>
      </main>

    </div>
  );
};

export default AdminApp;
