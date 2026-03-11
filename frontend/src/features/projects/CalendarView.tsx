import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useProjects } from '@/api/projects'
import { useCalendarTasks } from '@/api/projects_enhanced'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const priorityDots: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500',
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Mon=0
  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Fill leading days from prev month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false })
  }
  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  // Fill trailing days
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - lastDay.getDate() - startDow + 1)
    days.push({ date: d, isCurrentMonth: false })
  }
  return days
}

export default function CalendarView() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  const [currentDate, setCurrentDate] = useState(new Date())
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const start = new Date(year, month, 1).toISOString()
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  const { data, isLoading } = useCalendarTasks(projectId || '', start, end)

  const days = useMemo(() => getMonthDays(year, month), [year, month])
  const today = new Date().toISOString().split('T')[0]
  const byDate = (data?.by_date || {}) as Record<string, { id: string; title: string; status: string; priority: string }[]>

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          {project?.name || 'Project'} — Calendar
        </h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            ←
          </button>
          <h2 className="text-base font-semibold text-gray-700 w-48 text-center">{monthLabel}</h2>
          <button onClick={nextMonth} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            →
          </button>
        </div>
        <button onClick={goToday} className="text-sm text-[#51459d] hover:text-[#51459d]/80">
          Today
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading calendar...</div>
      ) : (
        <div className="border border-gray-200 rounded-[10px] overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-50">
            {DAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-xs font-medium text-gray-500 text-center border-b border-gray-200">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map(({ date, isCurrentMonth }, i) => {
              const dateKey = date.toISOString().split('T')[0]
              const isToday = dateKey === today
              const tasks = byDate[dateKey] || []

              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-[#51459d] text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {tasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[#51459d]/5 text-gray-700 truncate cursor-pointer hover:bg-[#51459d]/10"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDots[task.priority] || 'bg-gray-300'}`} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    ))}
                    {tasks.length > 3 && (
                      <div className="text-xs text-gray-400 px-1.5">+{tasks.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
