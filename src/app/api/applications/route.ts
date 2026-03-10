import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Generate placeholder alignment score (random 60-85)
    const alignmentScore = Math.floor(Math.random() * 26) + 60

    // Generate placeholder analysis data
    const skillGaps = JSON.stringify([
      'System Design',
      'Cloud Architecture',
      'CI/CD Pipeline Management',
    ])
    const strengths = JSON.stringify([
      'Problem Solving',
      'Team Leadership',
      'Agile Methodology',
      'Technical Communication',
    ])
    const missingKeywords = JSON.stringify([
      'Kubernetes',
      'Terraform',
      'GraphQL',
      'Event-Driven Architecture',
      'SLA Management',
    ])
    const probeAreas = JSON.stringify([
      'Experience scaling distributed systems',
      'Handling production incidents under pressure',
      'Cross-team collaboration on technical decisions',
      'Approach to technical debt prioritization',
    ])

    // Create application with parsed data in a transaction
    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          userId,
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim(),
          jdText: jdText.trim(),
          resumeText: resumeText.trim(),
          interviewStage: interviewStage?.trim() || 'screening',
          alignmentScore,
          skillGaps,
          strengths,
          missingKeywords,
          probeAreas,
          readinessScore: Math.floor(Math.random() * 20) + 10,
        },
      })

      // Create ParsedResume with placeholder data extracted from resumeText
      await tx.parsedResume.create({
        data: {
          applicationId: app.id,
          topSkills: 'Extracted from resume',
          careerTimeline: 'Parsed career history',
          experienceGaps: JSON.stringify(['Potential gap between 2019-2020']),
          achievements: JSON.stringify([
            'Led team of 8 engineers',
            'Improved system performance by 40%',
          ]),
          education: 'Extracted education background',
        },
      })

      // Create ParsedJD with placeholder data extracted from jdText
      await tx.parsedJD.create({
        data: {
          applicationId: app.id,
          requiredSkills: JSON.stringify([
            'JavaScript',
            'TypeScript',
            'React',
            'Node.js',
          ]),
          preferredSkills: JSON.stringify([
            'AWS',
            'Docker',
            'Kubernetes',
          ]),
          responsibilities: JSON.stringify([
            'Design and implement scalable solutions',
            'Mentor junior developers',
            'Participate in architecture reviews',
          ]),
          seniorityLevel: 'mid',
          valuesLanguage: JSON.stringify([
            'Innovation',
            'Collaboration',
            'Growth mindset',
          ]),
          redFlagAreas: JSON.stringify([
            'Limited experience with their tech stack',
          ]),
          interviewFormatPrediction: 'Technical screen + System design + Behavioral',
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
