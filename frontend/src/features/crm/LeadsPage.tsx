import { useState } from 'react'
import {
  useLeads,
  useCreateLead,
  useUpdateLead,
  useConvertLead,
  useDeleteLead,
  useContacts,
  type Lead,
  type LeadStatus,
  type CreateLeadPayload,
} from '../../api/crm'
import { cn, Button, Spinner, Modal, Input, Badge, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import LeadCaptureFormDialog from './LeadCaptureFormDialog'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'unqualified', 'converted']

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  converted: 'Converted',
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'border-t-info',
  contacted: 'border-t-primary',
  qualified: 'border-t-success',
  unqualified: 'border-t-danger',
  converted: 'border-t-warning',
}

const STATUS_BG: Record<LeadStatus, string> = {
  new: 'bg-info/5',
  contacted: 'bg-primary/5',
  qualified: 'bg-green-50',
  unqualified: 'bg-red-50',
  converted: 'bg-orange-50',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

const EMPTY_FORM: CreateLeadPayload = {
  title: '',
  contact_id: '',
  status: 'new',
  source: '',
  estimated_value: null,
  notes: '',
}

export default function LeadsPage() {
  const { data, isLoading } = useLeads({ page: 1, limit: 200 })
  const { data: contactsData } = useContacts({ page: 1, limit: 200 })
  const createMutation = useCreateLead()
  const updateMutation = useUpdateLead()
  const convertMutation = useConvertLead()
  const deleteMutation = useDeleteLead()
  const [modalOpen, setModalOpen] = useState(false)
  const [leadCaptureOpen, setLeadCaptureOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState<CreateLeadPayload>(EMPTY_FORM)

  const leads = data?.items ?? []
  const contacts = contactsData?.items ?? []

  // Group leads by status for kanban
  const grouped: Record<LeadStatus, Lead[]> = {
    new: [],
    contacted: [],
    qualified: [],
    unqualified: [],
    converted: [],
  }
  leads.forEach((lead) => {
    if (grouped[lead.status]) {
      grouped[lead.status].push(lead)
    }
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (lead: Lead) => {
    setEditing(lead)
    setForm({
      title: lead.title,
      contact_id: lead.contact_id,
      status: lead.status,
      source: lead.source ?? '',
      estimated_value: lead.estimated_value,
      notes: lead.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        const { contact_id, ...rest } = form
        await updateMutation.mutateAsync({ id: editing.id, ...rest })
        toast('success', 'Lead updated')
      } else {
        await createMutation.mutateAsync(form)
        toast('success', 'Lead created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save lead')
    }
  }

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(`Delete lead "${lead.title}"? This cannot be undone.`)) return
    try {
      await deleteMutation.mutateAsync(lead.id)
      toast('success', 'Lead deleted')
    } catch {
      toast('error', 'Failed to delete lead')
    }
  }

  const handleConvert = async (lead: Lead) => {
    if (!window.confirm(`Convert "${lead.title}" to an opportunity?`)) return
    try {
      await convertMutation.mutateAsync(lead.id)
      toast('success', 'Lead converted to opportunity')
    } catch {
      toast('error', 'Failed to convert lead')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage sales leads</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setLeadCaptureOpen(true)}>Create Lead Capture Form</Button>
          <Button onClick={openCreate}>+ New Lead</Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((status) => (
          <div key={status} className="flex-shrink-0 w-72">
            {/* Column Header */}
            <div
              className={cn(
                'rounded-t-[10px] border-t-4 px-4 py-3 flex items-center justify-between',
                STATUS_COLORS[status],
                STATUS_BG[status]
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{STATUS_LABELS[status]}</span>
                <span className="text-xs bg-gray-200 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5">
                  {grouped[status].length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-2 mt-2 min-h-[200px]">
              {grouped[status].length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
                  No leads
                </div>
              ) : (
                grouped[status].map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => openEdit(lead)}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 leading-tight">{lead.title}</h3>
                    </div>
                    {lead.contact_name && (
                      <p className="text-xs text-gray-500 mt-1">{lead.contact_name}</p>
                    )}
                    {lead.estimated_value != null && (
                      <p className="text-sm font-semibold text-primary mt-2">
                        {formatCurrency(lead.estimated_value)}
                      </p>
                    )}
                    {lead.source && (
                      <Badge variant="default" className="mt-2">
                        {lead.source}
                      </Badge>
                    )}

                    {/* Delete button */}
                    <button
                      className="text-xs text-[#ff3a6e] hover:underline mt-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(lead)
                      }}
                    >
                      Delete
                    </button>

                    {/* Convert button for qualified leads */}
                    {status === 'qualified' && (
                      <Button
                        size="sm"
                        className="w-full mt-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConvert(lead)
                        }}
                        loading={convertMutation.isPending}
                      >
                        Convert to Opportunity
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Lead' : 'New Lead'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          {!editing && (
            <Select
              label="Contact"
              options={[
                { value: '', label: 'Select a contact...' },
                ...contacts.map((c) => ({ value: c.id, label: `${c.name} (${c.email})` })),
              ]}
              value={form.contact_id}
              onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              value={form.status ?? 'new'}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LeadStatus }))}
            />
            <Input
              label="Source"
              placeholder="e.g. Website, Referral..."
              value={form.source ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            />
          </div>
          <Input
            label="Estimated Value"
            type="number"
            min={0}
            step="0.01"
            value={form.estimated_value ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                estimated_value: e.target.value ? parseFloat(e.target.value) : null,
              }))
            }
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save Changes' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lead Capture Form Dialog */}
      <LeadCaptureFormDialog
        open={leadCaptureOpen}
        onClose={() => setLeadCaptureOpen(false)}
      />
    </div>
  )
}
