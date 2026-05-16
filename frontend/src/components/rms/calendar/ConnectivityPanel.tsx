import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Cloud,
  Globe,
  Hotel,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  Tag,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";

type ConnectionKind = "channel_manager" | "ota" | "rms";
type ConnectionStatus = "connected" | "disconnected" | "syncing" | "error";

const PROVIDERS: Record<ConnectionKind, string[]> = {
  channel_manager: ["D-EDGE", "SiteMinder", "Cloudbeds", "Cubilis", "Vertical Booking", "Dingus", "RateGain", "WuBook", "Hotel-Spider", "Fastbooking", "Autres"],
  ota: ["Booking.com", "Expedia", "Airbnb", "Agoda", "Ctrip", "HRS", "Lastminute", "Hotelbeds", "TBO", "Despegar", "Orbitz", "Priceline", "Traveloka", "Hostelworld", "Autres"],
  rms: ["IDeaS", "Duetto", "Atomize", "Pace Revenue", "RoomPriceGenie", "BEONx", "Lybra", "Smartpricing", "RateBoard", "Juyo Analytics", "Autres"],
};

const KIND_LABELS: Record<ConnectionKind, { label: string; icon: typeof Cloud; description: string }> = {
  channel_manager: { label: "Channel Manager", icon: Server, description: "Tarifs, disponibilités, restrictions et canaux" },
  ota: { label: "OTA", icon: Globe, description: "Connexion directe aux distributeurs" },
  rms: { label: "RMS", icon: Activity, description: "Revenue Management System" },
};

type SyncLog = { id: string; at: string; level: "success" | "error" | "info"; message: string };

const emptyConfig = {
  endpoint: "",
  apiKey: "",
  secret: "",
  hotelId: "",
  propertyId: "",
  currency: "EUR",
  timezone: "Europe/Paris",
  environment: "Sandbox",
  frequency: "Toutes les 15 minutes",
};

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const config = {
    connected: { label: "Connecté", icon: Wifi, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    disconnected: { label: "Non connecté", icon: WifiOff, className: "bg-slate-100 text-slate-600 border-slate-200" },
    syncing: { label: "Synchronisation en cours", icon: RefreshCw, className: "bg-blue-100 text-blue-700 border-blue-200" },
    error: { label: "Erreur API", icon: AlertCircle, className: "bg-red-100 text-red-700 border-red-200" },
  }[status];
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", config.className)}>
      <Icon className={cn("h-3.5 w-3.5", status === "syncing" && "animate-spin")} />
      {config.label}
    </span>
  );
}

