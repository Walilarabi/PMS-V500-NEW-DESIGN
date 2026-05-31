/**
 * FLOWTYM — Popover d'information sur un plan tarifaire.
 *
 * Affiche au survol / clic de l'icône ⓘ à côté du sélecteur de plan :
 *   • Nom et code du plan
 *   • Pension (RO, BB, HB, FB) et annulation (FLEX, NANR)
 *   • Restrictions (min/max séjour)
 *   • Détail nuitée × nuitée depuis rate_prices (prix du Revenue → Calendrier Tarifaire)
 *
 * Données 100% réelles — aucune valeur inventée. Si aucune donnée tarif n'existe
 * pour les dates, affiche un message explicite.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Info, X, BedDouble, ShieldCheck, ShieldX, Clock, AlertTriangle } from 'lucide-react';
import type { RatePlanOption } from '@/src/hooks/reservations/useRatePlansForPartner';
import { useRatePricesForPlan } from '@/src/hooks/reservations/useRatePricesForPlan';
import { cn } from '@/src/lib/utils';

// ── Labels lisibles ──────────────────────────────────────────────────────────
const PENSION_LABELS: Record<string, string> = {
  RO: 'Room Only',
  BB: 'Petit-déjeuner inclus',
  HB: 'Demi-pension',
  FB: 'Pension complète',
};
const CANCEL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  FLEX: { label: 'Annulation flexible',        color: '#065F46', bg: '#D1FAE5' },
  NANR: { label: 'Non remboursable',            color: '#991B1B', bg: '#FEE2E2' },
};

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

interface Props {
  plan: RatePlanOption | null;
  checkIn: string | null;
  checkOut: string | null;
  roomTypeCode?: string | null;
}

export function RatePlanInfoPopover({ plan, checkIn, checkOut, roomTypeCode }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: prices = [], isLoading: loadingPrices } = useRatePricesForPlan(
    open ? plan?.id ?? null : null,
    open ? checkIn : null,
    open ? checkOut : null,
    open ? roomTypeCode : null,
  );

  // Fermer en cliquant dehors
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!plan) return null;

  const cancelCfg = plan.cancellation_type ? CANCEL_LABELS[plan.cancellation_type] : null;
  const pensionLabel = plan.pension_type ? (PENSION_LABELS[plan.pension_type] ?? plan.pension_type) : null;

  // Grouper les prix par date (plusieurs room_types peuvent exister)
  const pricesByDate = new Map<string, { min: number; max: number; codes: string[] }>();
  for (const p of prices) {
    const existing = pricesByDate.get(p.stay_date);
    const price = Number(p.price);
    if (!existing) {
      pricesByDate.set(p.stay_date, { min: price, max: price, codes: [p.room_type_code] });
    } else {
      existing.min = Math.min(existing.min, price);
      existing.max = Math.max(existing.max, price);
      if (!existing.codes.includes(p.room_type_code)) existing.codes.push(p.room_type_code);
    }
  }
  const dateRows = Array.from(pricesByDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Total si une seule room_type (ou min/max si plusieurs)
  const hasDates = checkIn && checkOut && checkIn < checkOut;
  const nights = hasDates
    ? Math.round((new Date(checkOut!).getTime() - new Date(checkIn!).getTime()) / 86_400_000)
    : 0;
  const totalMin = dateRows.reduce((s, [, v]) => s + v.min, 0);
  const totalMax = dateRows.reduce((s, [, v]) => s + v.max, 0);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0',
          open
            ? 'bg-violet-100 text-violet-600'
            : 'bg-gray-100 text-gray-400 hover:bg-violet-50 hover:text-violet-500',
        )}
        title="Détails du plan tarifaire"
        aria-label="Détails du plan tarifaire"
      >
        <Info size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-violet-200 uppercase tracking-widest">
                {plan.plan_code}
              </div>
              <div className="text-[13px] font-black text-white truncate">{plan.plan_name}</div>
            </div>
            <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors shrink-0 ml-2">
              <X size={12} />
            </button>
          </div>

          {/* Badges conditions */}
          <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-gray-100">
            {pensionLabel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[11px] font-bold">
                <BedDouble size={11} /> {pensionLabel}
              </span>
            )}
            {cancelCfg ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ background: cancelCfg.bg, color: cancelCfg.color }}
              >
                {plan.cancellation_type === 'FLEX' ? <ShieldCheck size={11} /> : <ShieldX size={11} />}
                {cancelCfg.label}
              </span>
            ) : null}
            {plan.channel_type && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-[11px] font-bold">
                {plan.channel_type}
              </span>
            )}
          </div>

          {/* Restrictions séjour */}
          {(plan.min_stay != null || plan.max_stay != null) && (
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 text-[11px] text-gray-600">
              <Clock size={12} className="text-gray-400 shrink-0" />
              {plan.min_stay != null && <span>Min. séjour : <strong>{plan.min_stay} nuit{plan.min_stay > 1 ? 's' : ''}</strong></span>}
              {plan.min_stay != null && plan.max_stay != null && <span className="text-gray-300">·</span>}
              {plan.max_stay != null && <span>Max. séjour : <strong>{plan.max_stay} nuit{plan.max_stay > 1 ? 's' : ''}</strong></span>}
            </div>
          )}

          {/* Tarifs nuitée */}
          <div className="px-4 py-3">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Tarifs — Calendrier Tarifaire
              {roomTypeCode && (
                <span className="ml-1 text-violet-500">{roomTypeCode}</span>
              )}
            </div>

            {!hasDates ? (
              <p className="text-[11px] text-gray-400 italic">Sélectionnez des dates d'arrivée et de départ pour afficher les tarifs.</p>
            ) : loadingPrices ? (
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <div className="w-3 h-3 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin" />
                Chargement des tarifs…
              </div>
            ) : dateRows.length === 0 ? (
              <div className="flex items-center gap-2 text-[11px] text-amber-600">
                <AlertTriangle size={12} />
                Aucun tarif configuré pour ces dates dans le calendrier.
              </div>
            ) : (
              <>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {dateRows.map(([date, { min, max }]) => (
                    <div key={date} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-[11px] text-gray-600">{fmtDate(date)}</span>
                      <span className="text-[12px] font-black text-gray-900 tabular-nums">
                        {min === max ? fmtEur(min) : <>{fmtEur(min)} – {fmtEur(max)}</>}
                      </span>
                    </div>
                  ))}
                </div>
                {dateRows.length === nights && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Total {nights} nuit{nights > 1 ? 's' : ''}</span>
                    <span className="text-[13px] font-black text-violet-700">
                      {totalMin === totalMax ? fmtEur(totalMin) : <>{fmtEur(totalMin)} – {fmtEur(totalMax)}</>}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
