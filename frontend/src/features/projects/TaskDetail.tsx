import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import type { Task, TaskStatus, TaskPriority } from '../../api/projects'
import { useUpdateTask, useDeleteTask, useAddTimeLog } from '../../api/projects'

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
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Title */}
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

        {/* Description */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
            placeholder="Task description..."
          />
        </div>

        {/* Status + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} />
          <Select label="Priority" options={PRIORITY_OPTIONS} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} />
        </div>

        {/* Assignee + Due date row */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Assignee ID" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} placeholder="User ID" />
          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        {/* Tags */}
        <Input label="Tags (comma-separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. frontend, urgent, bug" />

        {/* Time Log Section */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Log Time</h3>
          <div className="flex items-end gap-3">
            <div className="w-24">
              <Input label="Hours" type="number" min="0" step="0.25" value={logHours} onChange={(e) => setLogHours(e.target.value)} placeholder="0" />
            </div>
            <div className="flex-1">
              <Input label="Description" value={logDescription} onChange={(e) => setLogDescription(e.target.value)} placeholder="What did you work on?" />
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogTime} loading={addTimeLog.isPending}>
              Log
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleteTask.isPending}>
            Delete Task
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} loading={updateTask.isPending}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
