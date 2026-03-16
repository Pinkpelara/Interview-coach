import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isNotificationEnabled, sendNotificationEmail } from '@/lib/notifications'

function daysUntil(date: Date) {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = process.env.NOTIFICATION_DISPATCH_TOKEN
  if (!expected) {
    return NextResponse.json(
      { error: 'Notification dispatcher is not configured.' },
      { status: 500 }
    )
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      applications: {
        where: {
          status: 'active',
          realInterviewDate: { not: null },
        },
        select: {
          id: true,
          companyName: true,
          jobTitle: true,
          realInterviewDate: true,
        },
      },
    },
  })

  let sent = 0
  for (const user of users) {
    for (const app of user.applications) {
      if (!app.realInterviewDate) continue
      const d = daysUntil(app.realInterviewDate)
      if (d < 0) continue

      if (d === 0) {
        const enabled = await isNotificationEnabled(user.id, 'interviewMorningEmail')
        if (enabled) {
          await sendNotificationEmail({
            userId: user.id,
            type: 'interview_morning',
            recipientEmail: user.email,
            subject: `Interview day reminder — ${app.companyName}`,
            body:
              `Today is your interview for ${app.jobTitle} at ${app.companyName}.\n\n` +
              `Quick reset:\n` +
              `- Lead with ownership\n- Use one measurable outcome per core answer\n- Hold pauses confidently`,
          })
          sent += 1
        }
      } else {
        const dailyEnabled = await isNotificationEnabled(user.id, 'dailyCountdownEmail')
        if (dailyEnabled) {
          await sendNotificationEmail({
            userId: user.id,
            type: 'daily_countdown',
            recipientEmail: user.email,
            subject: `Seatvio countdown: ${d} day${d === 1 ? '' : 's'} left`,
            body:
              `You have ${d} day${d === 1 ? '' : 's'} until your interview for ${app.jobTitle} at ${app.companyName}.\n` +
              `Run today's recommended practice from Interview Countdown Mode.`,
          })
          sent += 1
        }
      }
    }
  }

  // Weekly summary and re-engagement run on fixed weekdays.
  if (today.getDay() === 1) {
    const weeklyUsers = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true },
    })
    for (const user of weeklyUsers) {
      const weeklyEnabled = await isNotificationEnabled(user.id, 'weeklyProgressEmail')
      if (!weeklyEnabled) continue
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const sessions = await prisma.interviewSession.count({
        where: { userId: user.id, createdAt: { gte: weekAgo } },
      })
      await sendNotificationEmail({
        userId: user.id,
        type: 'weekly_progress',
        recipientEmail: user.email,
        subject: 'Your Seatvio weekly progress summary',
        body: `In the last 7 days you completed ${sessions} practice session${sessions === 1 ? '' : 's'}. Keep the momentum.`,
      })
      sent += 1
    }
  }

  // Re-engagement reminder: interview scheduled and no practice in 5+ days.
  for (const user of users) {
    const hasUpcomingInterview = user.applications.some((app) => {
      if (!app.realInterviewDate) return false
      const d = daysUntil(app.realInterviewDate)
      return d >= 0
    })
    if (!hasUpcomingInterview) continue

    const reengagementEnabled = await isNotificationEnabled(user.id, 'reengagementEmail')
    if (!reengagementEnabled) continue

    const lastSession = await prisma.interviewSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    const isStale =
      !lastSession ||
      Date.now() - lastSession.createdAt.getTime() >= 5 * 24 * 60 * 60 * 1000

    if (!isStale) continue

    await sendNotificationEmail({
      userId: user.id,
      type: 'reengagement',
      recipientEmail: user.email,
      subject: 'Seatvio reminder: keep momentum before interview day',
      body:
        'You have an upcoming interview and it has been 5+ days since your last practice session.\n' +
        'Run one 20-minute simulation today to keep your interview rhythm sharp.',
    })
    sent += 1
  }

  return NextResponse.json({ ok: true, sent })
}
