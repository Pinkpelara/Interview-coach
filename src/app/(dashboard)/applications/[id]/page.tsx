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
} from 'lucide-react'

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/signin')
  const userId = (session.user as { id: string }).id

  const application = await prisma.application.findFirst({
    where: { id: params.id, userId },
    include: {
      alignmentAnalysis: true,
      _count: { select: { questions: true, sessions: true } },
      sessions: {
        where: { status: 'completed' },
        include: { analysis: { select: { hiringProbability: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!application) redirect('/dashboard')

  const analysis = application.alignmentAnalysis
  const skillGaps = (analysis?.skillGaps as string[] | null) || []
  const strengths = (analysis?.strengths as string[] | null) || []
  const missingKeywords = (analysis?.missingKeywords as string[] | null) || []
  const probeAreas = (analysis?.probeAreas as string[] | null) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h2 className="text-2xl font-bold text-white">{application.companyName}</h2>
          <p className="text-gray-400">{application.jobTitle}</p>
          {application.interviewStage && (
            <span className="mt-2 inline-block rounded-full bg-[#5b5fc7]/20 px-3 py-0.5 text-xs font-medium text-[#5b5fc7]">
              {application.interviewStage}
            </span>
          )}
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#292929] p-5">
          <p className="text-xs text-gray-400 mb-1">Alignment Score</p>
          <p className="text-3xl font-bold text-white">{application.alignmentScore ?? 0}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-[#1b1b1b]">
            <div className="h-full rounded-full bg-[#5b5fc7]" style={{ width: `${application.alignmentScore ?? 0}%` }} />
          </div>
        </div>
        <div className="rounded-2xl bg-[#292929] p-5">
          <p className="text-xs text-gray-400 mb-1">Readiness Score</p>
          <p className="text-3xl font-bold text-white">{application.readinessScore}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-[#1b1b1b]">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${application.readinessScore}%` }} />
          </div>
        </div>
      </div>

      {/* Analysis section */}
      {analysis && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Skill Gaps */}
          <div className="rounded-2xl bg-[#292929] p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm font-medium text-white">Skill Gaps</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {skillGaps.map((gap, i) => (
                <span key={i} className="rounded-full bg-yellow-900/30 border border-yellow-800/50 px-2.5 py-0.5 text-xs text-yellow-300">
                  {gap}
                </span>
              ))}
              {skillGaps.length === 0 && <p className="text-xs text-gray-500">No gaps identified</p>}
            </div>
          </div>

          {/* Strengths */}
          <div className="rounded-2xl bg-[#292929] p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-white">Strengths</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {strengths.map((s, i) => (
                <span key={i} className="rounded-full bg-emerald-900/30 border border-emerald-800/50 px-2.5 py-0.5 text-xs text-emerald-300">
                  {s}
                </span>
              ))}
              {strengths.length === 0 && <p className="text-xs text-gray-500">No strengths identified yet</p>}
            </div>
          </div>

          {/* Missing Keywords */}
          {missingKeywords.length > 0 && (
            <div className="rounded-2xl bg-[#292929] p-5">
              <h3 className="text-sm font-medium text-white mb-3">Missing Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {missingKeywords.map((kw, i) => (
                  <span key={i} className="rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-0.5 text-xs text-red-300">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Probe Areas */}
          {probeAreas.length > 0 && (
            <div className="rounded-2xl bg-[#292929] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-[#5b5fc7]" />
                <h3 className="text-sm font-medium text-white">Probe Areas</h3>
              </div>
              <ol className="space-y-1">
                {probeAreas.map((area, i) => (
                  <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-[#5b5fc7] font-medium shrink-0">{i + 1}.</span>
                    {area}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href={`/applications/${params.id}/questions`}
          className="flex items-center gap-3 rounded-2xl bg-[#292929] p-4 hover:bg-[#333] transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b5fc7]/20">
            <BookOpen className="h-5 w-5 text-[#5b5fc7]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Question Bank</p>
            <p className="text-xs text-gray-400">{application._count.questions} questions</p>
          </div>
        </Link>

        <Link
          href={`/applications/${params.id}/interview/setup`}
          className="flex items-center gap-3 rounded-2xl bg-[#5b5fc7] p-4 hover:bg-[#4e52b5] transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Start Interview</p>
            <p className="text-xs text-white/70">{application._count.sessions} sessions</p>
          </div>
        </Link>

        <Link
          href={`/applications/${params.id}/observe`}
          className={`flex items-center gap-3 rounded-2xl p-4 transition-colors ${
            application._count.sessions > 0
              ? 'bg-[#292929] hover:bg-[#333]'
              : 'bg-[#292929] opacity-50 pointer-events-none'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b5fc7]/20">
            <Eye className="h-5 w-5 text-[#5b5fc7]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Observe</p>
            <p className="text-xs text-gray-400">
              {application._count.sessions > 0 ? 'View runs' : 'Complete 1 session first'}
            </p>
          </div>
        </Link>
      </div>

      {/* Session history */}
      <div className="rounded-2xl bg-[#292929] p-5">
        <h3 className="text-sm font-medium text-white mb-4">Session History</h3>
        {application.sessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No sessions yet. Start your first interview above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {application.sessions.map(s => (
              <Link
                key={s.id}
                href={`/debrief/${s.id}`}
                className="flex items-center justify-between rounded-xl bg-[#1b1b1b] px-4 py-3 hover:bg-[#333] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-white">{s.stage} &middot; {s.intensity}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {s.analysis?.hiringProbability != null && (
                  <span className={`text-sm font-semibold ${
                    s.analysis.hiringProbability >= 70 ? 'text-emerald-400' :
                    s.analysis.hiringProbability >= 40 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {s.analysis.hiringProbability}%
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
