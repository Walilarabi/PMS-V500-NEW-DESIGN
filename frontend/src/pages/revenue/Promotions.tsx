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
  Share2,
  ChevronLeft,
  ChevronRight,
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

const CHANNEL_OPTIONS = ['Booking.com', 'Expedia', 'Site Direct', 'Airbnb'];
const PROMO_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-teal-500',
];

interface PromoFormState {
  name: string;
  code: string;
  type: Promotion['type'];
  value: number;
  startDate: string;
  endDate: string;
  channels: string[];
}

const defaultForm = (): PromoFormState => ({
  name: '',
  code: '',
  type: 'percentage',
  value: 10,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  channels: ['Site Direct'],
});

export function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>(generatePromotions());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<PromoFormState>(defaultForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

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

  const openCreate = () => {
    setForm(defaultForm());
    setFormError(null);
    setShowCreateModal(true);
  };

  const submitCreate = () => {
    if (!form.name.trim()) {
      setFormError('Le nom de la campagne est requis');
      return;
    }
    if (form.value <= 0) {
      setFormError('La valeur doit être supérieure à zéro');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setFormError('La date de fin doit être postérieure à la date de début');
      return;
    }
    if (form.channels.length === 0) {
      setFormError('Sélectionnez au moins un canal');
      return;
    }

    const newPromo: Promotion = {
      id: `promo_${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      value: form.value,
      code: form.code.trim() || null,
      startDate: form.startDate,
      endDate: form.endDate,
      channels: form.channels,
      bookingsGenerated: 0,
      revenueGenerated: 0,
      active: true,
    };
    setPromotions([newPromo, ...promotions]);
    setShowCreateModal(false);
  };

  const toggleFormChannel = (channel: string) => {
    setForm((f) =>
      f.channels.includes(channel)
        ? { ...f, channels: f.channels.filter((c) => c !== channel) }
        : { ...f, channels: [...f.channels, channel] }
    );
  };

  const navigateMonth = (delta: number) => {
    setCalendarMonth((m) => {
      const next = new Date(m);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
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
            onClick: openCreate,
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

          {/* CALENDRIER PROMOTIONNEL */}
          <PromoCalendar
            month={calendarMonth}
            promotions={promotions}
            onPrev={() => navigateMonth(-1)}
            onNext={() => navigateMonth(1)}
            onToday={() => {
              const d = new Date();
              d.setDate(1);
              setCalendarMonth(d);
            }}
          />

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
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Créer une nouvelle promotion
            </h2>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nom de la campagne *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: SUMMER20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Type de réduction
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as Promotion['type'] })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (€)</option>
                    <option value="free_nights">Nuits gratuites</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Valeur *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                    placeholder="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Date début *
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Date fin *
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Canaux de diffusion *
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map((channel) => {
                    const selected = form.channels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => toggleFormChannel(channel)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors',
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                        )}
                      >
                        {channel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={submitCreate}
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

  // Calculer performance (fictif: objectif 100 bookings)
  const performancePercent = Math.min(100, (promo.bookingsGenerated / 100) * 100);

  return (
    <div
      className={cn(
        'border-2 rounded-xl p-5 transition-all duration-300',
        promo.active 
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white hover:shadow-2xl hover:scale-105' 
          : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white opacity-70 hover:shadow-lg'
      )}
    >
      {/* HEADER avec gradient badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-bold text-gray-900 text-lg">{promo.name}</h4>
            {promo.active && (
              <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold rounded-full uppercase">
                Active
              </span>
            )}
          </div>
          
          {promo.code && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-mono font-bold rounded-lg shadow-sm">
              <Tag className="w-3 h-3" />
              {promo.code}
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200',
            promo.active ? 'bg-emerald-600 shadow-md' : 'bg-gray-300'
          )}
          title={promo.active ? 'Désactiver' : 'Activer'}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm',
              promo.active ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* RÉDUCTION en grand */}
      <div className="mb-4 p-4 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-lg border border-emerald-200">
        <div className="text-xs text-emerald-700 font-semibold mb-1">RÉDUCTION</div>
        <div className="text-2xl font-black text-emerald-700">{formatValue()}</div>
      </div>

      {/* PÉRIODE */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-gray-600">Du</span>
        <span className="font-bold text-gray-900">
          {new Date(promo.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
        <span className="text-gray-600">au</span>
        <span className="font-bold text-gray-900">
          {new Date(promo.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* CANAUX (badges) */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 font-semibold mb-2 flex items-center gap-1">
          <Share2 className="w-3 h-3" />
          Canaux diffusion
        </div>
        <div className="flex flex-wrap gap-1.5">
          {promo.channels.map((channel, idx) => (
            <span 
              key={idx}
              className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md"
            >
              {channel}
            </span>
          ))}
        </div>
      </div>

      {/* PERFORMANCE */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center gap-1">
            <Users className="w-4 h-4" />
            Réservations
          </span>
          <span className="font-bold text-blue-600">{promo.bookingsGenerated}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            Revenu généré
          </span>
          <span className="font-bold text-emerald-600">
            {Math.round(promo.revenueGenerated).toLocaleString()}€
          </span>
        </div>

        {/* Progress bar */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Performance vs objectif</span>
            <span className="font-bold">{performancePercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${performancePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        <button
          className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 hover:shadow-md flex items-center justify-center gap-1.5"
        >
          <Edit className="w-3.5 h-3.5" />
          Éditer
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 hover:shadow-md flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMO CALENDAR (mois)
// ═══════════════════════════════════════════════════════════════════════════

function PromoCalendar({
  month,
  promotions,
  onPrev,
  onNext,
  onToday,
}: {
  month: Date;
  promotions: Promotion[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Lundi = 0
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const promoColor = (promoId: string) => {
    const idx = promotions.findIndex((p) => p.id === promoId);
    return PROMO_COLORS[idx % PROMO_COLORS.length];
  };

  const cells: ({ date: Date; promos: Promotion[] } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIdx, d);
    const active = promotions.filter((p) => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return p.active && date >= start && date <= end;
    });
    cells.push({ date, promos: active });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-bold text-gray-700">Calendrier promotionnel</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 text-sm font-bold text-gray-800 capitalize">
            {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={onNext}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onToday}
            className="ml-2 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((d) => (
            <div
              key={d}
              className="text-[10px] font-bold text-gray-500 uppercase text-center py-1"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) {
              return <div key={i} className="h-20 rounded bg-gray-50" />;
            }
            const isToday = cell.date.getTime() === today.getTime();
            return (
              <div
                key={i}
                className={cn(
                  'h-20 rounded border p-1 flex flex-col gap-0.5 overflow-hidden',
                  isToday
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                )}
              >
                <div
                  className={cn(
                    'text-[11px] font-bold',
                    isToday ? 'text-blue-700' : 'text-gray-700'
                  )}
                >
                  {cell.date.getDate()}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {cell.promos.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      title={`${p.name}${p.code ? ` (${p.code})` : ''}`}
                      className={cn(
                        'text-[9px] text-white font-semibold truncate px-1 rounded',
                        promoColor(p.id)
                      )}
                    >
                      {p.name}
                    </div>
                  ))}
                  {cell.promos.length > 3 && (
                    <div className="text-[9px] font-bold text-gray-500">
                      +{cell.promos.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
