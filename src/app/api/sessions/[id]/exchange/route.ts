import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletion, isAIServiceConfigured } from '@/lib/ai'
import { checkRateLimit } from '@/lib/rate-limit'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
  voiceId?: string
  gender?: 'male' | 'female'
  firstName?: string
  lastName?: string
  initials?: string
  avatarColor?: string
}

interface ApplicationContext {
  companyName: string
  jobTitle: string
  jdText: string | null
  strengths: string[]
  skillGaps: string[]
  probeAreas: string[]
}

interface ConversationTurn {
  speaker: string
  text: string
  characterId: string | null
}

interface SessionQuestion {
  question_text: string
  question_type: string
  priority: number
  owner_character_id: string
  owner_archetype: string
}

interface SessionConfigEnvelope {
  panel: Character[]
  questionPlan: SessionQuestion[]
  questionState: {
    currentQuestionIndex: number
    followUpCount: number
    sessionShouldEnd: boolean
    closingAsked?: boolean
    silentObserverAsked?: boolean
    triggeredEvents?: string[]
  }
  unexpectedEvents: Array<{ type: string; trigger_time_ms: number; character_id?: string }>
}

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  skeptic: 'You are a skeptical interviewer who challenges every claim. You demand specifics, metrics, and evidence. You push back on vague answers and ask pointed follow-ups.',
  friendly_champion: 'You are a warm, enthusiastic interviewer who builds rapport. You encourage the candidate while still probing for depth. You show genuine interest.',
  technical_griller: 'You are a technical interviewer who digs into implementation details, system design, architecture decisions, and edge cases. You want to understand how things actually work.',
  distracted_senior: 'You are a senior executive who is somewhat distracted. You occasionally check your phone, ask about big-picture strategy, and sometimes change topics abruptly. You care about business impact.',
  culture_fit: 'You are focused on team dynamics, values, and cultural alignment. You ask about collaboration, conflict resolution, and working styles.',
  silent_observer: 'You are quiet and observant. You give minimal responses — short phrases, nods, or silence. You make the candidate uncomfortable with pauses. Respond in 1-10 words max.',
}

const ARCHETYPE_FALLBACK_RESPONSES: Record<string, (ctx: ApplicationContext | null) => string[]> = {
  skeptic: (ctx) => {
    const company = ctx?.companyName || 'this company'
    return [
      `Can you be more specific about the actual impact you had?`,
      `What was the measurable outcome of that initiative?`,
      `I'm not sure I follow — what evidence do you have that this approach worked?`,
      `How does that experience prepare you for what we need at ${company}?`,
      `Walk me through the decision-making process. What alternatives did you consider?`,
    ]
  },
  friendly_champion: (ctx) => {
    const company = ctx?.companyName || 'our team'
    return [
      `That's really interesting, tell me more about how you approached that.`,
      `I love that example! How did the team respond to your leadership there?`,
      `Wonderful — that really resonates with what we're building here at ${company}.`,
      `That's exactly the kind of initiative we value. How did you get buy-in for that?`,
      `Fantastic. What drew you to take on that challenge?`,
    ]
  },
  technical_griller: (ctx) => {
    const role = ctx?.jobTitle || 'this role'
    return [
      `Walk me through exactly how you implemented that. What was the architecture?`,
      `How did you handle edge cases? What about failure scenarios?`,
      `What tradeoffs did you consider? Why did you choose that tech stack?`,
      `How would you debug this if it broke in production at 3 AM?`,
      `Thinking about the ${role} position — how would you apply that approach here?`,
    ]
  },
  distracted_senior: (ctx) => {
    const company = ctx?.companyName || 'us'
    return [
      `Sorry, can you repeat that? I was just looking at something.`,
      `Right, right... So how does this tie back to business impact?`,
      `That's fine. What I really want to understand is the strategic vision.`,
      `I've seen a lot of candidates. Why ${company} specifically?`,
      `Let's fast-forward. Where do you see this role in three years?`,
    ]
  },
  culture_fit: (ctx) => {
    const company = ctx?.companyName || 'a company'
    return [
      `How would your closest colleagues describe your working style?`,
      `What kind of work environment brings out your best performance?`,
      `What values are most important to you, and how do those align with ${company}?`,
      `Tell me about a time you went above and beyond for a colleague.`,
      `How do you build trust with new team members?`,
    ]
  },
  silent_observer: () => [
    `...`,
    `*nods slowly*`,
    `Hmm.`,
    `I see. Please continue.`,
    `Interesting.`,
  ],
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function parseSessionConfig(raw: string | null): SessionConfigEnvelope {
  if (!raw) {
    return {
      panel: [],
      questionPlan: [],
      questionState: { currentQuestionIndex: 0, followUpCount: 0, sessionShouldEnd: false },
      unexpectedEvents: [],
    }
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return {
        panel: parsed,
        questionPlan: [],
        questionState: { currentQuestionIndex: 0, followUpCount: 0, sessionShouldEnd: false },
        unexpectedEvents: [],
      }
    }
    return {
      panel: parsed.panel || [],
      questionPlan: parsed.questionPlan || [],
      questionState: parsed.questionState || { currentQuestionIndex: 0, followUpCount: 0, sessionShouldEnd: false },
      unexpectedEvents: parsed.unexpectedEvents || [],
    }
  } catch {
    return {
      panel: [],
      questionPlan: [],
      questionState: { currentQuestionIndex: 0, followUpCount: 0, sessionShouldEnd: false },
      unexpectedEvents: [],
    }
  }
}

