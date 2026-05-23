/**
 * FLOWTYM RMS — Modale création / édition d'un événement manuel.
 */
import React, { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import { useEventsStore } from '@/src/store/eventsStore';
import type { EventCategory, RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS } from '@/src/types/events';
import { scoreToLevel, aggregateImpact } from '@/src/services/event-impact.engine';

interface EventEditorModalProps {
  open: boolean;
  onClose: () => void;
  initial?: RMSMarketEvent | null;
  defaultDate?: string;
}

const EMPTY: Omit<RMSMarketEvent, 'id' | 'history' | 'createdAt' | 'updatedAt'> = {
  name: '',
  category: 'manual',
  status: 'active',
  city: 'Paris',
  zone: '',
  venue: '',
  country: 'FR',
  startDate: '',
  endDate: '',
  impact: { demand: 10, adr: 8, occupancy: 6, pickup: 9, revpar: 9, compression: 40, confidence: 70, level: 'medium' },
  influencePrice: 5,
  sources: ['manual'],
  primarySource: 'Manuel',
  rmsSynced: false,
};

export const EventEditorModal: React.FC<EventEditorModalProps> = ({ open, onClose, initial, defaultDate }) => {
  const { addEvent, updateEvent } = useEventsStore();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (initial) {
      setForm({ ...initial });
    } else if (defaultDate) {
      setForm({ ...EMPTY, startDate: defaultDate, endDate: defaultDate });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setForm({ ...EMPTY, startDate: today, endDate: today });
    }
  }, [initial, defaultDate, open]);

  if (!open) return null;

  const score = Math.round(aggregateImpact(form.impact));

  function submit() {
    if (!form.name || !form.startDate || !form.endDate) return;
    const level = scoreToLevel(score);
    const payload = { ...form, impact: { ...form.impact, level } };
    if (initial) {
      updateEvent(initial.id, payload as Partial<RMSMarketEvent>);
    } else {
      addEvent({
        ...payload,
        id: `evt_manual_${Date.now()}`,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as RMSMarketEvent);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[640px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-slate-900">
            {initial ? 'Modifier l\'événement' : 'Nouvel événement'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-3 text-[13px]">
          <Field label="Nom" className="col-span-2">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex. Salon Rétromobile"
              className="input"
            />
          </Field>
          <Field label="Catégorie">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as EventCategory })}
              className="input"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Statut">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as RMSMarketEvent['status'] })}
              className="input"
            >
              <option value="active">Actif</option>
              <option value="planned">Planifié</option>
              <option value="archived">Archivé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </Field>
          <Field label="Ville">
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Zone">
            <input
              type="text"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Début">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Fin">
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="input"
            />
          </Field>

          <div className="col-span-2 mt-1">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-2">Coefficients RMS</div>
            <div className="grid grid-cols-3 gap-2">
              <Slider label="Demande" value={form.impact.demand} onChange={(v) => setForm({ ...form, impact: { ...form.impact, demand: v } })} />
              <Slider label="ADR" value={form.impact.adr} onChange={(v) => setForm({ ...form, impact: { ...form.impact, adr: v } })} />
              <Slider label="Occupation" value={form.impact.occupancy} onChange={(v) => setForm({ ...form, impact: { ...form.impact, occupancy: v } })} />
              <Slider label="Pickup" value={form.impact.pickup} onChange={(v) => setForm({ ...form, impact: { ...form.impact, pickup: v } })} />
              <Slider label="RevPAR" value={form.impact.revpar} onChange={(v) => setForm({ ...form, impact: { ...form.impact, revpar: v } })} />
              <Slider label="Compression" value={form.impact.compression} max={100} onChange={(v) => setForm({ ...form, impact: { ...form.impact, compression: v } })} />
            </div>
          </div>

          <Field label="Influence prix (%)">
            <input
              type="number"
              value={form.influencePrice}
              onChange={(e) => setForm({ ...form, influencePrice: parseFloat(e.target.value || '0') })}
              className="input"
            />
          </Field>
          <Field label="Score IA estimé">
            <div className="px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-[13px] font-semibold ring-1 ring-violet-100">
              {score}/100 · {scoreToLevel(score)}
            </div>
          </Field>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/60">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </button>
        </div>

        <style>{`
          .input {
            width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
            background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
            outline: none; font-size: 13px;
          }
          .input:focus { box-shadow: inset 0 0 0 2px #7c3aed; }
        `}</style>
      </div>
    </div>
  );
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Slider({ label, value, onChange, max = 50 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between text-[11.5px] text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-900 tabular-nums">+{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-violet-600 mt-1"
      />
    </div>
  );
}
