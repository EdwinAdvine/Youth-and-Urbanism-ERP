import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge } from '../../../components/ui'
import { toast } from '../../../components/ui'
import {
  usePendingApprovals,
  useCompletedApprovals,
  useDecideApproval,
  type WorkflowApproval,
} from '../../../api/hr_phase3'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function PendingApprovalCard({ approval }: { approval: WorkflowApproval }) {
  const navigate = useNavigate()
  const decide = useDecideApproval()

  const [showApproveNote, setShowApproveNote] = useState(false)
  const [showRejectNote, setShowRejectNote] = useState(false)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  function handleDecide(decision: 'approved' | 'rejected', note: string) {
    decide.mutate(
      { id: approval.id, decision, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast('success', decision === 'approved' ? 'Approval granted' : 'Request rejected')
          setShowApproveNote(false)
          setShowRejectNote(false)
          setApproveNote('')
          setRejectNote('')
        },
        onError: () => toast('error', 'Failed to submit decision'),
      }
    )
  }

  return (
    <Card>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {approval.workflow_name}
              </h3>
              <Badge variant="warning">Pending Approval</Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {approval.step_description}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
              Step ID: {approval.step_id}
            </p>
          </div>
        </div>

        {/* Context */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Execution started {formatRelativeTime(approval.execution_started_at)} ({formatDateTime(approval.execution_started_at)})
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Triggered by: <span className="font-medium text-gray-700 dark:text-gray-300">{approval.triggered_by}</span>
          </div>
        </div>

        {/* Instructions */}
        {approval.instructions && (
          <div className="border-l-4 border-[#51459d] pl-3">
            <p className="text-xs font-semibold text-[#51459d] uppercase tracking-wide mb-1">
              Approval Instructions
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{approval.instructions}</p>
          </div>
        )}

        {/* View workflow link */}
        <button
          type="button"
          onClick={() => navigate(`/hr/workflows/builder/${approval.workflow_id}`)}
          className="inline-flex items-center gap-1.5 text-xs text-[#51459d] hover:underline font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View Workflow
        </button>

        {/* Action area */}
        {!showApproveNote && !showRejectNote && (
          <div className="flex gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
            <Button
              className="flex-1"
              style={{ backgroundColor: '#6fd943', borderColor: '#6fd943' }}
              onClick={() => setShowApproveNote(true)}
              disabled={decide.isPending}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => setShowRejectNote(true)}
              disabled={decide.isPending}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </Button>
          </div>
        )}

        {/* Approve with note */}
        {showApproveNote && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <p className="text-sm font-medium text-[#6fd943]">Approving this request</p>
            <textarea
              className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400/40 resize-none"
              rows={2}
              placeholder="Add a note (optional)..."
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                style={{ backgroundColor: '#6fd943', borderColor: '#6fd943' }}
                loading={decide.isPending}
                onClick={() => handleDecide('approved', approveNote)}
              >
                Confirm Approve
              </Button>
              <Button variant="outline" onClick={() => setShowApproveNote(false)} disabled={decide.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reject with note */}
        {showRejectNote && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <p className="text-sm font-medium text-[#ff3a6e]">Rejecting this request</p>
            <textarea
              className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400/40 resize-none"
              rows={2}
              placeholder="Reason for rejection (optional)..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                loading={decide.isPending}
                onClick={() => handleDecide('rejected', rejectNote)}
              >
                Confirm Reject
              </Button>
              <Button variant="outline" onClick={() => setShowRejectNote(false)} disabled={decide.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Pending Skeleton ─────────────────────────────────────────────────────────

function PendingCardSkeleton() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="flex justify-between">
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded-[10px]" />
        <div className="flex gap-3 pt-2">
          <div className="flex-1 h-9 bg-green-100 dark:bg-green-900/20 rounded-[10px]" />
          <div className="flex-1 h-9 bg-red-100 dark:bg-red-900/20 rounded-[10px]" />
        </div>
      </div>
    </Card>
  )
}

// ─── Completed Table ──────────────────────────────────────────────────────────

function CompletedApprovalsTable() {
  const { data, isLoading } = useCompletedApprovals({ limit: 50 })
  const completed = data?.items ?? []

  if (isLoading) {
    return (
      <Card padding={false}>
        <div className="p-4 space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (completed.length === 0) {
    return (
      <Card>
        <div className="py-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No completed approvals yet.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
            <tr>
              {['Workflow', 'Step', 'Decision', 'Note', 'Decided At'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {completed.map((approval: WorkflowApproval) => (
              <tr
                key={approval.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[180px] truncate">
                  {approval.workflow_name}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                  {approval.step_description}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={approval.status === 'approved' ? 'success' : 'danger'}>
                    {approval.status === 'approved' ? 'Approved' : 'Rejected'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                  {approval.note ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {approval.decided_at ? formatDateTime(approval.decided_at) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabKey = 'pending' | 'completed'

export default function WorkflowApprovals() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending')

  const { data: pending, isLoading: loadingPending } = usePendingApprovals()
  const pendingApprovals = pending ?? []
  const pendingCount = pendingApprovals.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Approvals</h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full bg-[#ff3a6e] text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review and action pending workflow approval requests
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {([
          { key: 'pending', label: 'Pending', count: pendingCount },
          { key: 'completed', label: 'Completed', count: null },
        ] as { key: TabKey; label: string; count: number | null }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={[
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === t.key
                ? 'border-[#51459d] text-[#51459d]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            ].join(' ')}
          >
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span
                className={[
                  'inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-xs font-bold',
                  activeTab === t.key
                    ? 'bg-[#51459d] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                ].join(' ')}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'pending' && (
        <div>
          {loadingPending ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <PendingCardSkeleton key={i} />)}
            </div>
          ) : pendingApprovals.length === 0 ? (
            <Card>
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-[#6fd943]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  No pending approvals
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You're all caught up! No workflow approvals require your attention right now.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Count label */}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pendingCount} approval{pendingCount !== 1 ? 's' : ''} awaiting your decision
              </p>

              {pendingApprovals.map((approval: WorkflowApproval) => (
                <PendingApprovalCard key={approval.id} approval={approval} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && <CompletedApprovalsTable />}
    </div>
  )
}
