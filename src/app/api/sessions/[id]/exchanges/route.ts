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
  avatarColor?: string
  voiceId?: string
}

interface QuestionPlanItem {
  questionText: string
  questionType: string
  priority: number
  ownerId: string
  ownerArchetype: string
}

interface QuestionState {
  currentQuestionIndex: number
  followUpCount: number
  sessionShouldEnd: boolean
}

// ---------------------------------------------------------------------------
// Full archetype behavioral prompts (spec 1.3)
// ---------------------------------------------------------------------------

const ARCHETYPE_FULL_PROMPTS: Record<string, string> = {

  skeptic: `You are The Skeptic interviewer.
BEHAVIOR:
- Ask for specifics after broad claims
- Push for numbers, percentages, timelines
- Challenge "we did" by asking for personal role
- Tone: direct, measured, professional — not warm, not hostile
- NEVER affirm. Never say "great", "interesting", "thanks for sharing", "I appreciate that"
- If answer is vague, re-ask: "I need you to be more specific about [X]."
PHRASING: "Be specific.", "What was your role exactly?", "Walk me through the numbers.", "What was the measurable outcome?"
NEVER SAY: "Great", "Love that", "Awesome", "That's really interesting"
RESPONSE LENGTH: 1-2 sentences. Max 3.`,

  friendly_champion: `You are The Friendly Champion interviewer.
BEHAVIOR:
- Warm, encouraging, genuine
- Use "tell me more" to get them talking — this is strategic
- After a long answer, ask ONE sharp follow-up about an edge case or inconsistency
- Show you're listening by referencing specific things they said
- You like the candidate but you're still evaluating
PHRASING: "Tell me more about that.", "That's a great example — what would you have done differently if [constraint changed]?", "Oh interesting, and then what happened?"
RESPONSE LENGTH: 1-3 sentences. Warm but concise.`,

  technical_griller: `You are The Technical Griller interviewer.
BEHAVIOR:
- Zero pleasantries. Zero warmth. Immediate question, no warmup.
- Ask about methodology, tradeoffs, edge cases, failure handling
- If vague, repeat the EXACT same question: "That's not what I asked. [repeat verbatim]"
- Focus on what went WRONG, not just right
- Ask about tradeoffs: "What did you consider and reject?"
PHRASING: "Walk me through the implementation.", "What tradeoffs did you consider?", "How did you handle the failure case?", "That's not what I asked."
NEVER SAY: "Great job", "Nice", any encouragement
RESPONSE LENGTH: 1-2 sentences. Blunt.`,

  distracted_senior: `You are The Distracted Senior interviewer.
BEHAVIOR:
- Occasionally ask candidate to repeat: "Sorry, say that again?"
- Shift between brief engagement and abrupt topic pivots
- Care about big picture / strategic vision, not tactical details
- Cut answers short: "Yeah I get it. But what about [different angle]?"
- Your LAST question should be sharp and prove you were paying attention all along
PHRASING: "Sorry, can you repeat that?", "Right, right... so what's the strategic angle?", "Where do you see this in 3 years?"
RESPONSE LENGTH: 1-2 sentences, sometimes cut short.`,

  culture_fit: `You are The Culture Fit Assessor interviewer.
BEHAVIOR:
- Relaxed, conversational, warm. NEVER technical.
- Focus on values, collaboration, conflict, communication style
- Probe word choices: "You said 'pushed back' — tell me more about how you handle disagreements"
- Ask about team dynamics, not individual achievement
PHRASING: "How would your colleagues describe you?", "Tell me about a time you had to compromise.", "What kind of environment brings out your best work?"
NEVER ASK: Technical questions, system design, coding, architecture
RESPONSE LENGTH: 1-2 sentences. Conversational.`,

  silent_observer: `You are The Silent Observer interviewer.
BEHAVIOR:
- You DO NOT SPEAK during the interview. Respond only with "..." or "*nods*"
- EXCEPTION: When explicitly told this is your final turn, ask ONE sharp question referencing something specific from early in the interview that connects to something said recently.
BEFORE FINAL TURN: "..." — nothing else
FINAL TURN: Exactly 1 sentence. Sharp. Unexpected. Shows you were listening the entire time.`,
}

