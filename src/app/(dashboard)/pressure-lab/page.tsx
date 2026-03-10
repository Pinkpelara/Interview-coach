'use client'

import { useState } from 'react'
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
  icon: React.ElementType
}

const scenarios: PressureScenario[] = [
  {
    id: 'salary-negotiation',
    name: 'Salary Negotiation Lab',
    description:
      'Practice negotiating your compensation package with a skeptical hiring manager who pushes back on your ask.',
    character: 'Skeptic',
    duration: '10-15 min',
    stage: 'Final Round',
    intensity: 'high-pressure',
    icon: DollarSign,
  },
  {
    id: 'conflict-question',
    name: 'Conflict Question Lab',
    description:
      'Handle tough behavioral questions about workplace conflict, disagreements with managers, and difficult team dynamics.',
    character: 'Culture Fit',
    duration: '10-15 min',
    stage: 'First Round',
    intensity: 'standard',
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
    icon: Users,
  },
  {
    id: 'why-are-you-leaving',
    name: 'Why Are You Leaving Lab',
    description:
      'Practice answering questions about why you are leaving your current role without badmouthing or raising red flags.',
    character: 'Skeptic',
    duration: '10 min',
    stage: 'Phone Screen',
    intensity: 'standard',
    icon: LogOut,
  },
  {
    id: 'gap-explanation',
    name: 'Gap Explanation Lab',
    description:
      'Confidently explain employment gaps, career changes, or non-traditional backgrounds without being defensive.',
    character: 'Friendly Champion',
    duration: '10 min',
    stage: 'First Round',
    intensity: 'standard',
    icon: Clock,
  },
]

export default function PressureLabPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [startingId, setStartingId] = useState<string | null>(null)

  async function handleStart(scenario: PressureScenario) {
    if (!session?.user) {
      router.push('/login')
      return
    }

    setStartingId(scenario.id)

    try {
      // First, get user's applications to pick one for context
      const appsRes = await fetch('/api/applications')
      if (!appsRes.ok) {
        setStartingId(null)
        return
      }

      const apps = await appsRes.json()

      if (apps.length === 0) {
        // No applications - redirect to create one first
        router.push('/applications/new')
        return
      }

      // Use the most recently updated application
      const applicationId = apps[0].id

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          stage: scenario.stage,
          intensity: scenario.intensity,
          durationMinutes: scenario.duration.includes('15') ? 15 : 10,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/perform/${data.id}`)
      }
    } catch {
      // handle error silently
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
                    disabled={startingId !== null}
                  >
                    Start Session
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
