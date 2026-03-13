import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tv, Plus, Calendar, Users, Clock, ArrowRight } from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import { useMeetings, useCreateMeeting } from '../../api/meetings'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NewWebinarModal({ onClose }: { onClose: () => void }) {
  const createMeeting = useCreateMeeting()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState('60')

  const handleCreate = () => {
    if (!title.trim() || !date) return
    const start = new Date(`${date}T${time}:00`)
    const end = new Date(start.getTime() + Number(duration) * 60 * 1000)
    createMeeting.mutate(
      {
        title,
        description,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Schedule Webinar</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Webinar title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Launch Webinar"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will this webinar cover?"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Start time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Duration (minutes)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none"
            >
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px]">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={createMeeting.isPending || !title.trim() || !date}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
          >
            {createMeeting.isPending ? 'Scheduling...' : 'Schedule Webinar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WebinarsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useMeetings()
  const [showNew, setShowNew] = useState(false)

  const meetings = data?.meetings ?? []
  const now = new Date()

  const upcoming = meetings.filter((m) => new Date(m.start_time) > now)
  const past = meetings.filter((m) => new Date(m.end_time) <= now)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Webinars</h1>
          <p className="text-sm text-gray-500 mt-0.5">Host and manage virtual events for your team or clients</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Webinar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', value: upcoming.length, icon: <Calendar className="w-5 h-5 text-[#51459d]" />, bg: 'bg-[#51459d]/10' },
          { label: 'Total Hosted', value: meetings.length, icon: <Tv className="w-5 h-5 text-[#3ec9d6]" />, bg: 'bg-[#3ec9d6]/10' },
          { label: 'Past Events', value: past.length, icon: <Clock className="w-5 h-5 text-gray-400" />, bg: 'bg-gray-100' },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4 p-4">
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${stat.bg}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Upcoming Webinars */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Webinars</h2>
        {isLoading ? (
          <Card><div className="py-12 text-center text-gray-400 text-sm">Loading...</div></Card>
        ) : upcoming.length === 0 ? (
          <Card>
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#51459d]/10 flex items-center justify-center">
                <Tv className="w-7 h-7 text-[#51459d]" />
              </div>
              <p className="text-sm font-medium text-gray-900">No upcoming webinars</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Schedule a webinar to host a virtual event with your team or clients.
              </p>
              <Button size="sm" onClick={() => setShowNew(true)} className="mt-1">
                <Plus className="w-3.5 h-3.5 mr-1" /> Schedule Webinar
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <Card key={m.id} className="flex items-center justify-between p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/teams/meetings/${m.id}`)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[10px] bg-[#51459d]/10 flex items-center justify-center shrink-0">
                    <Tv className="w-5 h-5 text-[#51459d]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(m.start_time)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="primary">Scheduled</Badge>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Webinars */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Past Webinars</h2>
          <div className="space-y-3">
            {past.slice(0, 5).map((m) => (
              <Card key={m.id} className="flex items-center justify-between p-4 opacity-75 hover:opacity-100 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/teams/meetings/${m.id}`)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[10px] bg-gray-100 flex items-center justify-center shrink-0">
                    <Tv className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{m.title}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(m.start_time)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="default">Completed</Badge>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showNew && <NewWebinarModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
