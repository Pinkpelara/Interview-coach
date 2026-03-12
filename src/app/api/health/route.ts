import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAIConfigured } from '@/lib/ai-gateway'
import { metricSnapshot } from '@/lib/monitoring'
import { sendAlert } from '@/lib/alerts'

export async function GET() {
  const started = Date.now()
  const dedicatedTTSConfigured = Boolean(
    process.env.KOKORO_TTS_URL || process.env.TTS_SERVICE_URL || process.env.TTS_URL
  )

  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }

  const aiOk = isAIConfigured()
  const chatLatency = metricSnapshot('ai.chat.latency_ms', 60_000)
  const ttsLatency = metricSnapshot('ai.tts.latency_ms', 60_000)
  const ok = dbOk && aiOk

  if (!ok) {
    await sendAlert('health_degraded', {
      db_ok: dbOk,
      ai_ok: aiOk,
      metrics: {
        ai_chat_count: chatLatency.count,
        ai_tts_count: ttsLatency.count,
      },
    })
  }

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      uptime_ms: process.uptime() * 1000,
      checks: {
        db: dbOk ? 'ok' : 'fail',
        ai: aiOk ? 'ok' : 'not_configured',
        tts: dedicatedTTSConfigured ? 'dedicated_service_configured' : 'ai_provider_or_browser_fallback',
      },
      ai_source_mode: 'openrouter',
      metrics_60s: {
        ai_chat_count: chatLatency.count,
        ai_chat_avg_latency_ms: Math.round(chatLatency.avg),
        ai_tts_count: ttsLatency.count,
        ai_tts_avg_latency_ms: Math.round(ttsLatency.avg),
      },
      response_time_ms: Date.now() - started,
    },
    { status: ok ? 200 : 503 }
  )
}
