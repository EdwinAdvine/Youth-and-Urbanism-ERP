import { useState, Fragment } from 'react'
import {
  useTickets,
  useCreateTicket,
  useUpdateTicket,
  useDeleteTicket,
  type CRMTicket,
  type TicketStatus,
  type TicketPriority,
  type TicketChannel,
  type CreateTicketPayload,
} from '../../api/crm'
import { useTicketSLA } from '../../api/crm_service'
import { Button, Spinner, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']
const CHANNELS: TicketChannel[] = ['email', 'chat', 'phone', 'social', 'web_form']

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-info/10 text-info',
  in_progress: 'bg-warning/10 text-warning',
  resolved: 'bg-success/10 text-success',
  closed: 'bg-gray-100 text-gray-500',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
}

const CHANNEL_LABELS: Record<TicketChannel, string> = {
  email: 'Email',
  chat: 'Chat',
  phone: 'Phone',
  social: 'Social',
  web_form: 'Web Form',
}

// SVG icons for channels — inline, 14×14
const CHANNEL_ICONS: Record<TicketChannel, JSX.Element> = {
  email: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  chat: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  phone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.05 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16v.92z" />
    </svg>
  ),
  social: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  web_form: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  ),
}

const CHANNEL_BADGE_COLORS: Record<TicketChannel, string> = {
  email: 'bg-purple-50 text-purple-600',
  chat: 'bg-teal-50 text-teal-600',
  phone: 'bg-green-50 text-green-600',
  social: 'bg-pink-50 text-pink-600',
  web_form: 'bg-indigo-50 text-indigo-600',
}

const EMPTY_FORM: CreateTicketPayload = {
  subject: '',
  description: '',
  status: 'open',
  priority: 'medium',
  channel: 'email',
  tags: null,
  contact_id: null,
  assigned_to: null,
}

// ─── SLA Panel (rendered when a row is expanded) ──────────────────────────────

function SLAPanel({ ticketId }: { ticketId: string }) {
  const { data: sla, isLoading } = useTicketSLA(ticketId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
        <Spinner size="sm" /> Loading SLA…
      </div>
    )
  }

  if (!sla) {
    return (
      <div className="py-2 text-xs text-gray-400 italic">No SLA policy attached to this ticket.</div>
    )
  }

  const isBreached = sla.is_first_response_breached || sla.is_resolution_breached

  const formatDue = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return (
    <div className="flex flex-wrap items-start gap-4 py-3 px-1">
      {/* SLA status badge */}
      {isBreached ? (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: '#ff3a6e22', color: '#ff3a6e' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          SLA Breached
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: '#6fd94322', color: '#6fd943' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm-1 14l-4-4 1.41-1.41L11 13.17l6.59-6.58L19 8l-8 8z" />
          </svg>
          On Track
        </span>
      )}

      {/* First response due */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">First Response Due</span>
        <span
          className="text-xs font-medium"
          style={{ color: sla.is_first_response_breached ? '#ff3a6e' : '#374151' }}
        >
          {formatDue(sla.first_response_due)}
          {sla.first_response_at && (
            <span className="ml-1.5 text-gray-400 font-normal">
              (Responded {formatDue(sla.first_response_at)})
            </span>
          )}
        </span>
      </div>

      {/* Resolution due */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Resolution Due</span>
        <span
          className="text-xs font-medium"
          style={{ color: sla.is_resolution_breached ? '#ff3a6e' : '#374151' }}
        >
          {formatDue(sla.resolution_due)}
          {sla.resolution_at && (
            <span className="ml-1.5 text-gray-400 font-normal">
              (Resolved {formatDue(sla.resolution_at)})
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useTickets({ page, limit: 20, status: statusFilter, priority: priorityFilter, search })
  const createMutation = useCreateTicket()
  const updateMutation = useUpdateTicket()
  const deleteMutation = useDeleteTicket()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CRMTicket | null>(null)
  const [form, setForm] = useState<CreateTicketPayload>(EMPTY_FORM)
  // Local string for comma-separated tags input
  const [tagsInput, setTagsInput] = useState('')

  const tickets = data?.tickets ?? []
  const total = data?.total ?? 0

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setTagsInput('')
    setModalOpen(true)
  }

  const openEdit = (ticket: CRMTicket) => {
    setEditing(ticket)
    setForm({
      subject: ticket.subject,
      description: ticket.description ?? '',
      status: ticket.status,
      priority: ticket.priority,
      channel: ticket.channel ?? 'email',
      tags: ticket.tags ?? null,
      contact_id: ticket.contact_id,
      assigned_to: ticket.assigned_to,
    })
    setTagsInput(ticket.tags ? ticket.tags.join(', ') : '')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    // Parse tags from comma-separated input
    const parsedTags = tagsInput.trim()
      ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      : null

    const payload: CreateTicketPayload = { ...form, tags: parsedTags }

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Ticket updated')
      } else {
        await createMutation.mutateAsync(payload)
        toast('success', 'Ticket created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Operation failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this ticket?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('success', 'Ticket deleted')
    } catch {
      toast('error', 'Delete failed')
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CRM Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} ticket{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button onClick={openCreate}>+ New Ticket</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-64"
        />
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as TicketStatus | ''); setPage(1) }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value as TicketPriority | ''); setPage(1) }}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No tickets found. Create your first ticket to get started.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-6" />
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Channel</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Created</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const isExpanded = expandedId === ticket.id
                const channel = ticket.channel ?? 'email'

                return (
                  <Fragment key={ticket.id}>
                    <tr
                      className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 transition-colors"
                    >
                      {/* Expand toggle */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(ticket.id)}
                          className="flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={isExpanded ? 'Collapse SLA' : 'Expand SLA'}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </td>

                      {/* Subject + tags */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{ticket.subject}</div>
                        {ticket.description && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ticket.description}</div>
                        )}
                        {ticket.tags && ticket.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ticket.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium"
                                style={{ background: '#51459d18', color: '#51459d' }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Channel badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${CHANNEL_BADGE_COLORS[channel]}`}>
                          {CHANNEL_ICONS[channel]}
                          {CHANNEL_LABELS[channel]}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                          {STATUS_LABELS[ticket.status]}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(ticket)}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(ticket.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>

                    {/* SLA expanded row */}
                    {isExpanded && (
                      <tr className="bg-gray-50/70 dark:bg-gray-800/50">
                        <td />
                        <td colSpan={6} className="px-4 pb-3">
                          <div
                            className="rounded-[10px] border px-4"
                            style={{ borderColor: '#51459d33', background: '#51459d08' }}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wider mt-3 mb-1" style={{ color: '#51459d' }}>
                              SLA Status
                            </p>
                            <SLAPanel ticketId={ticket.id} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="flex items-center px-3 text-sm text-gray-500">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Ticket' : 'New Ticket'}>
        <div className="space-y-4">
          <Input
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Ticket subject"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[80px]"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <Select
                value={form.status ?? 'open'}
                onChange={(e) => setForm({ ...form, status: e.target.value as TicketStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
              <Select
                value={form.priority ?? 'medium'}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Channel</label>
            <Select
              value={form.channel ?? 'email'}
              onChange={(e) => setForm({ ...form, channel: e.target.value as TicketChannel })}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tags
              <span className="ml-1 text-xs text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. billing, urgent, enterprise"
            />
            {tagsInput.trim() && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tagsInput.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0 rounded text-xs font-medium"
                    style={{ background: '#51459d18', color: '#51459d' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Create Ticket'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
