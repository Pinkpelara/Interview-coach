'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  Target,
  ArrowLeft,
  Mic,
  BookOpen,
  Brain,
  Zap,
  Sun,
  Moon,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

interface Application {
  id: string
  companyName: string
  jobTitle: string
  realInterviewDate: string | null
  readinessScore: number
  interviewStage: string | null
  _count: { sessions: number; questions: number }
  sessions?: Array<{
    id: string
    analysis: {
      answerQuality: number | null
      deliveryConfidence: number | null
      pressureRecovery: number | null
      companyFitLanguage: number | null
      listeningAccuracy: number | null
    } | null
  }>
}

interface DayPlan {
  day: number
  date: string
  focus: string
  activity: string
  type: 'session' | 'prepare' | 'lab' | 'rest' | 'warmup' | 'review'
  icon: React.ElementType
  done: boolean
}

type ScoreAnalysis = {
  answerQuality: number | null
  deliveryConfidence: number | null
  pressureRecovery: number | null
  companyFitLanguage: number | null
  listeningAccuracy: number | null
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function deriveWeakDimensions(application: Application): string[] {
  const analyses = (application.sessions || [])
    .map((s) => s.analysis)
    .filter((a): a is ScoreAnalysis => Boolean(a))
  if (analyses.length === 0) return ['pressureRecovery', 'deliveryConfidence']

  const avg = {
    answerQuality: 0,
    deliveryConfidence: 0,
    pressureRecovery: 0,
    companyFitLanguage: 0,
    listeningAccuracy: 0,
  }
  analyses.forEach((a) => {
    avg.answerQuality += a.answerQuality ?? 0
    avg.deliveryConfidence += a.deliveryConfidence ?? 0
    avg.pressureRecovery += a.pressureRecovery ?? 0
    avg.companyFitLanguage += a.companyFitLanguage ?? 0
    avg.listeningAccuracy += a.listeningAccuracy ?? 0
  })
  const denom = analyses.length
  const ranked = Object.entries(avg)
    .map(([key, total]) => ({ key, score: Math.round(total / denom) }))
    .sort((a, b) => a.score - b.score)
  return ranked.slice(0, 2).map((r) => r.key)
}

function generatePlan(daysLeft: number, sessionCount: number, weakDimensions: string[]): DayPlan[] {
  const plan: DayPlan[] = []
  const today = new Date()

  const baseActivities = [
    { focus: 'Question Bank Review', activity: 'Review all questions and refine answers with low confidence ratings.', type: 'prepare' as const, icon: BookOpen },
    { focus: 'Full Interview Simulation', activity: 'Run a full session at Standard intensity. Focus on STAR structure.', type: 'session' as const, icon: Mic },
    { focus: 'Curveball Recovery Lab', activity: 'Practice handling unexpected questions. Build recovery confidence.', type: 'lab' as const, icon: Zap },
    { focus: 'Company Research Deep Dive', activity: 'Study recent company news, culture, and values. Prepare closing questions.', type: 'prepare' as const, icon: Brain },
    { focus: 'High Pressure Simulation', activity: 'Run a High Pressure session. Practice maintaining composure.', type: 'session' as const, icon: Mic },
    { focus: 'Tell Me About Yourself Lab', activity: 'Perfect your opening narrative. Record and listen back 5 times.', type: 'lab' as const, icon: Target },
    { focus: 'Flashcard Sprint', activity: 'Run through all flashcards. Mark any remaining "Need Work" questions.', type: 'prepare' as const, icon: BookOpen },
    { focus: 'Panel Interview Simulation', activity: 'Practice with multiple interviewers. Work on splitting attention.', type: 'session' as const, icon: Mic },
    { focus: 'Conflict & Weakness Questions', activity: 'Dedicated practice on the two most common stumbling blocks.', type: 'lab' as const, icon: AlertTriangle },
    { focus: 'Rest & Light Review', activity: 'Light review of your best answers. No intense practice today.', type: 'rest' as const, icon: Moon },
  ]
  const targetedActivities: typeof baseActivities = []

  if (weakDimensions.includes('pressureRecovery')) {
    targetedActivities.push({
      focus: 'Pressure Recovery Priority',
      activity: 'Run Curveball Recovery Lab and one high-pressure simulation. Focus on holding position under pushback.',
      type: 'lab',
      icon: Zap,
    })
  }
  if (weakDimensions.includes('deliveryConfidence')) {
    targetedActivities.push({
      focus: 'Delivery Confidence Priority',
      activity: 'Record 5 responses. Remove uncertainty language and tighten pace to 90–120 seconds.',
      type: 'prepare',
      icon: Target,
    })
  }
  if (weakDimensions.includes('companyFitLanguage')) {
    targetedActivities.push({
      focus: 'Company Language Priority',
      activity: 'Practice integrating company values language naturally into behavioral answers.',
      type: 'prepare',
      icon: Brain,
    })
  }
  if (weakDimensions.includes('listeningAccuracy')) {
    targetedActivities.push({
      focus: 'Listening Accuracy Priority',
      activity: 'Do a focused simulation where every answer starts by restating the question intent.',
      type: 'session',
      icon: Mic,
    })
  }
  if (weakDimensions.includes('answerQuality')) {
    targetedActivities.push({
      focus: 'Answer Quality Priority',
      activity: 'Rebuild weak answers with STAR + measurable outcomes and explicit ownership.',
      type: 'prepare',
      icon: BookOpen,
    })
  }

  const activities = [...targetedActivities, ...baseActivities]

  for (let i = 0; i <= daysLeft; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    if (i === daysLeft) {
      // Interview day
      plan.push({
        day: i + 1,
        date: dateStr,
        focus: 'Interview Day',
        activity: '5-minute audio warmup with your coach. Quick review of your three targets. You\'ve got this.',
        type: 'review',
        icon: Target,
        done: false,
      })
    } else if (i === daysLeft - 1) {
      // Day before interview
      plan.push({
        day: i + 1,
        date: dateStr,
        focus: 'Light Warmup & Confidence Boost',
        activity: 'Quick warmup session with your opening question and two strongest answers. Review company values one more time. Get a good night\'s sleep.',
        type: 'warmup',
        icon: Sun,
        done: false,
      })
    } else {
      const activityIdx = (i + Math.max(0, 4 - sessionCount)) % activities.length
      const act = activities[activityIdx]
      plan.push({
        day: i + 1,
        date: dateStr,
        focus: act.focus,
        activity: act.activity,
        type: act.type,
        icon: act.icon,
        done: false,
      })
    }
  }

  return plan
}

export default function CountdownPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const applicationId = params.applicationId as string

  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingDate, setSavingDate] = useState(false)
  const [interviewDate, setInterviewDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [plan, setPlan] = useState('free')

  const persistInterviewDate = async (dateValue: string) => {
    if (!dateValue) return
    setSavingDate(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realInterviewDate: dateValue }),
      })
      if (!res.ok) throw new Error('Failed to save date')
      const updated = await res.json()
      setApplication(updated)
      if (updated.realInterviewDate) {
        setInterviewDate(updated.realInterviewDate.split('T')[0])
      }
    } catch {
      // Keep UI stable; user can retry.
    } finally {
      setSavingDate(false)
    }
  }

  useEffect(() => {
    async function fetchApp() {
      try {
        const res = await fetch(`/api/applications/${applicationId}`)
        if (res.ok) {
          const data = await res.json()
          setApplication(data)
          if (data.realInterviewDate) {
            setInterviewDate(data.realInterviewDate.split('T')[0])
          }
        }
      } catch {
        console.error('Failed to fetch application')
      } finally {
        setLoading(false)
      }
    }
    fetchApp()
  }, [applicationId])

  useEffect(() => {
    async function fetchPlan() {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setPlan(data.plan || 'free')
      }
    }
    void fetchPlan()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Application not found.</p>
        <Link href="/dashboard">
          <Button className="mt-4">Back to Dashboard</Button>
        </Link>
      </div>
    )
  }

  if (plan !== 'pro' && plan !== 'crunch') {
    return (
      <div className="space-y-6">
        <Link href={`/applications/${applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Application
        </Link>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">Countdown Mode is a Pro feature</h2>
            <p className="text-sm text-gray-600">
              Upgrade to unlock day-by-day interview countdown planning and reminder notifications.
            </p>
            <Link href="/pricing">
              <Button>View plans</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const daysLeft = interviewDate ? getDaysUntil(interviewDate) : 0
  const weakDimensions = deriveWeakDimensions(application)
  const dayPlan = interviewDate ? generatePlan(daysLeft, application._count.sessions, weakDimensions) : []

  // No date set
  if (!interviewDate) {
    return (
      <div className="space-y-6">
        <Link href={`/applications/${applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Application
        </Link>

        <div className="text-center py-16 space-y-4">
          <Calendar className="h-16 w-16 text-brand-700 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Interview Countdown Mode</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Set your real interview date and get a personalized day-by-day practice plan to maximize your readiness.
          </p>
          <div className="flex items-center justify-center gap-3">
            <input
              type="date"
              value={interviewDate}
              onChange={e => setInterviewDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button onClick={() => persistInterviewDate(interviewDate)} disabled={!interviewDate || savingDate}>
              Set Date
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/applications/${applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Application
      </Link>

      {/* Header with countdown */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{application.companyName}</h2>
          <p className="text-gray-500">{application.jobTitle}</p>
        </div>
        <div className="text-center bg-brand-50 border border-brand-200 rounded-xl px-8 py-4">
          <p className="text-5xl font-bold text-brand-700">{daysLeft}</p>
          <p className="text-sm text-brand-600 font-medium">days until interview</p>
          <p className="text-xs text-gray-500 mt-1">{formatDate(interviewDate)}</p>
        </div>
      </div>

      {/* Readiness bar */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Interview Readiness</span>
            <span className="text-sm font-bold text-brand-700">{application.readinessScore}%</span>
          </div>
          <ProgressBar value={application.readinessScore} showPercent={false} />
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{application._count.questions} questions prepared</span>
            <span>{application._count.sessions} sessions completed</span>
          </div>
        </CardContent>
      </Card>

      {/* Day-by-day plan */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-600" />
          Your Practice Plan
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Plan priorities were calibrated from your latest weak dimensions:{' '}
          <span className="font-medium">{weakDimensions.join(', ')}</span>.
        </p>

        <div className="space-y-3">
          {dayPlan.map((day, idx) => {
            const Icon = day.icon
            const isToday = idx === 0
            const typeBadge: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }> = {
              session: { label: 'Simulation', variant: 'info' },
              prepare: { label: 'Preparation', variant: 'default' },
              lab: { label: 'Pressure Lab', variant: 'warning' },
              rest: { label: 'Light Day', variant: 'success' },
              warmup: { label: 'Warmup', variant: 'success' },
              review: { label: 'Interview Day', variant: 'danger' },
            }

            const badge = typeBadge[day.type] || typeBadge.prepare

            return (
              <Card
                key={idx}
                className={`transition-shadow ${isToday ? 'border-brand-300 bg-brand-50/30 shadow-md' : 'hover:shadow-sm'}`}
              >
                <CardContent className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                    isToday ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-medium">{day.date}</span>
                      {isToday && <Badge variant="info">Today</Badge>}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{day.focus}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{day.activity}</p>
                  </div>
                  {isToday && day.type === 'session' && (
                    <Link href={`/perform?applicationId=${applicationId}&stage=${application.interviewStage || 'screening'}`}>
                      <Button size="sm">
                        <Mic className="h-3.5 w-3.5 mr-1" /> Start
                      </Button>
                    </Link>
                  )}
                  {isToday && day.type === 'prepare' && (
                    <Link href={`/prepare/${applicationId}`}>
                      <Button size="sm" variant="outline">
                        <BookOpen className="h-3.5 w-3.5 mr-1" /> Open
                      </Button>
                    </Link>
                  )}
                  {isToday && day.type === 'lab' && (
                    <Link href="/pressure-lab">
                      <Button size="sm" variant="outline">
                        <Zap className="h-3.5 w-3.5 mr-1" /> Go
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Change date */}
      <Card>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Interview Date</p>
              <p className="text-xs text-gray-500">{formatDate(interviewDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showDatePicker ? (
              <>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={e => setInterviewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    await persistInterviewDate(interviewDate)
                    setShowDatePicker(false)
                  }}
                  disabled={savingDate}
                >
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowDatePicker(true)}>
                Change Date
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">After your real interview</p>
            <p className="text-xs text-gray-500">Log what was asked and compare against Seatvio predictions.</p>
          </div>
          <Link href={`/reflections/${applicationId}`}>
            <Button size="sm" variant="outline">Open Reflection</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
