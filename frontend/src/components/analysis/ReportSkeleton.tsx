/**
 * FLOWTYM — Skeleton loaders premium pour rapports analytiques
 *
 * Affichés par ReportViewer pendant le premier chargement, à la place
 * du composant Construction "non implémenté". Améliore le perçu de perf.
 */

import React from 'react';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export const ReportSkeleton: React.FC<{ variant?: 'full' | 'compact' }> = ({ variant = 'full' }) => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Insights skeleton */}
      <div className="bg-gradient-to-r from-violet-50/50 to-blue-50/30 rounded-lg border border-violet-200 p-4">
        <div className="h-3 w-48 bg-violet-200 rounded mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/60 border border-violet-200 rounded p-3">
              <div className="h-3 w-32 bg-violet-200 rounded mb-2" />
              <div className="h-2 w-full bg-gray-100 rounded" />
              <div className="h-2 w-4/5 bg-gray-100 rounded mt-1" />
            </div>
          ))}
        </div>
      </div>

      {/* KPIs skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="w-7 h-7 bg-gray-200 rounded-md" />
            </div>
            <div className="h-7 w-16 bg-gray-200 rounded" />
            <div className="h-2 w-24 bg-gray-100 rounded mt-2" />
          </div>
        ))}
      </div>

      {variant === 'full' && (
        <>
          {/* Chart skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="h-3 w-48 bg-gray-200 rounded mb-3" />
            <div className="h-64 bg-gradient-to-b from-gray-50 to-gray-100 rounded relative overflow-hidden">
              <div className="absolute inset-0 bg-shimmer" />
              {/* Simulation de courbe */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 50">
                <path d="M0 30 Q 20 20 40 25 T 80 15 T 100 10" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          </div>

          {/* Table skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2.5 flex gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: `${40 + (i % 3) * 25}px` }} />
              ))}
            </div>
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-3 py-2 flex gap-3">
                  {[1, 2, 3, 4, 5, 6].map(j => (
                    <div key={j} className="h-3 bg-gray-100 rounded" style={{ width: `${50 + ((i + j) % 4) * 20}px` }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
