/**
 * FLOWTYM RMS — Compression Heatmap (premium, dense, exploite l'espace)
 *
 * Visualise jour par jour le score de compression marché sur la fenêtre.
 * Cellules carrées extensibles (flex-1) qui occupent tout l'espace
 * disponible. Score visible directement dans la cellule pour les jours
 * à pression ≥ 40. Badge événement visible (nombre d'événements).
 *
 * Layout :
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Header : libellés mois alignés avec le début de semaine │
 *   ├──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬─┤
 *   │L │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │■ │…│
 *   │M │■ │■ │■ │■ │…                                         │
 *   │M │…                                                       │
 *   │J │                                                         │
 *   │V │                                                         │
 *   │S │                                                         │
 *   │D │                                                         │
 *   └──┴─────────────────────────────────────────────────────┘
 *
 * Tooltip natif (title) — UI sobre et performante. Pas de lib chart.
 */

import React, { useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import {
  COMPRESSION_CLASSIFICATION_LABELS,
  type MarketHeatmapCell,
} from '@/src/types/marketIntelligence';

interface CompressionHeatmapProps {
  cells: MarketHeatmapCell[];
}

/**
 * Toning sémantique : on garde une palette "froid → chaud" pour signifier
 * la montée en pression. Le texte (foreground) doit rester lisible sur
 * chaque tone — d'où les seuils de contraste.
 */
const TONE_BY_CLASS = {
  no_compression: {
    bg: 'bg-slate-100', ring: 'ring-slate-200',
    text: 'text-slate-400', label: 'Calme', dot: 'bg-slate-400',
  },
  soft: {
    bg: 'bg-emerald-100', ring: 'ring-emerald-200',
    text: 'text-emerald-700', label: 'Léger', dot: 'bg-emerald-500',
  },
  building: {
    bg: 'bg-amber-200', ring: 'ring-amber-300',
    text: 'text-amber-800', label: 'Formation', dot: 'bg-amber-600',
  },
  strong: {
    bg: 'bg-rose-300', ring: 'ring-rose-400',
    text: 'text-rose-900', label: 'Forte', dot: 'bg-rose-700',
  },
  extreme: {
    bg: 'bg-rose-600', ring: 'ring-rose-700',
    text: 'text-white', label: 'Extrême', dot: 'bg-rose-100',
  },
} as const;

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const CompressionHeatmap: React.FC<CompressionHeatmapProps> = ({ cells }) => {
  // Découpe en semaines (colonnes), alignée sur le lundi.
  const weeks = useMemo(() => {
    if (cells.length === 0) return [];
    const out: MarketHeatmapCell[][] = [];

    // Trouve le lundi <= 1ʳᵉ date (DOW lundi = 0)
    const first = new Date(`${cells[0].date}T00:00:00Z`);
    const dow = (first.getUTCDay() + 6) % 7;
    const start = new Date(first);
    start.setUTCDate(first.getUTCDate() - dow);

    const byDate = new Map<string, MarketHeatmapCell>(cells.map((c) => [c.date, c]));
    const last = new Date(`${cells[cells.length - 1].date}T00:00:00Z`);
    const cur = new Date(start);
    let week: MarketHeatmapCell[] = [];
    while (cur <= last) {
      const iso = cur.toISOString().slice(0, 10);
      const c = byDate.get(iso) ?? {
        date: iso,
        compression: 0,
        velocity: 0,
        eventCount: 0,
        topEventId: null,
        classification: 'no_compression' as const,
      };
      week.push(c);
      if (week.length === 7) {
        out.push(week);
        week = [];
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (week.length) {
      while (week.length < 7) {
        week.push({
          date: '',
          compression: 0,
          velocity: 0,
          eventCount: 0,
          topEventId: null,
          classification: 'no_compression' as const,
        });
      }
      out.push(week);
    }
    return out;
  }, [cells]);

  // KPIs heatmap (résumé en bas)
  const summary = useMemo(() => {
    const real = cells.filter((c) => c.date);
    if (real.length === 0) return null;
    const avg = Math.round(real.reduce((s, c) => s + c.compression, 0) / real.length);
    const peak = real.reduce((p, c) => (c.compression > p.compression ? c : p), real[0]);
    const eventDays = real.filter((c) => c.eventCount > 0).length;
    const extremeDays = real.filter((c) => c.classification === 'extreme' || c.classification === 'strong').length;
    return { avg, peak, eventDays, extremeDays, total: real.length };
  }, [cells]);

  // Header mois : on regroupe les semaines par mois pour afficher le libellé
  // une seule fois par mois, étendu sur le bon nombre de colonnes.
  const monthSpans = useMemo(() => {
    if (weeks.length === 0) return [];
    const spans: { label: string; span: number }[] = [];
    let cur = '';
    let curSpan = 0;
    for (const w of weeks) {
      // Représentant : la date au milieu de la semaine (jeudi) — évite
      // les bordures de mois fluctuantes selon le décalage.
      const repr = w[3]?.date ?? w[0].date;
      if (!repr) {
        // semaine vide ou padding
        if (curSpan > 0) {
          spans.push({ label: cur, span: curSpan });
          curSpan = 0;
          cur = '';
        }
        continue;
      }
      const monthKey = new Date(`${repr}T00:00:00Z`).toLocaleDateString('fr-FR', {
        month: 'short', year: 'numeric',
      });
      if (monthKey !== cur) {
        if (curSpan > 0) spans.push({ label: cur, span: curSpan });
        cur = monthKey;
        curSpan = 1;
      } else {
        curSpan++;
      }
    }
    if (curSpan > 0) spans.push({ label: cur, span: curSpan });
    return spans;
  }, [weeks]);

  if (cells.length === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl p-8 text-center text-[13px] text-slate-400 ring-1 ring-slate-100">
        Pas encore de données marché dans la fenêtre sélectionnée.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 p-4 shadow-sm">
      {/* ─── Header : libellés mois (sticky-friendly) ─────────────────────── */}
      <div className="flex items-end gap-1.5 mb-2">
        {/* Spacer aligné avec colonne jours */}
        <div className="w-9 shrink-0" />
        <div className="flex-1 flex gap-1">
          {monthSpans.map((m, i) => (
            <div
              key={`${m.label}-${i}`}
              className="text-[11px] font-semibold text-slate-700 capitalize tabular-nums"
              style={{ flex: m.span }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Grille principale : 7 lignes (jours) × N colonnes (semaines) ── */}
      <div className="flex items-stretch gap-1.5">
        {/* Colonne libellés jours */}
        <div className="w-9 shrink-0 flex flex-col gap-1 justify-around py-0.5">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-[11px] font-medium text-slate-500 leading-none text-right pr-0.5"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grille colonnes-semaines, flex-1 pour étirer */}
        <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((cell, di) => (
                <HeatCell key={`${wi}-${di}`} cell={cell} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Footer : légende + résumé ────────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="font-medium text-slate-600">Pression :</span>
          {(['no_compression', 'soft', 'building', 'strong', 'extreme'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={cn('w-3.5 h-3.5 rounded ring-1', TONE_BY_CLASS[k].bg, TONE_BY_CLASS[k].ring)} />
              <span>{TONE_BY_CLASS[k].label}</span>
            </span>
          ))}
        </div>
        {summary && (
          <div className="flex items-center gap-4 text-[11px] tabular-nums">
            <SummaryStat label="Compression moy." value={`${summary.avg}/100`} />
            <SummaryStat label="Pic" value={`${summary.peak.compression}`} />
            <SummaryStat label="Jours tendus" value={`${summary.extremeDays}/${summary.total}`} />
            <SummaryStat label="Jours avec événement" value={`${summary.eventDays}`} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* CELLULE                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const HeatCell: React.FC<{ cell: MarketHeatmapCell }> = ({ cell }) => {
  if (!cell.date) {
    // Cellule de padding (avant 1er jour ou après dernier jour)
    return <div className="aspect-square rounded-md bg-slate-50/50" />;
  }
  const tone = TONE_BY_CLASS[cell.classification];
  const hasEvent = cell.eventCount > 0;
  const dayNum = new Date(`${cell.date}T00:00:00Z`).getUTCDate();
  const showScore = cell.compression >= 40;

  return (
    <div
      className={cn(
        'aspect-square rounded-md ring-1 relative flex flex-col items-center justify-center transition-all',
        'hover:ring-2 hover:ring-violet-400 hover:z-10 hover:scale-[1.06] cursor-default',
        tone.bg, tone.ring,
      )}
      title={`${formatDateFr(cell.date)}
Compression ${cell.compression}/100 (${COMPRESSION_CLASSIFICATION_LABELS[cell.classification]})
Velocity ${cell.velocity}/100
${cell.eventCount} événement(s) actif(s)`}
    >
      {/* Numéro de jour, petit, en haut à gauche */}
      <span className={cn('absolute top-0.5 left-1 text-[8.5px] font-medium leading-none opacity-70', tone.text)}>
        {dayNum}
      </span>

      {/* Score central — uniquement quand pertinent (≥ 40) */}
      {showScore && (
        <span className={cn('text-[11px] font-bold tabular-nums leading-none', tone.text)}>
          {cell.compression}
        </span>
      )}

      {/* Badge événement(s) : pastille en haut à droite */}
      {hasEvent && (
        <span
          className={cn(
            'absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[12px] h-[12px] px-[3px] rounded-full text-[8.5px] font-bold leading-none ring-1 ring-white',
            'bg-violet-600 text-white shadow-sm',
          )}
          title={`${cell.eventCount} événement(s)`}
        >
          {cell.eventCount}
        </span>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* SUB-COMPONENTS                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const SummaryStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col leading-tight">
    <span className="text-[9.5px] uppercase tracking-wide text-slate-400 font-medium">{label}</span>
    <span className="text-[12px] font-semibold text-slate-900">{value}</span>
  </div>
);

function formatDateFr(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}
