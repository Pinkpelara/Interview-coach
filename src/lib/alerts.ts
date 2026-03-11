import { logger } from './monitoring'

const lastAlertAt = new Map<string, number>()

function cooldownMs() {
  const raw = Number.parseInt(process.env.ALERT_COOLDOWN_MS || '300000', 10)
  return Number.isFinite(raw) ? raw : 300_000
}

export async function sendAlert(
  key: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const webhook = process.env.ALERT_WEBHOOK_URL
  if (!webhook) return false

  const now = Date.now()
  const last = lastAlertAt.get(key) || 0
  if (now - last < cooldownMs()) {
    return false
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'seatvio_alert',
        key,
        ts: new Date().toISOString(),
        ...payload,
      }),
    })

    if (!response.ok) {
      logger.warn('alert_webhook_failed', {
        key,
        status: response.status,
      })
      return false
    }

    lastAlertAt.set(key, now)
    logger.warn('alert_webhook_sent', { key })
    return true
  } catch (error) {
    logger.warn('alert_webhook_error', {
      key,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return false
  }
}
