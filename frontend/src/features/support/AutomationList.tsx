import { useState } from 'react'
import { Button, Card, Badge, Modal, Input, Select, toast } from '../../components/ui'
import {
  useAutomations,
  useCreateAutomation,
  useToggleAutomation,
  useDeleteAutomation,
  type SupportAutomation,
} from '@/api/support_phase2'

const TRIGGER_OPTIONS = [
  { value: 'support.ticket.created', label: 'Ticket Created' },
  { value: 'support.comment.added', label: 'Comment Added' },
  { value: 'support.sla.breached', label: 'SLA Breached' },
  { value: 'support.ticket.resolved', label: 'Ticket Resolved' },
]

const TRIGGER_LABEL: Record<string, string> = {
  'support.ticket.created': 'Ticket Created',
  'support.comment.added': 'Comment Added',
  'support.sla.breached': 'SLA Breached',
  'support.ticket.resolved': 'Ticket Resolved',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AutomationList() {
  const { data: automations, isLoading } = useAutomations()
  const createMutation = useCreateAutomation()
  const toggleMutation = useToggleAutomation()
  const deleteMutation = useDeleteAutomation()

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', trigger_event: 'support.ticket.created' })
  const [filterActive, setFilterActive] = useState<string>('')

  const filtered = (automations ?? []).filter((a: SupportAutomation) => {
    if (filterActive === 'active') return a.is_active
    if (filterActive === 'inactive') return !a.is_active
    return true
  })

  const handleCreate = async () => {
    if (!form.name.trim()) { toast('error', 'Name is required'); return }
    try {
      await createMutation.mutateAsync(form)
      toast('success', 'Automation created')
      setShowCreate(false)
      setForm({ name: '', description: '', trigger_event: 'support.ticket.created' })
    } catch {
      toast('error', 'Failed to create automation')
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id)
      toast('success', 'Automation updated')
    } catch {
      toast('error', 'Failed to toggle automation')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete automation "${name}"?`)) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('success', 'Automation deleted')
    } catch {
      toast('error', 'Failed to delete automation')
    }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Support Automations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{(automations ?? []).length} automations configured</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Automation
          </Button>
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading automations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="mx-auto h-12 w-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          No automations found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((a: SupportAutomation) => (
            <Card key={a.id} className="flex flex-col gap-3">
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{a.name}</p>
                  {a.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>
                  )}
                </div>
                {/* Active toggle */}
                <button
                  onClick={() => handleToggle(a.id)}
                  disabled={toggleMutation.isPending}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    a.is_active ? 'bg-[#6fd943]' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  title={a.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      a.is_active ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Trigger badge */}
              <div>
                <Badge variant="info">{TRIGGER_LABEL[a.trigger_event] ?? a.trigger_event}</Badge>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700 pt-3">
                <span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{a.execution_count}</span> runs
                </span>
                <span>Last: {formatDate(a.last_executed_at)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(a.id, a.name)}
                  loading={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Automation" size="md">
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Auto-assign urgent tickets"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this automation do?"
            />
          </div>
          <Select
            label="Trigger Event"
            options={TRIGGER_OPTIONS}
            value={form.trigger_event}
            onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}
          />
          <p className="text-xs text-gray-400">You can configure conditions and actions after creation via the Automation Builder.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
