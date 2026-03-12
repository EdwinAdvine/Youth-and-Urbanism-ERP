import { useState } from 'react'
import { MessageSquare, Video, Calendar } from 'lucide-react'
import {
  useMeetings,
  useCreateMeeting,
  type Meeting,
  type CreateMeetingResponse,
} from '../../api/meetings'
import { useChannel } from '../../api/chat'
import { useChatStore } from '../../store/chat'
import { useChatWebSocket } from '../../hooks/useChatWebSocket'
import { useAuthStore } from '../../store/auth'
import MeetingLobby from './MeetingLobby'
import InMeetingControls from './InMeetingControls'
import RecurringMeetingSetup from './RecurringMeetingSetup'
import PostMeetingSummary from './PostMeetingSummary'
import ChatSidebar from './chat/ChatSidebar'
import ChatPanel from './chat/ChatPanel'
import ThreadPanel from './chat/ThreadPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveMeetingState {
  title: string
  jitsiRoomUrl: string
}

type MainView = 'chat' | 'meetings'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function deriveMeetingStatus(meeting: Meeting): 'upcoming' | 'live' | 'ended' {
  const now = new Date()
  const start = new Date(meeting.start_time)
  const end = new Date(meeting.end_time)
  if (now < start) return 'upcoming'
  if (now >= start && now <= end) return 'live'
  return 'ended'
}

