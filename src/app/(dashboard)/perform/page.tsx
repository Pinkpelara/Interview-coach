'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Mic,
  MicOff,
  Users,
  UserCheck,
  Phone,
  Briefcase,
  AlertTriangle,
  Clock,
  Flame,
  Snowflake,
  Target,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

interface Application {
  id: string
  companyName: string
  jobTitle: string
  interviewStage: string | null
}

interface SessionCharacter {
  id: string
  name: string
  title: string
  archetype: string
  avatarColor: string
  initials: string
}

const STAGES = [
  { value: 'Phone Screen', label: 'Phone Screen', description: '1 interviewer, conversational, 20-30 min', icon: Phone, characters: '1 interviewer' },
  { value: 'First Round', label: 'First Round', description: '1-2 interviewers, competency-based questions', icon: UserCheck, characters: '1-2 interviewers' },
  { value: 'Panel Interview', label: 'Panel Interview', description: '3 interviewers at once, full panel dynamics', icon: Users, characters: '3 interviewers' },
  { value: 'Final Round', label: 'Final Round', description: '2-3 senior interviewers, deep probing', icon: Briefcase, characters: '2-3 interviewers' },
  { value: 'Case Interview', label: 'Case Interview', description: 'Problem-solving focus, analytical questions', icon: Target, characters: '2 interviewers' },
  { value: 'Stress Interview', label: 'Stress Interview', description: 'High pressure, adversarial, rapid-fire', icon: AlertTriangle, characters: '2 interviewers' },
]

