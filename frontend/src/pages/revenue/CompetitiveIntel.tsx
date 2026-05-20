/**
 * FLOWTYM COMPETITIVE INTELLIGENCE
 * 
 * Intelligence marché et positionnement concurrentiel
 * 
 * Features :
 * - 4 KPI cards stratégiques
 * - Tableau concurrents enrichi (10 colonnes métier)
 * - Graph historique variations 14j
 * - Graph pression marché 7j
 * - Disponibilité estimée concurrents
 * - Positionnement par segment
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Calendar,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface CompetitorData {
  id: string;
  name: string;
  category: number; // étoiles 1-5
  platform: 'Booking.com' | 'Expedia' | 'Direct' | 'Airbnb';
  theirPrice: number;
  ourPrice: number;
  positioning: 'under' | 'over' | 'match';
  availability: 'Faible' | 'Moyenne' | 'Élevée';
  variation7d: number; // % de variation
  revparScore: number; // 0-100
}

interface HistoricalDataPoint {
  date: string;
  ourPrice: number;
  medianPrice: number;
  leaderPrice: number;
}

// Mock data generator
function generateCompetitors(): CompetitorData[] {
  const competitors: CompetitorData[] = [
    { id: '1', name: 'Hôtel du Louvre', category: 5, platform: 'Booking.com' },
    { id: '2', name: 'Le Grand Haussmann', category: 4, platform: 'Booking.com' },
    { id: '3', name: 'Majestic Opéra', category: 5, platform: 'Expedia' },
    { id: '4', name: 'Paris Marriott Opéra', category: 4, platform: 'Direct' },
    { id: '5', name: 'Hôtel Chopin', category: 3, platform: 'Airbnb' },
    { id: '6', name: 'Mercure Opéra Lafayette', category: 4, platform: 'Booking.com' },
    { id: '7', name: 'La Nouvelle République', category: 4, platform: 'Direct' },
    { id: '8', name: 'Best Western Auber', category: 3, platform: 'Expedia' },
    { id: '9', name: 'Pullman Paris Opéra', category: 5, platform: 'Direct' },
  ];

  const ourPrice = 172;

  return competitors.map((comp) => {
    const theirPrice = Math.round(ourPrice * (0.8 + Math.random() * 0.5));
    const positioning = theirPrice > ourPrice ? 'under' : theirPrice < ourPrice ? 'over' : 'match';
    const availability = ['Faible', 'Moyenne', 'Élevée'][Math.floor(Math.random() * 3)] as any;
    const variation7d = Math.round((Math.random() - 0.5) * 30);
    const revparScore = Math.round(50 + Math.random() * 50);

    return {
      ...comp,
      theirPrice,
      ourPrice,
      positioning,
      availability,
      variation7d,
      revparScore,
    };
  });
}

type AvailabilityLevel = 'Faible' | 'Moyenne' | 'Élevée';

interface CompetitorAvailabilityRow {
  competitorId: string;
  competitorName: string;
  days: { date: Date; level: AvailabilityLevel }[];
}

function generateCompetitorAvailability(
  competitors: CompetitorData[]
): CompetitorAvailabilityRow[] {
  const levels: AvailabilityLevel[] = ['Faible', 'Moyenne', 'Élevée'];
  const today = new Date();
  return competitors.slice(0, 6).map((c) => ({
    competitorId: c.id,
    competitorName: c.name,
    days: Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return { date: d, level: levels[Math.floor(Math.random() * levels.length)] };
    }),
  }));
}

function generateHistoricalData(): HistoricalDataPoint[] {
  const data: HistoricalDataPoint[] = [];
  const baseOurPrice = 172;
  const baseMedian = 185;
  const baseLeader = 210;

  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split('T')[0],
      ourPrice: Math.round(baseOurPrice + (Math.random() - 0.5) * 20),
      medianPrice: Math.round(baseMedian + (Math.random() - 0.5) * 25),
      leaderPrice: Math.round(baseLeader + (Math.random() - 0.5) * 30),
    });
  }

  return data;
}

type SortKey = 'name' | 'category' | 'platform' | 'theirPrice' | 'variation7d' | 'revparScore';
type SortDir = 'asc' | 'desc';

export function CompetitiveIntel() {
  const [showFilters, setShowFilters] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<string>('7days');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const competitors = useMemo(() => generateCompetitors(), []);
  const historicalData = useMemo(() => generateHistoricalData(), []);
  const competitorAvailability = useMemo(() => generateCompetitorAvailability(competitors), [competitors]);

  const filteredSortedCompetitors = useMemo(() => {
    let list = competitors;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (platformFilter !== 'all') {
      list = list.filter((c) => c.platform === platformFilter);
    }
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = a[sortKey] as string | number;
        const bv = b[sortKey] as string | number;
        if (typeof av === 'string' && typeof bv === 'string') {
          return av.localeCompare(bv) * dir;
        }
        return ((av as number) - (bv as number)) * dir;
      });
    }
    return list;
  }, [competitors, searchQuery, platformFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  // KPIs
  const kpis = useMemo(() => {
    const ourAvgPrice = competitors[0]?.ourPrice || 172;
    const marketMedian = Math.round(
      competitors.reduce((sum, c) => sum + c.theirPrice, 0) / competitors.length
    );
    const priceDiff = ourAvgPrice - marketMedian;
    const priceDiffPercent = Math.round((priceDiff / marketMedian) * 100);

    const competitivityIndex = 82; // Score complexe basé sur plusieurs facteurs
    const competitorsIncreasing = competitors.filter((c) => c.variation7d > 0).length;
    const variationsDetected = 18; // Nombre de variations détectées 24h

    return {
      priceDiffPercent,
      priceDiff,
      competitivityIndex,
      competitorsIncreasing,
      totalCompetitors: competitors.length,
      variationsDetected,
    };
  }, [competitors]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <RevenueHeader
        icon={Users}
        title="Veille Concurrentielle"
        subtitle="Suivi en temps réel du marché hôtelier — Paris 8e / Opéra"
        quickActions={[
          {
            label: 'Actualiser',
            icon: Activity,
            onClick: () => window.location.reload(),
          },
        ]}
      />

      {/* 4 KPI CARDS */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="grid grid-cols-4 gap-4">
          {/* Position Prix */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-gray-50">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Position prix moy.
            </div>
            <div className="flex items-baseline gap-2">
              <div
                className={cn(
                  'text-3xl font-bold',
                  kpis.priceDiffPercent < 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {kpis.priceDiffPercent > 0 ? '+' : ''}
                {kpis.priceDiffPercent}%
              </div>
              <div className="text-sm text-gray-600">
                ({kpis.priceDiff > 0 ? '+' : ''}
                {kpis.priceDiff}€)
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {kpis.priceDiffPercent < 0 ? 'Nous sommes sous le marché' : 'Nous sommes au-dessus du marché'}
            </div>
          </div>

          {/* Indice Compétitivité */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-emerald-50">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Indice de compétitivité
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-emerald-600">
                {kpis.competitivityIndex}
                <span className="text-lg text-gray-500">/100</span>
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-2 text-xs text-gray-500">vs sem. dernière</div>
          </div>

          {/* Concurrents en Hausse */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-amber-50">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Concurrents en hausse
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-amber-600">
                {kpis.competitorsIncreasing}
                <span className="text-lg text-gray-500">/{kpis.totalCompetitors}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">Pression tarifaire forte</div>
          </div>

          {/* Variations Détectées */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-red-50">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Variations détectées
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-red-600">{kpis.variationsDetected}</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">Dernières 24h</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* TABLEAU CONCURRENTS */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-bold text-gray-700">
                Comparaison tarifaire des concurrents — Nuit du 17 mai 2026
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher un hôtel..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none w-48"
                  />
                </div>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="all">Toutes plateformes</option>
                  <option value="Booking.com">Booking.com</option>
                  <option value="Expedia">Expedia</option>
                  <option value="Direct">Direct</option>
                  <option value="Airbnb">Airbnb</option>
                </select>
                <span className="text-xs text-gray-500">
                  {filteredSortedCompetitors.length}/{competitors.length}
                </span>
                <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                  + Ajouter
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      onClick={() => toggleSort('name')}
                      className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <span className="inline-flex items-center gap-1">Concurrent {sortIcon('name')}</span>
                    </th>
                    <th
                      onClick={() => toggleSort('category')}
                      className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <span className="inline-flex items-center gap-1">Catégorie {sortIcon('category')}</span>
                    </th>
                    <th
                      onClick={() => toggleSort('platform')}
                      className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <span className="inline-flex items-center gap-1">Plateforme {sortIcon('platform')}</span>
                    </th>
                    <th
                      onClick={() => toggleSort('theirPrice')}
                      className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <span className="inline-flex items-center gap-1">Leur prix {sortIcon('theirPrice')}</span>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Notre prix</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Positionnement</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Dispo estimée</th>
                    <th
                      onClick={() => toggleSort('variation7d')}
                      className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <span className="inline-flex items-center gap-1">Variation 7j {sortIcon('variation7d')}</span>
                    </th>
                    <th
                      onClick={() => toggleSort('revparScore')}
                      className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <span className="inline-flex items-center gap-1">Score RevPar {sortIcon('revparScore')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSortedCompetitors.map((comp) => (
                    <tr key={comp.id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{comp.name}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400 hover:text-blue-600 cursor-pointer" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {Array.from({ length: comp.category }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">
                          {comp.platform.replace('.com', '')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {comp.theirPrice}€
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">
                        {comp.ourPrice}€
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-[10px] font-bold rounded',
                            comp.positioning === 'under' && 'bg-emerald-100 text-emerald-700',
                            comp.positioning === 'over' && 'bg-red-100 text-red-700',
                            comp.positioning === 'match' && 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {comp.positioning === 'under' && 'Nous < marché'}
                          {comp.positioning === 'over' && 'Nous > marché'}
                          {comp.positioning === 'match' && 'Parité'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-[10px] font-bold rounded',
                            comp.availability === 'Faible' && 'bg-red-100 text-red-700',
                            comp.availability === 'Moyenne' && 'bg-amber-100 text-amber-700',
                            comp.availability === 'Élevée' && 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {comp.availability}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {comp.variation7d > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5 text-red-600" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span
                            className={cn(
                              'font-semibold text-xs',
                              comp.variation7d > 0 ? 'text-red-600' : 'text-emerald-600'
                            )}
                          >
                            {comp.variation7d > 0 ? '+' : ''}
                            {comp.variation7d}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-blue-600">{comp.revparScore}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GRAPHIQUES */}
          <div className="grid grid-cols-2 gap-6">
            {/* Historique Variations 14j */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                Historique des variations tarifaires (14 jours)
              </h3>
              <div className="h-48 flex items-end justify-between gap-1">
                {historicalData.map((point, i) => {
                  const maxPrice = Math.max(
                    ...historicalData.map((p) => Math.max(p.ourPrice, p.medianPrice, p.leaderPrice))
                  );
                  const minPrice = Math.min(
                    ...historicalData.map((p) => Math.min(p.ourPrice, p.medianPrice, p.leaderPrice))
                  );
                  const range = maxPrice - minPrice;

                  const ourHeight = ((point.ourPrice - minPrice) / range) * 100;
                  const medianHeight = ((point.medianPrice - minPrice) / range) * 100;
                  const leaderHeight = ((point.leaderPrice - minPrice) / range) * 100;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      {/* Bars */}
                      <div className="w-full flex items-end justify-center gap-0.5 h-40">
                        <div
                          className="w-2 bg-blue-500 rounded-t"
                          style={{ height: `${ourHeight}%` }}
                          title={`Notre prix: ${point.ourPrice}€`}
                        />
                        <div
                          className="w-2 bg-orange-500 rounded-t"
                          style={{ height: `${medianHeight}%` }}
                          title={`Médiane: ${point.medianPrice}€`}
                        />
                        <div
                          className="w-2 bg-purple-500 rounded-t"
                          style={{ height: `${leaderHeight}%` }}
                          title={`Leader: ${point.leaderPrice}€`}
                        />
                      </div>

                      {/* Date label */}
                      <div className="text-[9px] text-gray-500 rotate-45 origin-top-left whitespace-nowrap">
                        {new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>Nous</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-orange-500 rounded" />
                  <span>Marché moy.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-purple-500 rounded" />
                  <span>Leader</span>
                </div>
              </div>
            </div>

            {/* Pression Marché 7j */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                Pression marché — 7 prochains jours
              </h3>
              <div className="space-y-3">
                {[
                  { date: '17/05', label: 'Élevée', value: 85, color: 'bg-red-500' },
                  { date: '18/05', label: 'Très haute', value: 95, color: 'bg-red-600' },
                  { date: '19/05', label: 'Très haute', value: 92, color: 'bg-red-600' },
                  { date: '20/05', label: 'Basse', value: 45, color: 'bg-orange-500' },
                  { date: '21/05', label: 'Élevée', value: 78, color: 'bg-red-500' },
                  { date: '22/05', label: 'Modérée', value: 60, color: 'bg-amber-500' },
                  { date: '23/05', label: 'Modérée', value: 55, color: 'bg-amber-500' },
                ].map((item) => (
                  <div key={item.date} className="flex items-center gap-3">
                    <div className="text-xs font-semibold text-gray-600 w-12">{item.date}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', item.color)}
                        style={{ width: `${item.value}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-700">{item.label}</span>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-700 w-8 text-right">
                      {item.value}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DISPONIBILITÉ ESTIMÉE CONCURRENTS — 7 JOURS */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">
                Disponibilité estimée des concurrents — 7 prochains jours
              </h3>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                  <span>Faible</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                  <span>Moyenne</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
                  <span>Élevée</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">
                      Concurrent
                    </th>
                    {competitorAvailability[0]?.days.map((d, i) => (
                      <th
                        key={i}
                        className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[80px]"
                      >
                        <div className="text-[10px] uppercase text-gray-500">
                          {d.date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </div>
                        <div className="text-xs">
                          {d.date.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {competitorAvailability.map((row) => (
                    <tr key={row.competitorId} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-semibold text-gray-900 sticky left-0 bg-white z-10">
                        {row.competitorName}
                      </td>
                      {row.days.map((d, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          <div
                            className={cn(
                              'mx-auto inline-block px-2 py-1 rounded text-[10px] font-bold border',
                              d.level === 'Faible' &&
                                'bg-red-100 text-red-700 border-red-300',
                              d.level === 'Moyenne' &&
                                'bg-amber-100 text-amber-700 border-amber-300',
                              d.level === 'Élevée' &&
                                'bg-emerald-100 text-emerald-700 border-emerald-300'
                            )}
                          >
                            {d.level}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* POSITIONNEMENT PAR SEGMENT */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-4">
              Positionnement prix par segment
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Budget (<130€)', value: 40, isUs: false },
                { label: 'Économique (130-160€)', value: 55, isUs: false },
                { label: 'Milieu (160-200€)', value: 72, isUs: true },
                { label: 'Haut de gamme (200-280€)', value: 82, isUs: false },
                { label: 'Luxe (>280€)', value: 92, isUs: false },
              ].map((segment) => (
                <div key={segment.label} className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-gray-700 w-56">
                    {segment.label}
                    {segment.isUs && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">
                        ← Nous
                      </span>
                    )}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        segment.isUs ? 'bg-blue-500' : 'bg-gray-400'
                      )}
                      style={{ width: `${segment.value}%` }}
                    />
                  </div>
                  <div className="text-sm font-bold text-gray-700 w-12 text-right">
                    {segment.value}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
