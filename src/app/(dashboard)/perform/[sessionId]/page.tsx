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
  Send,
  User,
  MessageSquare,
  Volume2,
  VolumeX,
} from 'lucide-react'

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

const ARCHETYPE_BG: Record<string, string> = {
  skeptic: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  friendly_champion: 'linear-gradient(135deg, #1a2e1a 0%, #162e21 50%, #0f4630 100%)',
  technical_griller: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 50%, #1a0f3e 100%)',
  distracted_senior: 'linear-gradient(135deg, #2e2a1a 0%, #3e3216 50%, #46380f 100%)',
  culture_fit: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  silent_observer: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
}

// ---------------------------------------------------------------------------
// Opening / Closing lines
// ---------------------------------------------------------------------------

const OPENING_LINES: Record<string, string[]> = {
  skeptic: [
    "Let's get started. I have some tough questions for you today.",
    "Thanks for joining. I'm going to challenge your assumptions today, so be prepared.",
  ],
  friendly_champion: [
    "Welcome! Thanks so much for taking the time to chat with us today. We're really excited to learn more about you.",
    "Hi there! Great to meet you. Let's have a relaxed conversation about your experience.",
  ],
  technical_griller: [
    "Hello. Let's dive right into the technical aspects. I want to understand your engineering depth.",
    "Welcome. I'll be focusing on the technical side today, so let's get into the details.",
  ],
  distracted_senior: [
    "Hey, sorry — just wrapping up something. OK, let's jump in. Tell me about yourself.",
    "Right, hi. I've got a few minutes carved out for this. Let's make the most of it.",
  ],
  culture_fit: [
    "Welcome! I'm excited to get to know you better as a person. We really care about team fit here.",
    "Hi! Today I'd like to understand how you work with others and what kind of environment you thrive in.",
  ],
  silent_observer: [
    "Hello.",
    "...",
  ],
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
// Mouth shapes for lip sync animation
// ---------------------------------------------------------------------------

type MouthShape = 'closed' | 'small' | 'medium' | 'wide' | 'round'

function getMouthPath(shape: MouthShape): string {
  switch (shape) {
    case 'closed': return 'M 35 72 Q 50 74 65 72'
    case 'small': return 'M 38 70 Q 50 77 62 70'
    case 'medium': return 'M 36 68 Q 50 80 64 68'
    case 'wide': return 'M 34 67 Q 50 83 66 67'
    case 'round': return 'M 40 68 Q 50 80 60 68 Q 50 84 40 68'
  }
}

// ---------------------------------------------------------------------------
// Character Face Component
// ---------------------------------------------------------------------------

function CharacterFace({
  character,
  isSpeaking,
  expression,
  isLookingAway,
}: {
  character: Character
  isSpeaking: boolean
  expression: 'neutral' | 'interested' | 'skeptical' | 'nodding' | 'writing'
  isLookingAway: boolean
}) {
  const color = ARCHETYPE_COLORS[character.archetype] || '#6b7280'
  const bg = ARCHETYPE_BG[character.archetype] || ARCHETYPE_BG.silent_observer
  const [mouthShape, setMouthShape] = useState<MouthShape>('closed')
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const [headTilt, setHeadTilt] = useState(0)
  const frameRef = useRef<number>(0)

  // Lip sync animation
  useEffect(() => {
    if (!isSpeaking) {
      setMouthShape('closed')
      return
    }
    const shapes: MouthShape[] = ['small', 'medium', 'wide', 'round', 'medium', 'small']
    let idx = 0
    const interval = setInterval(() => {
      setMouthShape(shapes[idx % shapes.length])
      idx++
    }, 120)
    return () => clearInterval(interval)
  }, [isSpeaking])

  // Eye movement
  useEffect(() => {
    const move = () => {
      if (isLookingAway) {
        setEyeOffset({ x: Math.random() * 6 - 3, y: Math.random() * 4 + 2 })
      } else {
        setEyeOffset({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 })
      }
      frameRef.current = window.setTimeout(move, 2000 + Math.random() * 3000) as unknown as number
    }
    move()
    return () => clearTimeout(frameRef.current)
  }, [isLookingAway])

  // Head tilt for expressions
  useEffect(() => {
    switch (expression) {
      case 'skeptical': setHeadTilt(-3); break
      case 'interested': setHeadTilt(2); break
      case 'nodding': {
        let count = 0
        const nod = setInterval(() => {
          setHeadTilt(count % 2 === 0 ? 4 : -1)
          count++
          if (count > 4) { clearInterval(nod); setHeadTilt(0) }
        }, 300)
        return () => clearInterval(nod)
      }
      default: setHeadTilt(0)
    }
  }, [expression])

  // Eyebrow positions based on expression
  const leftBrowY = expression === 'skeptical' ? 28 : expression === 'interested' ? 26 : 30
  const rightBrowY = expression === 'skeptical' ? 32 : expression === 'interested' ? 26 : 30

  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{ background: bg }}
    >
      {/* Character video feed area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          className="w-48 h-48 md:w-56 md:h-56 transition-transform duration-500"
          style={{ transform: `rotate(${headTilt}deg)` }}
        >
          {/* Head */}
          <ellipse cx="50" cy="50" rx="30" ry="35" fill={color} opacity="0.15" />
          <ellipse cx="50" cy="50" rx="28" ry="33" fill={color} opacity="0.25" />

          {/* Hair hint */}
          <path d="M 22 40 Q 30 15 50 12 Q 70 15 78 40" fill={color} opacity="0.3" />

          {/* Eyes */}
          <g>
            {/* Left eye */}
            <ellipse
              cx={38 + eyeOffset.x}
              cy={44 + eyeOffset.y}
              rx="5"
              ry="3.5"
              fill="white"
            />
            <circle
              cx={38 + eyeOffset.x}
              cy={44 + eyeOffset.y}
              r="2"
              fill="#1a1a2e"
            />
            <circle
              cx={38.5 + eyeOffset.x}
              cy={43.5 + eyeOffset.y}
              r="0.7"
              fill="white"
            />

            {/* Right eye */}
            <ellipse
              cx={62 + eyeOffset.x}
              cy={44 + eyeOffset.y}
              rx="5"
              ry="3.5"
              fill="white"
            />
            <circle
              cx={62 + eyeOffset.x}
              cy={44 + eyeOffset.y}
              r="2"
              fill="#1a1a2e"
            />
            <circle
              cx={62.5 + eyeOffset.x}
              cy={43.5 + eyeOffset.y}
              r="0.7"
              fill="white"
            />
          </g>

          {/* Eyebrows */}
          <line x1="32" y1={leftBrowY} x2="44" y2={leftBrowY - 2} stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="56" y1={rightBrowY - 2} x2="68" y2={rightBrowY} stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

          {/* Nose */}
          <path d="M 50 48 L 47 58 Q 50 60 53 58 Z" fill={color} opacity="0.15" />

          {/* Mouth */}
          <path
            d={getMouthPath(mouthShape)}
            fill={isSpeaking ? '#e8a0a0' : 'none'}
            stroke={color}
            strokeWidth="1.2"
            opacity="0.5"
            className="transition-all duration-100"
          />

          {/* Writing gesture indicator */}
          {expression === 'writing' && (
            <g opacity="0.4">
              <rect x="70" y="65" width="12" height="16" rx="2" fill="white" opacity="0.3" />
              <line x1="72" y1="69" x2="80" y2="69" stroke={color} strokeWidth="0.5" />
              <line x1="72" y1="72" x2="78" y2="72" stroke={color} strokeWidth="0.5" />
              <line x1="72" y1="75" x2="79" y2="75" stroke={color} strokeWidth="0.5" />
            </g>
          )}
        </svg>
      </div>

      {/* Name label */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-white text-sm font-medium truncate">{character.name}</p>
        <p className="text-gray-300 text-xs truncate">{character.title}</p>
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/20 rounded-full px-2 py-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-green-300 text-[10px] font-medium">Speaking</span>
        </div>
      )}

      {/* Border glow when speaking */}
      {isSpeaking && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 20px ${color}40, 0 0 15px ${color}20` }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Speech synthesis hook
// ---------------------------------------------------------------------------

function useSpeech() {
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    return () => { synthRef.current?.cancel() }
  }, [])

  const speak = useCallback((text: string, voiceConfig?: { pitch: number; rate: number }) => {
    return new Promise<void>((resolve) => {
      if (!synthRef.current) { resolve(); return }
      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.pitch = voiceConfig?.pitch ?? 1
      utterance.rate = voiceConfig?.rate ?? 0.95
      utterance.volume = 1

      // Try to pick a natural voice
      const voices = synthRef.current.getVoices()
      const preferred = voices.find(v =>
        v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
      ) || voices.find(v => v.lang.startsWith('en'))
      if (preferred) utterance.voice = preferred

      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => { setSpeaking(false); resolve() }
      utterance.onerror = () => { setSpeaking(false); resolve() }

      synthRef.current.speak(utterance)
    })
  }, [])

  const stop = useCallback(() => {
    synthRef.current?.cancel()
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking }
}

// ---------------------------------------------------------------------------
// Voice config per archetype
// ---------------------------------------------------------------------------

const VOICE_CONFIG: Record<string, { pitch: number; rate: number }> = {
  skeptic: { pitch: 0.85, rate: 0.85 },
  friendly_champion: { pitch: 1.1, rate: 1.05 },
  technical_griller: { pitch: 0.9, rate: 0.9 },
  distracted_senior: { pitch: 1.0, rate: 1.1 },
  culture_fit: { pitch: 1.05, rate: 0.95 },
  silent_observer: { pitch: 0.8, rate: 0.8 },
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
  const [countdown, setCountdown] = useState(120) // 2 minutes in seconds
  const [briefingReady, setBriefingReady] = useState(false)

  // Interview state
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [speakingCharacterId, setSpeakingCharacterId] = useState<string | null>(null)
  const [characterExpressions, setCharacterExpressions] = useState<Record<string, string>>({})
  const [characterLookingAway, setCharacterLookingAway] = useState<Record<string, boolean>>({})

  // Voice I/O
  const { speak, stop: stopSpeech, speaking: isTTSSpeaking } = useSpeech()
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
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Chat scroll
  const chatEndRef = useRef<HTMLDivElement>(null)
  const nextCharacterIndexRef = useRef(0)

  // Text mode fallback (if no speech recognition support)
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
        const expressions: Record<string, string> = {}
        const looking: Record<string, boolean> = {}
        for (const char of data.characters) {
          expressions[char.id] = 'neutral'
          looking[char.id] = char.archetype === 'distracted_senior'
        }
        setCharacterExpressions(expressions)
        setCharacterLookingAway(looking)

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch {
      console.warn('Camera not available')
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

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

      // Reset silence timeout
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = setTimeout(() => {
        // Auto-send after 1.5s silence
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
  // Random character behavior
  // -------------------------------------------

  useEffect(() => {
    if (phase !== 'interview' || !sessionData) return

    const interval = setInterval(() => {
      for (const char of sessionData.characters) {
        // Distracted senior looks away randomly
        if (char.archetype === 'distracted_senior') {
          setCharacterLookingAway(prev => ({ ...prev, [char.id]: Math.random() > 0.4 }))
        }
        // Silent observer takes notes periodically
        if (char.archetype === 'silent_observer') {
          setCharacterExpressions(prev => ({
            ...prev,
            [char.id]: Math.random() > 0.5 ? 'writing' : 'neutral',
          }))
        }
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [phase, sessionData])

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

      // Generate opening lines
      const characters = updated.characters || sessionData.characters
      for (let i = 0; i < characters.length; i++) {
        const char = characters[i]
        const lines = OPENING_LINES[char.archetype] || OPENING_LINES.friendly_champion
        const line = randomFrom(lines)

        setSpeakingCharacterId(char.id)
        setCharacterExpressions(prev => ({ ...prev, [char.id]: 'neutral' }))

        // Speak the line
        if (isSpeakerOn) {
          const voiceConfig = VOICE_CONFIG[char.archetype]
          await speak(line, voiceConfig)
        } else {
          await new Promise(resolve => setTimeout(resolve, char.silenceDuration))
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

      // Start listening for candidate
      if (!textMode) startListening()
      nextCharacterIndexRef.current = 0
    } catch {
      setError('Failed to start interview')
    }
  }

  // -------------------------------------------
  // Send message
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

    // Add candidate exchange
    const tempCandidateExchange: Exchange = {
      id: `temp_${Date.now()}`,
      sequenceNumber: exchanges.length + 1,
      speaker: 'candidate',
      characterId: null,
      messageText: userText,
      timestampMs: elapsedSeconds * 1000,
    }
    setExchanges(prev => [...prev, tempCandidateExchange])

    // Character thinking
    setSpeakingCharacterId(respondingChar.id)
    setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: 'writing' }))

    try {
      // Character-specific silence before responding
      const silenceDuration = respondingChar.silenceDuration
      await new Promise(resolve => setTimeout(resolve, silenceDuration))

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

      // Update expression based on response
      const isShortAnswer = userText.split(' ').length < 15
      if (respondingChar.archetype === 'skeptic' && isShortAnswer) {
        setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: 'skeptical' }))
      } else if (respondingChar.archetype === 'friendly_champion') {
        setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: 'nodding' }))
      } else {
        setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: 'interested' }))
      }

      // Speak the response
      if (isSpeakerOn) {
        const voiceConfig = VOICE_CONFIG[respondingChar.archetype]
        await speak(data.interviewerExchange.messageText, voiceConfig)
      }

      // Update exchanges
      setExchanges(prev => {
        const withoutTemp = prev.filter(e => e.id !== tempCandidateExchange.id)
        return [...withoutTemp, data.candidateExchange, data.interviewerExchange]
      })

      // Reset expression after a moment
      setTimeout(() => {
        setCharacterExpressions(prev => ({ ...prev, [respondingChar.id]: 'neutral' }))
      }, 2000)

      // Resume listening
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

  // -------------------------------------------
  // Toggle speaker
  // -------------------------------------------

  const toggleSpeaker = () => {
    if (isSpeakerOn) stopSpeech()
    setIsSpeakerOn(!isSpeakerOn)
  }

  // -------------------------------------------
  // Key handler
  // -------------------------------------------

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // -------------------------------------------
  // Get character by ID
  // -------------------------------------------

  const getCharacter = (charId: string | null): Character | undefined => {
    if (!charId || !sessionData) return undefined
    return sessionData.characters.find(c => c.id === charId)
  }

  // -------------------------------------------
  // RENDER: Loading
  // -------------------------------------------

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#0a0a1a] flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading interview room...</p>
        </div>
      </div>
    )
  }

  if (error && !sessionData) {
    return (
      <div className="fixed inset-0 bg-[#0a0a1a] flex items-center justify-center z-50">
        <div className="text-center max-w-md">
          <MessageSquare className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to load session</h2>
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
  // RENDER: Briefing (Pre-Interview)
  // -------------------------------------------

  if (phase === 'briefing') {
    return (
      <div className="fixed inset-0 bg-[#0a0a1a] flex items-center justify-center p-4 overflow-y-auto z-50">
        <div className="max-w-2xl w-full space-y-6">
          {/* Meeting-style header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-400 text-xs font-medium">Interview Scheduled</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">
              {application.companyName}
            </h1>
            <p className="text-gray-400">{application.jobTitle}</p>
          </div>

          {/* Interview details card */}
          <div className="bg-[#111127] border border-[#1e1e3a] rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 mb-1">Type</p>
                <p className="text-white text-sm font-medium">{sessionData.stage}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Intensity</p>
                <Badge variant={
                  sessionData.intensity === 'high-pressure' ? 'danger' :
                  sessionData.intensity === 'warmup' ? 'success' : 'info'
                }>
                  {sessionData.intensity}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Duration</p>
                <p className="text-white text-sm font-medium">{sessionData.durationMinutes} min</p>
              </div>
            </div>
          </div>

          {/* Interview panel */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Your Interview Panel
            </h2>
            <div className="space-y-2">
              {characters.map(char => {
                const color = ARCHETYPE_COLORS[char.archetype] || '#6b7280'
                return (
                  <div key={char.id} className="bg-[#111127] border border-[#1e1e3a] rounded-xl p-4 flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {getInitials(char.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{char.name}</p>
                      <p className="text-gray-400 text-sm truncate">{char.title}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Camera/Mic Setup */}
          {!cameraActive ? (
            <div className="bg-[#111127] border border-[#1e1e3a] rounded-xl p-6 text-center space-y-3">
              <Video className="w-8 h-8 text-blue-400 mx-auto" />
              <p className="text-white text-sm font-medium">Camera & Microphone Required</p>
              <p className="text-gray-400 text-xs">Your camera and microphone will be active during the interview.</p>
              <Button onClick={startCamera} className="!bg-blue-600 hover:!bg-blue-700">
                <Video className="w-4 h-4 mr-2" />
                Enable Camera & Mic
              </Button>
            </div>
          ) : (
            <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 flex items-center gap-3">
              <Mic className="w-5 h-5 text-green-400" />
              <p className="text-green-300 text-sm">Camera and microphone connected</p>
            </div>
          )}

          {/* Start button */}
          <div className="text-center pt-2">
            <Button
              size="lg"
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
              className="!bg-blue-600 hover:!bg-blue-700 !px-12"
            >
              Enter Interview Room
            </Button>
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
      <div className="fixed inset-0 bg-[#0a0a1a] flex items-center justify-center z-50">
        <div className="text-center space-y-6">
          {/* Calendar-style notification */}
          <div className="bg-[#111127] border border-blue-500/30 rounded-2xl p-6 max-w-sm mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Interview Starting</p>
                <p className="text-gray-400 text-xs">{application.companyName} — {application.jobTitle}</p>
              </div>
            </div>
          </div>

          <p className="text-gray-400 text-lg">
            Your interview starts in...
          </p>
          <div className="text-8xl font-bold text-white tabular-nums">
            {countdown}
          </div>
          <p className="text-gray-500 text-sm">Take a deep breath and relax</p>
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
      <div className="fixed inset-0 bg-[#0a0a1a] flex items-center justify-center p-4 z-50">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center mx-auto">
            <MessageSquare className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Interview Complete</h1>
          <p className="text-gray-400">
            Great job completing your interview for{' '}
            <span className="text-white font-medium">{application.jobTitle}</span> at{' '}
            <span className="text-white font-medium">{application.companyName}</span>.
          </p>

          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-300 mb-1">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(elapsedSeconds)}</span>
              </div>
              <p className="text-gray-500 text-xs">Duration</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-300 mb-1">
                <MessageSquare className="w-4 h-4" />
                <span>{totalExchanges}</span>
              </div>
              <p className="text-gray-500 text-xs">Exchanges</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button
              size="lg"
              onClick={() => router.push(`/debrief/${sessionId}`)}
              className="!bg-blue-600 hover:!bg-blue-700"
            >
              View Your Debrief
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard')}
              className="!text-gray-400 hover:!text-white"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------
  // RENDER: Interview Room (Main Phase)
  // -------------------------------------------

  const renderCharacterGrid = () => {
    const gridClass = characters.length === 1
      ? 'flex justify-center'
      : characters.length === 2
      ? 'grid grid-cols-2 gap-2'
      : 'grid grid-cols-2 gap-2'

    return (
      <div className={`${gridClass} p-2 max-w-4xl mx-auto`}>
        {characters.map((char, idx) => {
          const isLast = characters.length === 3 && idx === 2
          return (
            <div
              key={char.id}
              className={`aspect-video ${
                characters.length === 1 ? 'w-full max-w-lg' :
                isLast ? 'col-span-2 max-w-sm mx-auto w-full' : ''
              }`}
            >
              <CharacterFace
                character={char}
                isSpeaking={speakingCharacterId === char.id}
                expression={(characterExpressions[char.id] || 'neutral') as 'neutral' | 'interested' | 'skeptical' | 'nodding' | 'writing'}
                isLookingAway={characterLookingAway[char.id] || false}
              />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a1a] flex flex-col z-50">
      {/* Top bar — minimal, like a real video call */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#060610] border-b border-[#1a1a35]">
        <div>
          <p className="text-white text-sm font-medium">{application.companyName}</p>
          <p className="text-gray-500 text-xs">{application.jobTitle} · {sessionData.stage}</p>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm tabular-nums">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Main content: character feeds + chat */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Character video feeds */}
        {renderCharacterGrid()}

        {/* Chat / Transcript area */}
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-2">
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-2">
            {exchanges.map(exchange => {
              const isCandidate = exchange.speaker === 'candidate'
              const char = getCharacter(exchange.characterId)
              const color = char ? ARCHETYPE_COLORS[char.archetype] || '#6b7280' : '#3b82f6'

              return (
                <div key={exchange.id} className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}>
                  {!isCandidate && char && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mr-2 mt-1"
                      style={{ backgroundColor: color }}
                    >
                      {getInitials(char.name)}
                    </div>
                  )}
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    isCandidate
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-[#111127] text-gray-200 rounded-bl-md'
                  }`}>
                    {!isCandidate && char && (
                      <p className="text-xs font-medium mb-1" style={{ color }}>
                        {char.name}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{exchange.messageText}</p>
                  </div>
                </div>
              )
            })}

            {/* Thinking indicator */}
            {isSending && speakingCharacterId && (
              <div className="flex justify-start">
                <div className="bg-[#111127] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 mr-1">thinking</span>
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
            <div className="mb-2 flex items-center justify-center gap-2 py-2">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{
                      height: `${12 + Math.random() * 16}px`,
                      animationDelay: `${i * 100}ms`,
                      animationDuration: '0.5s',
                    }}
                  />
                ))}
              </div>
              <span className="text-red-400 text-xs font-medium">Listening...</span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-2 px-3 py-2 bg-red-900/40 border border-red-700/50 rounded-lg flex items-center gap-2">
              <p className="text-red-300 text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-sm">Dismiss</button>
            </div>
          )}

          {/* Text input (always visible as fallback, primary in text mode) */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={textMode ? 'Type your response...' : 'Type or speak your response...'}
              disabled={isSending}
              className="flex-1 bg-[#111127] text-white placeholder-gray-500 border border-[#1e1e3a] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isSending || !inputText.trim()}
              className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom controls bar */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 bg-[#060610] border-t border-[#1a1a35]">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMicOn
              ? 'bg-[#111127] text-white hover:bg-[#1e1e3a]'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
          title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleSpeaker}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isSpeakerOn
              ? 'bg-[#111127] text-white hover:bg-[#1e1e3a]'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
          title={isSpeakerOn ? 'Mute interviewer voice' : 'Unmute interviewer voice'}
        >
          {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        <button
          onClick={handleEndInterview}
          className="h-12 px-6 rounded-full bg-red-600 text-white flex items-center justify-center gap-2 hover:bg-red-700 transition-colors font-medium text-sm"
        >
          <PhoneOff className="w-5 h-5" />
          End Interview
        </button>
      </div>

      {/* Candidate self-view webcam */}
      {cameraActive && (
        <div className="absolute bottom-20 right-4 w-36 h-28 rounded-xl overflow-hidden bg-[#111127] border border-[#1e1e3a] shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1 left-1">
            <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              You
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
