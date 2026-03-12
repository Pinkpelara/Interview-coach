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
    const { id } = params

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        parsedResume: true,
        parsedJD: true,
        alignmentAnalysis: true,
        questions: {
          orderBy: { sortOrder: 'asc' },
        },
        sessions: {
          include: {
            analysis: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        countdownPlans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            questions: true,
            sessions: true,
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (application.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error fetching application:', error)
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

    const existing = await prisma.application.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      companyName,
      jobTitle,
      jdText,
      resumeText,
      interviewStage,
      realInterviewDate,
      status,
    } = body

    const application = await prisma.application.update({
      where: { id },
      data: {
        ...(companyName !== undefined && { companyName: companyName.trim() }),
        ...(jobTitle !== undefined && { jobTitle: jobTitle.trim() }),
        ...(jdText !== undefined && { jdText: jdText.trim() }),
        ...(resumeText !== undefined && { resumeText: resumeText.trim() }),
        ...(interviewStage !== undefined && { interviewStage: interviewStage.trim() }),
        ...(realInterviewDate !== undefined && {
          realInterviewDate: realInterviewDate ? new Date(realInterviewDate) : null,
        }),
        ...(status !== undefined && { status }),
      },
      include: {
        parsedResume: true,
        parsedJD: true,
        alignmentAnalysis: true,
        _count: {
          select: {
            questions: true,
            sessions: true,
          },
        },
      },
    })

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const existing = await prisma.application.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.application.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