function serializeSessionConfig(config: SessionConfigEnvelope): string {
  return JSON.stringify(config)
}

function parseWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function shouldFollowUp(args: {
  answerText: string
  followUpCount: number
  ownerArchetype: string
}): { followUp: boolean; hint: string } {
  const text = args.answerText.toLowerCase()
  const words = parseWords(text)

  if (args.followUpCount >= 2) return { followUp: false, hint: 'max_followups_reached' }
  if (args.followUpCount === 1) return { followUp: Math.random() < 0.2, hint: 'second_turn_bias_move_on' }

  let p = 0.15
  let hint = 'general_probe'
  const hasI = /\bi\b/.test(text)
  const hasWe = /\bwe\b/.test(text)
  const hasMetrics = /\d/.test(text)
  const hasHedging = /\b(sort of|kind of|i think|i guess|maybe|probably|i feel like)\b/.test(text)

  if (words.length < 20) {
    p += 0.35
    hint = 'ask_to_elaborate'
  }
  if (hasWe && !hasI) {
    p += 0.2
    hint = 'ask_personal_role'
  }
  if (hasHedging) {
    p += 0.2
    hint = 'push_for_concrete'
  }
  if (!hasMetrics) {
    p += 0.1
    hint = 'ask_for_metrics'
  }

  if (args.ownerArchetype === 'skeptic' || args.ownerArchetype === 'technical_griller') p += 0.15
  if (args.ownerArchetype === 'friendly_champion') p -= 0.05

  p = Math.max(0, Math.min(0.7, p))
  return { followUp: Math.random() < p, hint }
}

function closingWrap(candidateName: string): string {
  return `Thanks, ${candidateName}. I appreciate your specificity today, especially how you tied your examples back to measurable outcomes. The team will be in touch with next steps.`
}

function buildSystemPrompt(
  archetype: string,
  characterName: string,
  characterTitle: string,
  exchangeCount: number,
  appCtx: ApplicationContext | null,
  conversationHistory: ConversationTurn[]
): string {
  const archetypeDesc = ARCHETYPE_DESCRIPTIONS[archetype] || ARCHETYPE_DESCRIPTIONS.friendly_champion

  let contextBlock = ''
  if (appCtx) {
    contextBlock = `\n\nINTERVIEW CONTEXT:
- Company: ${appCtx.companyName}
- Role: ${appCtx.jobTitle}`

    if (appCtx.jdText) {
      // Include key JD requirements (truncate if very long)
      const jdSnippet = appCtx.jdText.length > 1500 ? appCtx.jdText.slice(0, 1500) + '...' : appCtx.jdText
      contextBlock += `\n- Job Description:\n${jdSnippet}`
    }

    if (appCtx.strengths.length > 0) {
      contextBlock += `\n- Candidate's known strengths: ${appCtx.strengths.join(', ')}`
    }

    if (appCtx.skillGaps.length > 0) {
      contextBlock += `\n- Areas to probe (candidate gaps): ${appCtx.skillGaps.join(', ')}`
    }

    if (appCtx.probeAreas.length > 0) {
      contextBlock += `\n- Specific probe areas: ${appCtx.probeAreas.join(', ')}`
    }
  }

  let historyBlock = ''
  if (conversationHistory.length > 0) {
    historyBlock = '\n\nCONVERSATION SO FAR:\n'
    for (const turn of conversationHistory) {
      const label = turn.speaker === 'candidate' ? 'Candidate' : characterName
      historyBlock += `${label}: ${turn.text}\n`
    }
  }

  const phaseGuidance = getPhaseGuidance(exchangeCount, appCtx)

  return `You are ${characterName}, ${characterTitle}, conducting a job interview${appCtx ? ` at ${appCtx.companyName} for the ${appCtx.jobTitle} position` : ''}. ${archetypeDesc}
${contextBlock}
${historyBlock}
INTERVIEW PHASE: ${phaseGuidance}

Rules:
- Stay in character at all times
- Respond with 1-3 sentences only
- React to what the candidate actually said
- Ask questions relevant to the specific role and company, not generic questions
- Reference specific skills, experiences, or requirements from the job description when possible
- Probe the candidate's gaps and weaknesses naturally
- Build on previous answers — don't repeat topics already covered
- Never break character or mention you are an AI
- Never say things like "let's have a relaxed conversation" — act like a real interviewer`
}

