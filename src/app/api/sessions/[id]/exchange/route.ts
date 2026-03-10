import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
}

const ARCHETYPE_RESPONSES: Record<string, string[]> = {
  skeptic: [
    "Can you be more specific about the actual impact you had?",
    "What was the measurable outcome of that initiative?",
    "I'm not sure I follow — what evidence do you have that this approach worked?",
    "Interesting, but how does that scale beyond your specific context?",
    "Let's dig deeper. What were the concrete numbers?",
    "That sounds a bit vague. Can you quantify your contribution?",
    "How would you handle pushback from stakeholders who disagree with that approach?",
    "What would you have done differently if you had to do it again?",
    "I've seen that approach fail at scale. What makes you confident it would work here?",
    "Walk me through the decision-making process. What alternatives did you consider?",
  ],
  friendly_champion: [
    "That's really interesting, tell me more about how you approached that.",
    "I love that example! How did the team respond to your leadership there?",
    "That's a great point. Can you share another example of that skill in action?",
    "Wonderful — that really resonates with what we're building here.",
    "I can see how that experience would be valuable. What was the most rewarding part?",
    "That's exactly the kind of initiative we value. How did you get buy-in for that?",
    "Great answer! Let me ask you about a related topic...",
    "I appreciate you sharing that. It sounds like it was a meaningful experience.",
    "That aligns well with our team culture. How do you typically collaborate with cross-functional teams?",
    "Fantastic. What drew you to take on that challenge?",
  ],
  technical_griller: [
    "Walk me through exactly how you implemented that. What was the architecture?",
    "What's the time complexity of that approach? Could you optimize it further?",
    "How did you handle edge cases? What about failure scenarios?",
    "Can you whiteboard the system design for me? What are the key components?",
    "What tradeoffs did you consider? Why did you choose that tech stack?",
    "How would you debug this if it broke in production at 3 AM?",
    "Tell me about the most technically challenging problem you solved there.",
    "What testing strategy did you use? How did you ensure reliability?",
    "How does that solution handle concurrent requests? What about race conditions?",
    "If you had to rewrite that system from scratch today, what would you change?",
  ],
  distracted_senior: [
    "Sorry, can you repeat that? I was just looking at something.",
    "Right, right... So how does this tie back to business impact?",
    "Mm-hmm. And in terms of the bottom line, what did that mean for revenue?",
    "Interesting. *checks phone* Sorry — go on, you were saying?",
    "That's fine. What I really want to understand is the strategic vision.",
    "Let me jump in here — how would you handle a situation where priorities shift mid-quarter?",
    "OK, but zooming out — where do you see yourself contributing at the executive level?",
    "Hold that thought... Actually, that's a good point. Continue.",
    "I've seen a lot of candidates with similar backgrounds. What truly sets you apart?",
    "Let's fast-forward. Where do you see this role in three years?",
  ],
  culture_fit: [
    "How would your closest colleagues describe your working style?",
    "Tell me about a time when you had a conflict with a teammate. How did you resolve it?",
    "What kind of work environment brings out your best performance?",
    "How do you handle feedback that you disagree with?",
    "What does diversity and inclusion mean to you in a workplace context?",
    "Describe a time when you had to adapt to a significant change at work.",
    "How do you maintain work-life balance while staying committed to your team?",
    "What values are most important to you in a company culture?",
    "Tell me about a time you went above and beyond for a colleague.",
    "How do you build trust with new team members?",
  ],
  silent_observer: [
    "...",
    "*nods slowly*",
    "Hmm.",
    "I see. Please continue.",
    "*makes a note*",
    "Interesting.",
    "*maintains eye contact*",
    "Go on.",
    "And then?",
    "*leans back thoughtfully*",
  ],
}

const ARCHETYPE_FOLLOW_UPS: Record<string, string[]> = {
  skeptic: [
    "Following up on that — ",
    "I want to push back a bit — ",
    "Let's stress-test that answer. ",
    "Playing devil's advocate here — ",
  ],
  friendly_champion: [
    "Building on that — ",
    "That reminds me, I'd love to hear — ",
    "On a related note — ",
    "That's great context. Now, ",
  ],
  technical_griller: [
    "Drilling deeper — ",
    "On the technical side — ",
    "Let's get into the specifics. ",
    "From an engineering perspective — ",
  ],
  distracted_senior: [
    "Switching gears — ",
    "Actually, let me ask — ",
    "Before I forget — ",
    "One more thing — ",
  ],
  culture_fit: [
    "That speaks to character. ",
    "From a team dynamics perspective — ",
    "I appreciate that perspective. ",
    "That's helpful for understanding fit. ",
  ],
  silent_observer: [
    "",
    "One question. ",
    "I'd like to understand — ",
    "",
  ],
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateResponse(
  archetype: string,
  messageText: string,
  exchangeCount: number
): string {
  const responses = ARCHETYPE_RESPONSES[archetype] || ARCHETYPE_RESPONSES.friendly_champion
  const followUps = ARCHETYPE_FOLLOW_UPS[archetype] || ARCHETYPE_FOLLOW_UPS.friendly_champion

  let response = randomFrom(responses)

  // Add follow-up prefix for later exchanges to create conversational flow
  if (exchangeCount > 2 && Math.random() > 0.5) {
    response = randomFrom(followUps) + response.charAt(0).toLowerCase() + response.slice(1)
  }

  // For short candidate answers, skeptic and technical_griller push for more detail
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
    const responseText = generateResponse(
      respondingCharacter.archetype,
      messageText,
      exchangeCount
    )

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
