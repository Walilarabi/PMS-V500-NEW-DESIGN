/**
 * FLOWTYM — Lightweight toast hook (shadcn-compatible API).
 *
 * Single global event bus + Toaster portal. Designed to stay tiny: no
 * dependency on external toast libs, no animation framework. Auto-dismiss
 * after 4 s.
 */
import { useEffect, useState } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

type Listener = (toasts: ToastEntry[]) => void;

let toasts: ToastEntry[] = [];
const listeners: Listener[] = [];

const emit = (): void => {
  for (const l of listeners) l(toasts);
};

const remove = (id: string): void => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

export function toast(options: ToastOptions): { id: string; dismiss: () => void } {
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: ToastEntry = { id, variant: 'default', duration: 4000, ...options };
  toasts = [...toasts, entry];
  emit();
  if (entry.duration) {
    window.setTimeout(() => remove(id), entry.duration);
  }
  return { id, dismiss: () => remove(id) };
}

export function useToast(): { toast: typeof toast; toasts: ToastEntry[] } {
  const [snapshot, setSnapshot] = useState<ToastEntry[]>(toasts);
  useEffect(() => {
    const l: Listener = (next) => setSnapshot(next);
    listeners.push(l);
    return () => {
      const idx = listeners.indexOf(l);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);
  return { toast, toasts: snapshot };
}
