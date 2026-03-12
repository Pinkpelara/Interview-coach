import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, ChevronRight } from 'lucide-react'

export default async function SessionHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/signin')
  const userId = (session.user as { id: string }).id

  const sessions = await prisma.interviewSession.findMany({
    where: { userId },
    include: {
      application: { select: { companyName: true, jobTitle: true } },
      analysis: { select: { hiringProbability: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Session History</h2>

      {sessions.length === 0 ? (
        <div className="rounded-2xl bg-[#292929] p-8 text-center">
          <p className="text-gray-400">No sessions yet. Start your first interview from an application.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Link
              key={s.id}
              href={s.status === 'completed' ? `/debrief/${s.id}` : `/perform/${s.id}`}
              className="flex items-center justify-between rounded-2xl bg-[#292929] px-5 py-4 hover:bg-[#333] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b5fc7]/20">
                  <Clock className="h-5 w-5 text-[#5b5fc7]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {s.application.companyName} &mdash; {s.application.jobTitle}
                  </p>
                  <p className="text-xs text-gray-400">
                    {s.stage} &middot; {s.intensity} &middot;{' '}
                    {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400' :
                  s.status === 'active' ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-[#333] text-gray-400'
                }`}>
                  {s.status}
                </span>
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
          ))}
        </div>
      )}
    </div>
  )
}
