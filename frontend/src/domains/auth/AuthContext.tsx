import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import * as authRepo from './repository';
import type { AuthSession, LoginInput, SignUpInput } from './schemas';

interface AuthContextValue {
  session: AuthSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (input: LoginInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  useEffect(() => {
    let mounted = true;
    authRepo
      .getCurrentSession()
      .then((s) => {
        if (!mounted) return;
        setSession(s);
        setStatus(s ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!mounted) return;
        setStatus('unauthenticated');
      });
    const unsubscribe = authRepo.onAuthStateChange((s) => {
      if (!mounted) return;
      setSession(s);
      setStatus(s ? 'authenticated' : 'unauthenticated');
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      login: async (input) => {
        const s = await authRepo.loginWithPassword(input);
        setSession(s);
        setStatus('authenticated');
      },
      signUp: async (_input) => {
        const s = await authRepo.signUpAndProvisionTenant();
        setSession(s);
        setStatus('authenticated');
      },
      logout: async () => {
        await authRepo.signOut();
        setSession(null);
        setStatus('unauthenticated');
      },
    }),
    [session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useRequireAuth(): AuthSession {
  const { session, status } = useAuth();
  if (status === 'loading') throw new Error('Auth still loading');
  if (!session) throw new Error('User not authenticated');
  return session;
}
