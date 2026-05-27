/**
 * FLOWTYM — Blacklist / Watchlist / Satisfaction View (Wave C5)
 *
 * Trois onglets :
 *  • Blacklist     — clients signalés + action de retrait
 *  • Watchlist     — clients à risque (medium / high / critical)
 *  • Satisfaction  — NPS overview + distribution des scores
 */

import React, { useState } from 'react';
import {
  Ban, ShieldAlert, Star, Users, Sparkles, TrendingUp,
  Smile, Meh, Frown, AlertCircle, Pencil,
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import {
  useBlacklistedGuests,
  useRiskyGuests,
  useSatisfactionOverview,
} from '@/src/services/crm/hooks';
import { RISK_LEVELS } from '@/src/services/crm/risk.service';
import { GuestFlagModal } from './GuestFlagModal';
import type { GuestRowDto } from '@/src/domains/guests/schemas';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

type Tab = 'blacklist' | 'watchlist' | 'satisfaction';

// ─── Shared guest row ─────────────────────────────────────────────────────────

const GuestRow: React.FC<{
  g: GuestRowDto;
  rightSlot: React.ReactNode;
  onEdit: () => void;
}> = ({ g, rightSlot, onEdit }) => {
  const name = [g.first_name, g.last_name].filter(Boolean).join(' ') || g.last_name;
  const init = [g.first_name, g.last_name]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join('');

  return (
    <tr className="hover:bg-gray-50/60 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center text-[11px] font-bold text-[#8B5CF6] shrink-0">
            {init}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{name}</div>
            <div className="text-xs text-gray-400">{g.email ?? g.phone ?? '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-[13px] text-gray-500">
          {g.loyalty_level ?? 'Standard'}
        </div>
      </td>
      <td className="px-4 py-3">{rightSlot}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-[#8B5CF6]/10 text-gray-400 hover:text-[#8B5CF6] transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Modifier"
        >
          <Pencil size={13} />
        </button>
      </td>
    </tr>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

export const BlacklistView = () => {
  const [tab, setTab]               = useState<Tab>('blacklist');
  const [modalGuest, setModalGuest] = useState<GuestRowDto | null>(null);

  const blacklistQ = useBlacklistedGuests();
  const watchlistQ = useRiskyGuests();
  const satisfQ    = useSatisfactionOverview();

  const blacklisted = blacklistQ.data?.rows ?? [];
  const risky       = watchlistQ.data?.rows ?? [];
  const satov       = satisfQ.data;

  const TABS: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'blacklist',    label: 'Blacklist',    icon: Ban,       count: blacklisted.length },
    { key: 'watchlist',   label: 'Watchlist',    icon: ShieldAlert, count: risky.length },
    { key: 'satisfaction', label: 'Satisfaction', icon: Star },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <div className="space-y-5">

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors',
                tab === key
                  ? 'bg-white text-[#8B5CF6] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <Icon size={13} /> {label}
              {count !== undefined && (
                <span className={cn(
                  'ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                  tab === key ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]' : 'bg-gray-200 text-gray-500',
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Blacklist tab ───────────────────────────────────────────────── */}
        {tab === 'blacklist' && (
          <BlacklistTab
            guests={blacklisted}
            loading={blacklistQ.isLoading}
            onEdit={setModalGuest}
          />
        )}

        {/* ── Watchlist tab ───────────────────────────────────────────────── */}
        {tab === 'watchlist' && (
          <WatchlistTab
            guests={risky}
            loading={watchlistQ.isLoading}
            onEdit={setModalGuest}
          />
        )}

        {/* ── Satisfaction tab ────────────────────────────────────────────── */}
        {tab === 'satisfaction' && (
          <SatisfactionTab overview={satov} loading={satisfQ.isLoading} />
        )}
      </div>

      {modalGuest && (
        <GuestFlagModal guest={modalGuest} onClose={() => setModalGuest(null)} />
      )}
    </div>
  );
};

// ─── Blacklist tab ────────────────────────────────────────────────────────────

const BlacklistTab = ({
  guests,
  loading,
  onEdit,
}: {
  guests: GuestRowDto[];
  loading: boolean;
  onEdit: (g: GuestRowDto) => void;
}) => {
  if (loading) return <Loading />;
  if (guests.length === 0) {
    return (
      <EmptyState
        icon={Ban}
        title="Aucun client blacklisté"
        subtitle="Les clients signalés apparaissent ici. Ouvrez une fiche client pour ajouter un signalement."
      />
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <Ban size={14} className="text-red-500" />
        <span className="text-sm font-bold text-gray-700">
          {guests.length} client{guests.length > 1 ? 's' : ''} blacklisté{guests.length > 1 ? 's' : ''}
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {['Client', 'Fidélité', 'Statut', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {guests.map((g) => (
            <GuestRow
              key={g.id}
              g={g}
              onEdit={() => onEdit(g)}
              rightSlot={
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-600 px-2 py-1 rounded-full">
                  <Ban size={11} /> Blacklisté
                </span>
              }
            />
          ))}
        </tbody>
      </table>
    </Card>
  );
};

// ─── Watchlist tab ────────────────────────────────────────────────────────────

const WatchlistTab = ({
  guests,
  loading,
  onEdit,
}: {
  guests: GuestRowDto[];
  loading: boolean;
  onEdit: (g: GuestRowDto) => void;
}) => {
  if (loading) return <Loading />;
  if (guests.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Aucun client à risque"
        subtitle="Les clients avec un niveau de risque moyen, élevé ou critique apparaissent ici."
      />
    );
  }

  // Sort by risk level (critical first)
  const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
  const sorted = [...guests].sort(
    (a, b) => (riskOrder[a.risk_level] ?? 9) - (riskOrder[b.risk_level] ?? 9),
  );

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <ShieldAlert size={14} className="text-amber-500" />
        <span className="text-sm font-bold text-gray-700">
          {guests.length} client{guests.length > 1 ? 's' : ''} sur la watchlist
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {['Client', 'Fidélité', 'Risque', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((g) => {
            const meta = RISK_LEVELS.find((r) => r.key === g.risk_level);
            return (
              <GuestRow
                key={g.id}
                g={g}
                onEdit={() => onEdit(g)}
                rightSlot={
                  meta ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <AlertCircle size={11} /> {meta.label}
                    </span>
                  ) : null
                }
              />
            );
          })}
        </tbody>
      </table>
    </Card>
  );
};

// ─── Satisfaction tab ─────────────────────────────────────────────────────────

const SatisfactionTab = ({
  overview,
  loading,
}: {
  overview: ReturnType<typeof useSatisfactionOverview>['data'];
  loading: boolean;
}) => {
  if (loading) return <Loading />;

  if (!overview || overview.total_scored === 0) {
    return (
      <EmptyState
        icon={Star}
        title="Aucun score de satisfaction enregistré"
        subtitle="Ouvrez une fiche client (Blacklist ou Watchlist) pour renseigner un score de satisfaction de 0 à 10. Le NPS se calcule automatiquement."
      />
    );
  }

  const { total_scored, avg_score, nps, promoters, passives, detractors, distribution } = overview;

  const npsColor =
    nps === null ? '#9CA3AF' : nps >= 50 ? '#10B981' : nps >= 0 ? '#F59E0B' : '#EF4444';

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clients notés',  value: total_scored,          icon: Users,      color: '#8B5CF6' },
          { label: 'Score moyen',    value: avg_score ?? '—',      icon: Star,       color: '#F59E0B' },
          { label: 'NPS',            value: nps ?? '—',            icon: TrendingUp, color: npsColor },
          { label: 'Promoteurs',     value: promoters,             icon: Smile,      color: '#10B981' },
        ].map((k) => (
          <Card key={k.label} className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${k.color}18` }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 leading-none">{k.value}</div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
                {k.label}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* NPS breakdown */}
      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          Répartition NPS
        </h3>
        <div className="flex h-4 rounded-full overflow-hidden mb-3">
          {[
            { n: detractors, color: '#EF4444' },
            { n: passives,   color: '#F59E0B' },
            { n: promoters,  color: '#10B981' },
          ].map(({ n, color }, i) => (
            <div
              key={i}
              style={{ width: `${(n / total_scored) * 100}%`, background: color }}
              className="transition-all"
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Détracteurs', n: detractors, subtitle: 'Score 0–6', icon: Frown,  color: '#EF4444' },
            { label: 'Passifs',     n: passives,   subtitle: 'Score 7–8', icon: Meh,    color: '#F59E0B' },
            { label: 'Promoteurs',  n: promoters,  subtitle: 'Score 9–10',icon: Smile,  color: '#10B981' },
          ].map((g) => (
            <div key={g.label}>
              <g.icon size={20} className="mx-auto mb-1" style={{ color: g.color }} />
              <div className="text-xl font-bold text-gray-900">{g.n}</div>
              <div className="text-xs font-bold text-gray-600">{g.label}</div>
              <div className="text-xs text-gray-400">{g.subtitle}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Score distribution */}
      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          Distribution des scores
        </h3>
        <div className="space-y-2.5">
          {(distribution ?? []).map((d) => {
            const pct = total_scored ? Math.round((d.count / total_scored) * 100) : 0;
            return (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-600 w-10">{d.label}</span>
                <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-900 w-6 text-right">{d.count}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const Loading = () => (
  <div className="text-center text-sm text-gray-400 py-12">Chargement…</div>
);

const EmptyState = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) => (
  <Card className="p-12 text-center">
    <Icon size={32} className="mx-auto text-gray-200 mb-3" />
    <p className="text-sm font-bold text-gray-500">{title}</p>
    <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">{subtitle}</p>
  </Card>
);

export default BlacklistView;
