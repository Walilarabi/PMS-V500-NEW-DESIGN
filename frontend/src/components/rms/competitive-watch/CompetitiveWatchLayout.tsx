/**
 * FLOWTYM RMS — Layout Veille Concurrentielle.
 *
 * Coquille de page : fond, défilement, largeur maximale, rythme vertical.
 */

import React from 'react';

export interface CompetitiveWatchLayoutProps {
  children: React.ReactNode;
}

export const CompetitiveWatchLayout: React.FC<CompetitiveWatchLayoutProps> = ({
  children,
}) => (
  <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#F6F7F9] dark:bg-slate-950">
    <div className="max-w-[1640px] mx-auto px-5 py-5 flex flex-col gap-4">
      {children}
    </div>
  </div>
);
