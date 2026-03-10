'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ScoreGauge } from '@/components/ui/ScoreGauge'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import {
  Play,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ChevronRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface MomentSegment {
  id: string
  start: number
  end: number
  type: 'strong' | 'recoverable' | 'dropped'
  transcript: string
  coachingNote: string
  timestampMs: number
  hasInterviewerReaction: boolean
}

interface NextTarget {
  title: string
  description: string
  action: string
  successMetric: string
}

interface AnalysisData {
  momentMap: MomentSegment[]
  answerQuality: number
  deliveryConfidence: number
  pressureRecovery: number
  companyFitLanguage: number
  listeningAccuracy: number
  hiringProbability: number
  nextTargets: NextTarget[]
  coachScript: string
}

interface SessionData {
  id: string
  stage: string
  status: string
  application: {
    companyName: string
    jobTitle: string
  }
}

interface DebriefResponse {
  session: SessionData
  analysis: AnalysisData
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const segmentColors = {
  strong: 'bg-green-500',
  recoverable: 'bg-yellow-500',
  dropped: 'bg-red-500',
}

const segmentBorderColors = {
  strong: 'border-green-500',
  recoverable: 'border-yellow-500',
  dropped: 'border-red-500',
}

const segmentLabels = {
  strong: 'Strong Moment',
  recoverable: 'Recoverable Moment',
  dropped: 'Dropped Moment',
}

const segmentBadgeVariants = {
  strong: 'success' as const,
  recoverable: 'warning' as const,
  dropped: 'danger' as const,
}

export default function DebriefPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const { data: authSession } = useSession()

  const [data, setData] = useState<DebriefResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<MomentSegment | null>(null)
  const [audioPlaying, setAudioPlaying] = useState(false)

