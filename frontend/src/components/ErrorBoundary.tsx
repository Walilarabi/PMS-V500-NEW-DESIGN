import React from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';

interface State { hasError: boolean; error: Error | null; }

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

    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-8">
        <div className="bg-white rounded-[28px] shadow-xl p-10 max-w-lg w-full text-center space-y-5">
          <div className="p-4 bg-red-50 rounded-2xl inline-flex mx-auto">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Une erreur est survenue</h1>
          <p className="text-sm text-gray-500 font-mono bg-gray-50 p-3 rounded-xl text-left break-all">
            {this.state.error?.message ?? 'Erreur inconnue'}
          </p>
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
