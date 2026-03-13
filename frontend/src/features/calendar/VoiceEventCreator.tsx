import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

interface ParsedEvent {
  title: string
  start_time: string
  end_time: string
  description?: string
  location?: string
  attendees?: string[]
}

interface VoiceEventCreatorProps {
  onEventCreate?: (event: ParsedEvent) => void
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const hasSpeechAPI = typeof window !== 'undefined' && (
  'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
)

export default function VoiceEventCreator({ onEventCreate }: VoiceEventCreatorProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState<ParsedEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const parseEvent = useMutation({
    mutationFn: (text: string) =>
      axios.post<{ event: ParsedEvent }>('/api/v1/calendar/ai/parse', { text }).then(r => r.data.event),
    onSuccess: (data) => setParsed(data),
    onError: () => setError('Could not parse event. Try again.'),
  })

  const createEvent = useMutation({
    mutationFn: (event: ParsedEvent) =>
      axios.post('/api/v1/calendar/events', event).then(r => r.data),
    onSuccess: (data) => {
      onEventCreate?.(data)
      setParsed(null)
      setTranscript('')
    },
  })

  const startListening = useCallback(() => {
    if (!hasSpeechAPI) {
      setError('Voice input is not supported in this browser.')
      return
    }
    setError(null)
    setParsed(null)
    setTranscript('')

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    recognition.onerror = (e) => {
      setIsListening(false)
      setError(`Voice error: ${e.error}`)
    }
    recognition.onresult = (e) => {
      let final = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript
        } else {
          interim += e.results[i][0].transcript
        }
      }
      setTranscript(final || interim)
      if (final) {
        parseEvent.mutate(final)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [parseEvent])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-3">
      {/* Microphone button */}
      <div className="flex flex-col items-center gap-3 py-4">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={parseEvent.isPending || createEvent.isPending}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse'
              : 'bg-[#51459d] hover:bg-[#3d3480]'
          } disabled:opacity-50`}
        >
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
        <p className="text-xs text-gray-500 text-center">
          {isListening
            ? 'Listening… speak your event'
            : 'Tap to speak — "Schedule finance review with Amina next Tuesday at 2pm"'}
        </p>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Heard</p>
          <p className="text-sm text-gray-700 dark:text-gray-200 italic">"{transcript}"</p>
        </div>
      )}

      {/* Parsing indicator */}
      {parseEvent.isPending && (
        <div className="flex items-center gap-2 text-xs text-[#51459d]">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
          Parsing event with AI…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-xs px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* Parsed event preview */}
      {parsed && (
        <div className="border border-[#51459d]/30 bg-[#51459d]/5 rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-[#51459d] uppercase tracking-wider font-semibold">Event Preview</p>

          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{parsed.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDateTime(parsed.start_time)} → {formatDateTime(parsed.end_time)}
            </p>
            {parsed.location && (
              <p className="text-xs text-gray-500 mt-0.5">📍 {parsed.location}</p>
            )}
            {parsed.description && (
              <p className="text-xs text-gray-400 mt-1">{parsed.description}</p>
            )}
            {parsed.attendees && parsed.attendees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {parsed.attendees.map(a => (
                  <span key={a} className="text-[9px] px-1.5 py-0.5 bg-[#51459d]/10 text-[#51459d] rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => createEvent.mutate(parsed)}
              disabled={createEvent.isPending}
              className="flex-1 py-1.5 text-xs bg-[#51459d] text-white rounded-lg hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              {createEvent.isPending ? 'Creating…' : 'Create Event'}
            </button>
            <button
              onClick={() => { setParsed(null); setTranscript('') }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {!hasSpeechAPI && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
          Voice input requires Chrome, Edge, or Safari. Use text input instead.
        </p>
      )}
    </div>
  )
}
