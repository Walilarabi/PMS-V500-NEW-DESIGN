/**
 * FLOWTYM — Segments & Loyalty View (Wave C4)
 *
 * Deux modes :
 *  • Programme de fidélité — paramétrage des niveaux + recalcul.
 *  • Segments dynamiques    — répartition comportementale de la base clients.
 */

import React, { useState } from 'react';
import {
  Award, Target, RefreshCw, Pencil, Loader2, CheckCircle2,
  Crown, Gem, Star, Medal, Sparkles, Heart, Repeat, UserCheck,
  UserPlus, Ban, Users, Zap,
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import {
  useLoyaltyTiers,
  useSegmentOverview,
  useRecomputeLoyalty,
} from '@/src/services/crm/hooks';
import { LoyaltyTierModal } from './LoyaltyTierModal';
import type { LoyaltyTier } from '@/src/services/crm/loyalty.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const TIER_ICONS: Record<string, React.ElementType> = {
  Standard: Medal,
  Silver:   Star,
  Gold:     Crown,
  Platinum: Gem,
};

type SegMeta = {
  label: string;
  description: string;
  color: string;
  icon: React.ElementType;
};

const SEGMENT_META: Record<string, SegMeta> = {
  vip:         { label: 'VIP',         description: 'Clients marqués VIP',            color: '#3B82F6', icon: Sparkles },
  loyal:       { label: 'Fidèles',     description: '5 séjours ou plus',              color: '#8B5CF6', icon: Heart },
  big_spender: { label: 'Gros budget', description: 'CA cumulé ≥ 1 500 €',            color: '#F59E0B', icon: Gem },
  recurring:   { label: 'Récurrents',  description: 'De 2 à 4 séjours',               color: '#10B981', icon: Repeat },
  active:      { label: 'Actifs',      description: '1 séjour effectué',              color: '#06B6D4', icon: UserCheck },
  new:         { label: 'Nouveaux',    description: 'Inscrits il y a moins de 90 j',  color: '#EC4899', icon: UserPlus },
  prospect:    { label: 'Prospects',   description: 'Aucun séjour enregistré',        color: '#9CA3AF', icon: Users },
  blacklist:   { label: 'Blacklist',   description: 'Clients signalés',               color: '#EF4444', icon: Ban },
};

const SEGMENT_ORDER = [
  'vip', 'loyal', 'big_spender', 'recurring', 'active', 'new', 'prospect', 'blacklist',
];

type Mode = 'loyalty' | 'segments';

// ─── Component ───────────────────────────────────────────────────────────────

export const SegmentsView = () => {
  const [mode, setMode]         = useState<Mode>('loyalty');
  const [editTier, setEditTier] = useState<LoyaltyTier | null>(null);

  const tiersQ    = useLoyaltyTiers();
  const overviewQ = useSegmentOverview();
  const recompute = useRecomputeLoyalty();

  const tiers    = tiersQ.data ?? [];
  const overview = overviewQ.data;
  const loyaltyCounts = overview?.loyalty ?? {};

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Mode toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {([
              ['loyalty',  'Programme de fidélité', Award],
              ['segments', 'Segments dynamiques',   Target],
            ] as [Mode, string, React.ElementType][]).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-colors',
                  mode === m
                    ? 'bg-white text-[#8B5CF6] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {mode === 'loyalty' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
            >
              {recompute.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <RefreshCw size={13} />}
              Recalculer les niveaux
            </Button>
          )}
        </div>

        {/* Recompute feedback */}
        {mode === 'loyalty' && recompute.isSuccess && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span className="text-[12px] font-medium text-emerald-700">
              {recompute.data.updated === 0
                ? 'Tous les clients sont déjà au bon niveau.'
                : `${recompute.data.updated} client${recompute.data.updated > 1 ? 's' : ''} reclassé${recompute.data.updated > 1 ? 's' : ''}.`}
            </span>
          </div>
        )}
        {mode === 'loyalty' && recompute.isError && (
          <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[12px] font-medium text-red-600">
            Échec du recalcul. Veuillez réessayer.
          </div>
        )}

        {mode === 'loyalty'
          ? <LoyaltyPanel
              tiers={tiers}
              counts={loyaltyCounts}
              loading={tiersQ.isLoading}
              onEdit={setEditTier}
            />
          : <SegmentsPanel overview={overview} loading={overviewQ.isLoading} />}
      </div>

      {editTier && (
        <LoyaltyTierModal tier={editTier} onClose={() => setEditTier(null)} />
      )}
    </div>
  );
};

// ─── Loyalty panel ───────────────────────────────────────────────────────────

