import { useState } from 'react'
import { useMeeting } from '../../api/meetings'
import {
  useMeetingAISummary,
  useMeetingRecording,
  useMeetingChatExport,
  type AISummaryResponse,
  type MeetingRecording,
  type MeetingChat,
} from '../../api/meetings_ext'

interface PostMeetingSummaryProps {
  meetingId: string
  onClose: () => void
}

export default function PostMeetingSummary({ meetingId, onClose }: PostMeetingSummaryProps) {
  const { data: meeting, isLoading: loadingMeeting } = useMeeting(meetingId)
  const { data: recordings } = useMeetingRecording(meetingId)
  const aiSummary = useMeetingAISummary()
  const chatExport = useMeetingChatExport()

  const [summary, setSummary] = useState<AISummaryResponse | null>(null)
  const [chats, setChats] = useState<MeetingChat[] | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'actions' | 'decisions' | 'chat' | 'recordings'>('summary')

  const handleGenerateSummary = () => {
    aiSummary.mutate(meetingId, {
      onSuccess: (data) => setSummary(data),
    })
  }

  const handleExportChat = () => {
    chatExport.mutate(meetingId, {
      onSuccess: (data) => setChats(data),
    })
  }

  if (loadingMeeting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-[10px] shadow-2xl p-8">
          <svg className="animate-spin h-6 w-6 text-[#51459d] mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      </div>
    )
  }

  if (!meeting) return null

  const duration = Math.round(
    (new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / 60000
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{meeting.title}</h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{new Date(meeting.start_time).toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                <span>{new Date(meeting.start_time).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.end_time).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{duration} min</span>
                {meeting.attendees && <span>{meeting.attendees.length} participants</span>}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Generate button */}
          {!summary && (
            <button
              onClick={handleGenerateSummary}
              disabled={aiSummary.isPending}
              className="mt-3 flex items-center gap-2 px-4 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
            >
              {aiSummary.isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating AI summary...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate AI Summary
                </>
              )}
            </button>
          )}

          {/* Tabs */}
          {summary && (
            <div className="flex gap-1 mt-3">
              {([
                { key: 'summary', label: 'Summary' },
                { key: 'actions', label: `Action Items${summary.action_items.length ? ` (${summary.action_items.length})` : ''}` },
                { key: 'decisions', label: `Decisions${summary.key_decisions.length ? ` (${summary.key_decisions.length})` : ''}` },
                { key: 'chat', label: 'Chat Log' },
                { key: 'recordings', label: `Recordings${recordings?.length ? ` (${recordings.length})` : ''}` },
              ] as { key: typeof activeTab; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key)
                    if (tab.key === 'chat' && !chats) handleExportChat()
                  }}
                  className={`px-3 py-1.5 text-[11px] rounded-[6px] font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-[#51459d]/10 text-[#51459d]'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!summary ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-[#51459d]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">
                Generate an AI summary to see meeting highlights, action items, and key decisions.
              </p>
            </div>
          ) : (
            <>
              {/* Summary tab */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI Summary
                    </h3>
                    <div className="bg-gray-50 rounded-[10px] p-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {summary.summary}
                      </p>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#51459d]/5 rounded-[10px] p-3 text-center">
                      <p className="text-lg font-bold text-[#51459d]">{duration}</p>
                      <p className="text-[10px] text-gray-500">Minutes</p>
                    </div>
                    <div className="bg-[#6fd943]/10 rounded-[10px] p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{summary.action_items.length}</p>
                      <p className="text-[10px] text-gray-500">Action Items</p>
                    </div>
                    <div className="bg-[#3ec9d6]/10 rounded-[10px] p-3 text-center">
                      <p className="text-lg font-bold text-cyan-700">{summary.key_decisions.length}</p>
                      <p className="text-[10px] text-gray-500">Decisions</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action items tab */}
              {activeTab === 'actions' && (
                <div className="space-y-2">
                  {summary.action_items.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No action items identified.</p>
                  ) : (
                    summary.action_items.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-[8px]">
                        <input type="checkbox" className="mt-0.5 rounded text-[#51459d] focus:ring-[#51459d]/40" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Decisions tab */}
              {activeTab === 'decisions' && (
                <div className="space-y-2">
                  {summary.key_decisions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No key decisions identified.</p>
                  ) : (
                    summary.key_decisions.map((dec, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-[8px]">
                        <svg className="h-4 w-4 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-gray-700">{dec}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Chat tab */}
              {activeTab === 'chat' && (
                <div className="space-y-2">
                  {chatExport.isPending ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    </div>
                  ) : !chats || chats.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No chat messages from this meeting.</p>
                  ) : (
                    chats.map((msg) => (
                      <div key={msg.id} className="flex items-start gap-2 py-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#51459d]/10 text-[#51459d] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-gray-700">{msg.sender_name}</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(msg.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{msg.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Recordings tab */}
              {activeTab === 'recordings' && (
                <div className="space-y-2">
                  {!recordings || recordings.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No recordings available.</p>
                  ) : (
                    recordings.map((rec: MeetingRecording) => (
                      <div key={rec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-[8px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[8px] bg-[#51459d]/10 flex items-center justify-center">
                            <svg className="h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-700">{rec.file_name}</p>
                            <p className="text-[10px] text-gray-400">
                              {Math.round(rec.duration_seconds / 60)} min
                              {' | '}
                              {(rec.file_size / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                        {rec.download_url && (
                          <button
                            onClick={() => window.open(rec.download_url!, '_blank')}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-[6px] text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            Download
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {summary && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
            <button
              onClick={() => {
                const text = [
                  `Meeting: ${meeting.title}`,
                  `Date: ${new Date(meeting.start_time).toLocaleDateString()}`,
                  '',
                  'Summary:',
                  summary.summary,
                  '',
                  'Action Items:',
                  ...summary.action_items.map((a, i) => `${i + 1}. ${a}`),
                  '',
                  'Key Decisions:',
                  ...summary.key_decisions.map((d, i) => `${i + 1}. ${d}`),
                ].join('\n')
                navigator.clipboard.writeText(text)
              }}
              className="text-xs text-[#51459d] hover:underline"
            >
              Copy as text
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
