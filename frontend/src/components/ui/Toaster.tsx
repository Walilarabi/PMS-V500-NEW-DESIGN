import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

import { useToast, type ToastVariant } from '@/src/hooks/use-toast';

const VARIANT_STYLES: Record<ToastVariant, { ring: string; icon: React.ComponentType<{ size?: number; className?: string }>; tone: string }> = {
  default: { ring: 'border-violet-200', icon: Info, tone: 'text-violet-700' },
  success: { ring: 'border-emerald-200', icon: CheckCircle2, tone: 'text-emerald-700' },
  destructive: { ring: 'border-rose-200', icon: AlertTriangle, tone: 'text-rose-700' },
};

export const Toaster: React.FC = () => {
  const { toasts, toast } = useToast();
  return (
    <div
      data-testid="toaster"
      className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const style = VARIANT_STYLES[t.variant ?? 'default'];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            data-testid={`toast-${t.id}`}
            className={`pointer-events-auto w-[320px] rounded-2xl border bg-white shadow-xl px-4 py-3 flex items-start gap-3 ${style.ring} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <span className={`mt-0.5 ${style.tone}`}>
              <Icon size={18} />
            </span>
            <div className="flex-1 min-w-0">
              {t.title && (
                <p className="text-sm font-bold text-slate-900 truncate">{t.title}</p>
              )}
              {t.description && (
                <p className="text-xs text-slate-600 mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => toast({ ...t, duration: 1 })}
              aria-label="Fermer"
              className="text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toaster;
