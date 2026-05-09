/**
 * FLOWTYM — Live Supabase reservations banner.
 *
 * Shows the authoritative dataset coming from the Supabase backend so the
 * hotelier can validate that real data flows end-to-end. The legacy mock
 * rendering remains untouched below so that no operational behaviour is
 * lost while we incrementally migrate each section.
 */
import React from 'react';
import { CheckCircle2, Building2, Calendar, AlertCircle, RefreshCw } from 'lucide-react';

import { useReservations } from '@/src/domains/reservations/hooks';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import { useAuth } from '@/src/domains/auth/AuthContext';

const fmtMoney = (v: number | null | undefined): string =>
  typeof v === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
    : '—';

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmée',
  checked_in: 'Check-in',
  checked_out: 'Check-out',
  cancelled: 'Annulée',
};

const STATUS_TONE: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  checked_in: 'bg-violet-50 text-violet-700',
  checked_out: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-50 text-red-700',
};

export const LiveReservationsBanner: React.FC = () => {
  const { session, status } = useAuth();
  const hotelQ = useActiveHotel();
  const resQ = useReservations({ limit: 6 });

  if (status !== 'authenticated') return null;

  const isLoading = hotelQ.isLoading || resQ.isLoading;
  const error = hotelQ.error ?? resQ.error;
  const rows = resQ.data?.rows ?? [];
  const total = resQ.data?.total ?? 0;
  const ca = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  return (
    <div
      data-testid="live-reservations-banner"
      className="mx-6 mt-4 mb-2 rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/30 to-white p-5 shadow-[0_2px_30px_rgba(139,92,246,0.06)]"
    >
      <header className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-violet-600/10 text-violet-700 shrink-0">
            <Building2 size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-600">
              Données live · Supabase
            </p>
            <h3 className="text-sm font-bold text-gray-900 truncate" data-testid="live-hotel-name">
              {hotelQ.data?.name ?? (isLoading ? 'Chargement…' : 'Hôtel inconnu')}
              <span className="text-gray-400 font-medium"> · {session?.role ?? '—'}</span>
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void resQ.refetch();
            void hotelQ.refetch();
          }}
          data-testid="live-refresh-button"
          className="inline-flex items-center gap-2 text-xs font-semibold text-violet-700 hover:text-violet-900 transition-colors"
        >
          <RefreshCw size={14} className={resQ.isFetching ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </header>

      {error ? (
        <div
          className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
          data-testid="live-error"
        >
          <AlertCircle size={16} /> {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi label="Réservations DB" value={String(total)} icon={CheckCircle2} testid="live-kpi-total" />
            <Kpi label="Affichées" value={String(rows.length)} icon={Calendar} />
            <Kpi label="CA cumulé" value={fmtMoney(ca)} icon={CheckCircle2} testid="live-kpi-ca" />
            <Kpi
              label="Hôtel"
              value={hotelQ.data?.city ?? '—'}
              icon={Building2}
              hint={hotelQ.data?.country ?? ''}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
            <table className="min-w-full text-sm" data-testid="live-reservations-table">
              <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/60">
                <tr>
                  <th className="text-left font-semibold px-4 py-2">Réf.</th>
                  <th className="text-left font-semibold px-4 py-2">Client</th>
                  <th className="text-left font-semibold px-4 py-2">Dates</th>
                  <th className="text-left font-semibold px-4 py-2">Pax</th>
                  <th className="text-left font-semibold px-4 py-2">Statut</th>
                  <th className="text-right font-semibold px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                      Chargement des réservations…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                      Aucune réservation pour cet hôtel.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-gray-100 hover:bg-violet-50/30 transition-colors"
                      data-testid={`live-reservation-row-${r.reference ?? r.id}`}
                    >
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">
                        {r.reference ?? r.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate">
                        {r.guest_name ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                        {fmtDate(r.check_in)} → {fmtDate(r.check_out)}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{r.pax ?? r.adults ?? 1}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            STATUS_TONE[r.status ?? ''] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {STATUS_LABEL[r.status ?? ''] ?? r.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900 tabular-nums">
                        {fmtMoney(r.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

interface KpiProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
  testid?: string;
}

const Kpi: React.FC<KpiProps> = ({ label, value, icon: Icon, hint, testid }) => (
  <div className="rounded-xl bg-white border border-gray-100 p-3 flex items-center gap-3" data-testid={testid}>
    <span className="grid place-items-center w-9 h-9 rounded-lg bg-violet-50 text-violet-700 shrink-0">
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-sm font-bold text-gray-900 truncate">{value}</p>
      {hint ? <p className="text-[10px] text-gray-400 truncate">{hint}</p> : null}
    </div>
  </div>
);

export default LiveReservationsBanner;
