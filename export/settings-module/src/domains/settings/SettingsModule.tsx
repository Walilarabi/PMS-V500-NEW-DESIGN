import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  Settings,
  ShieldCheck,
  Wand2,
} from 'lucide-react';

import type { PageId } from '@/src/types';
import { useConfigStore } from '@/src/store/configStore';
import {
  settingsOverviewAlerts,
  settingsOverviewMetrics,
  settingsSections,
  type SettingsField,
  type SettingsMetric,
  type SettingsSection,
  type SettingsTone,
} from './catalog';

interface SettingsModuleProps {
  activePage: PageId;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ activePage }) => {
  const hotelName = useConfigStore((state) => state.hotel.name);
  const section = settingsSections[activePage as keyof typeof settingsSections] ?? settingsSections.settings;
  const [message, setMessage] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = React.useMemo(() => {
    if (!normalizedQuery) return [];
    return Object.values(settingsSections).filter((candidate) =>
      sectionMatchesQuery(candidate, normalizedQuery),
    );
  }, [normalizedQuery]);

  const handleAction = React.useCallback((label: string) => {
    setMessage(`${label} préparé — persistance sécurisée prévue en Phase 2.`);
    window.setTimeout(() => setMessage(null), 2800);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <div className="w-full space-y-6 px-6 py-6">
        <SettingsHeader
          hotelName={hotelName}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        {message && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">
            {message}
          </div>
        )}
        {normalizedQuery ? (
          <SettingsSearchResults query={searchQuery} results={searchResults} />
        ) : activePage === 'settings' ? (
          <SettingsOverview onAction={handleAction} />
        ) : (
          <SettingsDetail section={section} onAction={handleAction} />
        )}
      </div>
    </div>
  );
};

const SettingsHeader: React.FC<{
  hotelName: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}> = ({ hotelName, searchQuery, onSearchChange }) => (
  <header className="flex flex-col gap-5 rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm xl:flex-row xl:items-center xl:justify-between">
    <div className="flex items-start gap-4">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#8B5CF6]/10 text-[#8B5CF6]">
        <Settings size={22} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8B5CF6]">
          Paramètres
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">
          Configuration générale de Flowtym
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          {hotelName} · Phase 1 UI sécurisée · Persistance critique prévue en Phase 2
        </p>
      </div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher un paramètre..."
          className="h-11 w-full rounded-2xl border border-slate-100 bg-slate-50 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-[#8B5CF6]/40 focus:bg-white focus:ring-4 focus:ring-[#8B5CF6]/5 sm:w-80"
        />
      </div>
      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-xs font-black uppercase tracking-widest text-white transition-transform active:scale-95">
        <Download size={15} />
        Export
      </button>
    </div>
  </header>
);

const SettingsSearchResults: React.FC<{ query: string; results: SettingsSection[] }> = ({
  query,
  results,
}) => (
  <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8B5CF6]">
        Recherche locale
      </p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-950">
        {results.length} résultat{results.length > 1 ? 's' : ''} pour “{query}”
      </h2>
      <p className="mt-1 text-sm font-semibold text-slate-400">
        Filtrage instantané du catalogue Paramètres, sans appel réseau.
      </p>
    </div>
    {results.length === 0 ? (
      <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400">
        Aucun paramètre ne correspond à cette recherche.
      </div>
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {results.map((result) => (
          <div key={result.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8B5CF6]">
              {result.eyebrow}
            </p>
            <h3 className="mt-2 text-base font-black text-slate-900">{result.title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {result.description}
            </p>
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {result.status}
            </span>
          </div>
        ))}
      </div>
    )}
  </section>
);

