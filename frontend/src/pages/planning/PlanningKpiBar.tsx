/**
 * FLOWTYM — Barre KPI compacte du planning (maquette #1).
 *
 * Composant 100% présentationnel : reçoit des données déjà calculées par le
 * parent (usePlanningKpis + usePickup + useMarketCompression). Aucune donnée
 * fictive — chaque chip rend « — » quand la donnée réelle est absente plutôt
 * qu'un faux 0.
 *
 * Chips : TO, ADR, RevPAR, Pickup chambres, Pickup revenu, Compression marché,
 * Chambres libres (cliquable → FreeRoomsModal), Événements, + mini-heatmap.
 */
import React from 'react';
import {
  TrendingUp,
  CreditCard,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Gauge,
  DoorOpen,
  Zap,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { getOccThreshold } from './revenueThresholds';
import type { CompressionLevel } from '@/src/hooks/planning/useMarketCompression';

export interface PlanningKpiBarProps {
  /** Taux d'occupation moyen de la plage (0-100). */
  toRate: number;
  /** ADR moyen (€). */
  adr: number;
  /** RevPAR moyen (€). */
  revpar: number;
  /** Forecast d'occupation moyen calculé (0-100). null = indéterminé. */
  forecast: number | null;
  /** Chambres occupées aujourd'hui / total exploitable (sous-titre TO). */
  occupied: number;
  totalRooms: number;
  /** Chambres libres aujourd'hui (chip cliquable). */
  free: number;
  /** Pickup chambres sur la plage (delta J vs J-1). null = pas de baseline. */
  pickupRooms: number | null;
  /** Pickup revenu sur la plage. null = pas de baseline. */
  pickupRevenue: number | null;
  /** Compression marché moyenne (0-100). null = pas de donnée Lighthouse. */
  compressionPercent: number | null;
  compressionLevel: CompressionLevel | null;
  /** Nombre d'événements actifs sur la plage. */
  eventsCount: number;
  /** Occupation par jour pour la mini-heatmap (toRate 0-100). */
  heatmap: { date: string; toRate: number }[];
  /** Click sur le chip « chambres libres » → ouvre la modale. */
  onFreeRoomsClick?: () => void;
  /** Click sur le chip « événements ». */
  onEventsClick?: () => void;
  /** États de chargement (affiche un skeleton discret sur les chips concernés). */
  pickupLoading?: boolean;
  compressionLoading?: boolean;
}

const COMPRESSION_TONE: Record<CompressionLevel, { text: string; dot: string; label: string }> = {
  low: { text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Faible' },
  medium: { text: 'text-amber-600', dot: 'bg-amber-500', label: 'Modérée' },
  high: { text: 'text-orange-600', dot: 'bg-orange-500', label: 'Forte' },
  critical: { text: 'text-rose-600', dot: 'bg-rose-500', label: 'Critique' },
};

/** Formate un nombre en euros compact (1 250 €). */
function fmtEuro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

/** Chip KPI générique. */
function Chip({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
  onClick,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  valueClass?: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-gray-100 bg-white text-left transition-all',
        interactive
          ? 'cursor-pointer hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-100'
          : 'cursor-default',
      )}
      aria-label={typeof value === 'string' ? `${label}: ${value}` : label}
    >
      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-indigo-500" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
          {label}
        </div>
        {loading ? (
          <div className="h-3.5 w-12 bg-gray-100 rounded animate-pulse" />
        ) : (
          <div className={cn('text-sm font-black leading-none', valueClass ?? 'text-gray-900')}>
            {value}
          </div>
        )}
        {sub && <div className="text-[9px] font-bold text-gray-400 mt-0.5 truncate">{sub}</div>}
      </div>
    </button>
  );
}

