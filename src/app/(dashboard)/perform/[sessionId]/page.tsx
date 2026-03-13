'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Clock,
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

const ARCHETYPE_VOICE_INSTRUCTIONS: Record<string, string> = {
  skeptic: 'Speak like a real person in a meeting. Measured pace, natural breathing pauses. Do NOT sound robotic or overly polished — use slight hesitations and emphasis like a real skeptical interviewer would.',
  friendly_champion: 'Speak like a warm, supportive colleague. Conversational and relaxed with natural rhythm. Use slight vocal variety — not monotone, not overly enthusiastic. Sound like a real human, not a voice assistant.',
  technical_griller: 'Speak like a real senior engineer in an interview. Direct and precise but human — natural pauses between thoughts, slight vocal fry occasionally. Not robotic or stilted.',
  distracted_senior: 'Speak like a busy executive who is somewhat distracted. Casual, slightly rushed, natural pace changes. Trail off sometimes. Sound genuinely human and slightly impatient.',
  culture_fit: 'Speak like a warm HR person having a genuine conversation. Relaxed, curious, natural pacing with occasional "hmm" moments. Sound authentically human, not like AI narration.',
  silent_observer: 'Speak quietly and sparingly like a reserved person who rarely talks. Low energy but natural. Brief and human.',
}

const ARCHETYPE_PREFERRED_VOICES: Record<string, string> = {
  skeptic: 'ash',
  friendly_champion: 'coral',
  technical_griller: 'sage',
  distracted_senior: 'fable',
  culture_fit: 'shimmer',
  silent_observer: 'alloy',
}

// Speed modifiers per archetype for more natural pacing
const ARCHETYPE_SPEED: Record<string, number> = {
  skeptic: 0.92,
  friendly_champion: 1.0,
  technical_griller: 0.95,
  distracted_senior: 1.08,
  culture_fit: 0.97,
  silent_observer: 0.88,
}

// Ref to share the active AnalyserNode with the UI
let activeAnalyserRef: AnalyserNode | null = null

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
    await new Promise(r => setTimeout(r, Math.min(text.length * 50, 5000)))
    onEnd()
    return
  }

  const instructions = archetype ? ARCHETYPE_VOICE_INSTRUCTIONS[archetype] || '' : ''
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
        speed: archetype ? ARCHETYPE_SPEED[archetype] || 1.0 : 1.0,
      }),
    })
    if (res.ok && res.headers.get('content-type')?.includes('audio/')) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      // Create AnalyserNode for audio-reactive bars
      try {
        const audioCtx = new AudioContext()
        const source = audioCtx.createMediaElementSource(audio)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 32
        source.connect(analyser)
        analyser.connect(audioCtx.destination)
        activeAnalyserRef = analyser
      } catch {
        activeAnalyserRef = null
      }

      return new Promise<void>((resolve) => {
        audio.onplay = onStart
        audio.onended = () => { onEnd(); activeAnalyserRef = null; URL.revokeObjectURL(url); resolve() }
        audio.onerror = () => { onEnd(); activeAnalyserRef = null; URL.revokeObjectURL(url); resolve() }
        audio.play().catch(() => { onEnd(); activeAnalyserRef = null; URL.revokeObjectURL(url); resolve() })
      })
    }
  } catch {
    // Server TTS not available
  }

  // Fallback: browser speechSynthesis
  if ('speechSynthesis' in window) {
    activeAnalyserRef = null
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      const voices = window.speechSynthesis.getVoices()
      const preferredVoices = voices.filter(v =>
        v.lang.startsWith('en') && (
          v.name.includes('Google') || v.name.includes('Natural') ||
          v.name.includes('Neural') || v.name.includes('Samantha') ||
          v.name.includes('Daniel') || v.name.includes('Karen') || v.name.includes('Moira')
        )
      )
      if (preferredVoices.length > 0) {
        const voiceIndex = archetype
          ? Object.keys(ARCHETYPE_VOICE_INSTRUCTIONS).indexOf(archetype) % preferredVoices.length
          : 0
        utterance.voice = preferredVoices[voiceIndex]
      }

      switch (archetype) {
        case 'skeptic': utterance.rate = 0.88; utterance.pitch = 0.9; break
        case 'friendly_champion': utterance.rate = 1.0; utterance.pitch = 1.1; break
        case 'technical_griller': utterance.rate = 0.92; utterance.pitch = 0.95; break
        case 'distracted_senior': utterance.rate = 1.05; utterance.pitch = 0.95; break
        case 'culture_fit': utterance.rate = 0.95; utterance.pitch = 1.05; break
        case 'silent_observer': utterance.rate = 0.85; utterance.pitch = 0.85; utterance.volume = 0.7; break
        default: utterance.rate = 0.95; utterance.pitch = 1.0
      }

      utterance.onstart = onStart
      utterance.onend = () => { onEnd(); resolve() }
      utterance.onerror = () => { onEnd(); resolve() }
      window.speechSynthesis.speak(utterance)
    })
  }

  onStart()
  await new Promise(r => setTimeout(r, Math.min(text.length * 50, 5000)))
  onEnd()
}

