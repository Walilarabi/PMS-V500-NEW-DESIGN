import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";
import { Tag, Plus, Pencil, Trash2, X, Copy, CheckCircle2, Info, Calculator } from "lucide-react";
import { PensionType, ChannelType, CalcMode, ConnectivityType, RatePlanData } from "../types";

const PENSION_OPTIONS: PensionType[] = ["RO", "BB", "HB", "FB", "AI", "Package"];
const CHANNEL_OPTIONS: ChannelType[] = ["OTA", "Mobile", "Corporate", "Direct"];
const CONNECTIVITY_OPTIONS: ConnectivityType[] = ["D-EDGE", "ChannelManager", "Aucun"];
const DIST_CHANNELS = ["Booking.com", "Expedia", "Agoda", "Airbnb", "Trip.com", "Direct", "HRS", "Hotelbeds"];

function MultiCheck({ label, options, selected, onChange }: { label: string; options: { id: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = selected.includes(o.id);
          return <button key={o.id} onClick={() => onChange(active ? selected.filter(s => s !== o.id) : [...selected, o.id])} className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors", active ? "border-violet-500 bg-violet-500 text-white" : "border-gray-200 text-gray-500 hover:border-violet-300 hover:bg-violet-50")}>{o.label}</button>;
        })}
      </div>
    </div>
  );
}

