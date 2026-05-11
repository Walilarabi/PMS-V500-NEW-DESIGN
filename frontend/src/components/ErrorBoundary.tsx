/**
 * FLOWTYM — Global ErrorBoundary.
 *
 * Rattrape les erreurs runtime React (rendering, lifecycle, hooks errors)
 * pour éviter qu'un crash unique ne démonte tout le tree et n'affiche une
 * page blanche. Affiche un fallback informatif avec :
 *   • Message d'erreur lisible
 *   • Stack trace (déroulable)
 *   • Bouton "Recharger" qui force window.location.reload()
 *   • Bouton "Réessayer" qui reset l'état d'erreur
 *
 * Note: les erreurs asynchrones (promises non-catchées) ne sont PAS rattrapées
 * par React error boundaries. Pour ces cas on s'appuie sur window.onerror /
 * onunhandledrejection (voir main.tsx).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] React tree crashed:', error, info);
    this.setState({ info });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleRetry = (): void => {
    this.setState({ error: null, info: null });
  };

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        data-testid="error-boundary-fallback"
        className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6"
      >
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-red-500 to-rose-600 text-white">
            <h1 className="text-xl font-bold tracking-tight">
              Une erreur inattendue est survenue
            </h1>
            <p className="text-sm text-red-50 mt-1">
              L'application a rencontré un problème. Vos données sont en sécurité.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
                Message
              </p>
              <p className="text-sm text-red-900 font-mono break-words">
                {error.message || String(error)}
              </p>
            </div>

            {(error.stack || info?.componentStack) && (
              <details className="bg-slate-50 border border-slate-200 rounded-lg">
                <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wider hover:bg-slate-100">
                  Détails techniques
                </summary>
                <pre className="p-4 text-[11px] text-slate-700 overflow-auto max-h-64 whitespace-pre-wrap">
                  {error.stack}
                  {info?.componentStack ? `\n\nComponent stack:${info.componentStack}` : ''}
                </pre>
              </details>
            )}

            <div className="flex gap-3 pt-2">
              <button
                data-testid="error-boundary-reload-btn"
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Recharger la page
              </button>
              <button
                data-testid="error-boundary-retry-btn"
                onClick={this.handleRetry}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
              >
                Réessayer
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center pt-2">
              Si le problème persiste, contactez le support — code: {error.name || 'Error'}
            </p>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
