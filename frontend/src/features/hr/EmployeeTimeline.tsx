import { useState } from 'react'
import { Button, Spinner, Select, Badge } from '../../components/ui'
import {
  useEmployeeTimeline,
  type ActivityLogEntry,
  type PaginatedResponse,
} from '../../api/hr_phase1'

interface EmployeeTimelineProps {
  employeeId: string
}

const ACTIVITY_STYLES: Record<string, { color: string; bgColor: string; icon: string }> = {
  hire: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: 'H' },
  promotion: { color: 'text-primary', bgColor: 'bg-primary/10', icon: 'P' },
  transfer: { color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', icon: 'T' },
  review: { color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: 'R' },
  training: { color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', icon: 'Tr' },
  project: { color: 'text-primary', bgColor: 'bg-primary/10', icon: 'Pj' },
  deal: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: 'D' },
  leave: { color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: 'L' },
  salary_change: { color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: '$' },
}

const ACTIVITY_BADGE_VARIANT: Record<string, 'success' | 'primary' | 'info' | 'warning' | 'danger' | 'default'> = {
  hire: 'success',
  promotion: 'primary',
  transfer: 'info',
  review: 'warning',
  training: 'info',
  project: 'primary',
  deal: 'success',
  leave: 'warning',
  salary_change: 'danger',
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: '', label: 'All Activities' },
  { value: 'hire', label: 'Hire' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'review', label: 'Review' },
  { value: 'training', label: 'Training' },
  { value: 'project', label: 'Project' },
  { value: 'deal', label: 'Deal' },
  { value: 'leave', label: 'Leave' },
  { value: 'salary_change', label: 'Salary Change' },
]

const SOURCE_MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'hr', label: 'HR' },
  { value: 'crm', label: 'CRM' },
  { value: 'projects', label: 'Projects' },
  { value: 'finance', label: 'Finance' },
  { value: 'training', label: 'Training' },
]

const LIMIT = 20

export default function EmployeeTimeline({ employeeId }: EmployeeTimelineProps) {
  const [activityType, setActivityType] = useState('')
  const [sourceModule, setSourceModule] = useState('')
  const [page, setPage] = useState(1)

  const { data: timelineData, isLoading } = useEmployeeTimeline(employeeId, {
    activity_type: activityType || undefined,
    source_module: sourceModule || undefined,
    page,
    limit: LIMIT,
  })

  const timeline = timelineData as PaginatedResponse<ActivityLogEntry> | ActivityLogEntry[] | undefined
  const items = Array.isArray(timeline) ? timeline : timeline?.items ?? []
  const total = Array.isArray(timeline) ? timeline.length : timeline?.total ?? 0
  const hasMore = page * LIMIT < total

  function getStyle(activityType: string) {
    return ACTIVITY_STYLES[activityType] ?? { color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-700', icon: '?' }
  }

  function handleLoadMore() {
    setPage((p) => p + 1)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="w-44">
          <Select
            options={ACTIVITY_TYPE_OPTIONS}
            value={activityType}
            onChange={(e) => { setActivityType(e.target.value); setPage(1) }}
          />
        </div>
        <div className="w-44">
          <Select
            options={SOURCE_MODULE_OPTIONS}
            value={sourceModule}
            onChange={(e) => { setSourceModule(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Timeline */}
      {isLoading && page === 1 ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No activity found for this employee.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-0">
            {items.map((entry) => {
              const style = getStyle(entry.activity_type)
              return (
                <div key={entry.id} className="relative flex gap-4 pb-6">
                  {/* Icon */}
                  <div
                    className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${style.bgColor} ${style.color}`}
                  >
                    {style.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entry.title}
                        </p>
                        {entry.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {entry.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant={ACTIVITY_BADGE_VARIANT[entry.activity_type] ?? 'default'}>
                            {entry.activity_type.replace('_', ' ')}
                          </Badge>
                          <Badge variant="default">{entry.source_module}</Badge>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {new Date(entry.occurred_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={handleLoadMore} loading={isLoading && page > 1}>
            Load More
          </Button>
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-gray-400 pt-2">
          Showing all {total} activities
        </p>
      )}
    </div>
  )
}
