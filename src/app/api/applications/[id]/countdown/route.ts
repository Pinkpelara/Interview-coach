import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectivePlan } from '@/lib/subscription'
import { checkFeature } from '@/lib/feature-gate'

function toJsonString(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value ?? [])
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
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

    const application = await prisma.application.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    })
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const countdownPlan = await prisma.countdownPlan.findUnique({
      where: { applicationId: application.id },
    })

    if (!countdownPlan) {
      return NextResponse.json({ countdownPlan: null })
    }

    return NextResponse.json({
      countdownPlan: {
        id: countdownPlan.id,
        applicationId: countdownPlan.applicationId,
        interviewDate: countdownPlan.interviewDate,
        planData: parseJson<unknown[]>(countdownPlan.planData) ?? [],
        createdAt: countdownPlan.createdAt,
        updatedAt: countdownPlan.updatedAt,
      },
    })
  } catch (error) {
    console.error('Countdown GET error:', error)
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

    const application = await prisma.application.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    })
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const plan = await getEffectivePlan(userId)
    const countdownGate = checkFeature(plan, 'countdown_plan')
    if (!countdownGate.allowed) {
      return NextResponse.json({ error: countdownGate.message }, { status: 403 })
    }

    const body = await request.json()
    const interviewDateRaw = body?.interviewDate
    if (!interviewDateRaw) {
      return NextResponse.json({ error: 'interviewDate is required.' }, { status: 400 })
    }
    const interviewDate = new Date(interviewDateRaw)
    if (Number.isNaN(interviewDate.getTime())) {
      return NextResponse.json({ error: 'interviewDate is invalid.' }, { status: 400 })
    }

    const planDataSerialized = toJsonString(body?.planData)
    const countdownPlan = await prisma.$transaction(async (tx) => {
      const planRow = await tx.countdownPlan.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          interviewDate,
          planData: planDataSerialized,
        },
        update: {
          interviewDate,
          planData: planDataSerialized,
        },
      })

      await tx.application.update({
        where: { id: application.id },
        data: { realInterviewDate: interviewDate },
      })

      return planRow
    })

    return NextResponse.json({
      countdownPlan: {
        id: countdownPlan.id,
        applicationId: countdownPlan.applicationId,
        interviewDate: countdownPlan.interviewDate,
        planData: parseJson<unknown[]>(countdownPlan.planData) ?? [],
        createdAt: countdownPlan.createdAt,
        updatedAt: countdownPlan.updatedAt,
      },
    })
  } catch (error) {
    console.error('Countdown PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
