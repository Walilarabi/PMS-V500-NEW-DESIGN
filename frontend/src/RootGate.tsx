/**
 * FLOWTYM — Authentication gate.
 *
 * Decides between LoginPage and the authenticated workspace based on the
 * current auth status. Centralising this here keeps `App.tsx` free of any
 * auth concerns and avoids duplicating loading screens.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

import App from './App';
import { LoginPage } from '@/src/domains/auth/LoginPage';
import { useAuth } from '@/src/domains/auth/AuthContext';

export const RootGate: React.FC = () => {
  const { status } = useAuth();

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
  return <App />;
};

export default RootGate;
