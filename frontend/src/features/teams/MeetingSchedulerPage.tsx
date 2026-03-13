import { useState } from 'react'
import { Card, Button, Input, Badge, toast } from '../../components/ui'
import { useCreateMeeting } from '../../api/meetings'

export default function MeetingSchedulerPage() {
  const createMeeting = useCreateMeeting()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [location, setLocation] = useState('')
  const [attendeeInput, setAttendeeInput] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])

  const addAttendee = () => {
    const trimmed = attendeeInput.trim()
    if (!trimmed) return
    if (attendees.includes(trimmed)) return toast('info', 'Already added')
    setAttendees([...attendees, trimmed])
    setAttendeeInput('')
  }

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter((a) => a !== email))
  }

  const handleSchedule = () => {
    if (!title.trim()) return toast('error', 'Title is required')
    if (!date) return toast('error', 'Date is required')

    const start_time = `${date}T${startTime}:00`
    const end_time = `${date}T${endTime}:00`

    if (new Date(end_time) <= new Date(start_time)) {
      return toast('error', 'End time must be after start time')
    }

    createMeeting.mutate(
      {
        title,
        description: description || undefined,
        start_time,
        end_time,
        location: location || undefined,
        attendees: attendees.length > 0 ? attendees : undefined,
      },
      {
        onSuccess: (data) => {
          toast('success', 'Meeting scheduled')
          if (data.jitsi_room_url) {
            toast('info', 'Jitsi room created')
          }
          // Reset form
          setTitle('')
          setDescription('')
          setDate('')
          setStartTime('09:00')
          setEndTime('10:00')
          setLocation('')
          setAttendees([])
        },
        onError: () => toast('error', 'Failed to schedule meeting'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Schedule Meeting</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new meeting with Jitsi video conferencing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Meeting Details</h2>
            <div className="space-y-4">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Team Standup" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Meeting agenda..."
                  className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <Input label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Conference Room A" />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Attendees</h2>
            <div className="flex gap-2 mb-3">
              <Input
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                placeholder="Email or user ID"
                onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
              />
              <Button variant="outline" onClick={addAttendee} className="shrink-0">Add</Button>
            </div>
            {attendees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attendees.map((a) => (
                  <Badge key={a} variant="primary" className="flex items-center gap-1">
                    {a}
                    <button onClick={() => removeAttendee(a)} className="ml-1 hover:text-red-500">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No attendees added yet</p>
            )}
          </Card>
        </div>

        {/* Preview */}
        <div>
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Preview</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Title:</span>
                <p className="font-medium text-gray-700">{title || 'Untitled Meeting'}</p>
              </div>
              {date && (
                <div>
                  <span className="text-gray-500">When:</span>
                  <p className="font-medium text-gray-700">
                    {new Date(`${date}T${startTime}`).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-gray-600">{startTime} - {endTime}</p>
                </div>
              )}
              {location && (
                <div>
                  <span className="text-gray-500">Where:</span>
                  <p className="font-medium text-gray-700">{location}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Participants:</span>
                <p className="font-medium text-gray-700">{attendees.length + 1} (you + {attendees.length})</p>
              </div>
              <div className="flex items-center gap-2 text-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">Jitsi room will be auto-created</span>
              </div>
            </div>
            <Button className="w-full mt-6" onClick={handleSchedule} loading={createMeeting.isPending}>
              Schedule Meeting
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
