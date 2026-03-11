import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useLaunchCampaign,
  type Campaign,
  type CreateCampaignPayload,
  type CampaignStatus,
  type CampaignType,
} from '../../api/crm'

const statusVariant: Record<CampaignStatus, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  draft: 'default',
  scheduled: 'info',
  active: 'success',
  paused: 'warning',
  completed: 'primary',
  cancelled: 'danger',
}

const defaultForm: CreateCampaignPayload = {
  name: '',
  description: '',
  campaign_type: 'email',
  status: 'draft',
  start_date: '',
  end_date: '',
  budget: undefined,
  target_audience: '',
}

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('')
  const { data: campaigns, isLoading } = useCampaigns({ status: statusFilter || undefined })
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const deleteCampaign = useDeleteCampaign()
  const launchCampaign = useLaunchCampaign()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [form, setForm] = useState<CreateCampaignPayload>(defaultForm)

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(c: Campaign) {
    setEditing(c)
    setForm({
      name: c.name,
      description: c.description ?? '',
      campaign_type: c.campaign_type,
      status: c.status,
      start_date: c.start_date?.slice(0, 10) ?? '',
      end_date: c.end_date?.slice(0, 10) ?? '',
      budget: c.budget ?? undefined,
      target_audience: c.target_audience ?? '',
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updateCampaign.mutate(
        { id: editing.id, ...form },
        {
          onSuccess: () => { toast('success', 'Campaign updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update campaign'),
        }
      )
    } else {
      createCampaign.mutate(form, {
        onSuccess: () => { toast('success', 'Campaign created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create campaign'),
      })
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this campaign?')) return
    deleteCampaign.mutate(id, {
      onSuccess: () => toast('success', 'Campaign deleted'),
      onError: () => toast('error', 'Failed to delete campaign'),
    })
  }

  function handleLaunch(id: string) {
    if (!window.confirm('Launch this campaign?')) return
    launchCampaign.mutate(id, {
      onSuccess: () => toast('success', 'Campaign launched'),
      onError: () => toast('error', 'Failed to launch campaign'),
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Campaign',
      render: (c: Campaign) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
          {c.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{c.description}</p>}
        </div>
      ),
    },
    {
      key: 'campaign_type',
      label: 'Type',
      render: (c: Campaign) => <Badge variant="primary">{c.campaign_type}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (c: Campaign) => <Badge variant={statusVariant[c.status]}>{c.status}</Badge>,
    },
    {
      key: 'contact_count',
      label: 'Contacts',
      render: (c: Campaign) => <Badge variant="default">{c.contact_count}</Badge>,
    },
    {
      key: 'budget',
      label: 'Budget',
      render: (c: Campaign) => c.budget != null ? `$${c.budget.toLocaleString()}` : '-',
    },
    {
      key: 'dates',
      label: 'Dates',
      render: (c: Campaign) => {
        if (!c.start_date) return '-'
        return `${new Date(c.start_date).toLocaleDateString()}${c.end_date ? ` - ${new Date(c.end_date).toLocaleDateString()}` : ''}`
      },
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (c: Campaign) => (
        <div className="flex items-center justify-end gap-2">
          {c.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={() => handleLaunch(c.id)}>Launch</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(c.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Manage marketing campaigns</p>
        </div>
        <Button onClick={openCreate}>Create Campaign</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={campaigns ?? []}
          keyExtractor={(c) => c.id}
          emptyText="No campaigns found. Create one to get started."
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Campaign' : 'Create Campaign'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              options={[
                { value: 'email', label: 'Email' },
                { value: 'sms', label: 'SMS' },
                { value: 'social', label: 'Social Media' },
                { value: 'event', label: 'Event' },
                { value: 'other', label: 'Other' },
              ]}
              value={form.campaign_type}
              onChange={(e) => setForm((p) => ({ ...p, campaign_type: e.target.value as CampaignType }))}
            />
            <Input
              label="Budget ($)"
              type="number"
              step="0.01"
              value={form.budget ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={form.start_date ?? ''} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            <Input label="End Date" type="date" value={form.end_date ?? ''} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
          </div>
          <Input
            label="Target Audience"
            placeholder="e.g., Enterprise customers, Newsletter subscribers"
            value={form.target_audience ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, target_audience: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createCampaign.isPending || updateCampaign.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
