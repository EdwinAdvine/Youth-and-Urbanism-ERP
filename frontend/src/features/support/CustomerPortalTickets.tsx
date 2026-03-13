import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// Portal API uses X-Portal-Token header instead of Bearer
const portalApi = axios.create({ baseURL: '/api/v1/support' })
portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token')
  if (token) config.headers['X-Portal-Token'] = token
  return config
})

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-[#3ec9d6]/10 text-[#3ec9d6] border border-[#3ec9d6]/20' },
  in_progress: { label: 'In Progress', className: 'bg-[#ffa21d]/10 text-[#ffa21d] border border-[#ffa21d]/20' },
  waiting_on_customer: { label: 'Waiting on You', className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600' },
  resolved: { label: 'Resolved', className: 'bg-[#6fd943]/10 text-[#6fd943] border border-[#6fd943]/20' },
  closed: { label: 'Closed', className: 'bg-[#51459d]/10 text-[#51459d] border border-[#51459d]/20' },
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-[#3ec9d6]',
  high: 'text-[#ffa21d]',
  urgent: 'text-[#ff3a6e]',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface PortalTicket {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  category_name?: string | null
}

export default function CustomerPortalTickets() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const customerName = localStorage.getItem('portal_customer_name') ?? 'Customer'

  const { data, isLoading } = useQuery<{ tickets: PortalTicket[]; total: number }>({
    queryKey: ['portal', 'tickets'],
    queryFn: () => portalApi.get('/portal/tickets').then((r) => r.data),
  })

  const createTicket = useMutation({
    mutationFn: (payload: { subject: string; description: string; priority: string }) =>
      portalApi.post('/portal/tickets', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'tickets'] }),
  })

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium' })
  const [formError, setFormError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const tickets = (data?.tickets ?? []).filter((t) =>
    statusFilter ? t.status === statusFilter : true,
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim()) { setFormError('Subject is required'); return }
    setFormError('')
    try {
      await createTicket.mutateAsync(form)
      setShowCreate(false)
      setForm({ subject: '', description: '', priority: 'medium' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to create ticket'
      setFormError(msg)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('portal_token')
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_customer_name')
    navigate('/portal/login')
  }

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
      style={{ fontFamily: 'Open Sans, sans-serif' }}
    >
      {/* Portal Header */}
      <header className="bg-[#51459d] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="font-semibold">Customer Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-80">{customerName}</span>
          <button
            onClick={handleLogout}
            className="text-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Support Tickets</h1>
            <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} tickets submitted</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-[10px] bg-[#51459d] hover:bg-[#453990] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { value: '', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#51459d] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-[#51459d]/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tickets List */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading your tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 font-medium">No tickets found</p>
            <p className="text-sm text-gray-400 mt-1">Submit a new ticket to get support</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket: PortalTicket) => {
              const badge = STATUS_BADGE[ticket.status] ?? { label: ticket.status, className: 'bg-gray-100 text-gray-500 border border-gray-200' }
              return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/portal/tickets/${ticket.id}`)}
                  className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:border-[#51459d]/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                        {ticket.category_name && (
                          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {ticket.category_name}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Created {formatDate(ticket.created_at)} · Updated {formatDate(ticket.updated_at)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className={`text-xs font-medium capitalize ${PRIORITY_BADGE[ticket.priority] ?? 'text-gray-400'}`}>
                        {ticket.priority}
                      </span>
                      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Create Ticket Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Submit New Ticket</h2>
              <button
                onClick={() => { setShowCreate(false); setFormError('') }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Brief summary of your issue"
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Please describe your issue in detail..."
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] min-h-[100px]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              {formError && (
                <p className="text-xs text-[#ff3a6e]">{formError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setFormError('') }}
                  className="px-4 py-2 rounded-[10px] text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTicket.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold text-white bg-[#51459d] hover:bg-[#453990] transition-colors disabled:opacity-60"
                >
                  {createTicket.isPending ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Submit Ticket'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
