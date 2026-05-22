/**
 * FLOWTYM — Analyse RM (vue tableau dans Tableau RMS)
 *
 * Tableau d'analyse multi-sources avec :
 *   - 5 KPIs (période, demande, forte demande, forte compression, confiance)
 *   - Filtres : Demande (Faible/Moyenne/Forte/Très forte), Compression, recherche événement
 *   - Tableau dense : Date, Jour, Pression %, Niv. demande, Compression, Niv. compression,
 *     TO%, Événement, ⚠ Manquant, Tarif actuel, Tarif suggéré, Opportunité, Source, Confiance
 *   - Synthèse mensuelle agrégée
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Types locaux miroir de DayRMSData (évite cycle d'import avec RMSTableauPro)
export interface RMSAnalyseDay {
  date: string;
  dayName: string;
  isToday: boolean;
  events: Array<{ label: string }>;
  marketPressure: number;
  occupancyRate: number;
  currentPrice: number;
  suggestedPrice: number;
  confidenceScore: number;
  validationStatus: 'En attente' | 'Acceptée' | 'Refusée' | 'Maintenue';
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

function pressureLevel(p: number): 'Faible' | 'Moyenne' | 'Forte' | 'Très forte' {
  if (p >= 85) return 'Très forte';
  if (p >= 70) return 'Forte';
  if (p >= 40) return 'Moyenne';
  return 'Faible';
}

function compressionFor(d: RMSAnalyseDay) {
  const value = Math.round((d.occupancyRate * d.marketPressure) / 100);
  let level: 'Faible' | 'Moyenne' | 'Élevée' | 'Très élevée' = 'Faible';
  if (value >= 75) level = 'Très élevée';
  else if (value >= 50) level = 'Élevée';
  else if (value >= 25) level = 'Moyenne';
  return { level, value };
}

function opportunityRange(currentPrice: number, suggestedPrice: number): string {
  if (currentPrice <= 0) return '—';
  const pct = ((suggestedPrice - currentPrice) / currentPrice) * 100;
  if (pct >= 10) return '+10% et plus';
  if (pct >= 5) return '+5% à +10%';
  if (pct >= -5) return '—';
  if (pct >= -10) return '−5% à −10%';
  return '−10% et plus';
}

function isOpportunityMissed(d: RMSAnalyseDay): boolean {
  const pct = d.currentPrice > 0 ? ((d.suggestedPrice - d.currentPrice) / d.currentPrice) * 100 : 0;
  return d.marketPressure >= 80 && pct >= 5 && d.validationStatus === 'En attente';
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-9 text-right">{value}%</span>
    </div>
  );
}

export function AnalyseRMTable({ data }: { data: RMSAnalyseDay[] }) {
  const [demandFilters, setDemandFilters] = useState<Set<string>>(new Set());
  const [compressionFilters, setCompressionFilters] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const enriched = useMemo(() => data.map(d => {
    const compr = compressionFor(d);
    return {
      ...d,
      demandLevel: pressureLevel(d.marketPressure),
      compressionValue: compr.value,
      compressionLevel: compr.level,
      missing: isOpportunityMissed(d),
      opportunity: opportunityRange(d.currentPrice, d.suggestedPrice),
    };
  }), [data]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (demandFilters.size > 0) list = list.filter(d => demandFilters.has(d.demandLevel));
    if (compressionFilters.size > 0) list = list.filter(d => compressionFilters.has(d.compressionLevel));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(d => d.events.some(e => e.label.toLowerCase().includes(q)));
    }
    return list;
  }, [enriched, demandFilters, compressionFilters, search]);

  const stats = useMemo(() => {
    if (enriched.length === 0) {
      return { days: 0, avgDemand: 0, strongDemand: 0, strongCompression: 0, avgConfidence: 0, start: '', end: '' };
    }
    const avgDemand = enriched.reduce((s, d) => s + d.marketPressure, 0) / enriched.length;
    const strongDemand = enriched.filter(d => d.marketPressure >= 70).length;
    const strongCompression = enriched.filter(d => d.compressionValue >= 50).length;
    const avgConfidence = enriched.reduce((s, d) => s + d.confidenceScore, 0) / enriched.length;
    return {
      days: enriched.length,
      avgDemand: Math.round(avgDemand),
      strongDemand,
      strongCompression,
      avgConfidence: Math.round(avgConfidence),
      start: enriched[0].date,
      end: enriched[enriched.length - 1].date,
    };
  }, [enriched]);

  const monthly = useMemo(() => {
    const byMonth = new Map<string, typeof enriched>();
    enriched.forEach(d => {
      const m = d.date.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(d);
    });
    return Array.from(byMonth.entries()).map(([m, days]) => {
      const avgDemand = days.reduce((s, d) => s + d.marketPressure, 0) / days.length;
      const avgComp = days.reduce((s, d) => s + d.compressionValue, 0) / days.length;
      const strongDemand = days.filter(d => d.marketPressure >= 70).length;
      const strongComp = days.filter(d => d.compressionValue >= 50).length;
      const alerts = days.filter(d => d.missing).length;
      const avgConfidence = days.reduce((s, d) => s + d.confidenceScore, 0) / days.length;
      return {
        month: m,
        label: new Date(`${m}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        days: days.length,
        avgDemand: Math.round(avgDemand),
        avgCompression: Math.round(avgComp),
        strongDemand,
        strongCompression: strongComp,
        alerts,
        avgConfidence: Math.round(avgConfidence),
      };
    });
  }, [enriched]);

  const toggleSetItem = (set: Set<string>, item: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setter(next);
  };

  return (
    <div className="p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Période analysée</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{stats.days}j</div>
          <div className="text-[11px] text-gray-400 mt-1">{stats.start} → {stats.end}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Demande moyenne</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{stats.avgDemand}%</div>
          <div className="text-[11px] text-gray-400 mt-1">Score composite multi-sources</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Forte demande</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{stats.strongDemand}</div>
          <div className="text-[11px] text-gray-400 mt-1">Dates Forte ou Très forte</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Forte compression</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{stats.strongCompression}</div>
          <div className="text-[11px] text-gray-400 mt-1">Dates Élevée ou Très élevée</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Confiance moyenne</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{stats.avgConfidence}%</div>
          <div className="text-[11px] text-gray-400 mt-1">Score moteur + bonus consensus</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filtres</span>
        <span className="text-xs text-gray-600 ml-1">Demande :</span>
        {(['Faible', 'Moyenne', 'Forte', 'Très forte'] as const).map(d => (
          <button
            key={d}
            onClick={() => toggleSetItem(demandFilters, d, setDemandFilters)}
            className={cn(
              'px-2.5 py-1 text-xs rounded border transition-colors',
              demandFilters.has(d) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
          >{d}</button>
        ))}
        <span className="text-xs text-gray-600 ml-2">Compression :</span>
        {(['Faible', 'Moyenne', 'Élevée', 'Très élevée'] as const).map(c => (
          <button
            key={c}
            onClick={() => toggleSetItem(compressionFilters, c, setCompressionFilters)}
            className={cn(
              'px-2.5 py-1 text-xs rounded border transition-colors',
              compressionFilters.has(c) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
          >{c}</button>
        ))}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Rechercher un événement..."
          className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} / {enriched.length} dates</span>
      </div>

      {/* Tableau principal */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] text-gray-600 uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                <th className="px-3 py-2.5 text-left font-semibold">Jour</th>
                <th className="px-3 py-2.5 text-left font-semibold">Pression %</th>
                <th className="px-3 py-2.5 text-left font-semibold">Niv. demande</th>
                <th className="px-3 py-2.5 text-right font-semibold">Compression</th>
                <th className="px-3 py-2.5 text-left font-semibold">Niv. compression</th>
                <th className="px-3 py-2.5 text-right font-semibold">TO%</th>
                <th className="px-3 py-2.5 text-left font-semibold">Événement</th>
                <th className="px-3 py-2.5 text-left font-semibold text-amber-700">⚠ Manquant</th>
                <th className="px-3 py-2.5 text-right font-semibold">Tarif actuel</th>
                <th className="px-3 py-2.5 text-right font-semibold">Tarif suggéré</th>
                <th className="px-3 py-2.5 text-left font-semibold">Opportunité</th>
                <th className="px-3 py-2.5 text-center font-semibold">Source</th>
                <th className="px-3 py-2.5 text-left font-semibold">Confiance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(d => {
                const upDelta = d.currentPrice > 0 ? ((d.suggestedPrice - d.currentPrice) / d.currentPrice) * 100 : 0;
                return (
                  <tr key={d.date} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">
                      {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {d.isToday && <span className="ml-2 text-[9px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">Auj.</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{d.dayName}</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'font-bold',
                        d.marketPressure >= 70 ? 'text-red-600' : d.marketPressure >= 40 ? 'text-amber-600' : 'text-gray-500'
                      )}>{Math.round(d.marketPressure)}%</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded text-xs',
                        d.demandLevel === 'Très forte' ? 'bg-red-100 text-red-800' :
                        d.demandLevel === 'Forte' ? 'bg-amber-100 text-amber-800' :
                        d.demandLevel === 'Moyenne' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      )}>{d.demandLevel}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{d.compressionValue}</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded text-xs',
                        d.compressionLevel === 'Très élevée' ? 'bg-red-100 text-red-800' :
                        d.compressionLevel === 'Élevée' ? 'bg-amber-100 text-amber-800' :
                        d.compressionLevel === 'Moyenne' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      )}>{d.compressionLevel}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{Math.round(d.occupancyRate)}%</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{d.events.length === 0 ? '—' : d.events[0].label}</td>
                    <td className="px-3 py-2">
                      {d.missing ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                          <AlertTriangle className="w-3 h-3" />Possible
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-800 font-medium">{Math.round(d.currentPrice)}€</td>
                    <td className={cn(
                      'px-3 py-2 text-right font-bold',
                      upDelta > 0 ? 'text-emerald-600' : upDelta < 0 ? 'text-red-600' : 'text-gray-700'
                    )}>{Math.round(d.suggestedPrice)}€</td>
                    <td className="px-3 py-2 text-emerald-700 text-xs font-medium">{d.opportunity}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded">LH</span>
                    </td>
                    <td className="px-3 py-2"><ConfidenceBar value={d.confidenceScore} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-12 text-center text-sm text-gray-400">
                    Aucune date ne correspond aux filtres
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Synthèse mensuelle */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-2.5 border-b border-gray-200">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Synthèse mensuelle</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] text-gray-600 uppercase tracking-wider">
                <th className="px-3 py-2 text-left font-semibold">Mois</th>
                <th className="px-3 py-2 text-right font-semibold">Jours</th>
                <th className="px-3 py-2 text-right font-semibold">Demande moy.</th>
                <th className="px-3 py-2 text-right font-semibold">Compression moy.</th>
                <th className="px-3 py-2 text-right font-semibold">Forte demande</th>
                <th className="px-3 py-2 text-right font-semibold">Forte compression</th>
                <th className="px-3 py-2 text-right font-semibold text-amber-700">⚠ Alertes</th>
                <th className="px-3 py-2 text-right font-semibold">Confiance moy.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthly.map(row => (
                <tr key={row.month} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-800 capitalize">{row.label}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{row.days}</td>
                  <td className="px-3 py-2 text-right text-amber-600 font-bold">{row.avgDemand}%</td>
                  <td className="px-3 py-2 text-right text-gray-700">{row.avgCompression}</td>
                  <td className="px-3 py-2 text-right text-gray-500 text-xs">{row.strongDemand}j</td>
                  <td className="px-3 py-2 text-right text-gray-500 text-xs">{row.strongCompression}j</td>
                  <td className="px-3 py-2 text-right text-amber-700 font-semibold">
                    {row.alerts > 0 ? `⚠ ${row.alerts}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-600 font-bold">{row.avgConfidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
