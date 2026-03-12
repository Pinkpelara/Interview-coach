import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string; type: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id: sessionId, type: runType } = params

    if (runType !== 'perfect' && runType !== 'cautionary') {
      return NextResponse.json(
        { error: 'Type must be "perfect" or "cautionary"' },
        { status: 400 }
      )
    }

    // Verify session ownership
    const sourceSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    })

    if (!sourceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const observeSession = await prisma.observeSession.findFirst({
      where: {
        sourceSessionId: sessionId,
        runType,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!observeSession) {
      return NextResponse.json(
        { error: `No ${runType} observe session found. Trigger one first via POST.` },
        { status: 404 }
      )
    }

    return NextResponse.json(observeSession)
  } catch (error) {
    console.error('Observe type GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
