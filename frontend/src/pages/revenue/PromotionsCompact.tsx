/**
 * FLOWTYM PROMOTIONS - AVEC SYSTÈME ALERTES
 * 
 * Tableau compact + Alertes activation intelligentes
 * WHY / WHEN / WHO explicatifs
 */

import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Search,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Clock,
  Target,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

type PromoType = 
  | 'mobile_rate' | 'early_booker' | 'last_minute' | 'long_stay' | 'non_refundable'
  | 'genius' | 'couple_escape' | 'family_deal' | 'free_breakfast' | 'secret_deal';

interface PromoAlert {
  why: string;      // Pourquoi activer
  when: string;     // Quand activer
  who: string;      // Pour qui/quel canal
  priority: 'low' | 'medium' | 'high';
}

interface Promotion {
  id: string;
  name: string;
  type: PromoType;
  typeLabel: string;
  discount: string;
  code: string | null;
  startDate: string;
  endDate: string;
  channels: string[];
  minNights: number;
  bookings: number;
  revenue: number;
  active: boolean;
  alert?: PromoAlert;
}

// Générer alertes intelligentes
function generatePromoAlerts(): Promotion[] {
  const promos: Promotion[] = [
    {
      id: '1',
      name: 'Tarif Mobile Exclusif',
      type: 'mobile_rate',
      typeLabel: 'Mobile Rate',
      discount: '10%',
      code: 'MOBILE10',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
      channels: ['Booking.com', 'Direct'],
      minNights: 1,
      bookings: 142,
      revenue: 38420,
      active: true,
      alert: {
        why: 'Capter clientèle mobile-first (60% du trafic OTA)',
        when: 'Permanent - Booking mobile > 50% des réservations',
        who: 'Booking.com + Site direct (app mobile)',
        priority: 'high'
      }
    },
    {
      id: '2',
      name: 'Early Bird Été',
      type: 'early_booker',
      typeLabel: 'Early Booker',
      discount: '20%',
      code: 'EARLY20',
      startDate: '2026-04-01',
      endDate: '2026-08-31',
      channels: ['Direct', 'Expedia'],
      minNights: 2,
      bookings: 87,
      revenue: 24350,
      active: true,
      alert: {
        why: 'Sécuriser occupation haute saison 3 mois avant',
        when: 'Activer 90j avant période cible (avril pour été)',
        who: 'Site direct (meilleure marge) + Expedia',
        priority: 'high'
      }
    },
    {
      id: '3',
      name: 'Last Minute Week-end',
      type: 'last_minute',
      typeLabel: 'Last Minute',
      discount: '25%',
      code: null,
      startDate: '2026-05-15',
      endDate: '2026-06-15',
      channels: ['Direct'],
      minNights: 1,
      bookings: 56,
      revenue: 15680,
      active: false,
      alert: {
        why: 'Occupation < 60% à J-3 → Yield de dernière minute',
        when: 'ACTIVER SI occupation vendredi/samedi < 60% le mercredi',
        who: 'Direct uniquement (pas de commission OTA)',
        priority: 'medium'
      }
    },
    {
      id: '4',
      name: 'Long Séjour Affaires',
      type: 'long_stay',
      typeLabel: 'Long Stay',
      discount: '15%',
      code: 'STAY3+',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      channels: ['Booking.com', 'Direct', 'Expedia'],
      minNights: 3,
      bookings: 124,
      revenue: 42870,
      active: true,
      alert: {
        why: 'Augmenter durée séjour moyenne (actuellement 1.8 nuits)',
        when: 'Permanent - Cibler clientèle affaires/congrès',
        who: 'Tous canaux (large diffusion)',
        priority: 'medium'
      }
    },
    {
      id: '5',
      name: 'Non Remboursable',
      type: 'non_refundable',
      typeLabel: 'Non Refundable',
      discount: '18%',
      code: null,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      channels: ['Booking.com', 'Expedia'],
      minNights: 1,
      bookings: 298,
      revenue: 81240,
      active: true,
      alert: {
        why: 'Meilleure visibilité algorithmes OTA + Réduire no-shows',
        when: 'Permanent sur OTA (boost ranking)',
        who: 'Booking.com + Expedia (demandé par algorithmes)',
        priority: 'high'
      }
    },
    {
      id: '6',
      name: 'Genius / Fidélité',
      type: 'genius',
      typeLabel: 'Genius',
      discount: '12%',
      code: null,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      channels: ['Booking.com'],
      minNights: 1,
      bookings: 412,
      revenue: 112560,
      active: true,
      alert: {
        why: 'Programme fidélité Booking = +35% visibilité résultats',
        when: 'OBLIGATOIRE pour rester compétitif sur Booking',
        who: 'Booking.com uniquement (programme propriétaire)',
        priority: 'high'
      }
    },
    {
      id: '7',
      name: 'Escapade Romantique',
      type: 'couple_escape',
      typeLabel: 'Romantic Escape',
      discount: '1 nuit',
      code: 'LOVE2026',
      startDate: '2026-02-10',
      endDate: '2026-02-16',
      channels: ['Direct'],
      minNights: 2,
      bookings: 34,
      revenue: 9520,
      active: false,
      alert: {
        why: 'Saint-Valentin - Forte demande couples',
        when: 'Activer 1 mois avant (mi-janvier) jusqu\'à Saint-Valentin',
        who: 'Site direct (packaging exclusif)',
        priority: 'low'
      }
    },
    {
      id: '8',
      name: 'Offre Famille',
      type: 'family_deal',
      typeLabel: 'Family Deal',
      discount: '20%',
      code: 'FAMILY20',
      startDate: '2026-07-01',
      endDate: '2026-08-31',
      channels: ['Direct', 'Booking.com'],
      minNights: 2,
      bookings: 0,
      revenue: 0,
      active: false,
      alert: {
        why: 'Vacances scolaires - Segment famille = séjours longs',
        when: 'ACTIVER début juin pour résa juillet-août',
        who: 'Direct + Booking (large audience famille)',
        priority: 'medium'
      }
    },
    {
      id: '9',
      name: 'Petit Déjeuner Offert',
      type: 'free_breakfast',
      typeLabel: 'Free Breakfast',
      discount: '15€/pers',
      code: null,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      channels: ['Direct'],
      minNights: 1,
      bookings: 67,
      revenue: 18340,
      active: true,
      alert: {
        why: 'Valoriser service existant → Conversion +12%',
        when: 'Périodes faible demande (mai, septembre)',
        who: 'Site direct (contrôle coût)',
        priority: 'medium'
      }
    },
    {
      id: '10',
      name: 'Deal Secret',
      type: 'secret_deal',
      typeLabel: 'Secret Deal',
      discount: '30%',
      code: null,
      startDate: '2026-05-20',
      endDate: '2026-05-27',
      channels: ['Booking.com'],
      minNights: 1,
      bookings: 23,
      revenue: 6210,
      active: true,
      alert: {
        why: 'Programme Booking "Deals Secrets" = Visibilité premium',
        when: 'Sur invitation Booking - Période faible occupation',
        who: 'Booking.com uniquement (programme propriétaire)',
        priority: 'medium'
      }
    },
  ];

  return promos;
}

