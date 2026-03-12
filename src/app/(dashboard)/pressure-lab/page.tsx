'use client'

import { useState } from 'react'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  Flame,
  UserCircle,
  HelpCircle,
  Users,
  LogOut,
  Clock,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface PressureScenario {
  id: string
  name: string
  description: string
  character: string
  duration: string
  stage: string
  intensity: string
  forcedArchetypes: Array<
    'skeptic' | 'friendly_champion' | 'technical_griller' | 'distracted_senior' | 'culture_fit' | 'silent_observer'
  >
  icon: React.ElementType
}

interface ApplicationOption {
  id: string
  companyName: string
  jobTitle: string
}

const scenarios: PressureScenario[] = [
  {
    id: 'salary-negotiation',
    name: 'Salary Negotiation Lab',
    description:
      'Practice negotiating your compensation package with a skeptical hiring manager who pushes back on your ask.',
    character: 'Hiring Manager (warm, firm)',
    duration: '10-15 min',
    stage: 'Final Round',
    intensity: 'high-pressure',
    forcedArchetypes: ['friendly_champion'],
    icon: DollarSign,
  },
  {
    id: 'conflict-question',
    name: 'Conflict Question Lab',
    description:
      'Handle tough behavioral questions about workplace conflict, disagreements with managers, and difficult team dynamics.',
    character: 'Skeptic',
    duration: '10-15 min',
    stage: 'First Round',
    intensity: 'standard',
    forcedArchetypes: ['skeptic'],
    icon: Flame,
  },
  {
    id: 'tell-me-about-yourself',
    name: 'Tell Me About Yourself Lab',
    description:
      'Nail your opening pitch. Practice delivering a compelling personal narrative that hooks the interviewer in 90 seconds.',
    character: 'Friendly Champion',
    duration: '10 min',
    stage: 'Phone Screen',
    intensity: 'warmup',
    forcedArchetypes: ['friendly_champion'],
    icon: UserCircle,
  },
  {
    id: 'curveball-recovery',
    name: 'Curveball Recovery Lab',
    description:
      'Get thrown unexpected questions you cannot prepare for. Build confidence recovering from moments of uncertainty.',
    character: 'Technical Griller',
    duration: '15 min',
    stage: 'Stress Interview',
    intensity: 'high-pressure',
    forcedArchetypes: ['technical_griller'],
    icon: HelpCircle,
  },
  {
    id: 'panel-dynamics',
    name: 'Panel Dynamics Lab',
    description:
      'Practice managing a multi-interviewer panel. Balance attention, handle interruptions, and read the room.',
    character: 'Panel (3 interviewers)',
    duration: '15 min',
    stage: 'Panel Interview',
    intensity: 'high-pressure',
    forcedArchetypes: ['skeptic', 'friendly_champion', 'technical_griller'],
    icon: Users,
  },
  {
    id: 'why-are-you-leaving',
    name: 'Why Are You Leaving Lab',
    description:
      'Practice answering questions about why you are leaving your current role without badmouthing or raising red flags.',
    character: 'Culture Fit Assessor',
    duration: '10 min',
    stage: 'Phone Screen',
    intensity: 'standard',
    forcedArchetypes: ['culture_fit'],
    icon: LogOut,
  },
  {
    id: 'gap-explanation',
    name: 'Gap Explanation Lab',
    description:
      'Confidently explain employment gaps, career changes, or non-traditional backgrounds without being defensive.',
    character: 'Skeptic + Friendly Champion',
    duration: '10 min',
    stage: 'First Round',
    intensity: 'standard',
    forcedArchetypes: ['skeptic', 'friendly_champion'],
    icon: Clock,
  },
]

export default function PressureLabPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [startingId, setStartingId] = useState<string | null>(null)
  const [applications, setApplications] = useState<ApplicationOption[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [loadingApps, setLoadingApps] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    async function fetchApplications() {
      try {
        const res = await fetch('/api/applications')
        if (!res.ok) throw new Error('Failed to load applications')
        const data = await res.json()
        setApplications(data)
        if (Array.isArray(data) && data.length > 0) {
          setSelectedApplicationId(data[0].id)
        }
      } catch {
        setError('Unable to load your applications.')
      } finally {
        setLoadingApps(false)
      }
    }
    async function fetchPlan() {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setPlan(data.plan || 'free')
      }
    }
    void fetchApplications()
    void fetchPlan()
  }, [])

  async function handleStart(scenario: PressureScenario) {
    if (!session?.user) {
      router.push('/login')
      return
    }

    setStartingId(scenario.id)
    setError(null)

    try {
      if (plan === 'free') {
        setError('Pressure Lab is available on Prep and Pro plans.')
        return
      }
      if (!selectedApplicationId) {
        setError('Select an application before starting a pressure lab scenario.')
        return
      }

      if (scenario.id === 'salary-negotiation') {
        router.push(`/salary-negotiation?applicationId=${encodeURIComponent(selectedApplicationId)}`)
        return
      }

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedApplicationId,
          stage: scenario.stage,
          intensity: scenario.intensity,
          durationMinutes: scenario.duration.includes('15') ? 15 : 10,
          forcedArchetypes: scenario.forcedArchetypes,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/perform/${data.id}`)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to start pressure lab session.')
      }
    } catch {
      setError('Failed to start pressure lab session.')
    } finally {
      setStartingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700/10">
            <Zap className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pressure Lab</h2>
            <p className="text-gray-500">
              Targeted drills for the toughest interview moments.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-gray-800">Session context application (required)</p>
            {applications.length === 0 && !loadingApps && (
              <Button size="sm" onClick={() => router.push('/applications/new')}>
                Create Application
              </Button>
            )}
          </div>
          <select
            value={selectedApplicationId}
            onChange={(e) => setSelectedApplicationId(e.target.value)}
            disabled={loadingApps || applications.length === 0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {loadingApps && <option>Loading applications...</option>}
            {!loadingApps && applications.length === 0 && <option>No applications found</option>}
            {!loadingApps &&
              applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.companyName} — {app.jobTitle}
                </option>
              ))}
          </select>
          {plan === 'free' && (
            <p className="text-xs text-amber-700">
              Upgrade to Prep or Pro to unlock Pressure Lab scenarios.
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario) => {
          const Icon = scenario.icon
          const isStarting = startingId === scenario.id

          return (
            <Card key={scenario.id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700/10">
                    <Icon className="h-5 w-5 text-brand-700" />
                  </div>
                  <Badge variant={scenario.intensity === 'high-pressure' ? 'danger' : scenario.intensity === 'warmup' ? 'success' : 'warning'}>
                    {scenario.intensity}
                  </Badge>
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-900">
                  {scenario.name}
                </h3>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                <p className="text-sm text-gray-500">{scenario.description}</p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Character: {scenario.character}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {scenario.duration}
                    </span>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleStart(scenario)}
                    loading={isStarting}
                    disabled={plan === 'free' || startingId !== null || (!loadingApps && applications.length === 0)}
                  >
                    {scenario.id === 'salary-negotiation' ? 'Open Simulator' : 'Start Session'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
