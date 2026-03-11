import { useState, useEffect } from 'react'
import { Card, Badge, Button } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useAttendance,
  useCheckIn,
  useCheckOut,
  useMyEmployeeProfile,
  type AttendanceStatus,
} from '../../api/hr'

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

export default function MobileAttendance() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'found' | 'denied'>('idle')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  const { data: myProfile } = useMyEmployeeProfile()
  const { data: attendance } = useAttendance({
    page: 1,
    limit: 5,
    employee_id: myProfile?.id,
  })

  const checkIn = useCheckIn()
  const checkOut = useCheckOut()

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Attempt geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('denied')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoStatus('found')
      },
      () => {
        setGeoStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const todayRecord = (attendance?.items ?? []).find(
    (r) => r.date.startsWith(today) && r.employee_id === myProfile?.id
  )
  const isCheckedIn = todayRecord?.check_in && !todayRecord?.check_out
  const isCheckedOut = todayRecord?.check_in && todayRecord?.check_out

  function handleCheckIn() {
    checkIn.mutate(undefined, {
      onSuccess: () => toast('success', 'Checked in successfully'),
      onError: () => toast('error', 'Failed to check in. You may have already checked in today.'),
    })
  }

  function handleCheckOut() {
    checkOut.mutate(undefined, {
      onSuccess: () => toast('success', 'Checked out successfully'),
      onError: () => toast('error', 'Failed to check out.'),
    })
  }

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Time Display */}
      <Card className="text-center">
        <p className="text-4xl font-bold text-gray-900 tabular-nums tracking-tight">{timeStr}</p>
        <p className="text-sm text-gray-500 mt-1">{dateStr}</p>

        {/* Geolocation indicator */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className={`w-2 h-2 rounded-full ${ geoStatus === 'found' ? 'bg-green-500' : geoStatus === 'locating' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300' }`} />
          <span className="text-xs text-gray-500">
            {geoStatus === 'found' && location
              ? `Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
              : geoStatus === 'locating'
                ? 'Getting location...'
                : 'Location unavailable'}
          </span>
        </div>
      </Card>

      {/* Status Card */}
      <Card>
        <div className="text-center space-y-3">
          {/* Current status */}
          <div className="flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${ isCheckedOut ? 'bg-gray-400' : isCheckedIn ? 'bg-green-500 animate-pulse' : 'bg-orange-400' }`} />
            <span className="text-sm font-medium text-gray-700">
              {isCheckedOut
                ? 'Shift completed'
                : isCheckedIn
                  ? 'Currently working'
                  : 'Not checked in'}
            </span>
          </div>

          {/* Today's times */}
          {todayRecord && (
            <div className="flex items-center justify-center gap-6 text-sm">
              {todayRecord.check_in && (
                <div>
                  <span className="text-gray-500">In: </span>
                  <span className="font-medium text-green-600">
                    {new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {todayRecord.check_out && (
                <div>
                  <span className="text-gray-500">Out: </span>
                  <span className="font-medium text-orange-600">
                    {new Date(todayRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {todayRecord.hours_worked != null && (
                <div>
                  <span className="text-gray-500">Hours: </span>
                  <span className="font-semibold text-gray-900">{todayRecord.hours_worked.toFixed(1)}h</span>
                </div>
              )}
            </div>
          )}

          {todayRecord?.status && (
            <AttendanceStatusBadge status={todayRecord.status} />
          )}
        </div>
      </Card>

      {/* Big Action Button */}
      <div className="px-4">
        {!isCheckedIn && !isCheckedOut ? (
          <Button
            onClick={handleCheckIn}
            loading={checkIn.isPending}
            className="w-full min-h-[64px] text-lg font-semibold rounded-[10px] bg-green-600 hover:bg-green-700 text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Check In
          </Button>
        ) : isCheckedIn ? (
          <Button
            onClick={handleCheckOut}
            loading={checkOut.isPending}
            variant="outline"
            className="w-full min-h-[64px] text-lg font-semibold rounded-[10px] border-2 border-orange-500 text-orange-600 hover:bg-orange-50"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Check Out
          </Button>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 bg-gray-100 rounded-[10px] px-6 py-4">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Shift completed for today</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent History */}
      {(attendance?.items ?? []).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Attendance</h3>
          <div className="space-y-3">
            {(attendance?.items ?? []).slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {record.check_in && (
                      <span>
                        In: {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {record.check_out && (
                      <span>
                        Out: {new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {record.hours_worked != null && (
                    <span className="text-xs font-medium text-gray-600">{record.hours_worked.toFixed(1)}h</span>
                  )}
                  <AttendanceStatusBadge status={record.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
