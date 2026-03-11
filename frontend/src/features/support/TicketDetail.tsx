import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  cn, Button, Spinner, Badge, Card, Modal, Input, toast,
} from '../../components/ui'
import {
  useTicketDetail, useAddComment, useUpdateComment, useDeleteComment,
  useResolveTicket, useCloseTicket, useReopenTicket,
  type TicketComment,
} from '../../api/support'
import {
  useTicketLinkedContact, useLinkTicketToContact, useEscalateTicketToTask,
} from '../../api/cross_module_links'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
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

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ticket, isLoading } = useTicketDetail(id || '')

  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const addCommentMut = useAddComment()
  const updateCommentMut = useUpdateComment()
  const deleteCommentMut = useDeleteComment()
  const resolveMut = useResolveTicket()
  const closeMut = useCloseTicket()
  const reopenMut = useReopenTicket()

  // Cross-module link hooks
  const { data: linkedContact } = useTicketLinkedContact(id || '')
  const linkContactMut = useLinkTicketToContact()
  const escalateMut = useEscalateTicketToTask()
  const [linkContactOpen, setLinkContactOpen] = useState(false)
  const [contactIdInput, setContactIdInput] = useState('')
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [projectIdInput, setProjectIdInput] = useState('')
  const [escalatePriority, setEscalatePriority] = useState('medium')

  if (isLoading || !ticket) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const handleAddComment = async () => {
    if (!comment.trim()) {
      toast('error', 'Comment cannot be empty')
      return
    }
    try {
      await addCommentMut.mutateAsync({
        ticketId: ticket.id,
        content: comment,
        is_internal: isInternal,
      })
      setComment('')
      toast('success', 'Comment added')
    } catch {
      toast('error', 'Failed to add comment')
    }
  }

  const handleResolve = async () => {
    try {
      await resolveMut.mutateAsync(ticket.id)
      toast('success', 'Ticket resolved')
    } catch {
      toast('error', 'Failed to resolve ticket')
    }
  }

  const handleClose = async () => {
    try {
      await closeMut.mutateAsync(ticket.id)
      toast('success', 'Ticket closed')
    } catch {
      toast('error', 'Failed to close ticket')
    }
  }

  const handleReopen = async () => {
    try {
      await reopenMut.mutateAsync(ticket.id)
      toast('success', 'Ticket reopened')
    } catch {
      toast('error', 'Failed to reopen ticket')
    }
  }

  const isOpenOrInProgress = ['open', 'in_progress', 'waiting_on_customer', 'waiting_on_internal'].includes(ticket.status)
  const canResolve = isOpenOrInProgress
  const canClose = ticket.status !== 'closed'
  const canReopen = ticket.status === 'resolved' || ticket.status === 'closed'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back + Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/support/tickets')}
          className="text-sm text-gray-500 hover:text-primary transition-colors mb-3 flex items-center gap-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tickets
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-gray-400">{ticket.ticket_number}</span>
              <Badge variant={STATUS_BADGE[ticket.status] ?? 'default'}>
                {ticket.status.replace(/_/g, ' ')}
              </Badge>
              <Badge variant={PRIORITY_BADGE[ticket.priority] ?? 'default'}>
                {ticket.priority}
              </Badge>
              {(ticket.sla_response_breached || ticket.sla_resolution_breached) && (
                <Badge variant="danger">SLA Breached</Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{ticket.subject}</h1>
          </div>

          {/* Workflow Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {canResolve && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResolve}
                loading={resolveMut.isPending}
              >
                Resolve
              </Button>
            )}
            {canClose && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClose}
                loading={closeMut.isPending}
              >
                Close
              </Button>
            )}
            {canReopen && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReopen}
                loading={reopenMut.isPending}
              >
                Reopen
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content: description + comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {ticket.description && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{ticket.description}</p>
            </Card>
          )}

          {/* Comment Timeline */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Comments ({ticket.comments?.length ?? 0})
            </h3>

            {(ticket.comments?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No comments yet</p>
            ) : (
              <div className="space-y-4 mb-6">
                {ticket.comments.map((c: TicketComment) => (
                  <div
                    key={c.id}
                    className={cn(
                      'rounded-[10px] p-4 border',
                      c.is_internal
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-100'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {(c.author_name || 'U')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {c.author_name || 'Unknown'}
                        </span>
                        {c.is_internal && (
                          <Badge variant="warning" className="text-[10px]">Internal</Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[60px]"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            loading={updateCommentMut.isPending}
                            onClick={async () => {
                              try {
                                await updateCommentMut.mutateAsync({
                                  ticketId: ticket.id,
                                  commentId: c.id,
                                  content: editingContent,
                                })
                                setEditingCommentId(null)
                                toast('success', 'Comment updated')
                              } catch {
                                toast('error', 'Failed to update comment')
                              }
                            }}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingCommentId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{c.content}</p>
                        <div className="flex gap-2 mt-2">
                          <button
                            className="text-xs text-primary hover:underline"
                            onClick={() => {
                              setEditingCommentId(c.id)
                              setEditingContent(c.content)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs text-[#ff3a6e] hover:underline"
                            onClick={async () => {
                              if (!window.confirm('Delete this comment?')) return
                              try {
                                await deleteCommentMut.mutateAsync({
                                  ticketId: ticket.id,
                                  commentId: c.id,
                                })
                                toast('success', 'Comment deleted')
                              } catch {
                                toast('error', 'Failed to delete comment')
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <textarea
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[80px]"
                placeholder="Write a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Internal note (not visible to customer)
                </label>
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  loading={addCommentMut.isPending}
                >
                  Add Comment
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar: ticket metadata */}
        <div className="space-y-6">
          {/* Details card */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Status</dt>
                <dd className="mt-0.5">
                  <Badge variant={STATUS_BADGE[ticket.status] ?? 'default'}>
                    {ticket.status.replace(/_/g, ' ')}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Priority</dt>
                <dd className="mt-0.5">
                  <Badge variant={PRIORITY_BADGE[ticket.priority] ?? 'default'}>{ticket.priority}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Category</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{ticket.category_name || 'Uncategorized'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Assigned To</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{ticket.assignee_name || 'Unassigned'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Created By</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{ticket.creator_name || '-'}</dd>
              </div>
              {ticket.tags && ticket.tags.length > 0 && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Tags</dt>
                  <dd className="flex flex-wrap gap-1 mt-1">
                    {ticket.tags.map((tag) => (
                      <Badge key={tag} variant="default">{tag}</Badge>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Customer card */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Customer</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Name</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{ticket.customer_name || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Email</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                  {ticket.customer_email ? (
                    <a href={`mailto:${ticket.customer_email}`} className="text-primary hover:underline">
                      {ticket.customer_email}
                    </a>
                  ) : '-'}
                </dd>
              </div>
            </dl>
          </Card>

          {/* CRM Link card */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">CRM Contact</h3>
            {linkedContact?.contact ? (
              <dl className="space-y-2">
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {linkedContact.contact.first_name || ''} {linkedContact.contact.last_name || linkedContact.contact.company_name || 'Unnamed'}
                </dd>
                {linkedContact.contact.email && (
                  <dd className="text-sm text-gray-500">{linkedContact.contact.email}</dd>
                )}
                <dd>
                  <Badge variant="success">Linked</Badge>
                </dd>
              </dl>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">No CRM contact linked</p>
                <Button size="sm" variant="outline" onClick={() => setLinkContactOpen(true)}>
                  Link to CRM Contact
                </Button>
              </div>
            )}
          </Card>

          {/* Escalate to Project Task */}
          {isOpenOrInProgress && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Escalate</h3>
              <Button size="sm" variant="outline" onClick={() => setEscalateOpen(true)}>
                Escalate to Project Task
              </Button>
            </Card>
          )}

          {/* SLA card */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">SLA</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Response Due</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                  {ticket.sla_response_due ? formatDate(ticket.sla_response_due) : 'N/A'}
                  {ticket.sla_response_breached && (
                    <Badge variant="danger" className="ml-2">Breached</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Resolution Due</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                  {ticket.sla_resolution_due ? formatDate(ticket.sla_resolution_due) : 'N/A'}
                  {ticket.sla_resolution_breached && (
                    <Badge variant="danger" className="ml-2">Breached</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">First Response</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                  {ticket.first_response_at ? formatDate(ticket.first_response_at) : 'Awaiting'}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Timestamps card */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Timestamps</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Created</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{formatDate(ticket.created_at)}</dd>
              </div>
              {ticket.resolved_at && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Resolved</dt>
                  <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{formatDate(ticket.resolved_at)}</dd>
                </div>
              )}
              {ticket.closed_at && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Closed</dt>
                  <dd className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{formatDate(ticket.closed_at)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
      {/* Link Contact Modal */}
      <Modal open={linkContactOpen} onClose={() => setLinkContactOpen(false)} title="Link to CRM Contact" size="sm">
        <div className="space-y-4">
          <Input
            label="CRM Contact ID"
            placeholder="Paste the contact UUID"
            value={contactIdInput}
            onChange={(e) => setContactIdInput(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLinkContactOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              loading={linkContactMut.isPending}
              onClick={async () => {
                if (!contactIdInput.trim()) { toast('warning', 'Enter a contact ID'); return }
                try {
                  await linkContactMut.mutateAsync({ ticketId: id!, contactId: contactIdInput.trim() })
                  toast('success', 'Contact linked to ticket')
                  setLinkContactOpen(false)
                  setContactIdInput('')
                } catch {
                  toast('error', 'Failed to link contact')
                }
              }}
            >
              Link Contact
            </Button>
          </div>
        </div>
      </Modal>

      {/* Escalate to Task Modal */}
      <Modal open={escalateOpen} onClose={() => setEscalateOpen(false)} title="Escalate to Project Task" size="sm">
        <div className="space-y-4">
          <Input
            label="Project ID"
            placeholder="Paste the project UUID"
            value={projectIdInput}
            onChange={(e) => setProjectIdInput(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
            <select
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={escalatePriority}
              onChange={(e) => setEscalatePriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEscalateOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              loading={escalateMut.isPending}
              onClick={async () => {
                if (!projectIdInput.trim()) { toast('warning', 'Enter a project ID'); return }
                try {
                  await escalateMut.mutateAsync({ ticketId: id!, projectId: projectIdInput.trim(), priority: escalatePriority })
                  toast('success', 'Ticket escalated to project task')
                  setEscalateOpen(false)
                  setProjectIdInput('')
                } catch {
                  toast('error', 'Failed to escalate ticket')
                }
              }}
            >
              Escalate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
