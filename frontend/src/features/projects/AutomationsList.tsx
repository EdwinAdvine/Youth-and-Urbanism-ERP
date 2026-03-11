import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProjects } from '@/api/projects'
import {
  useAutomationRules,
  useAutomationTemplates,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  type AutomationRule,
  type AutomationTemplate,
} from '@/api/projects_enhanced'

const triggerLabels: Record<string, string> = {
  status_change: 'Status Changed',
  due_date_reached: 'Due Date Reached',
  assignment_change: 'Assignee Changed',
  task_created: 'Task Created',
  priority_change: 'Priority Changed',
}

const actionLabels: Record<string, string> = {
  assign_user: 'Assign User',
  send_notification: 'Send Notification',
  move_to_status: 'Move to Status',
  create_subtask: 'Create Subtask',
  add_tag: 'Add Tag',
}

export default function AutomationsList() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  const { data: rules, isLoading } = useAutomationRules(projectId || '')
  const { data: templates } = useAutomationTemplates(projectId || '')
  const createAutomation = useCreateAutomation()
  const updateAutomation = useUpdateAutomation()
  const deleteAutomation = useDeleteAutomation()

  const [showBuilder, setShowBuilder] = useState(false)
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState('status_change')
  const [actionType, setActionType] = useState('send_notification')
  const [triggerConfig, setTriggerConfig] = useState('')
  const [actionConfig, setActionConfig] = useState('')

  const handleCreate = () => {
    if (!name.trim() || !projectId) return
    createAutomation.mutate(
      {
        project_id: projectId,
        name: name.trim(),
        trigger_type: triggerType,
        trigger_config: triggerConfig ? JSON.parse(triggerConfig) : undefined,
        action_type: actionType,
        action_config: actionConfig ? JSON.parse(actionConfig) : undefined,
      },
      {
        onSuccess: () => {
          setName(''); setTriggerConfig(''); setActionConfig(''); setShowBuilder(false)
        },
      }
    )
  }

  const handleFromTemplate = (tmpl: AutomationTemplate) => {
    if (!projectId) return
    createAutomation.mutate({
      project_id: projectId,
      name: tmpl.name,
      trigger_type: tmpl.trigger_type,
      trigger_config: tmpl.trigger_config,
      action_type: tmpl.action_type,
      action_config: tmpl.action_config,
    })
  }

  const handleToggle = (rule: AutomationRule) => {
    if (!projectId) return
    updateAutomation.mutate({
      project_id: projectId,
      rule_id: rule.id,
      is_active: !rule.is_active,
    })
  }

  const handleDelete = (ruleId: string) => {
    if (!projectId || !confirm('Delete this automation rule?')) return
    deleteAutomation.mutate({ project_id: projectId, rule_id: ruleId })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          {project?.name || 'Project'} — Automations
        </h1>
        <button
          onClick={() => setShowBuilder(true)}
          className="text-sm px-4 py-2 bg-[#51459d] text-white rounded-[10px] hover:bg-[#51459d]/90"
        >
          + New Rule
        </button>
      </div>

      {/* Builder */}
      {showBuilder && (
        <div className="bg-gray-50 border border-gray-200 rounded-[10px] p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name..."
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">When (Trigger)</label>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                {Object.entries(triggerLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Then (Action)</label>
              <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                {Object.entries(actionLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Trigger Config (JSON)</label>
              <input type="text" value={triggerConfig} onChange={(e) => setTriggerConfig(e.target.value)} placeholder='{"to_status": "done"}' className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Action Config (JSON)</label>
              <input type="text" value={actionConfig} onChange={(e) => setActionConfig(e.target.value)} placeholder='{"tag": "needs-review"}' className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createAutomation.isPending || !name.trim()} className="text-sm px-4 py-2 bg-[#51459d] text-white rounded-lg disabled:opacity-50">
              Create Rule
            </button>
            <button onClick={() => setShowBuilder(false)} className="text-sm px-4 py-2 text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading rules...</div>
      ) : (
        <div className="space-y-2">
          {(!rules || rules.length === 0) && (
            <div className="text-center py-8 text-gray-400">
              No automation rules yet. Create one or use a template below.
            </div>
          )}
          {rules?.map((rule) => (
            <div key={rule.id} className={`flex items-center gap-4 px-4 py-3 border rounded-[10px] transition-colors ${rule.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <button
                onClick={() => handleToggle(rule)}
                className={`w-10 h-5 rounded-full transition-colors relative ${rule.is_active ? 'bg-[#6fd943]' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${rule.is_active ? 'left-5' : 'left-0.5'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700">{rule.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  When {triggerLabels[rule.trigger_type] || rule.trigger_type} → {actionLabels[rule.action_type] || rule.action_type}
                  {rule.execution_count > 0 && <span className="ml-2">({rule.execution_count} runs)</span>}
                </div>
              </div>
              <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Templates */}
      {templates && templates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">Quick Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.map((tmpl, i) => (
              <button
                key={i}
                onClick={() => handleFromTemplate(tmpl)}
                className="text-left p-3 border border-gray-200 rounded-[10px] hover:border-[#51459d]/30 hover:bg-[#51459d]/5 transition-colors"
              >
                <div className="text-sm font-medium text-gray-700">{tmpl.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {triggerLabels[tmpl.trigger_type]} → {actionLabels[tmpl.action_type]}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
