/**
 * FLOWTYM Revenue — EmptyState (Coming Soon)
 *
 * Placeholder for Revenue pages not yet implemented. Replaces ad-hoc
 * "Module en cours de modernisation" divs. Communicates the vision
 * clearly so the user understands what's coming.
 *
 * Usage:
 *   <RevenueEmptyState
 *     icon={Tag}
 *     title="Promotions"
 *     description="Créez des codes promo, offres flash, et campagnes saisonnières."
 *     features={[
 *       "Codes promo multi-canaux",
 *       "Offres flash dynamiques",
 *       "Campagnes Booking / Expedia",
 *     ]}
 *   />
 */
import React from 'react';
import { Sparkles, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface RevenueEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features?: string[];
  eta?: string;
  className?: string;
}

export const RevenueEmptyState: React.FC<RevenueEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  features,
  eta,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-8',
        'bg-white rounded-3xl border border-gray-100',
        className,
      )}
    >
      {/* Badge ETA */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#8B5CF6]/8 rounded-full mb-6">
        <Sparkles size={12} className="text-[#8B5CF6]" />
        <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">
          En cours de développement
        </span>
      </div>

      {/* Icon */}
      <div className="p-4 bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 rounded-3xl mb-5">
        <Icon size={32} className="text-[#8B5CF6]" strokeWidth={1.5} />
      </div>

      {/* Title + description */}
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 max-w-md leading-relaxed mb-6">
        {description}
      </p>

      {/* Features list */}
      {features && features.length > 0 && (
        <div className="w-full max-w-md">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-3">
            Ce qui arrive
          </p>
          <ul className="space-y-2 text-left">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13px] text-gray-700">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-[#8B5CF6] shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ETA */}
      {eta && (
        <div className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-gray-400">
          <Clock size={11} />
          <span className="font-medium">{eta}</span>
        </div>
      )}
    </div>
  );
};
