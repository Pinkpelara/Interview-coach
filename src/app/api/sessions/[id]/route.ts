import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isNotificationEnabled, sendNotificationEmail } from '@/lib/notifications'

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

    return NextResponse.json({
      ...interviewSession,
      characters: JSON.parse(interviewSession.characters || '[]'),
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

    if (body.status === 'completed') {
      const shouldSend = await isNotificationEnabled(userId, 'sessionSummaryEmail')
      if (shouldSend) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true },
        })
        const analysis = await prisma.sessionAnalysis.findUnique({
          where: { sessionId: id },
          select: { hiringProbability: true, nextTargets: true },
        })
        const targets = (() => {
          try {
            const parsed = JSON.parse(analysis?.nextTargets || '[]')
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })()
        if (user?.email) {
          const topTargets = targets
            .slice(0, 3)
            .map((t: { title?: string }, idx: number) => `${idx + 1}. ${t?.title || 'Refine your answer quality'}`)
            .join('\n')
          void sendNotificationEmail({
            userId,
            type: 'session_summary',
            recipientEmail: user.email,
            subject: `Seatvio Session Summary — ${updated.application.companyName} ${updated.stage}`,
            body:
              `Great work completing your session, ${user.fullName || 'there'}.\n\n` +
              `Company: ${updated.application.companyName}\n` +
              `Role: ${updated.application.jobTitle}\n` +
              `Stage: ${updated.stage}\n` +
              `Hiring Probability: ${analysis?.hiringProbability ?? 'Pending'}\n\n` +
              `Top next targets:\n${topTargets || '1. Tighten specificity\n2. Improve confidence language\n3. Hold pauses under pressure'}`,
          })
        }
      }
    }

    return NextResponse.json({
      ...updated,
      characters: JSON.parse(updated.characters || '[]'),
    })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
