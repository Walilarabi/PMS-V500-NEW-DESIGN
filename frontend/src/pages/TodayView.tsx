import { useEffect, useState } from 'react';
import * as React from 'react';
import {
  Calendar, Users, TrendingUp, BarChart2,
  Search, RefreshCw, Zap, CheckCircle, Clock, AlertTriangle,
  BedDouble, User, CreditCard, ArrowRight, ArrowLeft, FileText,
  Plus, ChevronLeft, ChevronRight, MoreHorizontal, ArrowUpRight, ArrowDownRight,
  Sparkles, X, LogIn, LogOut, Crown, IdCard,
  Mail, Phone, Hash,
  UserRound, Moon, DoorOpen, DoorClosed, Tag, type LucideIcon,
  ArrowRightLeft, Send, Printer, MessageCircle, Layers, Maximize2, Minimize2,
  Smartphone,
} from 'lucide-react';

import { useFlowdayDataset, type FlowdayKpis, type FlowdayRoomRow } from '@/src/domains/flowday/hooks';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import { ReservationModal } from '@/src/components/today/modals/ReservationModal';
import { HousekeepingAssignmentModal } from '@/src/components/today/modals/HousekeepingAssignmentModal';
import { RoomChangeModal } from '@/src/components/today/modals/RoomChangeModal';
import { CommunicationModal } from '@/src/components/today/modals/CommunicationModal';
import { BadgesModal } from '@/src/components/today/modals/BadgesModal';
import { RightSidebar } from '@/src/components/today/RightSidebar';
import OperationsTable from '@/src/components/today/OperationsTable';
import type {
  BadgeType, CommunicationChannel, MessageTemplate, ReservationModalState,
  RoomRow, SortKey,
} from '@/src/components/today/types';
import {
  cn, formatReservationDate,
  actionOptions, fillMessageTemplate, getActionSelectValue, getFollowStyle, getSortValue,
  housekeepers, messageTemplates, currentDateLong,
} from '@/src/components/today/helpers';
// --- MOCK DATA ---

// RoomRow type is now imported from '@/src/components/today/types'


// --- COMPONENTS ---
// (Dead `Sidebar` + `Header` inline mocks removed — Real layout lives in /components/layout)

const KpiCard = ({ title, subtitle, highlight, icon: Icon, colorClass, bgColorClass, detailText }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl", bgColorClass, colorClass)}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-md cursor-pointer hover:bg-purple-100 transition-colors">
        DÉTAILS
      </span>
    </div>
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-gray-500">{subtitle}</span>
        {highlight && (
          <>
            <span className="text-gray-300">•</span>
            <span className={cn("font-medium", colorClass)}>{highlight}</span>
          </>
        )}
        {detailText && (
          <>
            <span className="text-gray-300">•</span>
            <span className="font-medium text-gray-700">{detailText}</span>
          </>
        )}
      </div>
    </div>
  </div>
);

const timelineArrivals = [
  { left: '20%', count: 2, items: ['101 - Sophie Dubois', '105 - Thomas Leroy'] },
  { left: '50%', count: 3, items: ['107 - Claire Martin', '203 - Laura Chen', '204 - Pierre Moreau'] },
  { left: '80%', count: 2, items: ['301 - Marco Rinaldi', '302 - Karim Haddad'] },
  { left: '95%', count: 1, items: ['305 - Yuki Tanaka'] },
];

const timelineDepartures = [
  { left: '15%', count: 3, items: ['102 - Arathew Smith', '202 - Nathalie B.', '208 - Emma Petit'] },
  { left: '45%', count: 2, items: ['110 - Robert King', '210 - Ines Morel'] },
  { left: '65%', count: 1, items: ['117 - Luca Rossi'] },
  { left: '80%', count: 2, items: ['401 - Amelia Green', '402 - Hugo Blanc'] },
];