function getPhaseGuidance(exchangeCount: number, appCtx: ApplicationContext | null): string {
  const role = appCtx?.jobTitle || 'the role'
  const company = appCtx?.companyName || 'the company'

  if (exchangeCount <= 2) {
    return `Opening phase. Ask about the candidate's background and why they're interested in ${role} at ${company}. Be specific — reference the company or role.`
  } else if (exchangeCount <= 5) {
    return `Early middle phase. Dig into relevant experience. Ask about specific projects, skills, or scenarios related to the job requirements.${appCtx?.probeAreas?.length ? ` Consider probing: ${appCtx.probeAreas[0]}` : ''}`
  } else if (exchangeCount <= 10) {
    return `Deep probing phase. Push for specifics, metrics, and outcomes. Challenge vague answers.${appCtx?.skillGaps?.length ? ` Explore potential gap: ${appCtx.skillGaps[0]}` : ''}`
  } else {
    return `Late phase. Ask about future goals, what they'd do in the first 90 days, or wrap-up questions. Keep it concise.`
  }
}

async function generateResponseWithAI(
  archetype: string,
  characterName: string,
  characterTitle: string,
  messageText: string,
  exchangeCount: number,
  appCtx: ApplicationContext | null,
  conversationHistory: ConversationTurn[],
  actionInstruction: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(
    archetype,
    characterName,
    characterTitle,
    exchangeCount,
    appCtx,
    conversationHistory
  )

  const userPrompt = `The candidate just said: "${messageText}"

Action instruction: ${actionInstruction}

Respond in character as the interviewer. Remember to ask questions specific to ${appCtx?.companyName || 'the company'} and the ${appCtx?.jobTitle || 'role'}. Keep it to 1-3 sentences.`

  return chatCompletion(systemPrompt, userPrompt, {
    temperature: 0.85,
    maxTokens: 250,
  })
}

function generateResponseFallback(
  archetype: string,
  messageText: string,
  exchangeCount: number,
  appCtx: ApplicationContext | null,
  actionInstruction: string
): string {
  if (actionInstruction.startsWith('ask_exact_question:')) {
    return actionInstruction.replace('ask_exact_question:', '').trim()
  }
  if (actionInstruction.startsWith('ack_then_ask:')) {
    return actionInstruction.replace('ack_then_ask:', '').trim()
  }
  if (actionInstruction.startsWith('closing_prompt')) {
    return 'Do you have any questions for us?'
  }
  if (actionInstruction.startsWith('final_wrap:')) {
    return actionInstruction.replace('final_wrap:', '').trim()
  }

  const responseFn = ARCHETYPE_FALLBACK_RESPONSES[archetype] || ARCHETYPE_FALLBACK_RESPONSES.friendly_champion
  const responses = responseFn(appCtx)
  let response = randomFrom(responses)

  if (messageText.length < 80) {
    if (archetype === 'skeptic') {
      response = "That's quite brief. " + response
    } else if (archetype === 'technical_griller') {
      response = "I'd like more detail. " + response
    }
  }

  return response
}

