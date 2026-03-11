import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Augment the Window interface to include the webkit-prefixed SpeechRecognition
 * constructor that Chrome and other WebKit-based browsers expose.
 */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onspeechend: (() => void) | null
  onstart: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export interface UseVoiceInputReturn {
  /** Whether the recogniser is actively listening */
  isListening: boolean
  /** The latest final transcript produced by the recogniser */
  transcript: string
  /** Begin listening – requests microphone permission if needed */
  startListening: () => void
  /** Stop listening manually */
  stopListening: () => void
  /** Human-readable error string, or null */
  error: string | null
  /** Whether the Web Speech API is available in this browser */
  isSupported: boolean
}

/**
 * Custom hook wrapping the Web Speech API for voice-to-text input.
 *
 * Handles the `webkitSpeechRecognition` prefix for Chrome and auto-stops
 * after the user pauses speaking.
 */
export function useVoiceInput(lang = 'en-US'): UseVoiceInputReturn {
  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined

  const isSupported = Boolean(SpeechRecognitionCtor)

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Build recognition instance once
  useEffect(() => {
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false // auto-stop after silence
    recognition.interimResults = false
    recognition.lang = lang

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1]
      if (lastResult?.isFinal) {
        setTranscript(lastResult[0].transcript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" is not a real error – the user called stop()
      if (event.error !== 'aborted') {
        setError(event.error === 'not-allowed'
          ? 'Microphone access denied. Please allow microphone permission.'
          : `Speech recognition error: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
    }
  }, [SpeechRecognitionCtor, lang])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser.')
      return
    }
    setError(null)
    setTranscript('')
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      // Already started – ignore
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  return { isListening, transcript, startListening, stopListening, error, isSupported }
}
