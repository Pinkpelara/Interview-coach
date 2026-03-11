import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletion, chatCompletionJSONValidated, isAIServiceConfigured } from '@/lib/ai'
import { DebriefScoreSchema } from '@/lib/ai/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { debriefCoachSystemPrompt, debriefScoringSystemPrompt } from '@/lib/ai/prompts'

type MomentType = 'strong' | 'recoverable' | 'dropped'

type Pair = {
  question: string
  answer: string
  timestampMs: number
  characterId: string | null
}

type Stats = {
  answersCount: number
  totalWords: number
  avgWords: number
  fillerCount: number
  uncertainCount: number
  quantifiedAnswers: number
  ownershipAnswers: number
  shortAnswers: number
  strongCount: number
  recoverableCount: number
  droppedCount: number
  companyKeywordHits: number
  companyKeywordCoverage: number
  listeningOverlap: number
  recoveredFromDrops: number
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had',
  'has', 'have', 'he', 'her', 'his', 'i', 'if', 'in', 'is', 'it', 'its', 'me',
  'my', 'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'they',
  'this', 'to', 'too', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'who',
  'why', 'will', 'with', 'you', 'your'
])

const FILLER_RE = /\b(um+|uh+|like|you know|sort of|kind of)\b/gi
const UNCERTAIN_RE = /\b(i think|i feel|maybe|not sure|probably|i guess)\b/gi
const NUMBER_RE = /\b\d+(?:[.,]\d+)?%?\b/g
const OWNERSHIP_RE = /\b(i|my|mine|i led|i built|i owned|i drove)\b/gi
const VAGUE_RE = /\b(stuff|things|somehow|kind of|sort of|a lot)\b/gi

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(Boolean)
}

