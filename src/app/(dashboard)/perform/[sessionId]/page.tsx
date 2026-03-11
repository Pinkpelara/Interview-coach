'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Mic,
  MicOff,
  Clock,
  Video,
  VideoOff,
  User,
  MessageSquare,
  Volume2,
  VolumeX,
} from 'lucide-react'
import AnimatedAvatar from '@/components/perform/AnimatedAvatar'
import { useInterviewExchangeTransport } from '@/lib/interview/useInterviewExchangeTransport'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
  avatarKey?: string
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

function resolveSilenceDuration(character: Character): number {
  if (character.archetype === 'distracted_senior') {
    return Math.random() > 0.5 ? 1500 : 7000
  }
  return character.silenceDuration
}

// ---------------------------------------------------------------------------
// Character Face Component — Real-Time Animated Video Avatar
// Uses Canvas-based face renderer with lip sync, blinking, expressions
// ---------------------------------------------------------------------------

function CharacterFace({
  character,
  isSpeaking,
  speechLevel,
  expression,
  isLookingAway,
}: {
  character: Character
  isSpeaking: boolean
  speechLevel: number
  expression: 'neutral' | 'interested' | 'skeptical' | 'nodding' | 'writing'
  isLookingAway: boolean
}) {
  const color = ARCHETYPE_COLORS[character.archetype] || '#6b7280'

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-[#0a0e14] group">
      {/* Animated Canvas Avatar — real-time rendered face */}
      <div className="absolute inset-0">
        <AnimatedAvatar
          seed={character.name}
          avatarKey={character.avatarKey}
          isSpeaking={isSpeaking}
          audioLevel={speechLevel}
          expression={expression}
          isLookingAway={isLookingAway}
          accentColor={color}
          width={480}
          height={480}
        />
      </div>

      {/* Speaking border glow */}
      {isSpeaking && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: `2px solid ${color}`,
            boxShadow: `0 0 20px ${color}40, inset 0 0 10px ${color}10`,
          }}
        />
      )}

      {/* Name label — video call style */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{character.name}</p>
          {isSpeaking && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          )}
        </div>
        <p className="text-gray-400 text-xs truncate">{character.title}</p>
      </div>

      {/* Expression overlay indicators */}
      {expression === 'writing' && (
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1.5">
          <span className="text-yellow-400 text-[10px]">Taking notes</span>
          <span className="text-yellow-400 text-[10px] animate-pulse">...</span>
        </div>
      )}

      {/* Archetype label on hover */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm"
          style={{ backgroundColor: color + '30', color: color }}
        >
          {ARCHETYPE_LABELS[character.archetype] || character.archetype}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Voice config per archetype — OpenAI-compatible TTS voices
// ---------------------------------------------------------------------------
// OpenAI voices: alloy (neutral), ash (warm male), ballad (expressive),
// coral (warm female), echo (calm male), fable (storyteller), onyx (deep male),
// nova (bright female), sage (thoughtful), shimmer (upbeat female), verse (versatile)

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

// Fallback Web Speech API config when server TTS is unavailable
const FALLBACK_VOICE_CONFIG: Record<string, { pitch: number; rate: number }> = {
  skeptic: { pitch: 0.85, rate: 0.88 },
  friendly_champion: { pitch: 1.08, rate: 1.0 },
  technical_griller: { pitch: 0.92, rate: 0.92 },
  distracted_senior: { pitch: 1.0, rate: 1.05 },
  culture_fit: { pitch: 1.05, rate: 0.95 },
  silent_observer: { pitch: 0.85, rate: 0.82 },
}

const ALLOW_BROWSER_TTS_FALLBACK = process.env.NEXT_PUBLIC_ALLOW_BROWSER_TTS_FALLBACK === 'true'

// ---------------------------------------------------------------------------
// Speech synthesis hook — server TTS first, browser fallback
// ---------------------------------------------------------------------------

function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [voiceEngine, setVoiceEngine] = useState<'server' | 'browser'>('server')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [speechLevel, setSpeechLevel] = useState(0)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const analyserFrameRef = useRef<number | null>(null)
  const browserLevelTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    return () => {
      currentAudioRef.current?.pause()
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
      }
      if (analyserFrameRef.current) {
        cancelAnimationFrame(analyserFrameRef.current)
      }
      if (browserLevelTimerRef.current) {
        clearInterval(browserLevelTimerRef.current)
      }
      sourceNodeRef.current?.disconnect()
      analyserRef.current?.disconnect()
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close()
      }
      synthRef.current?.cancel()
    }
  }, [])

  const stopAudioLevelTracking = useCallback(() => {
    if (analyserFrameRef.current) {
      cancelAnimationFrame(analyserFrameRef.current)
      analyserFrameRef.current = null
    }
    if (browserLevelTimerRef.current) {
      clearInterval(browserLevelTimerRef.current)
      browserLevelTimerRef.current = null
    }
    setSpeechLevel(0)
  }, [])

  const startServerAudioTracking = useCallback((audio: HTMLAudioElement) => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      sourceNodeRef.current?.disconnect()
      analyserRef.current?.disconnect()

      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.75

      source.connect(analyser)
      analyser.connect(ctx.destination)

      sourceNodeRef.current = source
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] - 128) / 128
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / data.length)
        const level = Math.max(0, Math.min(1, (rms - 0.01) * 8))
        setSpeechLevel(level)
        analyserFrameRef.current = requestAnimationFrame(tick)
      }
      if (analyserFrameRef.current) cancelAnimationFrame(analyserFrameRef.current)
      analyserFrameRef.current = requestAnimationFrame(tick)
    } catch (err) {
      console.warn('Unable to attach analyser to TTS audio:', err)
      setSpeechLevel(0.35)
    }
  }, [])

  const startBrowserSpeechTracking = useCallback(() => {
    if (browserLevelTimerRef.current) clearInterval(browserLevelTimerRef.current)
    let t = 0
    browserLevelTimerRef.current = setInterval(() => {
      t += 0.2
      const level = 0.2 + Math.max(0, Math.sin(t)) * 0.55 + Math.random() * 0.1
      setSpeechLevel(Math.min(1, level))
    }, 70)
  }, [])

  const speak = useCallback((text: string, voiceConfig?: { voice: string; instructions: string }) => {
    return new Promise<void>(async (resolve) => {
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
        currentAudioUrlRef.current = null
      }
      synthRef.current?.cancel()
      stopAudioLevelTracking()

      setSpeaking(true)
      setSpeechError(null)

      // Primary path: server-generated TTS (stable and deterministic)
      let serverTTSSuccess = false
      let serverTTSErrorMessage = ''
      try {
        if (voiceConfig) {
          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              voice: voiceConfig.voice,
              instructions: voiceConfig.instructions,
            }),
          })

          if (response.ok) {
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            currentAudioRef.current = audio
            currentAudioUrlRef.current = url
            setVoiceEngine('server')
            startServerAudioTracking(audio)
            audio.onended = () => {
              setSpeaking(false)
              stopAudioLevelTracking()
              currentAudioRef.current = null
              if (currentAudioUrlRef.current) {
                URL.revokeObjectURL(currentAudioUrlRef.current)
                currentAudioUrlRef.current = null
              }
              resolve()
            }
            audio.onerror = () => {
              setSpeaking(false)
              stopAudioLevelTracking()
              currentAudioRef.current = null
              if (currentAudioUrlRef.current) {
                URL.revokeObjectURL(currentAudioUrlRef.current)
                currentAudioUrlRef.current = null
              }
              resolve()
            }
            await audio.play()
            serverTTSSuccess = true
            return
          } else {
            const errorBody = await response.json().catch(() => ({}))
            serverTTSErrorMessage =
              typeof errorBody?.error === 'string'
                ? errorBody.error
                : 'Server voice synthesis is unavailable right now.'
          }
        }
      } catch (e) {
        serverTTSErrorMessage = 'Server voice synthesis is unavailable right now.'
        console.warn('Server TTS failed:', e)
      }

      if (!serverTTSSuccess && !ALLOW_BROWSER_TTS_FALLBACK) {
        setVoiceEngine('server')
        setSpeaking(false)
        stopAudioLevelTracking()
        setSpeechError(serverTTSErrorMessage || 'Human-like interviewer voice is unavailable. Configure server TTS.')
        resolve()
        return
      }

      // Fallback: Web Speech API — pick the most natural-sounding voice available
      if (!synthRef.current) { setSpeaking(false); resolve(); return }
      setVoiceEngine('browser')
      startBrowserSpeechTracking()
      setSpeechError('Using browser fallback voice. Configure server TTS for human-like interview voices.')

      const utterance = new SpeechSynthesisUtterance(text)
      const archetype = Object.entries(VOICE_CONFIG).find(([, v]) => v.voice === voiceConfig?.voice)?.[0]
      const fallback = FALLBACK_VOICE_CONFIG[archetype || 'friendly_champion'] || { pitch: 1, rate: 0.95 }
      utterance.pitch = fallback.pitch
      utterance.rate = fallback.rate
      utterance.volume = 1

      // Prioritize natural/neural voices that sound human, not robotic
      const voices = synthRef.current.getVoices().filter(v => v.lang.startsWith('en'))
      const naturalVoice = voices.find(v =>
        v.name.includes('Natural') || v.name.includes('Neural') ||
        v.name.includes('Enhanced') || v.name.includes('Premium')
      )
      const googleVoice = voices.find(v => v.name.includes('Google'))
      const microsoftVoice = voices.find(v => v.name.includes('Microsoft') && (v.name.includes('Online') || v.name.includes('Natural')))
      const preferred = naturalVoice || microsoftVoice || googleVoice || voices[0]
      if (preferred) utterance.voice = preferred

      utterance.onend = () => { setSpeaking(false); stopAudioLevelTracking(); resolve() }
      utterance.onerror = () => { setSpeaking(false); stopAudioLevelTracking(); resolve() }
      synthRef.current.speak(utterance)
    })
  }, [startBrowserSpeechTracking, startServerAudioTracking, stopAudioLevelTracking])

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }
    synthRef.current?.cancel()
    stopAudioLevelTracking()
    setSpeaking(false)
  }, [stopAudioLevelTracking])

  return { speak, stop, speaking, voiceEngine, speechLevel, speechError }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function InterviewRoomPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  // Core state
  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const endingRef = useRef(false)

  // Briefing countdown
  const [countdown, setCountdown] = useState(120) // 2 minutes in seconds

  // Interview state
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isConnectionHealthy, setIsConnectionHealthy] = useState(true)
  const [pendingRetry, setPendingRetry] = useState<{ messageText: string; characterId: string } | null>(null)
  const [speakingCharacterId, setSpeakingCharacterId] = useState<string | null>(null)
  const [characterExpressions, setCharacterExpressions] = useState<Record<string, string>>({})
  const [characterLookingAway, setCharacterLookingAway] = useState<Record<string, boolean>>({})

  // Voice I/O
  const { speak, stop: stopSpeech, speaking: isTTSSpeaking, voiceEngine, speechLevel, speechError } = useSpeech()
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

  // Text mode fallback (if no speech recognition support)
  const [speechSupported, setSpeechSupported] = useState(true)

  const sendExchangeHttp = useCallback(
    async ({ messageText, characterId }: { messageText: string; characterId: string }) => {
      const res = await fetch(`/api/sessions/${sessionId}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText, characterId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }
      return res.json()
    },
    [sessionId]
  )

  const { sendExchange, transportStatus } = useInterviewExchangeTransport(sessionId, sendExchangeHttp)

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
    const supported = !!(w.SpeechRecognition || w.webkitSpeechRecognition)
    setSpeechSupported(supported)
    if (!supported) {
      setError('This browser does not support live speech transcription. Please use Chrome or Edge for spoken interviews.')
    }
  }, [])

  // -------------------------------------------
  // Camera setup
  // -------------------------------------------

  const startCamera = async (): Promise<boolean> => {
    try {
      const isPhoneScreen = sessionData?.stage === 'Phone Screen'
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !isPhoneScreen,
        audio: true,
      })
      streamRef.current = stream
      if (!isPhoneScreen) {
        if (videoRef.current) videoRef.current.srcObject = stream
        if (selfViewRef.current) selfViewRef.current.srcObject = stream
      }
      const hasAudio = stream.getAudioTracks().length > 0
      const hasVideo = isPhoneScreen ? true : stream.getVideoTracks().length > 0
      if (!hasAudio || !hasVideo) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setCameraActive(false)
        setIsCameraOn(false)
        setError(isPhoneScreen ? 'Microphone check failed. Please reconnect your microphone.' : 'Camera or microphone check failed. Please reconnect both and try again.')
        return false
      }
      setCameraActive(true)
      setIsCameraOn(!isPhoneScreen)
      return true
    } catch {
      setCameraActive(false)
      setError('Unable to access your camera/microphone. Please grant permissions and retry.')
      return false
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

  // Sync selfViewRef when stream changes
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
    if (!speechSupported) return

    const w = window as any
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

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
      setIsListening(false)
    }
  }, [speechSupported])

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

  useEffect(() => {
    if (phase !== 'interview' || !sessionData) return
    const maxSeconds = sessionData.durationMinutes * 60
    if (elapsedSeconds >= maxSeconds) {
      void handleEndInterview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds, phase, sessionData])

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
  // Connectivity signals
  // -------------------------------------------

  useEffect(() => {
    const onOnline = () => setIsConnectionHealthy(true)
    const onOffline = () => setIsConnectionHealthy(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

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
        const lines = getOpeningLines(char.archetype, sessionData.application?.companyName, sessionData.application?.jobTitle)
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
      if (speechSupported && isMicOn) startListening()
      nextCharacterIndexRef.current = 0
    } catch {
      setError('Failed to start interview')
    }
  }

  // -------------------------------------------
  // Send message
  // -------------------------------------------

  const handleSend = async (
    forcedText?: string,
    forcedCharacterId?: string
  ) => {
    const outboundText = (forcedText ?? inputText).trim()
    if (!outboundText || isSending || !sessionData) return

    const characters = sessionData.characters
    if (!characters.length) return

    let respondingChar = characters[0]
    if (forcedCharacterId) {
      respondingChar = characters.find((c) => c.id === forcedCharacterId) || respondingChar
    } else {
      const charIndex = nextCharacterIndexRef.current % characters.length
      respondingChar = characters[charIndex]
      nextCharacterIndexRef.current = charIndex + 1
    }

    const userText = outboundText
    setInputText('')
    setIsSending(true)
    setPendingRetry(null)
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
      const silenceDuration = resolveSilenceDuration(respondingChar)
      await new Promise(resolve => setTimeout(resolve, silenceDuration))

      const data = await sendExchange({
        messageText: userText,
        characterId: respondingChar.id,
      })
      setIsConnectionHealthy(true)

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
      if (speechSupported && isMicOn) startListening()
    } catch (err) {
      setIsConnectionHealthy(false)
      setPendingRetry({ messageText: userText, characterId: respondingChar.id })
      setExchanges(prev => prev.filter(e => e.id !== tempCandidateExchange.id))
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSpeakingCharacterId(null)
      setIsSending(false)
    }
  }

  const handleRetryPending = async () => {
    if (!pendingRetry || !sessionData) return
    setError(null)
    setIsConnectionHealthy(navigator.onLine)
    await handleSend(pendingRetry.messageText, pendingRetry.characterId)
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
    if (!sessionData || endingRef.current) return
    endingRef.current = true
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
      if (speechSupported) startListening()
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
  const isPhoneScreen = sessionData.stage === 'Phone Screen'

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
              {isPhoneScreen ? <Mic className="w-8 h-8 text-blue-400 mx-auto" /> : <Video className="w-8 h-8 text-blue-400 mx-auto" />}
              <p className="text-white text-sm font-medium">
                {isPhoneScreen ? 'Microphone Required' : 'Camera & Microphone Required'}
              </p>
              <p className="text-gray-400 text-xs">
                {isPhoneScreen
                  ? 'Phone Screen mode is audio-only. Your microphone must be active.'
                  : 'Your camera and microphone will be active during the interview.'}
              </p>
              <Button onClick={startCamera} className="!bg-blue-600 hover:!bg-blue-700">
                {isPhoneScreen ? <Mic className="w-4 h-4 mr-2" /> : <Video className="w-4 h-4 mr-2" />}
                {isPhoneScreen ? 'Enable Microphone' : 'Enable Camera & Mic'}
              </Button>
            </div>
          ) : (
            <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 flex items-center gap-3">
              <Mic className="w-5 h-5 text-green-400" />
              <p className="text-green-300 text-sm">
                {isPhoneScreen ? 'Microphone connected' : 'Camera and microphone connected'}
              </p>
            </div>
          )}

          {!speechSupported && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
              <p className="text-red-300 text-sm">
                This browser does not support live speech transcription. Use Chrome or Edge to run spoken interviews.
              </p>
            </div>
          )}

          {/* Start button */}
          <div className="text-center pt-2">
            <Button
              size="lg"
              onClick={async () => {
                if (!speechSupported) return
                const ready = cameraActive || await startCamera()
                if (!ready) return
                setCountdown(120)
                setPhase('countdown')
              }}
              disabled={!speechSupported}
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

  // Webcam tile component for the video grid
  const renderSelfView = () => (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-[#0d0d20]">
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
        <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%)' }}>
          <div className="w-16 h-16 rounded-full bg-blue-600/30 flex items-center justify-center">
            <User className="w-8 h-8 text-blue-300" />
          </div>
          {!cameraActive && <p className="text-gray-500 text-xs">Camera off</p>}
        </div>
      )}
      {/* Name label */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-white text-sm font-medium">You</p>
      </div>
      {/* Mic active indicator */}
      {isMicOn && isListening && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 rounded-full px-2 py-0.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        </div>
      )}
      {/* Camera off overlay */}
      {cameraActive && !isCameraOn && (
        <div className="absolute inset-0 bg-[#0d0d20] flex flex-col items-center justify-center gap-2">
          <div className="w-16 h-16 rounded-full bg-blue-600/30 flex items-center justify-center">
            <User className="w-8 h-8 text-blue-300" />
          </div>
        </div>
      )}
    </div>
  )

  const renderCharacterGrid = () => {
    if (isPhoneScreen) {
      const active = characters[0]
      return (
        <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-[#1a1a35] bg-[#060610] p-10 text-center">
            <div className="mx-auto w-24 h-24 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Mic className="w-10 h-10 text-blue-300" />
            </div>
            <p className="mt-4 text-white text-lg font-medium">{active?.name || 'Interviewer'}</p>
            <p className="text-gray-400 text-sm">{active?.title || 'Phone Screen'}</p>
            <p className="mt-6 text-gray-500 text-xs">Audio-only interview in progress</p>
          </div>
        </div>
      )
    }

    const cols = characters.length <= 2 ? 2 : 3

    return (
      <div className="flex-1 min-h-0 p-2">
        <div
          className="w-full h-full gap-2 max-w-6xl mx-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: '1fr',
          }}
        >
          {/* Interviewer character tiles */}
          {characters.map(char => (
            <div key={char.id} className="min-h-0">
              <CharacterFace
                character={char}
                isSpeaking={speakingCharacterId === char.id}
                speechLevel={speakingCharacterId === char.id ? speechLevel : 0}
                expression={(characterExpressions[char.id] || 'neutral') as 'neutral' | 'interested' | 'skeptical' | 'nodding' | 'writing'}
                isLookingAway={characterLookingAway[char.id] || false}
              />
            </div>
          ))}
        </div>
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
        <div className="flex items-center gap-3 text-gray-300">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
            transportStatus === 'websocket'
              ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
              : transportStatus === 'connecting'
              ? 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10'
              : 'text-gray-300 border-gray-500/30 bg-gray-500/10'
          }`}>
            {transportStatus === 'websocket' ? 'WebSocket' : transportStatus === 'connecting' ? 'Connecting' : 'HTTP'}
          </span>
          {isSpeakerOn && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              voiceEngine === 'server'
                ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                : 'text-amber-300 border-amber-500/30 bg-amber-500/10'
            }`}>
              {voiceEngine === 'server' ? 'Human voice' : 'Browser fallback'}
            </span>
          )}
          {isTTSSpeaking && (
            <span className="text-[10px] text-blue-300">Speaking...</span>
          )}
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm tabular-nums">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Main content: full-screen video grid */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          {renderCharacterGrid()}
        </div>
      </div>

      {!isPhoneScreen && (
        <div className="absolute right-4 bottom-24 z-20 w-64 h-40 rounded-xl overflow-hidden border border-[#1e1e3a] shadow-2xl">
          {renderSelfView()}
        </div>
      )}

      {/* Minimal status overlays (video-call style) */}
      <div className="absolute left-4 bottom-24 z-20 space-y-2 max-w-sm">
        {isListening && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-red-300 text-xs font-medium">Listening...</span>
          </div>
        )}

        {isSending && speakingCharacterId && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
            <span className="text-gray-200 text-xs">Interviewer is thinking</span>
            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
        )}

        {error && (
          <div className="px-3 py-2 bg-red-900/50 border border-red-700/50 rounded-lg">
            <p className="text-red-200 text-xs">{error}</p>
            {pendingRetry && (
              <button
                onClick={handleRetryPending}
                disabled={isSending}
                className="mt-2 text-[11px] text-red-100 underline disabled:opacity-60"
              >
                Retry last answer
              </button>
            )}
          </div>
        )}

        {speechError && (
          <div className="px-3 py-2 bg-amber-900/45 border border-amber-700/50 rounded-lg">
            <p className="text-amber-200 text-xs">{speechError}</p>
          </div>
        )}

        {!isConnectionHealthy && (
          <div className="px-3 py-2 bg-amber-900/40 border border-amber-700/50 rounded-lg">
            <p className="text-amber-200 text-xs">
              Connection is unstable. Your last answer is preserved and can be retried.
            </p>
          </div>
        )}

      </div>

      <div ref={chatEndRef} className="hidden" />

      {/* Bottom controls bar */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-[#060610] border-t border-[#1a1a35]">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMicOn
              ? 'bg-[#1e1e3a] text-white hover:bg-[#2a2a4a]'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
          title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {!isPhoneScreen && (
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isCameraOn
                ? 'bg-[#1e1e3a] text-white hover:bg-[#2a2a4a]'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={toggleSpeaker}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isSpeakerOn
              ? 'bg-[#1e1e3a] text-white hover:bg-[#2a2a4a]'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
          title={isSpeakerOn ? 'Mute interviewer voice' : 'Unmute interviewer voice'}
        >
          {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

      </div>

      {/* Hidden video element for camera stream (used by selfViewRef in grid) */}
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
