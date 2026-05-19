/**
 * FLOWTYM — EventTooltip
 *
 * Composant de tooltip riche pour afficher les détails d'un salon/événement
 * au survol d'une cellule (RMS, Planning, etc.).
 *
 * Version simplifiée Palier A : pas de section lien (à ajouter Palier C
 * quand le parser Excel extraira le `link` du fichier).
 */

import { useState, useRef, useEffect } from 'react';
import { Calendar, MapPin, Zap, Tag } from 'lucide-react';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Types ────────────────────────────────────────────────────────────────

export interface EventTooltipData {
  event_name: string;
  start_date: string;
  end_date: string;
  location?: string | null;
  impact?: string | null;
  link?: string | null;
  source?: string | null;
}

interface EventTooltipProps {
  event: EventTooltipData;
  children: React.ReactNode;
  label?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDateFR(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function impactColor(impact: string | null | undefined): { bg: string; text: string; label: string } {
  const v = (impact ?? '').toLowerCase().trim();
  if (/(très fort|tres fort|critique|critical|extreme|extrême)/.test(v)) {
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Très fort' };
  }
  if (/(fort|high|élevé|eleve)/.test(v)) {
    return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Fort' };
  }
  if (/(moyen|medium|modere|modéré)/.test(v)) {
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Moyen' };
  }
  if (/(faible|low|leger|léger)/.test(v)) {
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Faible' };
  }
  if (v) {
    return { bg: 'bg-gray-100', text: 'text-gray-700', label: impact ?? 'Non défini' };
  }
  return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Non défini' };
}

// ─── Composant principal ──────────────────────────────────────────────────

export function EventTooltip(props: EventTooltipProps) {
  const event = props.event;
  const children = props.children;
  const label = props.label ?? 'Événement';

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = 240;
    setPosition(rect.top < tooltipHeight + 20 ? 'bottom' : 'top');
  }, [visible]);

  const impact = impactColor(event.impact);
  const isMultiDay = event.start_date !== event.end_date;

  const datesText = isMultiDay
    ? `Du ${formatDateFR(event.start_date)} au ${formatDateFR(event.end_date)}`
    : formatDateFR(event.start_date);

  return (
    <span
      ref={triggerRef}
      className="relative inline-block cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      {children}

      {visible ? (
        <div
          role="tooltip"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-50 w-80 pointer-events-auto',
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-2.5 border-b border-gray-100">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
                <Tag className="w-3 h-3" />
                {label}
              </div>
              <div className="text-sm font-bold text-gray-900 leading-snug">
                {event.event_name}
              </div>
            </div>

            <div className="px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="text-gray-500">Période</div>
                  <div className="font-medium text-gray-900">{datesText}</div>
                </div>
              </div>

              {event.location ? (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="text-gray-500">Lieu</div>
                    <div className="font-medium text-gray-900">{event.location}</div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="text-gray-500">Impact estimé</div>
                  <div className="mt-0.5">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
                      impact.bg,
                      impact.text
                    )}>
                      {impact.label}
                    </span>
                  </div>
                </div>
              </div>

              {event.source ? (
                <div className="text-[10px] text-gray-400 italic pt-1">
                  Source : {event.source}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-gray-200 rotate-45',
              position === 'top'
                ? 'bottom-0 translate-y-1/2 border-r-0 border-t-0'
                : 'top-0 -translate-y-1/2 border-l-0 border-b-0'
            )}
          />
        </div>
      ) : null}
    </span>
  );
}
