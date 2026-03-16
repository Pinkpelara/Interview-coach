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

type ObserveType = 'perfect' | 'cautionary' | 'custom'
type CustomScenario =
  | 'salary'
  | 'unknown_answer'
  | 'recovery_after_bad_answer'
  | 'greatest_weakness'
  | 'why_leaving_role'
  | 'long_silence'

const CUSTOM_SCENARIOS: CustomScenario[] = [
  'salary',
  'unknown_answer',
  'recovery_after_bad_answer',
  'greatest_weakness',
  'why_leaving_role',
  'long_silence',
]

function parseStoredType(type: string): { type: ObserveType; scenario?: CustomScenario } {
  if (type.startsWith('custom:')) {
    const scenario = type.replace('custom:', '') as CustomScenario
    return { type: 'custom', scenario }
  }
  if (type === 'perfect' || type === 'cautionary') {
    return { type }
  }
  return { type: 'custom', scenario: 'salary' }
}

function toStoredType(type: ObserveType, scenario?: CustomScenario): string {
  if (type !== 'custom') return type
  return `custom:${scenario || 'salary'}`
}

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

function buildCustomObserveRun(
  scenario: CustomScenario,
  companyName: string,
  jobTitle: string,
  sourceExchanges: SourceExchange[]
) {
  const fallbackQuestion =
    sourceExchanges.find((e) => e.speaker === 'interviewer')?.messageText ||
    `Let's run a focused ${scenario.replace(/_/g, ' ')} scenario.`

  const scenes: Record<CustomScenario, {
    title: string
    candidateStrong: string
    candidateWeak: string
    noteStrong: string
    noteWeak: string
  }> = {
    salary: {
      title: 'Salary Negotiation',
      candidateStrong:
        'Based on market data for similar roles and my outcomes in scope growth and delivery quality, I am targeting $145k-$155k base. If base is capped, I can be flexible on signing bonus and review timing.',
      candidateWeak:
        'Um, I was kind of hoping for maybe a bit more, but I am not sure what is possible and I can probably take whatever works.',
      noteStrong:
        'Strong negotiation anchor with data, range framing, and flexible components.',
      noteWeak:
        'Weak anchor and uncertainty language reduce leverage immediately.',
    },
    unknown_answer: {
      title: 'Unknown Question Recovery',
      candidateStrong:
        'I have not solved that exact case before. I would break it down into assumptions, identify key constraints, and test two approaches quickly before committing.',
      candidateWeak:
        'I think I might know this, maybe I would just try something and see what happens.',
      noteStrong:
        'Honest gap acknowledgment plus a structured problem-solving approach.',
      noteWeak:
        'Bluffing/guessing without structure signals low judgment under uncertainty.',
    },
    recovery_after_bad_answer: {
      title: 'Recover After Weak Answer',
      candidateStrong:
        'I want to correct that answer with a clearer example. In my last role, I led the incident review, owned the rollback, and reduced repeat failures by 38% over two quarters.',
      candidateWeak:
        'Actually let me re-answer... I do not know, maybe it was kind of similar to another project.',
      noteStrong:
        'Direct reset + concise, specific replacement answer restores credibility.',
      noteWeak:
        'Unfocused restart without ownership or outcomes compounds the miss.',
    },
    greatest_weakness: {
      title: 'Greatest Weakness',
      candidateStrong:
        'Earlier in my career I over-indexed on speed over stakeholder alignment. I now use a pre-brief checklist and decision memo; this cut rework by about 25% in my last two initiatives.',
      candidateWeak:
        'My weakness is that I am a perfectionist and I care too much.',
      noteStrong:
        'Genuine weakness, concrete remediation, and measurable progress.',
      noteWeak:
        'Cliche non-weakness answer reads as evasive and low self-awareness.',
    },
    why_leaving_role: {
      title: 'Why Leaving Current Role',
      candidateStrong:
        'I have learned a lot where I am, but my scope has plateaued. I am looking for a role where I can lead cross-functional execution at a larger scale, which aligns with this position.',
      candidateWeak:
        'Honestly my manager is difficult and the team is chaotic, so I need to leave.',
      noteStrong:
        'Forward-looking motivation with no negativity toward current employer.',
      noteWeak:
        'Negative framing about prior team creates culture-risk concerns.',
    },
    long_silence: {
      title: 'Handling Long Silence',
      candidateStrong:
        'I will pause here and let you react. I can add detail on tradeoffs, stakeholder alignment, or execution metrics depending on what you want to explore.',
      candidateWeak:
        'Sorry, I can keep talking... um, and then also we did many other things and kind of kept iterating and, yeah...',
      noteStrong:
        'Composed silence handling with optional structured extension.',
      noteWeak:
        'Silence-filling ramble weakens a previously solid answer.',
    },
  }

  const scene = scenes[scenario]
  const exchanges = [
    { id: `custom-q-${scenario}-0`, speaker: 'interviewer' as const, text: fallbackQuestion },
    {
      id: `custom-a-${scenario}-strong`,
      speaker: 'candidate' as const,
      text: scene.candidateStrong,
      annotation: { type: 'perfect' as const, note: scene.noteStrong },
    },
    {
      id: `custom-a-${scenario}-weak`,
      speaker: 'candidate' as const,
      text: scene.candidateWeak,
      annotation: { type: 'cautionary' as const, note: scene.noteWeak, pattern: 'Custom Scenario Contrast' },
    },
    {
      id: `custom-q-${scenario}-1`,
      speaker: 'interviewer' as const,
      text: `How would you apply that approach in the ${jobTitle} role at ${companyName}?`,
    },
  ]

  const annotations = exchanges
    .filter((e) => e.annotation)
    .map((e) => ({
      exchangeId: e.id,
      type: e.annotation!.type,
      note: e.annotation!.note,
      pattern: e.annotation!.pattern,
      title: scene.title,
    }))

  return { exchanges, annotations, scenario, title: scene.title }
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
      ...parseStoredType(os.type),
      id: os.id,
      sourceSessionId: os.sourceSessionId,
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
    const { sourceSessionId, type, scenario } = body

    if (!sourceSessionId || !type) {
      return NextResponse.json(
        { error: 'sourceSessionId and type are required' },
        { status: 400 }
      )
    }

    if (type !== 'perfect' && type !== 'cautionary' && type !== 'custom') {
      return NextResponse.json(
        { error: 'type must be "perfect", "cautionary", or "custom"' },
        { status: 400 }
      )
    }
    const customScenario: CustomScenario | undefined =
      type === 'custom' && typeof scenario === 'string' && CUSTOM_SCENARIOS.includes(scenario as CustomScenario)
        ? (scenario as CustomScenario)
        : undefined
    if (type === 'custom' && !customScenario) {
      return NextResponse.json(
        { error: `scenario must be one of: ${CUSTOM_SCENARIOS.join(', ')}` },
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

    const storedType = toStoredType(type, customScenario)
    const existingOfType = await prisma.observeSession.findFirst({
      where: { sourceSessionId, type: storedType },
      orderBy: { createdAt: 'desc' },
    })

    if (existingOfType) {
      return NextResponse.json({
        ...parseStoredType(existingOfType.type),
        id: existingOfType.id,
        sourceSessionId,
        exchanges: safeParseJson(existingOfType.exchanges),
        annotations: safeParseJson(existingOfType.annotations),
      })
    }

    const sourceExchanges = sourceSession.exchanges.map((e) => ({ speaker: e.speaker, messageText: e.messageText }))
    const generated =
      type === 'custom'
        ? buildCustomObserveRun(
            customScenario!,
            sourceSession.application.companyName,
            sourceSession.application.jobTitle,
            sourceExchanges
          )
        : buildObserveRun(
            sourceExchanges,
            type,
            sourceSession.application.companyName,
            sourceSession.application.jobTitle
          )

    // Save to ObserveSession
    const observeSession = await prisma.observeSession.create({
      data: {
        sourceSessionId,
        type: storedType,
        exchanges: JSON.stringify(generated.exchanges),
        annotations: JSON.stringify(generated.annotations),
      },
    })

    return NextResponse.json({
      ...parseStoredType(storedType),
      id: observeSession.id,
      sourceSessionId,
      exchanges: generated.exchanges,
      annotations: generated.annotations,
    })
  } catch (error) {
    console.error('Observe API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