function parseJsonField(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
    } catch {
      return [value]
    }
  }
  return []
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
    const limiter = await checkRateLimit(`session:exchange:${userId}`, 120, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many interview turns. Please wait a moment and continue.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }
    const { id } = params
    const body = await request.json()
    const { messageText, characterId } = body

    if (!messageText?.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
    }

    // Fetch session with application context and recent conversation history
    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id, userId },
      include: {
        exchanges: {
          orderBy: { sequenceNumber: 'desc' },
          take: 16, // Last 8 exchanges (each has candidate + interviewer)
        },
        application: {
          select: {
            companyName: true,
            jobTitle: true,
            jdText: true,
            strengths: true,
            skillGaps: true,
            probeAreas: true,
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

    // Build application context
    let appCtx: ApplicationContext | null = null
    if (interviewSession.application) {
      const app = interviewSession.application
      appCtx = {
        companyName: app.companyName,
        jobTitle: app.jobTitle,
        jdText: app.jdText,
        strengths: parseJsonField(app.strengths),
        skillGaps: parseJsonField(app.skillGaps),
        probeAreas: parseJsonField(app.probeAreas),
      }
    }

    // Build conversation history (oldest first)
    const conversationHistory: ConversationTurn[] = interviewSession.exchanges
      .slice()
      .reverse()
      .map((ex) => ({
        speaker: ex.speaker,
        text: ex.messageText,
        characterId: ex.characterId,
      }))

    const sessionConfig = parseSessionConfig(interviewSession.characters)
    const characters: Character[] = sessionConfig.panel
    const questionPlan = sessionConfig.questionPlan
    const questionState = sessionConfig.questionState || { currentQuestionIndex: 0, followUpCount: 0, sessionShouldEnd: false }
    questionState.triggeredEvents = questionState.triggeredEvents || []

    const currentQuestion = questionPlan[questionState.currentQuestionIndex] || null

    let respondingCharacter: Character | undefined =
      (currentQuestion && characters.find((c) => c.id === currentQuestion.owner_character_id))
      || (characterId ? characters.find((c) => c.id === characterId) : undefined)
      || characters.find((c) => c.archetype !== 'silent_observer')
      || characters[0]

    if (!respondingCharacter) {
      return NextResponse.json({ error: 'No characters in this session' }, { status: 400 })
    }

    // Determine next sequence number
    const lastSequence = interviewSession.exchanges[0]?.sequenceNumber ?? 0
    const now = Date.now()
    const sessionStartMs = interviewSession.startedAt
      ? interviewSession.startedAt.getTime()
      : now

    // Count total exchanges for phase-aware responses
    const exchangeCount = await prisma.sessionExchange.count({
      where: { sessionId: id },
    })

    // Create candidate exchange
    const candidateExchange = await prisma.sessionExchange.create({
      data: {
        sessionId: id,
        sequenceNumber: lastSequence + 1,
        speaker: 'candidate',
        characterId: null,
        messageText: messageText.trim(),
        timestampMs: now - sessionStartMs,
      },
    })

    const elapsedMs = now - sessionStartMs
    const triggeredEventKeys = new Set(questionState.triggeredEvents)
    const dueEvent = sessionConfig.unexpectedEvents.find((evt) => {
      const key = `${evt.type}:${evt.trigger_time_ms}:${evt.character_id || ''}`
      return evt.trigger_time_ms <= elapsedMs && !triggeredEventKeys.has(key)
    })
    if (dueEvent) {
      const key = `${dueEvent.type}:${dueEvent.trigger_time_ms}:${dueEvent.character_id || ''}`
      triggeredEventKeys.add(key)
      questionState.triggeredEvents = Array.from(triggeredEventKeys)
    }

    let actionInstruction = ''
    let nextCharacterId = respondingCharacter.id
    const candidateName = (session.user as { name?: string } | undefined)?.name || 'there'
    const silentObserver = characters.find((c) => c.archetype === 'silent_observer')
    let overrideActionInstruction = ''

    if (!questionState.sessionShouldEnd && dueEvent) {
      if (dueEvent.type === 'late_join') {
        const lateJoiner = characters.find((c) => c.id === dueEvent.character_id)
        if (lateJoiner) {
          respondingCharacter = lateJoiner
          nextCharacterId = lateJoiner.id
          overrideActionInstruction = `ack_then_ask:Apologies for joining late — thanks for waiting. ${currentQuestion?.question_text || 'Could you walk me through your most relevant accomplishment for this role?'}`
        }
      } else if (dueEvent.type === 'video_freeze') {
        overrideActionInstruction =
          'ack_then_ask:Sorry, my audio cut out for a moment. Could you repeat the key outcome in one sentence?'
      } else if (dueEvent.type === 'curveball_question') {
        overrideActionInstruction =
          `ask_exact_question:Curveball for you: Tell me about a time your initial plan failed unexpectedly and what you changed in real time for ${appCtx?.companyName || 'this team'}.`
      } else if (dueEvent.type === 'one_more_question') {
        overrideActionInstruction =
          'ask_exact_question:We actually have time for one more question — what is one risk in your first 90 days here, and how would you mitigate it?'
      } else if (dueEvent.type === 'long_silence') {
        respondingCharacter = {
          ...respondingCharacter,
          silenceDuration: respondingCharacter.silenceDuration + 3000,
        }
      }
    }

    if (questionState.sessionShouldEnd) {
      actionInstruction = `final_wrap:${closingWrap(candidateName)}`
    } else if (overrideActionInstruction) {
      actionInstruction = overrideActionInstruction
    } else if (!currentQuestion) {
      actionInstruction = 'closing_prompt'
      questionState.sessionShouldEnd = true
    } else {
      const decision = shouldFollowUp({
        answerText: messageText,
        followUpCount: questionState.followUpCount,
        ownerArchetype: respondingCharacter.archetype,
      })

      if (decision.followUp) {
        actionInstruction = `follow_up_on_current_question (${decision.hint}): ${currentQuestion.question_text}`
        questionState.followUpCount += 1
      } else {
        const nextIndex = questionState.currentQuestionIndex + 1
        const nextQuestion = questionPlan[nextIndex]
        if (nextQuestion) {
          const nextOwner = characters.find((c) => c.id === nextQuestion.owner_character_id) || respondingCharacter
          if (Math.random() < 0.1) {
            const jumper = characters.find((c) => c.id !== respondingCharacter!.id && c.id !== silentObserver?.id)
            if (jumper) {
              nextCharacterId = jumper.id
              respondingCharacter = jumper
              actionInstruction = `ack_then_ask:Just to add to that — ${nextQuestion.question_text}`
            } else {
              nextCharacterId = nextOwner.id
              respondingCharacter = nextOwner
              actionInstruction = `ack_then_ask:${nextQuestion.question_text}`
            }
          } else {
            nextCharacterId = nextOwner.id
            respondingCharacter = nextOwner
            actionInstruction = `ack_then_ask:${nextQuestion.question_text}`
          }
          questionState.currentQuestionIndex = nextIndex
          questionState.followUpCount = 0
        } else if (silentObserver && !questionState.silentObserverAsked) {
          const earliestCandidateTurn = conversationHistory.find((t) => t.speaker === 'candidate')?.text || 'your opening answer'
          nextCharacterId = silentObserver.id
          respondingCharacter = silentObserver
          actionInstruction = `ask_exact_question:${earliestCandidateTurn.split('.').at(0)} — earlier you said that, but later you framed it differently; what changed exactly?`
          questionState.silentObserverAsked = true
          questionState.followUpCount = 0
        } else if (!questionState.closingAsked) {
          actionInstruction = 'closing_prompt'
          questionState.closingAsked = true
        } else {
          actionInstruction = `final_wrap:${closingWrap(candidateName)}`
          questionState.sessionShouldEnd = true
        }
      }
    }

    // Generate AI response with full context
    let responseText: string
    if (isAIServiceConfigured()) {
      try {
        responseText = await generateResponseWithAI(
          respondingCharacter.archetype,
          respondingCharacter.name,
          respondingCharacter.title,
          messageText,
          exchangeCount,
          appCtx,
          conversationHistory,
          actionInstruction
        )
      } catch (aiError) {
        console.error('AI response generation failed, using fallback:', aiError)
        responseText = generateResponseFallback(
          respondingCharacter.archetype,
          messageText,
          exchangeCount,
          appCtx,
          actionInstruction
        )
      }
    } else {
      responseText = generateResponseFallback(
        respondingCharacter.archetype,
        messageText,
        exchangeCount,
        appCtx,
        actionInstruction
      )
    }

    responseText = responseText.trim()
    if (!responseText) {
      responseText = generateResponseFallback(
        respondingCharacter.archetype,
        messageText,
        exchangeCount,
        appCtx,
        actionInstruction
      )
    }

    // Create interviewer exchange
    const interviewerExchange = await prisma.sessionExchange.create({
      data: {
        sessionId: id,
        sequenceNumber: lastSequence + 2,
        speaker: 'interviewer',
        characterId: nextCharacterId,
        messageText: responseText,
        timestampMs: now - sessionStartMs + respondingCharacter.silenceDuration,
      },
    })

    sessionConfig.questionState = questionState
    await prisma.interviewSession.update({
      where: { id },
      data: {
        characters: serializeSessionConfig(sessionConfig),
        ...(questionState.sessionShouldEnd ? { status: 'completed', endedAt: new Date() } : {}),
      },
    })

    return NextResponse.json({
      candidateExchange,
      interviewerExchange,
      character: {
        id: nextCharacterId,
        name: respondingCharacter.name,
        title: respondingCharacter.title,
        archetype: respondingCharacter.archetype,
        voiceId: respondingCharacter.voiceId,
        initials: respondingCharacter.initials,
        avatarColor: respondingCharacter.avatarColor,
      },
      sessionEnd: questionState.sessionShouldEnd,
    })
  } catch (error) {
    console.error('Error creating exchange:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
