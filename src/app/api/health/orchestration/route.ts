import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { aiConfig } from '@/lib/ai/config'
import { aiHealthCheck, isAIServiceConfigured } from '@/lib/ai'

type CheckResult = {
  ok: boolean
  status?: number
  latencyMs?: number
  detail?: string
}

async function httpHealthCheck(url: string, timeoutMs = 3000): Promise<CheckResult> {
  const controller = new AbortController()
  const started = Date.now()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
      detail: res.ok ? 'ok' : `http_${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : 'unreachable',
    }
  } finally {
    clearTimeout(timer)
  }
}

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

  const relayHealthUrl = process.env.MEDIA_RELAY_HEALTH_URL
  const conductorHealthUrl =
    process.env.INTERVIEW_CONDUCTOR_HEALTH_URL ||
    (process.env.INTERVIEW_CONDUCTOR_URL
      ? `${process.env.INTERVIEW_CONDUCTOR_URL.replace(/\/$/, '')}/healthz`
      : '')
  const gpuHealthUrl = process.env.GPU_WORKERS_HEALTH_URL

  const [relay, conductor, gpuWorkers] = await Promise.all([
    relayHealthUrl ? httpHealthCheck(relayHealthUrl) : Promise.resolve({ ok: false, detail: 'not_configured' }),
    conductorHealthUrl ? httpHealthCheck(conductorHealthUrl) : Promise.resolve({ ok: false, detail: 'not_configured' }),
    gpuHealthUrl ? httpHealthCheck(gpuHealthUrl) : Promise.resolve({ ok: false, detail: 'not_configured' }),
  ])

  const phases = {
    phaseA_foundation: dbOk,
    phaseB_async_ai: dbOk && (ai.ok || !isAIServiceConfigured()),
    phaseC_audio_conversation: dbOk && conductor.ok && relay.ok,
    phaseD_level1_animation: dbOk && conductor.ok && relay.ok,
    phaseE_full_product_surface: dbOk && conductor.ok && relay.ok,
    phaseG_neural_gpu_ready: gpuWorkers.ok,
    phaseH_self_hosted_mode: aiConfig.sourceMode === 'modern' && conductor.ok && gpuWorkers.ok,
  }

  const overall =
    phases.phaseA_foundation &&
    phases.phaseB_async_ai &&
    phases.phaseC_audio_conversation

  return NextResponse.json(
    {
      status: overall ? 'ok' : 'degraded',
      response_time_ms: Date.now() - started,
      service_checks: {
        db: { ok: dbOk },
        ai_service: ai,
        media_relay: relay,
        interview_conductor: conductor,
        gpu_workers: gpuWorkers,
      },
      phase_readiness: phases,
      config: {
        ai_source_mode: aiConfig.sourceMode,
        relay_health_url_configured: Boolean(relayHealthUrl),
        conductor_health_url_configured: Boolean(conductorHealthUrl),
        gpu_health_url_configured: Boolean(gpuHealthUrl),
      },
    },
    { status: overall ? 200 : 503 }
  )
}
