/**
 * FLOWTYM REVENUE — ErrorBoundary local par écran.
 *
 * Objectif : empêcher qu'une exception dans un écran Revenue (Distribution
 * OTA, Promotions, Événements, etc.) ne fasse remonter l'erreur jusqu'à
 * l'ErrorBoundary global de App.tsx qui éteint TOUTE l'app.
 *
 * Garanties :
 *   - le crash reste confiné à l'écran touché (le menu, la sidebar et les
 *     autres écrans Revenue restent accessibles) ;
 *   - le fallback affiche le nom de l'écran concerné (pas un message
 *     générique) → le RM sait précisément ce qui ne marche pas ;
 *   - bouton « Réessayer » qui reset le boundary et tente un nouveau render ;
 *   - bouton « Debug » qui ouvre le DebugPanel global (mêmes événements que
 *     la Topbar) → le RM peut copier l'erreur vers le commanditaire ;
 *   - log dans captureError → ring buffer monitoring + Sentry quand activé.
 */
import React from 'react';
import { AlertTriangle, RefreshCcw, Bug, ChevronRight } from 'lucide-react';
import { captureError } from '@/src/services/settings/monitoringService';

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface Props {
  /** Nom affiché à l'utilisateur : « Distribution & OTA », « Événements », … */
  screenName: string;
  /** Children rendus normalement quand pas d'erreur. */
  children: React.ReactNode;
}

export class RevenueScreenBoundary extends React.Component<Props, State> {
  declare props: Props;
  declare state: State;
  declare setState: React.Component<Props, State>['setState'];

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[RevenueScreenBoundary:${this.props.screenName}]`, error, info.componentStack);
    this.setState({ errorInfo: info });
    try {
      captureError(error, {
        source: 'revenue-screen-boundary',
        screen: this.props.screenName,
        componentStack: info.componentStack ?? undefined,
      });
    } catch {
      /* monitoring ne doit jamais crasher le boundary */
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleOpenDebug = () => {
    try {
      window.dispatchEvent(new CustomEvent('flowtym:toggle-debug'));
    } catch {
      /* fallback no-op */
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message ?? 'Erreur inconnue';
    const stackPreview = (this.state.error?.stack ?? '')
      .split('\n')
      .slice(0, 3)
      .join('\n')
      .trim();

    return (
      <div className="flex-1 overflow-y-auto bg-slate-50/60 p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-rose-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-start gap-3 px-5 py-4 bg-rose-50/70 border-b border-rose-100">
              <div className="mt-0.5 p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-rose-600">
                  Erreur écran Revenue
                </p>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  {this.props.screenName}
                </h2>
                <p className="text-[12.5px] text-slate-600 mt-1">
                  Cet écran n'a pas pu s'afficher. Le reste de l'application
                  reste accessible — vous pouvez continuer à utiliser les
                  autres modules.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Message d'erreur
                </div>
                <pre className="text-[12px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 overflow-auto whitespace-pre-wrap break-all max-h-32">
{msg}
                </pre>
              </div>

              {stackPreview && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                    Stack (3 premières lignes)
                  </div>
                  <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-600 overflow-auto whitespace-pre-wrap max-h-32">
{stackPreview}
                  </pre>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 shadow-sm"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={this.handleOpenDebug}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-700 text-[13px] font-semibold border border-slate-200 hover:bg-slate-50"
                >
                  <Bug className="w-3.5 h-3.5" />
                  Ouvrir Debug
                </button>
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 ml-auto">
                  Erreur transmise au monitoring
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
