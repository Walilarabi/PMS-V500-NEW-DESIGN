/**
 * FLOWTYM — Paramètres · Automatisations & IA + Distribution.
 *
 * - AutomationsPage : règles RMS automatiques (lecture-seule depuis configStore.pricingRules + état)
 * - AiRulesPage     : règles IA (politiques anti-dérive)
 * - AiStrategiesPage : stratégies tactiques
 * - OtaMappingPage  : mapping chambres ↔ OTA
 * - OtaParityPage   : parité des prix
 * - DistributionLogsPage : logs de distribution
 * - PmsSyncPage     : synchronisation PMS externes
 */
import React from 'react';
import {
  Zap, Wand2, Target, Network, Activity, ClipboardList, Plug,
} from 'lucide-react';
import { useConfigStore } from '@/src/store/configStore';
import {
  GenericListPage,
  SettingsPageHeader,
  SettingsMetric,
  SettingsToast,
  Phase2Notice,
  type GenericListItem,
} from './_common';

// ─── Automatisations (depuis configStore.pricingRules en read-mostly) ────

export const AutomationsPage: React.FC = () => {
  const rules = useConfigStore((s) => s.pricingRules);
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Zap}
          category="Automatisations & IA"
          title="Automatisations RMS"
          description="Règles tarifaires automatiques déclenchées par taux d'occupation, lead-time ou événement marché."
        />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <SettingsMetric label="Règles configurées" value={`${rules.length}`} caption="Tous statuts" />
          <SettingsMetric label="Actives" value={`${rules.filter((r) => r.enabled).length}`} caption="Application en cours" tone="emerald" />
          <SettingsMetric label="Multiplicateur moyen" value={`×${(rules.length === 0 ? 1 : rules.reduce((s, r) => s + r.multiplier, 0) / rules.length).toFixed(2)}`} caption="Effet net" tone="violet" />
          <SettingsMetric label="Priorité max" value={`${rules.length === 0 ? '—' : Math.max(...rules.map((r) => r.priority))}`} caption="Niveau de priorité plafond" tone="slate" />
        </div>
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {rules.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-[12.5px]">
              Aucune règle d'automatisation. Créez-en depuis le module Revenue → Automatisation.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Règle</th>
                  <th className="px-3 py-2.5 font-medium">Occupation</th>
                  <th className="px-3 py-2.5 font-medium">Lead time</th>
                  <th className="px-3 py-2.5 font-medium">Multiplicateur</th>
                  <th className="px-3 py-2.5 font-medium text-center">Priorité</th>
                  <th className="px-3 py-2.5 font-medium text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rules.sort((a, b) => b.priority - a.priority).map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5 text-[12.5px] font-medium text-slate-900">{r.name}</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums">{r.occupancyMin}% – {r.occupancyMax}%</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums">
                      {r.daysBeforeArrivalMin != null && r.daysBeforeArrivalMax != null
                        ? `J-${r.daysBeforeArrivalMin} à J-${r.daysBeforeArrivalMax}`
                        : <span className="text-slate-400">Toutes dates</span>}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums text-violet-700">×{r.multiplier.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-center font-semibold tabular-nums">{r.priority}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold ${r.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {r.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <Phase2Notice>Édition complète des règles : ouvrir le module Revenue → Automatisation. Cette page sert de vue de contrôle dans les Paramètres.</Phase2Notice>
      </div>
    </div>
  );
};

// ─── AI Rules ──────────────────────────────────────────────────────────────

interface AiRuleItem extends GenericListItem {
  type: 'guard' | 'boost' | 'limit' | 'override';
  threshold: number;
  unit: string;
}

export const AiRulesPage: React.FC = () => (
  <GenericListPage<AiRuleItem>
    icon={Wand2}
    category="Automatisations & IA"
    title="Règles IA"
    description="Garde-fous anti-dérive du moteur IA RMS : seuils, plafonds et overrides."
    storageKey="flowtym.ai.rules"
    module="rms_revenue"
    defaults={[
      { id: 'guard_min', label: 'Prix plancher absolu',       code: 'PMIN',  active: true, type: 'guard',    threshold: 80,  unit: '€' },
      { id: 'guard_max', label: 'Prix plafond absolu',         code: 'PMAX',  active: true, type: 'limit',    threshold: 600, unit: '€' },
      { id: 'delta',     label: 'Variation max J/J',           code: 'DLT',   active: true, type: 'limit',    threshold: 15,  unit: '%' },
      { id: 'boost_ev',  label: 'Boost événement critique',    code: 'BOOST', active: true, type: 'boost',    threshold: 25,  unit: '%' },
      { id: 'override',  label: 'Override RM > IA',            code: 'OVRD',  active: true, type: 'override', threshold: 100, unit: '%' },
    ]}
    extraColumns={[
      { header: 'Type', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold uppercase">{it.type}</span> },
      { header: 'Seuil', render: (it) => <span className="font-bold tabular-nums">{it.threshold}{it.unit}</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Type</span>
          <select value={item.type} onChange={(e) => set({ type: e.target.value as AiRuleItem['type'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="guard">Garde-fou</option>
            <option value="boost">Boost</option>
            <option value="limit">Plafond</option>
            <option value="override">Override</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Seuil</span>
          <input type="number" value={item.threshold} onChange={(e) => set({ threshold: parseFloat(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Unité</span>
          <input type="text" value={item.unit} onChange={(e) => set({ unit: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, type: 'guard', threshold: 0, unit: '€' })}
    phase2="application des garde-fous en temps réel au moteur Central Pricing Engine + explication des refus à l'utilisateur."
  />
);

// ─── AI Strategies ────────────────────────────────────────────────────────

interface AiStrategyItem extends GenericListItem {
  mode: 'aggressive' | 'balanced' | 'conservative' | 'defensive';
  targetOccupancy: number;
  enabledFor: string;
}

export const AiStrategiesPage: React.FC = () => (
  <GenericListPage<AiStrategyItem>
    icon={Target}
    category="Automatisations & IA"
    title="Stratégies IA"
    description="Stratégies tactiques selon contexte marché — agressivité, conservation, défense."
    storageKey="flowtym.ai.strategies"
    module="rms_revenue"
    defaults={[
      { id: 'lead',  label: 'Lead-time long', code: 'LEAD',  active: true, mode: 'aggressive',   targetOccupancy: 75, enabledFor: 'J-60 à J-30' },
      { id: 'mid',   label: 'Mid-term',        code: 'MID',   active: true, mode: 'balanced',     targetOccupancy: 80, enabledFor: 'J-30 à J-7' },
      { id: 'last',  label: 'Last-minute',     code: 'LAST',  active: true, mode: 'conservative', targetOccupancy: 90, enabledFor: 'J-7 à J' },
      { id: 'crisis', label: 'Crise / fort risk', code: 'CRIS', active: false, mode: 'defensive', targetOccupancy: 60, enabledFor: 'Sur déclenchement IA' },
    ]}
    extraColumns={[
      { header: 'Mode', render: (it) => <span className="capitalize">{it.mode}</span> },
      { header: 'TO cible', render: (it) => <span className="font-bold tabular-nums">{it.targetOccupancy}%</span> },
      { header: 'Période', render: (it) => <span className="text-slate-600">{it.enabledFor}</span> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Mode</span>
          <select value={item.mode} onChange={(e) => set({ mode: e.target.value as AiStrategyItem['mode'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="aggressive">Agressif (maximiser ADR)</option>
            <option value="balanced">Équilibré</option>
            <option value="conservative">Conservateur (sécuriser TO)</option>
            <option value="defensive">Défensif (limiter pertes)</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">TO cible (%)</span>
            <input type="number" min={0} max={100} value={item.targetOccupancy} onChange={(e) => set({ targetOccupancy: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Période d'application</span>
            <input type="text" value={item.enabledFor} onChange={(e) => set({ enabledFor: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, mode: 'balanced', targetOccupancy: 80, enabledFor: '' })}
    phase2="ML training sur historique pour suggérer la stratégie optimale en fonction du contexte temps réel."
  />
);

// ─── OTA Mapping ──────────────────────────────────────────────────────────

interface OtaMapItem extends GenericListItem {
  ota: string;
  internalRoomType: string;
  externalRoomCode: string;
}

export const OtaMappingPage: React.FC = () => (
  <GenericListPage<OtaMapItem>
    icon={Network}
    category="Distribution & OTA"
    title="Mapping OTA"
    description="Correspondance entre vos typologies internes et les codes chambres OTA externes."
    storageKey="flowtym.ota.mapping"
    module="channel_manager"
    defaults={[
      { id: 'bkg_dbl', label: 'Booking — Chambre Double', code: 'BKG_DBL', active: true, ota: 'Booking.com', internalRoomType: 'DBL', externalRoomCode: 'STD-DBL-CITY' },
      { id: 'bkg_sui', label: 'Booking — Suite',           code: 'BKG_SUI', active: true, ota: 'Booking.com', internalRoomType: 'SUI', externalRoomCode: 'SUITE-DLX' },
      { id: 'exp_dbl', label: 'Expedia — Chambre Double',  code: 'EXP_DBL', active: true, ota: 'Expedia',     internalRoomType: 'DBL', externalRoomCode: 'STDDBL' },
      { id: 'air_apt', label: 'Airbnb — Appartement complet', code: 'AIR_APT', active: false, ota: 'Airbnb', internalRoomType: 'SUI', externalRoomCode: 'APT-FULL' },
    ]}
    extraColumns={[
      { header: 'OTA', render: (it) => <span className="font-semibold">{it.ota}</span> },
      { header: 'Interne', render: (it) => <span className="font-mono text-[11.5px]">{it.internalRoomType}</span> },
      { header: 'Externe', render: (it) => <span className="font-mono text-[11.5px]">{it.externalRoomCode}</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">OTA</span>
          <input type="text" value={item.ota} onChange={(e) => set({ ota: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Code interne</span>
          <input type="text" value={item.internalRoomType} onChange={(e) => set({ internalRoomType: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
        </label>
        <label className="block col-span-2">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Code externe (OTA)</span>
          <input type="text" value={item.externalRoomCode} onChange={(e) => set({ externalRoomCode: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
        </label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, ota: '', internalRoomType: '', externalRoomCode: '' })}
    phase2="détection automatique des mappings manquants en parsant les payloads OTA."
  />
);

// ─── OTA Parity ───────────────────────────────────────────────────────────

interface OtaParityItem extends GenericListItem {
  ota: string;
  parityRule: 'equal' | 'plus_n' | 'minus_n';
  delta: number;
}

export const OtaParityPage: React.FC = () => (
  <GenericListPage<OtaParityItem>
    icon={Target}
    category="Distribution & OTA"
    title="Parité des prix"
    description="Règles de parité tarifaire entre canaux pour éviter les écarts générant des pénalités."
    storageKey="flowtym.ota.parity"
    module="channel_manager"
    defaults={[
      { id: 'bkg_par', label: 'Booking — Parité stricte', code: 'BKG', active: true, ota: 'Booking.com', parityRule: 'equal',   delta: 0 },
      { id: 'exp_par', label: 'Expedia — Parité',          code: 'EXP', active: true, ota: 'Expedia',     parityRule: 'equal',   delta: 0 },
      { id: 'direct',  label: 'Site direct -5%',           code: 'DIR', active: true, ota: 'Site direct', parityRule: 'minus_n', delta: 5 },
    ]}
    extraColumns={[
      { header: 'Canal', render: (it) => it.ota },
      { header: 'Règle', render: (it) => {
        if (it.parityRule === 'equal') return 'Parité stricte';
        if (it.parityRule === 'plus_n') return `+${it.delta}%`;
        return `-${it.delta}%`;
      } },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Canal</span>
          <input type="text" value={item.ota} onChange={(e) => set({ ota: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Règle</span>
            <select value={item.parityRule} onChange={(e) => set({ parityRule: e.target.value as OtaParityItem['parityRule'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              <option value="equal">Parité stricte</option>
              <option value="plus_n">Majoration</option>
              <option value="minus_n">Décote</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Delta (%)</span>
            <input type="number" min={0} max={50} value={item.delta} onChange={(e) => set({ delta: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
          </label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, ota: '', parityRule: 'equal', delta: 0 })}
    phase2="moniteur temps réel des écarts de prix avec alerte en cas de rupture de parité."
  />
);

// ─── Distribution Logs ────────────────────────────────────────────────────

interface DistLogItem extends GenericListItem {
  ota: string;
  eventType: 'push' | 'pull' | 'sync' | 'error';
  timestamp: string;
  detail: string;
}

export const DistributionLogsPage: React.FC = () => (
  <GenericListPage<DistLogItem>
    icon={ClipboardList}
    category="Distribution & OTA"
    title="Logs de distribution"
    description="Historique des opérations de push/pull avec les channel managers et OTAs."
    storageKey="flowtym.distribution.logs"
    module="channel_manager"
    defaults={[
      { id: 'l1', label: 'Push tarifs Booking', code: 'PUSH', active: true, ota: 'Booking.com', eventType: 'push', timestamp: '2026-05-15T10:30:00Z', detail: '147 dates × 5 types' },
      { id: 'l2', label: 'Pull dispo Expedia', code: 'PULL', active: true, ota: 'Expedia', eventType: 'pull', timestamp: '2026-05-15T10:25:00Z', detail: '147 dates' },
      { id: 'l3', label: 'Erreur sync Airbnb', code: 'ERR', active: false, ota: 'Airbnb', eventType: 'error', timestamp: '2026-05-15T09:12:00Z', detail: 'Token API expiré' },
    ]}
    extraColumns={[
      { header: 'OTA', render: (it) => it.ota },
      { header: 'Type', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold uppercase">{it.eventType}</span> },
      { header: 'Date', render: (it) => new Date(it.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
      { header: 'Détail', render: (it) => <span className="text-slate-500">{it.detail}</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">OTA</span>
          <input type="text" value={item.ota} onChange={(e) => set({ ota: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Type</span>
          <select value={item.eventType} onChange={(e) => set({ eventType: e.target.value as DistLogItem['eventType'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="push">Push</option><option value="pull">Pull</option><option value="sync">Sync</option><option value="error">Erreur</option>
          </select></label>
        <label className="block col-span-2"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Détail</span>
          <input type="text" value={item.detail} onChange={(e) => set({ detail: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, ota: '', eventType: 'push', timestamp: new Date().toISOString(), detail: '' })}
    phase2="logs réels alimentés par les webhooks du channel manager, filtre/recherche avancée."
  />
);

// ─── PMS Sync ─────────────────────────────────────────────────────────────

interface PmsSyncItem extends GenericListItem {
  vendor: string;
  syncDirection: 'in' | 'out' | 'both';
  frequency: 'realtime' | '15min' | 'hourly' | 'daily';
}

export const PmsSyncPage: React.FC = () => (
  <GenericListPage<PmsSyncItem>
    icon={Plug}
    category="Distribution & OTA"
    title="PMS / Channel Manager"
    description="Synchronisations avec PMS externes et channel managers — direction et fréquence."
    storageKey="flowtym.pms_sync"
    module="channel_manager"
    defaults={[
      { id: 'siteminder', label: 'SiteMinder', code: 'SM',    active: true,  vendor: 'SiteMinder', syncDirection: 'both', frequency: 'realtime' },
      { id: 'd_edge',     label: 'D-EDGE',    code: 'DEDGE', active: true,  vendor: 'D-EDGE',     syncDirection: 'both', frequency: 'realtime' },
      { id: 'opera',      label: 'Oracle Opera', code: 'OPR',  active: false, vendor: 'Oracle',     syncDirection: 'in',   frequency: 'hourly' },
    ]}
    extraColumns={[
      { header: 'Vendeur', render: (it) => it.vendor },
      { header: 'Sens', render: (it) => it.syncDirection === 'both' ? '↔' : it.syncDirection === 'in' ? '← entrant' : '→ sortant' },
      { header: 'Fréquence', render: (it) => <span className="font-mono text-[11.5px]">{it.frequency}</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Vendeur</span>
          <input type="text" value={item.vendor} onChange={(e) => set({ vendor: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Sens</span>
          <select value={item.syncDirection} onChange={(e) => set({ syncDirection: e.target.value as PmsSyncItem['syncDirection'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="in">Entrant</option><option value="out">Sortant</option><option value="both">Bidirectionnel</option>
          </select></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Fréquence</span>
          <select value={item.frequency} onChange={(e) => set({ frequency: e.target.value as PmsSyncItem['frequency'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="realtime">Temps réel</option><option value="15min">15 min</option><option value="hourly">Horaire</option><option value="daily">Quotidienne</option>
          </select></label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, vendor: '', syncDirection: 'both', frequency: 'realtime' })}
    phase2="moniteur de santé des syncs avec retry exponentiel + escalade en cas de rupture > 5 min."
  />
);
