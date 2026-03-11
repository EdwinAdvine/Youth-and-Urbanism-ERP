import { useState } from 'react'
import {
  useSLAPolicies,
  useCreateSLAPolicy,
  useUpdateSLAPolicy,
  useDeleteSLAPolicy,
  type SLAPolicy,
  type SLAPolicyCreatePayload,
} from '@/api/crm_service'
import { Button, Spinner, Modal, Input, Select, toast } from '@/components/ui'

type Priority = 'urgent' | 'high' | 'medium' | 'low'

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'bg-[#ff3a6e]/10 text-[#ff3a6e]',
  high: 'bg-[#ffa21d]/10 text-[#ffa21d]',
  medium: 'bg-[#3ec9d6]/10 text-[#3ec9d6]',
  low: 'bg-gray-100 text-gray-500',
}

const PRIORITY_CARD_BORDERS: Record<Priority, string> = {
  urgent: 'border-l-[#ff3a6e]',
  high: 'border-l-[#ffa21d]',
  medium: 'border-l-[#3ec9d6]',
  low: 'border-l-gray-300',
}

const EMPTY_FORM: SLAPolicyCreatePayload = {
  name: '',
  description: '',
  priority: 'medium',
  first_response_hours: 4,
  resolution_hours: 24,
  business_hours_only: true,
  is_active: true,
}

export default function SLAPoliciesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SLAPolicy | null>(null)
  const [form, setForm] = useState<SLAPolicyCreatePayload>(EMPTY_FORM)

  const { data: policiesData, isLoading } = useSLAPolicies()
  const policies: SLAPolicy[] = policiesData?.policies ?? policiesData ?? []

  const createMutation = useCreateSLAPolicy()
  const updateMutation = useUpdateSLAPolicy()
  const deleteMutation = useDeleteSLAPolicy()

  // Count policies by priority
  const priorityCounts = PRIORITIES.reduce((acc, p) => {
    acc[p] = policies.filter((pol) => pol.priority === p).length
    return acc
  }, {} as Record<Priority, number>)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (policy: SLAPolicy) => {
    setEditing(policy)
    setForm({
      name: policy.name,
      description: policy.description ?? '',
      priority: policy.priority,
      first_response_hours: policy.first_response_hours,
      resolution_hours: policy.resolution_hours,
      business_hours_only: policy.business_hours_only,
      is_active: policy.is_active,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast('success', 'SLA policy updated')
      } else {
        await createMutation.mutateAsync(form)
        toast('success', 'SLA policy created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Operation failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this SLA policy?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('success', 'SLA policy deleted')
    } catch {
      toast('error', 'Delete failed')
    }
  }

  const handleToggleActive = async (policy: SLAPolicy) => {
    try {
      await updateMutation.mutateAsync({ id: policy.id, is_active: !policy.is_active })
      toast('success', `Policy ${policy.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Toggle failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SLA Policies</h1>
          <p className="text-sm text-gray-500 mt-1">
            {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'} configured
          </p>
        </div>
        <Button onClick={openCreate}>+ New Policy</Button>
      </div>

      {/* Priority Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PRIORITIES.map((p) => (
          <div
            key={p}
            className={`bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 border-l-4 ${PRIORITY_CARD_BORDERS[p]} p-4`}
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[p]}`}>
                {PRIORITY_LABELS[p]}
              </span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {priorityCounts[p]}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {priorityCounts[p] === 1 ? 'policy' : 'policies'}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No SLA policies found. Create your first policy to get started.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">First Response</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Resolution</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Business Hours</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Active</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{policy.name}</div>
                    {policy.description && (
                      <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{policy.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[policy.priority as Priority] ?? PRIORITY_COLORS.medium}`}>
                      {PRIORITY_LABELS[policy.priority as Priority] ?? policy.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {policy.first_response_hours}h
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {policy.resolution_hours}h
                  </td>
                  <td className="px-4 py-3">
                    {policy.business_hours_only ? (
                      <span className="text-xs text-[#3ec9d6] font-medium">Business hours</span>
                    ) : (
                      <span className="text-xs text-gray-400">24/7</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(policy)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#51459d]/40 ${
                        policy.is_active ? 'bg-[#6fd943]' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={policy.is_active}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          policy.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(policy)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-[#ff3a6e]" onClick={() => handleDelete(policy.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit SLA Policy' : 'New SLA Policy'}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Premium Support SLA"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/40 min-h-[60px]"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe this SLA policy..."
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Response (hours)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/40"
                value={form.first_response_hours}
                onChange={(e) => setForm({ ...form, first_response_hours: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Resolution (hours)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/40"
                value={form.resolution_hours}
                onChange={(e) => setForm({ ...form, resolution_hours: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.business_hours_only ?? true}
                onChange={(e) => setForm({ ...form, business_hours_only: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]/40"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Business hours only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]/40"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Create Policy'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
