import { useState, useMemo } from 'react'
import { Card, Button, Spinner, Input, Badge, toast } from '../../components/ui'
import { useAvailability, type Availability, type AvailabilitySlot } from '../../api/calendar_ext'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8am-7pm

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hr}${ampm}`
}

export default function SchedulingAssistant() {
  const [userIds, setUserIds] = useState<string[]>([])
  const [userInput, setUserInput] = useState('')
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })

  const start = `${dateStr}T00:00:00`
  const end = `${dateStr}T23:59:59`

  const { data: availability, isLoading } = useAvailability({
    user_ids: userIds,
    start,
    end,
  })

  const addUser = () => {
    const trimmed = userInput.trim()
    if (!trimmed) return
    if (userIds.includes(trimmed)) return toast('info', 'User already added')
    setUserIds([...userIds, trimmed])
    setUserInput('')
  }

  const removeUser = (id: string) => {
    setUserIds(userIds.filter((u) => u !== id))
  }

  const freeSlots = useMemo(() => {
    if (!availability || availability.length === 0) return []
    // Find slots where ALL users are free
    const results: { hour: number; free: boolean }[] = []
    for (const h of HOURS) {
      const timeStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00`)
      const timeEnd = new Date(`${dateStr}T${String(h + 1).padStart(2, '0')}:00:00`)
      const allFree = availability.every((a) => {
        return !a.slots.some((s) => {
          const sStart = new Date(s.start)
          const sEnd = new Date(s.end)
          return s.status === 'busy' && sStart < timeEnd && sEnd > timeStart
        })
      })
      results.push({ hour: h, free: allFree })
    }
    return results
  }, [availability, dateStr])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scheduling Assistant</h1>
        <p className="text-sm text-gray-500 mt-1">Find the best meeting time for multiple participants</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Participants</h3>
            <div className="flex gap-2 mb-3">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="User ID or email"
                onKeyDown={(e) => e.key === 'Enter' && addUser()}
              />
              <Button onClick={addUser} variant="outline" className="shrink-0">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {userIds.map((id) => (
                <Badge key={id} variant="primary" className="flex items-center gap-1">
                  {id}
                  <button onClick={() => removeUser(id)} className="ml-1 hover:text-red-500">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              ))}
              {userIds.length === 0 && (
                <p className="text-sm text-gray-400">Add participants to check availability</p>
              )}
            </div>
          </div>
          <div>
            <Input
              label="Date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Availability Grid */}
      {userIds.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Availability for {new Date(dateStr).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : !availability || availability.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No availability data found. Users may not have calendar data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Time</th>
                    {availability.map((a) => (
                      <th key={a.user_id} className="text-center py-2 px-3 text-xs font-semibold text-gray-500">
                        {a.user_name}
                      </th>
                    ))}
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">All Free</th>
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((h) => {
                    const timeStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00`)
                    const timeEnd = new Date(`${dateStr}T${String(h + 1).padStart(2, '0')}:00:00`)
                    const freeStatus = freeSlots.find((s) => s.hour === h)

                    return (
                      <tr key={h} className={`border-b border-gray-50 dark:border-gray-800 ${freeStatus?.free ? 'bg-green-50' : ''}`}>
                        <td className="py-2 px-3 text-gray-600 font-medium">
                          {formatHour(h)} - {formatHour(h + 1)}
                        </td>
                        {availability.map((a) => {
                          const isBusy = a.slots.some((s) => {
                            const sStart = new Date(s.start)
                            const sEnd = new Date(s.end)
                            return s.status === 'busy' && sStart < timeEnd && sEnd > timeStart
                          })
                          return (
                            <td key={a.user_id} className="text-center py-2 px-3">
                              <div className={`w-6 h-6 rounded mx-auto ${isBusy ? 'bg-red-200' : 'bg-green-200'}`} title={isBusy ? 'Busy' : 'Free'} />
                            </td>
                          )
                        })}
                        <td className="text-center py-2 px-3">
                          {freeStatus?.free ? (
                            <Badge variant="success">Free</Badge>
                          ) : (
                            <Badge variant="danger">Conflict</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Suggested times */}
      {freeSlots.length > 0 && freeSlots.some((s) => s.free) && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Suggested Times</h3>
          <div className="flex flex-wrap gap-2">
            {freeSlots
              .filter((s) => s.free)
              .map((s) => (
                <Button key={s.hour} variant="outline" size="sm">
                  {formatHour(s.hour)} - {formatHour(s.hour + 1)}
                </Button>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}
