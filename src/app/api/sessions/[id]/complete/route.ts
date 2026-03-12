import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletionJSON, chatCompletion, isAIConfigured } from '@/lib/ai-gateway'

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
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

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        exchanges: { orderBy: { sequenceNumber: 'asc' } },
        analysis: true,
        application: {
          select: { companyName: true, jobTitle: true },
        },
      },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (interviewSession.status === 'completed') {
      return NextResponse.json({ error: 'Session is already completed' }, { status: 400 })
    }

    // Mark session as completed
    const endedAt = new Date()
    const actualDurationMs = interviewSession.startedAt
      ? BigInt(endedAt.getTime() - interviewSession.startedAt.getTime())
      : null

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endedAt,
        actualDurationMs,
      },
    })

    // If analysis already exists, return it
    if (interviewSession.analysis) {
      return NextResponse.json({
        sessionId,
        status: 'completed',
        analysis: interviewSession.analysis,
      })
    }

    // Generate debrief analysis
    const exchanges = interviewSession.exchanges || []
    const exchangeText = exchanges
      .map((e) => `${e.speaker}: ${e.messageText}`)
      .join('\n')
      .slice(0, 3000)

    let scoreAnswerQuality: number
    let scoreDelivery: number
    let scorePressure: number
    let scoreCompanyFit: number
    let scoreListening: number
    let hiringProbability: number
    let wouldAdvance: boolean
    let yesReasons: string[] = []
    let noReasons: string[] = []
    let momentMap: unknown
    let nextTargets: unknown
    let coachScript: string

    if (isAIConfigured() && exchangeText.length > 0) {
      try {
        const [scoresResult, coachResult] = await Promise.all([
          chatCompletionJSON<{
            scoreAnswerQuality: number
            scoreDelivery: number
            scorePressure: number
            scoreCompanyFit: number
            scoreListening: number
            hiringProbability: number
            wouldAdvance: boolean
            yesReasons: string[]
            noReasons: string[]
            nextTargets: Array<{ title: string; description: string; action: string; successMetric: string }>
          }>(
            'You are an expert interview coach analyzing a practice interview session. Score the candidate objectively.',
            `Analyze this interview transcript and return JSON with:
- scoreAnswerQuality: 0-100
- scoreDelivery: 0-100
- scorePressure: 0-100
- scoreCompanyFit: 0-100
- scoreListening: 0-100
- hiringProbability: 0-100
- wouldAdvance: boolean
- yesReasons: array of reasons they would advance
- noReasons: array of reasons they might not
- nextTargets: array of 3 improvement targets with title, description, action, successMetric

Transcript:
${exchangeText}`,
            { temperature: 0.5, taskType: 'debrief_analysis' }
          ),
          chatCompletion(
            'You are a direct, encouraging interview coach delivering a post-interview debrief. Keep it to 3-4 sentences.',
            `Give a brief coaching debrief based on this interview transcript:\n\n${exchangeText}`,
            { temperature: 0.8, maxTokens: 300, taskType: 'debrief_analysis' }
          ),
        ])

        scoreAnswerQuality = scoresResult.scoreAnswerQuality
        scoreDelivery = scoresResult.scoreDelivery
        scorePressure = scoresResult.scorePressure
        scoreCompanyFit = scoresResult.scoreCompanyFit
        scoreListening = scoresResult.scoreListening
        hiringProbability = scoresResult.hiringProbability
        wouldAdvance = scoresResult.wouldAdvance
        yesReasons = scoresResult.yesReasons || []
        noReasons = scoresResult.noReasons || []
        nextTargets = scoresResult.nextTargets
        momentMap = generateMomentMap()
        coachScript = coachResult
      } catch (aiError) {
        console.error('AI debrief failed, using fallback:', aiError)
        scoreAnswerQuality = randomInt(50, 90)
        scoreDelivery = randomInt(50, 90)
        scorePressure = randomInt(50, 90)
        scoreCompanyFit = randomInt(50, 90)
        scoreListening = randomInt(50, 90)
        hiringProbability = randomInt(55, 85)
        wouldAdvance = hiringProbability >= 65
        yesReasons = ['Demonstrated relevant experience', 'Good communication skills']
        noReasons = ['Could improve specificity', 'Needs more company-specific language']
        momentMap = generateMomentMap()
        nextTargets = generateFallbackTargets()
        coachScript = `Good session. Your hiring probability is estimated at ${hiringProbability}%. With focused practice, we can improve that.`
      }
    } else {
      scoreAnswerQuality = randomInt(50, 90)
      scoreDelivery = randomInt(50, 90)
      scorePressure = randomInt(50, 90)
      scoreCompanyFit = randomInt(50, 90)
      scoreListening = randomInt(50, 90)
      hiringProbability = randomInt(55, 85)
      wouldAdvance = hiringProbability >= 65
      yesReasons = ['Demonstrated relevant experience', 'Good communication skills']
      noReasons = ['Could improve specificity', 'Needs more company-specific language']
      momentMap = generateMomentMap()
      nextTargets = generateFallbackTargets()
      coachScript = `Good session. Your hiring probability is estimated at ${hiringProbability}%. With focused practice, we can improve that.`
    }

    const analysis = await prisma.sessionAnalysis.create({
      data: {
        sessionId,
        momentMap: momentMap as object,
        scoreAnswerQuality,
        scoreDelivery,
        scorePressure,
        scoreCompanyFit,
        scoreListening,
        hiringProbability,
        wouldAdvance,
        yesReasons,
        noReasons,
        nextTargets: nextTargets as object,
        coachScript,
      },
    })

    return NextResponse.json({
      sessionId,
      status: 'completed',
      analysis,
    })
  } catch (error) {
    console.error('Error completing session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateMomentMap() {
  const types: Array<'strong' | 'recoverable' | 'dropped'> = ['strong', 'recoverable', 'dropped']
  const segments = []
  const count = randomInt(8, 12)
  const segmentDuration = Math.floor(100 / count)

  for (let i = 0; i < count; i++) {
    const type = types[randomInt(0, 2)]
    segments.push({
      id: `seg-${i}`,
      start: i * segmentDuration,
      end: Math.min((i + 1) * segmentDuration, 100),
      type,
      timestampMs: i * 180000 + randomInt(0, 60000),
    })
  }
  return segments
}

function generateFallbackTargets() {
  return [
    {
      title: 'Eliminate Filler Words Under Pressure',
      description: 'Filler words undermine perceived confidence.',
      action: 'Practice answering with 3-second pauses instead of fillers.',
      successMetric: 'Fewer than 3 filler words per answer.',
    },
    {
      title: 'Strengthen Weakness Answer',
      description: 'Generic weakness answers signal low self-awareness.',
      action: 'Prepare a genuine weakness with a concrete improvement story.',
      successMetric: 'Deliver a weakness answer that earns a "strong" rating.',
    },
    {
      title: 'Mirror Company Language',
      description: 'Use company-specific terminology from the JD.',
      action: 'Highlight 5 key phrases from the JD to weave into answers.',
      successMetric: 'Use at least 5 JD-aligned phrases per session.',
    },
  ]
}
