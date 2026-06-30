import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { cn } from "../utils/cn";
import { CheckCircle2, X, AlertCircle, Info, Loader2 } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (title: string, type?: ToastType, message?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, type: ToastType = "info", message?: string, duration = 4000) => {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const success = useCallback((title: string, message?: string) => showToast(title, "success", message), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast(title, "info", message), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast(title, "error", message), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, success, info, error }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.type !== "loading") {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    loading: <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />,
  };

  return (
    <div className={cn(
      "pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border bg-white min-w-[320px] max-w-md animate-slide-in",
      toast.type === "success" && "border-emerald-200",
      toast.type === "error" && "border-red-200",
      toast.type === "info" && "border-blue-200",
      toast.type === "loading" && "border-violet-200"
    )}>
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{toast.title}</p>
        {toast.message && <p className="text-xs text-gray-500 mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