function quote(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}...`
}

function extractKeywords(jdText: string | null | undefined): string[] {
  if (!jdText) return []
  const freq = new Map<string, number>()
  for (const token of words(jdText)) {
    if (token.length < 5 || STOP_WORDS.has(token)) continue
    freq.set(token, (freq.get(token) || 0) + 1)
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([token]) => token)
}

function lexicalOverlap(question: string, answer: string): number {
  const q = new Set(words(question).filter((w) => !STOP_WORDS.has(w) && w.length > 3))
  const a = new Set(words(answer).filter((w) => !STOP_WORDS.has(w) && w.length > 3))
  if (q.size === 0) return 0.5
  let matches = 0
  q.forEach((token) => {
    if (a.has(token)) matches += 1
  })
  return matches / q.size
}

function buildPairs(
  exchanges: Array<{ speaker: string; messageText: string; timestampMs: number; characterId: string | null }>
): Pair[] {
  const pairs: Pair[] = []
  let lastQuestion = ''
  let lastQuestionCharacter: string | null = null

  for (const ex of exchanges) {
    if (ex.speaker === 'interviewer') {
      lastQuestion = ex.messageText
      lastQuestionCharacter = ex.characterId
      continue
    }
    if (ex.speaker === 'candidate') {
      pairs.push({
        question: lastQuestion || 'Opening response',
        answer: ex.messageText,
        timestampMs: ex.timestampMs || 0,
        characterId: lastQuestionCharacter,
      })
    }
  }
  return pairs
}

function classifyPair(pair: Pair): { type: MomentType; coachingNote: string } {
  const answerWords = words(pair.answer).length
  const fillers = countMatches(pair.answer, FILLER_RE)
  const uncertain = countMatches(pair.answer, UNCERTAIN_RE)
  const quantified = countMatches(pair.answer, NUMBER_RE) > 0
  const vague = countMatches(pair.answer, VAGUE_RE)
  const owned = countMatches(pair.answer, OWNERSHIP_RE) > 0

  if (answerWords < 18 || fillers >= 3 || (vague >= 2 && !quantified)) {
    return {
      type: 'dropped',
      coachingNote: 'This answer lacked specificity and confidence markers. Tighten structure, remove filler language, and include one concrete outcome.',
    }
  }

  if (answerWords >= 35 && answerWords <= 180 && fillers === 0 && uncertain === 0 && (quantified || owned)) {
    return {
      type: 'strong',
      coachingNote: 'Strong delivery: you stayed specific, owned your contribution, and kept the answer concise enough for follow-up.',
    }
  }

  return {
    type: 'recoverable',
    coachingNote: 'The core point is good, but the answer can be sharper. Lead with your action, then close with a measurable result.',
  }
}

function buildMomentMap(pairs: Pair[]) {
  if (!pairs.length) return []
  return pairs.map((pair, idx) => {
    const { type, coachingNote } = classifyPair(pair)
    const start = Math.floor((idx / pairs.length) * 100)
    const end = idx === pairs.length - 1 ? 100 : Math.floor(((idx + 1) / pairs.length) * 100)
    return {
      id: `seg-${idx}`,
      start,
      end,
      type,
      transcript: `Interviewer: "${quote(pair.question, 240)}"\n\nYou: "${quote(pair.answer, 380)}"`,
      coachingNote,
      timestampMs: pair.timestampMs,
      hasInterviewerReaction: type !== 'recoverable',
    }
  })
}

function computeStats(pairs: Pair[], momentMap: Array<{ type: MomentType }>, jdKeywords: string[]): Stats {
  const answersCount = pairs.length
  if (!answersCount) {
    return {
      answersCount: 0,
      totalWords: 0,
      avgWords: 0,
      fillerCount: 0,
      uncertainCount: 0,
      quantifiedAnswers: 0,
      ownershipAnswers: 0,
      shortAnswers: 0,
      strongCount: 0,
      recoverableCount: 0,
      droppedCount: 0,
      companyKeywordHits: 0,
      companyKeywordCoverage: 0,
      listeningOverlap: 0,
      recoveredFromDrops: 0,
    }
  }

  let totalWords = 0
  let fillerCount = 0
  let uncertainCount = 0
  let quantifiedAnswers = 0
  let ownershipAnswers = 0
  let shortAnswers = 0
  let companyKeywordHits = 0
  let overlapSum = 0

  for (const pair of pairs) {
    const w = words(pair.answer).length
    totalWords += w
    fillerCount += countMatches(pair.answer, FILLER_RE)
    uncertainCount += countMatches(pair.answer, UNCERTAIN_RE)
    if (countMatches(pair.answer, NUMBER_RE) > 0) quantifiedAnswers += 1
    if (countMatches(pair.answer, OWNERSHIP_RE) > 0) ownershipAnswers += 1
    if (w < 18) shortAnswers += 1
    if (jdKeywords.length) {
      const answerTokens = new Set(words(pair.answer))
      for (const k of jdKeywords) {
        if (answerTokens.has(k)) companyKeywordHits += 1
      }
    }
    overlapSum += lexicalOverlap(pair.question, pair.answer)
  }

  let recoveredFromDrops = 0
  for (let i = 0; i < momentMap.length - 1; i++) {
    if (momentMap[i].type === 'dropped' && momentMap[i + 1].type !== 'dropped') recoveredFromDrops += 1
  }

  const strongCount = momentMap.filter((m) => m.type === 'strong').length
  const recoverableCount = momentMap.filter((m) => m.type === 'recoverable').length
  const droppedCount = momentMap.filter((m) => m.type === 'dropped').length

  return {
    answersCount,
    totalWords,
    avgWords: totalWords / answersCount,
    fillerCount,
    uncertainCount,
    quantifiedAnswers,
    ownershipAnswers,
    shortAnswers,
    strongCount,
    recoverableCount,
    droppedCount,
    companyKeywordHits,
    companyKeywordCoverage: jdKeywords.length ? companyKeywordHits / (answersCount * Math.max(jdKeywords.length, 1)) : 0,
    listeningOverlap: overlapSum / answersCount,
    recoveredFromDrops,
  }
}

function deriveScores(stats: Stats) {
  if (!stats.answersCount) {
    return {
      answerQuality: 45,
      deliveryConfidence: 45,
      pressureRecovery: 45,
      companyFitLanguage: 40,
      listeningAccuracy: 45,
      hiringProbability: 44,
    }
  }

  const quantifiedRatio = stats.quantifiedAnswers / stats.answersCount
  const strongRatio = stats.strongCount / stats.answersCount
  const droppedRatio = stats.droppedCount / stats.answersCount
  const shortRatio = stats.shortAnswers / stats.answersCount
  const fillerRate = stats.fillerCount / Math.max(stats.totalWords, 1)
  const uncertainRate = stats.uncertainCount / Math.max(stats.totalWords, 1)
  const recoveryRatio = stats.droppedCount > 0 ? stats.recoveredFromDrops / stats.droppedCount : 1

  const answerQuality = clamp(
    Math.round(48 + quantifiedRatio * 22 + strongRatio * 18 - droppedRatio * 22 - shortRatio * 10),
    1,
    100
  )

  const deliveryConfidence = clamp(
    Math.round(58 - fillerRate * 280 - uncertainRate * 200 + (stats.avgWords >= 35 && stats.avgWords <= 170 ? 8 : -4)),
    1,
    100
  )

  const pressureRecovery = clamp(
    Math.round(52 + recoveryRatio * 28 - droppedRatio * 14 + strongRatio * 8),
    1,
    100
  )

  const companyFitLanguage = clamp(
    Math.round(40 + stats.companyKeywordCoverage * 220),
    1,
    100
  )

  const listeningAccuracy = clamp(
    Math.round(45 + stats.listeningOverlap * 55 - shortRatio * 8),
    1,
    100
  )

  const hiringProbability = clamp(
    Math.round(
      answerQuality * 0.3 +
      deliveryConfidence * 0.2 +
      pressureRecovery * 0.2 +
      companyFitLanguage * 0.15 +
      listeningAccuracy * 0.15
    ),
    1,
    100
  )

  return {
    answerQuality,
    deliveryConfidence,
    pressureRecovery,
    companyFitLanguage,
    listeningAccuracy,
    hiringProbability,
  }
}

function buildNextTargets(stats: Stats): Array<{ title: string; description: string; action: string; successMetric: string }> {
  const candidates = [
    {
      score: stats.fillerCount,
      target: {
        title: 'Reduce filler language under pressure',
        description: `You used filler phrases ${stats.fillerCount} times across this session, which weakens otherwise solid points.`,
        action: 'Rehearse your three hardest questions with a deliberate 2-second pause before each key claim.',
        successMetric: 'In your next session, keep filler phrases under 3 total.',
      },
    },
    {
      score: Math.max(0, stats.answersCount - stats.quantifiedAnswers),
      target: {
        title: 'Add measurable outcomes to more answers',
        description: `Only ${stats.quantifiedAnswers} of ${stats.answersCount} answers included concrete metrics or outcomes.`,
        action: 'Rewrite your top five behavioral stories with one metric per story (time saved, %, revenue, quality, or scope).',
        successMetric: 'At least 70% of behavioral answers include a measurable outcome.',
      },
    },
    {
      score: stats.shortAnswers,
      target: {
        title: 'Avoid overly short answers',
        description: `${stats.shortAnswers} answers were too brief, which made follow-ups feel defensive instead of complete.`,
        action: 'Use a simple 3-part structure: context, your action, then result.',
        successMetric: 'Keep most answers in the 45–120 second range.',
      },
    },
    {
      score: Math.round((1 - stats.listeningOverlap) * 100),
      target: {
        title: 'Improve direct response to the exact question',
        description: 'A few responses pivoted quickly to prepared stories instead of directly answering the interviewer prompt.',
        action: 'Start each answer by restating the key question in one short sentence before your example.',
        successMetric: 'Listening Accuracy score improves by at least 8 points next session.',
      },
    },
    {
      score: Math.round((1 - stats.companyKeywordCoverage) * 100),
      target: {
        title: 'Use more role-specific language from the JD',
        description: 'Your answers did not consistently mirror the role language and priorities from the job description.',
        action: 'Highlight 8 role keywords from the JD and intentionally weave 4-6 into your next interview.',
        successMetric: 'Company Fit Language score reaches 65+ in the next run.',
      },
    },
  ]

  const sorted = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.target)

  while (sorted.length < 3) {
    sorted.push({
      title: 'Sharpen answer openings',
      description: 'A stronger first sentence helps interviewers quickly understand your point.',
      action: 'Practice delivering your first sentence in one breath with no filler words.',
      successMetric: 'Opening sentence is clear and specific in all core answers.',
    })
  }

  return sorted
}

function buildScoreDetails(stats: Stats, scores: ReturnType<typeof deriveScores>) {
  return {
    answerQuality: {
      observations: [
        `${stats.quantifiedAnswers}/${Math.max(stats.answersCount, 1)} answers included measurable outcomes.`,
        `${stats.strongCount} moments were classified as strong, with clear structure and ownership.`,
        `Average answer length was ${Math.round(stats.avgWords)} words.`,
      ],
      weakness: stats.shortAnswers > 0
        ? `${stats.shortAnswers} answers were too brief to fully demonstrate impact.`
        : 'A few answers still need tighter outcome statements.',
    },
    deliveryConfidence: {
      observations: [
        `Filler phrases detected: ${stats.fillerCount}.`,
        `Uncertainty cues detected: ${stats.uncertainCount}.`,
        `Delivery confidence score reflects language precision and pacing consistency.`,
      ],
      weakness: stats.fillerCount > 3
        ? 'Filler language under pressure reduced confidence signals.'
        : 'Maintain this confidence level when questions become more adversarial.',
    },
    pressureRecovery: {
      observations: [
        `${stats.droppedCount} dropped moments occurred under pressure.`,
        `${stats.recoveredFromDrops} of those were followed by a stronger recovery answer.`,
        `Pressure handling improved when you paused before answering.`,
      ],
      weakness: stats.droppedCount > stats.recoveredFromDrops
        ? 'After difficult follow-ups, some answers became less specific.'
        : 'Continue improving consistency on back-to-back challenging prompts.',
    },
    companyFitLanguage: {
      observations: [
        `Role/JD keyword coverage score: ${scores.companyFitLanguage}/100.`,
        `Keyword hits in candidate answers: ${stats.companyKeywordHits}.`,
        `Language alignment was strongest when discussing real project trade-offs.`,
      ],
      weakness: scores.companyFitLanguage < 60
        ? 'Company-specific language did not appear consistently enough.'
        : 'Keep using role-specific vocabulary naturally, not as isolated keywords.',
    },
    listeningAccuracy: {
      observations: [
        `Question-to-answer topical overlap averaged ${Math.round(stats.listeningOverlap * 100)}%.`,
        `Most answers tracked the interviewer prompt directly before expanding.`,
        `Listening accuracy improved on follow-up questions with clear constraints.`,
      ],
      weakness: scores.listeningAccuracy < 65
        ? 'Some answers pivoted too quickly to prepared stories.'
        : 'Maintain this directness, especially in rapid follow-up sequences.',
    },
  }
}

function buildHiringAssessment(scores: ReturnType<typeof deriveScores>, companyName: string, jobTitle: string) {
  const reasonsYes = [
    `Answer quality reached ${scores.answerQuality}/100 with multiple concrete examples.`,
    `Listening accuracy remained focused on interviewer intent (${scores.listeningAccuracy}/100).`,
    `Pressure handling stayed workable (${scores.pressureRecovery}/100), indicating coachability.`,
  ]
  const reasonsNo = [
    `Delivery confidence (${scores.deliveryConfidence}/100) still dips under pressure.`,
    `Company language alignment (${scores.companyFitLanguage}/100) needs stronger role mirroring.`,
    'Several moments needed clearer measurable outcomes to feel promotion-ready.',
  ]
  const wouldAdvance = scores.hiringProbability >= 65

  return {
    wouldAdvance,
    reasonsYes,
    reasonsNo,
    comparisonToRoleRequirements: `For ${jobTitle} at ${companyName}, this performance shows real potential but still needs tighter specificity and stronger company-context language to consistently clear this stage.`,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const limiter = await checkRateLimit(`debrief:${userId}`, 20, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many debrief requests. Please wait and retry.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }
    const { sessionId } = params

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        exchanges: { orderBy: { sequenceNumber: 'asc' } },
        analysis: true,
        application: true,
      },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const exchanges = interviewSession.exchanges || []
    const pairs = buildPairs(exchanges)
    const jdKeywords = extractKeywords(interviewSession.application?.jdText)
    const momentMap = buildMomentMap(pairs)
    const stats = computeStats(pairs, momentMap, jdKeywords)

    let computedScores = deriveScores(stats)
    let nextTargets = buildNextTargets(stats)
    let coachScript = `You handled this session with clear effort. Focus next on tighter outcomes, stronger confidence language, and sharper role-specific framing to raise your next result.`

    const exchangeText = exchanges
      .map((e) => `${e.speaker}: ${e.messageText}`)
      .join('\n')
      .slice(0, 9000)

    if (isAIServiceConfigured() && exchangeText.length > 0) {
      try {
        const [scoresResult, coachResult] = await Promise.all([
          chatCompletionJSONValidated(
            debriefScoringSystemPrompt,
            `Analyze this transcript and return JSON with:
