import { useState } from 'react'
import { cn, Button, Badge, Modal, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useUpdateTask, useDeleteTask, type Task, type TaskStatus, type TaskPriority } from '../../api/projects'

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

interface BulkTaskOperationsProps {
  projectId: string
  selectedTaskIds: Set<string>
  tasks: Task[]
  onClearSelection: () => void
}

export default function BulkTaskOperations({
  projectId,
  selectedTaskIds,
  tasks,
  onClearSelection,
}: BulkTaskOperationsProps) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [actionModal, setActionModal] = useState<'status' | 'priority' | 'assignee' | 'delete' | null>(null)
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>('todo')
  const [bulkPriority, setBulkPriority] = useState<TaskPriority>('medium')
  const [bulkAssigneeId, setBulkAssigneeId] = useState('')
  const [processing, setProcessing] = useState(false)

  const count = selectedTaskIds.size
  if (count === 0) return null

  const selectedTasks = tasks.filter((t) => selectedTaskIds.has(t.id))

  async function applyBulkUpdate(updates: Partial<{ status: TaskStatus; priority: TaskPriority; assignee_id: string | null }>) {
    setProcessing(true)
    let successCount = 0
    let failCount = 0

    for (const task of selectedTasks) {
      try {
        await updateTask.mutateAsync({
          project_id: projectId,
          task_id: task.id,
          ...updates,
        })
        successCount++
      } catch {
        failCount++
      }
    }

    setProcessing(false)
    setActionModal(null)

    if (failCount === 0) {
      toast('success', `Updated ${successCount} task${successCount !== 1 ? 's' : ''}`)
    } else {
      toast('warning', `Updated ${successCount}, failed ${failCount}`)
    }
    onClearSelection()
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Are you sure you want to delete ${count} task${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return
    }
    setProcessing(true)
    let successCount = 0
    let failCount = 0

    for (const task of selectedTasks) {
      try {
        await deleteTask.mutateAsync({ project_id: projectId, task_id: task.id })
        successCount++
      } catch {
        failCount++
      }
    }

    setProcessing(false)
    setActionModal(null)

    if (failCount === 0) {
      toast('success', `Deleted ${successCount} task${successCount !== 1 ? 's' : ''}`)
    } else {
      toast('warning', `Deleted ${successCount}, failed ${failCount}`)
    }
    onClearSelection()
  }

  return (
    <>
      {/* Floating toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-[10px] shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <Badge variant="primary" className="mr-1">
            {count} selected
          </Badge>

          <div className="w-px h-6 bg-gray-200" />

          <Button
            size="sm"
            variant="outline"
            onClick={() => { setBulkStatus('todo'); setActionModal('status') }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Status
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { setBulkPriority('medium'); setActionModal('priority') }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Priority
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { setBulkAssigneeId(''); setActionModal('assignee') }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Assign
          </Button>

          <div className="w-px h-6 bg-gray-200" />

          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={handleBulkDelete}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </Button>

          <div className="w-px h-6 bg-gray-200" />

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Change Status Modal */}
      <Modal
        open={actionModal === 'status'}
        onClose={() => setActionModal(null)}
        title={`Change Status for ${count} task${count !== 1 ? 's' : ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="New Status"
            options={STATUS_OPTIONS}
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as TaskStatus)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button size="sm" onClick={() => applyBulkUpdate({ status: bulkStatus })} loading={processing}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change Priority Modal */}
      <Modal
        open={actionModal === 'priority'}
        onClose={() => setActionModal(null)}
        title={`Change Priority for ${count} task${count !== 1 ? 's' : ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="New Priority"
            options={PRIORITY_OPTIONS}
            value={bulkPriority}
            onChange={(e) => setBulkPriority(e.target.value as TaskPriority)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button size="sm" onClick={() => applyBulkUpdate({ priority: bulkPriority })} loading={processing}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal
        open={actionModal === 'assignee'}
        onClose={() => setActionModal(null)}
        title={`Assign ${count} task${count !== 1 ? 's' : ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assignee User ID</label>
            <input
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              value={bulkAssigneeId}
              onChange={(e) => setBulkAssigneeId(e.target.value)}
              placeholder="Enter user ID or leave empty to unassign"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => applyBulkUpdate({ assignee_id: bulkAssigneeId || null })}
              loading={processing}
            >
              {bulkAssigneeId ? 'Assign' : 'Unassign All'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Selectable TaskCard wrapper ────────────────────────────────────────────

interface SelectableCheckboxProps {
  taskId: string
  selected: boolean
  onToggle: (taskId: string) => void
}

export function TaskSelectionCheckbox({ taskId, selected, onToggle }: SelectableCheckboxProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle(taskId)
      }}
      className={cn(
        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
        selected
          ? 'bg-primary border-primary'
          : 'border-gray-300 hover:border-primary/50'
      )}
    >
      {selected && (
        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}
