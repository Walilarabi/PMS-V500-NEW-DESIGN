/**
 * FLOWTYM — En-tête de colonne triable
 */
import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { SortDir } from './useDataTable';

export interface SortableHeaderProps {
  label: string;
  active?: boolean;
  dir?: SortDir;
  onClick: () => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  label, active, dir, onClick, align = 'left', className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 font-semibold text-[11px] uppercase tracking-wider transition-colors',
        active ? 'text-[#8B5CF6]' : 'text-gray-500 hover:text-gray-700',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
        className,
      )}
    >
      {label}
      {!active && <ArrowUpDown size={11} className="opacity-50" />}
      {active && dir === 'asc' && <ArrowUp size={11} />}
      {active && dir === 'desc' && <ArrowDown size={11} />}
    </button>
  );
};
