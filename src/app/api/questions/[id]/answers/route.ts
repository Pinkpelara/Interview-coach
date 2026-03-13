import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const questionId = params.id
    const body = await request.json()

    const { answerText, confidenceRating, status } = body

    if (!answerText?.trim()) {
      return NextResponse.json({ error: 'answerText is required' }, { status: 400 })
    }

    // Verify the question exists and belongs to an application owned by the user
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        application: { userId },
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const validStatuses = ['drafting', 'rehearsing', 'ready']
    const answerStatus = status && validStatuses.includes(status) ? status : 'drafting'
    const confidence = typeof confidenceRating === 'number'
      ? Math.max(0, Math.min(5, confidenceRating))
      : 0

    const userAnswer = await prisma.userAnswer.create({
      data: {
        questionId,
        userId,
        answerText: answerText.trim(),
        confidenceRating: confidence,
        status: answerStatus,
      },
    })

    return NextResponse.json(userAnswer, { status: 201 })
  } catch (error) {
    console.error('Error creating answer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    const questionId = params.id

    // Verify question ownership
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        application: { userId },
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const answers = await prisma.userAnswer.findMany({
      where: { questionId, userId },
      include: {
        feedbacks: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(answers)
  } catch (error) {
    console.error('Error fetching answers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
