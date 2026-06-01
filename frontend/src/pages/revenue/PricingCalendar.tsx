/**
 * FLOWTYM Revenue — Pricing Calendar
 *
 * Calendrier tarifaire : grille de prix par chambre × plan × date.
 * Le cœur quotidien du yield manager — ajustements de prix, restrictions
 * de séjour, vue cascade automatique.
 *
 * [V1 PILOTE] Channel Manager masqué — intégration OTA non activée.
 * Pour réactiver : décommenter les lignes [CM] ci-dessous.
 */
import React from 'react';
import { CalendarDays } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { CalendarGrid } from '@/src/components/rms/calendar/CalendarGrid';
import { ToastProvider } from '@/src/components/rms/calendar/Toast';

// [CM] import { useState } from 'react';
// [CM] import { Radio } from 'lucide-react';
// [CM] import { ChannelManagerPanel } from '@/src/components/revenue/ChannelManagerPanel';

export const PricingCalendar: React.FC = () => {
  // [CM] const [cmPanelOpen, setCmPanelOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={CalendarDays}
          title="Calendrier tarifaire"
          subtitle="Pilotez prix, restrictions et inventaire chambre par chambre, jour par jour"
        />
      </div>
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <ToastProvider>
          <CalendarGrid />
        </ToastProvider>
      </div>
      {/* [CM] <ChannelManagerPanel open={cmPanelOpen} onClose={() => setCmPanelOpen(false)} /> */}
    </div>
  );
};
