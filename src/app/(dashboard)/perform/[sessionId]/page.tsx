'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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

type Phase = 'loading' | 'briefing' | 'interview' | 'complete'

// ---------------------------------------------------------------------------
// Archetype helpers
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
  culture_fit: 'Culture Fit',
  silent_observer: 'Silent Observer',
}

const ARCHETYPE_ICONS: Record<string, string> = {
  skeptic: '🔍',
  friendly_champion: '🤝',
  technical_griller: '⚙️',
  distracted_senior: '📱',
  culture_fit: '🎯',
  silent_observer: '👁️',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
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
// Opening lines
// ---------------------------------------------------------------------------

const OPENING_LINES: Record<string, string[]> = {
  skeptic: [
    "Let's get started. I have some tough questions for you today.",
    "Thanks for joining. I'm going to challenge your assumptions today, so be prepared.",
  ],
  friendly_champion: [
    "Welcome! Thanks so much for taking the time to chat with us today. We're really excited to learn more about you.",
    "Hi there! Great to meet you. Let's have a relaxed conversation about your experience and what you're looking for.",
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
    "*nods in greeting*",
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
// Component
// ---------------------------------------------------------------------------

export default function InterviewRoomPage() {
  const { data: authSession } = useSession()
  const params = useParams()
  const sessionId = params.sessionId as string

  // Core state
  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Briefing state
  const [countdown, setCountdown] = useState(5)
  const [countdownActive, setCountdownActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // Interview state
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [speakingCharacterId, setSpeakingCharacterId] = useState<string | null>(null)
  const [characterStatuses, setCharacterStatuses] = useState<Record<string, string>>({})
  const [lastSpokenMessages, setLastSpokenMessages] = useState<Record<string, string>>({})

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Media
  const [isMicOn, setIsMicOn] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const selfVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Chat scroll
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Track which character responds next
  const nextCharacterIndexRef = useRef(0)

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
  // Initialize character statuses
  // -------------------------------------------

  useEffect(() => {
    if (!sessionData?.characters) return
    const statuses: Record<string, string> = {}
    for (const char of sessionData.characters) {
      statuses[char.id] = 'Listening...'
    }
    setCharacterStatuses(statuses)
  }, [sessionData?.characters])

  // -------------------------------------------
  // Request camera/mic permissions
  // -------------------------------------------

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraReady(true)
    } catch {
      // Camera not available, continue anyway
      console.warn('Camera/mic not available')
      setCameraReady(true)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  // Attach stream to self-view video element when entering interview phase
  useEffect(() => {
    if (phase === 'interview' && selfVideoRef.current && streamRef.current) {
      selfVideoRef.current.srcObject = streamRef.current
    }
  }, [phase])

  // -------------------------------------------
  // Countdown logic
  // -------------------------------------------

  useEffect(() => {
    if (!countdownActive) return
    if (countdown <= 0) return

    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdownActive, countdown])

  // -------------------------------------------
  // Timer
  // -------------------------------------------

  useEffect(() => {
    if (phase === 'interview') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // -------------------------------------------
  // Auto-scroll chat
  // -------------------------------------------

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges])

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
      setSessionData((prev) => (prev ? { ...prev, ...updated, characters: updated.characters } : prev))

      setPhase('interview')

      // Generate opening lines from interviewers
      const characters = updated.characters || sessionData.characters
      const openingExchanges: Exchange[] = []

      for (let i = 0; i < characters.length; i++) {
        const char = characters[i]
        const lines = OPENING_LINES[char.archetype] || OPENING_LINES.friendly_champion
        const line = randomFrom(lines)
        openingExchanges.push({
          id: `opening_${i}`,
          sequenceNumber: i + 1,
          speaker: 'interviewer',
          characterId: char.id,
          messageText: line,
          timestampMs: i * 2000,
        })
      }

      // Show opening lines with delays
      for (let i = 0; i < openingExchanges.length; i++) {
        const char = characters[i]
        setSpeakingCharacterId(char.id)
        setCharacterStatuses((prev) => ({ ...prev, [char.id]: 'Speaking...' }))
        await new Promise((resolve) => setTimeout(resolve, char.silenceDuration))
        setExchanges((prev) => [...prev, openingExchanges[i]])
        setLastSpokenMessages((prev) => ({ ...prev, [char.id]: openingExchanges[i].messageText }))
        setCharacterStatuses((prev) => ({ ...prev, [char.id]: 'Listening...' }))
        setSpeakingCharacterId(null)
      }

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

    // Add candidate exchange optimistically
    const tempCandidateExchange: Exchange = {
      id: `temp_${Date.now()}`,
      sequenceNumber: exchanges.length + 1,
      speaker: 'candidate',
      characterId: null,
      messageText: userText,
      timestampMs: elapsedSeconds * 1000,
    }
    setExchanges((prev) => [...prev, tempCandidateExchange])

    // Show thinking state
    setSpeakingCharacterId(respondingChar.id)
    setCharacterStatuses((prev) => ({ ...prev, [respondingChar.id]: 'Taking notes...' }))

    try {
      // Simulate thinking delay (1-5 seconds)
      const thinkDelay = Math.max(1000, Math.min(5000, respondingChar.silenceDuration))
      await new Promise((resolve) => setTimeout(resolve, thinkDelay))

      const res = await fetch(`/api/sessions/${sessionId}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: userText,
          characterId: respondingChar.id,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      const data = await res.json()

      // Update character status to speaking
      setCharacterStatuses((prev) => ({ ...prev, [respondingChar.id]: 'Speaking...' }))

      // Replace temp candidate exchange and add interviewer response
      setExchanges((prev) => {
        const withoutTemp = prev.filter((e) => e.id !== tempCandidateExchange.id)
        return [...withoutTemp, data.candidateExchange, data.interviewerExchange]
      })

      setLastSpokenMessages((prev) => ({
        ...prev,
        [respondingChar.id]: data.interviewerExchange.messageText,
      }))

      // Reset status after a moment
      setTimeout(() => {
        setCharacterStatuses((prev) => ({ ...prev, [respondingChar.id]: 'Listening...' }))
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSpeakingCharacterId(null)
      setIsSending(false)
    }
  }

  // -------------------------------------------
  // End interview
  // -------------------------------------------

  const handleEndInterview = async () => {
    if (!sessionData) return

    const characters = sessionData.characters
    const leadChar = characters[0]
    if (leadChar) {
      const closingLine = CLOSING_LINES[leadChar.archetype] || CLOSING_LINES.friendly_champion
      const closingExchange: Exchange = {
        id: `closing_${Date.now()}`,
        sequenceNumber: exchanges.length + 1,
        speaker: 'interviewer',
        characterId: leadChar.id,
        messageText: closingLine,
        timestampMs: elapsedSeconds * 1000,
      }
      setExchanges((prev) => [...prev, closingExchange])
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
    } catch {
      // Proceed to complete screen even if update fails
    }

    stopCamera()
    setPhase('complete')
  }

  // -------------------------------------------
  // Toggle mic
  // -------------------------------------------

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks()
      audioTracks.forEach((t) => {
        t.enabled = !t.enabled
      })
    }
    setIsMicOn((v) => !v)
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
  // Find character by ID
  // -------------------------------------------

  const getCharacter = (charId: string | null): Character | undefined => {
    if (!charId || !sessionData) return undefined
    return sessionData.characters.find((c) => c.id === charId)
  }

  // -------------------------------------------
  // Render: Loading
  // -------------------------------------------

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading interview room...</p>
        </div>
      </div>
    )
  }

  if (error && !sessionData) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center">
        <div className="text-center max-w-md">
          <MessageSquare className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to load session</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!sessionData) return null

  const { characters, application } = sessionData

  // -------------------------------------------
  // Render: Briefing (Phase 1)
  // -------------------------------------------

  if (phase === 'briefing') {
    return (
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-2xl w-full space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Interview Briefing</h1>
            <p className="text-gray-400">
              {application.jobTitle} at {application.companyName}
            </p>
          </div>

          {/* Interview format info */}
          <Card className="!bg-[#1e293b] !border-[#334155]">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Interview Type</p>
                  <p className="text-white font-medium">{sessionData.stage}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Intensity</p>
                  <Badge
                    variant={
                      sessionData.intensity === 'high-pressure'
                        ? 'danger'
                        : sessionData.intensity === 'warmup'
                          ? 'success'
                          : 'info'
                    }
                  >
                    {sessionData.intensity}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Duration</p>
                  <p className="text-white font-medium">{sessionData.durationMinutes} min</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Interviewer panel cards */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              Your Interview Panel
            </h2>
            <div className="grid gap-3">
              {characters.map((char) => {
                const color = ARCHETYPE_COLORS[char.archetype] || '#6b7280'
                const icon = ARCHETYPE_ICONS[char.archetype] || '👤'
                return (
                  <Card key={char.id} className="!bg-[#1e293b] !border-[#334155]">
                    <div className="p-4 flex items-center gap-4">
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
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{icon}</span>
                        <Badge variant="default">
                          {ARCHETYPE_LABELS[char.archetype] || char.archetype}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Camera/mic permission request */}
          {!cameraReady && (
            <Card className="!bg-[#1e293b] !border-[#334155]">
              <div className="p-6 text-center space-y-4">
                <Video className="w-10 h-10 text-blue-400 mx-auto" />
                <div>
                  <p className="text-white font-medium mb-1">Camera & Microphone Access</p>
                  <p className="text-gray-400 text-sm">
                    Allow access to your camera and microphone for the interview simulation.
                  </p>
                </div>
                <Button
                  onClick={requestMediaPermissions}
                  className="!bg-blue-600 hover:!bg-blue-700"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Allow Camera & Mic
                </Button>
              </div>
            </Card>
          )}

          {cameraReady && (
            <Card className="!bg-[#0f3a1e] !border-[#1e5a2e]">
              <div className="p-4 flex items-center gap-3">
                <Mic className="w-5 h-5 text-green-400" />
                <p className="text-green-300 text-sm">Camera and microphone connected</p>
              </div>
            </Card>
          )}

          {/* Countdown section */}
          <div className="text-center space-y-4">
            {!countdownActive ? (
              <Button
                size="lg"
                onClick={() => {
                  if (!cameraReady) {
                    requestMediaPermissions().then(() => {
                      setCountdownActive(true)
                    })
                  } else {
                    setCountdownActive(true)
                  }
                }}
                className="!bg-blue-600 hover:!bg-blue-700"
              >
                Start Countdown
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400 text-lg">
                  Your interview with <span className="text-white font-semibold">{application.companyName}</span> starts in...
                </p>
                <div className="text-7xl font-bold text-white tabular-nums">
                  {countdown}
                </div>
                <p className="text-gray-500 text-sm">Take a deep breath and relax</p>
                <Button
                  size="lg"
                  disabled={countdown > 0}
                  onClick={handleStartInterview}
                  className={`transition-all ${
                    countdown <= 0
                      ? '!bg-green-600 hover:!bg-green-700 animate-pulse'
                      : '!bg-gray-700 cursor-not-allowed'
                  }`}
                >
                  {countdown <= 0 ? 'Ready' : 'Waiting...'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------
  // Render: Complete (Phase 3)
  // -------------------------------------------

  if (phase === 'complete') {
    const totalExchanges = exchanges.filter((e) => e.speaker === 'candidate').length
    return (
      <div className="fixed inset-0 bg-[#1e293b] flex items-center justify-center p-4">
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

          {/* Summary stats */}
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
              onClick={() => window.location.href = `/debrief/${sessionId}`}
              className="!bg-blue-600 hover:!bg-blue-700"
            >
              View Your Debrief
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.location.href = '/dashboard'}
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
  // Render: Interview Room (Phase 2)
  // -------------------------------------------

  // Grid layout: 1 = centered, 2 = side by side, 3 = top 2 + bottom 1
  const renderCharacterGrid = () => {
    if (characters.length === 1) {
      return (
        <div className="flex justify-center p-4">
          <div className="w-full max-w-md">
            {renderCharacterCard(characters[0])}
          </div>
        </div>
      )
    }

    if (characters.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-3 p-4 max-w-3xl mx-auto">
          {characters.map((char) => (
            <div key={char.id}>{renderCharacterCard(char)}</div>
          ))}
        </div>
      )
    }

    // 3 characters: top 2 + bottom 1 centered
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {renderCharacterCard(characters[0])}
          {renderCharacterCard(characters[1])}
        </div>
        <div className="flex justify-center">
          <div className="w-1/2">
            {renderCharacterCard(characters[2])}
          </div>
        </div>
      </div>
    )
  }

  const renderCharacterCard = (char: Character) => {
    const isSpeaking = speakingCharacterId === char.id
    const color = ARCHETYPE_COLORS[char.archetype] || '#6b7280'
    const status = characterStatuses[char.id] || 'Listening...'
    const lastMessage = lastSpokenMessages[char.id]

    const statusColor =
      status === 'Speaking...'
        ? 'text-green-400'
        : status === 'Taking notes...'
          ? 'text-yellow-400'
          : 'text-gray-500'

    return (
      <div
        className="relative rounded-xl bg-[#111127] transition-all duration-300"
        style={{
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: isSpeaking ? color : '#1e1e3a',
        }}
      >
        <div className="flex flex-col items-center justify-center p-6">
          {/* Avatar circle with initials */}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-3 transition-all ${
              isSpeaking ? 'ring-4 ring-opacity-60 animate-pulse' : ''
            }`}
            style={{
              backgroundColor: color,
              ...(isSpeaking ? { ringColor: color } : {}),
            }}
          >
            {getInitials(char.name)}
          </div>

          {/* Name and title */}
          <p className="text-white font-medium text-sm text-center">{char.name}</p>
          <p className="text-gray-400 text-xs text-center truncate max-w-full">{char.title}</p>

          {/* Status text */}
          <div className="mt-2 flex items-center gap-1.5">
            {status === 'Speaking...' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
            <p className={`text-xs ${statusColor}`}>{status}</p>
          </div>

          {/* Speech bubble for speaking character */}
          {isSpeaking && lastMessage && (
            <div className="mt-3 w-full">
              <div
                className="relative rounded-lg px-3 py-2 text-xs text-gray-200 bg-[#1a1a35]"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <p className="line-clamp-2">{lastMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a1a] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#06060f] border-b border-[#1a1a35]">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-white text-sm font-medium">
              {application.companyName}
            </p>
            <p className="text-gray-500 text-xs">{application.jobTitle} &middot; {sessionData.stage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-300">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm tabular-nums">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Character video feeds */}
        {renderCharacterGrid()}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-2">
          <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
            {exchanges.map((exchange) => {
              const isCandidate = exchange.speaker === 'candidate'
              const char = getCharacter(exchange.characterId)
              const color = char
                ? ARCHETYPE_COLORS[char.archetype] || '#6b7280'
                : '#3b82f6'

              return (
                <div
                  key={exchange.id}
                  className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Interviewer avatar */}
                  {!isCandidate && char && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1"
                      style={{ backgroundColor: color }}
                    >
                      {getInitials(char.name)}
                    </div>
                  )}

                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isCandidate
                        ? 'bg-brand-700 text-white rounded-br-md'
                        : 'bg-[#111127] text-gray-200 rounded-bl-md'
                    }`}
                  >
                    {!isCandidate && char && (
                      <p
                        className="text-xs font-medium mb-1"
                        style={{ color }}
                      >
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
                {(() => {
                  const char = getCharacter(speakingCharacterId)
                  const color = char
                    ? ARCHETYPE_COLORS[char.archetype] || '#6b7280'
                    : '#6b7280'
                  return (
                    <>
                      {char && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1"
                          style={{ backgroundColor: color }}
                        >
                          {getInitials(char.name)}
                        </div>
                      )}
                      <div className="bg-[#111127] rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 mr-1">thinking</span>
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-2 px-3 py-2 bg-red-900/40 border border-red-700/50 rounded-lg flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-sm">
                Dismiss
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
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

      {/* Bottom bar */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 bg-[#06060f] border-t border-[#1a1a35]">
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
          onClick={handleEndInterview}
          className="h-12 px-6 rounded-full bg-red-600 text-white flex items-center justify-center gap-2 hover:bg-red-700 transition-colors font-medium text-sm"
          title="End interview"
        >
          <PhoneOff className="w-5 h-5" />
          End Interview
        </button>
      </div>

      {/* Candidate self-view webcam (bottom-right) */}
      <div className="absolute bottom-20 right-4 w-40 h-28 rounded-xl overflow-hidden bg-[#111127] border border-[#1e1e3a] shadow-lg">
        <video
          ref={selfVideoRef}
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
    </div>
  )
}
