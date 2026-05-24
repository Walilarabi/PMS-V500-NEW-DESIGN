/**
 * FLOWTYM — Paramètres · Langues & devises.
 *
 * Configuration multilingue + multi-devises de l'établissement.
 * Phase 1 : persistance localStorage avec toggles + langue par défaut +
 * devise par défaut + taux de change manuel. Phase 2 : sync taux de
 * change via API ECB + traductions backend.
 */
import React, { useEffect, useState } from 'react';
import { Languages, Globe, Save, CheckCircle2, Plus, Trash2, Coins, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { useConfigBlob } from '@/src/hooks/settings/useConfigBlob';

interface LangConfig {
  defaultLang: string;
  enabledLangs: string[];
  defaultCurrency: string;
  enabledCurrencies: string[];
  rates: Record<string, number>;   // taux vs devise par défaut
  ratesUpdatedAt?: string;
}

const ALL_LANGS = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

const ALL_CURRENCIES = [
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', label: 'Yuan', symbol: '¥' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
];

const DEFAULT: LangConfig = {
  defaultLang: 'fr',
  enabledLangs: ['fr', 'en'],
  defaultCurrency: 'EUR',
  enabledCurrencies: ['EUR', 'USD', 'GBP'],
  rates: { EUR: 1, USD: 1.08, GBP: 0.86 },
  ratesUpdatedAt: undefined,
};

export const LanguagesPage: React.FC = () => {
  // Phase 5 — persistance Supabase + localStorage via useConfigBlob.
  // Migration douce depuis l'ancienne clé 'flowtym.languages' la 1re fois.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const legacy = window.localStorage.getItem('flowtym.languages');
    const next = window.localStorage.getItem('flowtym.cfg.languages');
    if (legacy && !next) {
      window.localStorage.setItem('flowtym.cfg.languages', legacy);
    }
  }, []);
  const [cfg, setCfg] = useConfigBlob<LangConfig>('languages', DEFAULT);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function toggleLang(code: string) {
    setCfg((c) => {
      const has = c.enabledLangs.includes(code);
      if (has && c.enabledLangs.length === 1) {
        notify('Au moins une langue doit rester active');
        return c;
      }
      const next = has ? c.enabledLangs.filter((x) => x !== code) : [...c.enabledLangs, code];
      // Si on désactive la langue par défaut, on rebascule sur la 1re restante
      const defaultLang = has && code === c.defaultLang ? next[0] : c.defaultLang;
      logAudit({ action: 'module_inspected', detail: `Langue ${code} ${has ? 'désactivée' : 'activée'}` });
      return { ...c, enabledLangs: next, defaultLang };
    });
  }

  function toggleCurrency(code: string) {
    setCfg((c) => {
      const has = c.enabledCurrencies.includes(code);
      if (has && c.enabledCurrencies.length === 1) {
        notify('Au moins une devise doit rester active');
        return c;
      }
      const next = has ? c.enabledCurrencies.filter((x) => x !== code) : [...c.enabledCurrencies, code];
      const defaultCurrency = has && code === c.defaultCurrency ? next[0] : c.defaultCurrency;
      const rates = { ...c.rates };
      if (!has && rates[code] == null) rates[code] = 1;
      logAudit({ action: 'module_inspected', detail: `Devise ${code} ${has ? 'désactivée' : 'activée'}` });
      return { ...c, enabledCurrencies: next, defaultCurrency, rates };
    });
  }

  function setRate(code: string, value: number) {
    setCfg((c) => ({ ...c, rates: { ...c.rates, [code]: value } }));
  }

  async function refreshRates() {
    // Mock : génère une variation +/- 2% autour des taux actuels
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setCfg((c) => {
      const next = { ...c.rates };
      for (const code of c.enabledCurrencies) {
        if (code === c.defaultCurrency) { next[code] = 1; continue; }
        const base = next[code] ?? 1;
        next[code] = Math.round(base * (1 + (Math.random() - 0.5) * 0.04) * 1000) / 1000;
      }
      return { ...c, rates: next, ratesUpdatedAt: new Date().toISOString() };
    });
    logAudit({ action: 'module_inspected', detail: 'Taux de change rafraîchis (mock)' });
    notify('Taux de change rafraîchis');
    setRefreshing(false);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Languages className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Établissement</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Langues & devises</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Configurez les langues d'interface et les devises acceptées par votre établissement.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Langues */}
          <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
            <header className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-500" />
              <h3 className="text-[13px] font-semibold text-slate-900">Langues d'interface</h3>
              <span className="ml-auto text-[11px] text-slate-500">{cfg.enabledLangs.length} active{cfg.enabledLangs.length > 1 ? 's' : ''}</span>
            </header>
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {ALL_LANGS.map((l) => {
                const active = cfg.enabledLangs.includes(l.code);
                const isDefault = cfg.defaultLang === l.code;
                return (
                  <li key={l.code} className="px-5 py-2.5 flex items-center gap-3">
                    <button
                      onClick={() => toggleLang(l.code)}
                      className={cn(
                        'relative w-9 h-5 rounded-full transition-colors shrink-0',
                        active ? 'bg-violet-600' : 'bg-slate-300',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                        active && 'translate-x-4',
                      )} />
                    </button>
                    <span className="text-[18px]">{l.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900">{l.label}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{l.code.toUpperCase()}</div>
                    </div>
                    {active && (
                      isDefault ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                          Par défaut
                        </span>
                      ) : (
                        <button
                          onClick={() => setCfg((c) => ({ ...c, defaultLang: l.code }))}
                          className="text-[11px] text-violet-600 hover:underline"
                        >
                          Définir par défaut
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Devises */}
          <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
            <header className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-violet-500" />
              <h3 className="text-[13px] font-semibold text-slate-900">Devises acceptées</h3>
              <button
                onClick={refreshRates}
                disabled={refreshing}
                className="ml-auto px-2.5 py-1 rounded-lg ring-1 ring-slate-200 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 disabled:opacity-60"
                title="Rafraîchir les taux de change (mock)"
              >
                <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                Rafraîchir taux
              </button>
            </header>
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {ALL_CURRENCIES.map((cur) => {
                const active = cfg.enabledCurrencies.includes(cur.code);
                const isDefault = cfg.defaultCurrency === cur.code;
                return (
                  <li key={cur.code} className="px-5 py-2.5 flex items-center gap-3">
                    <button
                      onClick={() => toggleCurrency(cur.code)}
                      className={cn(
                        'relative w-9 h-5 rounded-full transition-colors shrink-0',
                        active ? 'bg-violet-600' : 'bg-slate-300',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                        active && 'translate-x-4',
                      )} />
                    </button>
                    <div className="w-12 h-9 rounded-lg bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center text-[13px] font-bold text-slate-700">
                      {cur.symbol}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900">{cur.label}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{cur.code}</div>
                    </div>
                    {active && !isDefault && (
                      <input
                        type="number"
                        step="0.001"
                        value={cfg.rates[cur.code] ?? 1}
                        onChange={(e) => setRate(cur.code, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded-lg ring-1 ring-slate-200 text-[12px] font-mono tabular-nums text-right focus:ring-violet-500 outline-none"
                        title="Taux vs devise par défaut"
                      />
                    )}
                    {active && (
                      isDefault ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                          Par défaut
                        </span>
                      ) : (
                        <button
                          onClick={() => setCfg((c) => ({ ...c, defaultCurrency: cur.code, rates: { ...c.rates, [cur.code]: 1 } }))}
                          className="text-[11px] text-violet-600 hover:underline"
                        >
                          Par défaut
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
            {cfg.ratesUpdatedAt && (
              <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-500">
                Taux mis à jour le {new Date(cfg.ratesUpdatedAt).toLocaleString('fr-FR')}
              </div>
            )}
          </section>
        </div>

        {/* Aperçu format */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
          <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Aperçu de formatage</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {cfg.enabledCurrencies.map((code) => {
              const cur = ALL_CURRENCIES.find((c) => c.code === code);
              if (!cur) return null;
              const rate = cfg.rates[code] ?? 1;
              const sample = 100 / (cfg.rates[cfg.defaultCurrency] ?? 1) * rate;
              return (
                <div key={code} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{cur.label}</div>
                  <div className="text-[18px] font-bold text-slate-900 mt-1">
                    {new Intl.NumberFormat(cfg.defaultLang, { style: 'currency', currency: code }).format(sample)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">≈ 100 {cfg.defaultCurrency} · taux {rate}</div>
                </div>
              );
            })}
          </div>
        </section>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>
    </div>
  );
};
