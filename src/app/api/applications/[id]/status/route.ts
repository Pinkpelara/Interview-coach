import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id } = params

    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        alignmentScore: true,
        readinessScore: true,
        alignmentAnalysis: {
          select: { id: true },
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
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (application.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      id: application.id,
      status: application.status,
      alignmentScore: application.alignmentScore,
      readinessScore: application.readinessScore,
      analysisReady: !!application.alignmentAnalysis,
      questionsGenerated: application._count.questions,
      sessionsCount: application._count.sessions,
    })
  } catch (error) {
    console.error('Error fetching application status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
