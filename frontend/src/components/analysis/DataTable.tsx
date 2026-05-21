/**
 * FLOWTYM — DataTable premium
 *
 * Wrapper TanStack Table avec tri, multi-tri, sticky header, hover,
 * pagination, et hooks pour drill-down.
 */

import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  emptyMessage?: string;
  pageSize?: number;
  enablePagination?: boolean;
  enableMultiSort?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string;
  onRowClick?: (row: TData) => void;
  highlightRow?: (row: TData) => boolean;
}

export function DataTable<TData>({
  data, columns, emptyMessage = 'Aucune donnée',
  pageSize = 25, enablePagination = true, enableMultiSort = true,
  stickyHeader = true, maxHeight,
  onRowClick, highlightRow,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    enableMultiSort,
    initialState: enablePagination ? { pagination: { pageSize } } : undefined,
  });

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-sm text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full text-sm">
          <thead className={cn('bg-gray-50 border-b border-gray-200', stickyHeader && 'sticky top-0 z-10')}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const sort = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        'px-3 py-2.5 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap',
                        canSort && 'cursor-pointer hover:bg-gray-100 select-none'
                      )}
                      style={{ width: header.getSize() }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="opacity-60">
                            {sort === 'asc' ? <ChevronUp className="w-3 h-3" /> :
                              sort === 'desc' ? <ChevronDown className="w-3 h-3" /> :
                              <ChevronsUpDown className="w-3 h-3" />}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  'hover:bg-gray-50',
                  onRowClick && 'cursor-pointer',
                  highlightRow?.(row.original) && 'bg-violet-50/40'
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2 text-gray-800">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enablePagination && data.length > pageSize && (
        <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            <span className="mx-2 text-gray-300">·</span>
            {data.length} lignes
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
