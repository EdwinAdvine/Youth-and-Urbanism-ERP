import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Spinner, Table, Pagination } from '../../components/ui'
import { cn } from '../../components/ui'
import {
  useEmployee,
  useLeaveBalance,
  useLeaveRequests,
  useAttendance,
  type LeaveRequest,
  type LeaveStatus,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../../api/hr'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const map: Record<AttendanceStatus, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string }> = {
    present: { variant: 'success', label: 'Present' },
    absent: { variant: 'danger', label: 'Absent' },
    half_day: { variant: 'warning', label: 'Half Day' },
    remote: { variant: 'info', label: 'Remote' },
    on_leave: { variant: 'default', label: 'On Leave' },
  }
  const { variant, label } = map[status] ?? { variant: 'default' as const, label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'leave' | 'attendance'

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [leavePage, setLeavePage] = useState(1)
  const [attendancePage, setAttendancePage] = useState(1)

  const { data: employee, isLoading } = useEmployee(id ?? '')
  const { data: leaveBalance } = useLeaveBalance(id ?? '')
  const { data: leaveRequests, isLoading: leavesLoading } = useLeaveRequests({
    page: leavePage,
    limit: 10,
    employee_id: id,
  })
  const { data: attendance, isLoading: attendanceLoading } = useAttendance({
    page: attendancePage,
    limit: 10,
    employee_id: id,
  })

  if (isLoading || !employee) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'leave', label: 'Leave History' },
    { key: 'attendance', label: 'Attendance' },
  ]

  const leaveColumns = [
    { key: 'leave_type', label: 'Type', render: (r: LeaveRequest) => <span className="capitalize">{r.leave_type.replace('_', ' ')}</span> },
    { key: 'start_date', label: 'From', render: (r: LeaveRequest) => new Date(r.start_date).toLocaleDateString() },
    { key: 'end_date', label: 'To', render: (r: LeaveRequest) => new Date(r.end_date).toLocaleDateString() },
    { key: 'reason', label: 'Reason', render: (r: LeaveRequest) => <span className="text-gray-600 truncate max-w-xs block">{r.reason}</span> },
    { key: 'status', label: 'Status', render: (r: LeaveRequest) => <LeaveStatusBadge status={r.status} /> },
  ]

  const attendanceColumns = [
    { key: 'date', label: 'Date', render: (r: AttendanceRecord) => new Date(r.date).toLocaleDateString() },
    { key: 'check_in', label: 'Check In', render: (r: AttendanceRecord) => r.check_in ? new Date(r.check_in).toLocaleTimeString() : '—' },
    { key: 'check_out', label: 'Check Out', render: (r: AttendanceRecord) => r.check_out ? new Date(r.check_out).toLocaleTimeString() : '—' },
    { key: 'hours_worked', label: 'Hours', render: (r: AttendanceRecord) => r.hours_worked != null ? `${r.hours_worked.toFixed(1)}h` : '—' },
    { key: 'status', label: 'Status', render: (r: AttendanceRecord) => <AttendanceStatusBadge status={r.status} /> },
  ]

  const leaveTotalPages = Math.ceil((leaveRequests?.total ?? 0) / 10)
  const attendanceTotalPages = Math.ceil((attendance?.total ?? 0) / 10)

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/hr/employees')}>
          &larr; Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {employee.first_name} {employee.last_name}
          </h1>
          <p className="text-sm text-gray-500">{employee.job_title} &middot; {employee.department_name ?? 'No department'}</p>
        </div>
      </div>

      {/* Leave Balance Card */}
      {leaveBalance && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Annual Allocation</p>
            <p className="text-2xl font-bold text-gray-900">{leaveBalance.annual_allocation} days</p>
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <Card>
          <div className="grid grid-cols-2 gap-6">
            <InfoRow label="Employee Number" value={employee.employee_number} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Phone" value={employee.phone ?? '—'} />
            <InfoRow label="Department" value={employee.department_name ?? 'Unassigned'} />
            <InfoRow label="Job Title" value={employee.job_title} />
            <InfoRow label="Employment Type" value={employee.employment_type.replace('_', ' ')} />
            <InfoRow label="Hire Date" value={new Date(employee.hire_date).toLocaleDateString()} />
            <InfoRow label="Salary" value={employee.salary != null ? `$${employee.salary.toLocaleString()}` : '—'} />
            <InfoRow label="Manager" value={employee.manager_name ?? '—'} />
            <InfoRow label="Status" value={employee.is_active ? 'Active' : 'Inactive'} />
          </div>
        </Card>
      )}

      {activeTab === 'leave' && (
        <Card padding={false}>
          <Table
            columns={leaveColumns}
            data={leaveRequests?.items ?? []}
            loading={leavesLoading}
            keyExtractor={(r) => r.id}
            emptyText="No leave history"
          />
          <Pagination page={leavePage} pages={leaveTotalPages} total={leaveRequests?.total ?? 0} onChange={setLeavePage} />
        </Card>
      )}

      {activeTab === 'attendance' && (
        <Card padding={false}>
          <Table
            columns={attendanceColumns}
            data={attendance?.items ?? []}
            loading={attendanceLoading}
            keyExtractor={(r) => r.id}
            emptyText="No attendance records"
          />
          <Pagination page={attendancePage} pages={attendanceTotalPages} total={attendance?.total ?? 0} onChange={setAttendancePage} />
        </Card>
      )}
    </div>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{value}</p>
    </div>
  )
}
