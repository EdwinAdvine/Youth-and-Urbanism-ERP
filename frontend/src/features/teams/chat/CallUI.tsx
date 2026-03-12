import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  X,
  Users,
} from 'lucide-react'
import { useInitiateCall, useUpdateCall, useActiveCalls } from '@/api/chatExtended'
import { Button } from '@/components/ui/index'

// ── Types ────────────────────────────────────────────────────────────────────

interface CallParticipant {
  user_id: string
  user_name: string
  avatar_url?: string | null
  joined_at: string
}

interface ActiveCall {
  id: string
  channel_id: string
  call_type: 'audio' | 'video'
  status: 'ringing' | 'active' | 'ended'
  initiated_by: string
  initiated_by_name?: string
  jitsi_room?: string
  participants: CallParticipant[]
  started_at: string
}

interface IncomingCallData {
  callId: string
  callerName: string
  callType: 'audio' | 'video'
  channelName?: string
}

interface CallUIProps {
  channelId: string
  currentUserId: string
  incomingCall?: IncomingCallData | null
  onCallEnd?: () => void
  onDismissIncoming?: () => void
  jitsiDomain?: string
}

// ── Helper: format duration ──────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CallUI({
  channelId,
  currentUserId,
  incomingCall,
  onCallEnd,
  onDismissIncoming,
  jitsiDomain = 'localhost:8083',
}: CallUIProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'active'>('idle')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const jitsiIframeRef = useRef<HTMLIFrameElement>(null)

  const initiateCall = useInitiateCall()
  const updateCall = useUpdateCall()
  const { data: activeCalls } = useActiveCalls()

  // Find current active call for this channel
  const currentActiveCall = activeCalls?.find(
    (c: ActiveCall) => c.channel_id === channelId && c.status === 'active'
  )

  // Sync with server state
  useEffect(() => {
    if (currentActiveCall && callStatus !== 'active') {
      setActiveCallId(currentActiveCall.id)
      setCallStatus('active')
    }
  }, [currentActiveCall, callStatus])

  // Duration timer
  useEffect(() => {
    if (callStatus === 'active') {
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setElapsedSeconds(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callStatus])

  const handleStartCall = useCallback(
    (callType: 'audio' | 'video') => {
      setIsVideoOn(callType === 'video')
      initiateCall.mutate(
        { channel_id: channelId, call_type: callType },
        {
          onSuccess: (data: ActiveCall) => {
            setActiveCallId(data.id)
            setCallStatus('ringing')
            // Auto-transition to active after brief ringing
            setTimeout(() => setCallStatus('active'), 2000)
          },
        }
      )
    },
    [channelId, initiateCall]
  )

  const handleAcceptIncoming = useCallback(() => {
    if (!incomingCall) return
    updateCall.mutate(
      { callId: incomingCall.callId, action: 'accept' },
      {
        onSuccess: () => {
          setActiveCallId(incomingCall.callId)
          setCallStatus('active')
          setIsVideoOn(incomingCall.callType === 'video')
          onDismissIncoming?.()
        },
      }
    )
  }, [incomingCall, updateCall, onDismissIncoming])

  const handleDeclineIncoming = useCallback(() => {
    if (!incomingCall) return
    updateCall.mutate(
      { callId: incomingCall.callId, action: 'decline' },
      { onSuccess: () => onDismissIncoming?.() }
    )
  }, [incomingCall, updateCall, onDismissIncoming])

  const handleEndCall = useCallback(() => {
    if (!activeCallId) return
    updateCall.mutate(
      { callId: activeCallId, action: 'end' },
      {
        onSuccess: () => {
          setCallStatus('idle')
          setActiveCallId(null)
          setIsMuted(false)
          setIsVideoOn(false)
          setIsScreenSharing(false)
          onCallEnd?.()
        },
      }
    )
  }, [activeCallId, updateCall, onCallEnd])

  const jitsiRoom = currentActiveCall?.jitsi_room || `urban-erp-${channelId}-${activeCallId || ''}`

  // ── Incoming call banner ───────────────────────────────────────────────────

  if (incomingCall && callStatus === 'idle') {
    return (
      <div className="relative overflow-hidden rounded-[10px] border border-[#51459d]/20 bg-gradient-to-r from-[#51459d] to-[#51459d]/80 text-white p-4 mx-4 mt-2 shadow-lg">
        {/* Ringing animation */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-8 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 animate-ping" />
          <div
            className="absolute top-1/2 left-8 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 animate-ping"
            style={{ animationDelay: '0.5s' }}
          />
        </div>

        <div className="relative flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              {incomingCall.callType === 'video' ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{incomingCall.callerName}</p>
            <p className="text-xs text-white/80">
              Incoming {incomingCall.callType} call
              {incomingCall.channelName ? ` in ${incomingCall.channelName}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptIncoming}
              className="w-10 h-10 rounded-full bg-[#6fd943] hover:bg-[#6fd943]/90 flex items-center justify-center transition-colors shadow-md"
              title="Accept"
            >
              <Phone className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleDeclineIncoming}
              className="w-10 h-10 rounded-full bg-[#ff3a6e] hover:bg-[#ff3a6e]/90 flex items-center justify-center transition-colors shadow-md"
              title="Decline"
            >
              <PhoneOff className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Active call overlay ────────────────────────────────────────────────────

  if (callStatus === 'active' && activeCallId) {
    return (
      <div className="flex flex-col h-full bg-gray-900">
        {/* Top banner */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#6fd943] animate-pulse" />
            <span className="text-sm font-medium">{formatDuration(elapsedSeconds)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            <span>
              {currentActiveCall?.participants?.length || 1}{' '}
              {(currentActiveCall?.participants?.length || 1) === 1
                ? 'participant'
                : 'participants'}
            </span>
          </div>
          <button
            onClick={handleEndCall}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Jitsi iframe */}
        <div className="flex-1 relative bg-black">
          <iframe
            ref={jitsiIframeRef}
            src={`https://${jitsiDomain}/${jitsiRoom}#config.startWithAudioMuted=${isMuted}&config.startWithVideoMuted=${!isVideoOn}&interfaceConfig.TOOLBAR_BUTTONS=[]&interfaceConfig.FILM_STRIP_MAX_HEIGHT=0`}
            className="w-full h-full border-0"
            allow="camera; microphone; display-capture; autoplay; fullscreen"
            title="Video call"
          />
        </div>

        {/* Call action buttons */}
        <div className="flex items-center justify-center gap-3 px-4 py-4 bg-gray-800">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isMuted
                ? 'bg-[#ff3a6e] text-white'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              !isVideoOn
                ? 'bg-[#ff3a6e] text-white'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isScreenSharing
                ? 'bg-[#3ec9d6] text-white'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button
            onClick={handleEndCall}
            className="w-14 h-12 rounded-full bg-[#ff3a6e] hover:bg-[#ff3a6e]/90 text-white flex items-center justify-center transition-colors shadow-md"
            title="End call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  // ── Ringing state (outgoing) ───────────────────────────────────────────────

  if (callStatus === 'ringing') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        {/* Pulsing ring animation */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-[#51459d]/10 flex items-center justify-center">
            <Phone className="w-8 h-8 text-[#51459d]" />
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-[#51459d]/30 animate-ping" />
          <div
            className="absolute inset-0 w-20 h-20 rounded-full border-2 border-[#51459d]/15 animate-ping"
            style={{ animationDelay: '0.75s' }}
          />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">Calling...</p>
        <p className="text-xs text-gray-500 mb-6">Waiting for answer</p>
        <button
          onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-[#ff3a6e] hover:bg-[#ff3a6e]/90 text-white flex items-center justify-center transition-colors shadow-md"
          title="Cancel call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    )
  }

  // ── Idle state: start call buttons ─────────────────────────────────────────

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleStartCall('audio')}
        loading={initiateCall.isPending}
      >
        <Phone className="w-4 h-4" />
        Audio Call
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleStartCall('video')}
        loading={initiateCall.isPending}
      >
        <Video className="w-4 h-4" />
        Video Call
      </Button>
    </div>
  )
}
