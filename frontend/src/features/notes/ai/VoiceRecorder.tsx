import { useRef, useState, useEffect, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import apiClient from '../../../api/client'

interface VoiceRecorderProps {
  onTranscribed: (noteId: string) => void
  onClose: () => void
}

type RecordingState = 'idle' | 'recording' | 'processing'

interface TranscribeResponse {
  note_id: string
  title: string
}

export default function VoiceRecorder({ onTranscribed, onClose }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      const { data } = await apiClient.post<TranscribeResponse>('/notes/ai/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      onTranscribed(data.note_id)
    },
    onError: () => {
      setError('Transcription failed. Please try again.')
      setRecordingState('idle')
    },
  })

  useEffect(() => {
    return () => {
      stopTimer()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const startTimer = () => {
    setElapsedSeconds(0)
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecordingState('processing')
        transcribeMutation.mutate(blob)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      mediaRecorder.start()
      setRecordingState('recording')
      startTimer()
    } catch {
      setError('Microphone access denied. Please allow microphone access.')
    }
  }, [transcribeMutation])

  const stopRecording = useCallback(() => {
    stopTimer()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  return (
    <div
      style={{
        width: 300,
        fontFamily: 'Open Sans, sans-serif',
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#51459d',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Voice Recorder</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: 0,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '28px 18px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {/* State label */}
        <div style={{ fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
          {recordingState === 'idle' && 'Ready to record'}
          {recordingState === 'recording' && 'Recording...'}
          {recordingState === 'processing' && 'Transcribing...'}
        </div>

        {/* Timer */}
        {recordingState === 'recording' && (
          <div style={{ fontSize: 32, fontWeight: 700, color: '#ff3a6e', letterSpacing: 2 }}>
            {formatTime(elapsedSeconds)}
          </div>
        )}

        {/* Record button / spinner */}
        {recordingState === 'processing' ? (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #51459d',
              animation: 'spin 1s linear infinite',
            }}
          />
        ) : (
          <button
            onClick={recordingState === 'idle' ? startRecording : stopRecording}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: recordingState === 'recording' ? '#ff3a6e' : '#51459d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                recordingState === 'recording'
                  ? '0 0 0 8px rgba(255,58,110,0.2), 0 0 0 16px rgba(255,58,110,0.1)'
                  : '0 4px 12px rgba(81,69,157,0.4)',
              transition: 'box-shadow 0.3s ease, background 0.3s ease',
              animation: recordingState === 'recording' ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
            aria-label={recordingState === 'idle' ? 'Start recording' : 'Stop recording'}
          >
            {recordingState === 'idle' ? (
              // Mic icon
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"
                  fill="#fff"
                />
                <path
                  d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              // Stop icon
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="16" height="16" rx="2" fill="#fff" />
              </svg>
            )}
          </button>
        )}

        {/* Instruction */}
        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
          {recordingState === 'idle' && 'Click the microphone to start recording'}
          {recordingState === 'recording' && 'Click the stop button when done'}
          {recordingState === 'processing' && 'Please wait while we transcribe your audio'}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              width: '100%',
              background: '#fff0f3',
              border: '1px solid #ff3a6e',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              color: '#ff3a6e',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 8px rgba(255,58,110,0.2), 0 0 0 16px rgba(255,58,110,0.1); }
          50% { box-shadow: 0 0 0 14px rgba(255,58,110,0.25), 0 0 0 24px rgba(255,58,110,0.08); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
