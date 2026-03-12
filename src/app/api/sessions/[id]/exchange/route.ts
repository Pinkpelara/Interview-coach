import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletion, isAIConfigured } from '@/lib/ai-gateway'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
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

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  skeptic: 'You are a skeptical interviewer who challenges every claim. You NEVER say "great answer" or give praise. You demand specifics, metrics, and evidence. You push back on vague answers. If the candidate gives a short or vague answer, ask the EXACT same question again with "I need more detail on that." Always push for numbers, timelines, and measurable outcomes.',
  friendly_champion: 'You are a warm, enthusiastic interviewer who builds rapport. You are warm but strategic — you use warmth to get the candidate to share more than they intended. You encourage while probing for depth. You show genuine interest but always steer back to substance.',
  technical_griller: 'You are a technical interviewer with zero tolerance for hand-waving. No pleasantries — get straight to technical substance. If the answer is vague, ask the EXACT same question again. You want implementation details, system design, architecture decisions, edge cases, and failure scenarios. You test depth, not breadth.',
  distracted_senior: 'You are a senior executive who is somewhat distracted. You occasionally check your phone, ask about big-picture strategy, and sometimes change topics abruptly. You care about business impact and ROI. Sometimes you ask tangential questions that seem random but reveal strategic thinking.',
  culture_fit: 'You are focused on team dynamics, values, and cultural alignment. You ask about collaboration, conflict resolution, and working styles. You listen for red flags about ego, blame, and inability to adapt. You use scenario-based questions.',
  silent_observer: 'You are quiet and observant. You give minimal responses — short phrases, nods, or silence. You make the candidate uncomfortable with pauses. Respond in 1-10 words max. Your silence is deliberate and evaluative.',
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
  conversationHistory: ConversationTurn[]
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

Respond in character as the interviewer. Remember to ask questions specific to ${appCtx?.companyName || 'the company'} and the ${appCtx?.jobTitle || 'role'}.`

  return chatCompletion(systemPrompt, userPrompt, {
    temperature: 0.85,
    maxTokens: 250,
    taskType: 'live_interview_response',
  })
}

function generateResponseFallback(
  archetype: string,
  messageText: string,
  exchangeCount: number,
  appCtx: ApplicationContext | null
): string {
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

    // Parse characters and find the responding character
    const characters: Character[] = JSON.parse(interviewSession.characters || '[]')

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

    // Generate AI response with full context
    let responseText: string
    if (isAIConfigured()) {
      try {
        responseText = await generateResponseWithAI(
          respondingCharacter.archetype,
          respondingCharacter.name,
          respondingCharacter.title,
          messageText,
          exchangeCount,
          appCtx,
          conversationHistory
        )
      } catch (aiError) {
        console.error('AI response generation failed, using fallback:', aiError)
        responseText = generateResponseFallback(
          respondingCharacter.archetype,
          messageText,
          exchangeCount,
          appCtx
        )
      }
    } else {
      responseText = generateResponseFallback(
        respondingCharacter.archetype,
        messageText,
        exchangeCount,
        appCtx
      )
    }

    // Create interviewer exchange
    const interviewerExchange = await prisma.sessionExchange.create({
      data: {
        sessionId: id,
        sequenceNumber: lastSequence + 2,
        speaker: 'interviewer',
        characterId: respondingCharacter.id,
        messageText: responseText,
        timestampMs: now - sessionStartMs + respondingCharacter.silenceDuration,
      },
    })

    // Determine expression hint based on archetype and response content
    let expressionHint: string = 'neutral'
    if (respondingCharacter.archetype === 'skeptic') {
      expressionHint = responseText.includes('?') ? 'skeptical' : 'thinking'
    } else if (respondingCharacter.archetype === 'friendly_champion') {
      expressionHint = 'nodding'
    } else if (respondingCharacter.archetype === 'technical_griller') {
      expressionHint = 'neutral'
    } else if (respondingCharacter.archetype === 'distracted_senior') {
      expressionHint = Math.random() > 0.3 ? 'listening' : 'distracted'
    } else if (respondingCharacter.archetype === 'culture_fit') {
      expressionHint = 'listening'
    } else if (respondingCharacter.archetype === 'silent_observer') {
      expressionHint = 'writing_notes'
    }

    return NextResponse.json({
      candidateExchange,
      interviewerExchange,
      expressionHint,
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