const INTENSITIES = [
  { value: 'warmup', label: 'Warm-Up', description: 'Lighter pressure, shorter silences, more forgiving', icon: Snowflake, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'standard', label: 'Standard', description: 'Realistic professional interview', icon: Target, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { value: 'high-pressure', label: 'High Pressure', description: 'Extended silences, aggressive follow-ups, curveballs', icon: Flame, color: 'text-red-600 bg-red-50 border-red-200' },
]

const DURATIONS = [
  { value: 20, label: '20 min', description: 'Quick practice' },
  { value: 45, label: '45 min', description: 'Standard length' },
  { value: 60, label: '60 min', description: 'Full session' },
]

export default function PerformPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()

  const applicationId = searchParams.get('applicationId')
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Session configuration
  const [selectedStage, setSelectedStage] = useState('Panel Interview')
  const [selectedIntensity, setSelectedIntensity] = useState('standard')
  const [selectedDuration, setSelectedDuration] = useState(45)

  // Mic check state (spec 6.2)
  const [micChecked, setMicChecked] = useState(false)
  const [micWorking, setMicWorking] = useState(false)

  // Countdown state (spec 6.2)
  const [countdownActive, setCountdownActive] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(120)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionCharacters, setSessionCharacters] = useState<SessionCharacter[]>([])

  // Fetch application details
  useEffect(() => {
    if (!applicationId) {
      setError('No application selected. Go to Applications and click Start Interview.')
      setLoading(false)
      return
    }

    async function fetchApp() {
      try {
        const res = await fetch(`/api/applications/${applicationId}`)
        if (res.ok) {
          const data = await res.json()
          setApplication(data)
          // Pre-select stage based on application's interview stage
          if (data.interviewStage) {
            const stageMap: Record<string, string> = {
              screening: 'Phone Screen',
              technical: 'First Round',
              behavioral: 'Panel Interview',
              final: 'Final Round',
            }
            const mapped = stageMap[data.interviewStage] || data.interviewStage
            const valid = STAGES.find(s => s.value === mapped)
            if (valid) setSelectedStage(valid.value)
          }
        } else {
          setError('Application not found')
        }
      } catch {
        setError('Failed to load application')
      } finally {
        setLoading(false)
      }
    }

    fetchApp()
  }, [applicationId])

  // Mic check handler
  const checkMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicChecked(true)
      setMicWorking(true)
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setMicChecked(true)
      setMicWorking(false)
    }
  }, [])

  // Countdown timer effect
  useEffect(() => {
    if (!countdownActive) return
    if (countdownSeconds <= 0) {
      // Countdown done — navigate to interview room
      if (sessionId) router.push(`/perform/${sessionId}`)
      return
    }
    const timer = setTimeout(() => setCountdownSeconds(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdownActive, countdownSeconds, sessionId, router])

  // Start session — creates session then starts 2-min countdown
  async function handleStartSession() {
    if (!applicationId) return
    setCreating(true)
    setError(null)

    try {
      const res = await fetch(`/api/applications/${applicationId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: selectedStage,
          intensity: selectedIntensity,
          targetDurationMin: selectedDuration,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create session')
        setCreating(false)
        return
      }

      const sessionData = await res.json()
      setSessionId(sessionData.id)

      // Parse characters from session for briefing screen
      try {
        const chars = typeof sessionData.characters === 'string'
          ? JSON.parse(sessionData.characters)
          : sessionData.characters || []
        if (Array.isArray(chars)) setSessionCharacters(chars)
      } catch { /* empty */ }

      setCountdownSeconds(120)
      setCountdownActive(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#5b5fc7] mx-auto" />
      </div>
    )
  }

  if (error && !application) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-md space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Unable to start</h2>
          <p className="text-gray-500">{error}</p>
          <Link href="/applications">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Applications
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Countdown briefing screen (spec 6.2) — shows panel, format, timer
  if (countdownActive) {
    const mins = Math.floor(countdownSeconds / 60)
    const secs = countdownSeconds % 60
    const stageInfo = STAGES.find(s => s.value === selectedStage)
    const intensityInfo = INTENSITIES.find(i => i.value === selectedIntensity)

    return (
      <div className="fixed inset-0 z-50 bg-[#1b1b1b] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Header */}
          <div>
            <p className="text-sm text-gray-400">Your interview begins in</p>
            <div className="text-6xl font-bold text-[#5b5fc7] tabular-nums mt-3">
              {mins}:{secs.toString().padStart(2, '0')}
            </div>
          </div>

          {/* Company + role */}
          <div>
            <h2 className="text-2xl font-bold text-white">{application?.companyName}</h2>
            <p className="text-gray-400 text-sm mt-0.5">{application?.jobTitle}</p>
          </div>

          {/* Today's Panel — interviewer cards with initials, names, titles */}
          {sessionCharacters.length > 0 && (
            <div className="rounded-xl bg-[#292929] border border-[#333] p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Today&apos;s Panel</p>
              <div className="flex justify-center gap-6 flex-wrap">
                {sessionCharacters.map(char => (
                  <div key={char.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                      style={{ backgroundColor: char.avatarColor }}
                    >
                      {char.initials}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">{char.name}</p>
                      <p className="text-xs text-gray-400">{char.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interview format */}
          <div className="rounded-xl bg-[#292929] border border-[#333] p-4 text-left">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 mb-1">Format</p>
                <p className="text-sm font-medium text-white">{selectedStage}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Intensity</p>
                <p className="text-sm font-medium text-white">{intensityInfo?.label}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Duration</p>
                <p className="text-sm font-medium text-white">{selectedDuration} min</p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="text-left space-y-2 max-w-md mx-auto">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Quick reminders</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Speak clearly and take your time — pauses are natural</li>
              <li>• Use specific examples with numbers and outcomes</li>
              <li>• The interview room will open automatically when the timer reaches zero</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/applications/${applicationId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-400 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Application
        </Link>
        <h2 className="text-2xl font-bold text-white">
          Set Up Your Interview
        </h2>
        {application && (
          <p className="text-gray-500 mt-1">
            {application.companyName} — {application.jobTitle}
          </p>
        )}
      </div>

      {/* Stage Selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Interview Stage
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map(stage => {
            const Icon = stage.icon
            const isSelected = selectedStage === stage.value
            return (
              <button
                key={stage.value}
                onClick={() => setSelectedStage(stage.value)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-[#5b5fc7] bg-[#5b5fc7]/20'
                    : 'border-[#333] hover:border-[#555] bg-[#292929]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-[#5b5fc7]' : 'text-gray-400'}`} />
                  <span className={`text-sm font-semibold ${isSelected ? 'text-[#5b5fc7]' : 'text-white'}`}>
                    {stage.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{stage.description}</p>
                <p className="text-[10px] text-gray-400 mt-1">{stage.characters}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Intensity Selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Intensity Level
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {INTENSITIES.map(intensity => {
            const Icon = intensity.icon
            const isSelected = selectedIntensity === intensity.value
            return (
              <button
                key={intensity.value}
                onClick={() => setSelectedIntensity(intensity.value)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-[#5b5fc7] bg-[#5b5fc7]/20'
                    : 'border-[#333] hover:border-[#555] bg-[#292929]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-[#5b5fc7]' : 'text-gray-400'}`} />
                  <span className={`text-sm font-semibold ${isSelected ? 'text-[#5b5fc7]' : 'text-white'}`}>
                    {intensity.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{intensity.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Duration Selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Session Length
        </h3>
        <div className="flex gap-3">
          {DURATIONS.map(dur => {
            const isSelected = selectedDuration === dur.value
            return (
              <button
                key={dur.value}
                onClick={() => setSelectedDuration(dur.value)}
                className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 transition-all ${
                  isSelected
                    ? 'border-[#5b5fc7] bg-[#5b5fc7]/20'
                    : 'border-[#333] hover:border-[#555] bg-[#292929]'
                }`}
              >
                <Clock className={`h-4 w-4 ${isSelected ? 'text-[#5b5fc7]' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-[#5b5fc7]' : 'text-white'}`}>
                    {dur.label}
                  </p>
                  <p className="text-[10px] text-gray-500">{dur.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Microphone Check (spec 6.2) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Microphone Check
        </h3>
        <div className="rounded-xl border-2 border-[#333] bg-[#292929] p-4">
          {!micChecked ? (
            <button
              onClick={checkMic}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1b1b1b] px-4 py-3 text-sm text-gray-400 hover:bg-[#333] transition-colors"
            >
              <Mic className="h-4 w-4" />
              Test Microphone
            </button>
          ) : micWorking ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm px-2">
              <CheckCircle2 className="h-4 w-4" />
              Microphone is working
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400 text-sm px-2">
              <MicOff className="h-4 w-4" />
              Microphone not detected. Check your browser settings and try again.
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Summary + Start */}
      <Card className="border-[#5b5fc7] bg-[#5b5fc7]/10">
        <CardContent className="flex items-center justify-between py-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              {selectedStage} · {INTENSITIES.find(i => i.value === selectedIntensity)?.label} · {selectedDuration} min
            </p>
            <p className="text-xs text-gray-500">
              {STAGES.find(s => s.value === selectedStage)?.characters} will be generated for {application?.companyName}
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleStartSession}
            loading={creating}
            disabled={!micChecked || !micWorking}
          >
            <Mic className="h-5 w-5 mr-2" />
            Start Interview
          </Button>
        </CardContent>
      </Card>

      {!micChecked && (
        <p className="text-xs text-gray-500 text-center">
          Complete the microphone check above before starting your interview.
        </p>
      )}
    </div>
  )
}
