import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

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
      include: { profile: true, subscription: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      fullName: user.fullName,
      email: user.email,
      profile: user.profile,
      plan: user.subscription?.plan || 'free',
    })
  } catch (error) {
    console.error('Settings GET error:', error)
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

    // Password change
    if (body.currentPassword && body.newPassword) {
      if (body.newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      })
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash)
      if (!isValid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(body.newPassword, 12) },
      })
      return NextResponse.json({ success: true })
    }

    // Profile update
    const { fullName, currentRole, yearsExperience, currentIndustry, targetIndustry, workArrangement, linkedinUrl, portfolioUrl } = body

    if (fullName) {
      await prisma.user.update({
        where: { id: userId },
        data: { fullName: fullName.trim() },
      })
    }

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        currentRole: currentRole || null,
        yearsExperience: yearsExperience || null,
        currentIndustry: currentIndustry || null,
        targetIndustry: targetIndustry || null,
        workArrangement: workArrangement || null,
        linkedinUrl: linkedinUrl || null,
        portfolioUrl: portfolioUrl || null,
      },
      update: {
        currentRole: currentRole || null,
        yearsExperience: yearsExperience || null,
        currentIndustry: currentIndustry || null,
        targetIndustry: targetIndustry || null,
        workArrangement: workArrangement || null,
        linkedinUrl: linkedinUrl || null,
        portfolioUrl: portfolioUrl || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
