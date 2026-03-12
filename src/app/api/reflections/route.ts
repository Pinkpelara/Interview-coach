import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(request.url)
  const applicationId = searchParams.get('applicationId')
  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
  }

  const reflections = await prisma.interviewReflection.findMany({
    where: { userId, applicationId },
    orderBy: { interviewDate: 'desc' },
  })
  return NextResponse.json(reflections)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as { id: string }).id
  const limiter = await checkRateLimit(`reflection:create:${userId}`, 20, 60_000)
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'Too many reflection submissions. Retry shortly.' }, { status: 429 })
  }

  const body = await request.json()
  const {
    applicationId,
    interviewDate,
    outcome,
    selfRating,
    actualQuestions,
    whatWentWell,
    whatToImprove,
    notes,
  } = body

  if (!applicationId || !interviewDate) {
    return NextResponse.json({ error: 'applicationId and interviewDate are required' }, { status: 400 })
  }

  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, strengths: true, probeAreas: true },
  })
  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const reflection = await prisma.interviewReflection.create({
    data: {
      userId,
      applicationId,
      interviewDate: new Date(interviewDate),
      outcome: typeof outcome === 'string' ? outcome : null,
      selfRating: Number.isFinite(Number(selfRating)) ? Number(selfRating) : null,
      actualQuestions: JSON.stringify(Array.isArray(actualQuestions) ? actualQuestions : []),
      whatWentWell: typeof whatWentWell === 'string' ? whatWentWell : null,
      whatToImprove: typeof whatToImprove === 'string' ? whatToImprove : null,
      notes: typeof notes === 'string' ? notes : null,
      predictedStrengths: app.strengths || null,
      predictedRisks: app.probeAreas || null,
    },
  })

  return NextResponse.json(reflection, { status: 201 })
}
