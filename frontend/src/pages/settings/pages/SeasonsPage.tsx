/**
 * FLOWTYM — Paramètres · Saisons tarifaires.
 */
import React from 'react';
import { Calendar } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

interface SeasonItem extends GenericListItem {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  priceModifier: number;   // % vs base
  tone: 'low' | 'mid' | 'high' | 'peak';
}

const DEFAULTS: SeasonItem[] = [
  { id: 'low',   label: 'Basse saison',    code: 'LOW',  active: true, startMonth: 1,  startDay: 5,  endMonth: 3,  endDay: 31, priceModifier: -15, tone: 'low' },
  { id: 'mid',   label: 'Moyenne saison',  code: 'MID',  active: true, startMonth: 4,  startDay: 1,  endMonth: 6,  endDay: 14, priceModifier: 0,   tone: 'mid' },
  { id: 'high',  label: 'Haute saison',    code: 'HIGH', active: true, startMonth: 6,  startDay: 15, endMonth: 9,  endDay: 15, priceModifier: 20,  tone: 'high' },
  { id: 'peak',  label: 'Très haute saison', code: 'PEAK', active: true, startMonth: 7, startDay: 14, endMonth: 8, endDay: 25, priceModifier: 45, tone: 'peak' },
  { id: 'xmas',  label: 'Fêtes fin d\'année', code: 'XMAS', active: true, startMonth: 12, startDay: 20, endMonth: 1, endDay: 4, priceModifier: 35, tone: 'peak' },
];

const MONTH_NAMES = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

const TONE_COLOR: Record<SeasonItem['tone'], string> = {
  low: 'bg-sky-100 text-sky-700',
  mid: 'bg-emerald-100 text-emerald-700',
  high: 'bg-amber-100 text-amber-700',
  peak: 'bg-rose-100 text-rose-700',
};

export const SeasonsPage: React.FC = () => (
  <GenericListPage<SeasonItem>
    icon={Calendar}
    category="Tarifs & Prestations"
    title="Saisons"
    description="Saisons tarifaires appliquées sur le Calendrier — modulateur de prix par période."
    storageKey="flowtym.seasons"
    module="rms_revenue"
    defaults={DEFAULTS}
    extraColumns={[
      { header: 'Période', render: (it) => `${it.startDay} ${MONTH_NAMES[it.startMonth - 1]} → ${it.endDay} ${MONTH_NAMES[it.endMonth - 1]}` },
      { header: 'Modulateur', render: (it) => (
        <span className={`px-1.5 py-0.5 rounded font-semibold tabular-nums ${TONE_COLOR[it.tone]}`}>
          {it.priceModifier > 0 ? '+' : ''}{it.priceModifier}%
        </span>
      ) },
    ]}
    extraFormFields={(item, set) => (
      <>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Début</span>
            <div className="flex gap-1.5 mt-1.5">
              <input type="number" min={1} max={31} value={item.startDay} onChange={(e) => set({ startDay: parseInt(e.target.value) || 1 })}
                className="w-1/2 px-2 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
              <select value={item.startMonth} onChange={(e) => set({ startMonth: parseInt(e.target.value) })}
                className="w-1/2 px-2 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Fin</span>
            <div className="flex gap-1.5 mt-1.5">
              <input type="number" min={1} max={31} value={item.endDay} onChange={(e) => set({ endDay: parseInt(e.target.value) || 1 })}
                className="w-1/2 px-2 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
              <select value={item.endMonth} onChange={(e) => set({ endMonth: parseInt(e.target.value) })}
                className="w-1/2 px-2 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Modulateur (%)</span>
            <input type="number" step={1} value={item.priceModifier} onChange={(e) => set({ priceModifier: parseInt(e.target.value) || 0 })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Tonalité</span>
            <select value={item.tone} onChange={(e) => set({ tone: e.target.value as SeasonItem['tone'] })}
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              <option value="low">Basse</option>
              <option value="mid">Moyenne</option>
              <option value="high">Haute</option>
              <option value="peak">Très haute</option>
            </select>
          </label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, startMonth: 1, startDay: 1, endMonth: 12, endDay: 31, priceModifier: 0, tone: 'mid' })}
    phase2="injection automatique des modulateurs dans le Calendrier tarifaire à chaque ouverture."
  />
);
