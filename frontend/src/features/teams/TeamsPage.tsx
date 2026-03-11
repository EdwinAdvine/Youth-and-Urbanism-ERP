import { useState } from 'react'
import {
  useMeetings,
  useCreateMeeting,
  type Meeting,
  type CreateMeetingResponse,
} from '../../api/meetings'
import MeetingLobby from './MeetingLobby'
import InMeetingControls from './InMeetingControls'
import RecurringMeetingSetup from './RecurringMeetingSetup'
import PostMeetingSummary from './PostMeetingSummary'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveMeetingState {
  title: string
  jitsiRoomUrl: string
}

type MeetingStatus = 'upcoming' | 'live' | 'ended'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function deriveMeetingStatus(meeting: Meeting): MeetingStatus {
  const now = new Date()
  const start = new Date(meeting.start_time)
  const end = new Date(meeting.end_time)
  if (now < start) return 'upcoming'
  if (now >= start && now <= end) return 'live'
  return 'ended'
}

function getDurationMinutes(meeting: Meeting): number | null {
  const start = new Date(meeting.start_time)
  const end = new Date(meeting.end_time)
  const mins = Math.round((end.getTime() - start.getTime()) / 60000)
  return mins > 0 ? mins : null
}

// ─── New Meeting Modal ────────────────────────────────────────────────────────

