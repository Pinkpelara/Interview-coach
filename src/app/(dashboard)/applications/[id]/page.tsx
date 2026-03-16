import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Mic,
  Eye,
  CalendarDays,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Sparkles,
  Building2,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ScoreGauge } from '@/components/ui/ScoreGauge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'

function safeParseJSON(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function stageBadgeVariant(stage: string | null | undefined) {
  switch (stage) {
    case 'Applied':
      return 'info' as const
    case 'Phone Screen Scheduled':
      return 'warning' as const
    case 'First Round Scheduled':
      return 'default' as const
    case 'Panel/Final Round Scheduled':
      return 'danger' as const
    default:
      return 'default' as const
  }
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as { id: string }).id
  const { id } = params

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      parsedResume: true,
      parsedJD: true,
      questions: {
        orderBy: { createdAt: 'desc' },
      },
      sessions: {
        include: {
          analysis: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          questions: true,
          sessions: true,
        },
      },
    },
  })

  if (!application) {
    redirect('/dashboard')
  }

  if (application.userId !== userId) {
    redirect('/dashboard')
  }

  const skillGaps = safeParseJSON(application.skillGaps)
  const strengths = safeParseJSON(application.strengths)
  const missingKeywords = safeParseJSON(application.missingKeywords)
  const probeAreas = safeParseJSON(application.probeAreas)
  const hasQuestions = application._count.questions > 0
  const latestObserveSession =
    application.sessions.find((s) => s.status === 'completed') || null

  return (
    <div className="space-y-8">
      {/* Back link + Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {application.companyName}
            </h2>
            <p className="mt-1 text-lg text-gray-500">{application.jobTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={stageBadgeVariant(application.interviewStage)}>
              {application.interviewStage || 'No stage set'}
            </Badge>
            <Badge variant={application.status === 'active' ? 'success' : 'default'}>
              {application.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* No questions CTA */}
      {!hasQuestions && (
        <Card className="border-brand-200 bg-brand-50/50">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700/10 mb-4">
              <Sparkles className="h-7 w-7 text-brand-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Ready to start preparing?
            </h3>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              Generate a tailored question bank based on the job description and your
              resume. Our AI will create questions you&apos;re most likely to face.
            </p>
            <Link href={`/prepare/${application.id}`} className="mt-6">
              <Button size="lg">
                <BookOpen className="mr-2 h-5 w-5" />
                Generate Question Bank
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Alignment Score + Readiness */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Target className="h-5 w-5 text-brand-700" />
              Alignment Score
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-6">
            <ScoreGauge
              score={application.alignmentScore ?? 0}
              size="lg"
              label="JD-Resume Fit"
            />
            <p className="mt-4 text-sm text-gray-500 text-center max-w-xs">
              How well your resume matches this job description based on skills,
              experience, and keywords.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Interview Readiness
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col justify-center py-6 space-y-6">
            <ProgressBar
              value={application.readinessScore}
              label="Overall Readiness"
              showPercent
            />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {application._count.questions}
                </p>
                <p className="text-xs text-gray-500">Questions Generated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {application._count.sessions}
                </p>
                <p className="text-xs text-gray-500">Practice Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill Gaps + Strengths */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Skill Gaps
            </h3>
          </CardHeader>
          <CardContent>
            {skillGaps.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skillGaps.map((gap, i) => (
                  <Badge key={i} variant="danger">
                    {gap}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No skill gaps identified.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Strengths
            </h3>
          </CardHeader>
          <CardContent>
            {strengths.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {strengths.map((strength, i) => (
                  <Badge key={i} variant="success">
                    {strength}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No strengths identified yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Missing Keywords */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Hash className="h-5 w-5 text-yellow-600" />
            Missing Keywords
          </h3>
        </CardHeader>
        <CardContent>
          {missingKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {missingKeywords.map((keyword, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-yellow-50 px-3 py-1 text-sm font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No missing keywords detected.</p>
          )}
        </CardContent>
      </Card>

      {/* Likely Probe Areas */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Likely Probe Areas
          </h3>
        </CardHeader>
        <CardContent>
          {probeAreas.length > 0 ? (
            <ol className="space-y-3">
              {probeAreas.map((area, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700 pt-0.5">{area}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">No probe areas identified yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Parsed Resume + Job Description */}
      {(application.parsedResume || application.parsedJD) && (
        <div className="grid gap-6 md:grid-cols-2">
          {application.parsedResume && (
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">Parsed Resume Snapshot</h3>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-700">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Top Skills</p>
                  <p>{application.parsedResume.topSkills || 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Career Timeline</p>
                  <p>{application.parsedResume.careerTimeline || 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Education</p>
                  <p>{application.parsedResume.education || 'Not available'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {application.parsedJD && (
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">Parsed Job Description Snapshot</h3>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-700">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Seniority Level</p>
                  <p>{application.parsedJD.seniorityLevel || 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Interview Format Prediction</p>
                  <p>{application.parsedJD.interviewFormatPrediction || 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Values Language</p>
                  <div className="flex flex-wrap gap-2">
                    {safeParseJSON(application.parsedJD.valuesLanguage).map((value, idx) => (
                      <Badge key={idx} variant="info">{value}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Session History */}
      {application.sessions.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Session History
            </h3>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {application.sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {s.stage} Interview &mdash; {s.intensity}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.durationMinutes} min &middot;{' '}
                    {s.createdAt.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {s.analysis && (
                    <span className="text-xs font-medium text-gray-500">
                      Score: {s.analysis.hiringProbability ?? '---'}
                    </span>
                  )}
                  <Badge
                    variant={
                      s.status === 'completed'
                        ? 'success'
                        : s.status === 'active'
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {s.status.replace('_', ' ')}
                  </Badge>
                  <Link
                    href={`/debrief/${s.id}`}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-wrap gap-3">
            <Link href={`/prepare/${application.id}`}>
              <Button variant={hasQuestions ? 'secondary' : 'primary'}>
                <BookOpen className="mr-2 h-4 w-4" />
                {hasQuestions ? 'View Question Bank' : 'Generate Question Bank'}
              </Button>
            </Link>
            <Link
              href={`/perform?applicationId=${application.id}&stage=${application.interviewStage || 'screening'}`}
            >
              <Button variant="primary">
                <Mic className="mr-2 h-4 w-4" />
                Start Interview
              </Button>
            </Link>
            {latestObserveSession ? (
              <Link href={`/observe/${latestObserveSession.id}`}>
                <Button variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  View Observe
                </Button>
              </Link>
            ) : (
              <Button variant="outline" disabled>
                <Eye className="mr-2 h-4 w-4" />
                View Observe (after first session)
              </Button>
            )}
            <Link href={`/countdown/${application.id}`}>
              <Button variant="outline">
                <CalendarDays className="mr-2 h-4 w-4" />
                Interview Countdown
              </Button>
            </Link>
            <Link href={`/applications/${application.id}/company-dna`}>
              <Button variant="outline">
                <Building2 className="mr-2 h-4 w-4" />
                Company DNA
              </Button>
            </Link>
            <Link href={`/reflections/${application.id}`}>
              <Button variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                Reflection Log
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
