/**
 * FLOWTYM — Fusion / Dédoublonnage clients.
 * Détection client-side des doublons par similarité de nom, email, téléphone.
 * Présente des paires à fusionner manuellement.
 */
import React, { useMemo, useState } from 'react';
import {
  GitMerge, RefreshCw, Search, Users, CheckCircle2, AlertCircle, ChevronDown,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useGuests } from '@/src/domains/guests/hooks';
import type { GuestRowDto } from '@/src/domains/guests/schemas';

// ─── Similarity helpers ───────────────────────────────────────────────────────

function normName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
}

function normEmail(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function normPhone(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

function levenshtein(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]++;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}

function nameSimilarity(a: GuestRowDto, b: GuestRowDto): number {
  const fullA = normName(`${a.first_name ?? ''} ${a.last_name}`);
  const fullB = normName(`${b.first_name ?? ''} ${b.last_name}`);
  if (fullA === fullB && fullA.length > 2) return 1;
  const maxLen = Math.max(fullA.length, fullB.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(fullA, fullB);
  return Math.max(0, 1 - dist / maxLen);
}

interface DuplicatePair {
  a: GuestRowDto;
  b: GuestRowDto;
  score: number;
  reasons: string[];
}

function findDuplicates(guests: GuestRowDto[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  const dismissed = new Set<string>(); // "id1-id2" pairs already dismissed

  for (let i = 0; i < guests.length; i++) {
    for (let j = i + 1; j < guests.length; j++) {
      const a = guests[i];
      const b = guests[j];
      const reasons: string[] = [];
      let score = 0;

      // Exact email match
      const eA = normEmail(a.email);
      const eB = normEmail(b.email);
      if (eA && eB && eA === eB) { score += 0.6; reasons.push('Email identique'); }

      // Exact phone match (≥6 digits)
      const pA = normPhone(a.phone);
      const pB = normPhone(b.phone);
      if (pA.length >= 6 && pB.length >= 6 && pA === pB) { score += 0.4; reasons.push('Téléphone identique'); }

      // Name similarity
      const ns = nameSimilarity(a, b);
      if (ns >= 0.85) { score += 0.3 * ns; reasons.push(`Nom similaire (${Math.round(ns * 100)}%)`); }

      if (score >= 0.5 && reasons.length > 0) {
        pairs.push({ a, b, score: Math.min(1, score), reasons });
      }
    }
  }

  return pairs.sort((a, b) => b.score - a.score);
}

// ─── Guest Card ───────────────────────────────────────────────────────────────

function GuestCard({ guest }: { guest: GuestRowDto }) {
  const fullName = [guest.first_name, guest.last_name].filter(Boolean).join(' ');
  return (
    <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl px-4 py-3 space-y-1.5">
      <p className="text-sm font-bold text-slate-800">{fullName || '—'}</p>
      <p className="text-[13px] text-slate-500">{guest.email ?? '—'}</p>
      {guest.phone && <p className="text-[13px] text-slate-500">{guest.phone}</p>}
      <div className="flex gap-2 flex-wrap mt-1">
        {guest.nationality && <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded font-medium text-slate-600">{guest.nationality}</span>}
        {(guest as any).loyalty_level && <span className="text-xs bg-violet-100 px-1.5 py-0.5 rounded font-medium text-violet-700">{(guest as any).loyalty_level}</span>}
        {(guest as any).segment && <span className="text-xs bg-blue-100 px-1.5 py-0.5 rounded font-medium text-blue-700">{(guest as any).segment}</span>}
      </div>
      <p className="text-xs text-slate-400">ID: {guest.id.slice(0, 8).toUpperCase()}</p>
    </div>
  );
}

// ─── Pair Card ────────────────────────────────────────────────────────────────

function PairCard({ pair, onDismiss }: { pair: DuplicatePair; onDismiss: () => void }) {
  const pct = Math.round(pair.score * 100);
  const color = pct >= 90 ? 'text-red-600 bg-red-50 ring-red-200' : pct >= 70 ? 'text-amber-600 bg-amber-50 ring-amber-200' : 'text-blue-600 bg-blue-50 ring-blue-200';

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ring-1', color)}>
            {pct}% similaire
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {pair.reasons.map(r => (
              <span key={r} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{r}</span>
            ))}
          </div>
        </div>
        <button onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100">
          Ignorer
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <GuestCard guest={pair.a} />
        <GuestCard guest={pair.b} />
      </div>
      <div className="flex gap-2 mt-3">
        <button className="flex-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
          Fusionner →
        </button>
        <button className="px-4 py-2 rounded-xl ring-1 ring-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
          Voir les fiches
        </button>
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export const ClientsMergeView: React.FC = () => {
  const [search, setSearch]     = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useGuests({ limit: 200 });
  const guests = data?.rows ?? [];

  const allPairs = useMemo<DuplicatePair[]>(() => findDuplicates(guests), [guests]);

  const filtered = useMemo<DuplicatePair[]>(() => {
    const active = allPairs.filter(p => !dismissed.has(`${p.a.id}-${p.b.id}`));
    if (!search) return active;
    const q = search.toLowerCase();
    return active.filter(p =>
      (p.a.email ?? '').toLowerCase().includes(q) ||
      (p.b.email ?? '').toLowerCase().includes(q) ||
      (p.a.last_name ?? '').toLowerCase().includes(q) ||
      (p.b.last_name ?? '').toLowerCase().includes(q)
    );
  }, [allPairs, dismissed, search]);

  function dismiss(pair: DuplicatePair) {
    setDismissed(prev => new Set([...prev, `${pair.a.id}-${pair.b.id}`]));
  }

  const highRisk = allPairs.filter(p => p.score >= 0.9 && !dismissed.has(`${p.a.id}-${p.b.id}`)).length;
  const medium   = allPairs.filter(p => p.score >= 0.7 && p.score < 0.9 && !dismissed.has(`${p.a.id}-${p.b.id}`)).length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 flex items-center gap-2">
            <GitMerge size={18} className="text-violet-600" /> Fusion / Dédoublonnage
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Détection automatique par similarité de nom, email et téléphone</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Clients analysés', value: guests.length,       color: 'text-slate-700'   },
          { label: 'Paires détectées', value: allPairs.length,     color: 'text-violet-600', alert: allPairs.length > 0 },
          { label: 'Risque élevé',     value: highRisk,            color: 'text-red-600',    alert: highRisk > 0        },
          { label: 'Risque modéré',    value: medium,              color: 'text-amber-600',  alert: false               },
        ].map(k => (
          <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
            <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Nom, email…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-sm outline-none focus:ring-violet-400" />
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-3 bg-blue-50 ring-1 ring-blue-200 rounded-xl px-4 py-3">
        <AlertCircle size={14} className="text-blue-600 shrink-0" />
        <p className="text-sm text-blue-700">
          La fusion n'est pas irréversible — elle crée un enregistrement maître et archive les doublons.
          Toutes les réservations et transactions sont redirigées vers le profil maître.
        </p>
      </div>

      {/* Pairs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw size={16} className="animate-spin mr-2" /> Analyse en cours…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
          <CheckCircle2 size={32} className="mb-3 text-emerald-400 opacity-70" />
          <p className="text-sm font-medium">Aucun doublon détecté</p>
          <p className="text-[13px] text-slate-400 mt-1">{guests.length} clients analysés</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(filtered as DuplicatePair[]).map((pair: DuplicatePair) => (
            <PairCard key={`${pair.a.id}-${pair.b.id}`} pair={pair} onDismiss={() => dismiss(pair)} />
          ))}
        </div>
      )}
    </div>
  );
};