// ---------------------------------------------------------------------------
// Archetype silence delay — dead air before responding (spec 2.1)
// ---------------------------------------------------------------------------

const SILENCE_DURATIONS: Record<string, [number, number]> = {
  skeptic: [3000, 4000],
  friendly_champion: [1000, 2000],
  technical_griller: [4000, 5000],
  distracted_senior: [1000, 8000],
  culture_fit: [2000, 3000],
  silent_observer: [0, 0],
}

function getArchetypeSilence(archetype: string): number {
  const range = SILENCE_DURATIONS[archetype] || [2000, 3000]
  return range[0] + Math.random() * (range[1] - range[0])
}

// ---------------------------------------------------------------------------
// Join sound — two-tone chime (spec 2.7)
// ---------------------------------------------------------------------------

function playJoinSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => { ctx.close() }
  } catch { /* silent fail */ }
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
// ListenState machine (spec 2.8)
// ---------------------------------------------------------------------------

type ListenState = 'idle' | 'listening' | 'processing' | 'ai_speaking'

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
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
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
  const speakerEnabledRef = useRef(true)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef('')
  const phaseRef = useRef(phase)

  // ListenState machine (spec 2.8)
  const listenStateRef = useRef<ListenState>('idle')

  // Backend-driven next character
  const nextCharacterIdRef = useRef<string | null>(null)
  const charactersRef = useRef<Character[]>([])

  // Audio-reactive speaker bars (spec 2.10)
  const barRefs = useRef<(HTMLDivElement | null)[]>([])
  const animFrameRef = useRef<number>(0)

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase }, [phase])

  // Audio-reactive bar animation loop
  useEffect(() => {
    if (!activeSpeakerId) {
      cancelAnimationFrame(animFrameRef.current)
      barRefs.current.forEach(bar => { if (bar) bar.style.height = '4px' })
      return
    }

    const tick = () => {
      if (activeAnalyserRef) {
        const dataArray = new Uint8Array(activeAnalyserRef.frequencyBinCount)
        activeAnalyserRef.getByteFrequencyData(dataArray)
        barRefs.current.forEach((bar, i) => {
          if (bar) {
            const value = dataArray[Math.min(i * 3, dataArray.length - 1)] || 0
            bar.style.height = `${4 + (value / 255) * 14}px`
          }
        })
      } else {
        // Browser TTS fallback: simulated sine wave pulse
        const t = Date.now() / 200
        barRefs.current.forEach((bar, i) => {
          if (bar) {
            const value = Math.sin(t + i * 0.8) * 0.5 + 0.5
            bar.style.height = `${4 + value * 12}px`
          }
        })
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animFrameRef.current)
  }, [activeSpeakerId])

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
    characters: Character[]
  ) => {
    if (!candidateText.trim()) return

    listenStateRef.current = 'processing'

    // Add candidate message to chat
    addMessage({
      speaker: 'candidate',
      speakerName: 'You',
      text: candidateText,
      isCandidate: true,
    })

    try {
      // Don't send characterId — let the backend decide based on question ownership
      const res = await fetch(`/api/sessions/${sessionId}/exchanges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: candidateText }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        console.error('Exchange error:', err)
        listenStateRef.current = 'idle'
        return
      }

      const data = await res.json()
      const responseText = data.interviewerExchange?.messageText || 'Could you elaborate on that?'
      const respChar = data.character

      // Store backend's next character suggestion
      if (data.nextCharacterId) {
        nextCharacterIdRef.current = data.nextCharacterId
      }

      // Dead air — real interviewer pausing to think. Nothing visible changes on screen. (spec 2.1)
      const silenceMs = getArchetypeSilence(respChar?.archetype || 'friendly_champion')
      if (silenceMs > 0) {
        await new Promise(r => setTimeout(r, silenceMs))
      }

      // Add interviewer message to chat
      const actualChar = characters.find(c => c.id === respChar?.id)
      addMessage({
        speaker: respChar?.id || 'interviewer',
        speakerName: respChar?.name || 'Interviewer',
        text: responseText,
        avatarColor: actualChar?.avatarColor || respChar?.avatarColor || '#5b5fc7',
        isCandidate: false,
      })

      // Speak the response via TTS
      listenStateRef.current = 'ai_speaking'
      await speakText(
        responseText,
        actualChar?.voiceId || 'alloy',
        speakerEnabledRef.current,
        () => setActiveSpeakerId(respChar?.id || null),
        () => setActiveSpeakerId(null),
        respChar?.archetype
      )

      // Handle session ended from backend (spec 2.9)
      if (data.sessionEnded) {
        // Stop listening
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch { /* ok */ }
          recognitionRef.current = null
        }
        setInterimTranscript('')
        window.speechSynthesis?.cancel()
        setPhase('ended')
        mediaStreamRef.current?.getTracks().forEach(t => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)

        // Mark session completed on server
        try {
          await fetch(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          })
        } catch { /* best effort */ }

        listenStateRef.current = 'idle'
        return
      }
    } catch (err) {
      console.error('Exchange failed:', err)
    }

    listenStateRef.current = 'idle'
  }, [sessionId, addMessage])

  // -------------------------------------------------------------------------
  // Speech recognition management (spec 2.8 — state machine)
  // -------------------------------------------------------------------------

  const startListening = useCallback(() => {
    // Only start if idle (spec 2.8)
    if (listenStateRef.current !== 'idle') return

    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ok */ }
    }

    const recognition = createSpeechRecognition()
    if (!recognition) return

    recognitionRef.current = recognition
    finalTranscriptRef.current = ''
    setInterimTranscript('')
    listenStateRef.current = 'listening'

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

      // Reset silence timer on new speech (spec 2.6: 1.5 seconds)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        const text = finalTranscriptRef.current.trim()
        if (text && phaseRef.current === 'live' && listenStateRef.current === 'listening') {
          listenStateRef.current = 'processing'
          recognition.stop()
          setInterimTranscript('')
          sendExchange(text, charactersRef.current).then(() => {
            // Resume listening after AI responds
            if (phaseRef.current === 'live' && listenStateRef.current === 'idle') {
              startListening()
            }
          })
        }
      }, 1500)
    }

    recognition.onend = () => {
      // Only restart if state is 'listening' (unexpected browser stop) (spec 2.8)
      if (listenStateRef.current === 'listening') {
        const text = finalTranscriptRef.current.trim()
        if (!text) {
          setTimeout(() => {
            if (phaseRef.current === 'live' && listenStateRef.current === 'listening') {
              listenStateRef.current = 'idle'
              startListening()
            }
          }, 500)
        }
      }
      // If processing or ai_speaking, do nothing
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error)
      }
      // Only restart if listening (spec 2.8)
      if (listenStateRef.current === 'listening') {
        listenStateRef.current = 'idle'
        setTimeout(() => {
          if (phaseRef.current === 'live' && listenStateRef.current === 'idle') {
            startListening()
          }
        }, 1000)
      }
    }

    try {
      recognition.start()
    } catch {
      listenStateRef.current = 'idle'
    }
  }, [sendExchange])

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ok */ }
      recognitionRef.current = null
    }
    listenStateRef.current = 'idle'
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

    // Staggered joins (spec 2.7)
    for (let i = 0; i < sessionData.characters.length; i++) {
      const char = sessionData.characters[i]

      if (char.archetype === 'distracted_senior') {
        // Joins 2-3 minutes late
        const lateJoinDelay = 120000 + Math.random() * 60000
        setTimeout(() => {
          playJoinSound()
          addMessage({
            speaker: 'system',
            speakerName: 'System',
            text: `${char.name} joined the meeting`,
            isCandidate: false,
          })
        }, lateJoinDelay)
        continue
      }

      // Normal join: staggered 0.8-4 seconds between each person
      await new Promise(r => setTimeout(r, i === 0 ? 800 : 1500 + Math.random() * 2500))
      playJoinSound()
      addMessage({
        speaker: 'system',
        speakerName: 'System',
        text: `${char.name} joined the meeting`,
        isCandidate: false,
      })
    }

    // Brief pause after joins, then first character greets
    await new Promise(r => setTimeout(r, 1500))

    if (sessionData.characters.length > 0) {
      // Find the first question's owner for the greeting
      let greetingChar = sessionData.characters.find(c =>
        c.archetype !== 'silent_observer' && c.archetype !== 'distracted_senior'
      ) || sessionData.characters[0]

      // Try to get first question owner from the question plan
      let firstQuestion = "tell me a little about yourself and why you're interested in this role."
      try {
        const sessionRes = await fetch(`/api/sessions/${sessionId}`)
        if (sessionRes.ok) {
          const sessionJson = await sessionRes.json()
          const events = sessionJson.unexpectedEvents
          if (events?.questionPlan?.length > 0) {
            const firstQ = events.questionPlan[0]
            // Use the question's owner for the greeting
            const owner = sessionData.characters.find(c => c.id === firstQ.ownerId)
            if (owner) greetingChar = owner

            firstQuestion = firstQ.questionText.toLowerCase()
            if (!firstQuestion.startsWith('tell') && !firstQuestion.startsWith('walk') && !firstQuestion.startsWith('describe')) {
              firstQuestion = `I'd like to start by asking: ${events.questionPlan[0].questionText}`
            } else {
              firstQuestion = events.questionPlan[0].questionText
            }
          }
        }
      } catch {
        // Use default
      }

      const greeting = `Hi, thanks for joining us today. I'm ${greetingChar.name}, ${greetingChar.title}. Let's get started — ${firstQuestion}`

      addMessage({
        speaker: greetingChar.id,
        speakerName: greetingChar.name,
        text: greeting,
        avatarColor: greetingChar.avatarColor,
        isCandidate: false,
      })

      listenStateRef.current = 'ai_speaking'
      await speakText(
        greeting,
        greetingChar.voiceId,
        speakerEnabledRef.current,
        () => setActiveSpeakerId(greetingChar.id),
        () => setActiveSpeakerId(null),
        greetingChar.archetype
      )
      listenStateRef.current = 'idle'

      // Start listening for candidate response
      startListening()
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
    setActiveSpeakerId(null)
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('ended')

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
    } catch { /* best effort */ }
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

  if (phase === 'loading' || !sessionData) {
    return (
      <div className="fixed inset-0 bg-[#1b1b1b] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5b5fc7] border-t-transparent" />
      </div>
    )
  }

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

          <div className="flex justify-center">
            <div className="relative w-64 h-48 rounded-xl overflow-hidden bg-[#292929]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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
      {/* Top bar — company + timer only, no indicators */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1b1b1b] border-b border-[#333]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{sessionData.companyName}</span>
          <span className="text-xs text-gray-500">{sessionData.jobTitle}</span>
        </div>
        <div className="flex items-center gap-4">
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
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold mb-4"
                  style={{ backgroundColor: char.avatarColor }}
                >
                  {char.initials}
                </div>
                <p className="text-sm font-medium text-white">{char.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{char.title}</p>

                {/* Audio-reactive speaking indicator (spec 2.10) */}
                {activeSpeakerId === char.id && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        ref={el => { barRefs.current[i] = el }}
                        className="w-0.5 bg-[#5b5fc7] rounded-full transition-[height] duration-75"
                        style={{ height: '4px' }}
                      />
                    ))}
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
                    <span className="text-xs font-medium text-gray-300">{msg.speakerName}</span>
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
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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
          className="rounded-full p-3 bg-red-600 text-white hover:bg-red-700 transition-colors"
          title="End call"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
