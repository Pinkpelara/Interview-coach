'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Clock,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  avatarColor: string
  initials: string
  voiceId: string
}

interface ChatMessage {
  id: string
  speaker: string
  speakerName: string
  text: string
  timestamp: number
  avatarColor?: string
  isCandidate: boolean
}

interface SessionData {
  id: string
  applicationId: string
  companyName: string
  jobTitle: string
  stage: string
  intensity: string
  targetDurationMin: number
  characters: Character[]
  status: string
}

// ---------------------------------------------------------------------------
// TTS helper — tries server TTS, falls back to browser speechSynthesis
// ---------------------------------------------------------------------------

// Voice style instructions per archetype to make TTS sound more natural/human
const ARCHETYPE_VOICE_INSTRUCTIONS: Record<string, string> = {
  skeptic: 'Speak in a measured, deliberate tone. Slightly slower pace. Occasional pauses for emphasis. Professional and serious.',
  friendly_champion: 'Speak warmly and conversationally. Natural pace with slight enthusiasm. Friendly and encouraging tone.',
  technical_griller: 'Speak precisely and directly. Moderate pace. Matter-of-fact tone. Clear enunciation.',
  distracted_senior: 'Speak casually with natural pace variations. Sometimes trail off slightly. Executive, slightly impatient tone.',
  culture_fit: 'Speak in a warm, approachable tone. Genuine curiosity in voice. Conversational and relaxed.',
  silent_observer: 'Speak quietly and briefly. Low energy. Minimal inflection. Reserved.',
}

// Preferred voice IDs for more natural-sounding output per archetype
const ARCHETYPE_PREFERRED_VOICES: Record<string, string> = {
  skeptic: 'onyx',        // deeper, authoritative male voice
  friendly_champion: 'nova',  // warm, friendly female voice
  technical_griller: 'echo',  // clear, precise male voice
  distracted_senior: 'fable', // mature male voice
  culture_fit: 'shimmer',     // warm, approachable female voice
  silent_observer: 'alloy',   // neutral voice
}

async function speakText(
  text: string,
  voiceId: string,
  speakerEnabled: boolean,
  onStart: () => void,
  onEnd: () => void,
  archetype?: string
): Promise<void> {
  if (!speakerEnabled) {
    onStart()
    // Simulate speaking duration based on text length
    await new Promise(r => setTimeout(r, Math.min(text.length * 50, 5000)))
    onEnd()
    return
  }

  // Use archetype-specific voice instructions for more natural speech
  const instructions = archetype ? ARCHETYPE_VOICE_INSTRUCTIONS[archetype] || '' : ''
  // Use archetype-preferred voice if the assigned voice is generic
  const effectiveVoice = archetype && ARCHETYPE_PREFERRED_VOICES[archetype]
    ? ARCHETYPE_PREFERRED_VOICES[archetype]
    : voiceId

  // Try server TTS first
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: effectiveVoice,
        instructions,
      }),
    })
    if (res.ok && res.headers.get('content-type')?.includes('audio/')) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      return new Promise<void>((resolve) => {
        audio.onplay = onStart
        audio.onended = () => { onEnd(); URL.revokeObjectURL(url); resolve() }
        audio.onerror = () => { onEnd(); URL.revokeObjectURL(url); resolve() }
        audio.play().catch(() => { onEnd(); URL.revokeObjectURL(url); resolve() })
      })
    }
  } catch {
    // Server TTS not available, fall through to browser
  }

  // Fallback: browser speechSynthesis with improved settings
  if ('speechSynthesis' in window) {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)

      // Try to pick a more natural-sounding voice from available browser voices
      const voices = window.speechSynthesis.getVoices()
      const preferredVoices = voices.filter(v =>
        v.lang.startsWith('en') && (
          v.name.includes('Google') ||
          v.name.includes('Natural') ||
          v.name.includes('Neural') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.name.includes('Karen') ||
          v.name.includes('Moira')
        )
      )
      if (preferredVoices.length > 0) {
        // Pick different voices for different archetypes
        const voiceIndex = archetype
          ? Object.keys(ARCHETYPE_VOICE_INSTRUCTIONS).indexOf(archetype) % preferredVoices.length
          : 0
        utterance.voice = preferredVoices[voiceIndex]
      }

      // Archetype-specific speech tuning for browser fallback
      switch (archetype) {
        case 'skeptic':
          utterance.rate = 0.88
          utterance.pitch = 0.9
          break
        case 'friendly_champion':
          utterance.rate = 1.0
          utterance.pitch = 1.1
          break
        case 'technical_griller':
          utterance.rate = 0.92
          utterance.pitch = 0.95
          break
        case 'distracted_senior':
          utterance.rate = 1.05
          utterance.pitch = 0.95
          break
        case 'culture_fit':
          utterance.rate = 0.95
          utterance.pitch = 1.05
          break
        case 'silent_observer':
          utterance.rate = 0.85
          utterance.pitch = 0.85
          utterance.volume = 0.7
          break
        default:
          utterance.rate = 0.95
          utterance.pitch = 1.0
      }

      utterance.onstart = onStart
      utterance.onend = () => { onEnd(); resolve() }
      utterance.onerror = () => { onEnd(); resolve() }
      window.speechSynthesis.speak(utterance)
    })
  }

  // No TTS available — just wait briefly
  onStart()
  await new Promise(r => setTimeout(r, Math.min(text.length * 50, 5000)))
  onEnd()
}

