import { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { cn, Button, Spinner, Modal, Input, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import { useProjects, useCreateProject, type Project } from '../../api/projects'

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  active: 'success',
  planning: 'info',
  on_hold: 'warning',
  completed: 'default',
}

const COLOR_PRESETS = [
  '#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

// Features surfaced in the empty state to show what becomes available
const FEATURE_CARDS = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    title: 'Kanban Board',
    desc: 'Drag-and-drop task management with custom columns, swimlanes, and bulk operations.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Gantt & Milestones',
    desc: 'Timeline visualisation, dependency tracking, and milestone progress.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    title: 'Time Tracking',
    desc: 'Log time per task, view team workload, and export detailed time reports.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    title: 'Cross-Module Links',
    desc: 'Connect tasks to CRM deals, finance expenses, Drive folders, and Docs.',
  },
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [color, setColor] = useState(COLOR_PRESETS[0])

  function resetForm() {
    setName('')
    setDescription('')
    setStartDate('')
    setEndDate('')
    setColor(COLOR_PRESETS[0])
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast('warning', 'Project name is required')
      return
    }
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description,
        status: 'active',
        start_date: startDate || null,
        end_date: endDate || null,
        color,
      })
      toast('success', 'Project created')
      resetForm()
      setModalOpen(false)
      navigate(`/projects/${project.id}`)
    } catch {
      toast('error', 'Failed to create project')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top nav tabs */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-0">
            {[
              { label: 'Projects', href: '/projects' },
              { label: 'Workload', href: '/projects/workload' },
              { label: 'Templates', href: '/projects/templates' },
            ].map(({ label, href }) => (
              <NavLink
                key={href}
                to={href}
                end
                className={({ isActive }) =>
                  cn(
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)} className="my-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-12">
            {/* Empty state header */}
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">No projects yet</h2>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
              Create your first project to unlock Kanban boards, Gantt charts, time tracking, and more.
            </p>
            <Button onClick={() => setModalOpen(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Project
            </Button>

            {/* Feature preview cards */}
            <div className="mt-10 w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURE_CARDS.map((f) => (
                <div
                  key={f.title}
                  className="flex gap-3 p-4 rounded-[10px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Project" size="md">
        <div className="space-y-4">
          <Input label="Project Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website Redesign" autoFocus />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Brief project description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {/* Color Picker */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-all',
                    color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} loading={createProject.isPending}>
              Create Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const badgeVariant = STATUS_BADGE[project.status] ?? 'default'

  const dateRange = [project.start_date, project.end_date]
    .filter(Boolean)
    .map((d) => new Date(d!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
    .join(' - ')

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden',
        'cursor-pointer hover:shadow-md transition-shadow group'
      )}
    >
      {/* Color stripe */}
      <div className="h-1.5" style={{ backgroundColor: project.color || '#51459d' }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </h3>
          <Badge variant={badgeVariant} className="shrink-0">{project.status}</Badge>
        </div>

        {project.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.description}</p>
        )}

        {dateRange && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {dateRange}
          </div>
        )}
      </div>
    </div>
  )
}
