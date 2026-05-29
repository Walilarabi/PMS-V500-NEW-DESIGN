/**
 * FLOWTYM RMS — Paramétrage des garde-fous de l'Autopilote.
 *
 * Bornes tarifaires, variations max, seuil de confiance IA, seuils de TO,
 * règles de lead time, règles de séjour (LOS / Min Stay / CTA / CTD),
 * exceptions (chambre / canal / période), protection des événements et
 * stratégie de fallback.
 */

import React, { useState } from 'react';
import {
  Shield, ArrowDownToLine, ArrowUpToLine, Activity, Percent, Brain,
  Gauge, Clock, CalendarX, BedDouble, Radio, ShieldCheck, LifeBuoy,
  Plus, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRmsAutomationStore } from '@/src/store/rmsAutomationStore';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import { STRATEGIES } from '@/src/lib/rms/strategies';

const OTA_CHANNELS = ['Direct', 'Booking.com', 'Expedia', 'Airbnb', 'Hotels.com', 'Agoda', 'GDS'];
import type { AutopilotParams } from '@/src/lib/rms/autoStrategyEngine';

const Section: React.FC<{
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-gray-200/80 p-3.5">
    <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-gray-700 mb-2.5">
      <Icon className="w-3.5 h-3.5 text-[#8B5CF6]" />
      {title}
    </div>
    {children}
  </div>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, suffix, step = 1, onChange }) => (
  <label className="flex items-center justify-between gap-2">
    <span className="text-[11.5px] text-gray-500">{label}</span>
    <span className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-[12.5px] font-semibold text-gray-800 text-right"
      />
      {suffix && <span className="text-[11px] text-gray-400 w-6">{suffix}</span>}
    </span>
  </label>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
      checked ? 'bg-[#8B5CF6]' : 'bg-gray-200'
    }`}
  >
    <span
      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
        checked ? 'left-[18px]' : 'left-0.5'
      }`}
    />
  </button>
);

