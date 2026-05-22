/**
 * FLOWTYM Revenue — Pricing Calendar
 *
 * Calendrier tarifaire : grille de prix par chambre × plan × date.
 * Le cœur quotidien du yield manager — ajustements de prix, restrictions
 * de séjour, vue cascade automatique.
 *
 * Statut : fonctionnel — branché sur supabaseAdapter (8740 prix Folkestone
 * en prod via migration 0164 + import Planning).
 */
import React, { useState } from 'react';
import { CalendarDays, Radio } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { CalendarGrid } from '@/src/components/rms/calendar/CalendarGrid';
import { ToastProvider } from '@/src/components/rms/calendar/Toast';
import { ChannelManagerPanel } from '@/src/components/revenue/ChannelManagerPanel';

export const PricingCalendar: React.FC = () => {
  const [cmPanelOpen, setCmPanelOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={CalendarDays}
          title="Calendrier tarifaire"
          subtitle="Pilotez prix, restrictions et inventaire chambre par chambre, jour par jour"
          actions={
            <button
              onClick={() => setCmPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 shadow-sm"
              title="Statut & historique des push vers les Channel Managers"
            >
              <Radio className="w-4 h-4 text-emerald-600" />
              Channel Manager
            </button>
          }
        />
      </div>
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <ToastProvider>
          <CalendarGrid />
        </ToastProvider>
      </div>
      <ChannelManagerPanel open={cmPanelOpen} onClose={() => setCmPanelOpen(false)} />
    </div>
  );
};
