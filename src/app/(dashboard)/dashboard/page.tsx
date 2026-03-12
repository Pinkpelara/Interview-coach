import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Clock, TrendingUp, Calendar, ChevronRight } from 'lucide-react'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/signin')

  const userId = (session.user as { id: string }).id

  const [user, applications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    }),
    prisma.application.findMany({
      where: { userId },
      include: {
        _count: { select: { sessions: true } },
        sessions: {
          where: { status: 'completed' },
          include: { analysis: { select: { hiringProbability: true } } },
          orderBy: { createdAt: 'desc' },
          take: 2,
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const firstName = user?.fullName?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Welcome back, {firstName}
          </h2>
          <p className="mt-1 text-gray-400">
            {applications.length > 0
              ? `You have ${applications.length} active application${applications.length > 1 ? 's' : ''}.`
              : 'Get started by creating your first application.'}
          </p>
        </div>
        <Link
          href="/applications/new"
          className="flex items-center gap-2 rounded-lg bg-[#5b5fc7] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4e52b5] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Application
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[#292929] py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5b5fc7]/20 mb-4">
            <Plus className="h-8 w-8 text-[#5b5fc7]" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            Create your first Application
          </h3>
          <p className="mt-2 max-w-md text-sm text-gray-400">
            Add a job you&apos;re applying for. We&apos;ll analyze the job description against your resume,
            generate personalized interview questions, and prepare you for the real thing.
          </p>
          <Link
            href="/applications/new"
            className="mt-6 flex items-center gap-2 rounded-lg bg-[#5b5fc7] px-6 py-3 text-sm font-medium text-white hover:bg-[#4e52b5] transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Application
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => {
            const latestProb = app.sessions[0]?.analysis?.hiringProbability
            const prevProb = app.sessions[1]?.analysis?.hiringProbability
            const trend = latestProb != null && prevProb != null ? latestProb - prevProb : null
            const daysUntil = app.realInterviewDate
              ? Math.ceil((new Date(app.realInterviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null

            return (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="group rounded-2xl bg-[#292929] p-5 hover:bg-[#333] transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-base font-semibold text-white">
                      {app.companyName}
                    </h4>
                    <p className="truncate text-sm text-gray-400">
                      {app.jobTitle}
                    </p>
                  </div>
                  {app.interviewStage && (
                    <span className="ml-2 shrink-0 rounded-full bg-[#5b5fc7]/20 px-2.5 py-0.5 text-xs font-medium text-[#5b5fc7]">
                      {app.interviewStage}
                    </span>
                  )}
                </div>

                {/* Alignment Score */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Alignment</span>
                    <span className="text-white font-medium">{app.alignmentScore ?? 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1b1b1b]">
                    <div
                      className="h-full rounded-full bg-[#5b5fc7] transition-all"
                      style={{ width: `${app.alignmentScore ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Readiness Score */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Readiness</span>
                    <span className="text-white font-medium">{app.readinessScore}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1b1b1b]">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${app.readinessScore}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3">
                    {latestProb != null && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className={latestProb >= 70 ? 'text-emerald-400' : latestProb >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                          {latestProb}%
                        </span>
                        {trend != null && trend !== 0 && (
                          <span className={trend > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {trend > 0 ? '+' : ''}{trend}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {app._count.sessions}
                    </span>
                    {daysUntil != null && daysUntil >= 0 && (
                      <span className={`flex items-center gap-1 ${daysUntil <= 3 ? 'text-red-400' : daysUntil <= 7 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
