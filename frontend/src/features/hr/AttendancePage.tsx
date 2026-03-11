import { useState } from 'react'
import { Card, Badge, Button, Table, Input, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useAttendance,
  useCheckIn,
  useCheckOut,
  useMyEmployeeProfile,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../../api/hr'

// ─── Attendance Status Badge ──────────────────────────────────────────────────

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

export default function AttendancePage() {
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const limit = 15

  const { data: myProfile } = useMyEmployeeProfile()
  const { data: attendance, isLoading } = useAttendance({
    page,
    limit,
    employee_id: myProfile?.id,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  const checkIn = useCheckIn()
  const checkOut = useCheckOut()

  function handleCheckIn() {
    checkIn.mutate(undefined, {
      onSuccess: () => toast('success', 'Checked in successfully'),
      onError: () => toast('error', 'Failed to check in. You may have already checked in today.'),
    })
  }

  function handleCheckOut() {
    checkOut.mutate(undefined, {
      onSuccess: () => toast('success', 'Checked out successfully'),
      onError: () => toast('error', 'Failed to check out. You may not have checked in today.'),
    })
  }

  // Determine current day status from latest attendance record
  const today = new Date().toISOString().split('T')[0]
  const todayRecord = (attendance?.items ?? []).find(
    (r) => r.date.startsWith(today) && r.employee_id === myProfile?.id
  )
  const isCheckedIn = todayRecord?.check_in && !todayRecord?.check_out
  const isCheckedOut = todayRecord?.check_in && todayRecord?.check_out

  const totalPages = Math.ceil((attendance?.total ?? 0) / limit)

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (r: AttendanceRecord) => new Date(r.date).toLocaleDateString(),
    },
    {
      key: 'employee_name',
      label: 'Employee',
      render: (r: AttendanceRecord) => r.employee_name ?? '—',
    },
    {
      key: 'check_in',
      label: 'Check In',
      render: (r: AttendanceRecord) =>
        r.check_in ? (
          <span className="text-green-600 font-medium">
            {new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'check_out',
      label: 'Check Out',
      render: (r: AttendanceRecord) =>
        r.check_out ? (
          <span className="text-orange-600 font-medium">
            {new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'hours_worked',
      label: 'Hours',
      render: (r: AttendanceRecord) =>
        r.hours_worked != null ? (
          <span className="font-medium">{r.hours_worked.toFixed(1)}h</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: AttendanceRecord) => <AttendanceStatusBadge status={r.status} />,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (r: AttendanceRecord) =>
        r.notes ? (
          <span className="text-gray-500 text-xs truncate max-w-[150px] block">{r.notes}</span>
        ) : null,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Track your daily attendance</p>
        </div>
      </div>

      {/* Check-in / Check-out Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Today's Status</h2>
            <p className="text-sm text-gray-500 mt-1">
              {isCheckedOut
                ? 'You have completed your shift for today.'
                : isCheckedIn
                  ? 'You are currently checked in.'
                  : 'You have not checked in yet.'}
            </p>
            {todayRecord && (
              <div className="flex items-center gap-4 mt-2 text-sm">
                {todayRecord.check_in && (
                  <span className="text-green-600">
                    In: {new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {todayRecord.check_out && (
                  <span className="text-orange-600">
                    Out: {new Date(todayRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {todayRecord.hours_worked != null && (
                  <span className="text-gray-600">{todayRecord.hours_worked.toFixed(1)}h worked</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleCheckIn}
              loading={checkIn.isPending}
              disabled={!!isCheckedIn || !!isCheckedOut}
            >
              Check In
            </Button>
            <Button
              variant="outline"
              onClick={handleCheckOut}
              loading={checkOut.isPending}
              disabled={!isCheckedIn || !!isCheckedOut}
            >
              Check Out
            </Button>
          </div>
        </div>
      </Card>

      {/* Date Range Filters */}
      <div className="flex items-center gap-4">
        <Input
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value)
            setPage(1)
          }}
        />
        <Input
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value)
            setPage(1)
          }}
        />
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-6"
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={attendance?.items ?? []}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No attendance records found"
        />
        <Pagination page={page} pages={totalPages} total={attendance?.total ?? 0} onChange={setPage} />
      </Card>
    </div>
  )
}
