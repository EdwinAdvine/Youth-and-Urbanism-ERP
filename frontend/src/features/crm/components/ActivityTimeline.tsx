import { Badge, cn } from '@/components/ui'

interface Activity {
  id?: string
  activity_type?: string
  type?: string
  subject?: string
  description?: string | null
  created_at?: string
  date?: string
  due_date?: string | null
  duration_minutes?: number | null
  outcome?: string | null
  contact_id?: string | null
  [key: string]: any
}

interface ActivityTimelineProps {
  activities: Activity[]
  className?: string
}

const TYPE_ICONS: Record<string, string> = {
  call: 'C',
  email: 'E',
  meeting: 'M',
  task: 'T',
  note: 'N',
  demo: 'D',
  follow_up: 'F',
}

const TYPE_COLORS: Record<string, string> = {
  call: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  email: 'bg-purple-100 text-purple-700 border-purple-200',
  meeting: 'bg-green-100 text-green-700 border-green-200',
  task: 'bg-orange-100 text-orange-700 border-orange-200',
  note: 'bg-gray-100 text-gray-700 border-gray-200',
  demo: 'bg-blue-100 text-blue-700 border-blue-200',
  follow_up: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

const TYPE_BADGE_VARIANT: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  call: 'info',
  email: 'primary',
  meeting: 'success',
  task: 'warning',
  note: 'default',
  demo: 'info',
  follow_up: 'warning',
}

export default function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn('text-center py-12 text-gray-400 text-sm', className)}>
        No activities recorded.
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        {activities.map((activity, index) => {
          const type = activity.activity_type ?? activity.type ?? 'note'
          const icon = TYPE_ICONS[type] ?? type[0]?.toUpperCase() ?? '?'
          const colorClass = TYPE_COLORS[type] ?? TYPE_COLORS.note
          const dateStr = activity.created_at ?? activity.date ?? activity.due_date
          const badgeVariant = TYPE_BADGE_VARIANT[type] ?? 'default'

          return (
            <div key={activity.id ?? index} className="relative flex gap-4 pl-0">
              {/* Icon circle */}
              <div
                className={cn(
                  'relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border',
                  colorClass
                )}
              >
                {icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={badgeVariant}>{type.replace(/_/g, ' ')}</Badge>
                  {dateStr && (
                    <span className="text-xs text-gray-400">
                      {new Date(dateStr).toLocaleString()}
                    </span>
                  )}
                  {activity.duration_minutes && (
                    <span className="text-xs text-gray-400">
                      ({activity.duration_minutes}m)
                    </span>
                  )}
                </div>

                {activity.subject && (
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {activity.subject}
                  </p>
                )}

                {activity.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {activity.description}
                  </p>
                )}

                {activity.outcome && (
                  <div className="mt-1">
                    <Badge
                      variant={
                        activity.outcome === 'positive' ? 'success' :
                        activity.outcome === 'negative' ? 'danger' : 'default'
                      }
                    >
                      {activity.outcome}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