export function RateManagerPanel() {
  const { 
    roomTypes, addRatePlan, updateRatePlan, deleteRatePlan, 
    toggleRatePlanActive, duplicateRatePlan,
    ratePanelOpen, closeAllPanels, editingPlanId, editingRoomId
  } = useRateCalendarStore();
  
  const [showForm, setShowForm] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null);
  
  const ref = useRef<HTMLDivElement>(null);

  // Form state normalized to 2 modes
  const blank = { 
    name: "", code: "", 
    pensionType: "RO" as PensionType, 
    channelType: "OTA" as ChannelType, 
    calcMode: "fixed" as CalcMode, 
    calcValue: 0, // Used for fixed amount in derived
    calcPercent: 0, // Used for percent in derived
    referencePlanId: "", 
    connectivityType: "Aucun" as ConnectivityType, 
    assignedRoomTypeIds: [] as string[], 
    distributionChannels: ["Booking.com", "Direct"] as string[] 
  };
  const [form, setForm] = useState(blank);

  const allPlans = useMemo(() => Array.from(new Map(roomTypes.flatMap(rt => rt.ratePlans.map(rp => [rp.planId, rp]))).values()), [roomTypes]);

  // Handle outside panel trigger (from grid click)
  useEffect(() => {
    if (ratePanelOpen && editingPlanId) {
      setSelectedPlanKey(editingPlanId);
      openEdit(editingRoomId || roomTypes[0]?.roomTypeId || "", editingPlanId);
    } else if (ratePanelOpen) {
      setShowForm(false);
      setSelectedPlanKey(null);
    }
  }, [ratePanelOpen, editingPlanId, editingRoomId]);

  const openAdd = () => { 
    setForm({ ...blank, referencePlanId: allPlans[0]?.planId ?? "" }); 
    setSelectedPlanKey(null); 
    setShowForm(true); 
  };

  const openEdit = (rtId: string, pId: string) => {
    const plan = roomTypes.find(r => r.roomTypeId === rtId)?.ratePlans.find(p => p.planId === pId);
    if (!plan) return;
    
    // Convert old calcValue logic if necessary (mock data might still have old values)
    const isOldPercent = (plan.calcMode as any) === "percent_ref";
    const isOldFixedAdj = (plan.calcMode as any) === "fixed_adjusted";
    
    setForm({ 
      name: plan.planName, 
      code: plan.planCode, 
      pensionType: plan.pensionType, 
      channelType: plan.channelType, 
      calcMode: (isOldPercent || isOldFixedAdj) ? "derived" : plan.calcMode, 
      calcValue: isOldFixedAdj ? plan.calcValue : 0, 
      calcPercent: isOldPercent ? plan.calcValue : 0,
      referencePlanId: plan.referencePlanId, 
      connectivityType: plan.connectivityType, 
      assignedRoomTypeIds: plan.assignedRoomTypeIds, 
      distributionChannels: plan.distributionChannels 
    });
    setSelectedPlanKey(pId);
    setShowForm(true);
  };

  const submit = useCallback(() => {
    if (!form.name.trim() || !form.code.trim()) return;
    
    // Format payload for store
    const payload = {
      planName: form.name.trim(),
      planCode: form.code.trim().toUpperCase(),
      pensionType: form.pensionType,
      channelType: form.channelType,
      calcMode: form.calcMode,
      // Store needs to handle both values if derived
      calcValue: form.calcMode === "derived" ? form.calcValue : 0,
      calcPercent: form.calcMode === "derived" ? form.calcPercent : 0,
      referencePlanId: form.referencePlanId,
      connectivityType: form.connectivityType,
      assignedRoomTypeIds: form.assignedRoomTypeIds.length > 0 ? form.assignedRoomTypeIds : roomTypes.map(r => r.roomTypeId),
      distributionChannels: form.distributionChannels,
    };

    if (selectedPlanKey && editingPlanId) {
      updateRatePlan({ ...payload, planId: selectedPlanKey });
    } else {
      // Dummy values for missing NewRatePlanPayload requirements not used in simplified form
      addRatePlan({ ...payload, minStay: null, maxStay: null, cancellationPolicy: "", mealPlan: form.pensionType } as any);
    }
    setShowForm(false);
  }, [form, selectedPlanKey, editingPlanId, addRatePlan, updateRatePlan, roomTypes]);

  // Derived calculation preview
  const previewResult = useMemo(() => {
    if (form.calcMode === "fixed") return "Prix saisi manuellement";
    const refBase = 100.00;
    const percentAdj = refBase * (form.calcPercent / 100);
    const final = refBase + percentAdj + form.calcValue;
    return `${final.toFixed(2)}€ (pour une base de 100€)`;
  }, [form.calcMode, form.calcPercent, form.calcValue]);

  const flatPlans = useMemo(() => allPlans.map(p => {
    const rooms = roomTypes.filter(rt => rt.ratePlans.some(rp => rp.planId === p.planId));
    const firstRoom = rooms[0];
    const planInRoom = firstRoom?.ratePlans.find(rp => rp.planId === p.planId);
    return { plan: p, rooms, planInRoom };
  }), [allPlans, roomTypes]);

  if (!ratePanelOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={closeAllPanels} />
      
      <div ref={ref} className="relative h-screen w-[850px] max-w-full bg-white shadow-2xl flex flex-col animate-drawer-in">
        {/* Header */}
        <div className="bg-violet-500 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-white text-lg">Gestion des grilles tarifaires</h3>
            <p className="text-violet-100 text-xs mt-0.5">Configurez vos stratégies de prix et leur distribution</p>
          </div>
          <div className="flex items-center gap-3">
            {!showForm && (
              <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 text-white px-4 py-2 text-sm font-semibold transition-colors">
                <Plus className="w-4 h-4" /> Créer un tarif
              </button>
            )}
            <button onClick={closeAllPanels} className="text-white/70 hover:text-white transition-colors p-1"><X className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showForm ? (
            <div className="flex-1 overflow-auto bg-slate-50 p-6">
              <div className="mx-auto max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">{selectedPlanKey ? "Modifier le tarif" : "Nouveau tarif"}</h4>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest"><Info className="w-3 h-3" /> Fiche de configuration</div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nom du tarif *</label>
                      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all" placeholder="Ex: Flexible RO" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Code tarif *</label>
                      <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 font-mono transition-all" placeholder="FLEX_RO" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Pension</label>
                      <select value={form.pensionType} onChange={e => setForm(f => ({ ...f, pensionType: e.target.value as PensionType }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 transition-all">{PENSION_OPTIONS.map(p => <option key={p}>{p}</option>)}</select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Canal</label>
                      <select value={form.channelType} onChange={e => setForm(f => ({ ...f, channelType: e.target.value as ChannelType }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 transition-all">{CHANNEL_OPTIONS.map(c => <option key={c}>{c}</option>)}</select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Connectivité</label>
                      <select value={form.connectivityType} onChange={e => setForm(f => ({ ...f, connectivityType: e.target.value as ConnectivityType }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 transition-all">{CONNECTIVITY_OPTIONS.map(c => <option key={c}>{c}</option>)}</select>
                    </div>
                  </div>

                  {/* Normalized Calculation Section */}
                  <div className="bg-violet-50/50 rounded-2xl border border-violet-100 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-violet-900 flex items-center gap-2"><Calculator className="w-4 h-4" /> Paramétrage du prix</h5>
                      <div className="flex bg-white p-1 rounded-xl border border-violet-200">
                        <button onClick={() => setForm(f => ({...f, calcMode: "fixed"}))} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", form.calcMode === "fixed" ? "bg-violet-500 text-white shadow-sm" : "text-slate-500 hover:text-violet-600")}>Tarif Fixe</button>
                        <button onClick={() => setForm(f => ({...f, calcMode: "derived"}))} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", form.calcMode === "derived" ? "bg-violet-500 text-white shadow-sm" : "text-slate-500 hover:text-violet-600")}>Tarif Dérivé</button>
                      </div>
                    </div>

                    {form.calcMode === "fixed" ? (
                      <div className="p-3 bg-white/60 rounded-xl text-xs text-slate-600 flex items-start gap-3">
                        <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                        <p>Ce tarif est totalement indépendant. Le montant est saisi manuellement jour par jour dans le calendrier. Aucune dépendance avec un autre tarif.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-slide-in">
                        <div className="grid grid-cols-1 gap-3">
                          <label className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest">Basé sur le tarif référent</label>
                          <select value={form.referencePlanId} onChange={e => setForm(f => ({ ...f, referencePlanId: e.target.value }))} className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-violet-100 transition-all font-semibold">
                            {allPlans.map(p => <option key={p.planId} value={p.planId}>{p.planName} ({p.planCode})</option>)}
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">Ajustement %</label>
                            <div className="relative">
                              <input type="number" step="0.01" value={form.calcPercent} onChange={e => setForm(f => ({ ...f, calcPercent: parseFloat(e.target.value) || 0 }))} className="w-full rounded-xl border border-violet-200 px-3 py-2 text-sm outline-none bg-white pr-8 font-bold" />
                              <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">Ajustement €</label>
                            <div className="relative">
                              <input type="number" step="0.01" value={form.calcValue} onChange={e => setForm(f => ({ ...f, calcValue: parseFloat(e.target.value) || 0 }))} className="w-full rounded-xl border border-violet-200 px-3 py-2 text-sm outline-none bg-white pr-8 font-bold" />
                              <span className="absolute right-3 top-2 text-slate-400 font-bold">€</span>
                            </div>
                          </div>
                        </div>

                        {/* Formula Display */}
                        <div className="bg-violet-900 text-white rounded-xl p-4 shadow-inner">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-violet-200">Formule appliquée</span>
                             <span className="bg-violet-400/30 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Recalcul temps réel</span>
                           </div>
                           <div className="flex items-baseline gap-2 font-mono text-sm">
                             <span className="font-bold">{allPlans.find(p => p.planId === form.referencePlanId)?.planName || "Réf."}</span>
                             <span className={cn(form.calcPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>{form.calcPercent >= 0 ? "+" : ""}{form.calcPercent}%</span>
                             <span className={cn(form.calcValue >= 0 ? "text-emerald-400" : "text-rose-400")}>{form.calcValue >= 0 ? "+" : ""}{form.calcValue.toFixed(2)}€</span>
                             <span className="text-violet-300">=</span>
                             <span className="text-lg font-bold text-white tracking-tight">{previewResult}</span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <MultiCheck label="Chambres associées" options={roomTypes.map(r => ({ id: r.roomTypeId, label: r.roomTypeName }))} selected={form.assignedRoomTypeIds} onChange={v => setForm(f => ({ ...f, assignedRoomTypeIds: v }))} />
                  <MultiCheck label="Partenaires / distributeurs" options={DIST_CHANNELS.map(c => ({ id: c, label: c }))} selected={form.distributionChannels} onChange={v => setForm(f => ({ ...f, distributionChannels: v }))} />

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button onClick={submit} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all active:scale-[0.98]">
                      {selectedPlanKey ? "Enregistrer les modifications" : "Créer le plan tarifaire"}
                    </button>
                    <button onClick={() => setShowForm(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Annuler</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-white">
                 <div className="relative">
                    <input placeholder="Rechercher un tarif..." className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-100" />
                    <Calculator className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                 </div>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">ID</th>
                      <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Nom & Code</th>
                      <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Type</th>
                      <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Canal</th>
                      <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Statut</th>
                      <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {flatPlans.map(({ plan, rooms, planInRoom }) => (
                      <tr key={plan.planId} className={cn("group hover:bg-violet-50/40 transition-colors", plan.isReference && "bg-violet-50/20")}>
                        <td className="px-3 py-4 font-mono text-slate-300">{plan.internalId}</td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-8 rounded-full", plan.isActive ? "bg-violet-500" : "bg-slate-200")} />
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{plan.planName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{plan.planCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold text-[10px]">{plan.pensionType}</span></td>
                        <td className="px-3 py-4 text-center font-medium text-slate-500">{plan.channelType}</td>
                        <td className="px-3 py-4 text-center">
                          <button onClick={() => planInRoom && toggleRatePlanActive(planInRoom.assignedRoomTypeIds[0] ?? "", plan.planId)} className={cn("text-[10px] font-black px-2.5 py-1 rounded-full border transition-all", plan.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>
                            {plan.isActive ? "ACTIF" : "INACTIF"}
                          </button>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {planInRoom && <>
                              <button onClick={() => openEdit(planInRoom.assignedRoomTypeIds[0], plan.planId)} className="p-2 text-violet-500 hover:bg-violet-100 rounded-xl transition-all"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => duplicateRatePlan(planInRoom.assignedRoomTypeIds[0], plan.planId)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-all"><Copy className="w-4 h-4" /></button>
                              <button onClick={() => deleteRatePlan(planInRoom.assignedRoomTypeIds[0] ?? "", plan.planId)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
