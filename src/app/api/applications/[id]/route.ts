import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildDeterministicApplicationAnalysis } from '@/lib/application-analysis'
import { getEffectivePlan } from '@/lib/subscription'
import { checkFeature } from '@/lib/feature-gate'

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
        questions: {
          orderBy: { createdAt: 'desc' },
        },
        sessions: {
          include: {
            analysis: true,
          },
          orderBy: { createdAt: 'desc' },
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

    // Verify ownership
    const existing = await prisma.application.findUnique({
      where: { id },
      select: {
        userId: true,
        companyName: true,
        jobTitle: true,
        jdText: true,
        resumeText: true,
      },
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

    if (realInterviewDate !== undefined && realInterviewDate) {
      const plan = await getEffectivePlan(userId)
      const countdownGate = checkFeature(plan, 'countdown_plan')
      if (!countdownGate.allowed) {
        return NextResponse.json({ error: countdownGate.message }, { status: 403 })
      }
    }

    const nextCompanyName = companyName !== undefined ? companyName.trim() : existing.companyName
    const nextJobTitle = jobTitle !== undefined ? jobTitle.trim() : existing.jobTitle
    const nextJDText = jdText !== undefined ? jdText.trim() : existing.jdText
    const nextResumeText = resumeText !== undefined ? resumeText.trim() : existing.resumeText

    const changedCoreInputs =
      companyName !== undefined ||
      jobTitle !== undefined ||
      jdText !== undefined ||
      resumeText !== undefined

    const analysis = changedCoreInputs
      ? buildDeterministicApplicationAnalysis({
          companyName: nextCompanyName,
          jobTitle: nextJobTitle,
          jdText: nextJDText,
          resumeText: nextResumeText,
        })
      : null

    const application = await prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id },
        data: {
          ...(companyName !== undefined && { companyName: nextCompanyName }),
          ...(jobTitle !== undefined && { jobTitle: nextJobTitle }),
          ...(jdText !== undefined && { jdText: nextJDText }),
          ...(resumeText !== undefined && { resumeText: nextResumeText }),
          ...(interviewStage !== undefined && { interviewStage: interviewStage.trim() }),
          ...(realInterviewDate !== undefined && {
            realInterviewDate: realInterviewDate ? new Date(realInterviewDate) : null,
          }),
          ...(status !== undefined && { status }),
          ...(analysis && {
            alignmentScore: analysis.alignmentScore,
            skillGaps: JSON.stringify(analysis.skillGaps),
            strengths: JSON.stringify(analysis.strengths),
            missingKeywords: JSON.stringify(analysis.missingKeywords),
            probeAreas: JSON.stringify(analysis.probeAreas),
          }),
        },
      })

      if (analysis) {
        await tx.parsedResume.upsert({
          where: { applicationId: id },
          update: {
            topSkills: analysis.parsedResume.topSkills.join(', '),
            careerTimeline: analysis.parsedResume.careerTimeline,
            experienceGaps: JSON.stringify(analysis.parsedResume.experienceGaps),
            achievements: JSON.stringify(analysis.parsedResume.achievements),
            education: analysis.parsedResume.education,
          },
          create: {
            applicationId: id,
            topSkills: analysis.parsedResume.topSkills.join(', '),
            careerTimeline: analysis.parsedResume.careerTimeline,
            experienceGaps: JSON.stringify(analysis.parsedResume.experienceGaps),
            achievements: JSON.stringify(analysis.parsedResume.achievements),
            education: analysis.parsedResume.education,
          },
        })

        await tx.parsedJD.upsert({
          where: { applicationId: id },
          update: {
            requiredSkills: JSON.stringify(analysis.parsedJD.requiredSkills),
            preferredSkills: JSON.stringify(analysis.parsedJD.preferredSkills),
            responsibilities: JSON.stringify(analysis.parsedJD.responsibilities),
            seniorityLevel: analysis.parsedJD.seniorityLevel,
            valuesLanguage: JSON.stringify(analysis.parsedJD.valuesLanguage),
            redFlagAreas: JSON.stringify(analysis.parsedJD.redFlagAreas),
            interviewFormatPrediction: analysis.parsedJD.interviewFormatPrediction,
          },
          create: {
            applicationId: id,
            requiredSkills: JSON.stringify(analysis.parsedJD.requiredSkills),
            preferredSkills: JSON.stringify(analysis.parsedJD.preferredSkills),
            responsibilities: JSON.stringify(analysis.parsedJD.responsibilities),
            seniorityLevel: analysis.parsedJD.seniorityLevel,
            valuesLanguage: JSON.stringify(analysis.parsedJD.valuesLanguage),
            redFlagAreas: JSON.stringify(analysis.parsedJD.redFlagAreas),
            interviewFormatPrediction: analysis.parsedJD.interviewFormatPrediction,
          },
        })
      }

      return tx.application.findUnique({
        where: { id: updated.id },
        include: {
          parsedResume: true,
          parsedJD: true,
          _count: {
            select: {
              questions: true,
              sessions: true,
            },
          },
        },
      })
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

    // Verify ownership
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
