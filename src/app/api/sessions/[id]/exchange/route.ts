import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletion, isPuterConfigured } from '@/lib/puter-ai'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
}

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  skeptic: 'You are a skeptical interviewer who challenges every claim. You demand specifics, metrics, and evidence. You push back on vague answers and ask pointed follow-ups.',
  friendly_champion: 'You are a warm, enthusiastic interviewer who builds rapport. You encourage the candidate while still probing for depth. You show genuine interest.',
  technical_griller: 'You are a technical interviewer who digs into implementation details, system design, architecture decisions, and edge cases. You want to understand how things actually work.',
  distracted_senior: 'You are a senior executive who is somewhat distracted. You occasionally check your phone, ask about big-picture strategy, and sometimes change topics abruptly. You care about business impact.',
  culture_fit: 'You are focused on team dynamics, values, and cultural alignment. You ask about collaboration, conflict resolution, and working styles.',
  silent_observer: 'You are quiet and observant. You give minimal responses — short phrases, nods, or silence. You make the candidate uncomfortable with pauses. Respond in 1-10 words max.',
}

const ARCHETYPE_FALLBACK_RESPONSES: Record<string, string[]> = {
  skeptic: [
    "Can you be more specific about the actual impact you had?",
    "What was the measurable outcome of that initiative?",
    "I'm not sure I follow — what evidence do you have that this approach worked?",
    "Let's dig deeper. What were the concrete numbers?",
    "Walk me through the decision-making process. What alternatives did you consider?",
  ],
  friendly_champion: [
    "That's really interesting, tell me more about how you approached that.",
    "I love that example! How did the team respond to your leadership there?",
    "Wonderful — that really resonates with what we're building here.",
    "That's exactly the kind of initiative we value. How did you get buy-in for that?",
    "Fantastic. What drew you to take on that challenge?",
  ],
  technical_griller: [
    "Walk me through exactly how you implemented that. What was the architecture?",
    "How did you handle edge cases? What about failure scenarios?",
    "What tradeoffs did you consider? Why did you choose that tech stack?",
    "How would you debug this if it broke in production at 3 AM?",
    "What testing strategy did you use? How did you ensure reliability?",
  ],
  distracted_senior: [
    "Sorry, can you repeat that? I was just looking at something.",
    "Right, right... So how does this tie back to business impact?",
    "That's fine. What I really want to understand is the strategic vision.",
    "I've seen a lot of candidates with similar backgrounds. What truly sets you apart?",
    "Let's fast-forward. Where do you see this role in three years?",
  ],
  culture_fit: [
    "How would your closest colleagues describe your working style?",
    "What kind of work environment brings out your best performance?",
    "What values are most important to you in a company culture?",
    "Tell me about a time you went above and beyond for a colleague.",
    "How do you build trust with new team members?",
  ],
  silent_observer: [
    "...",
    "*nods slowly*",
    "Hmm.",
    "I see. Please continue.",
    "Interesting.",
  ],
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function generateResponseWithAI(
  archetype: string,
  characterName: string,
  characterTitle: string,
  messageText: string,
  exchangeCount: number
): Promise<string> {
  const archetypeDesc = ARCHETYPE_DESCRIPTIONS[archetype] || ARCHETYPE_DESCRIPTIONS.friendly_champion

  const systemPrompt = `You are ${characterName}, ${characterTitle}, conducting a job interview. ${archetypeDesc}

Rules:
- Stay in character at all times
- Respond with 1-3 sentences only
- React to what the candidate actually said
- This is exchange #${exchangeCount} in the interview
- If the candidate's answer is short or vague, push for more detail
- Never break character or mention you are an AI`

  const userPrompt = `The candidate just said: "${messageText}"

Respond in character as the interviewer.`

  return chatCompletion(systemPrompt, userPrompt, {
    temperature: 0.9,
    maxTokens: 200,
  })
}

function generateResponseFallback(
  archetype: string,
  messageText: string,
): string {
  const responses = ARCHETYPE_FALLBACK_RESPONSES[archetype] || ARCHETYPE_FALLBACK_RESPONSES.friendly_champion
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

    // Verify session belongs to user and is active
    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id, userId },
      include: {
        exchanges: {
          orderBy: { sequenceNumber: 'desc' },
          take: 1,
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

    // Parse characters and find the responding character
    const characters: Character[] = JSON.parse(interviewSession.characters || '[]')

    let respondingCharacter: Character | undefined
    if (characterId) {
      respondingCharacter = characters.find((c) => c.id === characterId)
    }
    if (!respondingCharacter) {
      // Default to first character if none specified
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

    // Count total exchanges for context-aware responses
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

    // Generate AI response based on archetype
    let responseText: string
    if (isPuterConfigured()) {
      try {
        responseText = await generateResponseWithAI(
          respondingCharacter.archetype,
          respondingCharacter.name,
          respondingCharacter.title,
          messageText,
          exchangeCount
        )
      } catch (aiError) {
        console.error('AI response generation failed, using fallback:', aiError)
        responseText = generateResponseFallback(respondingCharacter.archetype, messageText)
      }
    } else {
      responseText = generateResponseFallback(respondingCharacter.archetype, messageText)
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

    return NextResponse.json({
      candidateExchange,
      interviewerExchange,
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
