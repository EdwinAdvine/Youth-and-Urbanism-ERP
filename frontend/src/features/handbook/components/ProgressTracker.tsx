import { cn } from '@/components/ui'

interface ProgressTrackerProps {
  totalRead: number
  totalPublished: number
  completionPct: number
  label?: string
}

export default function ProgressTracker({ totalRead, totalPublished, completionPct, label }: ProgressTrackerProps) {
  return (
    <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label || 'Reading Progress'}</span>
        <span className="text-xs text-gray-500">
          {totalRead} / {totalPublished} articles
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            completionPct >= 100 ? 'bg-success' : 'bg-primary'
          )}
          style={{ width: `${Math.min(100, completionPct)}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5">
        {completionPct >= 100 ? 'All caught up!' : `${completionPct}% complete`}
      </p>
    </div>
  )
}