  useEffect(() => {
    async function fetchDebrief() {
      try {
        const res = await fetch(`/api/debrief/${sessionId}`)
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to load debrief')
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchDebrief()
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700 mx-auto" />
          <p className="text-gray-500">Analyzing your session...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent>
            <div className="text-center space-y-3 py-4">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
              <p className="text-gray-700 font-medium">Unable to load debrief</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { session: interviewSession, analysis } = data

  const scores = [
    { name: 'Answer Quality', score: analysis.answerQuality, observations: ['Used STAR framework in 4/6 behavioral questions', 'Provided specific metrics in leadership answers', 'Weakness answer lacked authenticity'], weakness: 'Generic weakness response needs complete rework' },
    { name: 'Delivery Confidence', score: analysis.deliveryConfidence, observations: ['Strong eye contact during opening', 'Voice pitch rose under pressure questions', 'Good pacing on rehearsed answers'], weakness: 'Filler words increase 3x during unexpected follow-ups' },
    { name: 'Pressure Recovery', score: analysis.pressureRecovery, observations: ['Recovered well after the failure question', 'Maintained composure during rapid-fire segment', 'Paused effectively before answering twice'], weakness: 'Silence-filling tendency when caught off guard' },
    { name: 'Company Fit Language', score: analysis.companyFitLanguage, observations: ['Referenced company mission once', 'Used industry-specific terminology', 'Aligned growth goals with role trajectory'], weakness: 'Only 2 direct references to JD language vs. target of 5+' },
    { name: 'Listening Accuracy', score: analysis.listeningAccuracy, observations: ['Answered the question asked in 8/10 exchanges', 'Picked up on interviewer cues for elaboration', 'Adapted answer length based on interviewer engagement'], weakness: 'Missed a clarifying sub-question in the prioritization exchange' },
  ]

  const hiringProb = analysis.hiringProbability
  const wouldAdvance = hiringProb >= 65

  const reasonsYes = [
    'Strong technical storytelling with specific metrics',
    'Demonstrated leadership with cross-functional examples',
    'Growth trajectory aligns with role requirements',
  ]

  const reasonsNo = [
    'Weakness answer signals low self-awareness',
    'Filler words under pressure may concern senior interviewers',
    'Insufficient company-specific language for culture fit',
  ]

  // Mock progress data for chart
  const progressData = [
    { session: 'S1', probability: Math.max(35, hiringProb - 28) },
    { session: 'S2', probability: Math.max(40, hiringProb - 20) },
    { session: 'S3', probability: Math.max(45, hiringProb - 14) },
    { session: 'S4', probability: Math.max(50, hiringProb - 8) },
    { session: 'S5', probability: hiringProb },
  ]

  function handlePlayAudio() {
    setAudioPlaying(true)
    setTimeout(() => setAudioPlaying(false), 3000)
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Section A: Coach Intro */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-5 py-2">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">C</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Coach Sarah</h2>
                <p className="text-sm text-gray-500">Your Interview Coach</p>
              </div>
              <blockquote className="border-l-4 border-brand-500 pl-4 text-gray-700 italic">
                &ldquo;Okay — let&apos;s talk about what just happened in there.&rdquo;
              </blockquote>
              <p className="text-sm text-gray-600 leading-relaxed">{analysis.coachScript}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayAudio}
                disabled={audioPlaying}
              >
                <Play className="h-4 w-4 mr-2" />
                {audioPlaying ? 'Playing...' : 'Play Coach Audio'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section B: Moment Map */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Moment Map</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Strong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" /> Recoverable
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Dropped
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-amber-500" /> Interviewer Reaction
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Timeline */}
          <div className="relative">
            <div className="flex w-full h-10 rounded-lg overflow-hidden gap-0.5">
              {analysis.momentMap.map((segment) => (
                <button
                  key={segment.id}
                  className={`relative h-full transition-all hover:opacity-80 ${segmentColors[segment.type]} ${
                    selectedSegment?.id === segment.id ? 'ring-2 ring-offset-1 ring-gray-900' : ''
                  }`}
                  style={{ width: `${segment.end - segment.start}%` }}
                  onClick={() =>
                    setSelectedSegment(
                      selectedSegment?.id === segment.id ? null : segment
                    )
                  }
                  title={`${segmentLabels[segment.type]} (${formatTimestamp(segment.timestampMs)})`}
                >
                  {segment.hasInterviewerReaction && (
                    <Zap className="absolute top-0.5 right-0.5 h-3 w-3 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>0:00</span>
              <span>{formatTimestamp(analysis.momentMap[analysis.momentMap.length - 1]?.timestampMs || 0)}</span>
            </div>
          </div>

          {/* Selected Segment Detail */}
          {selectedSegment && (
            <div
              className={`mt-4 rounded-lg border-2 p-4 space-y-3 ${segmentBorderColors[selectedSegment.type]}`}
            >
              <div className="flex items-center justify-between">
                <Badge variant={segmentBadgeVariants[selectedSegment.type]}>
                  {segmentLabels[selectedSegment.type]}
                </Badge>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(selectedSegment.timestampMs)}
                </span>
              </div>
              <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 whitespace-pre-line font-mono">
                {selectedSegment.transcript}
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Eye className="h-4 w-4 text-brand-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">{selectedSegment.coachingNote}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: Performance Scores */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Scores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scores.map((dim) => (
            <Card key={dim.name}>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <ScoreGauge score={dim.score} size="sm" />
                  <h4 className="font-semibold text-gray-900">{dim.name}</h4>
                </div>
                <ul className="space-y-1.5 mb-3">
                  {dim.observations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      {obs}
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-2 text-sm border-t border-gray-100 pt-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-500">{dim.weakness}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Section D: Hiring Probability Score */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-8 py-4">
            <div className="text-center">
              <ScoreGauge score={hiringProb} size="lg" label="Hiring Probability" />
            </div>
            <div className="flex-1 space-y-4">
              <div
                className={`text-2xl font-bold ${
                  wouldAdvance ? 'text-green-600' : 'text-red-600'
                }`}
              >
                Would Advance: {wouldAdvance ? 'Yes' : 'No'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" /> Reasons Yes
                  </h4>
                  <ul className="space-y-1.5">
                    {reasonsYes.map((r, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 mt-1">&#8226;</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" /> Reasons No
                  </h4>
                  <ul className="space-y-1.5">
                    {reasonsNo.map((r, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-red-500 mt-1">&#8226;</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section E: Next Session Targets */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-brand-600" />
          Next Session Targets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysis.nextTargets.map((target, i) => (
            <Card key={i}>
              <CardHeader>
                <h4 className="font-semibold text-gray-900">{target.title}</h4>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{target.description}</p>
                  <div className="bg-brand-50 rounded-md p-3">
                    <p className="text-sm font-medium text-brand-800">Action</p>
                    <p className="text-sm text-brand-700 mt-1">{target.action}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-sm font-medium text-gray-700">Success Metric</p>
                    <p className="text-sm text-gray-600 mt-1">{target.successMetric}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Section F: Progress Tracking */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-600" />
            Progress Tracking
          </h3>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <XAxis
                  dataKey="session"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Hiring Probability']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '13px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  dot={{ fill: '#7c3aed', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Section G: Actions */}
      <div className="flex items-center justify-center gap-4">
        <Link href="/perform">
          <Button variant="primary" size="lg">
            Practice Again
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
        <Link href={`/observe/${sessionId}`}>
          <Button variant="outline" size="lg">
            <Eye className="h-4 w-4 mr-2" />
            View Observe
          </Button>
        </Link>
      </div>
    </div>
  )
}
