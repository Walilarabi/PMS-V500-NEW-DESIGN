/**
 * FLOWTYM — Automation Form Modal (Wave C7)
 *
 * Create / edit a trigger → action automation rule, with a live preview
 * of how many guests currently match the chosen trigger.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Loader2, ArrowRight, Users } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useSaveAutomation, useAutomationPreview } from '@/src/services/crm/hooks';
import {
  TRIGGERS, ACTIONS, type Automation, type ConfigField,
} from '@/src/services/crm/automation.service';

type ConfigState = Record<string, string | number>;

const buildConfig = (
  fields: ConfigField[],
  existing?: Record<string, unknown>,
): ConfigState =>
  Object.fromEntries(
    fields.map((f) => {
      const v = existing?.[f.key];
      if (v !== undefined && v !== null) {
        return [f.key, f.type === 'number' ? Number(v) : String(v)];
      }
      return [f.key, f.default];
    }),
  );

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors';

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
    {children}
  </label>
);

// ─── Dynamic config field ─────────────────────────────────────────────────────

const ConfigInput = ({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: string | number;
  onChange: (v: string | number) => void;
}) => {
  if (field.type === 'select') {
    return (
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls + ' bg-white'}
      >
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={field.placeholder}
        className={inputCls + ' resize-none'}
      />
    );
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) =>
        onChange(field.type === 'number' ? Number(e.target.value) || 0 : e.target.value)
      }
      placeholder={field.placeholder}
      className={inputCls}
    />
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  automation: Automation | null;
  onClose: () => void;
}

export const AutomationFormModal: React.FC<Props> = ({ automation, onClose }) => {
  const isEdit = !!automation;

  const [name, setName]               = useState(automation?.name ?? '');
  const [description, setDescription] = useState(automation?.description ?? '');
  const [enabled, setEnabled]         = useState(automation?.enabled ?? true);

  const [triggerType, setTriggerType] = useState(automation?.trigger_type ?? 'new_guest');
  const [actionType, setActionType]   = useState(automation?.action_type ?? 'tag');

  const trigger = TRIGGERS.find((t) => t.key === triggerType) ?? TRIGGERS[0];
  const action  = ACTIONS.find((a) => a.key === actionType) ?? ACTIONS[0];

  const [triggerConfig, setTriggerConfig] = useState<ConfigState>(
    () => buildConfig(trigger.fields, automation?.trigger_config),
  );
  const [actionConfig, setActionConfig] = useState<ConfigState>(
    () => buildConfig(action.fields, automation?.action_config),
  );

  const save = useSaveAutomation();

  // Live preview of matching guests
  const previewQ = useAutomationPreview(triggerType, triggerConfig);
  const matchCount = previewQ.data?.count;

  const onTriggerChange = (key: string) => {
    setTriggerType(key);
    const meta = TRIGGERS.find((t) => t.key === key)!;
    setTriggerConfig(buildConfig(meta.fields));
  };

  const onActionChange = (key: string) => {
    setActionType(key);
    const meta = ACTIONS.find((a) => a.key === key)!;
    setActionConfig(buildConfig(meta.fields));
  };

  const valid = useMemo(() => {
    if (!name.trim()) return false;
    return action.fields.every((f) => {
      const v = actionConfig[f.key];
      return f.type === 'number' ? true : String(v ?? '').trim().length > 0;
    });
  }, [name, action.fields, actionConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await save.mutateAsync({
      id:             automation?.id ?? null,
      name:           name.trim(),
      description:    description.trim() || null,
      trigger_type:   triggerType,
      trigger_config: triggerConfig,
      action_type:    actionType,
      action_config:  actionConfig,
      enabled,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#8B5CF6]/10">
                <Zap size={16} className="text-[#8B5CF6]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {isEdit ? 'Modifier l\'automatisation' : 'Nouvelle automatisation'}
                </h3>
                <p className="text-[11px] text-gray-400">Déclencheur → action</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Identity */}
              <div>
                <Label>Nom *</Label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="ex: Relance des clients dormants"
                />
              </div>
              <div>
                <Label>Description</Label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                  placeholder="Objectif de cette automatisation"
                />
              </div>

              {/* Trigger */}
              <div className="bg-[#8B5CF6]/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8B5CF6] uppercase tracking-wide">
                  <Zap size={12} /> Déclencheur
                </div>
                <select
                  value={triggerType}
                  onChange={(e) => onTriggerChange(e.target.value)}
                  className={inputCls + ' bg-white'}
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500">{trigger.description}</p>
                {trigger.fields.map((f) => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <ConfigInput
                      field={f}
                      value={triggerConfig[f.key] ?? f.default}
                      onChange={(v) => setTriggerConfig((c) => ({ ...c, [f.key]: v }))}
                    />
                  </div>
                ))}

                {/* Live preview */}
                <div className="flex items-center gap-2 pt-1">
                  <Users size={13} className="text-gray-400" />
                  <span className="text-[12px] text-gray-600">
                    {previewQ.isLoading ? (
                      'Calcul en cours…'
                    ) : (
                      <>
                        <strong className="text-[#8B5CF6]">{matchCount ?? 0}</strong>
                        {' '}client{(matchCount ?? 0) !== 1 ? 's' : ''} correspond
                        {(matchCount ?? 0) !== 1 ? 'ent' : ''} actuellement.
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Flow arrow */}
              <div className="flex justify-center">
                <ArrowRight size={16} className="text-gray-300 rotate-90" />
              </div>

              {/* Action */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                  <ArrowRight size={12} /> Action
                </div>
                <select
                  value={actionType}
                  onChange={(e) => onActionChange(e.target.value)}
                  className={inputCls + ' bg-white'}
                >
                  {ACTIONS.map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500">{action.description}</p>
                {action.fields.map((f) => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <ConfigInput
                      field={f}
                      value={actionConfig[f.key] ?? f.default}
                      onChange={(v) => setActionConfig((c) => ({ ...c, [f.key]: v }))}
                    />
                  </div>
                ))}
              </div>

              {/* Enabled */}
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${
                    enabled ? 'bg-[#8B5CF6]' : 'bg-gray-200'
                  }`}
                  style={{ height: 22 }}
                >
                  <span
                    className="absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-all"
                    style={{ left: enabled ? 20 : 2 }}
                  />
                </button>
                <span className="text-[12px] font-medium text-gray-700">
                  Automatisation active
                </span>
              </label>

              {save.isError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                  Erreur lors de l'enregistrement. Veuillez réessayer.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={!valid || save.isPending}>
                {save.isPending && <Loader2 size={13} className="animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Créer l\'automatisation'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AutomationFormModal;
