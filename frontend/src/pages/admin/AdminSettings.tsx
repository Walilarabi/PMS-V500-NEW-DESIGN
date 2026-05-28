import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Shield, Bell, Globe, CreditCard } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Setting { id: string; key: string; value: unknown; description: string | null; updated_at: string }

const SETTING_GROUPS: { title: string; icon: React.ElementType; keys: string[] }[] = [
  {
    title: 'Plateforme',
    icon: Globe,
    keys: ['platform_name', 'support_email', 'billing_email', 'terms_url'],
  },
  {
    title: 'Abonnements & Facturation',
    icon: CreditCard,
    keys: ['default_currency', 'default_billing_cycle', 'trial_duration_days', 'default_tva_rate'],
  },
  {
    title: 'Relances',
    icon: Bell,
    keys: ['dunning_days_before', 'max_trial_extensions'],
  },
];

function useSettings() {
  return useQuery<Setting[]>({
    queryKey: ['admin-settings-full'],
    queryFn: async () => {
      const { data, error } = await db.from('platform_settings').select('*').order('key');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export const AdminSettings: React.FC = () => {
  const qc = useQueryClient();
  const { data: settings = [], isLoading } = useSettings();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const settingsMap: Record<string, Setting> = {};
  settings.forEach(s => { settingsMap[s.key] = s; });

  const saveMut = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await db
        .from('platform_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-settings-full'] });
      toast.success(`Paramètre "${vars.key}" enregistré.`);
      setEdits(p => { const n = { ...p }; delete n[vars.key]; return n; });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = (key: string) => {
    const raw = edits[key];
    if (raw === undefined) return;
    let parsed: unknown = raw;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    saveMut.mutate({ key, value: parsed });
  };

  const getValue = (key: string): string => {
    if (edits[key] !== undefined) return edits[key];
    const s = settingsMap[key];
    if (!s) return '';
    const v = s.value;
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  };

  const isDirty = (key: string) => edits[key] !== undefined;

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-gray-400">Chargement…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">Paramètres plateforme</h1>
        <p className="text-sm text-gray-400 mt-0.5">Configuration globale de la plateforme Flowtym</p>
      </div>

      {SETTING_GROUPS.map(group => (
        <div key={group.title} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50 bg-gray-50">
            <group.icon size={15} className="text-[#8B5CF6]" />
            <h3 className="text-[12px] font-black uppercase tracking-widest text-gray-600">{group.title}</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {group.keys.map(key => {
              const s = settingsMap[key];
              if (!s) return null;
              const dirty = isDirty(key);
              return (
                <div key={key} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 font-mono">{key}</p>
                    {s.description && <p className="text-[11px] text-gray-400 mt-0.5">{s.description}</p>}
                    {s.updated_at && (
                      <p className="text-[10px] text-gray-300 mt-1">
                        Modifié le {new Date(s.updated_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      value={getValue(key)}
                      onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
                      className={cn(
                        'w-52 px-3 py-2 rounded-xl border text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 font-mono transition-colors',
                        dirty ? 'border-[#8B5CF6] bg-[#8B5CF6]/3' : 'border-gray-200'
                      )}
                    />
                    {dirty && (
                      <button
                        onClick={() => handleSave(key)}
                        disabled={saveMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-bold hover:bg-[#7C3AED] disabled:opacity-60"
                      >
                        <Save size={12} />
                        {saveMut.isPending ? '…' : 'Enregistrer'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 rounded-2xl">
        <Shield size={15} className="text-[#8B5CF6] mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-bold text-[#8B5CF6]">Paramètres sensibles</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Les modifications de ces paramètres sont journalisées dans le journal d'audit de la plateforme.
            Seuls les Super Admins peuvent modifier ces valeurs.
          </p>
        </div>
      </div>
    </div>
  );
};
