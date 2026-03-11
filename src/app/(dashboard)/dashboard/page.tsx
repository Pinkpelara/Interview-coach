import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Zap, Briefcase, Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ScoreGauge } from '@/components/ui/ScoreGauge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as { id: string }).id

  const [user, applications, recentSessions] = await Promise.all([
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
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.interviewSession.findMany({
      where: { userId },
      include: { application: { select: { companyName: true, jobTitle: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const firstName = user?.fullName?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName}!
        </h2>
        <p className="mt-1 text-gray-500">
          {applications.length > 0
            ? `You have ${applications.length} active application${applications.length > 1 ? 's' : ''}.`
            : 'Get started by creating your first application.'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/applications/new">
          <Button size="md">
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Button>
        </Link>
        <Link href="/pressure-lab">
          <Button variant="outline" size="md">
            <Zap className="mr-2 h-4 w-4" />
            Quick Practice
          </Button>
        </Link>
      </div>

      {/* Applications */}
      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700/10 mb-4">
              <Briefcase className="h-8 w-8 text-brand-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              No applications yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Create your first application to start practicing for your interview.
              We&apos;ll analyze the job description and tailor questions for you.
            </p>
            <Link href="/applications/new" className="mt-6">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create your first application
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Your Applications
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {applications.map((app) => (
              <Card key={app.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-base font-semibold text-gray-900">
                        {app.companyName}
                      </h4>
                      <p className="truncate text-sm text-gray-500">
                        {app.jobTitle}
                      </p>
                    </div>
                    <Badge
                      variant={app.status === 'active' ? 'success' : 'default'}
                    >
                      {app.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col items-center">
                      <ScoreGauge
                        score={app.alignmentScore ?? 0}
                        size="sm"
                        label="Alignment"
                      />
                    </div>
                    <div className="flex-1">
                      <ProgressBar
                        value={app.readinessScore}
                        label="Readiness"
                        showPercent
                      />
                    </div>
                  </div>

                  {/* Hiring probability from latest session */}
                  {app.sessions[0]?.analysis?.hiringProbability != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Hiring Probability</span>
                      <span className={`font-semibold ${
                        app.sessions[0].analysis.hiringProbability >= 70 ? 'text-green-600' :
                        app.sessions[0].analysis.hiringProbability >= 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {app.sessions[0].analysis.hiringProbability}%
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {app._count.sessions} session{app._count.sessions !== 1 ? 's' : ''}
                      </span>
                      {app.realInterviewDate && (() => {
                        const days = Math.ceil((new Date(app.realInterviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        if (days < 0) return null
                        return (
                          <Badge variant={days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'info'}>
                            {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d left`}
                          </Badge>
                        )
                      })()}
                    </div>
                    <Link
                      href={`/applications/${app.id}`}
                      className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800"
                    >
                      View
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Sessions
            </h3>
            <Link
              href="/session-history"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              View all
            </Link>
          </div>
          <Card>
            <div className="divide-y divide-gray-100">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {s.application.companyName} &mdash; {s.application.jobTitle}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.stage} &middot; {s.intensity} &middot;{' '}
                      {s.createdAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        s.status === 'completed'
                          ? 'success'
                          : s.status === 'in_progress'
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
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
