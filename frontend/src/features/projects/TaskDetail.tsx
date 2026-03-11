import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import type { Task, TaskStatus, TaskPriority } from '../../api/projects'
import { useUpdateTask, useDeleteTask, useAddTimeLog } from '../../api/projects'
import TaskDependenciesView from './TaskDependenciesView'

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

interface TaskDetailProps {
  task: Task | null
  projectId: string
  open: boolean
  onClose: () => void
}

export default function TaskDetail({ task, projectId, open, onClose }: TaskDetailProps) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const addTimeLog = useAddTimeLog()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  // Time log form
  const [logHours, setLogHours] = useState('')
  const [logDescription, setLogDescription] = useState('')

  // Collapsible sections for mobile
  const [showTimeLog, setShowTimeLog] = useState(false)
  const [showDependencies, setShowDependencies] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setStatus(task.status)
      setPriority(task.priority)
      setAssigneeId(task.assignee_id || '')
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '')
      setTagsInput(task.tags ? task.tags.join(', ') : '')
    }
  }, [task])

  if (!task) return null

  async function handleSave() {
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      await updateTask.mutateAsync({
        project_id: projectId,
        task_id: task!.id,
        title,
        description,
        status,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        tags,
      })
      toast('success', 'Task updated')
      onClose()
    } catch {
      toast('error', 'Failed to update task')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    try {
      await deleteTask.mutateAsync({ project_id: projectId, task_id: task!.id })
      toast('success', 'Task deleted')
      onClose()
    } catch {
      toast('error', 'Failed to delete task')
    }
  }

  async function handleLogTime() {
    const hours = parseFloat(logHours)
    if (!hours || hours <= 0) {
      toast('warning', 'Enter valid hours')
      return
    }
    try {
      await addTimeLog.mutateAsync({
        project_id: projectId,
        task_id: task!.id,
        hours,
        description: logDescription,
      })
      toast('success', 'Time logged')
      setLogHours('')
      setLogDescription('')
    } catch {
      toast('error', 'Failed to log time')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Task Details" size="xl">
      <div className="space-y-4 max-h-[80vh] sm:max-h-[70vh] overflow-y-auto px-0.5">
        {/* Title */}
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-[44px]" />

        {/* Description */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
            placeholder="Task description..."
          />
        </div>

        {/* Status + Priority - stacked on mobile, row on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} />
          <Select label="Priority" options={PRIORITY_OPTIONS} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} />
        </div>

        {/* Assignee + Due date - stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Assignee ID" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} placeholder="User ID" className="min-h-[44px]" />
          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="min-h-[44px]" />
        </div>

        {/* Tags */}
        <Input label="Tags (comma-separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. frontend, urgent, bug" className="min-h-[44px]" />

        {/* Dependencies Section - collapsible on mobile */}
        {task && (
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={() => setShowDependencies(!showDependencies)}
              className="flex items-center justify-between w-full text-left sm:pointer-events-none min-h-[44px] sm:min-h-0"
            >
              <h3 className="text-sm font-semibold text-gray-900">Dependencies</h3>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform sm:hidden ${showDependencies ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`${showDependencies ? 'block' : 'hidden'} sm:block mt-2`}>
              <TaskDependenciesView task={task} projectId={projectId} />
            </div>
          </div>
        )}

        {/* Time Log Section - collapsible on mobile */}
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowTimeLog(!showTimeLog)}
            className="flex items-center justify-between w-full text-left sm:pointer-events-none min-h-[44px] sm:min-h-0"
          >
            <h3 className="text-sm font-semibold text-gray-900">Log Time</h3>
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform sm:hidden ${showTimeLog ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={`${showTimeLog ? 'block' : 'hidden'} sm:block mt-3`}>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="w-full sm:w-24">
                <Input label="Hours" type="number" min="0" step="0.25" value={logHours} onChange={(e) => setLogHours(e.target.value)} placeholder="0" className="min-h-[44px]" />
              </div>
              <div className="flex-1">
                <Input label="Description" value={logDescription} onChange={(e) => setLogDescription(e.target.value)} placeholder="What did you work on?" className="min-h-[44px]" />
              </div>
              <Button variant="secondary" size="sm" onClick={handleLogTime} loading={addTimeLog.isPending} className="min-h-[44px] w-full sm:w-auto">
                Log
              </Button>
            </div>
          </div>
        </div>

        {/* Actions - stacked on mobile */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-100 gap-3">
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleteTask.isPending} className="min-h-[44px] w-full sm:w-auto">
            Delete Task
          </Button>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="min-h-[44px]">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} loading={updateTask.isPending} className="min-h-[44px]">
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
