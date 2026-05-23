/**
 * FLOWTYM — Modal de détail d'un conflit
 */
import React from 'react';
import { X, Brain, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import type { Conflict } from '@/src/types/revenue/conflicts.types';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { cn } from '@/src/lib/utils';

export interface ConflictDetailModalProps {
  conflict: Conflict | null;
  onClose: () => void;
}

export const ConflictDetailModal: React.FC<ConflictDetailModalProps> = ({ conflict, onClose }) => {
  if (!conflict) return null;

  const RISK_COLOR = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    high: 'bg-rose-50 text-rose-700 border-rose-100',
  }[conflict.riskLevel];

  const handleApply = () => {
    priorityConflictEngine.resolveConflict(conflict.id, 'apply_recommendation');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Détail du conflit</h3>
              <p className="text-[13px] text-gray-500">
                Détecté le {new Date(conflict.detectedAt).toLocaleString('fr-FR')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-md border', RISK_COLOR)}>
                  Risque {conflict.riskLevel === 'low' ? 'faible' : conflict.riskLevel === 'medium' ? 'modéré' : 'élevé'}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#F3F4F6] text-gray-700">
                  Impact {conflict.potentialImpact}€
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <section>
            <h4 className="text-[12px] uppercase tracking-wider font-semibold text-gray-500 mb-3">Règles concernées</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {conflict.participants.map((p, i) => (
                <div key={i} className="border border-[#F3F4F6] rounded-2xl p-4 bg-[#FAFAFB]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-xl bg-white border border-[#F3F4F6] text-gray-700">
                      <Shield size={14} />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">{p.name}</div>
                      <div className="text-[11px] text-gray-500">Priorité {p.priority} • {p.kind}</div>
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-600">Intention : {p.intent}</p>
                </div>
              ))}
            </div>
          </section>

          {conflict.winner && (
            <section className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5" />
                <div>
                  <div className="text-[12px] uppercase tracking-wider font-semibold text-emerald-700 mb-1">Règle gagnante</div>
                  <div className="text-[14px] font-bold text-emerald-900">{conflict.winner.name}</div>
                  {conflict.suspended && (
                    <div className="text-[12px] text-emerald-700 mt-1">
                      Suspendue : <span className="font-semibold">{conflict.suspended.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="bg-violet-50/60 border border-violet-100 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <Brain size={16} className="text-violet-600 mt-0.5" />
              <div>
                <div className="text-[12px] uppercase tracking-wider font-semibold text-violet-700 mb-1">Justification IA</div>
                <p className="text-[13px] text-gray-700">{conflict.iaJustification}</p>
              </div>
            </div>
          </section>

          <section className="border border-[#F3F4F6] rounded-2xl p-4">
            <div className="text-[12px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Action recommandée</div>
            <p className="text-[14px] font-semibold text-gray-900">{conflict.recommendedAction}</p>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAFB]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Fermer
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#8B5CF6] rounded-xl hover:bg-[#7C3AED] shadow-sm"
          >
            Appliquer la recommandation
          </button>
        </div>
      </div>
    </div>
  );
};