const TimelineBubble: React.FC<{ event: { left: string; count: number; items: string[] }; tone: 'arrival' | 'departure' }> = ({ event, tone }) => (
  <div className="group absolute top-1/2 z-20 -translate-y-1/2" style={{ left: event.left }}>
    <div className={cn(
      'flex h-7 w-7 -translate-x-1/2 cursor-default items-center justify-center rounded-full border-2 bg-white text-xs font-bold shadow-sm transition-transform group-hover:scale-110',
      tone === 'arrival' ? 'border-green-500 text-green-600' : 'border-red-400 text-red-500'
    )}>{event.count}</div>
    <div className="pointer-events-none absolute bottom-10 left-1/2 hidden w-56 -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-2xl group-hover:block">
      <div className={cn('mb-2 text-xs font-bold uppercase tracking-wide', tone === 'arrival' ? 'text-green-600' : 'text-red-500')}>
        {tone === 'arrival' ? 'Arrivées' : 'Départs'}
      </div>
      <div className="space-y-2">
        {event.items.map((item) => {
          const [room, guest] = item.split(' - ');
          return (
            <div key={item} className="flex items-center justify-between gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">Ch. {room}</span>
              <span className="truncate font-medium text-slate-600">{guest}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const Timeline = ({ onHide }: { onHide: () => void }) => {
  const hours = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-x-auto relative">
      <div className="flex justify-between items-center mb-6 sticky left-0">
        <h3 className="text-gray-500 font-medium text-sm">Timeline du jour</h3>
        <button onClick={onHide} className="text-xs text-gray-400 hover:text-gray-600 flex items-center"><X size={14} className="mr-1"/> Masquer</button>
      </div>
      
      <div className="min-w-[800px] relative pb-4">
        {/* Header Hours */}
        <div className="flex ml-32 border-b border-gray-50 pb-2 mb-6">
          {hours.map((h, i) => (
            <div key={i} className="flex-1 text-center text-xs text-gray-400 font-medium">{h}</div>
          ))}
        </div>

        {/* Arrivées Row */}
        <div className="flex items-center mb-8 relative">
          <div className="w-32 shrink-0 flex items-center space-x-2 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
            <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600"><ArrowRight size={14} /></div>
            <span>ARRIVÉES</span>
          </div>
          <div className="flex-1 flex relative h-8">
             {timelineArrivals.map((event) => <TimelineBubble key={event.left} event={event} tone="arrival" />)}
          </div>
        </div>

        {/* Départs Row */}
        <div className="flex items-center mb-8 relative">
          <div className="w-32 shrink-0 flex items-center space-x-2 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
            <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500"><ArrowLeft size={14} /></div>
            <span>DÉPARTS</span>
          </div>
          <div className="flex-1 flex relative h-8">
             {timelineDepartures.map((event) => <TimelineBubble key={event.left} event={event} tone="departure" />)}
          </div>
        </div>

        {/* Ménage Row */}
        <div className="flex items-center relative">
          <div className="w-32 shrink-0 flex items-center space-x-2 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><Sparkles size={14} /></div>
            <span>MÉNAGE</span>
          </div>
          <div className="flex-1 flex relative h-8 items-center space-x-4">
             <div className="h-8 bg-blue-50/50 rounded-full flex-1 flex items-center justify-center text-xs text-blue-600 border border-blue-100/50">Charge modérée</div>
             <div className="h-8 bg-purple-50/50 rounded-full flex-1 flex items-center justify-center text-xs text-purple-600 border border-purple-100/50">Pic de charge</div>
             <div className="h-8 bg-blue-50/50 rounded-full flex-1 flex items-center justify-center text-xs text-blue-600 border border-blue-100/50">Charge modérée</div>
          </div>
        </div>

        {/* Current Time Indicator */}
        <div className="absolute top-0 bottom-0 left-[75%] border-l-2 border-dashed border-purple-400 z-0">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            MAINTENANT
          </div>
        </div>

        {/* Tooltip/Summary floating box - visual only for demo */}
        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 p-4 w-48 z-20">
           <h4 className="text-xs text-gray-400 font-medium mb-3">Résumé</h4>
           <div className="space-y-2 text-sm">
             <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>Arrivées</span><span className="font-semibold">8</span></div>
             <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>Départs</span><span className="font-semibold">8</span></div>
             <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></span>Ménages prévus</span><span className="font-semibold">16</span></div>
             <div className="pt-2 mt-2 border-t border-gray-50 flex justify-between items-center"><span className="text-gray-500">Chambres dispo</span><span className="font-semibold text-green-600">42</span></div>
           </div>
        </div>
      </div>
    </div>
  );
};

// ReservationModalState, ModalTab, SortKey types now imported from '@/src/components/today/types'
// avatarPalette + TableHeaderIcon + SortHeader + DateCell + OperationsTable extracted to '@/src/components/today/OperationsTable.tsx'


function TodayView() {
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showRealtimeIndicators, setShowRealtimeIndicators] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showOptimizePanel, setShowOptimizePanel] = useState(false);
  const flowday = useFlowdayDataset();
  const hotelQ = useActiveHotel();
  const kpis: FlowdayKpis = flowday.kpis;
  const liveRows = flowday.rows as unknown as RoomRow[];
  const fmtEUR0 = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight" data-testid="flowday-title">
                Flowday <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? 'Mas Provencal Aix'}</span>
              </h2>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar size={14} className="mr-2" />
                <span>{currentDateLong}</span>
                <button
                  type="button"
                  onClick={() => { /* refetch via TanStack */ }}
                  className="ml-4 flex items-center space-x-1 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md text-xs transition-colors"
                >
                  <RefreshCw size={12} className={flowday.isLoading ? 'animate-spin' : ''} />
                  <span>Actualiser</span>
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {!showRealtimeIndicators && (
                <button onClick={() => setShowRealtimeIndicators(true)} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium shadow-sm flex items-center transition-all">
                  <TrendingUp size={18} className="mr-2 text-purple-500" />
                  Afficher indicateurs
                </button>
              )}
              {!showTimeline && (
                <button onClick={() => setShowTimeline(true)} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium shadow-sm flex items-center transition-all">
                  <Clock size={18} className="mr-2 text-purple-500" />
                  Afficher timeline
                </button>
              )}
              <button onClick={() => setShowRightPanel((current) => !current)} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-xl font-medium shadow-sm flex items-center transition-all">
                <BarChart2 size={18} className="mr-2 text-purple-500" />
                {showRightPanel ? 'Masquer le volet' : 'Afficher KPIs'}
              </button>
              <button
                onClick={() => setShowOptimizePanel(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm shadow-purple-600/20 flex items-center transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Zap size={18} className="mr-2" />
                Optimiser la journée
              </button>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-8">
            
            {/* Main Content Area (Left/Center) */}
            <div className="flex-1 space-y-8 min-w-0">
              
              {/* KPIs */}
              {showRealtimeIndicators && <div>
                <div className="mb-4 ml-1 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Indicateurs Temps Réel</h3>
                  <button onClick={() => setShowRealtimeIndicators(false)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center"><X size={14} className="mr-1"/> Masquer</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard 
                    title={`Occupation: ${kpis.occupancy}%`}
                    subtitle={`CAPACITÉ TOTALE: ${kpis.totalRooms}`}
                    detailText="Live · Supabase"
                    icon={TrendingUp} 
                    colorClass="text-purple-600" 
                    bgColorClass="bg-purple-50" 
                  />
                  <KpiCard 
                    title={`${kpis.dirtyRooms} chambres sales`}
                    subtitle="MÉNAGE À FAIRE" 
                    highlight={`${kpis.cleanPct}% clean`}
                    icon={Sparkles} 
                    colorClass="text-orange-500" 
                    bgColorClass="bg-orange-50" 
                  />
                  <KpiCard 
                    title={`${kpis.arrivalsToday} arrivée${kpis.arrivalsToday > 1 ? 's' : ''} prévue${kpis.arrivalsToday > 1 ? 's' : ''}`}
                    subtitle="AUJOURD'HUI" 
                    highlight={`${kpis.vipCount} VIP`}
                    icon={Users} 
                    colorClass="text-green-600" 
                    bgColorClass="bg-green-50" 
                  />
                  <KpiCard 
                    title={`${fmtEUR0(kpis.unpaidAmount)} à encaisser`}
                    subtitle="PAIEMENTS ATTENTE" 
                    highlight={`${kpis.unpaidCount} dossier${kpis.unpaidCount > 1 ? 's' : ''}`}
                    icon={CreditCard} 
                    colorClass="text-blue-500" 
                    bgColorClass="bg-blue-50" 
                  />
                </div>
              </div>}

              {/* Timeline */}
              {showTimeline && <Timeline onHide={() => setShowTimeline(false)} />}

              {/* Operations Table */}
              <OperationsTable initialRooms={liveRows} />

            </div>

            {/* Right Sidebar */}
            {showRightPanel && <RightSidebar onHide={() => setShowRightPanel(false)} />}

          </div>
        </main>

        {/* ── Optimiser la journée — panel ──────────────────────────── */}
        {showOptimizePanel && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Zap size={16} className="text-purple-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-[15px]">Priorités du jour</h3>
                </div>
                <button onClick={() => setShowOptimizePanel(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { icon: LogIn,       color: 'text-emerald-600 bg-emerald-50', label: 'Arrivées aujourd\'hui',   value: kpis.arrivalsToday, unit: 'check-in(s) à traiter' },
                  { icon: LogOut,      color: 'text-blue-600 bg-blue-50',       label: 'Départs aujourd\'hui',    value: liveRows.filter(r => (r as any).movement === 'departure').length, unit: 'check-out(s) à finaliser' },
                  { icon: Moon,        color: 'text-violet-600 bg-violet-50',   label: 'Chambres en séjour',      value: kpis.occupancy,   unit: `sur ${kpis.totalRooms} chambres` },
                  { icon: CreditCard,  color: 'text-red-600 bg-red-50',         label: 'Soldes débiteurs',        value: kpis.unpaidCount, unit: 'paiements à régulariser' },
                ].map(({ icon: Icon, color, label, value, unit }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-500">{label}</p>
                      <p className="text-[13px] font-bold text-gray-900">
                        {flowday.isLoading ? '…' : <><span className="text-[18px]">{value ?? 0}</span> <span className="text-[12px] text-gray-400 font-medium">{unit}</span></>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4 flex gap-2">
                <button
                  onClick={() => { setShowOptimizePanel(false); setShowRightPanel(true); }}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  Voir le tableau de bord
                </button>
                <button onClick={() => setShowOptimizePanel(false)} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export { TodayView };
export default TodayView;
