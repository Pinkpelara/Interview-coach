import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
])

const TTS_SERVICE_BASE_URL = (
  process.env.KOKORO_TTS_URL ||
  process.env.TTS_SERVICE_URL ||
  process.env.TTS_URL ||
  ''
).replace(/\/$/, '')
const TTS_SERVICE_API_KEY = process.env.KOKORO_TTS_API_KEY || process.env.TTS_SERVICE_API_KEY || ''
const TTS_SERVICE_MODEL = process.env.KOKORO_TTS_MODEL || process.env.TTS_SERVICE_MODEL || 'kokoro'

const KOKORO_VOICE_MAP: Record<string, string> = {
  alloy: 'af_heart',
  ash: 'am_michael',
  ballad: 'af_nicole',
  coral: 'af_bella',
  echo: 'am_adam',
  fable: 'bm_george',
  onyx: 'bm_fable',
  nova: 'af_nova',
  sage: 'bm_lewis',
  shimmer: 'bf_emma',
  verse: 'am_liam',
}

function hasDedicatedTTSService() {
  return Boolean(TTS_SERVICE_BASE_URL)
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function parseAudioFromResponse(response: Response): Promise<Buffer | null> {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('audio/')) {
    const directBuffer = Buffer.from(await response.arrayBuffer())
    return directBuffer.length > 0 ? directBuffer : null
  }

  const json = await response.json().catch(() => null as unknown)
  if (!json || typeof json !== 'object') return null

  const obj = json as Record<string, unknown>
  const base64Audio = [obj.audio_base64, obj.audioContent, obj.audio].find(
    (v): v is string => typeof v === 'string' && v.length > 0
  )
  if (base64Audio) {
    return Buffer.from(base64Audio, 'base64')
  }

  const audioUrl = obj.audio_url
  if (typeof audioUrl === 'string' && audioUrl.length > 0) {
    const audioResponse = await fetch(audioUrl, { cache: 'no-store' })
    if (!audioResponse.ok) return null
    const remoteBuffer = Buffer.from(await audioResponse.arrayBuffer())
    return remoteBuffer.length > 0 ? remoteBuffer : null
  }

  return null
}

async function synthesizeWithDedicatedTTS(
  text: string,
  voice: string,
  instructions: string
): Promise<Buffer | null> {
  if (!hasDedicatedTTSService()) return null

  const mappedVoice = KOKORO_VOICE_MAP[voice] || 'af_nova'
  const commonHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (TTS_SERVICE_API_KEY) {
    commonHeaders.Authorization = `Bearer ${TTS_SERVICE_API_KEY}`
  }

  const attempts: Array<{ url: string; body: Record<string, unknown> }> = [
    {
      url: `${TTS_SERVICE_BASE_URL}/synthesize`,
      body: {
        text,
        voice: mappedVoice,
        voice_id: mappedVoice,
        style: voice,
        instructions,
        format: 'mp3',
      },
    },
    {
      url: `${TTS_SERVICE_BASE_URL}/tts`,
      body: {
        text,
        voice: mappedVoice,
        voice_id: mappedVoice,
        instructions,
        response_format: 'mp3',
      },
    },
    {
      url: `${TTS_SERVICE_BASE_URL}/v1/audio/speech`,
      body: {
        model: TTS_SERVICE_MODEL,
        input: text,
        voice: mappedVoice,
        instructions,
        response_format: 'mp3',
      },
    },
  ]

  for (const attempt of attempts) {
    const response = await fetchWithTimeout(
      attempt.url,
      {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(attempt.body),
      },
      15_000
    ).catch(() => null)

    if (!response || !response.ok) continue
    const audioBuffer = await parseAudioFromResponse(response)
    if (audioBuffer && audioBuffer.length > 0) {
      return audioBuffer
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canUseDedicatedTTS = hasDedicatedTTSService()
    if (!canUseDedicatedTTS) {
      return NextResponse.json(
        {
          error: 'Human-like TTS is not configured on the server yet.',
          code: 'TTS_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    const userId = (session.user as { id: string }).id
    const limiter = await checkRateLimit(`tts:${userId}`, 120, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many voice synthesis requests. Please retry shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }

    const body = await request.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    const voice = typeof body?.voice === 'string' && VOICES.has(body.voice) ? body.voice : 'alloy'
    const instructions = typeof body?.instructions === 'string' ? body.instructions : ''

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const audioBuffer = await synthesizeWithDedicatedTTS(text, voice, instructions)
    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json(
        {
          error: 'Voice synthesis temporarily unavailable',
          code: 'TTS_UNAVAILABLE',
        },
        { status: 503 }
      )
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json(
      { error: 'Failed to synthesize interviewer voice' },
      { status: 500 }
    )
  }
}
