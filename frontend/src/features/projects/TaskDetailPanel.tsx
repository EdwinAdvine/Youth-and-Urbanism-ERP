import { useState } from 'react'
import { useUpdateTask, useDeleteTask, type Task } from '@/api/projects.ts'
import SubtaskList from './SubtaskList'
import ChecklistSection from './ChecklistSection'
import TaskComments from './TaskComments'
import TaskActivityFeed from './TaskActivityFeed'
import CustomFieldsEditor from './CustomFieldsEditor'

type TabKey = 'details' | 'subtasks' | 'checklists' | 'comments' | 'activity' | 'fields'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'subtasks', label: 'Subtasks' },
  { key: 'checklists', label: 'Checklist' },
  { key: 'comments', label: 'Comments' },
  { key: 'activity', label: 'Activity' },
  { key: 'fields', label: 'Fields' },
]

const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

interface TaskDetailPanelProps {
  task: Task
  projectId: string
  open: boolean
  onClose: () => void
}

export default function TaskDetailPanel({ task, projectId, open, onClose }: TaskDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [taskStatus, setTaskStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '')
  const [startDate, setStartDate] = useState(task.start_date ? task.start_date.split('T')[0] : '')
  const [estimatedHours, setEstimatedHours] = useState(task.estimated_hours?.toString() || '')

  const handleSave = () => {
    updateTask.mutate({
      project_id: projectId,
      task_id: task.id,
      title: title || undefined,
      description: description || undefined,
      status: taskStatus as Task['status'],
      priority: priority as Task['priority'],
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
    })
  }

  const handleDelete = () => {
    if (!confirm('Delete this task and all its subtasks?')) return
    deleteTask.mutate({ project_id: projectId, task_id: task.id }, { onSuccess: onClose })
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 truncate">{task.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="text-sm text-gray-400 hover:text-red-500 px-2 py-1"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[#51459d] text-[#51459d]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-[10px] px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                  >
                    {priorityOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Estimated Hours</label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  step="0.5"
                  min="0"
                  className="w-full text-sm border border-gray-300 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                />
              </div>

              {task.tags && task.tags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-[#51459d]/10 text-[#51459d] rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={updateTask.isPending}
                className="w-full py-2 bg-[#51459d] text-white text-sm rounded-[10px] hover:bg-[#51459d]/90 disabled:opacity-50"
              >
                {updateTask.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {activeTab === 'subtasks' && (
            <SubtaskList projectId={projectId} taskId={task.id} />
          )}

          {activeTab === 'checklists' && (
            <ChecklistSection projectId={projectId} taskId={task.id} />
          )}

          {activeTab === 'comments' && (
            <TaskComments projectId={projectId} taskId={task.id} />
          )}

          {activeTab === 'activity' && (
            <TaskActivityFeed projectId={projectId} taskId={task.id} />
          )}

          {activeTab === 'fields' && (
            <CustomFieldsEditor projectId={projectId} taskId={task.id} />
          )}
        </div>
      </div>
    </>
  )
}
