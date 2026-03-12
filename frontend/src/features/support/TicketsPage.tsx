import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Select, Pagination, toast,
} from '../../components/ui'
import {
  useTickets, useCreateTicket, useTicketCategories,
  type Ticket, type CreateTicketPayload,
} from '../../api/support'
import { useSavedViews, useTicketTemplates } from '../../api/support_phase1'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  open: 'info',
  in_progress: 'warning',
  waiting_on_customer: 'default',
  waiting_on_internal: 'default',
  resolved: 'success',
  closed: 'primary',
}

const PRIORITY_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_customer', label: 'Waiting on Customer' },
  { value: 'waiting_on_internal', label: 'Waiting on Internal' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function TicketsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1')
  const [form, setForm] = useState<CreateTicketPayload>({
    subject: '',
    description: '',
    priority: 'medium',
    customer_name: '',
    customer_email: '',
  })

  const { data, isLoading } = useTickets({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    search: search || undefined,
    page,
    limit,
  })
  const { data: categories } = useTicketCategories()
  const createMutation = useCreateTicket()
  const { data: savedViews } = useSavedViews()
  const { data: templates } = useTicketTemplates()

  const totalPages = Math.ceil((data?.total ?? 0) / limit)

  const handleCreate = async () => {
    if (!form.subject.trim()) {
      toast('error', 'Subject is required')
      return
    }
    try {
      const ticket = await createMutation.mutateAsync(form)
      toast('success', `Ticket ${ticket.ticket_number} created`)
      setShowCreate(false)
      setForm({ subject: '', description: '', priority: 'medium', customer_name: '', customer_email: '' })
      // Remove create param from URL
      searchParams.delete('create')
      setSearchParams(searchParams)
    } catch {
      toast('error', 'Failed to create ticket')
    }
  }

  const columns = [
    {
      key: 'ticket_number',
      label: 'Ticket #',
      render: (row: Ticket) => (
        <button
          className="text-primary font-medium hover:underline"
          onClick={() => navigate(`/support/tickets/${row.id}`)}
        >
          {row.ticket_number}
        </button>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (row: Ticket) => (
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[280px] block">{row.subject}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Ticket) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: Ticket) => (
        <Badge variant={PRIORITY_BADGE[row.priority] ?? 'default'}>{row.priority}</Badge>
      ),
    },
    {
      key: 'category_name',
      label: 'Category',
      render: (row: Ticket) => <span className="text-gray-500">{row.category_name || '-'}</span>,
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: Ticket) => <span className="text-gray-600 dark:text-gray-400">{row.customer_name || row.customer_email || '-'}</span>,
    },
    {
      key: 'assignee_name',
      label: 'Assigned To',
      render: (row: Ticket) => <span className="text-gray-600 dark:text-gray-400">{row.assignee_name || 'Unassigned'}</span>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: Ticket) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'sla',
      label: 'SLA',
      render: (row: Ticket) => (
        <>
          {(row.sla_response_breached || row.sla_resolution_breached) ? (
            <Badge variant="danger">Breached</Badge>
          ) : row.sla_response_due ? (
            <Badge variant="success">On Track</Badge>
          ) : null}
        </>
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total tickets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/support')} className="min-h-[44px] sm:min-h-0">
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)} className="min-h-[44px] sm:min-h-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </Button>
        </div>
      </div>

      {/* Saved Views & Templates */}
      {((savedViews && savedViews.length > 0) || (templates && templates.length > 0)) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {savedViews && savedViews.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Views:</span>
              {savedViews.map((v: { id: string; name: string }) => (
                <Button
                  key={v.id}
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/support/tickets?view=${v.id}`)}
                >
                  {v.name}
                </Button>
              ))}
            </div>
          )}
          {templates && templates.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Quick Create:</span>
              {templates.filter((t: { is_active: boolean }) => t.is_active).slice(0, 3).map((t: { id: string; name: string }) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreate(true)
                    // Template pre-fill will be handled by the create modal
                  }}
                >
                  {t.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <Card className="mb-5 sm:mb-6">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-0 sm:min-w-[200px]">
            <Input
              label="Search"
              placeholder="Ticket #, subject, customer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <Table<Ticket>
            columns={columns}
            data={data?.tickets ?? []}
            loading={isLoading}
            emptyText="No tickets found"
            keyExtractor={(row) => row.id}
          />
        </div>
        {totalPages > 1 && (
          <Pagination
            page={page}
            pages={totalPages}
            total={data?.total ?? 0}
            onChange={setPage}
          />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Ticket" size="lg">
        <div className="space-y-4">
          <Input
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Brief summary of the issue"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[100px]"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description of the issue..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Priority"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
              value={form.priority || 'medium'}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
            <Select
              label="Category"
              options={[
                { value: '', label: 'Select category...' },
                ...(categories || []).map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={form.category_id || ''}
              onChange={(e) => setForm({ ...form, category_id: e.target.value || undefined })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Customer Name"
              value={form.customer_name || ''}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="John Doe"
            />
            <Input
              label="Customer Email"
              type="email"
              value={form.customer_email || ''}
              onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending}>Create Ticket</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
