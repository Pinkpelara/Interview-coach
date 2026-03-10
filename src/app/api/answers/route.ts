import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()

    const { questionId, answerText, confidenceRating, status } = body

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    if (!answerText?.trim()) {
      return NextResponse.json({ error: 'answerText is required' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['drafting', 'rehearsing', 'ready']
    const answerStatus = status && validStatuses.includes(status) ? status : 'drafting'

    // Validate confidence rating
    const confidence = typeof confidenceRating === 'number'
      ? Math.max(0, Math.min(5, confidenceRating))
      : 0

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

    // Check for existing answer
    const existingAnswer = await prisma.userAnswer.findFirst({
      where: {
        questionId,
        userId,
      },
    })

    let userAnswer

    if (existingAnswer) {
      // Update existing answer
      userAnswer = await prisma.userAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          answerText: answerText.trim(),
          confidenceRating: confidence,
          status: answerStatus,
          practiceCount: answerStatus === 'rehearsing' || answerStatus === 'ready'
            ? existingAnswer.practiceCount + 1
            : existingAnswer.practiceCount,
        },
      })
    } else {
      // Create new answer
      userAnswer = await prisma.userAnswer.create({
        data: {
          questionId,
          userId,
          answerText: answerText.trim(),
          confidenceRating: confidence,
          status: answerStatus,
        },
      })
    }

    return NextResponse.json(userAnswer, { status: existingAnswer ? 200 : 201 })
  } catch (error) {
    console.error('Error saving answer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