- answerQuality (0-100)
- deliveryConfidence (0-100)
- pressureRecovery (0-100)
- companyFitLanguage (0-100)
- listeningAccuracy (0-100)
- hiringProbability (0-100)
- nextTargets (exactly 3 items with title, description, action, successMetric)

Transcript:
${exchangeText}`,
            DebriefScoreSchema,
            { temperature: 0.4 }
          ),
          chatCompletion(
            debriefCoachSystemPrompt,
            `Candidate name: ${(session.user as { name?: string }).name || 'Candidate'}
Role: ${interviewSession.application.jobTitle}
Company: ${interviewSession.application.companyName}

Transcript:
${exchangeText}`,
            { temperature: 0.5, maxTokens: 260 }
          ),
        ])

        computedScores = {
          answerQuality: scoresResult.answerQuality,
          deliveryConfidence: scoresResult.deliveryConfidence,
          pressureRecovery: scoresResult.pressureRecovery,
          companyFitLanguage: scoresResult.companyFitLanguage,
          listeningAccuracy: scoresResult.listeningAccuracy,
          hiringProbability: scoresResult.hiringProbability,
        }
        nextTargets = scoresResult.nextTargets
        coachScript = coachResult.trim() || coachScript
      } catch (aiError) {
        console.error('AI debrief generation failed, using deterministic analysis:', aiError)
      }
    }

    const persisted = interviewSession.analysis
      ? await prisma.sessionAnalysis.update({
          where: { sessionId },
          data: {
            momentMap: JSON.stringify(momentMap),
            answerQuality: computedScores.answerQuality,
            deliveryConfidence: computedScores.deliveryConfidence,
            pressureRecovery: computedScores.pressureRecovery,
            companyFitLanguage: computedScores.companyFitLanguage,
            listeningAccuracy: computedScores.listeningAccuracy,
            hiringProbability: computedScores.hiringProbability,
            nextTargets: JSON.stringify(nextTargets),
            coachScript,
          },
        })
      : await prisma.sessionAnalysis.create({
          data: {
            sessionId,
            momentMap: JSON.stringify(momentMap),
            answerQuality: computedScores.answerQuality,
            deliveryConfidence: computedScores.deliveryConfidence,
            pressureRecovery: computedScores.pressureRecovery,
            companyFitLanguage: computedScores.companyFitLanguage,
            listeningAccuracy: computedScores.listeningAccuracy,
            hiringProbability: computedScores.hiringProbability,
            nextTargets: JSON.stringify(nextTargets),
            coachScript,
          },
        })

    const scoreDetails = buildScoreDetails(stats, computedScores)
    const hiringAssessment = buildHiringAssessment(
      computedScores,
      interviewSession.application.companyName,
      interviewSession.application.jobTitle
    )

    const progression = await prisma.interviewSession.findMany({
      where: {
        userId,
        applicationId: interviewSession.applicationId,
        status: 'completed',
      },
      select: {
        id: true,
        createdAt: true,
        analysis: {
          select: {
            hiringProbability: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const progressSeries = progression
      .filter((s) => s.analysis?.hiringProbability != null)
      .map((s, idx) => ({
        sessionId: s.id,
        label: `S${idx + 1}`,
        probability: s.analysis?.hiringProbability ?? 0,
        createdAt: s.createdAt,
      }))

    return NextResponse.json({
      session: interviewSession,
      analysis: {
        ...persisted,
        momentMap,
        nextTargets,
        scoreDetails,
        hiringAssessment,
        progressSeries,
      },
    })
  } catch (error) {
    console.error('Debrief API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
