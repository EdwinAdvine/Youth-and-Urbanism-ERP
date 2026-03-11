import { useState } from 'react'

interface InMeetingControlsProps {
  meetingTitle: string
  onLeave: () => void
  onToggleChat?: () => void
  chatOpen?: boolean
}

export default function InMeetingControls({
  meetingTitle,
  onLeave,
  onToggleChat,
  chatOpen = false,
}: InMeetingControlsProps) {
  const [audioMuted, setAudioMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Timer
  useState(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  })

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex justify-center pb-6">
        <div className="pointer-events-auto bg-gray-900/95 backdrop-blur-lg rounded-2xl px-4 py-3 flex items-center gap-2 shadow-2xl border border-gray-700/50">
          {/* Meeting info */}
          <div className="flex items-center gap-2 mr-2 pr-3 border-r border-gray-700">
            {recording && (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className="text-xs text-gray-300 font-medium max-w-[120px] truncate">
              {meetingTitle}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              {formatElapsed(elapsed)}
            </span>
          </div>

          {/* Mute */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              audioMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-700/60 text-white hover:bg-gray-600/60'
            }`}
            title={audioMuted ? 'Unmute' : 'Mute'}
          >
            {audioMuted ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Camera */}
          <button
            onClick={() => setVideoOff(!videoOff)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              videoOff
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-700/60 text-white hover:bg-gray-600/60'
            }`}
            title={videoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {videoOff ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Screen share */}
          <button
            onClick={() => setScreenSharing(!screenSharing)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              screenSharing
                ? 'bg-[#51459d]/30 text-[#51459d] hover:bg-[#51459d]/40 ring-2 ring-[#51459d]/50'
                : 'bg-gray-700/60 text-white hover:bg-gray-600/60'
            }`}
            title={screenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Chat */}
          <button
            onClick={onToggleChat}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              chatOpen
                ? 'bg-[#51459d]/30 text-[#51459d] hover:bg-[#51459d]/40'
                : 'bg-gray-700/60 text-white hover:bg-gray-600/60'
            }`}
            title="Chat"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>

          {/* Record */}
          <button
            onClick={() => setRecording(!recording)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              recording
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-700/60 text-white hover:bg-gray-600/60'
            }`}
            title={recording ? 'Stop recording' : 'Start recording'}
          >
            {recording ? (
              <div className="w-4 h-4 rounded-sm bg-red-400" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-red-400" />
            )}
          </button>

          {/* More */}
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-10 h-10 rounded-full bg-gray-700/60 text-white hover:bg-gray-600/60 flex items-center justify-center transition-colors"
              title="More options"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMore && (
              <>
                <div className="fixed inset-0" onClick={() => setShowMore(false)} />
                <div className="absolute bottom-14 right-0 bg-gray-800 rounded-[10px] border border-gray-700 shadow-xl py-1.5 min-w-[180px] z-50">
                  <button className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                    Full screen
                  </button>
                  <button className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                    Meeting info
                  </button>
                  <button className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                    Participants
                  </button>
                  <button className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                    Settings
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                    Report a problem
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Divider + Leave */}
          <div className="w-px h-8 bg-gray-700 mx-1" />
          <button
            onClick={onLeave}
            className="h-10 px-4 rounded-full bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}
