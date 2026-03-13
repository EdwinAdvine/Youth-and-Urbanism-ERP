import { useState, useEffect } from 'react'
import apiClient from '@/api/client'

type ApprovalStatus = 'pending' | 'approved' | 'rejected'
type FilterTab = 'all' | ApprovalStatus

interface QueueResponse {
  id: string
  form_id: string
  excerpt: Record<string, unknown>  // first 3 field answers
  submitted_at: string
  status: ApprovalStatus
  respondent_name?: string
}

interface ResponseApprovalQueueProps {
  formId: string
}

const STATUS_COLORS: Record<ApprovalStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: '#ffa21d', text: '#7a4800', label: 'Pending' },
  approved: { bg: '#6fd943', text: '#2e6b0f', label: 'Approved' },
  rejected: { bg: '#ff3a6e', text: '#fff', label: 'Rejected' },
}

export default function ResponseApprovalQueue({ formId }: ResponseApprovalQueueProps) {
  const [responses, setResponses] = useState<QueueResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [actingId, setActingId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})

  async function fetchQueue() {
    setLoading(true)
    try {
      const res = await apiClient.get<{ responses: QueueResponse[] }>(
        `/forms/${formId}/approval-queue`
      )
      setResponses(res.data.responses ?? [])
    } catch {
      setResponses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (formId) fetchQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId])

  async function handleAction(responseId: string, status: 'approved' | 'rejected') {
    setActingId(responseId)
    try {
      await apiClient.post(`/forms/responses/${responseId}/approve`, {
        status,
        comment: comments[responseId] ?? '',
      })
      setResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, status } : r))
      )
      setShowComments((prev) => ({ ...prev, [responseId]: false }))
    } catch {
      // ignore
    } finally {
      setActingId(null)
    }
  }

  const filtered = responses.filter(
    (r) => filter === 'all' || r.status === filter
  )

  const counts: Record<FilterTab, number> = {
    all: responses.length,
    pending: responses.filter((r) => r.status === 'pending').length,
    approved: responses.filter((r) => r.status === 'approved').length,
    rejected: responses.filter((r) => r.status === 'rejected').length,
  }

  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="space-y-4" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === tab.value
                ? 'border-[#51459d] text-[#51459d]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {counts[tab.value] > 0 && (
              <span
                className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-white"
                style={{
                  backgroundColor:
                    tab.value === 'pending'
                      ? '#ffa21d'
                      : tab.value === 'approved'
                      ? '#6fd943'
                      : tab.value === 'rejected'
                      ? '#ff3a6e'
                      : '#51459d',
                }}
              >
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div
            className="h-7 w-7 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#51459d', borderTopColor: 'transparent' }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-2xl">
            📋
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            No responses awaiting approval
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {filter !== 'all'
              ? `No ${filter} responses to display.`
              : 'Submitted responses requiring approval will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((resp) => {
            const excerptEntries = Object.entries(resp.excerpt ?? {}).slice(0, 3)
            const statusColor = STATUS_COLORS[resp.status]
            const isCommentOpen = showComments[resp.id]

            return (
              <div
                key={resp.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] p-4 space-y-3"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {resp.id.slice(0, 8)}…
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                      >
                        {statusColor.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(resp.submitted_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {resp.respondent_name && (
                        <span className="ml-2 text-gray-500 dark:text-gray-400">
                          · {resp.respondent_name}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Excerpt */}
                {excerptEntries.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {excerptEntries.map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-[6px] px-3 py-2"
                      >
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
                          {key}
                        </p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                          {String(val ?? '—')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions — only for pending */}
                {resp.status === 'pending' && (
                  <div className="space-y-2">
                    {isCommentOpen && (
                      <textarea
                        rows={2}
                        placeholder="Optional comment…"
                        value={comments[resp.id] ?? ''}
                        onChange={(e) =>
                          setComments((prev) => ({ ...prev, [resp.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#51459d] resize-none"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actingId === resp.id}
                        onClick={() => handleAction(resp.id, 'approved')}
                        className="px-3 py-1.5 text-xs font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#6fd943' }}
                      >
                        {actingId === resp.id ? '…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={actingId === resp.id}
                        onClick={() => handleAction(resp.id, 'rejected')}
                        className="px-3 py-1.5 text-xs font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#ff3a6e' }}
                      >
                        {actingId === resp.id ? '…' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowComments((prev) => ({ ...prev, [resp.id]: !prev[resp.id] }))
                        }
                        className="ml-auto text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {isCommentOpen ? 'Hide comment' : 'Add comment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
