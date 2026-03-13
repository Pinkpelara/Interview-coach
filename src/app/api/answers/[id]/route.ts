import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

    const existing = await prisma.userAnswer.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 })
    }

    const { answerText, confidenceRating, status, isFavorite } = body

    const validStatuses = ['drafting', 'rehearsing', 'ready']
    const updateData: Record<string, unknown> = {}

    if (answerText !== undefined) {
      updateData.answerText = answerText.trim()
    }
    if (confidenceRating !== undefined) {
      updateData.confidenceRating = Math.max(0, Math.min(5, Number(confidenceRating)))
    }
    if (status !== undefined && validStatuses.includes(status)) {
      updateData.status = status
      if ((status === 'rehearsing' || status === 'ready') && status !== existing.status) {
        updateData.practiceCount = existing.practiceCount + 1
      }
    }
    if (isFavorite !== undefined) {
      updateData.isFavorite = Boolean(isFavorite)
    }

    const updated = await prisma.userAnswer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating answer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
