import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

// Mock Supabase to avoid errors if not installed
export const supabase = {
  from: () => ({
    upsert: async () => ({ error: null }),
    select: async () => ({ data: [], error: null }),
  })
};

// --- Toast System ---
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  return { toasts, toast };
};

export const ToastContainer: React.FC<{ toasts: Toast[] }> = ({ toasts }) => {
  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border
              ${t.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 
                t.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 
                'bg-blue-50 border-blue-100 text-blue-800'}
            `}
          >
            {t.type === 'success' ? <CheckCircle2 size={18} /> : 
             t.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
            <span className="text-sm font-bold">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// --- Shared UI Components ---
export const ConfigCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, subtitle, children, icon }) => (
  <div className="bg-white border border-[#E8EDF5] rounded-[24px] shadow-sm overflow-hidden mb-6">
    <div className="px-6 py-5 border-b border-[#F5F7FA] flex items-center gap-4">
      {icon && <div className="p-2.5 bg-[#F5F3FF] text-[#8B5CF6] rounded-xl">{icon}</div>}
      <div>
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">{title}</h3>
        {subtitle && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

export const ConfigInput: React.FC<any> = ({ label, icon: Icon, ...props }) => (
  <div className="flex flex-col gap-1.5 flex-1">
    {label && <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{label}</label>}
    <div className="relative group">
      {Icon && <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#8B5CF6] transition-colors" />}
      <input
        {...props}
        className={`
          w-full bg-[#F5F7FA] border border-[#E8EDF5] rounded-xl h-11 px-4 
          text-sm font-bold text-gray-900 outline-none focus:border-[#8B5CF6] 
          focus:ring-2 focus:ring-[#8B5CF6]/5 transition-all
          ${Icon ? 'pl-10' : ''}
        `}
      />
    </div>
  </div>
);
