import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { aiHealthCheck, isAIServiceConfigured } from '@/lib/ai'
import { metricSnapshot } from '@/lib/monitoring'
import { sendAlert } from '@/lib/alerts'
import { aiConfig } from '@/lib/ai/config'

export async function GET() {
  const started = Date.now()

  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }

  const ai = await aiHealthCheck()
  const chatLatency = metricSnapshot('ai.chat.latency_ms', 60_000)
  const ttsLatency = metricSnapshot('ai.tts.latency_ms', 60_000)
  const ok = dbOk && (ai.ok || !isAIServiceConfigured())

  if (!ok) {
    await sendAlert('health_degraded', {
      db_ok: dbOk,
      ai_ok: ai.ok,
      ai_detail: ai,
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
        ai: ai.ok ? 'ok' : isAIServiceConfigured() ? 'fail' : 'not_configured',
      },
      ai_source_mode: aiConfig.sourceMode,
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
