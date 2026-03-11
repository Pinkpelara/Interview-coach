import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { getEffectivePlan } from '@/lib/subscription'
import { checkFeature } from '@/lib/feature-gate'

type SourceExchange = {
  speaker: string
  messageText: string
}

type ObserveType = 'perfect' | 'cautionary'

function safeParseJson(value: string | null): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function words(text: string) {
  return text.toLowerCase().match(/[a-z0-9']+/g) || []
}

function buildQaPairs(exchanges: SourceExchange[]) {
  const pairs: Array<{ question: string; answer: string }> = []
  let pendingQuestion = ''

  for (const ex of exchanges) {
    if (ex.speaker === 'interviewer') {
      pendingQuestion = ex.messageText
      continue
    }
    if (ex.speaker === 'candidate') {
      pairs.push({
        question: pendingQuestion || 'Tell me about your background.',
        answer: ex.messageText,
      })
    }
  }
  return pairs.slice(0, 12)
}

function detectWeakPatterns(pairs: Array<{ answer: string }>): string[] {
  let filler = 0
  let uncertainty = 0
  let vague = 0
  let lowOwnership = 0
  for (const pair of pairs) {
    const text = pair.answer.toLowerCase()
    filler += (text.match(/\b(um+|uh+|like|you know)\b/g) || []).length
    uncertainty += (text.match(/\b(i think|maybe|not sure|i guess)\b/g) || []).length
    vague += (text.match(/\b(stuff|things|kind of|sort of|a lot)\b/g) || []).length
    if (!/\b(i|my|mine)\b/g.test(text)) lowOwnership += 1
  }

  const patterns: Array<{ name: string; score: number }> = [
    { name: 'Silence-Filling', score: filler },
    { name: 'Retreat Under Pressure', score: uncertainty },
    { name: 'Vague Claim Without Support', score: vague },
    { name: 'Missing Personal Ownership', score: lowOwnership },
  ]

  return patterns
    .sort((a, b) => b.score - a.score)
    .map((p) => p.name)
    .filter((_, idx) => idx < 3)
}

function improveAnswer(answer: string, companyName: string, jobTitle: string): string {
  let text = answer
    .replace(/\b(um+|uh+|you know|kind of|sort of)\b/gi, '')
    .replace(/\b(i think|i guess|maybe)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const answerWords = words(text).length
  const hasMetric = /\b\d+(?:[.,]\d+)?%?\b/.test(text)
  const hasOwnership = /\b(i|my|mine)\b/i.test(text)

  if (!hasOwnership) {
    text = `In my role, ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  }

  if (!hasMetric) {
    text = `${text} The result was a measurable improvement in delivery quality and stakeholder confidence.`
  }

  if (answerWords < 45) {
    text = `${text} I focused on clear scope, decision-making, and outcome ownership aligned to the ${jobTitle} role at ${companyName}.`
  }

  return text.trim()
}

function cautionaryAnswer(answer: string, pattern: string): string {
  const withoutNumbers = answer.replace(/\b\d+(?:[.,]\d+)?%?\b/g, 'a lot')
  const softened = withoutNumbers
    .replace(/\bI\b/g, 'we')
    .replace(/\bmy\b/g, 'our')
    .trim()

  if (pattern === 'Silence-Filling') {
    return `Um, so yeah, ${softened} ... and yeah, that's basically it, I think.`
  }
  if (pattern === 'Retreat Under Pressure') {
    return `I think maybe ${softened}, but it depends and I'm not fully sure there was one best approach.`
  }
  if (pattern === 'Missing Personal Ownership') {
    return `Our team handled that overall. We collaborated a lot and things worked out eventually.`
  }
  return `Well, kind of ${softened} and we figured things out as we went.`
}

function perfectNote(answer: string): string {
  const hasMetric = /\b\d+(?:[.,]\d+)?%?\b/.test(answer)
  const hasOwnership = /\b(i|my|mine)\b/i.test(answer)
  const length = words(answer).length
  return `Strong structure with direct ownership${hasOwnership ? '' : ' (add even more "I" ownership)'}${hasMetric ? ' and measurable impact.' : '. Add one explicit metric for even stronger signal.'} Length was ${length} words, which is within a solid interview range.`
}

function cautionaryNote(pattern: string): string {
  if (pattern === 'Silence-Filling') {
    return 'Pattern: Silence-Filling. Extra filler language after the core point lowers confidence and makes the answer feel uncertain.'
  }
  if (pattern === 'Retreat Under Pressure') {
    return 'Pattern: Retreat Under Pressure. The answer softens claims instead of defending with specifics.'
  }
  if (pattern === 'Missing Personal Ownership') {
    return 'Pattern: Missing Personal Ownership. "We" language dominates, so the interviewer cannot assess your individual impact.'
  }
  return 'Pattern: Vague Claim Without Support. The response lacks concrete evidence and reads as generic.'
}

function buildObserveRun(
  sourceExchanges: SourceExchange[],
  type: ObserveType,
  companyName: string,
  jobTitle: string
) {
  const pairs = buildQaPairs(sourceExchanges)
  const weakPatterns = detectWeakPatterns(pairs)
  const exchanges: Array<{
    id: string
    speaker: 'interviewer' | 'candidate'
    text: string
    annotation?: {
      type: ObserveType
      note: string
      pattern?: string
    }
  }> = []

  pairs.forEach((pair, idx) => {
    exchanges.push({
      id: `${type}-q-${idx}`,
      speaker: 'interviewer',
      text: pair.question,
    })

    if (type === 'perfect') {
      const improved = improveAnswer(pair.answer, companyName, jobTitle)
      exchanges.push({
        id: `${type}-a-${idx}`,
        speaker: 'candidate',
        text: improved,
        annotation: {
          type: 'perfect',
          note: perfectNote(improved),
        },
      })
    } else {
      const pattern = weakPatterns[idx % Math.max(weakPatterns.length, 1)] || 'Vague Claim Without Support'
      const weaker = cautionaryAnswer(pair.answer, pattern)
      exchanges.push({
        id: `${type}-a-${idx}`,
        speaker: 'candidate',
        text: weaker,
        annotation: {
          type: 'cautionary',
          note: cautionaryNote(pattern),
          pattern,
        },
      })
    }
  })

  const annotations = exchanges
    .filter((e) => e.annotation)
    .map((e) => ({
      exchangeId: e.id,
      type: e.annotation!.type,
      note: e.annotation!.note,
      pattern: e.annotation!.pattern,
    }))

  return { exchanges, annotations }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const plan = await getEffectivePlan(userId)
    const gate = checkFeature(plan, 'observe_module')
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, requiredPlan: gate.requiredPlan }, { status: 403 })
    }
    const limiter = await checkRateLimit(`observe:get:${userId}`, 60, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many observe requests. Please retry shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }
    const { searchParams } = new URL(request.url)
    const sourceSessionId = searchParams.get('sourceSessionId')

    if (!sourceSessionId) {
      return NextResponse.json(
        { error: 'sourceSessionId query param is required' },
        { status: 400 }
      )
    }

    // Verify the source session belongs to this user
    const sourceSession = await prisma.interviewSession.findFirst({
      where: { id: sourceSessionId, userId },
    })

    if (!sourceSession) {
      return NextResponse.json({ error: 'Source session not found' }, { status: 404 })
    }

    if (sourceSession.status !== 'completed') {
      return NextResponse.json(
        { error: 'Observe is available after completing at least one session.' },
        { status: 400 }
      )
    }

    const observeSessions = await prisma.observeSession.findMany({
      where: { sourceSessionId },
      orderBy: { createdAt: 'desc' },
    })

    const parsed = observeSessions.map((os) => ({
      id: os.id,
      sourceSessionId: os.sourceSessionId,
      type: os.type,
      exchanges: safeParseJson(os.exchanges),
      annotations: safeParseJson(os.annotations),
    }))

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Observe GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const plan = await getEffectivePlan(userId)
    const gate = checkFeature(plan, 'observe_module')
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, requiredPlan: gate.requiredPlan }, { status: 403 })
    }
    const limiter = await checkRateLimit(`observe:create:${userId}`, 30, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many observe generation requests. Please retry shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }
    const body = await request.json()
    const { sourceSessionId, type } = body

    if (!sourceSessionId || !type) {
      return NextResponse.json(
        { error: 'sourceSessionId and type are required' },
        { status: 400 }
      )
    }

    if (type !== 'perfect' && type !== 'cautionary') {
      return NextResponse.json(
        { error: 'type must be "perfect" or "cautionary"' },
        { status: 400 }
      )
    }

    // Verify the source session belongs to this user
    const sourceSession = await prisma.interviewSession.findFirst({
      where: { id: sourceSessionId, userId },
      include: {
        exchanges: {
          orderBy: { sequenceNumber: 'asc' },
        },
        application: {
          select: {
            companyName: true,
            jobTitle: true,
          },
        },
      },
    })

    if (!sourceSession) {
      return NextResponse.json({ error: 'Source session not found' }, { status: 404 })
    }

    if (sourceSession.status !== 'completed') {
      return NextResponse.json(
        { error: 'Observe is available after completing at least one session.' },
        { status: 400 }
      )
    }

    const existingOfType = await prisma.observeSession.findFirst({
      where: { sourceSessionId, type },
      orderBy: { createdAt: 'desc' },
    })

    if (existingOfType) {
      return NextResponse.json({
        id: existingOfType.id,
        sourceSessionId,
        type,
        exchanges: safeParseJson(existingOfType.exchanges),
        annotations: safeParseJson(existingOfType.annotations),
      })
    }

    const generated = buildObserveRun(
      sourceSession.exchanges.map((e) => ({ speaker: e.speaker, messageText: e.messageText })),
      type,
      sourceSession.application.companyName,
      sourceSession.application.jobTitle
    )

    // Save to ObserveSession
    const observeSession = await prisma.observeSession.create({
      data: {
        sourceSessionId,
        type,
        exchanges: JSON.stringify(generated.exchanges),
        annotations: JSON.stringify(generated.annotations),
      },
    })

    return NextResponse.json({
      id: observeSession.id,
      sourceSessionId,
      type,
      exchanges: generated.exchanges,
      annotations: generated.annotations,
    })
  } catch (error) {
    console.error('Observe API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
