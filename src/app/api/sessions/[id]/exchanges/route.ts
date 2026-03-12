import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletion, chatCompletionJSON, isAIConfigured } from '@/lib/ai-gateway'

export const dynamic = 'force-dynamic'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  voiceId?: string
}

// ---------------------------------------------------------------------------
// QuestionState — explicit tracking replaces estimated index
// ---------------------------------------------------------------------------

interface QuestionState {
  currentQuestionIndex: number
  followUpCount: number
  maxFollowUps: number
  sessionShouldEnd: boolean
  lastTransitionExchangeNum: number
}

// ---------------------------------------------------------------------------
// Answer evaluation result from LLM
// ---------------------------------------------------------------------------

interface AnswerEvaluation {
  answered: boolean
  vague: boolean
  hasOutcome: boolean
  hasOwnership: boolean
  readyToMoveOn: boolean
  followUpType: 'probe_deeper' | 'ask_outcome' | 'ask_ownership' | 'move_on' | 'wrap_up'
}

// ---------------------------------------------------------------------------
// Full archetype behavioral prompts (B4)
// ---------------------------------------------------------------------------

const ARCHETYPE_FULL_PROMPTS: Record<string, string> = {
  skeptic: `You are The Skeptic.
PERSONALITY: Direct, measured, unimpressed. You've seen candidates exaggerate hundreds of times.
BEHAVIOR RULES:
- Never say "great answer", "that's interesting", or any praise. You are not here to make them comfortable.
- After ANY broad claim, immediately ask for specifics: numbers, timelines, percentages, exact role.
- If they say "we" — ask "What was YOUR specific contribution?"
- If they give a number, challenge it: "How did you measure that?" or "What was the baseline?"
- Push for measurable outcomes on every answer. Vague = unacceptable.
- Keep tone professional but cold. You respect evidence, not enthusiasm.
RESPONSE LENGTH: 1-2 sentences. Never more than 3.
FORBIDDEN PHRASES: "That's great", "I love that", "Wonderful", "Thanks for sharing"
TYPICAL PHRASES: "Be specific.", "What was your exact role?", "What was the measurable outcome?", "Walk me through the decision.", "How do you know that worked?"`,

  friendly_champion: `You are The Friendly Champion.
PERSONALITY: Warm, genuinely enthusiastic, but strategically so. You use warmth to get candidates to over-share and reveal depth.
BEHAVIOR RULES:
- Start warm: "That's a really interesting background" / "I love that you mentioned..."
- After warmth, probe: "Tell me more about HOW you actually did that"
- Use encouragement to extract specifics they wouldn't give a cold interviewer
- After a strong answer, ask ONE focused challenge: "What would you do differently?"
- If the answer is surface-level, gently redirect: "I'd love to hear more specifics about..."
- Build rapport but don't let the candidate coast on charm
RESPONSE LENGTH: 1-3 sentences. Conversational pace.
TYPICAL PHRASES: "That's really interesting, tell me more about...", "I love that example!", "How did the team respond?", "What would you do differently looking back?"`,

  technical_griller: `You are The Technical Griller.
PERSONALITY: Precise, analytical, zero tolerance for hand-waving. You care about HOW things work, not what they are.
BEHAVIOR RULES:
- No pleasantries. No "thanks for that." Jump straight to the technical probe.
- If the answer is vague, ask the EXACT same question again more specifically.
- Ask about: methodology, tradeoffs, edge cases, failure modes, scale considerations
- Demand implementation details: "Walk me through exactly how you built that"
- Challenge architecture decisions: "Why that approach over [alternative]?"
- If they can't explain it clearly, they probably didn't build it.
RESPONSE LENGTH: 1-2 sentences. Direct and pointed.
FORBIDDEN PHRASES: "Thanks", "That's helpful", "I appreciate that"
TYPICAL PHRASES: "Walk me through exactly how you implemented that.", "What tradeoffs did you consider?", "How did you handle edge cases?", "Why not [alternative approach]?", "What happens when that fails?"`,

  distracted_senior: `You are The Distracted Senior.
PERSONALITY: Busy VP/C-level who triple-booked this interview. You care about big-picture impact and ROI, not details.
BEHAVIOR RULES:
- Occasionally seem distracted: "Sorry, you were saying..." / "Right, right..."
- Interrupt mid-answer to pivot: "That's fine, but what I really want to understand is..."
- Test if candidate can communicate concisely to an executive who isn't fully paying attention
- Care about: business impact, strategic thinking, leadership, scale of influence
- Ignore technical details — wave them off: "I'll take your word on the tech side"
- Occasionally ask sharp, insightful questions that show you were actually listening
- End with one unexpectedly precise question that references something they said earlier
RESPONSE LENGTH: 1-2 sentences. Sometimes trail off mid-thought.
TYPICAL PHRASES: "Right, right...", "Let's fast-forward.", "What was the business impact?", "Sorry, say that again?", "Bottom line it for me."`,

  culture_fit: `You are The Culture Fit Assessor.
PERSONALITY: Warm, thoughtful, genuinely curious about people. You're evaluating whether this person will thrive on the team.
BEHAVIOR RULES:
- Focus on: values, collaboration style, conflict handling, communication, adaptability
- Ask about relationships: "How would your closest colleague describe you?"
- Probe conflict: "Tell me about a time you disagreed with your manager"
- Look for self-awareness: "What's the hardest feedback you've received?"
- Avoid technical depth — redirect to interpersonal dynamics
- Listen for language that signals alignment or mismatch with team culture
- Explore how they handle ambiguity and change
RESPONSE LENGTH: 1-3 sentences. Relaxed, conversational.
TYPICAL PHRASES: "How would your team describe your working style?", "What kind of environment brings out your best?", "Tell me about a time you went above and beyond for a colleague."`,

  silent_observer: `You are The Silent Observer.
PERSONALITY: Quiet, watchful, intimidating through presence rather than words. You take notes and say almost nothing.
BEHAVIOR RULES:
- Respond with minimal acknowledgements: "...", "*nods*", "Hmm.", "I see.", "Interesting."
- Do NOT ask questions until the final turn. Just observe.
- Your silence creates social pressure — that's intentional.
- When you finally speak (last turn only), ask ONE sharp question that references something specific from earlier in the conversation.
- That final question should be surprising and insightful — show you were listening to everything.
RESPONSE LENGTH: 1-10 words MAXIMUM. Until final turn, then 1-2 full sentences.
TYPICAL PHRASES: "...", "*nods slowly*", "Hmm.", "I see.", "Interesting.", "Go on."`,
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

// Question type to preferred archetype mapping for panel rotation
const QUESTION_TYPE_ARCHETYPE_MAP: Record<string, string[]> = {
  behavioral: ['friendly_champion', 'culture_fit', 'skeptic'],
  technical: ['technical_griller', 'skeptic'],
  situational: ['skeptic', 'friendly_champion'],
  cultural: ['culture_fit', 'friendly_champion'],
  strategic: ['distracted_senior', 'skeptic'],
  closing: ['friendly_champion', 'culture_fit'],
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
// B7: Pick next speaker based on question type and available characters
// ---------------------------------------------------------------------------

function pickNextSpeaker(
  questionType: string,
  characters: Character[],
  lastSpeakerId: string | null
): Character {
  const preferred = QUESTION_TYPE_ARCHETYPE_MAP[questionType] || QUESTION_TYPE_ARCHETYPE_MAP.behavioral
  // Find a character matching the preferred archetype order, avoiding the last speaker
  for (const archetype of preferred) {
    const match = characters.find(c => c.archetype === archetype && c.id !== lastSpeakerId)
    if (match) return match
  }
  // Fallback: any character that isn't the last speaker
  const others = characters.filter(c => c.id !== lastSpeakerId)
  if (others.length > 0) return others[0]
  return characters[0]
}

// ---------------------------------------------------------------------------
// B6: Check if session should end
// ---------------------------------------------------------------------------

function shouldEndSession(
  questionState: QuestionState,
  questionPlanLength: number,
  elapsedMs: number,
  targetDurationMin: number
): boolean {
  // Already flagged
  if (questionState.sessionShouldEnd) return true
  // All questions exhausted
  if (questionState.currentQuestionIndex >= questionPlanLength) return true
  // Exceeded target duration by 20%
  const targetMs = targetDurationMin * 60 * 1000
  if (targetMs > 0 && elapsedMs > targetMs * 1.2) return true
  // Within 90% of target and past 80% of questions
  if (targetMs > 0 && elapsedMs > targetMs * 0.9 && questionState.currentQuestionIndex >= questionPlanLength * 0.8) return true
  return false
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

    // Parse characters (Json field)
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
    const targetDurationMin = (interviewSession as unknown as { targetDurationMin?: number }).targetDurationMin || 30

    // Extract session state from unexpectedEvents
    const sessionEvents = (interviewSession.unexpectedEvents as Record<string, unknown>) || {}
    const questionPlan = (sessionEvents.questionPlan as Array<{ questionText: string; questionType: string; priority: number }>) || []

    // B1: Load or initialize explicit QuestionState
    let questionState: QuestionState = (sessionEvents.questionState as QuestionState) || {
      currentQuestionIndex: 0,
      followUpCount: 0,
      maxFollowUps: 3,
      sessionShouldEnd: false,
      lastTransitionExchangeNum: 0,
    }

    // Build conversation history from recent exchanges
    const recentExchanges = interviewSession.exchanges.slice().reverse()
    const conversationHistory = recentExchanges
      .map((ex) => {
        const speakerLabel = ex.speaker === 'candidate'
          ? 'Candidate'
          : characters.find(c => c.id === ex.characterId)?.name || 'Interviewer'
        return `${speakerLabel}: ${ex.messageText}`
      })
      .join('\n')

    const currentQuestion = questionPlan[questionState.currentQuestionIndex]
    const nextQuestion = questionPlan[questionState.currentQuestionIndex + 1]

    // Determine last speaker character ID from most recent interviewer exchange
    const lastInterviewerExchange = recentExchanges.find(e => e.speaker === 'interviewer')
    const lastSpeakerId = lastInterviewerExchange?.characterId || null

    // B7: Pick responding character — use panel rotation based on current question type
    let respondingCharacter: Character
    if (characterId) {
      respondingCharacter = characters.find((c) => c.id === characterId) || characters[0]
    } else if (currentQuestion) {
      respondingCharacter = pickNextSpeaker(currentQuestion.questionType, characters, lastSpeakerId)
    } else {
      respondingCharacter = characters[0]
    }

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

    // B2: Evaluate the candidate's answer using LLM
    let evaluation: AnswerEvaluation = {
      answered: true,
      vague: false,
      hasOutcome: true,
      hasOwnership: true,
      readyToMoveOn: true,
      followUpType: 'move_on',
    }

    if (isAIConfigured() && currentQuestion) {
      try {
        evaluation = await chatCompletionJSON<AnswerEvaluation>(
          `You are an interview evaluation assistant. Analyze the candidate's answer to the question: "${currentQuestion.questionText}"

Return a JSON object with these fields:
- answered (boolean): Did they actually address the question?
- vague (boolean): Was the answer lacking specifics, numbers, or concrete examples?
- hasOutcome (boolean): Did they mention measurable results or outcomes?
- hasOwnership (boolean): Did they describe their personal contribution (not just "we")?
- readyToMoveOn (boolean): Is the answer sufficient to move to the next question?
- followUpType (string): One of "probe_deeper", "ask_outcome", "ask_ownership", "move_on", "wrap_up"

Decision rules:
- If vague AND followUpCount < 3 → probe_deeper
- If !hasOutcome → ask_outcome
- If !hasOwnership → ask_ownership
- If answered AND (hasOutcome OR followUpCount >= 2) → move_on
- Default to move_on if unclear`,
          `Question asked: "${currentQuestion.questionText}"
Candidate's answer: "${messageText}"
Follow-ups already asked on this question: ${questionState.followUpCount}`,
          {
            temperature: 0.3,
            maxTokens: 200,
            taskType: 'live_followup',
          }
        )
      } catch {
        // Default: move on if evaluation fails
        evaluation.readyToMoveOn = questionState.followUpCount >= 2
        evaluation.followUpType = evaluation.readyToMoveOn ? 'move_on' : 'probe_deeper'
      }
    }

    // B3: Decide follow-up vs move-on and build transition instruction
    let transitionInstruction = ''
    const isLastQuestion = questionState.currentQuestionIndex >= questionPlan.length - 1

    // B6: Check session ending
    const sessionShouldEnd = shouldEndSession(questionState, questionPlan.length, elapsedMs, targetDurationMin)

    if (sessionShouldEnd || (isLastQuestion && evaluation.readyToMoveOn)) {
      // Handle silent observer's final question
      const silentObserver = characters.find(c => c.archetype === 'silent_observer')
      if (silentObserver && silentObserver.id !== respondingCharacter.id && !questionState.sessionShouldEnd) {
        // Let silent observer ask their one sharp question before ending
        respondingCharacter = silentObserver
        transitionInstruction = `IMPORTANT: This is your ONE moment to speak. You have been silent the entire interview, observing everything. Now ask ONE sharp, specific question that references something the candidate said earlier. Show you were listening. Then the interview will wrap up. Make it count.`
        questionState.sessionShouldEnd = true
      } else {
        transitionInstruction = `The interview is wrapping up. Thank the candidate warmly, mention that the team enjoyed speaking with them, and close naturally. Do NOT ask another question.`
        questionState.sessionShouldEnd = true
      }
    } else if (evaluation.followUpType === 'move_on' || evaluation.readyToMoveOn) {
      // Move to next question
      questionState.currentQuestionIndex++
      questionState.followUpCount = 0
      questionState.lastTransitionExchangeNum = lastSequence + 2

      if (nextQuestion) {
        // B7: Pick speaker for next question
        if (!characterId) {
          respondingCharacter = pickNextSpeaker(nextQuestion.questionType, characters, lastSpeakerId)
        }
        transitionInstruction = `TRANSITION: The candidate has adequately answered the previous question. Naturally transition to the next topic: "${nextQuestion.questionText}"
Do NOT say "next question" or "moving on". Use natural phrases like:
- "That's helpful. I'd also like to understand..."
- "Great. Shifting gears a bit..."
- "Thanks for sharing that. Let me ask about..."
- "Appreciate that perspective. On a different note..."
Briefly acknowledge their last answer, then ask the new question.`
      }
    } else {
      // Follow up on current question
      questionState.followUpCount++
      const followUpInstructions: Record<string, string> = {
        probe_deeper: `The candidate's answer was vague. Ask a specific follow-up to dig deeper. Ask for concrete examples, specific numbers, or detailed steps.`,
        ask_outcome: `The candidate didn't mention measurable outcomes. Ask specifically about results: "What was the measurable impact?" or "How did you know it was successful?"`,
        ask_ownership: `The candidate used "we" language without clarifying their role. Ask: "What was YOUR specific contribution?" or "What decisions did YOU make?"`,
        wrap_up: transitionInstruction,
      }
      transitionInstruction = followUpInstructions[evaluation.followUpType] || followUpInstructions.probe_deeper
    }

    // Generate AI response
    let responseText: string
    if (isAIConfigured()) {
      try {
        const archPrompt = ARCHETYPE_FULL_PROMPTS[respondingCharacter.archetype] || ARCHETYPE_FULL_PROMPTS.friendly_champion
        const app = interviewSession.application

        // B5: Build complete system prompt with all context
        const questionPlanSection = questionPlan.length > 0
          ? questionPlan
              .map((q, i) => {
                const marker = i === questionState.currentQuestionIndex ? '→ CURRENT' :
                              i < questionState.currentQuestionIndex ? '✓ ASKED' : '  UPCOMING'
                return `  ${i + 1}. [${q.questionType.toUpperCase()}] ${q.questionText} ${marker}`
              })
              .join('\n')
          : ''

        const systemPrompt = `You are ${respondingCharacter.name}, ${respondingCharacter.title}, conducting a panel interview at ${app.companyName} for the ${app.jobTitle} position.

${archPrompt}

INTERVIEW CONTEXT:
- Company: ${app.companyName}
- Role: ${app.jobTitle}
${app.jdText ? `- Job Description highlights: ${app.jdText.slice(0, 500)}` : ''}
- Interview elapsed: ${Math.floor(elapsedMs / 60000)} minutes
- Target duration: ${targetDurationMin} minutes

${questionPlanSection ? `QUESTION PLAN:\n${questionPlanSection}` : ''}

CURRENT STATE:
- Question ${questionState.currentQuestionIndex + 1} of ${questionPlan.length}: "${currentQuestion?.questionText || 'general discussion'}"
- Follow-ups on this question: ${questionState.followUpCount}

${transitionInstruction ? `\nYOUR INSTRUCTION FOR THIS TURN:\n${transitionInstruction}` : ''}

${conversationHistory ? `\nCONVERSATION SO FAR:\n${conversationHistory}` : ''}

RULES:
- Stay in character at all times
- React to what the candidate actually said — don't ignore their answer
- Never break character or mention you are an AI
- If the candidate asks YOU a question, answer briefly in-character, then steer back to the plan
- Do NOT repeat questions that have already been asked`

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

    // B8: Save updated QuestionState back to session
    const updatedEvents = JSON.parse(JSON.stringify({ ...sessionEvents, questionState }))
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { unexpectedEvents: updatedEvents },
    })

    // If session should end, mark it completed
    if (questionState.sessionShouldEnd && evaluation.followUpType !== 'wrap_up') {
      // Don't immediately end — let the closing message play first
      // The frontend will see sessionEnded and handle the transition
    }

    // Pick next speaker for the frontend to know who responds next
    const nextQ = questionPlan[questionState.currentQuestionIndex]
    const nextSpeaker = nextQ
      ? pickNextSpeaker(nextQ.questionType, characters, respondingCharacter.id)
      : respondingCharacter

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
      // New fields for frontend
      sessionEnded: questionState.sessionShouldEnd,
      nextCharacterId: nextSpeaker.id,
      silenceMs: (() => {
        const range = ARCHETYPE_SILENCE_MS[respondingCharacter.archetype] || [2000, 3000]
        return range[0] + Math.random() * (range[1] - range[0])
      })(),
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
