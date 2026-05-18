/**
 * FLOWTYM — YIELD & RÈGLES AUTOMATIQUES
 *
 * Page unique fusionnant :
 * - Tableau RMS (recommandations yield)
 * - Règles automatiques (8 types)
 *
 * Les deux fonctionnalités sont intimement liées :
 * les règles alimentent les recommandations yield.
 */

import React, { useState } from 'react';
import { Zap, TrendingUp, Settings2 } from 'lucide-react';
import { YieldRules } from './YieldRules';
import { YieldView } from './YieldView';

type Tab = 'rules' | 'yield';

export function YieldAndRules() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] min-h-0">
      {/* Onglets */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 flex-shrink-0">
        <div className="flex items-center gap-0">
          <button
            onClick={() => setActiveTab('rules')}
            className={[
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            <Settings2 className="w-4 h-4" />
            Règles Automatiques
          </button>
          <button
            onClick={() => setActiveTab('yield')}
            className={[
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'yield'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            <TrendingUp className="w-4 h-4" />
            Yield Management
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'rules' && <YieldRules />}
        {activeTab === 'yield' && <YieldView />}
      </div>
    </div>
  );
}
