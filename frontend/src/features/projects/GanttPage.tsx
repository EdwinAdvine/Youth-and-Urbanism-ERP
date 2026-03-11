import { useState, useMemo } from 'react'
import { Card, Spinner, Select, Badge } from '../../components/ui'
import { useProjects } from '../../api/projects'
import { useProjectTimeline, type GanttTask } from '../../api/projects_ext'

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3ec9d6',
  in_review: '#ffa21d',
  done: '#6fd943',
}

const PRIORITY_ICONS: Record<string, string> = {
  low: '',
  medium: '',
  high: '',
  urgent: '',
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function dayOffset(start: string, ref: string): number {
  return Math.floor((new Date(start).getTime() - new Date(ref).getTime()) / 86400000)
}

export default function GanttPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const [selectedProject, setSelectedProject] = useState('')

  const projectId = selectedProject || (projects?.[0]?.id ?? '')
  const { data: tasks, isLoading: loadingTasks } = useProjectTimeline(projectId)

  const { timelineStart, totalDays, months } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      return { timelineStart: start, totalDays: 30, months: [{ label: now.toLocaleDateString('en', { month: 'short', year: 'numeric' }), days: 30 }] }
    }
    const dates = tasks.flatMap((t) => [t.start_date, t.end_date, t.due_date].filter(Boolean)) as string[]
    const min = new Date(Math.min(...dates.map((d) => new Date(d).getTime())))
    const max = new Date(Math.max(...dates.map((d) => new Date(d).getTime())))
    min.setDate(1)
    max.setDate(max.getDate() + 7)
    const start = min.toISOString().split('T')[0]
    const days = daysBetween(start, max.toISOString().split('T')[0])

    const monthsList: { label: string; days: number }[] = []
    const cursor = new Date(min)
    while (cursor <= max) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      const end = monthEnd > max ? max : monthEnd
      const d = daysBetween(cursor.toISOString().split('T')[0], end.toISOString().split('T')[0])
      monthsList.push({ label: cursor.toLocaleDateString('en', { month: 'short', year: 'numeric' }), days: d })
      cursor.setMonth(cursor.getMonth() + 1)
      cursor.setDate(1)
    }

    return { timelineStart: start, totalDays: days, months: monthsList }
  }, [tasks])

  const DAY_WIDTH = 28

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gantt Chart</h1>
          <p className="text-sm text-gray-500 mt-1">Visual project timeline with task dependencies</p>
        </div>
        <div className="w-64">
          <Select
            label="Project"
            value={projectId}
            onChange={(e) => setSelectedProject(e.target.value)}
            options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>

      <Card padding={false}>
        {loadingTasks ? (
          <div className="flex items-center justify-center py-24">
            <Spinner />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="text-center py-24 text-gray-400">No tasks with dates found. Add start/due dates to tasks to see them here.</div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 300 + totalDays * DAY_WIDTH }}>
              {/* Month headers */}
              <div className="flex border-b border-gray-100">
                <div className="w-[300px] shrink-0 px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-r border-gray-100">
                  Task
                </div>
                <div className="flex">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      style={{ width: m.days * DAY_WIDTH }}
                      className="px-2 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-100 text-center"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Task rows */}
              {tasks.map((task) => (
                <GanttRow
                  key={task.id}
                  task={task}
                  timelineStart={timelineStart}
                  dayWidth={DAY_WIDTH}
                  totalDays={totalDays}
                  allTasks={tasks}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function GanttRow({
  task,
  timelineStart,
  dayWidth,
  totalDays,
  allTasks,
}: {
  task: GanttTask
  timelineStart: string
  dayWidth: number
  totalDays: number
  allTasks: GanttTask[]
}) {
  const start = task.start_date ?? task.due_date
  const end = task.end_date ?? task.due_date ?? task.start_date
  if (!start || !end) return null

  const offset = Math.max(0, dayOffset(start, timelineStart))
  const duration = Math.max(1, daysBetween(start, end))
  const color = STATUS_COLORS[task.status] ?? '#94a3b8'

  return (
    <div className="flex border-b border-gray-50 hover:bg-gray-50 transition-colors group">
      <div className="w-[300px] shrink-0 px-4 py-2 flex items-center gap-2 border-r border-gray-100">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm text-gray-700 truncate">{task.title}</span>
        {task.assignee_name && (
          <span className="text-xs text-gray-400 truncate ml-auto">{task.assignee_name}</span>
        )}
      </div>
      <div className="relative" style={{ width: totalDays * dayWidth, height: 36 }}>
        {/* Grid lines */}
        {Array.from({ length: totalDays }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-r border-gray-50"
            style={{ left: i * dayWidth, width: dayWidth }}
          />
        ))}
        {/* Bar */}
        <div
          className="absolute top-1.5 rounded-md flex items-center px-2 text-xs text-white font-medium shadow-sm transition-all"
          style={{
            left: offset * dayWidth,
            width: duration * dayWidth,
            height: 22,
            backgroundColor: color,
            minWidth: 20,
          }}
          title={`${task.title}: ${start} - ${end} (${task.status})`}
        >
          {duration * dayWidth > 80 && (
            <span className="truncate">{task.title}</span>
          )}
        </div>
        {/* Dependency arrows */}
        {task.dependencies?.map((depId) => {
          const dep = allTasks.find((t) => t.id === depId)
          if (!dep) return null
          const depEnd = dep.end_date ?? dep.due_date ?? dep.start_date
          if (!depEnd) return null
          const depOffset = Math.max(0, dayOffset(depEnd, timelineStart))
          const startX = depOffset * dayWidth + dayWidth
          const endX = offset * dayWidth
          const midY = 18
          return (
            <svg
              key={depId}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ width: totalDays * dayWidth, height: 36 }}
            >
              <path
                d={`M ${startX} ${midY} L ${(startX + endX) / 2} ${midY} L ${endX} ${midY}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                markerEnd="url(#arrow)"
              />
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                  <path d="M0,0 L6,2 L0,4" fill="#94a3b8" />
                </marker>
              </defs>
            </svg>
          )
        })}
      </div>
    </div>
  )
}
