import { prisma } from '@/lib/prisma'

type NotificationType =
  | 'welcome'
  | 'session_summary'
  | 'daily_countdown'
  | 'weekly_progress'
  | 'reengagement'
  | 'interview_morning'

type SendNotificationInput = {
  userId: string
  type: NotificationType
  recipientEmail: string
  subject: string
  body: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function deliverEmail(recipient: string, subject: string, body: string) {
  const webhook = process.env.NOTIFICATION_EMAIL_WEBHOOK_URL
  if (!webhook) {
    console.info('[notification:email]', { recipient, subject, bodyPreview: body.slice(0, 160) })
    return { delivered: true, provider: 'log' as const }
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: recipient,
      subject,
      text: body,
      html: `<p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>`,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Notification webhook failed: ${response.status} ${text.slice(0, 200)}`)
  }

  return { delivered: true, provider: 'webhook' as const }
}

export async function isNotificationEnabled(
  userId: string,
  key:
    | 'welcomeEmail'
    | 'sessionSummaryEmail'
    | 'dailyCountdownEmail'
    | 'weeklyProgressEmail'
    | 'reengagementEmail'
    | 'interviewMorningEmail'
) {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  })
  if (!prefs) {
    return true
  }
  return Boolean(prefs[key] ?? true)
}

export async function sendNotificationEmail(input: SendNotificationInput) {
  const event = await prisma.notificationEvent.create({
    data: {
      userId: input.userId,
      type: input.type,
      recipient: input.recipientEmail,
      subject: input.subject,
      payload: JSON.stringify({ body: input.body }),
      status: 'queued',
    },
  })

  try {
    await deliverEmail(input.recipientEmail, input.subject, input.body)
    await prisma.notificationEvent.update({
      where: { id: event.id },
      data: { status: 'sent', sentAt: new Date() },
    })
  } catch (error) {
    await prisma.notificationEvent.update({
      where: { id: event.id },
      data: { status: 'failed' },
    })
    console.error('Notification send failed:', error)
  }
}
