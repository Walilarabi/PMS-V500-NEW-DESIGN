import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RootGate from './RootGate';
import { Toaster } from './components/ui/Toaster';
import { RealtimeBridge } from './RealtimeBridge';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ReservationProvider>
          <RealtimeBridge />
          <RootGate />
          <Toaster />
        </ReservationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
