import { useEmployeeAvailability } from '@/api/hr_ext'

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  available: { bg: 'bg-green-100', text: 'text-green-800', label: 'Available' },
  busy: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Busy' },
  overloaded: { bg: 'bg-red-100', text: 'text-red-800', label: 'Overloaded' },
  on_leave: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'On Leave' },
}

interface EmployeeAvailabilityBadgeProps {
  employeeId: string
  showDetails?: boolean
}

/**
 * Small availability indicator component that shows an employee's current
 * availability status based on leave calendar and project workload.
 */
export default function EmployeeAvailabilityBadge({
  employeeId,
  showDetails = false,
}: EmployeeAvailabilityBadgeProps) {
  const { data, isLoading } = useEmployeeAvailability(employeeId)

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        Loading...
      </span>
    )
  }

  if (!data) return null

  const status = statusColors[data.availability_status] || statusColors.available

  return (
    <div className="inline-flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            data.availability_status === 'available'
              ? 'bg-green-500'
              : data.availability_status === 'busy'
                ? 'bg-yellow-500'
                : data.availability_status === 'overloaded'
                  ? 'bg-red-500'
                  : 'bg-orange-500'
          }`}
        />
        {status.label}
      </span>

      {showDetails && (
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>Tasks: {data.active_tasks} active</p>
          <p>
            Utilization: {data.utilization_pct}% ({data.logged_hours}h / {data.capacity_hours}h)
          </p>
          {data.leave_periods.length > 0 && (
            <p>
              Leave: {data.total_leave_days} day{data.total_leave_days !== 1 ? 's' : ''} in range
            </p>
          )}
        </div>
      )}
    </div>
  )
}
