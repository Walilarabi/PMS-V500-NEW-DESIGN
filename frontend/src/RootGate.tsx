import React from 'react';
import { Loader2, ShieldOff } from 'lucide-react';

import App from './App';
import { LoginPage }  from '@/src/domains/auth/LoginPage';
import { AdminApp }   from '@/src/pages/admin/AdminApp';
import { AdminProvider, useAdmin } from '@/src/domains/admin/AdminContext';
import { useAuth }    from '@/src/domains/auth/AuthContext';

// ─── Admin gate (checks platform_admins table) ────────────────────────────────

const AdminGate: React.FC = () => {
  const { admin, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6FB]">
        <Loader2 className="animate-spin text-[#8B5CF6]" size={28} />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F6FB] text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <ShieldOff size={28} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Accès refusé</h1>
        <p className="text-sm text-gray-400 max-w-sm mb-6">
          Vous n'avez pas les droits nécessaires pour accéder à l'interface d'administration Flowtym.
        </p>
        <a href="/" className="text-sm font-bold text-[#8B5CF6] hover:underline">
          ← Retour au PMS
        </a>
      </div>
    );
  }

  return <AdminApp />;
};

// ─── Root gate ────────────────────────────────────────────────────────────────

export const RootGate: React.FC = () => {
  const { status } = useAuth();
  const isAdminPath = window.location.pathname.startsWith('/admin');

  if (status === 'loading') {
    return (
      <div
        data-testid="auth-loading"
        className="min-h-screen w-full flex items-center justify-center bg-[#F7F6FB] text-gray-500"
      >
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (status === 'unauthenticated') return <LoginPage />;

  // Authenticated — route to admin or PMS
  if (isAdminPath) {
    return (
      <AdminProvider>
        <AdminGate />
      </AdminProvider>
    );
  }

  return <App />;
};

export default RootGate;
