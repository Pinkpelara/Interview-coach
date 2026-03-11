'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
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
  Download,
  Share2,
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
  scoreDetails?: Record<
    string,
    {
      observations: string[]
      weakness: string
    }
  >
  hiringAssessment?: {
    wouldAdvance: boolean
    reasonsYes: string[]
    reasonsNo: string[]
    comparisonToRoleRequirements: string
  }
  progressSeries?: Array<{
    sessionId: string
    label: string
    probability: number
    createdAt: string
  }>
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

  const [data, setData] = useState<DebriefResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<MomentSegment | null>(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [generatingCard, setGeneratingCard] = useState(false)
  const [hideRoleOnCard, setHideRoleOnCard] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

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

  const { analysis } = data
  const sessionData = data.session

  const scores = [
    { key: 'answerQuality', name: 'Answer Quality', score: analysis.answerQuality },
    { key: 'deliveryConfidence', name: 'Delivery Confidence', score: analysis.deliveryConfidence },
    { key: 'pressureRecovery', name: 'Pressure Recovery', score: analysis.pressureRecovery },
    { key: 'companyFitLanguage', name: 'Company Fit Language', score: analysis.companyFitLanguage },
    { key: 'listeningAccuracy', name: 'Listening Accuracy', score: analysis.listeningAccuracy },
  ]

  const hiringProb = analysis.hiringProbability
  const wouldAdvance = analysis.hiringAssessment?.wouldAdvance ?? hiringProb >= 65

  const reasonsYes = analysis.hiringAssessment?.reasonsYes || [
    'Clear ownership in key examples',
    'Good role-relevant experience signals',
    'Consistent effort under pressure',
  ]
  const reasonsNo = analysis.hiringAssessment?.reasonsNo || [
    'Needs tighter specificity in weaker moments',
    'Some confidence dips under pressure',
    'Can better mirror company language',
  ]

  const progressData = (analysis.progressSeries || []).map((p) => ({
    session: p.label,
    probability: p.probability,
  }))

  async function handleDownloadDebriefCard() {
    try {
      setGeneratingCard(true)
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1080
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Background
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080)
      grad.addColorStop(0, '#0b1020')
      grad.addColorStop(1, '#1f1040')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1080, 1080)

      const pad = 72
      // Card panel
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(pad, pad, 1080 - pad * 2, 1080 - pad * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 2
      ctx.strokeRect(pad, pad, 1080 - pad * 2, 1080 - pad * 2)

      // Title
      ctx.fillStyle = '#e5e7eb'
      ctx.font = '700 42px Inter, Arial, sans-serif'
      ctx.fillText('Seatvio', pad + 28, pad + 64)
      ctx.font = '500 22px Inter, Arial, sans-serif'
      ctx.fillStyle = '#93c5fd'
      ctx.fillText('Debrief Card', pad + 28, pad + 98)

      const roleText = hideRoleOnCard
        ? 'Role hidden'
        : `${sessionData.application.companyName} — ${sessionData.application.jobTitle}`
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '500 24px Inter, Arial, sans-serif'
      ctx.fillText(roleText, pad + 28, pad + 142)

      // Hiring probability
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 112px Inter, Arial, sans-serif'
      ctx.fillText(`${hiringProb}`, pad + 24, pad + 294)
      ctx.font = '600 30px Inter, Arial, sans-serif'
      ctx.fillStyle = '#a7f3d0'
      ctx.fillText('Hiring Probability', pad + 34, pad + 336)

      // Three compact dimensions
      const compact = scores.slice(0, 3)
      compact.forEach((item, idx) => {
        const x = pad + 34
        const y = pad + 406 + idx * 96
        ctx.fillStyle = '#d1d5db'
        ctx.font = '600 24px Inter, Arial, sans-serif'
        ctx.fillText(item.name, x, y)
        ctx.fillStyle = '#60a5fa'
        ctx.font = '700 28px Inter, Arial, sans-serif'
        ctx.fillText(`${item.score}/100`, x + 420, y)
      })

      // Top target
      const topTarget = analysis.nextTargets[0]
      ctx.fillStyle = '#fef3c7'
      ctx.font = '700 28px Inter, Arial, sans-serif'
      ctx.fillText('Top Next Target', pad + 32, pad + 730)
      ctx.fillStyle = '#f9fafb'
      ctx.font = '600 30px Inter, Arial, sans-serif'
      ctx.fillText(topTarget?.title || 'Keep practicing with focused drills', pad + 32, pad + 772)

      const drawWrappedText = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        maxLines: number
      ) => {
        const words = text.split(/\s+/)
        let line = ''
        let lineCount = 0
        for (let i = 0; i < words.length; i++) {
          const test = line ? `${line} ${words[i]}` : words[i]
          const width = ctx.measureText(test).width
          if (width > maxWidth && line) {
            ctx.fillText(line, x, y + lineCount * lineHeight)
            line = words[i]
            lineCount += 1
            if (lineCount >= maxLines) break
          } else {
            line = test
          }
        }
        if (lineCount < maxLines && line) {
          ctx.fillText(line, x, y + lineCount * lineHeight)
        }
      }

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '500 22px Inter, Arial, sans-serif'
      drawWrappedText(topTarget?.action || 'Run one focused session and measure improvement.', pad + 32, pad + 812, 820, 32, 3)

      // Footer
      ctx.fillStyle = '#94a3b8'
      ctx.font = '500 20px Inter, Arial, sans-serif'
      ctx.fillText('practiced on seatvio.app', pad + 32, 1080 - pad - 24)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `seatvio-debrief-${sessionId}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingCard(false)
    }
  }

  function shareToLinkedIn() {
    const topTarget = analysis.nextTargets[0]?.title || 'Focused interview improvements'
    const rolePart = hideRoleOnCard
      ? ''
      : ` for ${sessionData.application.jobTitle} at ${sessionData.application.companyName}`
    const text = `Just completed a Seatvio interview simulation${rolePart}. Hiring Probability: ${hiringProb}/100. Next focus: ${topTarget}. practiced on seatvio.app`
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handlePlayAudio(autoplay = false) {
    if (audioRef.current && audioPlaying) {
      audioRef.current.pause()
      return
    }

    try {
      setAudioLoading(true)
      let url = audioUrl

      if (!url) {
        const ttsRes = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: analysis.coachScript,
            voice: 'nova',
            instructions: 'Speak as a direct but encouraging interview coach.',
          }),
        })

        if (!ttsRes.ok) {
          return
        }

        const blob = await ttsRes.blob()
        url = URL.createObjectURL(blob)
        setAudioUrl(url)
      }

      if (!audioRef.current) {
        audioRef.current = new Audio(url)
        audioRef.current.onplay = () => setAudioPlaying(true)
        audioRef.current.onpause = () => setAudioPlaying(false)
        audioRef.current.onended = () => setAudioPlaying(false)
      } else if (audioRef.current.src !== url) {
        audioRef.current.src = url
      }

      await audioRef.current.play()
    } catch {
      // Non-blocking: written coach summary remains visible.
    } finally {
      setAudioLoading(false)
    }
  }

  useEffect(() => {
    if (analysis?.coachScript) {
      void handlePlayAudio(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.coachScript])

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
                onClick={() => void handlePlayAudio(false)}
                disabled={audioLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                {audioLoading ? 'Loading audio...' : audioPlaying ? 'Pause Coach Audio' : 'Play Coach Audio'}
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
                  {(analysis.scoreDetails?.[dim.key]?.observations || []).map((obs, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      {obs}
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-2 text-sm border-t border-gray-100 pt-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-500">
                    {analysis.scoreDetails?.[dim.key]?.weakness || 'Keep improving this dimension with focused practice.'}
                  </span>
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
              {analysis.hiringAssessment?.comparisonToRoleRequirements && (
                <p className="text-sm text-gray-600">
                  {analysis.hiringAssessment.comparisonToRoleRequirements}
                </p>
              )}

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
      <div className="flex flex-wrap items-center justify-center gap-4">
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
        <Button variant="outline" size="lg" onClick={() => void handleDownloadDebriefCard()} disabled={generatingCard}>
          <Download className="h-4 w-4 mr-2" />
          {generatingCard ? 'Generating Card...' : 'Download Debrief Card'}
        </Button>
        <Button variant="ghost" size="lg" onClick={shareToLinkedIn}>
          <Share2 className="h-4 w-4 mr-2" />
          Share to LinkedIn
        </Button>
      </div>

      <div className="flex justify-center">
        <label className="inline-flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={hideRoleOnCard}
            onChange={(e) => setHideRoleOnCard(e.target.checked)}
            className="rounded border-gray-300"
          />
          Hide company/role details on share card
        </label>
      </div>
    </div>
  )
}
