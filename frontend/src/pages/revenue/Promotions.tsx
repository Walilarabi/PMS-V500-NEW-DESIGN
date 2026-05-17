/**
 * FLOWTYM PROMOTIONS
 * 
 * Gestion des campagnes promotionnelles et codes promo
 * 
 * Features :
 * - Campagnes actives (cards avec performance)
 * - Codes promo actifs
 * - Calendrier promotionnel
 * - Création/édition promos
 */

import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  Calendar,
  Percent,
  DollarSign,
  Users,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface Promotion {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'free_nights';
  value: number;
  code: string | null;
  startDate: string;
  endDate: string;
  channels: string[];
  bookingsGenerated: number;
  revenueGenerated: number;
  active: boolean;
}

// Mock data
function generatePromotions(): Promotion[] {
  return [
    {
      id: 'promo_1',
      name: 'Été 2026 - Early Bird',
      type: 'percentage',
      value: 20,
      code: 'SUMMER20',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      channels: ['Booking.com', 'Site Direct'],
      bookingsGenerated: 87,
      revenueGenerated: 24350,
      active: true,
    },
    {
      id: 'promo_2',
      name: 'Week-end Prolongé',
      type: 'percentage',
      value: 15,
      code: 'WEEKEND15',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      channels: ['Site Direct', 'Expedia'],
      bookingsGenerated: 42,
      revenueGenerated: 11680,
      active: true,
    },
    {
      id: 'promo_3',
      name: '3 Nuits = 2 Payées',
      type: 'free_nights',
      value: 1,
      code: null,
      startDate: '2026-03-15',
      endDate: '2026-04-15',
      channels: ['Booking.com'],
      bookingsGenerated: 28,
      revenueGenerated: 7840,
      active: false,
    },
  ];
}

export function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>(generatePromotions());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const activePromos = promotions.filter((p) => p.active);
  const inactivePromos = promotions.filter((p) => !p.active);

  const totalBookings = promotions.reduce((sum, p) => sum + p.bookingsGenerated, 0);
  const totalRevenue = promotions.reduce((sum, p) => sum + p.revenueGenerated, 0);

  const togglePromo = (id: string) => {
    setPromotions(promotions.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  };

  const deletePromo = (id: string) => {
    if (confirm('Supprimer cette promotion ?')) {
      setPromotions(promotions.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <RevenueHeader
        icon={Tag}
        title="Promotions"
        subtitle="Gestion des campagnes promotionnelles et codes promo"
        quickActions={[
          {
            label: 'Nouvelle promo',
            icon: Plus,
            onClick: () => setShowCreateModal(true),
          },
        ]}
      />

      {/* KPI CARDS */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Promos actives
            </div>
            <div className="text-3xl font-bold text-emerald-600">{activePromos.length}</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Réservations générées
            </div>
            <div className="text-3xl font-bold text-blue-600">{totalBookings}</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Revenu généré
            </div>
            <div className="text-3xl font-bold text-emerald-600">
              {Math.round(totalRevenue).toLocaleString()}€
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Taux conversion
            </div>
            <div className="text-3xl font-bold text-blue-600">12.4%</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* CAMPAGNES ACTIVES */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-700">Campagnes actives</h3>
            </div>

            {activePromos.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                Aucune campagne active
              </div>
            ) : (
              <div className="p-4 grid grid-cols-3 gap-4">
                {activePromos.map((promo) => (
                  <PromoCard
                    key={promo.id}
                    promo={promo}
                    onToggle={() => togglePromo(promo.id)}
                    onDelete={() => deletePromo(promo.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* CAMPAGNES INACTIVES */}
          {inactivePromos.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700">Campagnes terminées/inactives</h3>
              </div>

              <div className="p-4 grid grid-cols-3 gap-4">
                {inactivePromos.map((promo) => (
                  <PromoCard
                    key={promo.id}
                    promo={promo}
                    onToggle={() => togglePromo(promo.id)}
                    onDelete={() => deletePromo(promo.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Créer une nouvelle promotion
            </h2>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nom de la campagne
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Été 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Code promo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: SUMMER20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Type de réduction
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option>Pourcentage (%)</option>
                    <option>Montant fixe (€)</option>
                    <option>Nuits gratuites</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Valeur
                  </label>
                  <input
                    type="number"
                    placeholder="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Date début
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Date fin
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  alert('Création de promotion en développement');
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Créer la promotion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMO CARD
// ═══════════════════════════════════════════════════════════════════════════

function PromoCard({
  promo,
  onToggle,
  onDelete,
}: {
  promo: Promotion;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const formatValue = () => {
    if (promo.type === 'percentage') return `-${promo.value}%`;
    if (promo.type === 'fixed') return `-${promo.value}€`;
    return `${promo.value} nuit(s) gratuite(s)`;
  };

  return (
    <div
      className={cn(
        'border-2 rounded-lg p-4 transition-all hover:shadow-lg',
        promo.active ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50 opacity-70'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-gray-900 mb-1">{promo.name}</h4>
          {promo.code && (
            <div className="inline-block px-2 py-0.5 bg-blue-600 text-white text-xs font-mono font-bold rounded">
              {promo.code}
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
            promo.active ? 'bg-emerald-600' : 'bg-gray-300'
          )}
        >
          <span
            className={cn(
              'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
              promo.active ? 'translate-x-5' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Réduction</span>
          <span className="font-bold text-emerald-600">{formatValue()}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Période</span>
          <span className="font-semibold text-gray-900 text-xs">
            {new Date(promo.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} -{' '}
            {new Date(promo.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Réservations</span>
          <span className="font-bold text-blue-600">{promo.bookingsGenerated}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Revenu</span>
          <span className="font-bold text-gray-900">{Math.round(promo.revenueGenerated).toLocaleString()}€</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        <button
          className="flex-1 px-2 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded hover:bg-blue-200 flex items-center justify-center gap-1"
        >
          <Edit className="w-3 h-3" />
          Éditer
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-2 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded hover:bg-red-200 flex items-center justify-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Supprimer
        </button>
      </div>
    </div>
  );
}
