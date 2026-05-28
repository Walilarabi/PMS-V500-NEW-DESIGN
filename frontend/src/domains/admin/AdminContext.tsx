import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformRole = 'super_admin' | 'support_agent' | 'billing_admin';

export interface AdminSession {
  id: string;
  email: string;
  fullName: string | null;
  role: PlatformRole;
}

interface AdminContextValue {
  admin: AdminSession | null;
  isLoading: boolean;
  isSuperAdmin:   boolean;
  isBillingAdmin: boolean;
  isSupportAgent: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AdminContext = createContext<AdminContextValue>({
  admin: null,
  isLoading: true,
  isSuperAdmin:   false,
  isBillingAdmin: false,
  isSupportAgent: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: admin = null, isLoading } = useQuery<AdminSession | null>({
    queryKey: ['platform-admin-me'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('platform_admins')
        .select('id, email, full_name, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id:       data.id,
        email:    data.email,
        fullName: data.full_name,
        role:     data.role as PlatformRole,
      };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <AdminContext.Provider value={{
      admin,
      isLoading,
      isSuperAdmin:   admin?.role === 'super_admin',
      isBillingAdmin: admin?.role === 'super_admin' || admin?.role === 'billing_admin',
      isSupportAgent: admin?.role === 'super_admin' || admin?.role === 'support_agent',
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);
