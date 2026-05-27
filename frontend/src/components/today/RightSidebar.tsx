/**
 * FLOWTYM — RightSidebar (Flowday KPIs).
 * Les actions rapides ont été retirées : seul le bouton "+" principal de la page
 * permet d'ajouter une réservation (évite les doublons d'action).
 */
import {
  ArrowDownRight, ArrowUpRight, BedDouble, FileText, X, Zap,
} from 'lucide-react';

// Simple target icon helper since Lucide's target might differ slightly
const TargetIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);

export const RightSidebar = ({ onHide }: { onHide: () => void }) => {
  return (
    <div className="w-80 shrink-0 space-y-6 hidden xl:block">
      {/* KPI Stats Section - Flow Score */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">KPIs & Stats</h3>
          <button onClick={onHide} className="text-xs text-gray-400 hover:text-gray-600 flex items-center"><X size={14} className="mr-1"/> Masquer</button>
        </div>

        <div className="flex justify-between items-start mb-6">
          <span className="text-sm font-medium text-gray-600">Flow Score</span>
          <button className="w-6 h-6 rounded bg-gray-50 flex items-center justify-center text-gray-400"><Zap size={12} /></button>
        </div>

        <div className="flex items-center space-x-4 mb-8">
          {/* Simple SVG Gauge approximation */}
          <div className="relative w-24 h-24">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-green-500"
                strokeWidth="3"
                strokeDasharray="78, 100"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 leading-none">78</span>
              <span className="text-[10px] text-gray-400">/100</span>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-gray-900">Journée fluide</h4>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Continuez comme ça !</p>
          </div>
        </div>

        {/* Decorative wave line */}
        <div className="h-10 w-full overflow-hidden opacity-20 text-purple-600 flex items-end">
           <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-full stroke-current fill-none stroke-2">
             <path d="M0,10 Q10,0 20,10 T40,10 T60,10 T80,10 T100,10" />
           </svg>
        </div>
      </div>

      {/* Performance du jour */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-gray-500 font-medium text-sm mb-6">Performance du jour</h3>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><BedDouble size={14} className="mr-2"/> Taux d'occupation</span>
              <span className="text-green-500 text-xs font-semibold flex items-center"><ArrowUpRight size={12} className="mr-0.5"/> 8.3%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">75.4%</div>
          </div>

          <div className="h-px bg-gray-100"></div>

          <div>
            <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><TargetIcon className="w-3.5 h-3.5 mr-2"/> ADR</span>
              <span className="text-green-500 text-xs font-semibold flex items-center"><ArrowUpRight size={12} className="mr-0.5"/> 2.1%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">189.00 €</div>
          </div>

          <div className="h-px bg-gray-100"></div>

          <div>
            <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><Zap size={14} className="mr-2"/> REVPAR</span>
              <span className="text-green-500 text-xs font-semibold flex items-center"><ArrowUpRight size={12} className="mr-0.5"/> 5.1%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">142.50 €</div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
               <div className="bg-blue-500 h-full w-1/3"></div>
               <div className="bg-purple-500 h-full w-1/3"></div>
               <div className="bg-green-500 h-full w-1/4"></div>
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          <div>
             <div className="flex justify-between items-center mb-1 text-sm">
              <span className="flex items-center text-gray-500 uppercase text-xs tracking-wider"><FileText size={14} className="mr-2"/> Revenue total</span>
              <span className="text-red-500 text-xs font-semibold flex items-center"><ArrowDownRight size={12} className="mr-0.5"/> 1.2%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">28 450 €</div>
            <div className="text-[10px] text-gray-400 mt-1 uppercase">VS même jour semaine dernière</div>
          </div>
        </div>

        <button className="w-full mt-6 py-2.5 rounded-xl border border-gray-200 text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors">
          VOIR LE RAPPORT COMPLET
        </button>
      </div>

    </div>
  );
};
