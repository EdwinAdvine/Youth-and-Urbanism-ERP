import { useState, useMemo } from 'react'
import { Card, Button, Spinner, Select } from '../../components/ui'
import { useLeaveRequests, useDepartments, type LeaveRequest } from '../../api/hr'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const leaveColors: Record<string, string> = {
  annual: 'bg-blue-100 text-blue-700 border-blue-200',
  sick: 'bg-red-100 text-red-700 border-red-200',
  personal: 'bg-purple-100 text-purple-700 border-purple-200',
  maternity: 'bg-pink-100 text-pink-700 border-pink-200',
  paternity: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  unpaid: 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function LeaveCalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const { data: leaveData, isLoading } = useLeaveRequests({
    status: 'approved',
    limit: 500,
  })
  const { data: departments } = useDepartments()
  const [deptFilter, setDeptFilter] = useState('')

  const approvedLeaves = useMemo(() => {
    if (!leaveData?.items) return []
    return leaveData.items.filter((_l) => {
      if (deptFilter) return false // would need dept info on leave
      return true
    })
  }, [leaveData, deptFilter])

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  function getLeaveForDate(date: string): LeaveRequest[] {
    return approvedLeaves.filter((l) => {
      const start = l.start_date.slice(0, 10)
      const end = l.end_date.slice(0, 10)
      return date >= start && date <= end
    })
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const calendarCells = []
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leave Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Team leave overview by date</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={prevMonth}>&lt;</Button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[200px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>&gt;</Button>
          <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
        </div>
        <div className="flex gap-3">
          {departments && departments.length > 0 && (
            <Select
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-48"
            />
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(leaveColors).map(([type, cls]) => (
          <span key={type} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cls}`}>
            {type}
          </span>
        ))}
      </div>

      <Card padding={false}>
        <div className="grid grid-cols-7">
          {DAY_NAMES.map((day) => (
            <div key={day} className="py-3 px-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
              {day}
            </div>
          ))}
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50" />
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const leaves = getLeaveForDate(dateStr)
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const isWeekend = (startDayOfWeek + day - 1) % 7 === 0 || (startDayOfWeek + day - 1) % 7 === 6

            return (
              <div
                key={day}
                className={`min-h-[100px] border-b border-r border-gray-50 dark:border-gray-800 p-1.5 ${isWeekend ? 'bg-gray-50/50 dark:bg-gray-950/50' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${isToday ? 'bg-primary text-white' : 'text-gray-600'}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {leaves.slice(0, 3).map((l) => (
                    <div
                      key={l.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${leaveColors[l.leave_type] ?? leaveColors.unpaid}`}
                      title={`${l.employee_name} - ${l.leave_type}`}
                    >
                      {l.employee_name}
                    </div>
                  ))}
                  {leaves.length > 3 && (
                    <span className="text-[10px] text-gray-400 px-1">+{leaves.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
