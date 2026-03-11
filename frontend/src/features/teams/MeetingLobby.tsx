import { useState } from 'react'
import {
  type Meeting,
  type VirtualBackground,
  useJoinMeeting,
  useLobbySettings,
} from '../../api/meetings'
import VirtualBackgrounds from './VirtualBackgrounds'

interface MeetingLobbyProps {
  meeting: Meeting
  onJoin: (roomUrl: string) => void
  onCancel: () => void
}

export default function MeetingLobby({ meeting, onJoin, onCancel }: MeetingLobbyProps) {
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [selectedBg, setSelectedBg] = useState<VirtualBackground | null>(null)
  const joinMeeting = useJoinMeeting()
  const { data: lobbySettings } = useLobbySettings()

  const isLive = new Date(meeting.start_time) <= new Date() && new Date(meeting.end_time) >= new Date()
  const isUpcoming = new Date(meeting.start_time) > new Date()

  const bgColor = lobbySettings?.background_color || '#111827'
  const welcomeMsg = lobbySettings?.welcome_message || ''
  const logoUrl = lobbySettings?.logo_url || ''

  const handleJoin = () => {
    joinMeeting.mutate(meeting.id, {
      onSuccess: (data) => {
        const params = new URLSearchParams()
        if (!audioEnabled) params.set('config.startWithAudioMuted', 'true')
        if (!videoEnabled) params.set('config.startWithVideoMuted', 'true')
        if (displayName) params.set('userInfo.displayName', displayName)
        // Pass virtual background config to Jitsi
        if (selectedBg) {
          if (selectedBg.type === 'blur') {
            params.set('config.backgroundAlpha', '0.5')
          }
          // For image/color backgrounds, the Jitsi IFrame API config will be
          // handled by the embedding component.  We pass it as a hint.
          params.set('virtualBackground', selectedBg.id)
        }
        const url = `${data.room_url}#${params.toString()}`
        onJoin(url)
      },
    })
  }

  return (
    <div
      className="h-full flex items-center justify-center p-4 transition-colors"
      style={{ backgroundColor: bgColor }}
    >
      <div className="w-full max-w-3xl flex flex-col md:flex-row gap-6 items-center">
        {/* Video preview */}
        <div className="w-80 shrink-0 space-y-3">
          <div className="w-full h-60 bg-gray-800 rounded-[10px] flex flex-col items-center justify-center relative overflow-hidden">
            {videoEnabled ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={
                  selectedBg?.type === 'color'
                    ? { backgroundColor: selectedBg.url }
                    : selectedBg?.type === 'image'
                    ? {
                        backgroundImage: `url(${selectedBg.url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : selectedBg?.type === 'blur'
                    ? { background: 'linear-gradient(135deg, rgba(107,114,128,0.5), rgba(55,65,81,0.5))' }
                    : { background: 'linear-gradient(135deg, #374151, #1f2937)' }
                }
              >
                <div className="w-20 h-20 rounded-full bg-[#51459d]/30 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {(displayName || 'You').charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                  <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500">Camera off</p>
              </div>
            )}

            {/* Toggle controls on preview */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {audioEnabled ? (
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setVideoEnabled(!videoEnabled)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {videoEnabled ? (
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Virtual Backgrounds Selector */}
          <VirtualBackgrounds
            selected={selectedBg?.id ?? null}
            onSelect={setSelectedBg}
          />
        </div>

        {/* Meeting info & join */}
        <div className="flex-1 text-center md:text-left">
          {/* Branding */}
          <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-[8px] bg-[#51459d] flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <span className="text-sm font-bold text-white">Urban Teams</span>
          </div>

          <h1 className="text-xl font-bold text-white mb-1">{meeting.title}</h1>

          {/* Status */}
          {isLive && (
            <div className="flex items-center gap-1.5 mb-3 justify-center md:justify-start">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Meeting in progress</span>
            </div>
          )}
          {isUpcoming && (
            <p className="text-xs text-gray-400 mb-3">
              Starts {new Date(meeting.start_time).toLocaleString()}
            </p>
          )}

          {/* Welcome message from lobby settings */}
          {welcomeMsg && (
            <p className="text-sm text-gray-400 mb-3 italic">{welcomeMsg}</p>
          )}

          {meeting.description && (
            <p className="text-sm text-gray-400 mb-4 line-clamp-2">{meeting.description}</p>
          )}

          {/* Participants */}
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Participants</p>
              <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                {meeting.attendees.slice(0, 8).map((a, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-[#51459d]/20 text-[#51459d] flex items-center justify-center text-xs font-bold border-2 border-gray-800"
                    title={a}
                  >
                    {a.charAt(0).toUpperCase()}
                  </div>
                ))}
                {meeting.attendees.length > 8 && (
                  <div className="w-8 h-8 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center text-[10px] font-bold border-2 border-gray-800">
                    +{meeting.attendees.length - 8}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Display name */}
          <div className="mb-4">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name (optional)"
              className="w-full md:w-64 px-3 py-2 text-sm bg-gray-800 border border-gray-700 text-white rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/60 placeholder:text-gray-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <button
              onClick={handleJoin}
              disabled={joinMeeting.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#51459d] text-white text-sm font-medium rounded-[10px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
            >
              {joinMeeting.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Joining...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Join Meeting
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>

          {joinMeeting.isError && (
            <p className="text-xs text-red-400 mt-2">Failed to join meeting. Please try again.</p>
          )}

          <p className="text-[10px] text-gray-600 mt-4">
            Self-hosted on your infrastructure via Jitsi Meet
          </p>
        </div>
      </div>
    </div>
  )
}