// ─── Meeting Components ──────────────────────────────────────────────────────

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
      { title: title || 'Quick Meeting', start_time: startTime, end_time: endTime },
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
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">New Meeting</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Meeting title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Team Sync" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">When</label>
            <div className="flex gap-2">
              <button onClick={() => setStartNow(true)} className={`flex-1 py-2 text-xs rounded-[8px] border transition-colors ${startNow ? 'bg-[#51459d] text-white border-[#51459d]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Start now</button>
              <button onClick={() => setStartNow(false)} className={`flex-1 py-2 text-xs rounded-[8px] border transition-colors ${!startNow ? 'bg-[#51459d] text-white border-[#51459d]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Schedule</button>
            </div>
          </div>
          {!startNow && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-600 block mb-1">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none" /></div>
              <div><label className="text-xs text-gray-600 block mb-1">Time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none" /></div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px]">Cancel</button>
          <button onClick={handleCreate} disabled={createMeeting.isPending} className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50">
            {createMeeting.isPending ? 'Creating...' : startNow ? 'Start Meeting' : 'Schedule Meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActiveMeetingView({ meeting, onLeave }: { meeting: ActiveMeetingState; onLeave: () => void }) {
  const joinUrl = `${meeting.jitsiRoomUrl}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true`
  const [copied, setCopied] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText(meeting.jitsiRoomUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold text-gray-900">{meeting.title}</span>
        </div>
        <div className="flex-1" />
        <button onClick={copyLink} className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-[8px] hover:bg-gray-50">
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
        <button onClick={onLeave} className="flex items-center gap-1.5 text-xs bg-red-500 text-white px-3 py-1.5 rounded-[8px] hover:bg-red-600">Leave</button>
      </div>
      <div className="flex-1 bg-gray-900 relative">
        <iframe src={joinUrl} allow="camera; microphone; fullscreen; display-capture; autoplay" style={{ width: '100%', height: '100%', border: 'none' }} title={meeting.title} />
      </div>
      <InMeetingControls meetingTitle={meeting.title} onLeave={onLeave} onToggleChat={() => setShowChat(!showChat)} chatOpen={showChat} />
    </div>
  )
}

function MeetingsList({ onJoin, onViewSummary }: { onJoin: (m: Meeting) => void; onViewSummary: (id: string) => void }) {
  const { data } = useMeetings()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [showNew, setShowNew] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)

  const meetings = data?.meetings ?? []
  const upcoming = meetings.filter((m) => { const s = deriveMeetingStatus(m); return s === 'upcoming' || s === 'live' })
  const past = meetings.filter((m) => deriveMeetingStatus(m) === 'ended')
  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 space-y-2">
        <button onClick={() => setShowNew(true)} className="w-full flex items-center justify-center gap-2 bg-[#51459d] hover:bg-[#3d3480] text-white text-sm font-medium rounded-[8px] px-4 py-2.5 transition-colors">
          <Video className="w-4 h-4" /> New Meeting
        </button>
        <button onClick={() => setShowRecurring(true)} className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-[8px] px-4 py-2 hover:bg-gray-50">
          <Calendar className="w-3.5 h-3.5" /> Recurring
        </button>
      </div>
      <div className="flex border-b border-gray-200">
        {(['upcoming', 'past'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-xs font-medium capitalize ${tab === t ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-500 hover:text-gray-700'}`}>
            {t} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {list.map((meeting) => {
          const status = deriveMeetingStatus(meeting)
          return (
            <div key={meeting.id} className={`bg-white border rounded-[10px] p-4 hover:shadow-md transition-all ${status === 'live' ? 'border-red-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    {status === 'live' && <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE</span>}
                    <h3 className="text-sm font-semibold text-gray-900">{meeting.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{formatDateTime(meeting.start_time)}</p>
                </div>
                {status !== 'ended' && (
                  <button onClick={() => onJoin(meeting)} className="text-xs bg-[#51459d] text-white px-3 py-1.5 rounded-[8px] hover:bg-[#3d3480]">Join</button>
                )}
              </div>
              {status === 'ended' && (
                <button onClick={() => onViewSummary(meeting.id)} className="text-[10px] text-[#51459d] hover:underline">View Summary</button>
              )}
            </div>
          )
        })}
        {list.length === 0 && <p className="text-center text-sm text-gray-400 py-8">{tab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}</p>}
      </div>
      {showNew && <NewMeetingModal onClose={() => setShowNew(false)} onStart={(state) => { onJoin({ id: '', title: state.title, start_time: new Date().toISOString(), end_time: new Date().toISOString(), description: null, location: null, attendees: null, color: null, jitsi_room: state.jitsiRoomUrl, organizer_id: '', created_at: '', updated_at: '' } as Meeting); setShowNew(false) }} />}
      <RecurringMeetingSetup open={showRecurring} onClose={() => setShowRecurring(false)} />
    </div>
  )
}

// ─── Main Teams Hub ──────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [mainView, setMainView] = useState<MainView>('chat')
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeetingState | null>(null)
  const [lobbyMeeting, setLobbyMeeting] = useState<Meeting | null>(null)
  const [summaryMeetingId, setSummaryMeetingId] = useState<string | null>(null)

  const activeChannelId = useChatStore((s) => s.activeChannelId)
  const activeThreadId = useChatStore((s) => s.activeThreadId)
  const isThreadPanelOpen = useChatStore((s) => s.isThreadPanelOpen)

  // Get auth info
  const token = useAuthStore((s) => s.token) || ''
  const user = useAuthStore((s) => s.user)
  const currentUserId = user?.id || ''

  // Get active channel data
  const { data: activeChannel } = useChannel(activeChannelId || '')

  // WebSocket connection
  const { sendTyping } = useChatWebSocket({
    token,
    enabled: !!token,
  })

  // Meeting flow
  const handleJoinMeeting = (meeting: Meeting) => setLobbyMeeting(meeting)

  if (lobbyMeeting && !activeMeeting) {
    return (
      <MeetingLobby
        meeting={lobbyMeeting}
        onJoin={(roomUrl) => { setActiveMeeting({ title: lobbyMeeting.title, jitsiRoomUrl: roomUrl }); setLobbyMeeting(null) }}
        onCancel={() => setLobbyMeeting(null)}
      />
    )
  }

  if (activeMeeting) {
    return <ActiveMeetingView meeting={activeMeeting} onLeave={() => setActiveMeeting(null)} />
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Chat Sidebar — always visible */}
      <ChatSidebar currentUserId={currentUserId} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View toggle */}
        <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-200">
          <button
            onClick={() => setMainView('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              mainView === 'chat'
                ? 'bg-[#51459d]/10 text-[#51459d]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </button>
          <button
            onClick={() => setMainView('meetings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              mainView === 'meetings'
                ? 'bg-[#51459d]/10 text-[#51459d]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Video className="w-3.5 h-3.5" /> Meetings
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {mainView === 'chat' ? (
            <>
              {/* Chat panel */}
              <div className="flex-1 min-w-0">
                {activeChannel ? (
                  <ChatPanel
                    channel={activeChannel}
                    currentUserId={currentUserId}
                    sendTypingWs={sendTyping}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <div className="w-20 h-20 rounded-3xl bg-[#51459d]/10 flex items-center justify-center">
                      <MessageSquare className="w-10 h-10 text-[#51459d]" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Y&U Teams</h2>
                    <p className="text-sm text-gray-500 max-w-xs text-center">
                      Select a channel or start a conversation. Every chat is connected to your entire ERP.
                    </p>
                  </div>
                )}
              </div>

              {/* Thread panel */}
              {isThreadPanelOpen && activeThreadId && (
                <ThreadPanel
                  messageId={activeThreadId}
                  currentUserId={currentUserId}
                  sendTypingWs={sendTyping}
                />
              )}
            </>
          ) : (
            <div className="flex-1">
              <MeetingsList
                onJoin={handleJoinMeeting}
                onViewSummary={(id) => setSummaryMeetingId(id)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Post-meeting summary modal */}
      {summaryMeetingId && (
        <PostMeetingSummary
          meetingId={summaryMeetingId}
          onClose={() => setSummaryMeetingId(null)}
        />
      )}
    </div>
  )
}
