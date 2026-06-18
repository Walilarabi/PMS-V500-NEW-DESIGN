import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RootGate from './RootGate';
import './index.css';
import { ReservationProvider } from './contexts/ReservationContext';
import { AuthProvider } from '@/src/domains/auth/AuthContext';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/src/services/settings/monitoringService';
import { Toaster } from '@/src/components/ui/Toaster';
import { toast } from '@/src/hooks/use-toast';

// Capture window.onerror + unhandledrejection vers le ring buffer monitoring
installGlobalErrorHandlers();

// Sentry — pilot integration (Option A, exception au gel produit).
// Activée uniquement si VITE_SENTRY_DSN est configuré côté Vercel env.
// Sinon : no-op silencieux. Utilise le module observability (devops-sprint-1)
// qui pose la PII redaction conservatrice.
const sentryDsn = (import.meta.env as Record<string, string | undefined>).VITE_SENTRY_DSN;
if (sentryDsn) {
  void Promise.all([
    import('@sentry/browser'),
    import('@/src/lib/observability'),
  ])
    .then(([Sentry, obs]) => obs.installSentry(Sentry, sentryDsn))
    .catch(() => {/* observabilité ne doit jamais casser l'app */});
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    },
  },
});

// Bridge: legacy window.dispatchEvent(new CustomEvent('app-toast', ...))
// calls throughout PlanningViewLive → real toast() system
function AppToastBridge() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string; title?: string; variant?: string }>).detail;
      if (!detail?.message && !detail?.title) return;
      toast({
        title: detail.title,
        description: detail.message,
        variant: (detail.variant as any) ?? 'default',
      });
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReservationProvider>
            <RootGate />
            <AppToastBridge />
            <Toaster />
          </ReservationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
