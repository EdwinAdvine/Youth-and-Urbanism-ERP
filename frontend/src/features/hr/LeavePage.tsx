import { useState } from 'react'
import { Card, Badge, Button, Table, Modal, Input, Select, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useLeaveRequests,
  useCreateLeaveRequest,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useLeaveBalance,
  useMyEmployeeProfile,
  type LeaveRequest,
  type LeaveStatus,
  type CreateLeaveRequestPayload,
} from '../../api/hr'
import MobileLeaveRequest from './MobileLeaveRequest'

// ─── Leave Status Badge ───────────────────────────────────────────────────────

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const map: Record<LeaveStatus, { variant: 'warning' | 'success' | 'danger' | 'default'; label: string }> = {
    pending: { variant: 'warning', label: 'Pending' },
    approved: { variant: 'success', label: 'Approved' },
    rejected: { variant: 'danger', label: 'Rejected' },
    cancelled: { variant: 'default', label: 'Cancelled' },
  }
  const { variant, label } = map[status] ?? { variant: 'default' as const, label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeavePage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const limit = 15

  const { data: myProfile } = useMyEmployeeProfile()
  const { data: leaveBalance } = useLeaveBalance(myProfile?.id ?? '')
  const { data: leaves, isLoading } = useLeaveRequests({
    page,
    limit,
    status: (statusFilter as LeaveStatus) || undefined,
  })

  const createLeave = useCreateLeaveRequest()
  const approveLeave = useApproveLeaveRequest()
  const rejectLeave = useRejectLeaveRequest()

  const [form, setForm] = useState<CreateLeaveRequestPayload>({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, employee_id: form.employee_id || myProfile?.id || '' }
    createLeave.mutate(payload, {
      onSuccess: () => {
        toast('success', 'Leave request submitted')
        setShowCreate(false)
        setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      },
      onError: () => toast('error', 'Failed to submit leave request'),
    })
  }

  function handleApprove(id: string) {
    approveLeave.mutate(id, {
      onSuccess: () => toast('success', 'Leave request approved'),
      onError: () => toast('error', 'Failed to approve'),
    })
  }

  function handleReject(id: string) {
    rejectLeave.mutate(id, {
      onSuccess: () => toast('success', 'Leave request rejected'),
      onError: () => toast('error', 'Failed to reject'),
    })
  }

  const totalPages = Math.ceil((leaves?.total ?? 0) / limit)

  const columns = [
    {
      key: 'employee_name',
      label: 'Employee',
      render: (r: LeaveRequest) => r.employee_name ?? '—',
    },
    {
      key: 'leave_type',
      label: 'Type',
      render: (r: LeaveRequest) => <span className="capitalize">{r.leave_type.replace('_', ' ')}</span>,
    },
    {
      key: 'start_date',
      label: 'From',
      render: (r: LeaveRequest) => new Date(r.start_date).toLocaleDateString(),
    },
    {
      key: 'end_date',
      label: 'To',
      render: (r: LeaveRequest) => new Date(r.end_date).toLocaleDateString(),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r: LeaveRequest) => (
        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[200px] block">{r.reason}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: LeaveRequest) => <LeaveStatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: LeaveRequest) =>
        r.status === 'pending' ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-green-600"
              loading={approveLeave.isPending}
              onClick={() => handleApprove(r.id)}
            >
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              loading={rejectLeave.isPending}
              onClick={() => handleReject(r.id)}
            >
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Leave Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and review leave requests</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto min-h-[44px] sm:min-h-0 hidden md:inline-flex">Submit Leave Request</Button>
      </div>

      {/* Mobile Leave Request view (visible on small screens only) */}
      <div className="block md:hidden">
        <MobileLeaveRequest />
      </div>

      {/* Leave Balance (desktop) */}
      {leaveBalance && (
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <p className="text-sm text-gray-500">Annual Allocation</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{leaveBalance.annual_allocation} days</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Used</p>
            <p className="text-2xl font-bold text-orange-600">{leaveBalance.used_days} days</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Remaining</p>
            <p className="text-2xl font-bold text-green-600">{leaveBalance.remaining_days} days</p>
          </Card>
        </div>
      )}

      {/* Filter (desktop only) */}
      <div className="hidden md:flex items-center gap-4">
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </div>

      {/* Table (desktop only) */}
      <Card padding={false} className="hidden md:block">
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            data={leaves?.items ?? []}
            loading={isLoading}
            keyExtractor={(r) => r.id}
            emptyText="No leave requests found"
          />
        </div>
        <Pagination page={page} pages={totalPages} total={leaves?.total ?? 0} onChange={setPage} />
      </Card>

      {/* ─── Create Leave Modal ──────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Submit Leave Request">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Leave Type"
            value={form.leave_type}
            onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value as CreateLeaveRequestPayload['leave_type'] }))}
            options={[
              { value: 'annual', label: 'Annual Leave' },
              { value: 'sick', label: 'Sick Leave' },
              { value: 'personal', label: 'Personal Leave' },
              { value: 'maternity', label: 'Maternity Leave' },
              { value: 'paternity', label: 'Paternity Leave' },
              { value: 'unpaid', label: 'Unpaid Leave' },
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              required
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createLeave.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
