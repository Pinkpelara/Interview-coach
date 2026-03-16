'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Mic,
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
} from 'lucide-react'
import Link from 'next/link'

interface Application {
  id: string
  companyName: string
  jobTitle: string
  interviewStage: string | null
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
              Applied: 'Phone Screen',
              'Phone Screen Scheduled': 'Phone Screen',
              'First Round Scheduled': 'First Round',
              'Panel/Final Round Scheduled': 'Panel Interview',
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

  // Start session
  async function handleStartSession() {
    if (!applicationId) return
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          stage: selectedStage,
          intensity: selectedIntensity,
          durationMinutes: selectedDuration,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create session')
        setCreating(false)
        return
      }

      const sessionData = await res.json()
      router.push(`/perform/${sessionData.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-700 mx-auto" />
      </div>
    )
  }

  if (error && !application) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-md space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Unable to start</h2>
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

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/applications/${applicationId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Application
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">
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
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
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
                    ? 'border-brand-700 bg-brand-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-brand-700' : 'text-gray-400'}`} />
                  <span className={`text-sm font-semibold ${isSelected ? 'text-brand-700' : 'text-gray-900'}`}>
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
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
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
                    ? 'border-brand-700 bg-brand-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-brand-700' : 'text-gray-400'}`} />
                  <span className={`text-sm font-semibold ${isSelected ? 'text-brand-700' : 'text-gray-900'}`}>
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
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
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
                    ? 'border-brand-700 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <Clock className={`h-4 w-4 ${isSelected ? 'text-brand-700' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-brand-700' : 'text-gray-900'}`}>
                    {dur.label}
                  </p>
                  <p className="text-[10px] text-gray-500">{dur.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary + Start */}
      <Card className="border-brand-200 bg-brand-50/30">
        <CardContent className="flex items-center justify-between py-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">
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
          >
            <Mic className="h-5 w-5 mr-2" />
            Start Interview
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
