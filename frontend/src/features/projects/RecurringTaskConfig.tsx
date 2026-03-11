import { useState } from 'react'
import {
  useRecurringConfigs,
  useCreateRecurringConfig,
  useDeleteRecurringConfig,
  useUpdateRecurringConfig,
  useTriggerRecurringTask,
  type RecurringConfig,
} from '@/api/projects_enhanced'

const recurrenceLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
}

interface RecurringTaskConfigProps {
  projectId: string
}

export default function RecurringTaskConfig({ projectId }: RecurringTaskConfigProps) {
  const { data: configs, isLoading } = useRecurringConfigs(projectId)
  const createConfig = useCreateRecurringConfig()
  const deleteConfig = useDeleteRecurringConfig()
  const updateConfig = useUpdateRecurringConfig()
  const triggerTask = useTriggerRecurringTask()

  const [showAdd, setShowAdd] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [recurrenceType, setRecurrenceType] = useState('weekly')
  const [interval, setInterval] = useState(1)

  const handleCreate = () => {
    if (!taskTitle.trim()) return
    createConfig.mutate(
      {
        project_id: projectId,
        template_task: { title: taskTitle.trim(), priority: taskPriority, status: 'todo' },
        recurrence_type: recurrenceType,
        recurrence_interval: interval,
      },
      { onSuccess: () => { setTaskTitle(''); setShowAdd(false) } }
    )
  }

  const handleToggle = (config: RecurringConfig) => {
    updateConfig.mutate({
      project_id: projectId,
      config_id: config.id,
      is_active: !config.is_active,
    })
  }

  const handleDelete = (configId: string) => {
    if (!confirm('Delete this recurring task config?')) return
    deleteConfig.mutate({ project_id: projectId, config_id: configId })
  }

  const handleTrigger = (configId: string) => {
    triggerTask.mutate({ project_id: projectId, config_id: configId })
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4">Loading recurring tasks...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Recurring Tasks</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-3 py-1.5 bg-[#51459d] text-white rounded-[10px] hover:bg-[#51459d]/90"
        >
          + Add Recurring
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-[10px] p-4 space-y-3">
          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Task title that will be created..."
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Frequency</label>
              <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                {Object.entries(recurrenceLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Interval</label>
              <input type="number" value={interval} onChange={(e) => setInterval(parseInt(e.target.value) || 1)} min={1} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Priority</label>
              <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createConfig.isPending || !taskTitle.trim()} className="text-sm px-4 py-2 bg-[#51459d] text-white rounded-lg disabled:opacity-50">
              Create
            </button>
            <button onClick={() => setShowAdd(false)} className="text-sm px-4 py-2 text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      {(!configs || configs.length === 0) && !showAdd && (
        <p className="text-sm text-gray-400 text-center py-6">
          No recurring tasks set up. Tasks will be automatically created on schedule.
        </p>
      )}

      <div className="space-y-2">
        {configs?.map((config) => (
          <div key={config.id} className={`flex items-center gap-3 px-4 py-3 border rounded-[10px] ${config.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
            <button
              onClick={() => handleToggle(config)}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${config.is_active ? 'bg-[#6fd943]' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${config.is_active ? 'left-5' : 'left-0.5'}`} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700">
                {(config.template_task as Record<string, string>).title || 'Recurring Task'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Every {config.recurrence_interval > 1 ? `${config.recurrence_interval} ` : ''}
                {recurrenceLabels[config.recurrence_type]?.toLowerCase() || config.recurrence_type}
                {' · '}Next: {new Date(config.next_run_at).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={() => handleTrigger(config.id)}
              disabled={triggerTask.isPending}
              className="text-xs px-2 py-1 text-[#51459d] hover:bg-[#51459d]/10 rounded"
            >
              Run Now
            </button>
            <button onClick={() => handleDelete(config.id)} className="text-gray-400 hover:text-red-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
