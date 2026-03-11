import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { synthesizeSpeech, AIServiceError, isAIServiceConfigured } from '@/lib/ai'
import { checkRateLimit } from '@/lib/rate-limit'

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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAIServiceConfigured()) {
      return NextResponse.json(
        {
          error: 'Human-like TTS is not configured on the server yet.',
          code: 'TTS_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    const userId = (session.user as { id: string }).id
    const limiter = checkRateLimit(`tts:${userId}`, 120, 60_000)
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

    const audioBuffer = await synthesizeSpeech(text, voice, instructions)
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof AIServiceError) {
      return NextResponse.json(
        { error: 'Voice synthesis temporarily unavailable', code: error.code },
        { status: 503 }
      )
    }
    console.error('TTS error:', error)
    return NextResponse.json(
      { error: 'Failed to synthesize interviewer voice' },
      { status: 500 }
    )
  }
}
