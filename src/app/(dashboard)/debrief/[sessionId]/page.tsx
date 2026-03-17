import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Target, Volume2, TrendingUp } from 'lucide-react'
import DebriefClient from './DebriefClient'

interface CharacterInfo {
  id: string
  name: string
  title: string
  archetype: string
  avatarColor: string
}

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
      application: { select: { id: true, companyName: true, jobTitle: true } },
      analysis: true,
      exchanges: { orderBy: { sequenceNumber: 'asc' } },
    },
  })

  if (!interviewSession) redirect('/dashboard')

  const analysis = interviewSession.analysis
  const exchanges = interviewSession.exchanges

  // Parse characters from session to resolve character IDs to names
  let characters: CharacterInfo[] = []
  try {
    const rawChars = typeof interviewSession.characters === 'string'
      ? JSON.parse(interviewSession.characters)
      : interviewSession.characters
    if (Array.isArray(rawChars)) characters = rawChars
  } catch { /* empty */ }

  const characterNameMap = new Map<string, string>()
  for (const c of characters) {
    characterNameMap.set(c.id, c.name)
  }

  function getCharacterName(charId: string | null): string {
    if (!charId) return 'Interviewer'
    return characterNameMap.get(charId) || charId
  }

  const scores = analysis ? [
    { label: 'Answer Quality', score: analysis.scoreAnswerQuality ?? 0, color: '#5b5fc7' },
    { label: 'Delivery Confidence', score: analysis.scoreDelivery ?? 0, color: '#6B8E4E' },
    { label: 'Pressure Recovery', score: analysis.scorePressure ?? 0, color: '#E8A838' },
    { label: 'Company Fit Language', score: analysis.scoreCompanyFit ?? 0, color: '#4A6FA5' },
    { label: 'Listening Accuracy', score: analysis.scoreListening ?? 0, color: '#C75B5B' },
  ] : []

  // Find primary weakness (lowest score)
  const primaryWeakness = scores.length > 0
    ? scores.reduce((min, s) => s.score < min.score ? s : min, scores[0])
    : null

  const yesReasons = (analysis?.yesReasons as string[] | null) || []
  const noReasons = (analysis?.noReasons as string[] | null) || []
  const nextTargets = (analysis?.nextTargets as Array<{ title: string; description: string; action: string; metric: string }> | null) || []
  const momentMap = (analysis?.momentMap as Array<{ startMs: number; endMs: number; quality: string; note: string; transcript?: string; coachingNote?: string }> | null) || []
  const coachScript = analysis?.coachScript as string | null
  const coachAudioUrl = analysis?.coachAudioUrl as string | null

  const totalDurationMs = interviewSession.actualDurationMs
    ? Number(interviewSession.actualDurationMs)
    : (exchanges.length > 0 ? Number(exchanges[exchanges.length - 1].timestampMs) : 60000)

  // Find the Friendly Champion character for the coach label
  const coachChar = characters.find(c => c.archetype === 'friendly_champion') || characters[0]
  const coachName = coachChar?.name || 'Your Coach'

  // Fetch all sessions for progress tracking chart (spec 7.9)
  const allSessions = await prisma.interviewSession.findMany({
    where: {
      applicationId: interviewSession.applicationId,
      userId,
      status: 'completed',
    },
    include: {
      analysis: {
        select: {
          hiringProbability: true,
          scoreAnswerQuality: true,
          scoreDelivery: true,
          scorePressure: true,
          scoreCompanyFit: true,
          scoreListening: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const progressData = allSessions.map(s => ({
    id: s.id,
    date: s.createdAt.toISOString(),
    hiringProbability: s.analysis?.hiringProbability ?? 0,
    avgScore: s.analysis
      ? Math.round(((s.analysis.scoreAnswerQuality ?? 0) + (s.analysis.scoreDelivery ?? 0) + (s.analysis.scorePressure ?? 0) + (s.analysis.scoreCompanyFit ?? 0) + (s.analysis.scoreListening ?? 0)) / 5)
      : 0,
  }))

  // SVG circular gauge helper
  function CircularGauge({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
    const radius = (size - 8) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1b1b1b"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    )
  }

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
          {/* Coach Audio (spec 7.8) — auto-plays when debrief loads */}
          {(coachAudioUrl || coachScript) && (
            <div className="rounded-2xl bg-[#292929] p-5">
              <div className="flex items-center gap-3 mb-3">
                {coachChar?.avatarColor && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: coachChar.avatarColor }}
                  >
                    {coachChar.name.split(' ').map(n => n[0]).join('')}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-[#5b5fc7]" />
                    Coach Debrief &mdash; {coachName}
                  </h3>
                  <p className="text-xs text-gray-500">&ldquo;Let&apos;s talk about what just happened in there.&rdquo;</p>
                </div>
              </div>
              {coachAudioUrl && (
                <audio controls autoPlay className="w-full mb-3" src={coachAudioUrl}>
                  Your browser does not support audio playback.
                </audio>
              )}
              {coachScript && (
                <p className="text-sm text-gray-300 leading-relaxed">{coachScript}</p>
              )}
            </div>
          )}

          {/* Interactive Moment Map (spec 7.3) — client component for click handling */}
          <DebriefClient
            momentMap={momentMap}
            totalDurationMs={totalDurationMs}
          />

          {/* 5 Score Cards with Circular Gauges (spec 7.5) */}
          <div className="grid gap-3 sm:grid-cols-5">
            {scores.map(s => (
              <div key={s.label} className="rounded-2xl bg-[#292929] p-4 text-center">
                <div className="relative inline-flex items-center justify-center">
                  <CircularGauge score={s.score} color={s.color} size={80} />
                  <span className="absolute text-xl font-bold text-white">{s.score}</span>
                </div>
                <p className="mt-2 text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Primary Weakness callout */}
          {primaryWeakness && primaryWeakness.score < 70 && (
            <div className="rounded-2xl bg-red-900/10 border border-red-500/20 p-4">
              <p className="text-xs text-red-400 uppercase tracking-wider mb-1">Primary Weakness</p>
              <p className="text-sm text-white font-medium">{primaryWeakness.label} — {primaryWeakness.score}/100</p>
              <p className="text-xs text-gray-400 mt-1">Focus your next practice session on improving this area.</p>
            </div>
          )}

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

          {/* Next Targets — exactly 3 (spec 7.7) */}
          {nextTargets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-[#5b5fc7]" />
                Next Session Targets
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {nextTargets.slice(0, 3).map((t, i) => (
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

          {/* Progress Tracking Chart (spec 7.9) */}
          {progressData.length > 1 && (
            <div className="rounded-2xl bg-[#292929] p-5">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#5b5fc7]" />
                Progress Over Sessions
              </h3>
              <div className="flex items-end gap-2 h-32">
                {progressData.map((p, i) => {
                  const isCurrent = p.id === params.sessionId
                  const height = Math.max(p.hiringProbability, 5)
                  return (
                    <div key={p.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{p.hiringProbability}%</span>
                      <div
                        className={`w-full rounded-t-lg transition-all ${isCurrent ? 'bg-[#5b5fc7]' : 'bg-[#5b5fc7]/40'}`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-gray-500">
                        {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Full Transcript — with character names resolved */}
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
                      {ex.speaker === 'candidate' ? 'You' : getCharacterName(ex.characterId)}
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