function NewMeetingModal({ onClose, onStart }: { onClose: () => void; onStart: (state: ActiveMeetingState) => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [startNow, setStartNow] = useState(true)
  const createMeeting = useCreateMeeting()

  const handleCreate = () => {
    const now = new Date()
    const startTime = startNow ? now.toISOString() : `${date}T${time}:00`
    const endTime = startNow
      ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
      : new Date(new Date(`${date}T${time}:00`).getTime() + 60 * 60 * 1000).toISOString()

    createMeeting.mutate(
      {
        title: title || 'Quick Meeting',
        start_time: startTime,
        end_time: endTime,
      },
      {
        onSuccess: (data: CreateMeetingResponse) => {
          if (startNow) {
            onStart({ title: data.title, jitsiRoomUrl: data.jitsi_room_url })
          } else {
            onClose()
          }
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Meeting</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Meeting title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Team Sync, Client Call…"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">When</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStartNow(true)}
                className={`flex-1 py-2 text-xs rounded-[8px] border transition-colors ${startNow ? 'bg-[#51459d] text-white border-[#51459d]' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Start now
              </button>
              <button
                onClick={() => setStartNow(false)}
                className={`flex-1 py-2 text-xs rounded-[8px] border transition-colors ${!startNow ? 'bg-[#51459d] text-white border-[#51459d]' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Schedule
              </button>
            </div>
          </div>
          {!startNow && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none" />
              </div>
            </div>
          )}
          {startNow && (
            <div className="bg-[#51459d]/5 border border-[#51459d]/20 rounded-[8px] p-3">
              <p className="text-xs text-[#51459d] font-medium">Room name will be generated automatically</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Share the join link with participants after starting</p>
            </div>
          )}
          {createMeeting.isError && (
            <p className="text-xs text-red-500">Failed to create meeting. Please try again.</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={createMeeting.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            {createMeeting.isPending ? 'Creating…' : startNow ? 'Start Meeting' : 'Schedule Meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Active meeting view ──────────────────────────────────────────────────────

function ActiveMeetingView({ meeting, onLeave }: { meeting: ActiveMeetingState; onLeave: () => void }) {
  const joinUrl = `${meeting.jitsiRoomUrl}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true`
  const shareUrl = meeting.jitsiRoomUrl
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Meeting header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{meeting.title}</span>
        </div>
        <div className="flex-1" />
        <button onClick={copyLink} className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          {copied ? (
            <><svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
          ) : (
            <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy invite link</>
          )}
        </button>
        <button onClick={onLeave} className="flex items-center gap-1.5 text-xs bg-red-500 text-white px-3 py-1.5 rounded-[8px] hover:bg-red-600 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Leave
        </button>
      </div>

      {/* Jitsi iframe */}
      <div className="flex-1 bg-gray-900 relative">
        <iframe
          src={joinUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={meeting.title}
        />
        {/* Fallback overlay — only shows if Jitsi not reachable; iframe handles it */}
      </div>
    </div>
  )
}

// ─── Meeting card ─────────────────────────────────────────────────────────────

function MeetingCard({ meeting, onJoin, onViewSummary }: { meeting: Meeting; onJoin: (m: Meeting) => void; onViewSummary?: (id: string) => void }) {
  const status = deriveMeetingStatus(meeting)
  const duration = getDurationMinutes(meeting)
  const participants = meeting.attendees?.length ?? 0

  return (
    <div className={`bg-white dark:bg-gray-800 border rounded-[10px] p-4 transition-all hover:shadow-md ${status === 'live' ? 'border-red-200 bg-red-50/30' : 'border-gray-100 dark:border-gray-800'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            {status === 'live' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            )}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{meeting.title}</h3>
          </div>
          <p className="text-xs text-gray-500">{formatDateTime(meeting.start_time)}</p>
        </div>
        {status !== 'ended' && (
          <button
            onClick={() => onJoin(meeting)}
            className="shrink-0 flex items-center gap-1.5 text-xs bg-[#51459d] text-white px-3 py-1.5 rounded-[8px] hover:bg-[#3d3480] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Join
          </button>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          {participants} participants
        </div>
        {status === 'ended' && duration != null && (
          <div className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {duration} min
          </div>
        )}
        {status === 'ended' && onViewSummary && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewSummary(meeting.id) }}
            className="text-[#51459d] hover:underline text-[10px] font-medium ml-auto"
          >
            View Summary
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeetingState | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [lobbyMeeting, setLobbyMeeting] = useState<Meeting | null>(null)
  const [showRecurring, setShowRecurring] = useState(false)
  const [summaryMeetingId, setSummaryMeetingId] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)

  const { data } = useMeetings()
  const meetings = data?.meetings ?? []

  const upcoming = meetings.filter((m) => {
    const s = deriveMeetingStatus(m)
    return s === 'upcoming' || s === 'live'
  })
  const past = meetings.filter((m) => deriveMeetingStatus(m) === 'ended')

  const handleJoin = (meeting: Meeting) => {
    setLobbyMeeting(meeting)
  }

  if (lobbyMeeting && !activeMeeting) {
    return (
      <MeetingLobby
        meeting={lobbyMeeting}
        onJoin={(roomUrl) => {
          setActiveMeeting({ title: lobbyMeeting.title, jitsiRoomUrl: roomUrl })
          setLobbyMeeting(null)
        }}
        onCancel={() => setLobbyMeeting(null)}
      />
    )
  }

  if (activeMeeting) {
    return (
      <div className="relative h-full">
        <ActiveMeetingView meeting={activeMeeting} onLeave={() => setActiveMeeting(null)} />
        <InMeetingControls
          meetingTitle={activeMeeting.title}
          onLeave={() => setActiveMeeting(null)}
          onToggleChat={() => setShowChat(!showChat)}
          chatOpen={showChat}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - full width on mobile, fixed width on desktop */}
      <aside className="w-full md:w-72 shrink-0 bg-white dark:bg-gray-800 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 flex flex-col max-h-[50vh] md:max-h-none">
        <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800 space-y-2">
          <button
            onClick={() => setShowNew(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#51459d] hover:bg-[#3d3480] text-white text-sm font-medium rounded-[8px] px-4 py-2.5 min-h-[44px] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            New Meeting
          </button>
          <button
            onClick={() => setShowRecurring(true)}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-[8px] px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Recurring Meeting
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {(['upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${tab === t ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {t} {t === 'upcoming' ? `(${upcoming.length})` : `(${past.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {(tab === 'upcoming' ? upcoming : past).map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onJoin={handleJoin}
              onViewSummary={(id) => setSummaryMeetingId(id)}
            />
          ))}
          {(tab === 'upcoming' ? upcoming : past).length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">{tab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}</p>
              {tab === 'upcoming' && (
                <button onClick={() => setShowNew(true)} className="mt-2 text-xs text-[#51459d] hover:underline">Schedule one →</button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="text-center max-w-md w-full">
          <div className="w-20 h-20 rounded-3xl bg-[#51459d]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="h-10 w-10 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Urban Teams</h2>
          <p className="text-sm text-gray-500 mb-6">Start or join a meeting with your team. Powered by Jitsi Meet — no external accounts needed, fully self-hosted.</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => setShowNew(true)} className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] hover:border-[#51459d]/40 hover:shadow-md transition-all min-h-[100px]">
              <div className="w-10 h-10 rounded-2xl bg-[#51459d]/10 flex items-center justify-center">
                <svg className="h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">New Meeting</p>
                <p className="text-[10px] text-gray-400">Start instantly</p>
              </div>
            </button>
            <button
              onClick={() => {
                const link = prompt('Enter room name or meeting link:')
                if (link) {
                  setActiveMeeting({ title: 'Joined Meeting', jitsiRoomUrl: link })
                }
              }}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] hover:border-[#51459d]/40 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#3ec9d6]/10 flex items-center justify-center">
                <svg className="h-5 w-5 text-[#3ec9d6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Join by Link</p>
                <p className="text-[10px] text-gray-400">Enter meeting ID</p>
              </div>
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-4 text-left">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Powered by Jitsi Meet</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">Your meetings are hosted on your own server. No data leaves your infrastructure.</p>
          </div>
        </div>
      </div>

      {showNew && (
        <NewMeetingModal
          onClose={() => setShowNew(false)}
          onStart={(state) => { setActiveMeeting(state); setShowNew(false) }}
        />
      )}

      <RecurringMeetingSetup
        open={showRecurring}
        onClose={() => setShowRecurring(false)}
      />

      {summaryMeetingId && (
        <PostMeetingSummary
          meetingId={summaryMeetingId}
          onClose={() => setSummaryMeetingId(null)}
        />
      )}
    </div>
  )
}