// Silence duration ranges per archetype [min_ms, max_ms]
const ARCHETYPE_SILENCE_MS: Record<string, [number, number]> = {
  skeptic: [3000, 4000],
  friendly_champion: [1000, 2000],
  technical_griller: [4000, 5000],
  distracted_senior: [1000, 8000],
  culture_fit: [2000, 3000],
  silent_observer: [0, 0],
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

// ---------------------------------------------------------------------------
// POST — exchange endpoint with owner-based conversation flow
// ---------------------------------------------------------------------------

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
    const { messageText } = body

    if (!messageText?.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
    }

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        exchanges: {
          orderBy: { sequenceNumber: 'desc' },
          take: 20,
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

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (interviewSession.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active. Start the session first.' },
        { status: 400 }
      )
    }

    // Parse characters
    const characters: Character[] = Array.isArray(interviewSession.characters)
      ? (interviewSession.characters as unknown as Character[])
      : []

    if (characters.length === 0) {
      return NextResponse.json({ error: 'No characters in this session' }, { status: 400 })
    }

    const lastSequence = interviewSession.exchanges[0]?.sequenceNumber ?? 0
    const now = Date.now()
    const sessionStartMs = interviewSession.startedAt
      ? interviewSession.startedAt.getTime()
      : now
    const elapsedMs = now - sessionStartMs
    const targetDurationMin = (interviewSession as unknown as { targetDurationMin?: number }).targetDurationMin || 45

    // -----------------------------------------------------------------------
    // Step 1: Read session state
    // -----------------------------------------------------------------------

    const sessionEvents = (interviewSession.unexpectedEvents as Record<string, unknown>) || {}
    const questionPlan = (sessionEvents.questionPlan as QuestionPlanItem[]) || []

    const questionState: QuestionState = (sessionEvents.questionState as QuestionState) || {
      currentQuestionIndex: 0,
      followUpCount: 0,
      sessionShouldEnd: false,
    }

    const currentQuestion = questionPlan[questionState.currentQuestionIndex]
    const nextQuestion = questionPlan[questionState.currentQuestionIndex + 1]

    // -----------------------------------------------------------------------
    // Step 2: Determine the responding character (OWNER responds, not rotation)
    // -----------------------------------------------------------------------

    let respondingCharacter: Character | undefined

    if (questionState.followUpCount === 0) {
      // First exchange on this question — the OWNER responds
      respondingCharacter = characters.find(c => c.id === currentQuestion?.ownerId)
    } else {
      // Follow-up: usually the same owner. 10% chance a different panelist jumps in.
      const jumpInChance = Math.random()
      if (jumpInChance < 0.10 && characters.length > 1) {
        const otherCharacters = characters.filter(c =>
          c.id !== currentQuestion?.ownerId && c.archetype !== 'silent_observer'
        )
        if (otherCharacters.length > 0) {
          respondingCharacter = otherCharacters[Math.floor(Math.random() * otherCharacters.length)]
        }
      }
      if (!respondingCharacter) {
        respondingCharacter = characters.find(c => c.id === currentQuestion?.ownerId)
      }
    }

    // Fallback
    if (!respondingCharacter) {
      respondingCharacter = characters.find(c => c.archetype !== 'silent_observer') || characters[0]
    }

    // -----------------------------------------------------------------------
    // Step 3: Decide follow-up vs move-on (weighted randomness, NO LLM call)
    // -----------------------------------------------------------------------

    let shouldMoveOn = true // DEFAULT is move on
    let followUpHint = ''

    if (questionState.followUpCount >= 2) {
      // Already had 2 follow-ups. Always move on.
      shouldMoveOn = true
    } else if (questionState.followUpCount === 0) {
      // First answer. Usually move on, sometimes follow up (~25-30% based on quality).
      const candidateText = messageText.toLowerCase()
      const wordCount = messageText.trim().split(/\s+/).length

      const isVeryShort = wordCount < 20
      const usesWeLanguage = /\bwe\b/.test(candidateText) && !/\bi\b/.test(candidateText)
      const isVague = /\b(sort of|kind of|i think|i guess|maybe|probably|stuff|things)\b/.test(candidateText)
      const hasNoNumbers = !/\d/.test(candidateText)

      let followUpProbability = 0.15 // base 15%
      if (isVeryShort) { followUpProbability += 0.35; followUpHint = 'The answer was very brief. Ask them to elaborate.' }
      else if (usesWeLanguage) { followUpProbability += 0.25; followUpHint = 'They used "we" without "I". Ask about their personal role.' }
      else if (isVague && hasNoNumbers) { followUpProbability += 0.20; followUpHint = 'The answer was vague with no specifics. Push for concrete details.' }
      else if (isVague) { followUpProbability += 0.10; followUpHint = 'Somewhat vague. Could probe for specifics.' }

      // Archetype modifier
      if (respondingCharacter.archetype === 'skeptic') followUpProbability += 0.15
      if (respondingCharacter.archetype === 'technical_griller') followUpProbability += 0.20
      if (respondingCharacter.archetype === 'friendly_champion') followUpProbability += 0.05

      followUpProbability = Math.min(followUpProbability, 0.70)
      shouldMoveOn = Math.random() > followUpProbability
    } else {
      // Already had 1 follow-up. 80% chance to move on now.
      shouldMoveOn = Math.random() < 0.80
    }

    // -----------------------------------------------------------------------
    // Step 4: Build the system prompt
    // -----------------------------------------------------------------------

    const archetypePrompt = ARCHETYPE_FULL_PROMPTS[respondingCharacter.archetype] || ARCHETYPE_FULL_PROMPTS.friendly_champion
    const app = interviewSession.application

    // Build conversation history (chronological)
    const history = interviewSession.exchanges
      .slice()
      .reverse()
      .map(ex => {
        if (ex.speaker === 'candidate') return `Candidate: ${ex.messageText}`
        const charName = characters.find(c => c.id === ex.characterId)?.name || 'Interviewer'
        return `${charName}: ${ex.messageText}`
      })
      .join('\n')

    // Build action instruction
    let actionInstruction = ''

    if (shouldMoveOn && nextQuestion) {
      const nextOwner = characters.find(c => c.id === nextQuestion.ownerId)
      const isSameOwner = nextQuestion.ownerId === respondingCharacter.id

      if (isSameOwner) {
        actionInstruction = `ACTION: You are done with the current question. Transition to your next question.
Your next question: "${nextQuestion.questionText}"
- Acknowledge the answer briefly (1 short sentence max, or just transition directly)
- Then ask your next question naturally
- Do NOT say "next question" or "moving on" or "let's switch gears"
- Keep total response to 2-3 sentences`
      } else {
        actionInstruction = `ACTION: You are done with this question. Wrap up briefly.
- Give a brief acknowledgment (1 sentence max) like "Thanks" or "Got it" or just nod
- Do NOT ask another question — the next question belongs to ${nextOwner?.name || 'another panelist'}
- Keep response to 1 sentence max`
      }
    } else if (shouldMoveOn && !nextQuestion) {
      actionInstruction = `ACTION: This was the last question. Wrap up the interview.
- Thank the candidate for their time
- Mention one specific thing from the interview that stood out
- Say the team will be in touch
- Keep to 2-3 sentences`
    } else {
      // Follow up
      if (followUpHint) {
        actionInstruction = `ACTION: Follow up on this question. ${followUpHint}
- Stay on the same topic
- Reference something specific the candidate just said
- Keep to 1-2 sentences max
- Do NOT start a new topic`
      } else {
        actionInstruction = `ACTION: Ask one brief follow-up about the most interesting or unclear part of their answer.
- Stay on the same topic
- Keep to 1-2 sentences max`
      }
    }

    // Check if a different panelist is jumping in
    const isJumpIn = respondingCharacter.id !== currentQuestion?.ownerId
    let jumpInPrefix = ''
    if (isJumpIn && !shouldMoveOn) {
      const ownerName = characters.find(c => c.id === currentQuestion?.ownerId)?.name || 'the previous interviewer'
      jumpInPrefix = `You are jumping in on ${ownerName}'s question. Start with something like "Just to add to that —" or "I'm curious about something you mentioned —" to make it natural. Keep it brief (1 sentence question).`
    }

    // -----------------------------------------------------------------------
    // Step 5: Handle session ending
    // -----------------------------------------------------------------------

    const targetMs = targetDurationMin * 60 * 1000
    let sessionEnded = false

    if (shouldMoveOn && !nextQuestion) {
      sessionEnded = true
    } else if (elapsedMs >= targetMs && shouldMoveOn) {
      sessionEnded = true
    }

    // Silent Observer gets one final question before ending
    const silentObserver = characters.find(c => c.archetype === 'silent_observer')
    if (sessionEnded && silentObserver && !questionState.sessionShouldEnd) {
      const observerHasSpoken = interviewSession.exchanges.some(
        e => e.characterId === silentObserver.id && e.messageText.length > 10
      )
      if (!observerHasSpoken) {
        // Override: Silent Observer speaks BEFORE closing
        respondingCharacter = silentObserver
        sessionEnded = false // delay by one more exchange
        actionInstruction = `ACTION: This is your ONE moment to speak. The interview is about to end. Ask ONE pointed question that references something specific the candidate said early in the interview. Show you were listening the entire time. One sentence only.`
        jumpInPrefix = ''
        // Mark that we've given the observer their turn
        questionState.sessionShouldEnd = true
      }
    }

    // If observer already spoke and we're ending
    if (questionState.sessionShouldEnd && shouldMoveOn) {
      sessionEnded = true
      // Override to friendly closer
      const closer = characters.find(c => c.archetype === 'friendly_champion') ||
        characters.find(c => c.archetype !== 'silent_observer') || characters[0]
      if (respondingCharacter.archetype === 'silent_observer') {
        respondingCharacter = closer
      }
      actionInstruction = `ACTION: This was the last question. Wrap up the interview.
- Thank the candidate for their time
- Mention one specific thing from the interview that stood out
- Say the team will be in touch
- Keep to 2-3 sentences`
    }

    const systemPrompt = `${archetypePrompt}

YOU ARE: ${respondingCharacter.name}, ${respondingCharacter.title}
COMPANY: ${app.companyName}
ROLE: ${app.jobTitle}

CONVERSATION SO FAR:
${history || '(Interview just started)'}

CURRENT QUESTION (#${questionState.currentQuestionIndex + 1} of ${questionPlan.length}): "${currentQuestion?.questionText || 'General question'}"
${jumpInPrefix}

${actionInstruction}

RULES:
- Stay in character. Never break character or mention AI/simulation.
- React to what the candidate ACTUALLY said. Reference their words.
- Keep total response to 1-3 sentences max. Real interviewers are concise.
- Do NOT start with "That's a great question" or "Thanks for sharing that" unless your archetype specifically allows warmth.
- If the candidate asks YOU a question, answer briefly in character, then continue with your action.`

    // -----------------------------------------------------------------------
    // Step 6: Generate response
    // -----------------------------------------------------------------------

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

    let responseText: string

    if (isAIConfigured()) {
      try {
        responseText = await chatCompletion(systemPrompt, `The candidate just said: "${messageText}"`, {
          temperature: 0.85,
          maxTokens: 200,
          taskType: 'live_conversation',
        })
      } catch {
        responseText = randomFrom(FALLBACK_RESPONSES[respondingCharacter.archetype] || FALLBACK_RESPONSES.friendly_champion)
      }
    } else {
      responseText = randomFrom(FALLBACK_RESPONSES[respondingCharacter.archetype] || FALLBACK_RESPONSES.friendly_champion)
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

    // -----------------------------------------------------------------------
    // Step 7: Update state and return
    // -----------------------------------------------------------------------

    // Determine who asks the NEXT question (for the frontend)
    let nextCharacterId: string | null = null
    if (shouldMoveOn && nextQuestion) {
      nextCharacterId = nextQuestion.ownerId
    } else {
      // Same character continues (follow-up or same question)
      nextCharacterId = respondingCharacter.id
    }

    const newState: QuestionState = {
      currentQuestionIndex: shouldMoveOn
        ? questionState.currentQuestionIndex + 1
        : questionState.currentQuestionIndex,
      followUpCount: shouldMoveOn ? 0 : questionState.followUpCount + 1,
      sessionShouldEnd: sessionEnded || questionState.sessionShouldEnd,
    }

    const updatedEvents = JSON.parse(JSON.stringify({ ...sessionEvents, questionState: newState }))
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { unexpectedEvents: updatedEvents },
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
        avatarColor: (respondingCharacter as Character & { avatarColor?: string }).avatarColor || '#5b5fc7',
      },
      sessionEnded,
      nextCharacterId,
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
