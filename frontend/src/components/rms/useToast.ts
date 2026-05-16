import { useCallback, useState } from "react";
import { ToastMessage, ToastType } from "../components/Toast";

let _toastId = 0;
const nextId = () => `toast_${++_toastId}`;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = nextId();
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) => addToast("success", title, message), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast("error", title, message), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast("info", title, message), [addToast]);
  const loading = useCallback((title: string, message?: string) => addToast("loading", title, message), [addToast]);

  return { toasts, addToast, dismissToast, success, error, info, loading };
}
