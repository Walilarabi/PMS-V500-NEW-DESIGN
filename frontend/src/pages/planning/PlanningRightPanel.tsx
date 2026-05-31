/**
 * FLOWTYM — Volet latéral droit du planning.
 *
 * Trois sections (maquette) :
 *   1. VUE RAPIDE OPÉRATIONNELLE — compteurs du jour (arrivées, départs, séjours,
 *      chambres libres, TO, ménage, check-in en ligne).
 *   2. INTELLIGENCE DU JOUR — TO/Forecast/ADR/RevPAR/Pickup/Compression/Événement
 *      pour le jour de référence (premier jour visible).
 *   3. RECOMMANDATION RMS — panneau actionnable existant.
 *
 * Données 100% réelles. « — » si une donnée n'existe pas (jamais inventé).
 */
import React from 'react';
import {
  LogIn, LogOut, BedDouble, DoorOpen, TrendingUp, Sparkles, Smartphone,
  LineChart, CreditCard, Activity, ArrowUpRight, Gauge, Zap,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { DayKpi } from '@/src/services/planning/planning-kpi.service';
import { compressionLevel, getCompressionTone } from '@/src/services/planning/market-compression.service';
import { RmsRecommendationPanel } from './RmsRecommendationPanel';

export interface RightPanelIntel {
  dateLabel: string;
  toRate: number;
  forecast: number | null;
  adr: number;
  revpar: number;
  pickupRooms: number | null;
  pickupRevenue: number | null;
  compressionPercent: number | null;
  eventName: string | null;
  eventImpact: string | null;
}

export interface PlanningRightPanelProps {
  startDate: Date | string;
  rangeDays: number;
  today: DayKpi;
  /** Ratio de chambres propres 0-100. */
  hkCleanRatio: number;
  /** Check-in en ligne effectués aujourd'hui. */
  onlineCheckins: number;
  intel: RightPanelIntel;
}

function fmtEuro(n: number | null): string {
  return n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`;
}

function OpsRow({
  icon: Icon, label, value, tone,
}: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon size={14} className={cn('shrink-0', tone ?? 'text-gray-400')} />
      <span className="text-[11px] font-semibold text-gray-500 flex-1">{label}</span>
      <span className="text-[13px] font-black text-gray-900">{value}</span>
    </div>
  );
}

function IntelRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-right">
        <span className="text-[13px] font-black text-gray-900">{value}</span>
        {sub && <span className="block text-[9px] font-bold text-gray-400">{sub}</span>}
      </span>
    </div>
  );
}

export function PlanningRightPanel({
  startDate,
  rangeDays,
  today,
  hkCleanRatio,
  onlineCheckins,
  intel,
}: PlanningRightPanelProps) {
  const pickupTone = intel.pickupRooms == null ? '' : intel.pickupRooms > 0 ? 'text-emerald-600' : intel.pickupRooms < 0 ? 'text-rose-600' : 'text-gray-400';
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* 1. Vue rapide opérationnelle */}
      <section className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Vue rapide opérationnelle</h3>
        <OpsRow icon={LogIn} label="Arrivées" value={today.arrivals} tone="text-emerald-500" />
        <OpsRow icon={LogOut} label="Départs" value={today.departures} tone="text-orange-500" />
        <OpsRow icon={BedDouble} label="Séjours" value={today.occupied} tone="text-indigo-500" />
        <OpsRow icon={DoorOpen} label="Chambres libres" value={today.free} tone="text-sky-500" />
        <OpsRow icon={TrendingUp} label="Taux d'occupation" value={`${today.toRate.toFixed(0)} %`} tone="text-emerald-500" />
        <OpsRow icon={Sparkles} label="Ménage (propres)" value={`${Math.round(hkCleanRatio)} %`} tone="text-violet-500" />
        <OpsRow icon={Smartphone} label="Check-in en ligne" value={onlineCheckins} tone="text-blue-500" />
      </section>

      {/* 2. Intelligence du jour */}
      <section className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
          Intelligence — {intel.dateLabel}
        </h3>
        <IntelRow label="TO" value={`${intel.toRate.toFixed(0)} %`} sub={intel.forecast == null ? undefined : `Forecast ${intel.forecast.toFixed(0)}%`} />
        <IntelRow label="ADR" value={fmtEuro(intel.adr)} />
        <IntelRow label="RevPAR" value={fmtEuro(intel.revpar)} />
        <IntelRow
          label="Pickup"
          value={<span className={pickupTone}>{intel.pickupRooms == null ? '—' : `${intel.pickupRooms > 0 ? '+' : ''}${intel.pickupRooms} ch.`}</span>}
          sub={intel.pickupRevenue == null ? undefined : `${intel.pickupRevenue > 0 ? '+' : ''}${Math.round(intel.pickupRevenue).toLocaleString('fr-FR')} €`}
        />
        <IntelRow
          label="Compression marché"
          value={
            intel.compressionPercent == null
              ? '—'
              : (
                <span className={getCompressionTone(compressionLevel(intel.compressionPercent)).text}>
                  {intel.compressionPercent} %
                </span>
              )
          }
        />
        {intel.eventName && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg bg-orange-50">
            <Zap size={12} className="text-orange-500 shrink-0" />
            <span className="text-[10px] font-bold text-orange-700 flex-1 truncate">{intel.eventName}</span>
            {intel.eventImpact && <span className="text-[9px] font-black text-orange-500 uppercase">{intel.eventImpact}</span>}
          </div>
        )}
      </section>

      {/* 3. Recommandations RMS */}
      <div className="flex-1 min-h-[200px]">
        <RmsRecommendationPanel startDate={startDate} rangeDays={rangeDays} />
      </div>
    </div>
  );
}
