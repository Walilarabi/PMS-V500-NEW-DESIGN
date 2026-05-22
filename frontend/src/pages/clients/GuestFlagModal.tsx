/**
 * FLOWTYM — Guest Flag Modal (Wave C5)
 *
 * Edit risk level, blacklist/VIP flags, satisfaction score and notes.
 * Also allows logging new incidents and shows the incident history.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ShieldAlert, Sparkles, Plus, Loader2,
  AlertTriangle, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import {
  useFlagGuest,
  useAddIncident,
  useGuestIncidents,
} from '@/src/services/crm/hooks';
import {
  RISK_LEVELS,
  INCIDENT_TYPES,
} from '@/src/services/crm/risk.service';
import type { GuestRowDto } from '@/src/domains/guests/schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (g: GuestRowDto) =>
  [g.first_name, g.last_name]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join('');

const npsLabel = (score: number | null) => {
  if (score === null) return null;
  if (score >= 9) return { text: 'Promoteur', color: '#10B981' };
  if (score >= 7) return { text: 'Passif', color: '#F59E0B' };
  return { text: 'Détracteur', color: '#EF4444' };
};

const today = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  guest: GuestRowDto;
  onClose: () => void;
}

export const GuestFlagModal: React.FC<Props> = ({ guest, onClose }) => {
  // Flag form state
  const [blacklisted,  setBlacklisted]  = useState(!!guest.blacklisted);
  const [vip,          setVip]          = useState(!!guest.vip);
  const [riskLevel,    setRiskLevel]    = useState(guest.risk_level ?? 'low');
  const [score,        setScore]        = useState<number | null>(guest.satisfaction_score ?? null);
  const [notes,        setNotes]        = useState(guest.notes ?? '');

  // Incident form state
  const [showIncForm,  setShowIncForm]  = useState(false);
  const [incType,      setIncType]      = useState('behavior');
  const [incDesc,      setIncDesc]      = useState('');
  const [incDate,      setIncDate]      = useState(today());

  const flagMutation    = useFlagGuest();
  const addIncMutation  = useAddIncident(guest.id);
  const incidentsQ      = useGuestIncidents(guest.id);
  const incidents       = incidentsQ.data ?? [];

  const handleSaveFlags = async (e: React.FormEvent) => {
    e.preventDefault();
    await flagMutation.mutateAsync({
      guest_id:           guest.id,
      blacklisted,
      risk_level:         riskLevel,
      vip,
      notes:              notes.trim() || null,
      satisfaction_score: score,
    });
    onClose();
  };

  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incDesc.trim()) return;
    await addIncMutation.mutateAsync({ type: incType, description: incDesc.trim(), incident_date: incDate });
    setIncDesc('');
    setIncDate(today());
    setShowIncForm(false);
    // Risk level may have been auto-escalated — reflect in form
    const nextRisk =
      riskLevel === 'low' && ['behavior', 'damage', 'payment_issue'].includes(incType)
        ? 'medium'
        : riskLevel === 'medium' && ['behavior', 'damage'].includes(incType)
        ? 'high'
        : riskLevel;
    setRiskLevel(nextRisk);
  };

  const riskMeta = RISK_LEVELS.find((r) => r.key === riskLevel)!;
  const nps = npsLabel(score);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[13px] font-bold text-[#8B5CF6]">
                {initials(guest)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {[guest.first_name, guest.last_name].filter(Boolean).join(' ') || guest.last_name}
                </p>
                <p className="text-[11px] text-gray-400">{guest.email ?? guest.phone ?? '—'}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Flags form */}
            <form id="flag-form" onSubmit={handleSaveFlags} className="p-6 space-y-5">
              {/* Toggle chips */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setVip((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-all ${
                    vip
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Sparkles size={12} /> VIP
                </button>
                <button
                  type="button"
                  onClick={() => setBlacklisted((b) => !b)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-all ${
                    blacklisted
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <ShieldAlert size={12} /> Blacklisté
                </button>
              </div>

              {/* Risk level */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Niveau de risque
                </p>
                <div className="flex gap-2">
                  {RISK_LEVELS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRiskLevel(r.key)}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all"
                      style={
                        riskLevel === r.key
                          ? { background: r.bg, color: r.color, borderColor: r.color }
                          : { background: '#F9FAFB', color: '#9CA3AF', borderColor: 'transparent' }
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Satisfaction score */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Score de satisfaction (0–10)
                  </p>
                  {nps && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${nps.color}1A`, color: nps.color }}
                    >
                      {nps.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={score ?? 5}
                    onChange={(e) => setScore(parseInt(e.target.value, 10))}
                    className="flex-1 accent-[#8B5CF6]"
                  />
                  <div className="w-10 text-center">
                    {score !== null ? (
                      <span className="text-lg font-bold text-gray-900">{score}</span>
                    ) : (
                      <span className="text-lg font-bold text-gray-300">—</span>
                    )}
                  </div>
                  {score !== null && (
                    <button
                      type="button"
                      onClick={() => setScore(null)}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      Effacer
                    </button>
                  )}
                  {score === null && (
                    <button
                      type="button"
                      onClick={() => setScore(5)}
                      className="text-[10px] text-[#8B5CF6] hover:text-[#7C3AED] font-bold"
                    >
                      Définir
                    </button>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Notes internes
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={inputCls + ' resize-none'}
                  placeholder="Motif de signalement, historique, observations…"
                />
              </div>

              {flagMutation.isError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                  Erreur lors de l'enregistrement. Veuillez réessayer.
                </p>
              )}
            </form>

            {/* Incidents section */}
            <div className="px-6 pb-6 border-t border-gray-100 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  Incidents ({incidents.length})
                </p>
                <button
                  type="button"
                  onClick={() => setShowIncForm((v) => !v)}
                  className="flex items-center gap-1 text-[12px] font-bold text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
                >
                  <Plus size={13} />
                  {showIncForm ? 'Annuler' : 'Signaler'}
                  {showIncForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {showIncForm && (
                <form
                  onSubmit={handleAddIncident}
                  className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Type
                      </label>
                      <select
                        value={incType}
                        onChange={(e) => setIncType(e.target.value)}
                        className={inputCls + ' bg-white text-sm'}
                      >
                        {INCIDENT_TYPES.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={incDate}
                        onChange={(e) => setIncDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                      Description
                    </label>
                    <textarea
                      required
                      value={incDesc}
                      onChange={(e) => setIncDesc(e.target.value)}
                      rows={2}
                      className={inputCls + ' resize-none'}
                      placeholder="Décrivez l'incident…"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={addIncMutation.isPending}>
                      {addIncMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                      Enregistrer l'incident
                    </Button>
                  </div>
                </form>
              )}

              {/* Incident history */}
              {incidentsQ.isLoading ? (
                <div className="text-[11px] text-gray-400 text-center py-3">Chargement…</div>
              ) : incidents.length === 0 ? (
                <div className="text-[11px] text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-xl">
                  Aucun incident enregistré.
                </div>
              ) : (
                <div className="space-y-2">
                  {incidents.map((inc) => {
                    const typeMeta = INCIDENT_TYPES.find((t) => t.key === inc.type);
                    return (
                      <div
                        key={inc.id}
                        className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="p-1.5 rounded-lg bg-red-50 shrink-0">
                          <AlertTriangle size={12} className="text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-gray-700">
                              {typeMeta?.label ?? inc.type}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              <Calendar size={9} /> {inc.incident_date}
                            </span>
                          </div>
                          {inc.description && (
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                              {inc.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" form="flag-form" size="sm" disabled={flagMutation.isPending}>
              {flagMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GuestFlagModal;
