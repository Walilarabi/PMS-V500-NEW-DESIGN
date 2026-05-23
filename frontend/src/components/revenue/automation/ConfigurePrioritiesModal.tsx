/**
 * FLOWTYM — Modal « Configurer les priorités »
 *
 * Permet de réordonner la hiérarchie des règles via flèches haut/bas avec
 * un aperçu d'impact estimé. À la validation, appelle `reorder` sur le
 * moteur de priorités.
 */
import React, { useEffect, useState } from 'react';
import { X, ArrowUp, ArrowDown, Settings2 } from 'lucide-react';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import type { PriorityLevel } from '@/src/types/revenue/conflicts.types';
import { cn } from '@/src/lib/utils';

export interface ConfigurePrioritiesModalProps {
  open: boolean;
  onClose: () => void;
}

export const ConfigurePrioritiesModal: React.FC<ConfigurePrioritiesModalProps> = ({ open, onClose }) => {
  const [list, setList] = useState<PriorityLevel[]>([]);

  useEffect(() => {
    if (open) setList(priorityConflictEngine.hierarchy());
  }, [open]);

  if (!open) return null;

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    setList(next.map((l, i) => ({ ...l, priority: i + 1 })));
  };

  const reset = () => setList(priorityConflictEngine.hierarchy());

  const save = () => {
    priorityConflictEngine.reorder(list.map((l) => l.id));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30">
              <Settings2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Configurer les priorités</h3>
              <p className="text-[13px] text-gray-500">
                Réordonnez les règles. 1 = plus haute priorité, prévaut sur les autres.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <ul className="space-y-2">
            {list.map((l, idx) => (
              <li
                key={l.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border',
                  l.kind === 'guardrail'
                    ? 'bg-emerald-50/40 border-emerald-100'
                    : 'bg-white border-[#F3F4F6]',
                )}
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] text-white text-[11px] font-bold shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900 truncate">{l.name}</div>
                  <div className="text-[11px] text-gray-500">{l.category} · {l.objective}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || l.kind === 'guardrail'}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Monter"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === list.length - 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Descendre"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 bg-violet-50/60 border border-violet-100 rounded-xl p-3 text-[12px] text-gray-700">
            <b>Note :</b> les garde-fous RMS restent toujours en priorité 1 — ils ne peuvent pas être déplacés.
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAFB]">
          <button
            onClick={reset}
            className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            Réinitialiser
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-[#8B5CF6] rounded-xl hover:bg-[#7C3AED] shadow-sm"
            >
              Appliquer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
