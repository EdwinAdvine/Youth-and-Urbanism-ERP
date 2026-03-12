import { useState } from 'react'
import {
  useLiveEvents,
  useCreateLiveEvent,
  useUpdateLiveEvent,
  useRegisterForLiveEvent,
  useLiveEventQA,
  useAskQuestion,
  useAnswerQuestion,
  useUpvoteQuestion,
} from '@/api/chatExtended'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveEvent {
  id: string
  title: string
  type: 'webinar' | 'town_hall' | 'broadcast'
  status: 'upcoming' | 'live' | 'ended'
  scheduled_at: string
  max_attendees: number
  attendee_count: number
  registration_required: boolean
  is_registered: boolean
  created_at: string
}

interface QAEntry {
  id: string
  question: string
  answer: string | null
  asked_by: string
  upvotes: number
  created_at: string
}

type EventType = 'webinar' | 'town_hall' | 'broadcast'
type StatusFilter = 'all' | 'upcoming' | 'live' | 'ended'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusColor(status: string): string {
  switch (status) {
    case 'live':
      return 'bg-[#ff3a6e]/10 text-[#ff3a6e]'
    case 'upcoming':
      return 'bg-[#3ec9d6]/10 text-[#2da8b4]'
    case 'ended':
      return 'bg-gray-100 text-gray-500'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

function typeLabel(type: EventType): string {
  switch (type) {
    case 'webinar':
      return 'Webinar'
    case 'town_hall':
      return 'Town Hall'
    case 'broadcast':
      return 'Broadcast'
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CreateEventForm({ onClose }: { onClose: () => void }) {
  const createEvent = useCreateLiveEvent()
  const [form, setForm] = useState({
    title: '',
    type: 'webinar' as EventType,
    scheduled_at: '',
    scheduled_time: '',
    max_attendees: 100,
    registration_required: true,
  })

  const handleSubmit = () => {
    const scheduled = `${form.scheduled_at}T${form.scheduled_time}:00`
    createEvent.mutate(
      {
        title: form.title,
        type: form.type,
        scheduled_at: scheduled,
        max_attendees: form.max_attendees,
        registration_required: form.registration_required,
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Create Live Event</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Event Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Q1 All-Hands Meeting"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Event Type</label>
            <div className="flex gap-2">
              {(['webinar', 'town_hall', 'broadcast'] as EventType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 text-xs rounded-[8px] border transition-colors ${
                    form.type === t
                      ? 'bg-[#51459d] text-white border-[#51459d]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {typeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Date</label>
              <input
                type="date"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Time</label>
              <input
                type="time"
                value={form.scheduled_time}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Max Attendees</label>
            <input
              type="number"
              min={1}
              value={form.max_attendees}
              onChange={(e) => setForm({ ...form, max_attendees: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm({ ...form, registration_required: !form.registration_required })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.registration_required ? 'bg-[#51459d]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  form.registration_required ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs text-gray-700">Require registration</span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title || !form.scheduled_at || !form.scheduled_time || createEvent.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
          >
            {createEvent.isPending ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QAPanel({ eventId, isModerator }: { eventId: string; isModerator?: boolean }) {
  const { data: qaData, isLoading } = useLiveEventQA(eventId)
  const askQuestion = useAskQuestion()
  const answerQuestion = useAnswerQuestion()
  const upvoteQuestion = useUpvoteQuestion()
  const [newQuestion, setNewQuestion] = useState('')
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({})

  const questions: QAEntry[] = qaData
    ? [...qaData].sort((a: QAEntry, b: QAEntry) => b.upvotes - a.upvotes)
    : []

  const handleAsk = () => {
    if (!newQuestion.trim()) return
    askQuestion.mutate(
      { eventId, question: newQuestion.trim() },
      { onSuccess: () => setNewQuestion('') },
    )
  }

  const handleAnswer = (qaId: string) => {
    const answer = answerInputs[qaId]?.trim()
    if (!answer) return
    answerQuestion.mutate(
      { qaId, answer },
      {
        onSuccess: () =>
          setAnswerInputs((prev) => {
            const next = { ...prev }
            delete next[qaId]
            return next
          }),
      },
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-[10px] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-900">Q&A ({questions.length})</h4>
      </div>

      {/* Ask question */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
          />
          <button
            onClick={handleAsk}
            disabled={!newQuestion.trim() || askQuestion.isPending}
            className="px-3 py-2 text-xs font-medium bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
          >
            Ask
          </button>
        </div>
      </div>

      {/* Questions list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
        {isLoading ? (
          <div className="text-sm text-gray-400 text-center py-6">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">No questions yet</div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="px-4 py-3 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                {/* Upvote */}
                <button
                  onClick={() => upvoteQuestion.mutate(q.id)}
                  className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5"
                >
                  <svg
                    className="w-4 h-4 text-gray-400 hover:text-[#51459d] transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  <span className="text-[10px] font-semibold text-gray-600">{q.upvotes}</span>
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{q.question}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Asked by {q.asked_by} &middot;{' '}
                    {new Date(q.created_at).toLocaleTimeString('en-KE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>

                  {q.answer ? (
                    <div className="mt-2 bg-[#6fd943]/10 border border-[#6fd943]/20 rounded-[8px] px-3 py-2">
                      <p className="text-xs text-gray-800">{q.answer}</p>
                    </div>
                  ) : isModerator ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={answerInputs[q.id] ?? ''}
                        onChange={(e) =>
                          setAnswerInputs((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Type your answer..."
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                      />
                      <button
                        onClick={() => handleAnswer(q.id)}
                        disabled={!answerInputs[q.id]?.trim()}
                        className="px-2.5 py-1.5 text-[10px] font-medium bg-[#51459d] text-white rounded-[6px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
                      >
                        Answer
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EventCard({
  event,
  onSelect,
}: {
  event: LiveEvent
  onSelect: (id: string) => void
}) {
  const register = useRegisterForLiveEvent()
  const updateEvent = useUpdateLiveEvent()

  const handleAction = () => {
    if (event.status === 'upcoming' && event.registration_required && !event.is_registered) {
      register.mutate(event.id)
    } else if (event.status === 'upcoming' || event.status === 'live') {
      onSelect(event.id)
    }
  }

  const actionLabel = () => {
    if (event.status === 'live') return 'Join'
    if (event.status === 'upcoming') {
      if (event.registration_required && !event.is_registered) return 'Register'
      return 'View'
    }
    return 'View'
  }

  return (
    <div className="bg-white border border-gray-100 rounded-[10px] p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {event.status === 'live' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-[#ff3a6e] bg-[#ff3a6e]/10 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff3a6e] animate-pulse" />
                LIVE
              </span>
            )}
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor(event.status)}`}>
              {event.status.toUpperCase()}
            </span>
            <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {typeLabel(event.type)}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{event.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(event.scheduled_at)}</p>
        </div>

        {event.status !== 'ended' && (
          <button
            onClick={handleAction}
            disabled={register.isPending}
            className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-[8px] transition-colors shrink-0 ${
              event.status === 'live'
                ? 'bg-[#ff3a6e] text-white hover:bg-[#e0335f]'
                : 'bg-[#51459d] text-white hover:bg-[#3d3480]'
            } disabled:opacity-50`}
          >
            {register.isPending ? 'Registering...' : actionLabel()}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>
          {event.attendee_count}/{event.max_attendees} attendees
        </span>
        {event.registration_required && (
          <span className="text-[10px] text-[#ffa21d] font-medium">Registration required</span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LiveEventsPage() {
  const { data: events, isLoading } = useLiveEvents()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const allEvents: LiveEvent[] = events ?? []

  const filteredEvents =
    statusFilter === 'all' ? allEvents : allEvents.filter((e) => e.status === statusFilter)

  const grouped = {
    live: filteredEvents.filter((e) => e.status === 'live'),
    upcoming: filteredEvents.filter((e) => e.status === 'upcoming'),
    ended: filteredEvents.filter((e) => e.status === 'ended'),
  }

  const selectedEvent = allEvents.find((e) => e.id === selectedEventId)

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Live Events</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Webinars, town halls, and broadcasts
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-xs font-medium bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
        >
          New Event
        </button>
      </div>

      {/* Filter tabs */}
      <div className="px-6 pt-3">
        <div className="flex gap-1">
          {(['all', 'upcoming', 'live', 'ended'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[8px] capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-[#51459d]/10 text-[#51459d]'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="text-sm text-gray-400 text-center py-12">Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-12">No events found</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Events list */}
            <div className="space-y-6">
              {grouped.live.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-[#ff3a6e] uppercase tracking-wider mb-2">
                    Live Now
                  </h2>
                  <div className="space-y-2">
                    {grouped.live.map((e) => (
                      <EventCard key={e.id} event={e} onSelect={setSelectedEventId} />
                    ))}
                  </div>
                </div>
              )}

              {grouped.upcoming.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Upcoming
                  </h2>
                  <div className="space-y-2">
                    {grouped.upcoming.map((e) => (
                      <EventCard key={e.id} event={e} onSelect={setSelectedEventId} />
                    ))}
                  </div>
                </div>
              )}

              {grouped.ended.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Past
                  </h2>
                  <div className="space-y-2">
                    {grouped.ended.map((e) => (
                      <EventCard key={e.id} event={e} onSelect={setSelectedEventId} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Q&A Panel */}
            <div>
              {selectedEventId && selectedEvent ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Q&A: {selectedEvent.title}
                    </h2>
                    <button
                      onClick={() => setSelectedEventId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <QAPanel eventId={selectedEventId} isModerator />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm">Select an event to view Q&A</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateEventForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
