/**
 * FLOWTYM — Paramètres · Types de chambres.
 *
 * Vue + CRUD complet des typologies (chambres physiques + virtuelles).
 *
 * Phase 4 : la configuration des chambres a été déplacée ici depuis
 * Revenue → Calendrier tarifaire. Le module Revenue n'exploite plus que
 * les données (lecture) ; toute mutation passe par cette page (source
 * unique de vérité).
 */
import React, { useMemo, useState } from 'react';
import { Tag, Search, ExternalLink, Bed, Users, ChevronRight, Layers, Plus } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import { RoomManagerPanel } from '@/src/components/rms/calendar/RoomManagerPanel';
import type { PageId } from '@/src/types';
import { VirtualRoomModal } from './VirtualRoomModal';

const VIRTUAL_KIND_LABELS: Record<string, string> = {
  adjacent: 'Adjacentes',
  connecting: 'Communicantes',
  suite_combo: 'Suite composée',
  family_combo: 'Combo familial',
  split_twin: 'Twin / Double',
  custom: 'Personnalisée',
};

interface RoomTypesPageProps {
  onNavigate: (page: PageId) => void;
}

export const RoomTypesPage: React.FC<RoomTypesPageProps> = ({ onNavigate }) => {
  const { roomTypes, loadData } = useRateCalendarStore();
  const [search, setSearch] = useState('');
  const [virtualOpen, setVirtualOpen] = useState(false);
  const virtualCount = roomTypes.filter((rt) => rt.isVirtual).length;

  React.useEffect(() => { if (roomTypes.length === 0) loadData(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roomTypes;
    return roomTypes.filter((rt) =>
      `${rt.roomTypeName} ${rt.roomTypeCode}`.toLowerCase().includes(q),
    );
  }, [roomTypes, search]);

  const totalCapacity = roomTypes.reduce((s, rt) => s + (rt.capacity ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Chambres & Inventaire</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Types de chambres</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Typologies de chambres, capacités et équipements de référence pour le RMS et le moteur de réservation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setVirtualOpen(true)}
              className="px-3 py-2 rounded-lg bg-white ring-1 ring-violet-200 text-violet-700 text-[13px] font-medium hover:bg-violet-50 inline-flex items-center gap-1.5"
              title="Créer une chambre virtuelle (adjacentes, communicantes, suite composée…)"
            >
              <Layers className="w-3.5 h-3.5" /> Créer une chambre virtuelle
            </button>
            {/* Phase 4 — éditeur CRUD complet (anciennement dans le calendrier).
                Source unique de vérité : useRateCalendarStore. */}
            <RoomManagerPanel />
            <button
              onClick={() => onNavigate('rev_calendar' as PageId)}
              className="px-3 py-2 rounded-lg bg-white ring-1 ring-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 inline-flex items-center gap-1.5"
              title="Visualiser l'application dans le Calendrier tarifaire"
            >
              Voir le Calendrier <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </header>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Metric label="Types configurés" value={`${roomTypes.length}`} caption={`${roomTypes.length - virtualCount} physiques · ${virtualCount} virtuelles`} />
          <Metric label="Capacité totale" value={`${totalCapacity}`} caption="Personnes max cumulées" />
          <Metric label="Référent" value={roomTypes.find((rt) => rt.isReference)?.roomTypeName ?? '—'} caption="Type de chambre référent" />
          <Metric label="Plans tarifaires" value={`${roomTypes.reduce((s, rt) => s + (rt.ratePlans?.length ?? 0), 0)}`} caption="Plans toutes chambres" />
        </div>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un type de chambre…"
                className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-[12.5px]">
              {roomTypes.length === 0 ? 'Calendrier en cours de chargement…' : 'Aucun résultat.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((rt) => {
                const componentNames = rt.virtualComposition?.componentRoomTypeIds
                  .map((id) => roomTypes.find((r) => r.roomTypeId === id)?.roomTypeName)
                  .filter(Boolean) as string[] | undefined;
                return (
                  <li key={rt.roomTypeId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60">
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center text-[12px] font-bold',
                      rt.isVirtual ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100' : 'bg-violet-50 text-violet-700',
                    )}>
                      {rt.isVirtual ? <Layers className="w-4 h-4" /> : rt.roomTypeCode}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-slate-900">{rt.roomTypeName}</span>
                        {rt.isReference && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Référent</span>
                        )}
                        {rt.isVirtual && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">
                            <Layers className="w-2.5 h-2.5" /> Virtuelle
                            {rt.virtualKind && <span className="normal-case font-medium opacity-80">· {VIRTUAL_KIND_LABELS[rt.virtualKind] ?? rt.virtualKind}</span>}
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-slate-500 mt-0.5 line-clamp-1">
                        {rt.isVirtual && componentNames && componentNames.length > 0
                          ? <>Composée de : <strong className="text-slate-700">{componentNames.join(' + ')}</strong></>
                          : (rt.description || 'Pas de description')}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {rt.capacity ?? '?'} pers.</span>
                        <span className="inline-flex items-center gap-1"><Bed className="w-3 h-3" /> {rt.bathroom ?? 'SDB std'}</span>
                        <span>{rt.ratePlans?.length ?? 0} plan(s)</span>
                        {rt.isVirtual && rt.virtualComposition && (
                          <span className="text-sky-700">
                            {rt.virtualComposition.componentsRequired === 'all' ? 'Toutes composantes requises' : 'Une composante suffit'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => onNavigate('rev_calendar' as PageId)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800">
            <strong>Édition complète :</strong> création / modification fine des typologies (équipements, capacités, photos, descriptions) dans le <strong>Calendrier tarifaire</strong> via le panneau <em>RoomManagerPanel</em>.
          </div>
          <div className="rounded-xl ring-1 ring-sky-100 bg-sky-50/40 px-4 py-3 text-[11.5px] text-sky-800 flex items-start gap-2">
            <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <strong>Chambres virtuelles :</strong> combinez plusieurs chambres physiques en une seule unité vendable (deux chambres adjacentes, suite composée, communicantes, twin/double, etc.). Cliquez sur <em>Créer une chambre virtuelle</em>.
            </div>
          </div>
        </div>
      </div>

      <VirtualRoomModal open={virtualOpen} onClose={() => setVirtualOpen(false)} />
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; caption: string }> = ({ label, value, caption }) => (
  <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
    <div className="text-[20px] font-bold tabular-nums text-violet-700 truncate">{value}</div>
    <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
    <div className="text-[11px] text-slate-500 mt-0.5 truncate">{caption}</div>
  </div>
);
