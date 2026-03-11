import { useState } from 'react'
import { Card, Button, Spinner, Modal, Input, Badge, toast } from '../../components/ui'
import { useProjects } from '../../api/projects'
import { Select } from '../../components/ui'
import {
  useMilestonesExt,
  useCreateMilestoneExt,
  useUpdateMilestone,
  useDeleteMilestone,
  type ProjectMilestone,
} from '../../api/projects_ext'

export default function MilestonesPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const [selectedProject, setSelectedProject] = useState('')
  const projectId = selectedProject || (projects?.[0]?.id ?? '')

  const { data: milestones, isLoading } = useMilestonesExt(projectId)
  const createMilestone = useCreateMilestoneExt()
  const updateMilestone = useUpdateMilestone()
  const deleteMilestone = useDeleteMilestone()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ProjectMilestone | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setDescription('')
    setDueDate('')
    setShowModal(true)
  }

  const openEdit = (m: ProjectMilestone) => {
    setEditing(m)
    setTitle(m.title)
    setDescription(m.description ?? '')
    setDueDate(m.due_date?.split('T')[0] ?? '')
    setShowModal(true)
  }

  const handleSave = () => {
    if (!title.trim()) return toast('error', 'Title is required')
    if (editing) {
      updateMilestone.mutate(
        {
          project_id: projectId,
          milestone_id: editing.id,
          title,
          description: description || undefined,
          due_date: dueDate || null,
        },
        {
          onSuccess: () => { toast('success', 'Milestone updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update milestone'),
        }
      )
    } else {
      createMilestone.mutate(
        { project_id: projectId, title, description: description || undefined, due_date: dueDate || null },
        {
          onSuccess: () => { toast('success', 'Milestone created'); setShowModal(false) },
          onError: () => toast('error', 'Failed to create milestone'),
        }
      )
    }
  }

  const handleToggle = (m: ProjectMilestone) => {
    updateMilestone.mutate(
      { project_id: projectId, milestone_id: m.id, is_completed: !m.is_completed },
      {
        onSuccess: () => toast('success', m.is_completed ? 'Milestone reopened' : 'Milestone completed'),
        onError: () => toast('error', 'Failed to update milestone'),
      }
    )
  }

  const handleDelete = (m: ProjectMilestone) => {
    if (!confirm(`Delete milestone "${m.title}"?`)) return
    deleteMilestone.mutate(
      { projectId, milestoneId: m.id },
      {
        onSuccess: () => toast('success', 'Milestone deleted'),
        onError: () => toast('error', 'Failed to delete milestone'),
      }
    )
  }

  if (loadingProjects) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  const sorted = [...(milestones ?? [])].sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const completedCount = sorted.filter((m) => m.is_completed).length
  const progressPct = sorted.length > 0 ? Math.round((completedCount / sorted.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Milestones</h1>
          <p className="text-sm text-gray-500 mt-1">Track key deliverables and deadlines</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-56">
            <Select
              value={projectId}
              onChange={(e) => setSelectedProject(e.target.value)}
              options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <Button onClick={openCreate}>New Milestone</Button>
        </div>
      </div>

      {/* Progress bar */}
      {sorted.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Overall Progress: {completedCount} / {sorted.length} milestones
            </span>
            <span className="text-sm font-semibold text-primary">{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-primary rounded-full h-3 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </Card>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : sorted.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-400">No milestones yet. Create one to get started.</div>
        </Card>
      ) : (
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

          {sorted.map((m) => {
            const isPast = m.due_date && new Date(m.due_date) < new Date() && !m.is_completed
            return (
              <div key={m.id} className="relative mb-6 last:mb-0">
                {/* Dot */}
                <div
                  className={`absolute -left-5 w-4 h-4 rounded-full border-2 border-white shadow ${
                    m.is_completed ? 'bg-green-500' : isPast ? 'bg-red-500' : 'bg-primary'
                  }`}
                />
                <Card className="ml-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggle(m)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          m.is_completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-primary'
                        }`}
                      >
                        {m.is_completed && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div>
                        <h3 className={`text-base font-semibold ${m.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {m.title}
                        </h3>
                        {m.description && (
                          <p className="text-sm text-gray-500 mt-1">{m.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {m.due_date && (
                            <span className="text-xs text-gray-400">
                              Due: {new Date(m.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {m.is_completed && (
                            <Badge variant="success">Completed</Badge>
                          )}
                          {isPast && <Badge variant="danger">Overdue</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(m)}>
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Milestone' : 'New Milestone'}>
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Milestone title" />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={createMilestone.isPending || updateMilestone.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
