import React from 'react';
import { RefreshCcw, AlertTriangle, Settings } from 'lucide-react';

interface State { hasError: boolean; error: Error | null; }

/**
 * Détecte si l'erreur est liée à une variable d'environnement manquante
 * pour afficher des instructions de configuration précises.
 */
function isEnvError(msg: string): boolean {
  return msg.includes('VITE_SUPABASE_URL') || msg.includes('VITE_SUPABASE_ANON_KEY');
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message ?? 'Erreur inconnue';
    const isEnv = isEnvError(msg);

    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-8 font-sans">
        <div className="bg-white rounded-[28px] shadow-xl p-10 max-w-lg w-full text-center space-y-5">

          <div className={`p-4 ${isEnv ? 'bg-amber-50' : 'bg-red-50'} rounded-2xl inline-flex mx-auto`}>
            {isEnv
              ? <Settings size={28} className="text-amber-500" />
              : <AlertTriangle size={28} className="text-red-500" />}
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            {isEnv ? 'Configuration manquante' : 'Une erreur est survenue'}
          </h1>

          {isEnv ? (
            <div className="text-left space-y-4">
              <p className="text-sm text-gray-600">
                Les variables d'environnement Supabase ne sont pas configurées.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 text-sm">
                <p className="font-bold text-amber-800">Sur Vercel (production) :</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-700">
                  <li>Ouvrir <span className="font-mono">vercel.com/dashboard</span></li>
                  <li>Sélectionner le projet <span className="font-mono">flowtym</span></li>
                  <li>Aller dans <span className="font-mono">Settings → Environment Variables</span></li>
                  <li>Ajouter <span className="font-mono font-bold">VITE_SUPABASE_URL</span></li>
                  <li>Ajouter <span className="font-mono font-bold">VITE_SUPABASE_ANON_KEY</span></li>
                  <li>Redéployer</li>
                </ol>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-bold text-gray-700">En développement local :</p>
                <p className="font-mono text-xs text-gray-600">
                  Créer <span className="text-violet-600">frontend/.env.local</span> avec :
                </p>
                <pre className="text-xs text-left bg-gray-100 p-2 rounded-lg overflow-auto">
{`VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<clé-anon>`}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 font-mono bg-gray-50 p-3 rounded-xl text-left break-all">
              {msg}
            </p>
          )}

          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#8B5CF6] text-white font-bold rounded-2xl shadow-lg shadow-[#8B5CF6]/20 hover:bg-[#7C3AED] transition-colors"
          >
            <RefreshCcw size={16} />
            Recharger l'application
          </button>
        </div>
      </div>
    );
  }
}
