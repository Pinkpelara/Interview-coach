import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

    return NextResponse.json(interviewSession)
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
        if (existing.startedAt) {
          updateData.actualDurationMs = BigInt(Date.now() - existing.startedAt.getTime())
        }
      }
    }

    if (body.unexpectedEvents !== undefined) {
      updateData.unexpectedEvents = body.unexpectedEvents
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
