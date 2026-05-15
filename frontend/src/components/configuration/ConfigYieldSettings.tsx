import React, { useState } from 'react';
import { TrendingUp, ShieldAlert, Clock, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useConfigStore } from '../../store/configStore';
import type { PricingRule } from '../../store/configStore';

// ─── SECTION : OVERBOOKING ────────────────────────────────────────────────────

const OverbookingSection: React.FC = () => {
  const { overbooking, rooms, updateOverbooking } = useConfigStore();
  const categories = [...new Set(rooms.map(r => r.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-white rounded-3xl border border-[#E8EDF5] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
            <ShieldAlert size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Overbooking contrôlé</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Autoriser les réservations au-delà de la capacité réelle</p>
          </div>
        </div>
        <button
          onClick={() => updateOverbooking({ enabled: !overbooking.enabled })}
          className="flex items-center gap-2 transition-all"
        >
          {overbooking.enabled
            ? <ToggleRight size={36} className="text-emerald-500" />
            : <ToggleLeft size={36} className="text-slate-300" />}
        </button>
      </div>

      {overbooking.enabled && (
        <div className="space-y-4 pl-2">
          {/* Seuil global */}
          <div className="bg-white rounded-3xl border border-[#E8EDF5] p-6 shadow-sm">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
              Seuil global (% capacité supplémentaire)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={overbooking.globalThresholdPct}
                onChange={e => updateOverbooking({ globalThresholdPct: +e.target.value })}
                className="flex-1 h-2 rounded-full accent-[#8B5CF6]"
              />
              <div className="w-16 h-10 rounded-2xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-center">
                <span className="text-[15px] font-black text-[#7C3AED]">{overbooking.globalThresholdPct}%</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Avec {rooms.length} chambres → max autorisé : <strong className="text-slate-700">{Math.floor(rooms.length * (1 + overbooking.globalThresholdPct / 100))} chambres</strong>
            </p>
          </div>

          {/* Seuils par catégorie */}
          <div className="bg-white rounded-3xl border border-[#E8EDF5] p-6 shadow-sm">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
              Seuils par catégorie (surcharge le seuil global)
            </label>
            <div className="space-y-3">
              {categories.map(cat => {
                const val = overbooking.byCategory[cat] ?? overbooking.globalThresholdPct;
                const catRooms = rooms.filter(r => r.category === cat).length;
                return (
                  <div key={cat} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl">
                    <span className="text-[12px] font-black text-slate-700 w-12">{cat}</span>
                    <span className="text-[11px] text-slate-400">{catRooms} ch.</span>
                    <input
                      type="range" min={0} max={50} step={1} value={val}
                      onChange={e => updateOverbooking({ byCategory: { ...overbooking.byCategory, [cat]: +e.target.value } })}
                      className="flex-1 h-1.5 rounded-full accent-[#8B5CF6]"
                    />
                    <span className="text-[13px] font-black text-[#7C3AED] w-10 text-right">{val}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priorité en cas de conflit */}
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
            <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-3">Priorité de résolution des conflits</p>
            <div className="space-y-2">
              {[
                { priority: 4, label: 'Confirmée + Payée', color: 'bg-emerald-500' },
                { priority: 3, label: 'Confirmée', color: 'bg-indigo-500' },
                { priority: 2, label: 'Pending', color: 'bg-orange-400' },
                { priority: 1, label: 'Option (Hold)', color: 'bg-yellow-400' },
              ].map(p => (
                <div key={p.priority} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full ${p.color} flex items-center justify-center text-white text-[9px] font-black`}>{p.priority}</div>
                  <span className="text-[12px] font-bold text-amber-900">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SECTION : OPTIONS EXPIRATION ────────────────────────────────────────────

const OptionExpirySection: React.FC = () => {
  const { optionExpiry, rooms, updateOptionExpiry } = useConfigStore();
  const categories = [...new Set(rooms.map(r => r.category))];

  return (
    <div className="space-y-4">
      {/* Durée par défaut */}
      <div className="bg-white rounded-3xl border border-[#E8EDF5] p-6 shadow-sm">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
          Durée d'expiration par défaut (heures)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range" min={1} max={168} step={1}
            value={optionExpiry.defaultHours}
            onChange={e => updateOptionExpiry({ defaultHours: +e.target.value })}
            className="flex-1 h-2 rounded-full accent-[#8B5CF6]"
          />
          <div className="w-20 h-10 rounded-2xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-center">
            <span className="text-[15px] font-black text-[#7C3AED]">{optionExpiry.defaultHours}h</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Soit <strong className="text-slate-700">{(optionExpiry.defaultHours / 24).toFixed(1)} jour(s)</strong> — l'option sera automatiquement annulée après ce délai
        </p>
      </div>

      {/* Par catégorie */}
      <div className="bg-white rounded-3xl border border-[#E8EDF5] p-6 shadow-sm">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
          Durée par catégorie (surcharge le défaut)
        </label>
        <div className="space-y-3">
          {categories.map(cat => {
            const val = optionExpiry.byCategory[cat] ?? optionExpiry.defaultHours;
            return (
              <div key={cat} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl">
                <span className="text-[12px] font-black text-slate-700 w-12">{cat}</span>
                <input
                  type="range" min={1} max={168} step={1} value={val}
                  onChange={e => updateOptionExpiry({ byCategory: { ...optionExpiry.byCategory, [cat]: +e.target.value } })}
                  className="flex-1 h-1.5 rounded-full accent-[#8B5CF6]"
                />
                <span className="text-[13px] font-black text-[#7C3AED] w-10 text-right">{val}h</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── SECTION : RÈGLES TARIFAIRES ─────────────────────────────────────────────

const PricingRulesSection: React.FC = () => {
  const { pricingRules, eventMultipliers, updatePricingRule, deletePricingRule, addPricingRule, updateEventMultipliers } = useConfigStore();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const handleAdd = () => {
    const newRule: PricingRule = {
      id: `rule-custom-${Date.now()}`,
      name: 'Nouvelle règle',
      enabled: true,
      occupancyMin: 0,
      occupancyMax: 100,
      multiplier: 1.00,
      priority: pricingRules.length + 1,
    };
    addPricingRule(newRule);
    setExpandedRule(newRule.id);
  };

  return (
    <div className="space-y-6">
      {/* Multiplicateurs événements */}
      <div className="bg-white rounded-3xl border border-[#E8EDF5] p-6 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Multiplicateurs par impact d'événement</p>
        <div className="grid grid-cols-2 gap-4">
          {([
            { key: 'low', label: 'Faible', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { key: 'medium', label: 'Moyen', color: 'text-orange-600', bg: 'bg-orange-50' },
            { key: 'high', label: 'Élevé', color: 'text-red-600', bg: 'bg-red-50' },
            { key: 'critical', label: 'Critique', color: 'text-purple-700', bg: 'bg-purple-50' },
          ] as const).map(({ key, label, color, bg }) => (
            <div key={key} className={`${bg} rounded-2xl p-4`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${color} mb-2`}>{label}</p>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1.00} max={2.00} step={0.01}
                  value={eventMultipliers[key]}
                  onChange={e => updateEventMultipliers({ [key]: +e.target.value })}
                  className={`flex-1 h-1.5 rounded-full accent-[#8B5CF6]`}
                />
                <span className={`text-[14px] font-black ${color} w-14 text-right`}>
                  +{((eventMultipliers[key] - 1) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Règles occupation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Règles par taux d'occupation</p>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F3FF] text-[#7C3AED] text-[11px] font-black hover:bg-[#EDE9FE] transition-all"
          >
            <Plus size={12} /> Ajouter règle
          </button>
        </div>

        {pricingRules.map(rule => (
          <div key={rule.id} className="bg-white rounded-3xl border border-[#E8EDF5] shadow-sm overflow-hidden">
            {/* Header de la règle */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-all"
              onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
            >
              <button
                onClick={e => { e.stopPropagation(); updatePricingRule({ ...rule, enabled: !rule.enabled }); }}
                className="shrink-0"
              >
                {rule.enabled
                  ? <ToggleRight size={26} className="text-emerald-500" />
                  : <ToggleLeft size={26} className="text-slate-300" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-black text-slate-800 truncate">{rule.name}</span>
                  {rule.daysBeforeArrivalMax && (
                    <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase">Last-minute ≤J-{rule.daysBeforeArrivalMax}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] text-slate-400">TO {rule.occupancyMin}–{rule.occupancyMax}%</span>
                  <span className={`text-[10px] font-black ${rule.multiplier >= 1 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {rule.multiplier >= 1 ? '+' : ''}{((rule.multiplier - 1) * 100).toFixed(0)}% (×{rule.multiplier})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); deletePricingRule(rule.id); }}
                  className="w-7 h-7 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
                {expandedRule === rule.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </div>
            </div>

            {/* Contenu expandé */}
            {expandedRule === rule.id && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-50 space-y-4">
                {/* Nom */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nom</label>
                  <input
                    type="text" value={rule.name}
                    onChange={e => updatePricingRule({ ...rule, name: e.target.value })}
                    className="w-full h-10 px-4 rounded-2xl border border-[#EDE9FE] bg-[#F5F3FF] text-[13px] font-bold text-slate-800 focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>

                {/* Plage occupation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">TO Min (%)</label>
                    <input
                      type="number" min={0} max={100} value={rule.occupancyMin}
                      onChange={e => updatePricingRule({ ...rule, occupancyMin: +e.target.value })}
                      className="w-full h-10 px-4 rounded-2xl border border-[#EDE9FE] bg-[#F5F3FF] text-[13px] font-bold text-slate-800 focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">TO Max (%)</label>
                    <input
                      type="number" min={0} max={100} value={rule.occupancyMax}
                      onChange={e => updatePricingRule({ ...rule, occupancyMax: +e.target.value })}
                      className="w-full h-10 px-4 rounded-2xl border border-[#EDE9FE] bg-[#F5F3FF] text-[13px] font-bold text-slate-800 focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                </div>

                {/* Multiplicateur */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    Multiplicateur — {rule.multiplier >= 1 ? '+' : ''}{((rule.multiplier - 1) * 100).toFixed(0)}% (×{rule.multiplier})
                  </label>
                  <input
                    type="range" min={0.50} max={3.00} step={0.01} value={rule.multiplier}
                    onChange={e => updatePricingRule({ ...rule, multiplier: +e.target.value })}
                    className="w-full h-2 rounded-full accent-[#8B5CF6]"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-slate-300">−50%</span>
                    <span className="text-[9px] text-slate-300">Base</span>
                    <span className="text-[9px] text-slate-300">+200%</span>
                  </div>
                </div>

                {/* Last-minute */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    Last-minute (jours avant arrivée, 0 = désactivé)
                  </label>
                  <input
                    type="number" min={0} max={30} value={rule.daysBeforeArrivalMax ?? 0}
                    onChange={e => updatePricingRule({ ...rule, daysBeforeArrivalMax: +e.target.value || undefined })}
                    className="w-32 h-10 px-4 rounded-2xl border border-[#EDE9FE] bg-[#F5F3FF] text-[13px] font-bold text-slate-800 focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────

interface Props {
  activeTab: string;
}

const TABS = ['overbooking', 'options_expiry', 'pricing_rules'];

export const ConfigYieldSettings: React.FC<Props> = ({ activeTab }) => {
  if (!TABS.includes(activeTab)) return null;

  const sectionTitle: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
    overbooking: {
      title: 'Overbooking Contrôlé',
      subtitle: 'Définir les seuils et la priorisation',
      icon: <ShieldAlert size={22} className="text-red-500" />,
    },
    options_expiry: {
      title: 'Expiration des Options',
      subtitle: 'Durée avant annulation automatique',
      icon: <Clock size={22} className="text-amber-500" />,
    },
    pricing_rules: {
      title: 'Revenue Management Dynamique',
      subtitle: 'Règles de tarification automatique',
      icon: <TrendingUp size={22} className="text-emerald-500" />,
    },
  };

  const { title, subtitle, icon } = sectionTitle[activeTab];

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex items-center gap-4 pb-6 border-b border-[#E8EDF5]">
        <div className="w-12 h-12 rounded-3xl bg-[#F5F3FF] flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</p>
        </div>
      </div>

      {activeTab === 'overbooking'     && <OverbookingSection />}
      {activeTab === 'options_expiry'  && <OptionExpirySection />}
      {activeTab === 'pricing_rules'   && <PricingRulesSection />}
    </div>
  );
};
