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
    const sessionId = params.id

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, status: true },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const analysis = await prisma.sessionAnalysis.findUnique({
      where: { sessionId },
    })

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not yet available. Complete the session first.' },
        { status: 404 }
      )
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error fetching analysis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
