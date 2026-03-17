import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, ChevronRight, Mic, BarChart3 } from 'lucide-react'

export default async function SessionHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/signin')
  const userId = (session.user as { id: string }).id

  const sessions = await prisma.interviewSession.findMany({
    where: { userId },
    include: {
      application: { select: { companyName: true, jobTitle: true } },
      analysis: {
        select: {
          hiringProbability: true,
          momentMap: true,
          scoreAnswerQuality: true,
          scoreDelivery: true,
          scorePressure: true,
          scoreCompanyFit: true,
          scoreListening: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Session History</h2>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[#292929] py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5b5fc7]/20 mb-4">
            <Mic className="h-8 w-8 text-[#5b5fc7]" />
          </div>
          <h3 className="text-lg font-semibold text-white">No sessions yet</h3>
          <p className="mt-2 max-w-md text-sm text-gray-400">
            Start your first interview from an application to see your session history and track improvement over time.
          </p>
          <Link
            href="/applications"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#5b5fc7] px-6 py-3 text-sm font-medium text-white hover:bg-[#4e52b5] transition-colors"
          >
            Go to Applications
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const momentMap = (s.analysis?.momentMap as Array<{ startMs: number; endMs: number; quality: string }> | null) || []
            const avgScore = s.analysis
              ? Math.round(((s.analysis.scoreAnswerQuality ?? 0) + (s.analysis.scoreDelivery ?? 0) + (s.analysis.scorePressure ?? 0) + (s.analysis.scoreCompanyFit ?? 0) + (s.analysis.scoreListening ?? 0)) / 5)
              : null

            return (
              <Link
                key={s.id}
                href={s.status === 'completed' ? `/debrief/${s.id}` : `/perform/${s.id}`}
                className="flex items-center justify-between rounded-2xl bg-[#292929] px-5 py-4 hover:bg-[#333] transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b5fc7]/20 shrink-0">
                    <Clock className="h-5 w-5 text-[#5b5fc7]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {s.application.companyName} &mdash; {s.application.jobTitle}
                    </p>
                    <p className="text-xs text-gray-400">
                      {s.stage} &middot; {s.intensity} &middot;{' '}
                      {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Moment Map Thumbnail (spec 11.3) */}
                  {momentMap.length > 0 && (
                    <div className="hidden sm:flex h-3 w-24 rounded-sm overflow-hidden gap-px shrink-0">
                      {momentMap.map((seg, i) => {
                        const color = seg.quality === 'strong' ? 'bg-emerald-500'
                          : seg.quality === 'recoverable' ? 'bg-yellow-500'
                          : 'bg-red-500'
                        return <div key={i} className={`flex-1 ${color}`} />
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400' :
                    s.status === 'active' ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-[#333] text-gray-400'
                  }`}>
                    {s.status}
                  </span>
                  {avgScore != null && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {avgScore}
                    </span>
                  )}
                  {s.analysis?.hiringProbability != null && (
                    <span className={`text-sm font-semibold ${
                      s.analysis.hiringProbability >= 70 ? 'text-emerald-400' :
                      s.analysis.hiringProbability >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {s.analysis.hiringProbability}%
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
