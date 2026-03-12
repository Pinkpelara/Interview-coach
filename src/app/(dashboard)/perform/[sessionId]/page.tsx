'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  Video,
  VideoOff,
  Send,
  User,
  MessageSquare,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Users,
  ChevronRight,
} from 'lucide-react'
import CharacterVideo, { type ExpressionState } from '@/components/perform/CharacterVideo'
import { AudioAnalyser } from '@/components/perform/AudioAnalyser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
}

interface Exchange {
  id: string
  sequenceNumber: number
  speaker: 'candidate' | 'interviewer'
  characterId: string | null
  messageText: string
  timestampMs: number
}

interface SessionData {
  id: string
  applicationId: string
  stage: string
  intensity: string
  durationMinutes: number
  status: string
  characters: Character[]
  startedAt: string | null
  endedAt: string | null
  exchanges: Exchange[]
  application: {
    companyName: string
    jobTitle: string
    jdText?: string
    strengths?: string
    skillGaps?: string
    probeAreas?: string
  }
}

type Phase = 'loading' | 'briefing' | 'countdown' | 'interview' | 'complete'

// ---------------------------------------------------------------------------
// Character visuals
// ---------------------------------------------------------------------------

const ARCHETYPE_COLORS: Record<string, string> = {
  skeptic: '#ef4444',
  friendly_champion: '#22c55e',
  technical_griller: '#a855f7',
  distracted_senior: '#eab308',
  culture_fit: '#3b82f6',
  silent_observer: '#6b7280',
}

const ARCHETYPE_LABELS: Record<string, string> = {
  skeptic: 'Skeptic',
  friendly_champion: 'Friendly Champion',
  technical_griller: 'Technical Griller',
  distracted_senior: 'Distracted Senior',
  culture_fit: 'Culture Fit Assessor',
  silent_observer: 'Silent Observer',
}

// ---------------------------------------------------------------------------
// V4 Silence Config per archetype (Section 5.4)
// ---------------------------------------------------------------------------

const SILENCE_CONFIG: Record<string, { min: number; max: number; expression: ExpressionState }> = {
  skeptic:            { min: 3, max: 4, expression: 'thinking' },
  friendly_champion:  { min: 1, max: 2, expression: 'nodding' },
  technical_griller:  { min: 4, max: 5, expression: 'neutral' },
  distracted_senior:  { min: 1, max: 8, expression: 'distracted' },
  culture_fit:        { min: 2, max: 3, expression: 'thinking' },
  silent_observer:    { min: 0, max: 0, expression: 'writing_notes' },
}

function getSilenceDuration(archetype: string, intensity: string): number {
  const config = SILENCE_CONFIG[archetype] || { min: 2, max: 3 }
  const base = config.min + Math.random() * (config.max - config.min)
  if (intensity === 'warmup') return Math.max(0, base - 1)
  if (intensity === 'high-pressure') return base + 1
  return base
}

function getSilenceExpression(archetype: string): ExpressionState {
  return SILENCE_CONFIG[archetype]?.expression || 'thinking'
}

// ---------------------------------------------------------------------------
// Opening / Closing lines
// ---------------------------------------------------------------------------

function getOpeningLines(archetype: string, companyName?: string, jobTitle?: string): string[] {
  const company = companyName || 'our company'
  const role = jobTitle || 'this position'

  const lines: Record<string, string[]> = {
    skeptic: [
      `Let's get started. I have some tough questions about your fit for the ${role} role at ${company}.`,
      `Thanks for joining. I'll be digging into your qualifications for ${role} today, so be prepared to back up your claims.`,
    ],
    friendly_champion: [
      `Welcome! Thanks so much for coming in today. We're really excited about the ${role} position at ${company}, and I'd love to learn how your experience connects to what we're building.`,
      `Hi there! Great to meet you. I'm looking forward to hearing about your background and why you're interested in joining ${company} as ${role}.`,
    ],
    technical_griller: [
      `Hello. I'll be focusing on the technical requirements for the ${role} position today. Let's dive right in.`,
      `Welcome. As you know, the ${role} role at ${company} has some specific technical demands. I want to understand your depth in those areas.`,
    ],
    distracted_senior: [
      `Hey, sorry — just wrapping up something. OK, so you're interviewing for ${role} at ${company}. Tell me, what drew you to us?`,
      `Right, hi. I've got a few minutes carved out for this. So — ${role}. Why ${company}?`,
    ],
    culture_fit: [
      `Welcome! I'm really looking forward to understanding how you'd fit into the team at ${company}. Culture is a big part of how we work here.`,
      `Hi! For the ${role} position, we care a lot about how people collaborate. I'd love to understand your working style.`,
    ],
    silent_observer: [
      `Hello.`,
      `...`,
    ],
  }

  return lines[archetype] || lines.friendly_champion
}

