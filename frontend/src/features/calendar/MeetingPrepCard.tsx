import { useMeetingPrepCard } from '../../api/calendar_analytics'

interface MeetingPrepCardProps {
  eventId: string
  onClose: () => void
}

export default function MeetingPrepCard({ eventId, onClose }: MeetingPrepCardProps) {
  const { data, isLoading, error } = useMeetingPrepCard(eventId)

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3 animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-sm text-gray-400">
        Unable to load meeting prep data.
      </div>
    )
  }

  const startTime = new Date(data.start_time)
  const endTime = new Date(data.end_time)
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#51459d] px-5 py-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{data.title}</h3>
            <p className="text-sm text-white/70 mt-0.5">
              {startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              {' '}
              {startTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              {' - '}
              {endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              {' '}({duration} min)
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Attendees */}
        {data.attendees.length > 0 && (
          <Section title="Attendees">
            <div className="flex flex-wrap gap-2">
              {data.attendees.map((att) => (
                <span
                  key={att}
                  className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full"
                >
                  {att}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* CRM Context */}
        {data.crm_context.length > 0 && (
          <Section title="CRM Context">
            <div className="space-y-2">
              {data.crm_context.map((ctx, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-[#51459d] flex items-center justify-center text-white text-xs font-bold">
                    {ctx.type === 'contact' ? 'C' : 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {ctx.name || ctx.email || ctx.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ctx.type === 'deal' && ctx.stage && <span className="capitalize">{ctx.stage}</span>}
                      {ctx.type === 'deal' && ctx.value != null && <span> &middot; ${ctx.value.toLocaleString()}</span>}
                      {ctx.type === 'contact' && ctx.company && ctx.company}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Finance Context */}
        {data.finance_context.length > 0 && (
          <Section title="Finance">
            <div className="space-y-2">
              {data.finance_context.map((ctx, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{ctx.number || ctx.type}</p>
                    <p className="text-xs text-gray-500 capitalize">{ctx.status}</p>
                  </div>
                  {ctx.total != null && (
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">
                      ${ctx.total.toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Support Context */}
        {data.support_context.length > 0 && (
          <Section title="Support Tickets">
            <div className="space-y-2">
              {data.support_context.map((ctx, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ctx.subject || ctx.id}</p>
                    <p className="text-xs text-gray-500 capitalize">{ctx.status}</p>
                  </div>
                  {ctx.priority && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      ctx.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      ctx.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {ctx.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recent Related Meetings */}
        {data.recent_related_meetings && data.recent_related_meetings.length > 0 && (
          <Section title="Recent Related Meetings">
            <div className="space-y-1.5">
              {data.recent_related_meetings.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 truncate">{m.title}</span>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  )
}
