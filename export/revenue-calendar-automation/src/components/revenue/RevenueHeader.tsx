/**
 * FLOWTYM Revenue — Page header
 *
 * Header standard for every Revenue page : icon, title, subtitle, optional
 * trailing actions zone. Replaces the ad-hoc headers scattered across the
 * old RevenueView.
 *
 * Usage:
 *   <RevenueHeader
 *     icon={TrendingUp}
 *     title="Yield management"
 *     subtitle="Règles dynamiques pour optimiser le RevPAR"
 *     actions={<Button>Nouvelle règle</Button>}
 *   />
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface RevenueHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const RevenueHeader: React.FC<RevenueHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
}) => {
  return (
    <header className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2.5 bg-[#8B5CF6] rounded-2xl text-white shadow-lg shadow-[#8B5CF6]/20 shrink-0">
          <Icon size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-gray-500 text-[13px] font-medium mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
};
