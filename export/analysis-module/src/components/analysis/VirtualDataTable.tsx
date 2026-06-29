/**
 * FLOWTYM — VirtualDataTable
 *
 * Wrapper sur DataTable qui active la virtualisation manuelle
 * (window slicing basé sur scroll position) si > seuil de lignes.
 * Performant sans dépendance externe.
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { DataTable } from './DataTable';
import type { ColumnDef } from '@tanstack/react-table';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export interface VirtualDataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  rowHeightPx?: number;
  virtualThreshold?: number;
  maxHeight?: string;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  highlightRow?: (row: TData) => boolean;
}

const DEFAULT_THRESHOLD = 200;
const DEFAULT_ROW_HEIGHT = 36;
const OVERSCAN_ROWS = 10;

export function VirtualDataTable<TData>({
  data, columns, rowHeightPx = DEFAULT_ROW_HEIGHT, virtualThreshold = DEFAULT_THRESHOLD,
  maxHeight = '600px', emptyMessage, onRowClick, highlightRow,
}: VirtualDataTableProps<TData>) {
  // Si dataset petit, on utilise DataTable normal avec pagination
  if (data.length <= virtualThreshold) {
    return (
      <DataTable
        data={data}
        columns={columns}
        stickyHeader
        maxHeight={maxHeight}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        highlightRow={highlightRow}
        pageSize={Math.min(virtualThreshold, 50)}
      />
    );
  }

  // Sinon, virtualisation : on slice 50 lignes visibles autour du viewport
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight);
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const { visibleRows, startIdx, totalHeight, paddingTop } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeightPx) - OVERSCAN_ROWS);
    const visibleCount = Math.ceil(viewportHeight / rowHeightPx) + OVERSCAN_ROWS * 2;
    const end = Math.min(data.length, start + visibleCount);
    return {
      visibleRows: data.slice(start, end),
      startIdx: start,
      totalHeight: data.length * rowHeightPx,
      paddingTop: start * rowHeightPx,
    };
  }, [scrollTop, viewportHeight, data, rowHeightPx]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-3 py-1.5 bg-violet-50 border-b border-violet-200 text-[10px] font-bold uppercase tracking-wider text-violet-700 flex items-center justify-between">
        <span className="inline-flex items-center gap-1">
          <Zap className="w-3 h-3" strokeWidth={2} />
          Virtualisation activée — {data.length.toLocaleString('fr-FR')} lignes
        </span>
        <span className="text-violet-500">Affichage {startIdx + 1}-{startIdx + visibleRows.length}</span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: paddingTop, left: 0, right: 0 }}>
            <DataTable
              data={visibleRows}
              columns={columns}
              stickyHeader={false}
              enablePagination={false}
              emptyMessage={emptyMessage}
              onRowClick={onRowClick}
              highlightRow={highlightRow}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
