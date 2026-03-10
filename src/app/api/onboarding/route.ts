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

    // Validate required fields
    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }
    if (!currentRole?.trim()) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }
    if (!yearsExperience) {
      return NextResponse.json({ error: 'Years of experience is required' }, { status: 400 })
    }
    if (!currentIndustry) {
      return NextResponse.json({ error: 'Current industry is required' }, { status: 400 })
    }
    if (!targetIndustry) {
      return NextResponse.json({ error: 'Target industry is required' }, { status: 400 })
    }
    if (!workArrangement) {
      return NextResponse.json({ error: 'Work arrangement is required' }, { status: 400 })
    }

    // Update user name and onboarded flag, and upsert profile in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          fullName: fullName.trim(),
          onboarded: true,
        },
      }),
      prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          currentRole: currentRole.trim(),
          yearsExperience,
          currentIndustry,
          targetIndustry,
          workArrangement,
          anxietyLevel: Number(anxietyLevel) || 5,
          interviewDifficulty: interviewDifficulty?.trim() || null,
          linkedinUrl: linkedinUrl?.trim() || null,
          portfolioUrl: portfolioUrl?.trim() || null,
        },
        update: {
          currentRole: currentRole.trim(),
          yearsExperience,
          currentIndustry,
          targetIndustry,
          workArrangement,
          anxietyLevel: Number(anxietyLevel) || 5,
          interviewDifficulty: interviewDifficulty?.trim() || null,
          linkedinUrl: linkedinUrl?.trim() || null,
          portfolioUrl: portfolioUrl?.trim() || null,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
