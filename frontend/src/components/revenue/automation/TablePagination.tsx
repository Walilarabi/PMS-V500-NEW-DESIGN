/**
 * FLOWTYM — Barre de pagination
 */
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}) => {
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-4 py-3 border-t border-[#F3F4F6] bg-[#FAFAFB] text-[12px]',
      className,
    )}>
      <div className="text-gray-500">
        {totalRows === 0 ? (
          <span>Aucun résultat</span>
        ) : (
          <span>
            <b className="text-gray-700">{startRow}</b>–<b className="text-gray-700">{endRow}</b>{' '}
            sur <b className="text-gray-700">{totalRows}</b>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-gray-500">
            <span>Par page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 text-[12px] border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <PaginationButton
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            aria-label="Première page"
          >
            <ChevronsLeft size={14} />
          </PaginationButton>
          <PaginationButton
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Page précédente"
          >
            <ChevronLeft size={14} />
          </PaginationButton>
          <span className="px-2 text-gray-700 font-semibold tabular-nums">
            {page} / {totalPages}
          </span>
          <PaginationButton
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label="Page suivante"
          >
            <ChevronRight size={14} />
          </PaginationButton>
          <PaginationButton
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            aria-label="Dernière page"
          >
            <ChevronsRight size={14} />
          </PaginationButton>
        </div>
      </div>
    </div>
  );
};

const PaginationButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  'aria-label': string;
}> = ({ onClick, disabled, children, 'aria-label': ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={cn(
      'p-1.5 rounded-lg border border-[#E5E7EB] bg-white transition-colors',
      disabled
        ? 'text-gray-300 cursor-not-allowed'
        : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300',
    )}
  >
    {children}
  </button>
);