const CLOSING_LINES: Record<string, string> = {
  skeptic: "Alright, that's all the time we have. We'll be in touch.",
  friendly_champion: "Thank you so much for your time today! It was wonderful getting to know you. We'll follow up soon.",
  technical_griller: "Good session. We covered a lot of ground. The team will review and get back to you.",
  distracted_senior: "OK, I think we're done here. Thanks for coming in.",
  culture_fit: "It was lovely chatting with you. I really enjoyed our conversation. Best of luck!",
  silent_observer: "Thank you.",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase()
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Voice config per archetype
// ---------------------------------------------------------------------------

const VOICE_CONFIG: Record<string, { voice: string; instructions: string }> = {
  skeptic: {
    voice: 'onyx',
    instructions: 'Speak in a direct, no-nonsense tone. Sound slightly skeptical and probing, like a tough interviewer. Moderate pace.',
  },
  friendly_champion: {
    voice: 'nova',
    instructions: 'Speak warmly and enthusiastically. Sound genuinely interested and encouraging, like a supportive colleague. Natural, relaxed pace.',
  },
  technical_griller: {
    voice: 'ash',
    instructions: 'Speak clearly and precisely. Sound analytical and focused, like a senior engineer. Steady, measured pace.',
  },
  distracted_senior: {
    voice: 'echo',
    instructions: 'Speak in a slightly hurried, casual tone. Sound like a busy executive who is somewhat distracted but still engaged.',
  },
  culture_fit: {
    voice: 'shimmer',
    instructions: 'Speak in a friendly, conversational tone. Sound warm, approachable, and genuinely curious about the person.',
  },
  silent_observer: {
    voice: 'sage',
    instructions: 'Speak very briefly and quietly. Sound reserved and thoughtful, with deliberate pauses.',
  },
}

const FALLBACK_VOICE_CONFIG: Record<string, { pitch: number; rate: number }> = {
  skeptic: { pitch: 0.85, rate: 0.88 },
  friendly_champion: { pitch: 1.08, rate: 1.0 },
  technical_griller: { pitch: 0.92, rate: 0.92 },
  distracted_senior: { pitch: 1.0, rate: 1.05 },
  culture_fit: { pitch: 1.05, rate: 0.95 },
  silent_observer: { pitch: 0.85, rate: 0.82 },
}

// ---------------------------------------------------------------------------
// Speech synthesis hook — Web Speech API
// ---------------------------------------------------------------------------

function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const audioAnalyserRef = useRef<AudioAnalyser>(new AudioAnalyser())

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    synthRef.current.getVoices()
    return () => {
      synthRef.current?.cancel()
      audioAnalyserRef.current.disconnect()
    }
  }, [])

  const speak = useCallback((text: string, voiceConfig?: { voice: string; instructions: string }) => {
    return new Promise<void>((resolve) => {
      synthRef.current?.cancel()
      setSpeaking(true)

      if (!synthRef.current) { setSpeaking(false); resolve(); return }

      const utterance = new SpeechSynthesisUtterance(text)
      const archetype = Object.entries(VOICE_CONFIG).find(([, v]) => v.voice === voiceConfig?.voice)?.[0]
      const fallback = FALLBACK_VOICE_CONFIG[archetype || 'friendly_champion'] || { pitch: 1, rate: 0.95 }
      utterance.pitch = fallback.pitch
      utterance.rate = fallback.rate
      utterance.volume = 1

      const voices = synthRef.current.getVoices().filter(v => v.lang.startsWith('en'))
      const naturalVoice = voices.find(v =>
        v.name.includes('Natural') || v.name.includes('Neural') ||
        v.name.includes('Enhanced') || v.name.includes('Premium')
      )
      const googleVoice = voices.find(v => v.name.includes('Google'))
      const microsoftVoice = voices.find(v => v.name.includes('Microsoft') && (v.name.includes('Online') || v.name.includes('Natural')))
      const preferred = naturalVoice || microsoftVoice || googleVoice || voices[0]
      if (preferred) utterance.voice = preferred

      utterance.onend = () => { setSpeaking(false); resolve() }
      utterance.onerror = () => { setSpeaking(false); resolve() }
      synthRef.current.speak(utterance)
    })
  }, [])

  const stop = useCallback(() => {
    synthRef.current?.cancel()
    audioAnalyserRef.current.disconnect()
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking, audioAnalyser: audioAnalyserRef.current }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function InterviewRoomPage() {
  const { data: authSession } = useSession()
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  // Core state
  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Briefing countdown
  const [countdown, setCountdown] = useState(120)
  const [briefingReady, setBriefingReady] = useState(false)

  // Interview state
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [speakingCharacterId, setSpeakingCharacterId] = useState<string | null>(null)
  const [characterExpressions, setCharacterExpressions] = useState<Record<string, ExpressionState>>({})

  // Chat panel toggle
  const [isChatOpen, setIsChatOpen] = useState(true)

  // Voice I/O
  const { speak, stop: stopSpeech, speaking: isTTSSpeaking, audioAnalyser } = useSpeech()
  const [isListening, setIsListening] = useState(false)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const recognitionRef = useRef<any>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const selfViewRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)

  // Chat scroll
  const chatEndRef = useRef<HTMLDivElement>(null)
  const nextCharacterIndexRef = useRef(0)

  // Text mode fallback
  const [textMode, setTextMode] = useState(false)

  // -------------------------------------------
  // Fetch session data
  // -------------------------------------------

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to load session')
          return
        }
        const data: SessionData = await res.json()
        setSessionData(data)
        setExchanges(data.exchanges || [])

        // Initialize character expressions
        const expressions: Record<string, ExpressionState> = {}
        for (const char of data.characters) {
          expressions[char.id] = 'neutral'
        }
        setCharacterExpressions(expressions)

        if (data.status === 'completed') {
          setPhase('complete')
        } else if (data.status === 'active') {
          setPhase('interview')
        } else {
          setPhase('briefing')
        }
      } catch {
        setError('Failed to load session')
      }
    }
    if (sessionId) fetchSession()
  }, [sessionId])

  // -------------------------------------------
  // Check for speech recognition support
  // -------------------------------------------

  useEffect(() => {
    const w = window as any
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      setTextMode(true)
    }
  }, [])

  // -------------------------------------------
  // Camera setup
  // -------------------------------------------

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      if (selfViewRef.current) selfViewRef.current.srcObject = stream
      setCameraActive(true)
      setIsCameraOn(true)
    } catch {
      console.warn('Camera not available')
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
    setIsCameraOn(false)
  }

  const toggleCamera = () => {
    if (!streamRef.current) return
    const videoTracks = streamRef.current.getVideoTracks()
    videoTracks.forEach(t => { t.enabled = !t.enabled })
    setIsCameraOn(prev => !prev)
  }

  useEffect(() => {
    if (selfViewRef.current && streamRef.current) {
      selfViewRef.current.srcObject = streamRef.current
    }
  })

  useEffect(() => {
    return () => { stopCamera(); stopSpeech() }
  }, [stopSpeech])

  // -------------------------------------------
  // Speech recognition
  // -------------------------------------------

  const startListening = useCallback(() => {
    if (textMode) return

    const w = window as any
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) { setTextMode(true); return }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInputText(transcript)

      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = setTimeout(() => {
        if (transcript.trim().length > 0) {
          recognition.stop()
        }
      }, 1500)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch {
      setTextMode(true)
    }
  }, [textMode])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
  }, [])

  // -------------------------------------------
  // Briefing countdown
  // -------------------------------------------

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      handleStartInterview()
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  // -------------------------------------------
  // Timer
  // -------------------------------------------

  useEffect(() => {
    if (phase === 'interview') {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  // -------------------------------------------
  // Auto-scroll chat
  // -------------------------------------------

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges])

  // -------------------------------------------
  // V4 Random character behavior (archetype-driven)
  // -------------------------------------------

  useEffect(() => {
    if (phase !== 'interview' || !sessionData) return

    const interval = setInterval(() => {
      for (const char of sessionData.characters) {
        if (char.id === speakingCharacterId) continue

        if (char.archetype === 'distracted_senior') {
          if (Math.random() > 0.4) {
            setCharacterExpressions(prev => ({ ...prev, [char.id]: 'distracted' }))
          } else {
            setCharacterExpressions(prev => ({ ...prev, [char.id]: 'listening' }))
          }
        } else if (char.archetype === 'silent_observer') {
          setCharacterExpressions(prev => ({
            ...prev,
            [char.id]: Math.random() > 0.5 ? 'writing_notes' : 'listening',
          }))
        } else {
          if (Math.random() > 0.8) {
            setCharacterExpressions(prev => ({ ...prev, [char.id]: 'nodding' }))
            setTimeout(() => {
              setCharacterExpressions(prev => ({
                ...prev,
                [char.id]: prev[char.id] === 'nodding' ? 'listening' : prev[char.id],
              }))
            }, 2000)
          } else {
            setCharacterExpressions(prev => ({
              ...prev,
              [char.id]: prev[char.id] === 'nodding' ? prev[char.id] : 'listening',
            }))
          }
        }
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [phase, sessionData, speakingCharacterId])

  // -------------------------------------------
  // Start interview
  // -------------------------------------------

  const handleStartInterview = async () => {
    if (!sessionData) return

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })

      if (!res.ok) throw new Error('Failed to start session')

      const updated = await res.json()
      setSessionData(prev => prev ? { ...prev, ...updated, characters: updated.characters } : prev)
      setPhase('interview')

      const characters = updated.characters || sessionData.characters
      for (let i = 0; i < characters.length; i++) {
        const char = characters[i]
        const lines = getOpeningLines(char.archetype, sessionData.application?.companyName, sessionData.application?.jobTitle)
        const line = randomFrom(lines)

        setSpeakingCharacterId(char.id)
        setCharacterExpressions(prev => ({ ...prev, [char.id]: 'speaking' }))

        for (const otherChar of characters) {
          if (otherChar.id !== char.id) {
            setCharacterExpressions(prev => ({ ...prev, [otherChar.id]: 'listening' }))
          }
        }

        if (isSpeakerOn) {
          const voiceConfig = VOICE_CONFIG[char.archetype]
          await speak(line, voiceConfig)
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        const openingExchange: Exchange = {
          id: `opening_${i}`,
          sequenceNumber: i + 1,
          speaker: 'interviewer',
          characterId: char.id,
          messageText: line,
          timestampMs: i * 2000,
        }
        setExchanges(prev => [...prev, openingExchange])

        setSpeakingCharacterId(null)
        setCharacterExpressions(prev => ({ ...prev, [char.id]: 'neutral' }))

        if (i < characters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      for (const char of characters) {
        setCharacterExpressions(prev => ({ ...prev, [char.id]: 'listening' }))
      }
      if (!textMode) startListening()
      nextCharacterIndexRef.current = 0
    } catch {
      setError('Failed to start interview')
    }
  }

  // -------------------------------------------
  // Send message — V4 expression state flow
  // -------------------------------------------

  const handleSend = async () => {
    if (!inputText.trim() || isSending || !sessionData) return

    const characters = sessionData.characters
    if (!characters.length) return

    const charIndex = nextCharacterIndexRef.current % characters.length
    const respondingChar = characters[charIndex]
    nextCharacterIndexRef.current = charIndex + 1

    const userText = inputText.trim()
    setInputText('')
    setIsSending(true)
    stopListening()

    const tempCandidateExchange: Exchange = {
      id: `temp_${Date.now()}`,
      sequenceNumber: exchanges.length + 1,
      speaker: 'candidate',
      characterId: null,
      messageText: userText,
      timestampMs: elapsedSeconds * 1000,
    }
    setExchanges(prev => [...prev, tempCandidateExchange])

    const silenceExpression = getSilenceExpression(respondingChar.archetype)
    setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: silenceExpression }))
    setSpeakingCharacterId(respondingChar.id)

    try {
      const silenceDuration = getSilenceDuration(respondingChar.archetype, sessionData.intensity)
      await new Promise(resolve => setTimeout(resolve, silenceDuration * 1000))

      setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: 'thinking' }))

      const res = await fetch(`/api/sessions/${sessionId}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: userText, characterId: respondingChar.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      const data = await res.json()

      setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: 'speaking' }))

      for (const otherChar of characters) {
        if (otherChar.id !== respondingChar.id) {
          if (otherChar.archetype === 'silent_observer') {
            setCharacterExpressions(prev => ({ ...prev, [otherChar.id]: 'writing_notes' }))
          } else {
            setCharacterExpressions(prev => ({ ...prev, [otherChar.id]: 'listening' }))
          }
        }
      }

      if (isSpeakerOn) {
        const voiceConfig = VOICE_CONFIG[respondingChar.archetype]
        await speak(data.interviewerExchange.messageText, voiceConfig)
      }

      setExchanges(prev => {
        const withoutTemp = prev.filter(e => e.id !== tempCandidateExchange.id)
        return [...withoutTemp, data.candidateExchange, data.interviewerExchange]
      })

      for (const char of characters) {
        setCharacterExpressions(prev => ({ ...prev, [char.id]: 'listening' }))
      }

      if (!textMode && isMicOn) startListening()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      if (!textMode && isMicOn) startListening()
    } finally {
      setSpeakingCharacterId(null)
      setIsSending(false)
    }
  }

  // Auto-send when speech recognition stops
  useEffect(() => {
    if (!isListening && inputText.trim() && !isSending && phase === 'interview') {
      handleSend()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening])

  // -------------------------------------------
  // End interview
  // -------------------------------------------

  const handleEndInterview = async () => {
    if (!sessionData) return
    stopListening()
    stopSpeech()

    const characters = sessionData.characters
    const leadChar = characters[0]
    if (leadChar) {
      const closingLine = CLOSING_LINES[leadChar.archetype] || CLOSING_LINES.friendly_champion
      setSpeakingCharacterId(leadChar.id)
      setCharacterExpressions(prev => ({ ...prev, [leadChar.id]: 'speaking' }))
      if (isSpeakerOn) {
        await speak(closingLine, VOICE_CONFIG[leadChar.archetype])
      }
      setExchanges(prev => [...prev, {
        id: `closing_${Date.now()}`,
        sequenceNumber: exchanges.length + 1,
        speaker: 'interviewer',
        characterId: leadChar.id,
        messageText: closingLine,
        timestampMs: elapsedSeconds * 1000,
      }])
      setSpeakingCharacterId(null)
    }

    if (timerRef.current) clearInterval(timerRef.current)

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
    } catch { /* proceed anyway */ }

    stopCamera()
    setPhase('complete')
  }

  // -------------------------------------------
  // Toggle mic
  // -------------------------------------------

  const toggleMic = () => {
    if (isMicOn) {
      stopListening()
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => { t.enabled = false })
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => { t.enabled = true })
      }
      if (!textMode) startListening()
    }
    setIsMicOn(!isMicOn)
  }

  const toggleSpeaker = () => {
    if (isSpeakerOn) stopSpeech()
    setIsSpeakerOn(!isSpeakerOn)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getCharacter = (charId: string | null): Character | undefined => {
    if (!charId || !sessionData) return undefined
    return sessionData.characters.find(c => c.id === charId)
  }

  // -------------------------------------------
  // RENDER: Loading
  // -------------------------------------------

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#5b5fc7] mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Joining meeting...</p>
        </div>
      </div>
    )
  }

  if (error && !sessionData) {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center z-50">
        <div className="text-center max-w-md">
          <MessageSquare className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to join meeting</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!sessionData) return null
  const { characters, application } = sessionData

  // -------------------------------------------
  // RENDER: Briefing (Pre-Interview Lobby)
  // -------------------------------------------

  if (phase === 'briefing') {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center p-4 overflow-y-auto z-50">
        <div className="max-w-lg w-full space-y-6">
          {/* Meeting card */}
          <div className="bg-[#292929] rounded-2xl p-8 space-y-6">
            <div className="text-center">
              {/* Company avatar */}
              <div className="w-16 h-16 rounded-2xl bg-[#5b5fc7] flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-bold">{application.companyName.charAt(0)}</span>
              </div>
              <h1 className="text-xl font-semibold text-white mb-1">
                {application.companyName}
              </h1>
              <p className="text-gray-400 text-sm">{application.jobTitle} Interview</p>
            </div>

            {/* Meeting details */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Stage</p>
                <p className="text-white text-sm">{sessionData.stage}</p>
              </div>
              <div className="w-px h-8 bg-[#3d3d3d]" />
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Intensity</p>
                <Badge variant={
                  sessionData.intensity === 'high-pressure' ? 'danger' :
                  sessionData.intensity === 'warmup' ? 'success' : 'info'
                }>
                  {sessionData.intensity}
                </Badge>
              </div>
              <div className="w-px h-8 bg-[#3d3d3d]" />
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Duration</p>
                <p className="text-white text-sm">{sessionData.durationMinutes} min</p>
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-xs font-medium">
                  {characters.length + 1} participants
                </span>
              </div>
              <div className="space-y-1.5">
                {characters.map(char => {
                  const color = ARCHETYPE_COLORS[char.archetype] || '#6b7280'
                  return (
                    <div key={char.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#333] transition-colors">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {getInitials(char.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">{char.name}</p>
                        <p className="text-gray-500 text-xs truncate">{char.title}</p>
                      </div>
                    </div>
                  )
                })}
                {/* You */}
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#5b5fc7]/10">
                  <div className="w-8 h-8 rounded-full bg-[#5b5fc7] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-white text-sm">You</p>
                    <p className="text-gray-500 text-xs">Candidate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Camera/Mic preview */}
            {!cameraActive ? (
              <div className="bg-[#1b1b1b] rounded-xl p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <button onClick={startCamera} className="w-10 h-10 rounded-full bg-[#3d3d3d] text-white flex items-center justify-center hover:bg-[#4d4d4d] transition-colors">
                    <Video className="w-5 h-5" />
                  </button>
                  <button onClick={startCamera} className="w-10 h-10 rounded-full bg-[#3d3d3d] text-white flex items-center justify-center hover:bg-[#4d4d4d] transition-colors">
                    <Mic className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-gray-500 text-xs">Click to enable camera and microphone</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-green-400 text-sm">Camera and microphone ready</p>
              </div>
            )}

            {/* Join button */}
            <button
              onClick={() => {
                if (!cameraActive) {
                  startCamera().then(() => {
                    setBriefingReady(true)
                    setCountdown(5)
                    setPhase('countdown')
                  })
                } else {
                  setBriefingReady(true)
                  setCountdown(5)
                  setPhase('countdown')
                }
              }}
              className="w-full py-3 rounded-lg bg-[#5b5fc7] text-white font-semibold text-sm hover:bg-[#4e52b5] transition-colors"
            >
              Join Interview
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------
  // RENDER: Countdown
  // -------------------------------------------

  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center z-50">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#5b5fc7] flex items-center justify-center mx-auto">
            <span className="text-white text-lg font-bold">{application.companyName.charAt(0)}</span>
          </div>
          <div>
            <p className="text-white text-lg font-medium">{application.companyName}</p>
            <p className="text-gray-400 text-sm">{application.jobTitle} Interview</p>
          </div>
          <p className="text-gray-500 text-sm">Starting in</p>
          <div className="text-7xl font-bold text-white tabular-nums">{countdown}</div>
          <p className="text-gray-600 text-sm">Take a deep breath</p>
        </div>
      </div>
    )
  }

  // -------------------------------------------
  // RENDER: Complete
  // -------------------------------------------

  if (phase === 'complete') {
    const totalExchanges = exchanges.filter(e => e.speaker === 'candidate').length
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center p-4 z-50">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center mx-auto">
            <PhoneOff className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Meeting ended</h1>
          <p className="text-gray-400">
            Your interview for{' '}
            <span className="text-white font-medium">{application.jobTitle}</span> at{' '}
            <span className="text-white font-medium">{application.companyName}</span> has ended.
          </p>

          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-300 mb-1">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(elapsedSeconds)}</span>
              </div>
              <p className="text-gray-500 text-xs">Duration</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-300 mb-1">
                <MessageSquare className="w-4 h-4" />
                <span>{totalExchanges}</span>
              </div>
              <p className="text-gray-500 text-xs">Responses</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={() => router.push(`/debrief/${sessionId}`)}
              className="w-full py-3 rounded-lg bg-[#5b5fc7] text-white font-semibold text-sm hover:bg-[#4e52b5] transition-colors"
            >
              View Debrief
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-2.5 rounded-lg text-gray-400 text-sm hover:text-white hover:bg-[#292929] transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------
  // RENDER: Interview Room — MS Teams-Style
  // -------------------------------------------

  // Teams-style video tile for interviewers (camera off)
  const renderInterviewerTile = (char: Character) => {
    const color = ARCHETYPE_COLORS[char.archetype] || '#6b7280'
    const isCharSpeaking = speakingCharacterId === char.id
    const expression = characterExpressions[char.id] || 'neutral'

    return (
      <div key={char.id} className="relative rounded-lg overflow-hidden bg-[#292929] group">
        <CharacterVideo
          name={char.name}
          title={char.title}
          expression={expression}
          audioAnalyser={isCharSpeaking ? audioAnalyser : null}
          isSpeaking={isCharSpeaking}
          accentColor={color}
        />

        {/* Speaking indicator ring */}
        {isCharSpeaking && (
          <div className="absolute inset-0 rounded-lg border-2 border-[#5b5fc7] pointer-events-none" />
        )}

        {/* Name bar at bottom — Teams style */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-medium truncate">{char.name}</span>
            {isCharSpeaking && (
              <div className="flex items-center gap-0.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-0.5 bg-[#5b5fc7] rounded-full animate-pulse"
                    style={{ height: `${6 + Math.random() * 6}px`, animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Archetype label on hover */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded backdrop-blur-sm"
            style={{ backgroundColor: color + '40', color: color }}
          >
            {ARCHETYPE_LABELS[char.archetype] || char.archetype}
          </span>
        </div>

        {/* Muted mic icon — Teams style */}
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 rounded bg-[#292929]/80 backdrop-blur-sm flex items-center justify-center">
            <MicOff className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      </div>
    )
  }

  const totalTiles = characters.length
  const cols = totalTiles <= 2 ? 2 : totalTiles <= 4 ? 2 : 3

  return (
    <div className="fixed inset-0 bg-[#1b1b1b] flex flex-col z-50">
      {/* ===== TOP BAR — Teams style ===== */}
      <div className="flex items-center justify-between px-4 h-12 bg-[#292929] border-b border-[#3d3d3d]">
        <div className="flex items-center gap-3">
          {/* Company logo */}
          <div className="w-7 h-7 rounded bg-[#5b5fc7] flex items-center justify-center">
            <span className="text-white text-xs font-bold">{application.companyName.charAt(0)}</span>
          </div>
          <div>
            <p className="text-white text-sm font-medium leading-tight">{application.companyName}</p>
            <p className="text-gray-500 text-[11px] leading-tight">{application.jobTitle}</p>
          </div>
        </div>

        {/* Timer + participants */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Users className="w-3.5 h-3.5" />
            <span className="text-xs">{characters.length + 1}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-300 bg-[#3d3d3d] rounded px-2.5 py-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono text-xs tabular-nums">{formatTime(elapsedSeconds)}</span>
          </div>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isChatOpen ? 'bg-[#5b5fc7] text-white' : 'text-gray-400 hover:bg-[#3d3d3d]'
            }`}
            title="Toggle chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Video grid area */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Character video grid */}
          <div className="flex-1 p-3">
            <div
              className="w-full h-full gap-2 max-w-5xl mx-auto"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridAutoRows: '1fr',
              }}
            >
              {characters.map(char => renderInterviewerTile(char))}
            </div>
          </div>

          {/* PiP self-view — bottom right overlay */}
          <div className="absolute bottom-16 right-5 w-48 h-32 rounded-lg overflow-hidden shadow-2xl border border-[#3d3d3d] z-20">
            {cameraActive && isCameraOn ? (
              <video
                ref={selfViewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="w-full h-full bg-[#292929] flex flex-col items-center justify-center gap-1">
                <div className="w-10 h-10 rounded-full bg-[#5b5fc7] flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
            {/* PiP name label */}
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-[10px] font-medium">You</span>
                {isListening && (
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-0.5 bg-green-500 rounded-full animate-pulse"
                        style={{ height: `${4 + Math.random() * 4}px`, animationDelay: `${i * 80}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Mic status */}
            <div className="absolute top-1.5 right-1.5">
              <div className={`w-5 h-5 rounded flex items-center justify-center ${isMicOn ? 'bg-transparent' : 'bg-red-600'}`}>
                {!isMicOn && <MicOff className="w-3 h-3 text-white" />}
              </div>
            </div>
          </div>
        </div>

        {/* ===== CHAT SIDEBAR — Teams meeting chat ===== */}
        {isChatOpen && (
          <div className="w-80 lg:w-96 flex flex-col min-h-0 border-l border-[#3d3d3d] bg-[#292929]">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-[#3d3d3d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-white text-sm font-medium">Meeting chat</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {exchanges.map(exchange => {
                const isCandidate = exchange.speaker === 'candidate'
                const char = getCharacter(exchange.characterId)
                const color = char ? ARCHETYPE_COLORS[char.archetype] || '#6b7280' : '#5b5fc7'

                return (
                  <div key={exchange.id} className={`flex gap-2 ${isCandidate ? 'flex-row-reverse' : ''}`}>
                    {!isCandidate && char && (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ backgroundColor: color }}
                      >
                        {getInitials(char.name)}
                      </div>
                    )}
                    {isCandidate && (
                      <div className="w-7 h-7 rounded-full bg-[#5b5fc7] flex items-center justify-center text-white shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className={`max-w-[80%] ${isCandidate ? 'text-right' : ''}`}>
                      <p className="text-[11px] font-medium mb-0.5" style={{ color: isCandidate ? '#5b5fc7' : color }}>
                        {isCandidate ? 'You' : char?.name}
                      </p>
                      <div className={`rounded-lg px-3 py-2 ${
                        isCandidate
                          ? 'bg-[#5b5fc7]/20 text-gray-200'
                          : 'bg-[#1b1b1b] text-gray-200'
                      }`}>
                        <p className="text-xs leading-relaxed">{exchange.messageText}</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Typing indicator */}
              {isSending && speakingCharacterId && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#3d3d3d] flex items-center justify-center shrink-0">
                    <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="bg-[#1b1b1b] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Listening indicator */}
            {isListening && (
              <div className="mx-3 mb-2 flex items-center justify-center gap-2 py-1.5 bg-[#1b1b1b] rounded-lg">
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="w-1 bg-red-500 rounded-full animate-pulse"
                      style={{
                        height: `${10 + Math.random() * 12}px`,
                        animationDelay: `${i * 100}ms`,
                        animationDuration: '0.5s',
                      }}
                    />
                  ))}
                </div>
                <span className="text-red-400 text-xs font-medium">Listening...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-3 mb-2 px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg flex items-center gap-2">
                <p className="text-red-300 text-xs flex-1">{error}</p>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs">Dismiss</button>
              </div>
            )}

            {/* Chat input */}
            <div className="p-3 border-t border-[#3d3d3d]">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={textMode ? 'Type your response...' : 'Type or speak...'}
                  disabled={isSending}
                  className="flex-1 bg-[#1b1b1b] text-white placeholder-gray-500 border border-[#3d3d3d] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#5b5fc7] focus:ring-1 focus:ring-[#5b5fc7] disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || !inputText.trim()}
                  className="w-8 h-8 rounded-lg bg-[#5b5fc7] text-white flex items-center justify-center hover:bg-[#4e52b5] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM CONTROLS BAR — Teams style ===== */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-[#292929] border-t border-[#3d3d3d]">
        <button
          onClick={toggleCamera}
          className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
            isCameraOn
              ? 'bg-[#3d3d3d] text-white hover:bg-[#4d4d4d]'
              : 'bg-[#c4314b] text-white hover:bg-[#b02a42]'
          }`}
          title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleMic}
          className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
            isMicOn
              ? 'bg-[#3d3d3d] text-white hover:bg-[#4d4d4d]'
              : 'bg-[#c4314b] text-white hover:bg-[#b02a42]'
          }`}
          title={isMicOn ? 'Mute' : 'Unmute'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleSpeaker}
          className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
            isSpeakerOn
              ? 'bg-[#3d3d3d] text-white hover:bg-[#4d4d4d]'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
          title={isSpeakerOn ? 'Mute speakers' : 'Unmute speakers'}
        >
          {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        <div className="w-px h-8 bg-[#3d3d3d] mx-1" />

        <button
          onClick={handleEndInterview}
          className="h-11 px-5 rounded-lg bg-[#c4314b] text-white flex items-center justify-center gap-2 hover:bg-[#b02a42] transition-colors font-medium text-sm"
        >
          <PhoneOff className="w-4 h-4" />
          Leave
        </button>
      </div>

      {/* Hidden video element for camera stream */}
      {cameraActive && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="hidden"
        />
      )}
    </div>
  )
}
