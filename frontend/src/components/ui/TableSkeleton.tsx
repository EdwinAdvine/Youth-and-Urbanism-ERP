/**
 * TableSkeleton — animated placeholder for list pages while data loads.
 *
 * Usage:
 *   if (isLoading) return <TableSkeleton rows={8} columns={5} />
 */

interface TableSkeletonProps {
  /** Number of skeleton rows to show (default: 8) */
  rows?: number
  /** Number of columns (default: 5) */
  columns?: number
  /** Show a header row skeleton (default: true) */
  showHeader?: boolean
}

export function TableSkeleton({ rows = 8, columns = 5, showHeader = true }: TableSkeletonProps) {
  return (
    <div className="w-full animate-pulse">
      {showHeader && (
        <div className="flex gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
              style={{ flex: i === 0 ? 2 : 1 }}
            />
          ))}
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 px-4 py-4 items-center">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-4 bg-gray-100 dark:bg-gray-800 rounded"
                style={{
                  flex: colIdx === 0 ? 2 : 1,
                  opacity: 1 - rowIdx * 0.08,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