const LoyaltyPanel = ({
  tiers,
  counts,
  loading,
  onEdit,
}: {
  tiers: LoyaltyTier[];
  counts: Record<string, number>;
  loading: boolean;
  onEdit: (t: LoyaltyTier) => void;
}) => {
  if (loading) {
    return <div className="text-center text-sm text-gray-400 py-12">Chargement…</div>;
  }
  if (tiers.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Award size={32} className="mx-auto text-gray-200 mb-3" />
        <p className="text-sm text-gray-400 font-medium">
          Aucun niveau de fidélité configuré.
        </p>
      </Card>
    );
  }

  const totalMembers = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-gray-500">
        <strong className="text-gray-700">{totalMembers.toLocaleString('fr-FR')}</strong>{' '}
        clients répartis sur {tiers.length} niveaux. Ajustez les seuils puis lancez un
        recalcul pour reclasser la base.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiers.map((t) => {
          const Icon    = TIER_ICONS[t.name] ?? Award;
          const members = counts[t.name] ?? 0;
          const pct     = totalMembers ? Math.round((members / totalMembers) * 100) : 0;

          return (
            <Card key={t.id} className="flex flex-col overflow-hidden">
              {/* Accent bar */}
              <div className="h-1.5" style={{ background: t.color }} />

              <div className="p-4 flex flex-col flex-1">
                {/* Head */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${t.color}22` }}
                    >
                      <Icon size={16} style={{ color: t.color }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">{t.name}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Niveau {t.sort_order + 1}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#8B5CF6] transition-colors"
                    aria-label="Modifier"
                  >
                    <Pencil size={13} />
                  </button>
                </div>

                {/* Members */}
                <div className="mt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-gray-900 leading-none">
                      {members.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-[11px] font-bold text-gray-400">
                      client{members !== 1 ? 's' : ''} · {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: t.color }}
                    />
                  </div>
                </div>

                {/* Thresholds */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-bold text-gray-900">{t.min_stays}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                      Séjours min.
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-bold text-gray-900">
                      {Number(t.min_spent).toLocaleString('fr-FR')} €
                    </div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                      CA min.
                    </div>
                  </div>
                </div>

                {/* Multiplier */}
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#8B5CF6]">
                  <Zap size={11} />
                  ×{Number(t.points_multiplier)} points / €
                </div>

                {/* Benefits */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Avantages
                  </div>
                  {t.benefits.length === 0 ? (
                    <p className="text-[11px] text-gray-300">Aucun avantage défini.</p>
                  ) : (
                    <ul className="space-y-1">
                      {t.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                          <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ─── Segments panel ──────────────────────────────────────────────────────────

const SegmentsPanel = ({
  overview,
  loading,
}: {
  overview: { total: number; segments: { key: string; count: number; revenue: number; avg_stays: number }[] } | undefined;
  loading: boolean;
}) => {
  if (loading) {
    return <div className="text-center text-sm text-gray-400 py-12">Chargement…</div>;
  }
  if (!overview || overview.total === 0) {
    return (
      <Card className="p-12 text-center">
        <Target size={32} className="mx-auto text-gray-200 mb-3" />
        <p className="text-sm text-gray-400 font-medium">Aucune donnée client à segmenter.</p>
      </Card>
    );
  }

  const byKey = new Map(overview.segments.map((s) => [s.key, s]));
  const rows  = SEGMENT_ORDER
    .map((key) => ({ key, meta: SEGMENT_META[key], data: byKey.get(key) }))
    .filter((r) => r.data && r.data.count > 0);

  const total = overview.total;

  return (
    <div className="space-y-4">
      {/* Distribution bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <Target size={13} className="text-[#8B5CF6]" /> Répartition de la base
          </h3>
          <span className="text-[12px] font-bold text-gray-900">
            {total.toLocaleString('fr-FR')} clients
          </span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
          {rows.map((r) => (
            <div
              key={r.key}
              style={{
                width: `${(r.data!.count / total) * 100}%`,
                background: r.meta.color,
              }}
              title={`${r.meta.label} — ${r.data!.count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {rows.map((r) => (
            <span key={r.key} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: r.meta.color }}
              />
              {r.meta.label}
              <span className="font-bold text-gray-900">{r.data!.count}</span>
            </span>
          ))}
        </div>
      </Card>

      {/* Segment cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((r) => {
          const { meta, data } = r;
          const pct = Math.round((data!.count / total) * 100);
          return (
            <Card key={r.key} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${meta.color}1A` }}
                  >
                    <meta.icon size={18} style={{ color: meta.color }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-gray-900">{meta.label}</div>
                    <div className="text-[10px] text-gray-400">{meta.description}</div>
                  </div>
                </div>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${meta.color}1A`, color: meta.color }}
                >
                  {pct}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-[15px] font-bold text-gray-900 leading-none">
                    {data!.count.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                    Clients
                  </div>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-gray-900 leading-none">
                    {Math.round(data!.revenue).toLocaleString('fr-FR')} €
                  </div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                    CA cumulé
                  </div>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-gray-900 leading-none">
                    {data!.avg_stays}
                  </div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                    Séjours moy.
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SegmentsView;
