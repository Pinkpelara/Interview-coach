import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletionJSONValidated, isAIServiceConfigured } from '@/lib/ai'
import { ApplicationAlignmentSchema } from '@/lib/ai/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildDeterministicApplicationAnalysis } from '@/lib/application-analysis'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const applications = await prisma.application.findMany({
      where: { userId },
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(applications)
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboarded: true },
    })
    if (!user?.onboarded) {
      return NextResponse.json(
        { error: 'Complete onboarding before creating applications.' },
        { status: 403 }
      )
    }
    const limiter = await checkRateLimit(`applications:create:${userId}`, 20, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many create requests. Please retry shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }

    const body = await request.json()

    const { companyName, jobTitle, jdText, resumeText, interviewStage } = body

    // Validate required fields
    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }
    if (!jobTitle?.trim()) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }
    if (!jdText?.trim()) {
      return NextResponse.json({ error: 'Job description text is required' }, { status: 400 })
    }
    if (!resumeText?.trim()) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 })
    }

    // Deterministic baseline analysis for reliability (no random placeholders).
    const deterministic = buildDeterministicApplicationAnalysis({
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      resumeText: resumeText.trim(),
      jdText: jdText.trim(),
    })

    let alignmentScore = deterministic.alignmentScore
    let skillGaps = JSON.stringify(deterministic.skillGaps)
    let strengths = JSON.stringify(deterministic.strengths)
    let missingKeywords = JSON.stringify(deterministic.missingKeywords)
    let probeAreas = JSON.stringify(deterministic.probeAreas)

    if (isAIServiceConfigured()) {
      try {
        const analysis = await chatCompletionJSONValidated(
          'You are an expert career coach analyzing a resume against a job description. Be specific and accurate.',
          `Analyze this resume against the job description and return JSON:

Resume (first 1500 chars): ${resumeText.trim().slice(0, 1500)}

Job Description (first 1500 chars): ${jdText.trim().slice(0, 1500)}

Return:
- alignmentScore: 0-100 how well the resume matches the JD
- skillGaps: array of 3-5 skills the JD requires that are missing/weak in the resume
- strengths: array of 3-5 strengths from the resume that match the JD
- missingKeywords: array of 4-6 important keywords from the JD not found in the resume
- probeAreas: array of 3-5 topics interviewers will likely probe based on gaps`,
          ApplicationAlignmentSchema,
          { temperature: 0.3 }
        )

        alignmentScore = Math.min(100, Math.max(0, analysis.alignmentScore))
        skillGaps = JSON.stringify(analysis.skillGaps)
        strengths = JSON.stringify(analysis.strengths)
        missingKeywords = JSON.stringify(analysis.missingKeywords)
        probeAreas = JSON.stringify(analysis.probeAreas)
      } catch (aiError) {
        console.error('AI analysis failed, using deterministic baseline:', aiError)
      }
    }

    // Create application with parsed data in a transaction
    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          userId,
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim(),
          jdText: jdText.trim(),
          resumeText: resumeText.trim(),
          interviewStage: interviewStage?.trim() || 'Applied',
          alignmentScore,
          skillGaps,
          strengths,
          missingKeywords,
          probeAreas,
          readinessScore: deterministic.readinessScore,
        },
      })

      await tx.parsedResume.create({
        data: {
          applicationId: app.id,
          topSkills: deterministic.parsedResume.topSkills.join(', '),
          careerTimeline: deterministic.parsedResume.careerTimeline,
          experienceGaps: JSON.stringify(deterministic.parsedResume.experienceGaps),
          achievements: JSON.stringify(deterministic.parsedResume.achievements),
          education: deterministic.parsedResume.education,
        },
      })

      await tx.parsedJD.create({
        data: {
          applicationId: app.id,
          requiredSkills: JSON.stringify(deterministic.parsedJD.requiredSkills),
          preferredSkills: JSON.stringify(deterministic.parsedJD.preferredSkills),
          responsibilities: JSON.stringify(deterministic.parsedJD.responsibilities),
          seniorityLevel: deterministic.parsedJD.seniorityLevel,
          valuesLanguage: JSON.stringify(deterministic.parsedJD.valuesLanguage),
          redFlagAreas: JSON.stringify(deterministic.parsedJD.redFlagAreas),
          interviewFormatPrediction: deterministic.parsedJD.interviewFormatPrediction,
        },
      })

      // Re-fetch with relations
      return tx.application.findUnique({
        where: { id: app.id },
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

    return NextResponse.json(application, { status: 201 })
  } catch (error) {
    console.error('Error creating application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