const Chips: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}> = ({ options, selected, onToggle }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => {
      const on = selected.includes(opt);
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
            on
              ? 'border-[#8B5CF6] bg-[#8B5CF6]/[0.07] text-[#8B5CF6]'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

export const GuardrailsPanel: React.FC = () => {
  const params = useRmsAutomationStore((s) => s.params);
  const updateParams = useRmsAutomationStore((s) => s.updateParams);
  const roomTypes = useRateCalendarStore((s) => s.roomTypes.map((r) => r.roomTypeName));
  const [draft, setDraft] = useState({ label: '', from: '', to: '' });

  const set = <K extends keyof AutopilotParams>(key: K, value: AutopilotParams[K]) =>
    updateParams({ [key]: value } as Partial<AutopilotParams>);

  const toggleIn = (key: 'roomTypeExceptions' | 'channelExceptions', value: string) => {
    const list = params[key];
    set(key, list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const addPeriod = () => {
    if (!draft.label || !draft.from || !draft.to) return;
    set('periodExceptions', [
      ...params.periodExceptions,
      { id: `per-${Date.now().toString(36)}`, ...draft },
    ]);
    setDraft({ label: '', from: '', to: '' });
  };

  const stayRuleLabels: { key: keyof AutopilotParams['stayRules']; label: string }[] = [
    { key: 'los', label: 'LOS — Length of Stay' },
    { key: 'minStay', label: 'Min Stay' },
    { key: 'cta', label: 'CTA — Closed To Arrival' },
    { key: 'ctd', label: 'CTD — Closed To Departure' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
          <Shield className="w-4.5 h-4.5 text-violet-600" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-gray-900">Garde-fous de l'Autopilote</h3>
          <p className="text-[12px] text-gray-500">
            Limites de sécurité appliquées avant toute action automatique.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Bornes tarifaires */}
        <Section icon={ArrowDownToLine} title="Bornes tarifaires">
          <div className="space-y-2">
            <NumberField
              label="Tarif plancher"
              value={params.floorRate}
              suffix="€"
              onChange={(v) => set('floorRate', v)}
            />
            <NumberField
              label="Tarif plafond"
              value={params.ceilingRate}
              suffix="€"
              onChange={(v) => set('ceilingRate', v)}
            />
          </div>
        </Section>

        {/* Variations max */}
        <Section icon={Activity} title="Variation maximale / jour">
          <div className="space-y-2">
            <NumberField
              label="Variation max (absolue)"
              value={params.maxDailyVariationAbs}
              suffix="€"
              onChange={(v) => set('maxDailyVariationAbs', v)}
            />
            <NumberField
              label="Variation max (%)"
              value={params.maxDailyVariationPct}
              suffix="%"
              onChange={(v) => set('maxDailyVariationPct', v)}
            />
          </div>
        </Section>

        {/* Confiance IA */}
        <Section icon={Brain} title="Seuil de confiance IA">
          <NumberField
            label="Confiance minimale"
            value={params.minConfidence}
            suffix="%"
            onChange={(v) => set('minConfidence', v)}
          />
          <p className="text-[10.5px] text-gray-400 mt-1.5 leading-snug">
            En deçà de ce seuil, aucune validation automatique n'est exécutée.
          </p>
        </Section>

        {/* Seuils de TO */}
        <Section icon={Gauge} title="Seuils d'occupation">
          <div className="space-y-2">
            <NumberField
              label="TO minimum"
              value={params.minOccupancy}
              suffix="%"
              onChange={(v) => set('minOccupancy', v)}
            />
            <NumberField
              label="TO maximum"
              value={params.maxOccupancy}
              suffix="%"
              onChange={(v) => set('maxOccupancy', v)}
            />
          </div>
        </Section>

        {/* Lead time */}
        <Section icon={Clock} title="Règles de lead time">
          <div className="space-y-2">
            <NumberField
              label="Fenêtre courte (≤ j)"
              value={params.shortLeadDays}
              suffix="j"
              onChange={(v) => set('shortLeadDays', v)}
            />
            <NumberField
              label="Variation max fenêtre courte"
              value={params.shortLeadMaxPct}
              suffix="%"
              onChange={(v) => set('shortLeadMaxPct', v)}
            />
          </div>
        </Section>

        {/* Règles de séjour */}
        <Section icon={CalendarX} title="Règles LOS / Min Stay / CTA / CTD">
          <div className="space-y-1.5">
            {stayRuleLabels.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] text-gray-600">{r.label}</span>
                <Toggle
                  checked={params.stayRules[r.key]}
                  onChange={(v) => set('stayRules', { ...params.stayRules, [r.key]: v })}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Protection événements */}
        <Section icon={ShieldCheck} title="Protection des événements">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-gray-600 leading-snug">
              Exclure les dates événementielles de l'automatisation
            </span>
            <Toggle
              checked={params.protectEvents}
              onChange={(v) => set('protectEvents', v)}
            />
          </div>
        </Section>

        {/* Fallback */}
        <Section icon={LifeBuoy} title="Stratégie de fallback">
          <select
            value={params.fallbackStrategy}
            onChange={(e) =>
              set('fallbackStrategy', e.target.value as AutopilotParams['fallbackStrategy'])
            }
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[12px] font-semibold text-gray-800"
          >
            <option value="hold">Geler les tarifs (hold)</option>
            {STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-[10.5px] text-gray-400 mt-1.5 leading-snug">
            Appliquée si une donnée marché devient incohérente ou indisponible.
          </p>
        </Section>

        {/* Exception chambre */}
        <Section icon={BedDouble} title="Exceptions par type de chambre">
          <Chips
            options={roomTypes.length > 0 ? roomTypes : ['Standard', 'Supérieure', 'Deluxe', 'Suite']}
            selected={params.roomTypeExceptions}
            onToggle={(v) => toggleIn('roomTypeExceptions', v)}
          />
        </Section>

        {/* Exception canal */}
        <Section icon={Radio} title="Exceptions par canal">
          <Chips
            options={OTA_CHANNELS}
            selected={params.channelExceptions}
            onToggle={(v) => toggleIn('channelExceptions', v)}
          />
        </Section>

        {/* Exception période */}
        <div className="md:col-span-2 xl:col-span-1 rounded-xl border border-gray-200/80 p-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-gray-700 mb-2.5">
            <CalendarX className="w-3.5 h-3.5 text-[#8B5CF6]" />
            Exceptions par période
          </div>
          <div className="space-y-1.5">
            {params.periodExceptions.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] font-semibold text-gray-700 truncate">
                    {p.label}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {p.from} → {p.to}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      'periodExceptions',
                      params.periodExceptions.filter((x) => x.id !== p.id),
                    )
                  }
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {params.periodExceptions.length === 0 && (
              <p className="text-[11px] text-gray-400">Aucune période exclue.</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="text"
              placeholder="Libellé"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1 text-[11.5px]"
            />
            <input
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              className="rounded-lg border border-gray-200 px-1.5 py-1 text-[11px]"
            />
            <input
              type="date"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              className="rounded-lg border border-gray-200 px-1.5 py-1 text-[11px]"
            />
            <button
              type="button"
              onClick={addPeriod}
              className="w-7 h-7 rounded-lg bg-[#8B5CF6] text-white flex items-center justify-center shrink-0 hover:bg-[#7C3AED]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
