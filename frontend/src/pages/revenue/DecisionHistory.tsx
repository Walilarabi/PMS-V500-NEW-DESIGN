/**
 * FLOWTYM DECISION HISTORY
 * 
 * Audit trail complet des recommandations IA et modifications tarifaires
 * 
 * Features :
 * - 3 KPI cards (Acceptées/Refusées/Maintenues)
 * - Tableau audit avec filtres
 * - Traçabilité complète
 * - Export historique
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Minus,
  FileText,
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface DecisionRecord {
  id: string;
  date: string;
  dayName: string;
  event: string | null;
  recommendation: 'Augmenter' | 'Baisser' | 'Maintenir';
  initialPrice: number;
  suggestedPrice: number;
  finalPrice: number;
  decision: 'Acceptée' | 'Refusée' | 'Maintenue';
  strategy: string;
  timestamp: string;
  userName: string;
}

// Mock data generator
function generateMockHistory(): DecisionRecord[] {
  const records: DecisionRecord[] = [];
  const strategies = ['Yield Max', 'Haute demande', 'Opportuniste', 'Défensive', 'Agressive', 'Équilibrée'];
  const events = ['EUROPCAR', 'ROLAND GARROS', 'CHAMP. EUROPE NATATION', null, null, null];
  
  for (let i = 0; i < 50; i++) {
    const date = new Date('2026-05-01');
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const initialPrice = 250 + Math.random() * 80;
    const adjustment = Math.random() < 0.6 ? 1 + Math.random() * 0.2 : 1 - Math.random() * 0.15;
    const suggestedPrice = Math.round(initialPrice * adjustment);
    
    const decisionRoll = Math.random();
    const decision = decisionRoll < 0.7 ? 'Acceptée' : decisionRoll < 0.85 ? 'Maintenue' : 'Refusée';
    const finalPrice = decision === 'Acceptée' ? suggestedPrice : initialPrice;
    
    const recommendation = suggestedPrice > initialPrice ? 'Augmenter' : suggestedPrice < initialPrice ? 'Baisser' : 'Maintenir';
    
    records.push({
      id: `rec_${i}`,
      date: dateStr,
      dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
      event: events[Math.floor(Math.random() * events.length)],
      recommendation,
      initialPrice: Math.round(initialPrice),
      suggestedPrice,
      finalPrice,
      decision,
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      timestamp: date.toISOString(),
      userName: 'Revenue Manager',
    });
  }
  
  return records.reverse(); // Plus récent d'abord
}

export function DecisionHistory() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  
  const allRecords = useMemo(() => generateMockHistory(), []);
  
  // Filtrage
  const filteredRecords = useMemo(() => {
    return allRecords.filter((record) => {
      if (statusFilter !== 'all' && record.decision !== statusFilter) return false;
      
      if (periodFilter !== 'all') {
        const recordDate = new Date(record.date);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (periodFilter === '7days' && daysDiff > 7) return false;
        if (periodFilter === '30days' && daysDiff > 30) return false;
        if (periodFilter === '90days' && daysDiff > 90) return false;
      }
      
      return true;
    });
  }, [allRecords, statusFilter, periodFilter]);
  
  // KPIs
  const kpis = useMemo(() => {
    const accepted = allRecords.filter((r) => r.decision === 'Acceptée').length;
    const rejected = allRecords.filter((r) => r.decision === 'Refusée').length;
    const maintained = allRecords.filter((r) => r.decision === 'Maintenue').length;
    
    return { accepted, rejected, maintained };
  }, [allRecords]);
  
  const handleExport = () => {
    alert('Export CSV en cours de développement');
  };
  
  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <RevenueHeader
        icon={FileText}
        title="Historique des décisions"
        subtitle="Suivi et traçabilité des recommandations IA et modifications tarifaires"
        quickActions={[
          {
            label: 'Export CSV',
            icon: Download,
            onClick: handleExport,
          },
        ]}
      />
      
      {/* KPI CARDS */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="grid grid-cols-3 gap-4">
          {/* Acceptées */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-600 uppercase mb-1">
                  Recommandations acceptées
                </div>
                <div className="text-3xl font-bold text-emerald-700">
                  {kpis.accepted}
                </div>
              </div>
              <CheckCircle className="w-10 h-10 text-emerald-500 opacity-50" />
            </div>
          </div>
          
          {/* Refusées */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-red-600 uppercase mb-1">
                  Recommandations refusées
                </div>
                <div className="text-3xl font-bold text-red-700">
                  {kpis.rejected}
                </div>
              </div>
              <XCircle className="w-10 h-10 text-red-500 opacity-50" />
            </div>
          </div>
          
          {/* Maintenues */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">
                  Tarifs maintenus
                </div>
                <div className="text-3xl font-bold text-gray-700">
                  {kpis.maintained}
                </div>
              </div>
              <Minus className="w-10 h-10 text-gray-500 opacity-50" />
            </div>
          </div>
        </div>
      </div>
      
      {/* FILTRES */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filtres :</span>
        </div>
        
        {/* Statut */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="Acceptée">Acceptées</option>
          <option value="Refusée">Refusées</option>
          <option value="Maintenue">Maintenues</option>
        </select>
        
        {/* Période */}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Toutes les périodes</option>
          <option value="7days">7 derniers jours</option>
          <option value="30days">30 derniers jours</option>
          <option value="90days">90 derniers jours</option>
        </select>
        
        <div className="ml-auto text-sm text-gray-600">
          <span className="font-semibold">{filteredRecords.length}</span> résultat(s)
        </div>
      </div>
      
      {/* TABLEAU */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-200">
                Date
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-200">
                Jour
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-200">
                Événement
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-200">
                Recommandation IA
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-200">
                Prix initial
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-200">
                Prix suggéré
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-200">
                Prix final
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-200">
                Décision
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Stratégie
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr
                key={record.id}
                className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
              >
                <td className="px-4 py-3 border-r border-gray-200 font-medium">
                  {new Date(record.date).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-gray-700">
                  {record.dayName}
                </td>
                <td className="px-4 py-3 border-r border-gray-200">
                  {record.event && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                      {record.event}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 border-r border-gray-200">
                  <div className="flex items-center gap-1.5">
                    {record.recommendation === 'Augmenter' && (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {record.recommendation === 'Baisser' && (
                      <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                    )}
                    {record.recommendation === 'Maintenir' && (
                      <Minus className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    <span className="text-xs font-semibold">{record.recommendation}</span>
                  </div>
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-right font-semibold">
                  {record.initialPrice}€
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-right font-bold text-blue-600">
                  {record.suggestedPrice}€
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-right font-bold">
                  <span
                    className={cn(
                      record.finalPrice > record.initialPrice && 'text-emerald-600',
                      record.finalPrice < record.initialPrice && 'text-red-600',
                      record.finalPrice === record.initialPrice && 'text-gray-700'
                    )}
                  >
                    {record.finalPrice}€
                  </span>
                  {record.finalPrice !== record.initialPrice && (
                    <span className="ml-1 text-[10px] text-gray-500">
                      ({record.finalPrice > record.initialPrice ? '+' : ''}
                      {Math.round(((record.finalPrice - record.initialPrice) / record.initialPrice) * 100)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-center">
                  <span
                    className={cn(
                      'px-2 py-1 text-[10px] font-bold rounded',
                      record.decision === 'Acceptée' && 'bg-emerald-100 text-emerald-700',
                      record.decision === 'Refusée' && 'bg-red-100 text-red-700',
                      record.decision === 'Maintenue' && 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {record.decision}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{record.strategy}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredRecords.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucune décision ne correspond aux filtres sélectionnés
          </div>
        )}
      </div>
    </div>
  );
}