function MappingRow({ leftTitle, leftCode, rightLabel, value, options, onChange, valid }: {
  leftTitle: string;
  leftCode: string;
  rightLabel: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
  valid: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_220px_1fr] items-center gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PMS interne</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{leftTitle}</p>
        <p className="mt-1 font-mono text-[11px] text-slate-500">{leftCode}</p>
      </div>
      <div className="relative flex items-center justify-center">
        <div className="h-px w-full bg-slate-300" />
        <div className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
          {valid ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <ArrowRightLeft className="h-5 w-5 text-violet-500" />}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{rightLabel}</p>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        >
          <option value="">Sélectionner une correspondance</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export function ConnectivityPanel() {
  const { roomTypes, channels } = useRateCalendarStore();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ConnectionKind | null>(null);
  const [provider, setProvider] = useState("D-EDGE");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [config, setConfig] = useState(emptyConfig);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"config" | "mapping" | "sync" | "logs">("config");
  const [roomMapping, setRoomMapping] = useState<Record<string, string>>({});
  const [rateMapping, setRateMapping] = useState<Record<string, string>>({});
  const [channelMapping, setChannelMapping] = useState<Record<string, string>>({});
  const [restrictionMapping, setRestrictionMapping] = useState<Record<string, boolean>>({ cta: true, ctd: true, minStay: true, maxStay: true, stopSell: true, openClose: true });
  const [logs, setLogs] = useState<SyncLog[]>([]);

  const allPlans = useMemo(
    () => Array.from(new Map(roomTypes.flatMap((room) => room.ratePlans.map((rate) => [rate.planId, rate]))).values()),
    [roomTypes]
  );

  const providerLabel = kind ? PROVIDERS[kind] : [];
  const externalRooms = roomTypes.map((room, index) => ({ id: `${provider}_ROOM_${index + 1}`, name: `${provider} ${room.roomTypeName}` }));
  const externalRates = allPlans.map((plan, index) => ({ id: `${provider}_RATE_${index + 1}`, name: `${provider} ${plan.planName}` }));
  const externalChannels = channels.map((channel, index) => ({ id: `${provider}_CH_${index + 1}`, name: `${provider} ${channel.channelName}` }));

  const log = (level: SyncLog["level"], message: string) => {
    setLogs((prev) => [{ id: `log_${Date.now()}`, at: new Date().toLocaleString("fr-FR"), level, message }, ...prev].slice(0, 60));
  };

  const testConnection = () => {
    setStatus("syncing");
    log("info", `Test de connexion ${provider}`);
    setTimeout(() => {
      const ok = config.endpoint.trim() && config.apiKey.trim() && config.secret.trim();
      setStatus(ok ? "connected" : "error");
      if (ok) {
        setLastSync(new Date());
        log("success", `${provider} connecté avec succès`);
      } else {
        log("error", "Configuration incomplète : endpoint, clé API et secret requis");
      }
    }, 1000);
  };

  const forceSync = () => {
    setStatus("syncing");
    log("info", "Synchronisation manuelle lancée");
    setTimeout(() => {
      setStatus("connected");
      setLastSync(new Date());
      log("success", "Tarifs, disponibilités, restrictions et canaux synchronisés");
    }, 1600);
  };

  const resetConnection = (nextKind: ConnectionKind) => {
    setKind(nextKind);
    setProvider(PROVIDERS[nextKind][0]);
    setConfig(emptyConfig);
    setStatus("disconnected");
    setActiveTab("config");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-violet-500",
          open
            ? "border-violet-500 bg-violet-500 text-white shadow-md"
            : "border-violet-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm"
        )}
      >
        <Activity className="h-4 w-4" />
        <span>Connectivité CM</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 animate-fade-in bg-slate-950/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-screen w-full max-w-[1180px] animate-drawer-in flex-col border-l border-slate-200 bg-white shadow-2xl lg:w-2/3">
            <header className="flex shrink-0 items-center justify-between bg-violet-500 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-white">Centre de connectivité</h3>
                <p className="text-xs text-violet-100">OTA, Channel Manager et RMS</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={status} />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/75 transition-colors hover:bg-white/15 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 bg-slate-50">
              <div className="w-64 shrink-0 border-r border-slate-200 bg-white p-4">
                <button
                  onClick={() => setKind(null)}
                  className="mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-600"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une connectivité
                </button>
                <div className="space-y-2">
                  {(Object.keys(KIND_LABELS) as ConnectionKind[]).map((option) => {
                    const Icon = KIND_LABELS[option].icon;
                    const active = kind === option;
                    return (
                      <button
                        key={option}
                        onClick={() => resetConnection(option)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-all",
                          active ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-violet-600" />
                          <span className="text-sm font-semibold text-slate-800">{KIND_LABELS[option].label}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{KIND_LABELS[option].description}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">Dernière synchronisation</p>
                  <p className="mt-1">{lastSync ? lastSync.toLocaleString("fr-FR") : "Aucune"}</p>
                </div>
              </div>

              <main className="flex min-w-0 flex-1 flex-col">
                {!kind ? (
                  <div className="flex h-full items-center justify-center p-8">
                    <div className="max-w-md text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                        <Link2 className="h-7 w-7" />
                      </div>
                      <h4 className="mt-4 text-lg font-semibold text-slate-900">Ajouter une connectivité</h4>
                      <p className="mt-2 text-sm text-slate-500">Sélectionnez Channel Manager, OTA ou RMS pour configurer l'API, le mapping et les règles de synchronisation.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <nav className="flex shrink-0 border-b border-slate-200 bg-white px-5">
                      {[
                        { id: "config", label: "Configuration", icon: KeyRound },
                        { id: "mapping", label: "Mapping", icon: ArrowRightLeft },
                        { id: "sync", label: "Synchronisation", icon: RefreshCw },
                        { id: "logs", label: "Journal", icon: Activity },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={cn(
                              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                              activeTab === tab.id ? "border-violet-500 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                          </button>
                        );
                      })}
                    </nav>

                    <div className="flex-1 overflow-auto p-6">
                      {activeTab === "config" && (
                        <div className="mx-auto max-w-4xl space-y-6">
                          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-5 flex items-center justify-between">
                              <div>
                                <h4 className="text-lg font-semibold text-slate-900">{KIND_LABELS[kind].label}</h4>
                                <p className="text-sm text-slate-500">Configuration API {provider}</p>
                              </div>
                              <select value={provider} onChange={(event) => setProvider(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                                {providerLabel.map((item) => <option key={item}>{item}</option>)}
                              </select>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Endpoint API</label>
                                <input value={config.endpoint} onChange={(event) => setConfig({ ...config, endpoint: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="https://api.provider.com/v1" />
                              </div>
                              <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Clé API</label>
                                <input value={config.apiKey} onChange={(event) => setConfig({ ...config, apiKey: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                              </div>
                              <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Secret API</label>
                                <input type="password" value={config.secret} onChange={(event) => setConfig({ ...config, secret: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                              </div>
                              <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Identifiant hôtel</label>
                                <input value={config.hotelId} onChange={(event) => setConfig({ ...config, hotelId: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                              </div>
                              {(kind === "channel_manager" || kind === "rms") && (
                                <div>
                                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">ID établissement fournisseur</label>
                                  <input value={config.propertyId} onChange={(event) => setConfig({ ...config, propertyId: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                                </div>
                              )}
                              {(kind === "ota" || kind === "rms") && (
                                <>
                                  <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Devise</label>
                                    <input value={config.currency} onChange={(event) => setConfig({ ...config, currency: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fuseau horaire</label>
                                    <input value={config.timezone} onChange={(event) => setConfig({ ...config, timezone: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                                  </div>
                                </>
                              )}
                              {kind === "rms" && (
                                <div>
                                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fréquence de synchronisation</label>
                                  <select value={config.frequency} onChange={(event) => setConfig({ ...config, frequency: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                                    <option>Toutes les 15 minutes</option>
                                    <option>Toutes les heures</option>
                                    <option>Deux fois par jour</option>
                                    <option>Manuelle</option>
                                  </select>
                                </div>
                              )}
                              <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Environnement</label>
                                <select value={config.environment} onChange={(event) => setConfig({ ...config, environment: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                                  <option>{kind === "rms" ? "Simulation" : "Sandbox"}</option>
                                  <option>Production</option>
                                </select>
                              </div>
                            </div>
                            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
                              <StatusBadge status={status} />
                              <button onClick={testConnection} disabled={status === "syncing"} className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">
                                <Wifi className="h-4 w-4" />
                                {kind === "rms" ? "Tester la connexion RMS" : "Tester la connexion"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "mapping" && (
                        <div className="space-y-5">
                          <MappingRow leftTitle="Double Classique" leftCode="DBL_CLASS" rightLabel={`${provider} - Chambre`} value={roomMapping.dbl ?? ""} options={externalRooms} onChange={(value) => setRoomMapping({ ...roomMapping, dbl: value })} valid={Boolean(roomMapping.dbl)} />
                          <MappingRow leftTitle="Double Single Use" leftCode="DBL_SGL" rightLabel={`${provider} - Chambre`} value={roomMapping.sgl ?? ""} options={externalRooms} onChange={(value) => setRoomMapping({ ...roomMapping, sgl: value })} valid={Boolean(roomMapping.sgl)} />
                          <MappingRow leftTitle="Flexible RO" leftCode="FLEX_RO" rightLabel={`${provider} - Rate Plan`} value={rateMapping.flex ?? ""} options={externalRates} onChange={(value) => setRateMapping({ ...rateMapping, flex: value })} valid={Boolean(rateMapping.flex)} />
                          <MappingRow leftTitle="Canal OTA" leftCode="OTA_CLASS" rightLabel={`${provider} - Classe canal`} value={channelMapping.ota ?? ""} options={externalChannels} onChange={(value) => setChannelMapping({ ...channelMapping, ota: value })} valid={Boolean(channelMapping.ota)} />
                          <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <h4 className="mb-4 text-sm font-semibold text-slate-900">Mapping restrictions</h4>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {[
                                ["cta", "CTA"],
                                ["ctd", "CTD"],
                                ["minStay", "Min Stay"],
                                ["maxStay", "Max Stay"],
                                ["stopSell", "Stop Sell"],
                                ["openClose", "Fermeture / Ouverture"],
                              ].map(([key, label]) => {
                                const active = restrictionMapping[key];
                                return (
                                  <button key={key} onClick={() => setRestrictionMapping({ ...restrictionMapping, [key]: !active })} className={cn("rounded-xl border px-4 py-3 text-left text-sm transition-all", active ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}>
                                    {active ? "Synchronisé" : "Non synchronisé"} · {label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-5 flex justify-end">
                              <button onClick={() => log("success", "Mapping validé avant synchronisation")} className="h-10 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white hover:bg-violet-600">
                                Valider le mapping
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "sync" && (
                        <div className="space-y-5">
                          <div className="grid gap-4 md:grid-cols-4">
                            {[
                              ["Tarifs", allPlans.length, Tag],
                              ["Disponibilités", roomTypes.length * 31, Hotel],
                              ["Restrictions", 6, Settings2],
                              ["Canaux", channels.length, Globe],
                            ].map(([label, count, Icon]) => {
                              const IconComponent = Icon as typeof Tag;
                              return (
                                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <IconComponent className="h-5 w-5 text-violet-500" />
                                  <p className="mt-3 text-2xl font-bold text-slate-900">{String(count)}</p>
                                  <p className="text-xs text-slate-500">{String(label)}</p>
                                </div>
                              );
                            })}
                          </div>
                          <button onClick={forceSync} disabled={status === "syncing"} className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">
                            <RefreshCw className={cn("h-4 w-4", status === "syncing" && "animate-spin")} />
                            Forcer une resynchronisation manuelle
                          </button>
                        </div>
                      )}

                      {activeTab === "logs" && (
                        <div className="space-y-2">
                          {logs.length === 0 ? (
                            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Aucun journal de synchronisation</p>
                          ) : logs.map((entry) => (
                            <div key={entry.id} className={cn("rounded-xl border p-3 text-sm", entry.level === "success" ? "border-emerald-200 bg-emerald-50" : entry.level === "error" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50")}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-slate-800">{entry.message}</p>
                                <span className="text-xs text-slate-500">{entry.at}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </main>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}