export function PromotionsCompact() {
  const [promotions, setPromotions] = useState<Promotion[]>(generatePromoAlerts());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  // Filtrage
  const filteredPromos = useMemo(() => {
    let result = promotions;
    
    if (filterActive === 'active') result = result.filter(p => p.active);
    if (filterActive === 'inactive') result = result.filter(p => !p.active);
    
    if (searchTerm) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.typeLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return result;
  }, [promotions, searchTerm, filterActive]);

  // Alertes prioritaires
  const highPriorityAlerts = promotions.filter(p => !p.active && p.alert?.priority === 'high');

  // KPIs
  const activeCount = promotions.filter(p => p.active).length;
  const totalBookings = promotions.reduce((sum, p) => sum + p.bookings, 0);
  const totalRevenue = promotions.reduce((sum, p) => sum + p.revenue, 0);

  const toggleActive = (id: string) => {
    setPromotions(promotions.map(p => 
      p.id === id ? { ...p, active: !p.active } : p
    ));
  };

  const deletePromo = (id: string) => {
    if (confirm('Supprimer cette promotion ?')) {
      setPromotions(promotions.filter(p => p.id !== id));
      setSelectedPromo(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={Tag}
          title="Promotions"
          subtitle="Gestion campagnes + Alertes activation intelligentes"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="space-y-4">
          {/* Alertes Activation Prioritaires */}
          {highPriorityAlerts.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                🔔 Promotions à Activer (Haute Priorité)
              </h3>
              <div className="space-y-2">
                {highPriorityAlerts.map((promo) => (
                  <div key={promo.id} className="bg-white rounded-md p-3 flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <div className="font-semibold text-gray-900 mb-1">{promo.name}</div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-start gap-2">
                          <Target className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span><strong>Pourquoi :</strong> {promo.alert?.why}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span><strong>Quand :</strong> {promo.alert?.when}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Users className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span><strong>Pour qui :</strong> {promo.alert?.who}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(promo.id)}
                      className="px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-xs font-medium flex-shrink-0"
                    >
                      Activer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Actives</span>
                <Power className="w-4 h-4 text-green-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{activeCount}</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Réservations</span>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{totalBookings}</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Revenu</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{Math.round(totalRevenue / 1000)}K€</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Conversion</span>
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">12.4%</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 border border-gray-300 rounded-md">
                <button
                  onClick={() => setFilterActive('all')}
                  className={cn(
                    'px-3 py-2 text-sm font-medium transition-colors',
                    filterActive === 'all' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  Toutes
                </button>
                <button
                  onClick={() => setFilterActive('active')}
                  className={cn(
                    'px-3 py-2 text-sm font-medium transition-colors',
                    filterActive === 'active' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  Actives
                </button>
                <button
                  onClick={() => setFilterActive('inactive')}
                  className={cn(
                    'px-3 py-2 text-sm font-medium transition-colors',
                    filterActive === 'inactive' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  Inactives
                </button>
              </div>
            </div>

            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
              <Plus className="w-4 h-4" />
              Nouvelle promotion
            </button>
          </div>

          {/* Table Promotions */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Réduction</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Canaux</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Résa.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Revenu</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPromos.map((promo) => (
                    <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(promo.id)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            promo.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                          )}
                        >
                          {promo.active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedPromo(promo)}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors text-left"
                        >
                          {promo.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {promo.typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{promo.discount}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600">
                          {promo.channels.slice(0, 2).join(', ')}
                          {promo.channels.length > 2 && ` +${promo.channels.length - 2}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{promo.bookings}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                        {Math.round(promo.revenue / 1000)}K€
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedPromo(promo)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePromo(promo.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Détails avec Alertes */}
      {selectedPromo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPromo(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">{selectedPromo.name}</h2>
            
            {selectedPromo.alert && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Recommandations Activation
                </h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div><strong>Pourquoi :</strong> {selectedPromo.alert.why}</div>
                  <div><strong>Quand :</strong> {selectedPromo.alert.when}</div>
                  <div><strong>Pour qui :</strong> {selectedPromo.alert.who}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold">Type:</span> {selectedPromo.typeLabel}</div>
              <div><span className="font-semibold">Réduction:</span> {selectedPromo.discount}</div>
              <div><span className="font-semibold">Code:</span> {selectedPromo.code || 'Aucun'}</div>
              <div><span className="font-semibold">Période:</span> {selectedPromo.startDate} → {selectedPromo.endDate}</div>
              <div><span className="font-semibold">Canaux:</span> {selectedPromo.channels.join(', ')}</div>
              <div><span className="font-semibold">Nuits min:</span> {selectedPromo.minNights}</div>
              <div><span className="font-semibold">Réservations:</span> {selectedPromo.bookings}</div>
              <div><span className="font-semibold">Revenu:</span> {selectedPromo.revenue.toLocaleString()}€</div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedPromo(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