// ---------------------------------------------------------------------------
// Speech Recognition helper
// ---------------------------------------------------------------------------

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
    SpeechRecognition: new () => SpeechRecognitionInstance
  }
}

function createSpeechRecognition(): SpeechRecognitionInstance | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const recognition = new SR()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'
  return recognition
}

// ---------------------------------------------------------------------------
// Interview Room
// ---------------------------------------------------------------------------

export default function InterviewRoomPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  // Session state
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [phase, setPhase] = useState<'loading' | 'lobby' | 'live' | 'ended'>('loading')
  const [elapsedMs, setElapsedMs] = useState(0)

  // Audio state
  const [micEnabled, setMicEnabled] = useState(true)
  const [speakerEnabled, setSpeakerEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatOpen, setChatOpen] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const speakerEnabledRef = useRef(speakerEnabled)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef('')
  const phaseRef = useRef(phase)
  const isProcessingRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { speakerEnabledRef.current = speakerEnabled }, [speakerEnabled])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])

  // Load session data
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        if (!res.ok) throw new Error('Failed to load session')
        const data = await res.json()

        const characters = typeof data.characters === 'string'
          ? JSON.parse(data.characters)
          : data.characters || []

        setSessionData({
          id: data.id,
          applicationId: data.applicationId,
          companyName: data.application?.companyName || 'Company',
          jobTitle: data.application?.jobTitle || 'Position',
          stage: data.stage,
          intensity: data.intensity,
          targetDurationMin: data.targetDurationMin,
          characters,
          status: data.status,
        })
        setPhase(data.status === 'completed' ? 'ended' : 'lobby')
      } catch {
        setPhase('lobby')
      }
    }
    loadSession()
  }, [sessionId])

  // Camera setup
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        mediaStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch {
        setCameraEnabled(false)
      }
    }
    if (phase === 'lobby' || phase === 'live') {
      setupCamera()
    }
    return () => {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [phase])

  // Timer
  useEffect(() => {
    if (phase === 'live') {
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // Auto-scroll chat
  useEffect(() => {
    if (autoScroll && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, autoScroll])

  const formatTime = useCallback((ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }, [])

  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  // -------------------------------------------------------------------------
  // Core interview loop
  // -------------------------------------------------------------------------

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setChatMessages(prev => [...prev, {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }])
  }, [])

  const sendExchange = useCallback(async (
    candidateText: string,
    characters: Character[],
    charIndex: number
  ) => {
    if (!candidateText.trim()) return

    setIsProcessing(true)
    isProcessingRef.current = true

    // Add candidate message to chat
    addMessage({
      speaker: 'candidate',
      speakerName: 'You',
      text: candidateText,
      isCandidate: true,
    })

    // Pick which character responds (rotate through panel)
    const respondingChar = characters[charIndex % characters.length]

    try {
      const res = await fetch(`/api/sessions/${sessionId}/exchanges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: candidateText,
          characterId: respondingChar.id,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        console.error('Exchange error:', err)
        setIsProcessing(false)
        isProcessingRef.current = false
        return
      }

      const data = await res.json()
      const responseText = data.interviewerExchange?.messageText || 'Could you elaborate on that?'
      const respChar = data.character || respondingChar

      // Add interviewer message to chat
      addMessage({
        speaker: respChar.id,
        speakerName: respChar.name,
        text: responseText,
        avatarColor: respondingChar.avatarColor,
        isCandidate: false,
      })

      // Speak the response via TTS (with archetype for voice styling)
      await speakText(
        responseText,
        respondingChar.voiceId,
        speakerEnabledRef.current,
        () => setActiveSpeakerId(respondingChar.id),
        () => setActiveSpeakerId(null),
        respondingChar.archetype
      )
    } catch (err) {
      console.error('Exchange failed:', err)
    }

    setIsProcessing(false)
    isProcessingRef.current = false
  }, [sessionId, addMessage])

  // -------------------------------------------------------------------------
  // Speech recognition management
  // -------------------------------------------------------------------------

  const exchangeCountRef = useRef(0)
  const charactersRef = useRef<Character[]>([])

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ok */ }
    }

    const recognition = createSpeechRecognition()
    if (!recognition) return

    recognitionRef.current = recognition
    finalTranscriptRef.current = ''
    setInterimTranscript('')
    setIsListening(true)

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }
      if (final) {
        finalTranscriptRef.current += final
      }
      setInterimTranscript(interim)

      // Reset silence timer on new speech
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        // User stopped speaking for 2 seconds — send the exchange
        const text = finalTranscriptRef.current.trim()
        if (text && phaseRef.current === 'live' && !isProcessingRef.current) {
          recognition.stop()
          setIsListening(false)
          setInterimTranscript('')
          const charIdx = exchangeCountRef.current
          exchangeCountRef.current++
          sendExchange(text, charactersRef.current, charIdx).then(() => {
            // Resume listening after AI responds
            if (phaseRef.current === 'live') {
              startListening()
            }
          })
        }
      }, 2000)
    }

    recognition.onend = () => {
      setIsListening(false)
      // Auto-restart if we're still live and not processing
      if (phaseRef.current === 'live' && !isProcessingRef.current) {
        const text = finalTranscriptRef.current.trim()
        if (!text) {
          // No speech detected, restart
          setTimeout(() => {
            if (phaseRef.current === 'live' && !isProcessingRef.current) {
              startListening()
            }
          }, 500)
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error)
      }
      setIsListening(false)
      // Restart on error if still live
      if (phaseRef.current === 'live' && !isProcessingRef.current) {
        setTimeout(() => {
          if (phaseRef.current === 'live' && !isProcessingRef.current) {
            startListening()
          }
        }, 1000)
      }
    }

    try {
      recognition.start()
    } catch {
      setIsListening(false)
    }
  }, [sendExchange])

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ok */ }
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  // -------------------------------------------------------------------------
  // Join / Leave
  // -------------------------------------------------------------------------

  const joinInterview = useCallback(async () => {
    if (!sessionData) return

    // Activate the session on the server
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
    } catch {
      // Continue anyway
    }

    setPhase('live')
    charactersRef.current = sessionData.characters

    // System message
    addMessage({
      speaker: 'system',
      speakerName: 'System',
      text: 'Interview started. Good luck!',
      isCandidate: false,
    })

    // Opening greeting from first character — use first question from plan if available
    if (sessionData.characters.length > 0) {
      const char = sessionData.characters[0]

      // Fetch the session to get the question plan
      let firstQuestion = 'tell me a little about yourself and why you\'re interested in this role.'
      try {
        const sessionRes = await fetch(`/api/sessions/${sessionId}`)
        if (sessionRes.ok) {
          const sessionJson = await sessionRes.json()
          const events = sessionJson.unexpectedEvents
          if (events?.questionPlan?.length > 0) {
            firstQuestion = events.questionPlan[0].questionText.toLowerCase()
            // Remove leading "tell me" etc. if it starts with that, to flow naturally after intro
            if (!firstQuestion.startsWith('tell') && !firstQuestion.startsWith('walk') && !firstQuestion.startsWith('describe')) {
              firstQuestion = `I'd like to start by asking: ${events.questionPlan[0].questionText}`
            } else {
              firstQuestion = events.questionPlan[0].questionText
            }
          }
        }
      } catch {
        // Use default first question
      }

      const greeting = `Hi, thanks for joining us today. I'm ${char.name}, ${char.title}. Let's get started — ${firstQuestion}`

      // Short delay then speak greeting
      setTimeout(async () => {
        addMessage({
          speaker: char.id,
          speakerName: char.name,
          text: greeting,
          avatarColor: char.avatarColor,
          isCandidate: false,
        })

        await speakText(
          greeting,
          char.voiceId,
          speakerEnabledRef.current,
          () => setActiveSpeakerId(char.id),
          () => setActiveSpeakerId(null),
          char.archetype
        )

        // Start listening for candidate response
        startListening()
      }, 1500)
    }
  }, [sessionData, sessionId, addMessage, startListening])

  const toggleMic = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !micEnabled })
    }
    setMicEnabled(prev => !prev)
  }, [micEnabled])

  const toggleCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !cameraEnabled })
    }
    setCameraEnabled(prev => !prev)
  }, [cameraEnabled])

  const leaveInterview = useCallback(async () => {
    stopListening()
    window.speechSynthesis?.cancel()
    setPhase('ended')
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)

    // Complete the session on the server
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
    } catch {
      // Best effort
    }
  }, [sessionId, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
      window.speechSynthesis?.cancel()
    }
  }, [stopListening])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Loading
  if (phase === 'loading' || !sessionData) {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5b5fc7] border-t-transparent" />
      </div>
    )
  }

  // Meeting ended
  if (phase === 'ended') {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#292929] flex items-center justify-center">
            <PhoneOff className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Meeting ended</h2>
          <p className="text-gray-400 text-sm">
            Your interview with {sessionData.companyName} has ended.
          </p>
          <a
            href={`/debrief/${sessionId}`}
            className="inline-block mt-4 rounded-lg bg-[#5b5fc7] px-6 py-3 text-sm font-medium text-white hover:bg-[#4e52b5] transition-colors"
          >
            View Debrief
          </a>
        </div>
      </div>
    )
  }

  // Lobby
  if (phase === 'lobby') {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">
              {sessionData.jobTitle} at {sessionData.companyName}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {sessionData.stage} Interview &middot; {sessionData.intensity} &middot; {sessionData.targetDurationMin} min
            </p>
          </div>

          {/* Panel preview */}
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider text-center">Today&apos;s Panel</p>
            <div className="flex justify-center gap-4">
              {sessionData.characters.map(char => (
                <div key={char.id} className="flex flex-col items-center gap-2">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                    style={{ backgroundColor: char.avatarColor }}
                  >
                    {char.initials}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-white">{char.name}</p>
                    <p className="text-xs text-gray-500">{char.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Camera preview */}
          <div className="flex justify-center">
            <div className="relative w-64 h-48 rounded-xl overflow-hidden bg-[#292929]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!cameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#292929]">
                  <VideoOff className="h-8 w-8 text-gray-500" />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={toggleMic}
              className={`rounded-full p-3 ${micEnabled ? 'bg-[#292929] text-white' : 'bg-red-500 text-white'}`}
            >
              {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleCamera}
              className={`rounded-full p-3 ${cameraEnabled ? 'bg-[#292929] text-white' : 'bg-red-500 text-white'}`}
            >
              {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={joinInterview}
              className="rounded-lg bg-[#5b5fc7] px-8 py-3 text-sm font-medium text-white hover:bg-[#4e52b5] transition-colors"
            >
              Join Interview
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Live Interview Room
  const characters = sessionData.characters

  return (
    <div className="fixed inset-0 bg-[#1b1b1b] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1b1b1b] border-b border-[#333]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">
            {sessionData.companyName}
          </span>
          <span className="text-xs text-gray-500">
            {sessionData.jobTitle}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isListening && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Listening
            </span>
          )}
          {isProcessing && (
            <span className="text-xs text-[#5b5fc7] flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(elapsedMs)}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Video grid area */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className={`grid gap-3 w-full max-w-4xl ${
            characters.length === 1 ? 'grid-cols-1 max-w-xl' :
            characters.length === 2 ? 'grid-cols-2' :
            'grid-cols-2'
          }`}>
            {characters.map(char => (
              <div
                key={char.id}
                className={`relative rounded-xl bg-[#292929] flex flex-col items-center justify-center p-8 transition-all ${
                  characters.length === 1 ? 'aspect-video' : 'aspect-[4/3]'
                } ${
                  activeSpeakerId === char.id
                    ? 'ring-2 ring-[#5b5fc7] shadow-lg shadow-[#5b5fc7]/20'
                    : ''
                }`}
              >
                {/* Avatar circle */}
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold mb-4"
                  style={{ backgroundColor: char.avatarColor }}
                >
                  {char.initials}
                </div>

                {/* Name and title */}
                <p className="text-sm font-medium text-white">{char.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {char.title}
                </p>

                {/* Speaking indicator */}
                {activeSpeakerId === char.id && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className="w-0.5 bg-[#5b5fc7] rounded-full"
                          style={{
                            height: `${6 + Math.random() * 12}px`,
                            animation: `pulse 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live Transcript Sidebar */}
        {chatOpen && (
          <div className="w-80 border-l border-[#333] flex flex-col bg-[#252525]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
              <h3 className="text-sm font-medium text-white">Meeting chat</h3>
              <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-white">
                <MessageSquare className="h-4 w-4" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3"
              onScroll={handleChatScroll}
            >
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.isCandidate ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {!msg.isCandidate && msg.avatarColor && (
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: msg.avatarColor }}
                      />
                    )}
                    <span className="text-xs font-medium text-gray-300">
                      {msg.speakerName}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`rounded-lg px-3 py-2 text-sm max-w-[90%] ${
                    msg.isCandidate
                      ? 'bg-[#5b5fc7] text-white'
                      : msg.speaker === 'system'
                      ? 'bg-transparent text-gray-500 italic text-xs'
                      : 'bg-[#333] text-gray-200'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {/* Show interim transcript */}
              {interimTranscript && (
                <div className="flex flex-col items-end">
                  <div className="rounded-lg px-3 py-2 text-sm max-w-[90%] bg-[#5b5fc7]/30 text-white/70 italic">
                    {interimTranscript}...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Candidate PIP tile */}
      <div className="absolute bottom-20 right-4 z-10" style={{ right: chatOpen ? '336px' : '16px' }}>
        <div className="w-48 h-36 rounded-lg overflow-hidden bg-[#292929] border border-[#333] shadow-lg relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!cameraEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#292929]">
              <VideoOff className="h-6 w-6 text-gray-500" />
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center mt-1">You</p>
      </div>

      {/* Bottom control bar */}
      <div className="flex items-center justify-center gap-3 py-3 bg-[#1b1b1b] border-t border-[#333]">
        <button
          onClick={toggleCamera}
          className={`rounded-full p-3 transition-colors ${
            cameraEnabled ? 'bg-[#292929] text-white hover:bg-[#333]' : 'bg-red-500 text-white'
          }`}
          title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          onClick={toggleMic}
          className={`rounded-full p-3 transition-colors ${
            micEnabled ? 'bg-[#292929] text-white hover:bg-[#333]' : 'bg-red-500 text-white'
          }`}
          title={micEnabled ? 'Mute' : 'Unmute'}
        >
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          onClick={() => setSpeakerEnabled(prev => !prev)}
          className={`rounded-full p-3 transition-colors ${
            speakerEnabled ? 'bg-[#292929] text-white hover:bg-[#333]' : 'bg-red-500 text-white'
          }`}
          title={speakerEnabled ? 'Mute speaker' : 'Unmute speaker'}
        >
          {speakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>

        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="rounded-full p-3 bg-[#292929] text-white hover:bg-[#333] transition-colors"
            title="Open chat"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        )}

        <button
          onClick={leaveInterview}
          className="rounded-full px-5 py-3 bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
