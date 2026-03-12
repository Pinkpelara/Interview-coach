import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletionJSON, isAIConfigured } from '@/lib/ai-gateway'

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
      select: { userId: true },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (application.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const plans = await prisma.countdownPlan.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching countdown plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const { id } = params
    const body = await request.json()
    const { interviewDate } = body

    if (!interviewDate) {
      return NextResponse.json({ error: 'interviewDate is required' }, { status: 400 })
    }

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        alignmentAnalysis: true,
      },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (application.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetDate = new Date(interviewDate)
    const now = new Date()
    const daysUntil = Math.max(1, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    let planData: unknown

    if (isAIConfigured()) {
      try {
        planData = await chatCompletionJSON(
          'You are an interview preparation coach. Create a day-by-day countdown plan.',
          `Create a countdown plan for an interview at ${application.companyName} for the ${application.jobTitle} role in ${daysUntil} days.

Return JSON with:
- days: array of objects with { day: number, focus: string, tasks: string[], tips: string }

Create a plan for each day from ${daysUntil} down to 1 (interview day). Focus on progressive preparation.`,
          { temperature: 0.7, taskType: 'question_generation', maxTokens: 2000 }
        )
      } catch (aiError) {
        console.error('AI countdown generation failed, using fallback:', aiError)
        planData = generateFallbackPlan(daysUntil)
      }
    } else {
      planData = generateFallbackPlan(daysUntil)
    }

    // Update application's real interview date
    await prisma.application.update({
      where: { id },
      data: { realInterviewDate: targetDate },
    })

    const plan = await prisma.countdownPlan.create({
      data: {
        applicationId: id,
        interviewDate: targetDate,
        planData: planData as object,
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Error creating countdown plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateFallbackPlan(daysUntil: number) {
  const days = []
  for (let d = daysUntil; d >= 1; d--) {
    if (d === daysUntil) {
      days.push({ day: d, focus: 'Foundation', tasks: ['Review job description thoroughly', 'Update resume alignment', 'Research company recent news'], tips: 'Start broad, narrow down as the interview approaches.' })
    } else if (d === 1) {
      days.push({ day: d, focus: 'Interview Day', tasks: ['Light review of key talking points', 'Prepare questions for interviewer', 'Rest and stay confident'], tips: 'Trust your preparation. Be authentic.' })
    } else if (d <= 3) {
      days.push({ day: d, focus: 'Final Polish', tasks: ['Mock interview session', 'Review weak areas', 'Practice opening and closing'], tips: 'Focus on delivery, not new content.' })
    } else {
      days.push({ day: d, focus: 'Deep Practice', tasks: ['Answer 5 practice questions', 'Record and review answers', 'Study company culture'], tips: 'Quality over quantity in practice sessions.' })
    }
  }
  return { days }
}
