import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RootGate from './RootGate';
import { Toaster } from './components/ui/Toaster';
import { RealtimeBridge } from './RealtimeBridge';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { ReservationProvider } from './contexts/ReservationContext';
import { AuthProvider } from '@/src/domains/auth/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Capture les rejections de promesses non gérées (Supabase WS, fetch, etc.)
// pour éviter qu'elles ne deviennent des "page blanche" silencieuses.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    // eslint-disable-next-line no-console
    console.error('[unhandledrejection]', event.reason);
  });
  window.addEventListener('error', (event) => {
    // eslint-disable-next-line no-console
    console.error('[window.error]', event.error || event.message);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReservationProvider>
            <RealtimeBridge />
            <RootGate />
            <Toaster />
          </ReservationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
