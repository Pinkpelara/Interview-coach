import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Target } from 'lucide-react'

export default async function DebriefPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/signin')
  const userId = (session.user as { id: string }).id

  const interviewSession = await prisma.interviewSession.findFirst({
    where: { id: params.sessionId, userId },
    include: {
      application: { select: { companyName: true, jobTitle: true } },
      analysis: true,
      exchanges: { orderBy: { sequenceNumber: 'asc' } },
    },
  })

  if (!interviewSession) redirect('/dashboard')

  const analysis = interviewSession.analysis
  const exchanges = interviewSession.exchanges

  const scores = analysis ? [
    { label: 'Answer Quality', score: analysis.scoreAnswerQuality, color: '#5b5fc7' },
    { label: 'Delivery Confidence', score: analysis.scoreDelivery, color: '#6B8E4E' },
    { label: 'Pressure Recovery', score: analysis.scorePressure, color: '#E8A838' },
    { label: 'Company Fit Language', score: analysis.scoreCompanyFit, color: '#4A6FA5' },
    { label: 'Listening Accuracy', score: analysis.scoreListening, color: '#C75B5B' },
  ] : []

  const yesReasons = (analysis?.yesReasons as string[] | null) || []
  const noReasons = (analysis?.noReasons as string[] | null) || []
  const nextTargets = (analysis?.nextTargets as Array<{ title: string; description: string; action: string; metric: string }> | null) || []
  const momentMap = (analysis?.momentMap as Array<{ startMs: number; endMs: number; quality: string; note: string }> | null) || []

  const totalDurationMs = interviewSession.actualDurationMs
    ? Number(interviewSession.actualDurationMs)
    : (exchanges.length > 0 ? Number(exchanges[exchanges.length - 1].timestampMs) : 60000)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href={`/applications/${interviewSession.applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Application
        </Link>
        <h2 className="text-2xl font-bold text-white">Interview Debrief</h2>
        <p className="text-gray-400">
          {interviewSession.application.companyName} &mdash; {interviewSession.application.jobTitle}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {interviewSession.stage} &middot; {interviewSession.intensity} &middot;{' '}
          {new Date(interviewSession.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {!analysis ? (
        <div className="rounded-2xl bg-[#292929] p-8 text-center">
          <p className="text-gray-400">Analysis is being generated. Please check back in a moment.</p>
        </div>
      ) : (
        <>
          {/* Moment Map */}
          {momentMap.length > 0 && (
            <div className="rounded-2xl bg-[#292929] p-5">
              <h3 className="text-sm font-medium text-white mb-4">Moment Map</h3>
              <div className="flex h-8 rounded-lg overflow-hidden gap-px">
                {momentMap.map((segment, i) => {
                  const width = totalDurationMs > 0
                    ? ((segment.endMs - segment.startMs) / totalDurationMs) * 100
                    : 100 / momentMap.length
                  const color = segment.quality === 'strong' ? 'bg-emerald-500'
                    : segment.quality === 'recoverable' ? 'bg-yellow-500'
                    : 'bg-red-500'
                  return (
                    <div
                      key={i}
                      className={`${color} hover:opacity-80 transition-opacity cursor-pointer relative group`}
                      style={{ width: `${Math.max(width, 2)}%` }}
                      title={segment.note}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1b1b1b] border border-[#333] rounded-lg px-3 py-2 text-xs text-gray-300 whitespace-nowrap z-10">
                        {segment.note}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Strong</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Recoverable</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Dropped</span>
              </div>
            </div>
          )}

          {/* 5 Score Cards */}
          <div className="grid gap-3 sm:grid-cols-5">
            {scores.map(s => (
              <div key={s.label} className="rounded-2xl bg-[#292929] p-4 text-center">
                <p className="text-3xl font-bold text-white">{s.score}</p>
                <div className="mt-2 h-1.5 rounded-full bg-[#1b1b1b]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${s.score}%`, backgroundColor: s.color }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hiring Probability */}
          <div className="rounded-2xl bg-[#292929] p-6 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Hiring Probability</p>
            <p className={`text-5xl font-bold ${
              (analysis.hiringProbability ?? 0) >= 70 ? 'text-emerald-400' :
              (analysis.hiringProbability ?? 0) >= 40 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {analysis.hiringProbability ?? 0}%
            </p>
            <p className={`mt-3 text-lg font-semibold ${analysis.wouldAdvance ? 'text-emerald-400' : 'text-red-400'}`}>
              Would Advance: {analysis.wouldAdvance ? 'YES' : 'NO'}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 text-left">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Yes Reasons
                </p>
                <ul className="space-y-1">
                  {yesReasons.map((r, i) => (
                    <li key={i} className="text-sm text-gray-300">{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-400" /> No Reasons
                </p>
                <ul className="space-y-1">
                  {noReasons.map((r, i) => (
                    <li key={i} className="text-sm text-gray-300">{r}</li>
                  ))}
                </ul>
              </div>
            </div>

            {analysis.roleComparison && (
              <p className="mt-4 text-sm text-gray-400 text-left">{analysis.roleComparison}</p>
            )}
          </div>

          {/* Next Targets */}
          {nextTargets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-[#5b5fc7]" />
                Next Targets
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {nextTargets.map((t, i) => (
                  <div key={i} className="rounded-2xl bg-[#292929] p-5">
                    <h4 className="text-sm font-semibold text-white">{t.title}</h4>
                    <p className="mt-2 text-xs text-gray-400">{t.description}</p>
                    <p className="mt-2 text-xs text-[#5b5fc7]">{t.action}</p>
                    <p className="mt-1 text-xs text-gray-500">Success metric: {t.metric}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="rounded-2xl bg-[#292929] p-5">
            <h3 className="text-sm font-medium text-white mb-4">Full Transcript</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {exchanges.map(ex => (
                <div key={ex.id} className={`flex ${ex.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                    ex.speaker === 'candidate'
                      ? 'bg-[#5b5fc7] text-white'
                      : 'bg-[#333] text-gray-200'
                  }`}>
                    <p className="text-xs font-medium mb-0.5 opacity-70">
                      {ex.speaker === 'candidate' ? 'You' : ex.characterId || 'Interviewer'}
                    </p>
                    {ex.messageText}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
