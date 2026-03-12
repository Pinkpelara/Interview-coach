import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletion, isAIConfigured } from '@/lib/ai-gateway'

export const dynamic = 'force-dynamic'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  voiceId?: string
}

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  skeptic: 'You are a skeptical interviewer who challenges every claim. You demand specifics, metrics, and evidence. You push back on vague answers.',
  friendly_champion: 'You are a warm, enthusiastic interviewer who builds rapport. You are warm but strategic.',
  technical_griller: 'You are a technical interviewer with zero tolerance for hand-waving. You want implementation details, system design, architecture decisions.',
  distracted_senior: 'You are a senior executive who is somewhat distracted. You care about business impact and ROI.',
  culture_fit: 'You are focused on team dynamics, values, and cultural alignment.',
  silent_observer: 'You are quiet and observant. You give minimal responses. Respond in 1-10 words max.',
}

const FALLBACK_RESPONSES: Record<string, string[]> = {
  skeptic: [
    'Can you be more specific about the actual impact you had?',
    'What was the measurable outcome of that initiative?',
    'Walk me through the decision-making process.',
  ],
  friendly_champion: [
    "That's really interesting, tell me more about how you approached that.",
    'I love that example! How did the team respond?',
    "That's exactly the kind of initiative we value.",
  ],
  technical_griller: [
    'Walk me through exactly how you implemented that.',
    'How did you handle edge cases?',
    'What tradeoffs did you consider?',
  ],
  distracted_senior: [
    'Right, right... So how does this tie back to business impact?',
    "That's fine. What I really want to understand is the strategic vision.",
    "Let's fast-forward. Where do you see this role in three years?",
  ],
  culture_fit: [
    'How would your closest colleagues describe your working style?',
    'What kind of work environment brings out your best performance?',
    'Tell me about a time you went above and beyond for a colleague.',
  ],
  silent_observer: ['...', '*nods slowly*', 'Hmm.', 'I see.', 'Interesting.'],
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
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
    const { messageText, characterId } = body

    if (!messageText?.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
    }

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        exchanges: {
          orderBy: { sequenceNumber: 'desc' },
          take: 16,
        },
        application: {
          select: {
            companyName: true,
            jobTitle: true,
            jdText: true,
          },
        },
      },
    })
    // Note: unexpectedEvents (which stores questionPlan) is included by default as a scalar field

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (interviewSession.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active. Start the session first.' },
        { status: 400 }
      )
    }

    // Parse characters (Json field)
    const characters: Character[] = Array.isArray(interviewSession.characters)
      ? (interviewSession.characters as unknown as Character[])
      : []

    let respondingCharacter: Character | undefined
    if (characterId) {
      respondingCharacter = characters.find((c) => c.id === characterId)
    }
    if (!respondingCharacter) {
      respondingCharacter = characters[0]
    }
    if (!respondingCharacter) {
      return NextResponse.json({ error: 'No characters in this session' }, { status: 400 })
    }

    const lastSequence = interviewSession.exchanges[0]?.sequenceNumber ?? 0
    const now = Date.now()
    const sessionStartMs = interviewSession.startedAt
      ? interviewSession.startedAt.getTime()
      : now

    const exchangeCount = await prisma.sessionExchange.count({
      where: { sessionId },
    })

    // Build conversation history
    const conversationHistory = interviewSession.exchanges
      .slice()
      .reverse()
      .map((ex) => `${ex.speaker === 'candidate' ? 'Candidate' : respondingCharacter!.name}: ${ex.messageText}`)
      .join('\n')

    // Extract question plan from session data
    const sessionEvents = interviewSession.unexpectedEvents as Record<string, unknown> | null
    const questionPlan = (sessionEvents?.questionPlan as Array<{ questionText: string; questionType: string; priority: number }>) || []

    // Estimate which question we're on based on interviewer exchange count
    // Each main question typically gets ~2-3 exchanges (question + follow-ups)
    const interviewerExchangeCount = interviewSession.exchanges.filter(e => e.speaker === 'interviewer').length
    const estimatedQuestionIndex = Math.min(
      Math.floor(interviewerExchangeCount / 2),
      questionPlan.length - 1
    )
    const currentQuestion = questionPlan[Math.max(0, estimatedQuestionIndex)]
    const nextQuestion = questionPlan[Math.min(estimatedQuestionIndex + 1, questionPlan.length - 1)]
    const exchangesSinceLastNewQuestion = interviewerExchangeCount % 2

    // Create candidate exchange
    const candidateExchange = await prisma.sessionExchange.create({
      data: {
        sessionId,
        sequenceNumber: lastSequence + 1,
        speaker: 'candidate',
        characterId: null,
        messageText: messageText.trim(),
        timestampMs: BigInt(now - sessionStartMs),
      },
    })

    // Generate AI response
    let responseText: string
    if (isAIConfigured()) {
      try {
        const archDesc = ARCHETYPE_DESCRIPTIONS[respondingCharacter.archetype] || ARCHETYPE_DESCRIPTIONS.friendly_champion
        const app = interviewSession.application

        // Build question plan context for the prompt
        let questionPlanSection = ''
        if (questionPlan.length > 0) {
          const questionList = questionPlan
            .map((q, i) => {
              const marker = i === estimatedQuestionIndex ? '→ CURRENT' :
                            i < estimatedQuestionIndex ? '✓ ASKED' : ''
              return `  ${i + 1}. [${q.questionType.toUpperCase()}] ${q.questionText} ${marker}`
            })
            .join('\n')

          questionPlanSection = `
INTERVIEW QUESTION PLAN (follow this order):
${questionList}

QUESTION FLOW RULES:
- You are currently on question ${estimatedQuestionIndex + 1} of ${questionPlan.length}: "${currentQuestion?.questionText || ''}"
- You have had ${exchangesSinceLastNewQuestion} follow-up exchange(s) on this question
- If the candidate has answered the current question adequately (or after 2-3 follow-ups), naturally transition to the next question: "${nextQuestion?.questionText || ''}"
- You may ask 1-2 follow-up questions to dig deeper before moving on, especially if the answer was vague
- Transition naturally — don't say "next question" or "moving on". Use phrases like "That's helpful. I'd also like to understand..." or "Great. Shifting gears a bit..." or "Thanks for sharing that. Let me ask you about..."
- If the candidate asks YOU a question, answer it briefly and in-character, then steer back to the interview plan
- Do NOT skip questions or jump ahead. Follow the order.
- If this is the closing question, wrap up warmly.`
        }

        const systemPrompt = `You are ${respondingCharacter.name}, ${respondingCharacter.title}, conducting a job interview at ${app.companyName} for the ${app.jobTitle} position. ${archDesc}

${conversationHistory ? `\nCONVERSATION SO FAR:\n${conversationHistory}` : ''}
${questionPlanSection}

Rules:
- Stay in character at all times
- Respond with 1-3 sentences only
- React to what the candidate actually said
- Never break character or mention you are an AI
- Follow the question plan but keep the conversation natural
- Ask follow-ups when the candidate's answer lacks depth or specifics`

        responseText = await chatCompletion(systemPrompt, `The candidate just said: "${messageText}"`, {
          temperature: 0.85,
          maxTokens: 250,
          taskType: 'live_conversation',
        })
      } catch {
        const fallbacks = FALLBACK_RESPONSES[respondingCharacter.archetype] || FALLBACK_RESPONSES.friendly_champion
        responseText = randomFrom(fallbacks)
      }
    } else {
      const fallbacks = FALLBACK_RESPONSES[respondingCharacter.archetype] || FALLBACK_RESPONSES.friendly_champion
      responseText = randomFrom(fallbacks)
    }

    // Create interviewer exchange
    const interviewerExchange = await prisma.sessionExchange.create({
      data: {
        sessionId,
        sequenceNumber: lastSequence + 2,
        speaker: 'interviewer',
        characterId: respondingCharacter.id,
        messageText: responseText,
        timestampMs: BigInt(now - sessionStartMs + 2000),
      },
    })

    return NextResponse.json({
      candidateExchange: {
        ...candidateExchange,
        timestampMs: candidateExchange.timestampMs.toString(),
      },
      interviewerExchange: {
        ...interviewerExchange,
        timestampMs: interviewerExchange.timestampMs.toString(),
      },
      character: {
        id: respondingCharacter.id,
        name: respondingCharacter.name,
        title: respondingCharacter.title,
        archetype: respondingCharacter.archetype,
      },
    })
  } catch (error) {
    console.error('Error creating exchange:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const exchanges = await prisma.sessionExchange.findMany({
      where: { sessionId },
      orderBy: { sequenceNumber: 'asc' },
    })

    return NextResponse.json(
      exchanges.map((e) => ({
        ...e,
        timestampMs: e.timestampMs.toString(),
      }))
    )
  } catch (error) {
    console.error('Error fetching exchanges:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
