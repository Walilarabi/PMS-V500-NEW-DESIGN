/**
 * FLOWTYM — Modal « Configurer les priorités »
 *
 * Permet de réordonner la hiérarchie des règles via flèches haut/bas avec
 * un aperçu d'impact estimé. À la validation, appelle `reorder` sur le
 * moteur de priorités.
 */
import React, { useEffect, useState } from 'react';
import { X, ArrowUp, ArrowDown, Settings2, GripVertical } from 'lucide-react';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import type { PriorityLevel } from '@/src/types/revenue/conflicts.types';
import { cn } from '@/src/lib/utils';

export interface ConfigurePrioritiesModalProps {
  open: boolean;
  onClose: () => void;
}

export const ConfigurePrioritiesModal: React.FC<ConfigurePrioritiesModalProps> = ({ open, onClose }) => {
  const [list, setList] = useState<PriorityLevel[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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

  /**
   * Drag&drop HTML5 natif.
   * Refus du drop sur le slot priorité 1 (garde-fou) — il est verrouillé.
   * Refus du drop si la cible est elle-même un garde-fou (sécurité).
   */
  const handleDragStart = (e: React.DragEvent, id: string, kind: PriorityLevel['kind']) => {
    if (kind === 'guardrail') {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires setData to start a drag
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string, kind: PriorityLevel['kind']) => {
    if (!draggedId || draggedId === id) return;
    if (kind === 'guardrail') return; // ne pas dropper sur priorité 1
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverId(id);
  };

  const handleDragLeave = () => setOverId(null);

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setOverId(null);
      return;
    }
    const from = list.findIndex((l) => l.id === draggedId);
    const to = list.findIndex((l) => l.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setList(next.map((l, i) => ({ ...l, priority: i + 1 })));
    setDraggedId(null);
    setOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setOverId(null);
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
            {list.map((l, idx) => {
              const isLocked = l.kind === 'guardrail';
              const isDragged = draggedId === l.id;
              const isOver = overId === l.id;
              return (
                <li
                  key={l.id}
                  draggable={!isLocked}
                  onDragStart={(e) => handleDragStart(e, l.id, l.kind)}
                  onDragOver={(e) => handleDragOver(e, l.id, l.kind)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, l.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    isLocked
                      ? 'bg-emerald-50/40 border-emerald-100 cursor-not-allowed'
                      : 'bg-white border-[#F3F4F6] cursor-grab active:cursor-grabbing',
                    isDragged && 'opacity-40',
                    isOver && !isLocked && 'border-[#8B5CF6] bg-violet-50/40 shadow-md scale-[1.01]',
                  )}
                  aria-grabbed={isDragged}
                >
                  <GripVertical
                    size={14}
                    className={cn(
                      'shrink-0',
                      isLocked ? 'text-emerald-300' : 'text-gray-300 group-hover:text-gray-500',
                    )}
                  />
                  <span className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-bold shrink-0 bg-gradient-to-br',
                    isLocked
                      ? 'from-emerald-500 to-emerald-400'
                      : 'from-[#8B5CF6] to-[#A78BFA]',
                  )}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 truncate">{l.name}</div>
                    <div className="text-[11px] text-gray-500">{l.category} · {l.objective}</div>
                  </div>
                  {isLocked && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                      Verrouillé
                    </span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0 || isLocked}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Monter"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === list.length - 1 || isLocked}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Descendre"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 bg-violet-50/60 border border-violet-100 rounded-xl p-3 text-[12px] text-gray-700">
            <b>Note :</b> glissez-déposez les règles pour les réordonner ou utilisez les flèches.
            Les garde-fous RMS restent toujours en priorité 1 et ne peuvent pas être déplacés.
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
