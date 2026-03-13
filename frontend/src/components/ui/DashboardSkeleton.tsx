/**
 * DashboardSkeleton — animated placeholder for dashboard pages while loading.
 *
 * Usage:
 *   if (isLoading) return <DashboardSkeleton />
 */

interface CardSkeletonProps {
  height?: string
}

function CardSkeleton({ height = 'h-32' }: CardSkeletonProps) {
  return (
    <div className={`${height} bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse`} />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardSkeleton height="h-64" />
        <CardSkeleton height="h-64" />
      </div>

      {/* Table / list area */}
      <CardSkeleton height="h-48" />
    </div>
  )
}