const SettingsOverview: React.FC<{ onAction: (label: string) => void }> = ({ onAction }) => (
  <div className="space-y-8">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {settingsOverviewMetrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-[28px] border border-amber-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-500">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">
              Alertes de configuration
            </h2>
            <p className="text-xs font-semibold text-slate-400">
              Points à corriger avant passage production complet.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {settingsOverviewAlerts.map((alert, index) => (
            <div
              key={alert}
              className="flex items-center gap-3 rounded-2xl bg-amber-50/60 px-4 py-3 text-sm font-bold text-amber-800"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] text-amber-500">
                {index + 1}
              </span>
              {alert}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#8B5CF6] text-white">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">
              Garde-fous Phase 1
            </h2>
            <p className="text-xs font-semibold text-slate-400">
              Aucun secret réel, aucune écriture DB critique.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {['Validation Zod prévue Phase 2', 'RBAC requis pour fiscalité/API', 'Audit immuable obligatoire', 'RLS multi-tenant conservé'].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <CheckCircle2 size={16} className="text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>

    <div className="flex flex-wrap gap-3">
      {['Lancer diagnostic complet', 'Exporter configuration'].map((action) => (
        <button
          key={action}
          onClick={() => onAction(action)}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#8B5CF6] px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-violet-200 transition-transform active:scale-95"
        >
          <Wand2 size={15} />
          {action}
        </button>
      ))}
    </div>
  </div>
);

const SettingsDetail: React.FC<{
  section: SettingsSection;
  onAction: (label: string) => void;
}> = ({ section, onAction }) => (
  <div className="space-y-6">
    <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8B5CF6]">
            {section.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
            {section.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
            {section.description}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">
          <CheckCircle2 size={14} />
          {section.status}
        </span>
      </div>
    </section>

    {section.alerts && section.alerts.length > 0 && (
      <div className="space-y-2">
        {section.alerts.map((alert) => (
          <div key={alert} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {alert}
          </div>
        ))}
      </div>
    )}

    {section.metrics && (
      <div className="grid gap-4 md:grid-cols-3">
        {section.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
    )}

    {section.fields && <FieldGrid fields={section.fields} />}
    {section.table && <SettingsTableView table={section.table} />}
    {section.checklist && <Checklist items={section.checklist} />}

    <div className="flex flex-wrap gap-3">
      {section.actions.map((action) => (
        <button
          key={action}
          onClick={() => onAction(action)}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-violet-100 bg-white px-5 text-xs font-black uppercase tracking-widest text-[#8B5CF6] shadow-sm transition-all hover:bg-violet-50 active:scale-95"
        >
          <Wand2 size={15} />
          {action}
        </button>
      ))}
    </div>
  </div>
);

const MetricCard: React.FC<{ metric: SettingsMetric }> = ({ metric }) => {
  const tone = toneClasses(metric.tone);
  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${tone.card}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {metric.label}
          </p>
          <p className={`mt-3 text-xl font-black tracking-[-0.04em] ${tone.text}`}>{metric.value}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{metric.detail}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone.badge}`}>
          <CheckCircle2 size={18} />
        </span>
      </div>
    </div>
  );
};

const FieldGrid: React.FC<{ fields: SettingsField[] }> = ({ fields }) => (
  <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <label key={field.label} className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {field.label}
          </span>
          <input
            type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
            defaultValue={field.value}
            readOnly
            className="mt-2 h-11 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none"
          />
        </label>
      ))}
    </div>
  </section>
);

const SettingsTableView: React.FC<{ table: SettingsSection['table'] }> = ({ table }) => {
  if (!table) return null;
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="px-5 py-4">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {table.rows.map((row, rowIndex) => (
              <tr key={`${row.join('-')}-${rowIndex}`} className="text-sm font-bold text-slate-700 hover:bg-violet-50/30">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-5 py-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const Checklist: React.FC<{ items: string[] }> = ({ items }) => (
  <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          <CheckCircle2 size={16} className="text-emerald-500" />
          {item}
        </div>
      ))}
    </div>
  </section>
);

function toneClasses(tone: SettingsTone) {
  const tones: Record<SettingsTone, { card: string; text: string; badge: string }> = {
    emerald: {
      card: 'border-emerald-100 bg-emerald-50/50',
      text: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    violet: {
      card: 'border-violet-100 bg-violet-50/50',
      text: 'text-[#8B5CF6]',
      badge: 'bg-violet-100 text-[#8B5CF6]',
    },
    amber: {
      card: 'border-amber-100 bg-amber-50/50',
      text: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-700',
    },
    blue: {
      card: 'border-blue-100 bg-blue-50/50',
      text: 'text-blue-700',
      badge: 'bg-blue-100 text-blue-700',
    },
    rose: {
      card: 'border-rose-100 bg-rose-50/50',
      text: 'text-rose-700',
      badge: 'bg-rose-100 text-rose-700',
    },
    slate: {
      card: 'border-slate-100 bg-white',
      text: 'text-slate-700',
      badge: 'bg-slate-100 text-slate-700',
    },
  };
  return tones[tone];
}

function sectionMatchesQuery(section: SettingsSection, query: string): boolean {
  const haystack = [
    section.title,
    section.eyebrow,
    section.description,
    section.status,
    ...section.actions,
    ...(section.alerts ?? []),
    ...(section.checklist ?? []),
    ...(section.fields ?? []).flatMap((field) => [field.label, field.value]),
    ...(section.metrics ?? []).flatMap((metric) => [metric.label, metric.value, metric.detail]),
    ...(section.table ? [...section.table.columns, ...section.table.rows.flat()] : []),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default SettingsModule;
