import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, ArrowRight, History } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ScoreGauge } from '@/components/ui/ScoreGauge'

function intensityVariant(intensity: string) {
  switch (intensity) {
    case 'high-pressure':
      return 'danger' as const
    case 'standard':
      return 'warning' as const
    case 'warmup':
      return 'success' as const
    default:
      return 'default' as const
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default async function SessionHistoryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as { id: string }).id

  const sessions = await prisma.interviewSession.findMany({
    where: { userId },
    include: {
      application: {
        select: { companyName: true, jobTitle: true },
      },
      analysis: {
        select: { hiringProbability: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Session History</h2>
        <p className="mt-1 text-gray-500">
          Review all your past interview practice sessions.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700/10 mb-4">
              <History className="h-8 w-8 text-brand-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              No sessions yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Once you complete your first interview practice session, it will appear here
              with a full breakdown and debrief.
            </p>
            <Link href="/dashboard" className="mt-6">
              <Button>
                Start Practicing
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {s.application.companyName} &mdash; {s.application.jobTitle}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>
                      {s.createdAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span>&middot;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(s.durationMinutes)}
                    </span>
                    <span>&middot;</span>
                    <span>{s.stage}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={intensityVariant(s.intensity)}>
                    {s.intensity}
                  </Badge>

                  {s.analysis?.hiringProbability != null && (
                    <ScoreGauge
                      score={s.analysis.hiringProbability}
                      size="sm"
                      label="Hire %"
                    />
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
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
                  >
                    Debrief
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
