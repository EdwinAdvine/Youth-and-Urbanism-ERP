import { useState } from 'react'
import { Card, Badge, Button, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useLeaveBalance,
  useCreateLeaveRequest,
  useMyEmployeeProfile,
  useLeaveRequests,
  type LeaveStatus,
  type CreateLeaveRequestPayload,
} from '../../api/hr'

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

export default function MobileLeaveRequest() {
  const { data: myProfile } = useMyEmployeeProfile()
  const { data: leaveBalance } = useLeaveBalance(myProfile?.id ?? '')
  const { data: recentLeaves } = useLeaveRequests({ page: 1, limit: 5, employee_id: myProfile?.id })
  const createLeave = useCreateLeaveRequest()

  const [form, setForm] = useState<CreateLeaveRequestPayload>({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  })
  const [showForm, setShowForm] = useState(false)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, employee_id: form.employee_id || myProfile?.id || '' }
    createLeave.mutate(payload, {
      onSuccess: () => {
        toast('success', 'Leave request submitted')
        setShowForm(false)
        setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      },
      onError: () => toast('error', 'Failed to submit leave request'),
    })
  }

  // Calculate days between dates
  const dayCount = form.start_date && form.end_date
    ? Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0

  return (
    <div className="space-y-4">
      {/* Leave Balance Cards */}
      {leaveBalance && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-gray-900">{leaveBalance.annual_allocation}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Total</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-orange-600">{leaveBalance.used_days}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Used</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-green-600">{leaveBalance.remaining_days}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Left</p>
          </Card>
        </div>
      )}

      {/* Request Button or Form */}
      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full min-h-[52px] text-base font-semibold"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Request Leave
        </Button>
      ) : (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">New Leave Request</h3>
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
              className="min-h-[44px]"
            />

            <Input
              label="Start Date"
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              className="min-h-[44px]"
            />

            <Input
              label="End Date"
              type="date"
              required
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              className="min-h-[44px]"
            />

            {dayCount > 0 && (
              <div className="bg-primary/5 rounded-[10px] px-3 py-2 text-sm">
                <span className="text-gray-600">Duration: </span>
                <span className="font-semibold text-primary">{dayCount} day{dayCount > 1 ? 's' : ''}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Reason</label>
              <textarea
                className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[88px]"
                required
                placeholder="Briefly describe the reason for your leave..."
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 min-h-[48px] text-base"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createLeave.isPending}
                className="flex-1 min-h-[48px] text-base"
              >
                Submit
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Recent Requests */}
      {(recentLeaves?.items ?? []).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Requests</h3>
          <div className="space-y-3">
            {(recentLeaves?.items ?? []).map((leave) => (
              <div
                key={leave.id}
                className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {leave.leave_type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' - '}
                    {new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  {leave.reason && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{leave.reason}</p>
                  )}
                </div>
                <LeaveStatusBadge status={leave.status} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
