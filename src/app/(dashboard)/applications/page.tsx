import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, Plus, ArrowRight, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ScoreGauge } from '@/components/ui/ScoreGauge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'

export default async function ApplicationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id
  const applications = await prisma.application.findMany({
    where: { userId },
    include: {
      _count: { select: { sessions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Applications</h2>
          <p className="text-gray-500">Manage each role you are preparing for.</p>
        </div>
        <Link href="/applications/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Application
          </Button>
        </Link>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-brand-700/10 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-7 w-7 text-brand-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No applications yet</h3>
            <p className="text-sm text-gray-500 mt-2">
              Create your first application to generate a job-specific question bank and live interview simulation.
            </p>
            <Link href="/applications/new" className="inline-block mt-6">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Application
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{app.companyName}</h3>
                    <p className="text-sm text-gray-500 truncate">{app.jobTitle}</p>
                  </div>
                  <Badge variant={app.status === 'active' ? 'success' : 'default'}>
                    {app.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <ScoreGauge score={app.alignmentScore ?? 0} size="sm" label="Alignment" />
                  <div className="flex-1">
                    <ProgressBar value={app.readinessScore} label="Readiness" showPercent />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {app._count.sessions} session{app._count.sessions === 1 ? '' : 's'}
                  </span>
                  <Link href={`/applications/${app.id}`} className="text-brand-700 font-medium inline-flex items-center gap-1">
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
