import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseSessionConfig(raw: string | null) {
  if (!raw) return { panel: [], questionPlan: [], questionState: null, unexpectedEvents: [] }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { panel: parsed, questionPlan: [], questionState: null, unexpectedEvents: [] }
    }
    return {
      panel: parsed.panel || [],
      questionPlan: parsed.questionPlan || [],
      questionState: parsed.questionState || null,
      unexpectedEvents: parsed.unexpectedEvents || [],
    }
  } catch {
    return { panel: [], questionPlan: [], questionState: null, unexpectedEvents: [] }
  }
}

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

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id, userId },
      include: {
        application: {
          select: {
            companyName: true,
            jobTitle: true,
            jdText: true,
            strengths: true,
            skillGaps: true,
            probeAreas: true,
          },
        },
        exchanges: {
          orderBy: { sequenceNumber: 'asc' },
        },
        analysis: true,
      },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const config = parseSessionConfig(interviewSession.characters)
    return NextResponse.json({
      ...interviewSession,
      characters: config.panel,
      questionPlan: config.questionPlan,
      questionState: config.questionState,
      unexpectedEvents: config.unexpectedEvents,
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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
    const body = await request.json()

    const existing = await prisma.interviewSession.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.status) {
      const validStatuses = ['pending', 'active', 'completed', 'cancelled']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = body.status

      if (body.status === 'active' && !existing.startedAt) {
        updateData.startedAt = new Date()
      }
      if (body.status === 'completed' && !existing.endedAt) {
        updateData.endedAt = new Date()
      }
    }

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: updateData,
      include: {
        application: {
          select: { companyName: true, jobTitle: true },
        },
        exchanges: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    })

    const config = parseSessionConfig(updated.characters)
    return NextResponse.json({
      ...updated,
      characters: config.panel,
      questionPlan: config.questionPlan,
      questionState: config.questionState,
      unexpectedEvents: config.unexpectedEvents,
    })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
