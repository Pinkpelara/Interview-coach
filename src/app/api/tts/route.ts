import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import OpenAI from 'openai'
import { authOptions } from '@/lib/auth'

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

    if (!process.env.PUTER_API_TOKEN) {
      return NextResponse.json(
        {
          error: 'Human-like TTS is not configured on the server yet.',
          code: 'TTS_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    const voice = typeof body?.voice === 'string' && VOICES.has(body.voice) ? body.voice : 'alloy'
    const instructions = typeof body?.instructions === 'string' ? body.instructions : ''

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const client = new OpenAI({
      baseURL: 'https://api.puter.com/puterai/openai/v1/',
      apiKey: process.env.PUTER_API_TOKEN,
    })

    const response = await client.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      instructions,
      response_format: 'mp3',
    })

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    return new NextResponse(audioBuffer, {
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
