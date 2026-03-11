import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getEffectivePlan } from '@/lib/subscription'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscription: true,
        notificationPreferences: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const effectivePlan = await getEffectivePlan(userId)

    return NextResponse.json({
      fullName: user.fullName,
      email: user.email,
      currentRole: user.profile?.currentRole || '',
      currentIndustry: user.profile?.currentIndustry || '',
      yearsExperience: user.profile?.yearsExperience || '',
      anxietyLevel: user.profile?.anxietyLevel ?? 5,
      plan: effectivePlan,
      notifications: {
        sessionSummaries: user.notificationPreferences?.sessionSummaryEmail ?? true,
        dailyReminders: user.notificationPreferences?.dailyCountdownEmail ?? false,
        weeklyProgress: user.notificationPreferences?.weeklyProgressEmail ?? true,
        reEngagement: user.notificationPreferences?.reengagementEmail ?? true,
        interviewMorning: user.notificationPreferences?.interviewMorningEmail ?? true,
      },
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

    if (body.section === 'profile') {
      const { fullName, currentRole, currentIndustry, yearsExperience, anxietyLevel } = body

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { fullName: fullName?.trim() || undefined },
        }),
        prisma.userProfile.upsert({
          where: { userId },
          create: {
            userId,
            currentRole: currentRole?.trim() || null,
            currentIndustry: currentIndustry || null,
            yearsExperience: yearsExperience || null,
            anxietyLevel: Number(anxietyLevel) || 5,
          },
          update: {
            currentRole: currentRole?.trim() || null,
            currentIndustry: currentIndustry || null,
            yearsExperience: yearsExperience || null,
            anxietyLevel: Number(anxietyLevel) || 5,
          },
        }),
      ])

      return NextResponse.json({ success: true })
    }

    if (body.section === 'password') {
      const { currentPassword, newPassword } = body

      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Both passwords are required' }, { status: 400 })
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      })

      return NextResponse.json({ success: true })
    }

    if (body.section === 'notifications') {
      const notifications = body.notifications || {}
      await prisma.notificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          sessionSummaryEmail: Boolean(notifications.sessionSummaries ?? true),
          dailyCountdownEmail: Boolean(notifications.dailyReminders ?? false),
          weeklyProgressEmail: Boolean(notifications.weeklyProgress ?? true),
          reengagementEmail: Boolean(notifications.reEngagement ?? true),
          interviewMorningEmail: Boolean(notifications.interviewMorning ?? true),
        },
        update: {
          sessionSummaryEmail: Boolean(notifications.sessionSummaries ?? true),
          dailyCountdownEmail: Boolean(notifications.dailyReminders ?? false),
          weeklyProgressEmail: Boolean(notifications.weeklyProgress ?? true),
          reengagementEmail: Boolean(notifications.reEngagement ?? true),
          interviewMorningEmail: Boolean(notifications.interviewMorning ?? true),
        },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
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

    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