/** Rendu d'un delta pickup avec flèche + couleur. */
function PickupValue({ value, euro }: { value: number | null; euro?: boolean }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const positive = value > 0;
  const negative = value < 0;
  const Arrow = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const tone = positive ? 'text-emerald-600' : negative ? 'text-rose-600' : 'text-gray-400';
  const display = euro ? fmtEuro(Math.abs(value)) : Math.abs(value);
  return (
    <span className={cn('inline-flex items-center gap-0.5', tone)}>
      <Arrow size={13} />
      {display}
    </span>
  );
}

export function PlanningKpiBar({
  toRate,
  adr,
  revpar,
  forecast,
  occupied,
  totalRooms,
  free,
  pickupRooms,
  pickupRevenue,
  compressionPercent,
  compressionLevel,
  eventsCount,
  heatmap,
  onFreeRoomsClick,
  onEventsClick,
  pickupLoading,
  compressionLoading,
}: PlanningKpiBarProps) {
  const comp = compressionLevel ? COMPRESSION_TONE[compressionLevel] : null;

  return (
    <div className="shrink-0 border-b border-gray-100 bg-white/90 backdrop-blur-md px-6 py-3 flex items-center gap-4 w-full">
      {/* Chips distribués sur toute la largeur */}
      <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
        <Chip
          label="Taux occ."
          value={`${toRate.toFixed(1)} %`}
          sub={forecast == null ? `${occupied}/${totalRooms} ch.` : `Forecast ${forecast.toFixed(0)}%`}
          icon={TrendingUp}
          valueClass="text-emerald-600"
        />
        <Chip label="ADR" value={fmtEuro(adr)} sub={`${occupied}/${totalRooms} ch.`} icon={CreditCard} valueClass="text-amber-600" />
        <Chip label="RevPAR" value={fmtEuro(revpar)} sub="par chambre" icon={Activity} valueClass="text-violet-600" />
        <Chip
          label="Libres"
          value={free}
          sub="aujourd'hui"
          icon={DoorOpen}
          valueClass="text-indigo-600"
          onClick={onFreeRoomsClick}
        />
        <Chip
          label="Pickup"
          value={<PickupValue value={pickupRooms} />}
          sub={pickupRevenue == null ? 'vs hier' : `${pickupRevenue > 0 ? '+' : ''}${Math.round(pickupRevenue).toLocaleString('fr-FR')} €`}
          icon={ArrowUpRight}
          loading={pickupLoading}
        />
        <Chip
          label="Événements"
          value={eventsCount}
          sub="sur la plage"
          icon={Zap}
          valueClass={eventsCount > 0 ? 'text-orange-600' : 'text-gray-400'}
          onClick={onEventsClick}
        />
        <Chip
          label="Comp. marché"
          value={
            compressionPercent == null ? (
              <span className="text-gray-300">—</span>
            ) : (
              <span className={cn('inline-flex items-center gap-1.5', comp?.text)}>
                {comp && <span className={cn('w-1.5 h-1.5 rounded-full', comp.dot)} />}
                {compressionPercent} %
              </span>
            )
          }
          sub={comp?.label ?? 'Lighthouse'}
          icon={Gauge}
          loading={compressionLoading}
        />
      </div>

      {/* Heatmap d'occupation (maquette #13) — barres + légende dégradé */}
      {heatmap.length > 0 && (
        <div className="shrink-0 flex flex-col gap-1 pl-4 border-l border-gray-100">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Heatmap occupation</span>
          <div className="flex items-end gap-0.5 h-7" aria-hidden="true">
            {heatmap.map((d) => {
              const th = getOccThreshold(d.toRate);
              return (
                <div
                  key={d.date}
                  className={cn('w-1.5 rounded-sm', th.bg)}
                  style={{ height: `${Math.max(4, (d.toRate / 100) * 28)}px` }}
                  title={`${d.date} — ${d.toRate.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold text-gray-300">0%</span>
            <div className="h-1.5 w-24 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500" />
            <span className="text-[8px] font-bold text-gray-300">100%</span>
          </div>
        </div>
      )}
    </div>
  );
}
