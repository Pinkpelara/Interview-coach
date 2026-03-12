import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        onboardingDone: true,
        profile: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      onboardingDone: user.onboardingDone,
      ...(user.profile ?? {}),
    })
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()

    const {
      fullName,
      currentRole,
      yearsExperience,
      currentIndustry,
      targetIndustry,
      workArrangement,
      anxietyLevel,
      interviewDifficulty,
      linkedinUrl,
      portfolioUrl,
    } = body

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(fullName !== undefined && { fullName: fullName.trim() }),
        },
      }),
      prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          currentRole: currentRole?.trim() || null,
          yearsExperience: yearsExperience || null,
          currentIndustry: currentIndustry || null,
          targetIndustry: targetIndustry || null,
          workArrangement: workArrangement || null,
          anxietyLevel: anxietyLevel != null ? Number(anxietyLevel) : null,
          interviewDifficulty: interviewDifficulty?.trim() || null,
          linkedinUrl: linkedinUrl?.trim() || null,
          portfolioUrl: portfolioUrl?.trim() || null,
        },
        update: {
          ...(currentRole !== undefined && { currentRole: currentRole?.trim() || null }),
          ...(yearsExperience !== undefined && { yearsExperience }),
          ...(currentIndustry !== undefined && { currentIndustry }),
          ...(targetIndustry !== undefined && { targetIndustry }),
          ...(workArrangement !== undefined && { workArrangement }),
          ...(anxietyLevel !== undefined && { anxietyLevel: Number(anxietyLevel) }),
          ...(interviewDifficulty !== undefined && { interviewDifficulty: interviewDifficulty?.trim() || null }),
          ...(linkedinUrl !== undefined && { linkedinUrl: linkedinUrl?.trim() || null }),
          ...(portfolioUrl !== undefined && { portfolioUrl: portfolioUrl?.trim() || null }),
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Profile PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
