import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ObserveType = 'perfect' | 'cautionary'

function words(text: string) {
  return text.toLowerCase().match(/[a-z0-9']+/g) || []
}

function buildQaPairs(exchanges: Array<{ speaker: string; messageText: string }>) {
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
    .slice(0, 3)
}

function improveAnswer(answer: string, companyName: string, jobTitle: string): string {
  let text = answer
    .replace(/\b(um+|uh+|you know|kind of|sort of)\b/gi, '')
    .replace(/\b(i think|i guess|maybe)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const hasMetric = /\b\d+(?:[.,]\d+)?%?\b/.test(text)
  const hasOwnership = /\b(i|my|mine)\b/i.test(text)

  if (!hasOwnership) {
    text = `In my role, ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  }
  if (!hasMetric) {
    text = `${text} The result was a measurable improvement in delivery quality and stakeholder confidence.`
  }
  if (words(text).length < 45) {
    text = `${text} I focused on clear scope, decision-making, and outcome ownership aligned to the ${jobTitle} role at ${companyName}.`
  }

  return text.trim()
}

function cautionaryAnswer(answer: string, pattern: string): string {
  const withoutNumbers = answer.replace(/\b\d+(?:[.,]\d+)?%?\b/g, 'a lot')
  const softened = withoutNumbers.replace(/\bI\b/g, 'we').replace(/\bmy\b/g, 'our').trim()

  if (pattern === 'Silence-Filling') {
    return `Um, so yeah, ${softened} ... and yeah, that's basically it, I think.`
  }
  if (pattern === 'Retreat Under Pressure') {
    return `I think maybe ${softened}, but it depends and I'm not fully sure.`
  }
  if (pattern === 'Missing Personal Ownership') {
    return `Our team handled that overall. We collaborated a lot and things worked out.`
  }
  return `Well, kind of ${softened} and we figured things out as we went.`
}

function perfectNote(answer: string): string {
  const hasMetric = /\b\d+(?:[.,]\d+)?%?\b/.test(answer)
  const hasOwnership = /\b(i|my|mine)\b/i.test(answer)
  return `Strong structure with direct ownership${hasOwnership ? '' : ' (add more "I" ownership)'}${hasMetric ? ' and measurable impact.' : '. Add one explicit metric.'}`
}

function cautionaryNote(pattern: string): string {
  const notes: Record<string, string> = {
    'Silence-Filling': 'Filler language lowers confidence and makes the answer feel uncertain.',
    'Retreat Under Pressure': 'The answer softens claims instead of defending with specifics.',
    'Missing Personal Ownership': '"We" language dominates, so the interviewer cannot assess individual impact.',
  }
  return `Pattern: ${pattern}. ${notes[pattern] || 'The response lacks concrete evidence.'}`
}

function buildObserveRun(
  sourceExchanges: Array<{ speaker: string; messageText: string }>,
  runType: ObserveType,
  companyName: string,
  jobTitle: string
) {
  const pairs = buildQaPairs(sourceExchanges)
  const weakPatterns = detectWeakPatterns(pairs)

  const exchanges: Array<{
    id: string
    speaker: 'interviewer' | 'candidate'
    text: string
    annotation?: { type: ObserveType; note: string; pattern?: string }
  }> = []

  pairs.forEach((pair, idx) => {
    exchanges.push({
      id: `${runType}-q-${idx}`,
      speaker: 'interviewer',
      text: pair.question,
    })

    if (runType === 'perfect') {
      const improved = improveAnswer(pair.answer, companyName, jobTitle)
      exchanges.push({
        id: `${runType}-a-${idx}`,
        speaker: 'candidate',
        text: improved,
        annotation: { type: 'perfect', note: perfectNote(improved) },
      })
    } else {
      const pattern = weakPatterns[idx % Math.max(weakPatterns.length, 1)] || 'Vague Claim Without Support'
      const weaker = cautionaryAnswer(pair.answer, pattern)
      exchanges.push({
        id: `${runType}-a-${idx}`,
        speaker: 'candidate',
        text: weaker,
        annotation: { type: 'cautionary', note: cautionaryNote(pattern), pattern },
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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const sessionId = params.id

    const sourceSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
    })

    if (!sourceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const observeSessions = await prisma.observeSession.findMany({
      where: { sourceSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(observeSessions)
  } catch (error) {
    console.error('Observe GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const sessionId = params.id
    const body = await request.json()
    const { runType } = body

    if (!runType || (runType !== 'perfect' && runType !== 'cautionary')) {
      return NextResponse.json(
        { error: 'runType must be "perfect" or "cautionary"' },
        { status: 400 }
      )
    }

    const sourceSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        exchanges: { orderBy: { sequenceNumber: 'asc' } },
        application: {
          select: { companyName: true, jobTitle: true },
        },
      },
    })

    if (!sourceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (sourceSession.status !== 'completed') {
      return NextResponse.json(
        { error: 'Observe is available after completing a session.' },
        { status: 400 }
      )
    }

    // Check for existing observe session of this type
    const existing = await prisma.observeSession.findFirst({
      where: { sourceSessionId: sessionId, runType },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      return NextResponse.json(existing)
    }

    const generated = buildObserveRun(
      sourceSession.exchanges.map((e) => ({ speaker: e.speaker, messageText: e.messageText })),
      runType,
      sourceSession.application.companyName,
      sourceSession.application.jobTitle
    )

    const observeSession = await prisma.observeSession.create({
      data: {
        sourceSessionId: sessionId,
        runType,
        exchanges: generated.exchanges,
        annotations: generated.annotations,
      },
    })

    return NextResponse.json(observeSession, { status: 201 })
  } catch (error) {
    console.error('Observe POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
