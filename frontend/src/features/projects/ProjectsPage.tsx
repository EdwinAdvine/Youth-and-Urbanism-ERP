import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your projects and track progress</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Button>
      </div>

      {/* Project Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No projects yet</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">Create your first project to get started</p>
          <Button size="sm" onClick={() => setModalOpen(true)}>Create Project</Button>
        </div>
      )}

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
        'bg-white rounded-[10px] border border-gray-100 shadow-sm overflow-hidden',
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
