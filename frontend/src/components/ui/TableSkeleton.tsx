import { cn } from '@/src/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 8, cols = 6, className }: TableSkeletonProps) {
  return (
    <div className={cn('w-full', className)} role="status" aria-label="Chargement…">
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-gray-100 rounded"
              style={{ width: i === 0 ? '8rem' : i === cols - 1 ? '4rem' : '6rem' }}
            />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0">
            {Array.from({ length: cols }).map((_, j) => (
              <div
                key={j}
                className="h-4 bg-gray-100 rounded"
                style={{
                  width: j === 0 ? '8rem' : j === cols - 1 ? '3rem' : `${5 + ((i + j) % 3) * 1.5}rem`,
                  opacity: 1 - i * 0.08,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
