import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

function generatePerfectExchanges() {
  return [
    {
      id: 'p-1',
      speaker: 'interviewer',
      text: 'Tell me about a time you led a project that had significant technical challenges.',
    },
    {
      id: 'p-2',
      speaker: 'candidate',
      text: 'Absolutely. Last year, I led the migration of our payment processing system from a monolithic architecture to microservices. The core challenge was maintaining zero downtime during the transition while processing over 50,000 daily transactions. I broke the project into three phases: first, I built a parallel pipeline to shadow-test new services against production. Second, I coordinated with the QA and DevOps teams to establish canary deployments. Third, I implemented feature flags for gradual traffic shifting. We completed the migration in 8 weeks — two weeks ahead of schedule — with zero payment failures and a 40% improvement in p99 latency.',
      annotation: {
        type: 'perfect' as const,
        note: 'Textbook STAR response. Specific metrics (50K transactions, 8 weeks, 40% improvement). Clear structure with numbered phases. Shows leadership, technical depth, and cross-functional coordination.',
      },
    },
    {
      id: 'p-3',
      speaker: 'interviewer',
      text: 'That sounds impressive. How did you handle pushback from team members who were resistant to the migration?',
    },
    {
      id: 'p-4',
      speaker: 'candidate',
      text: 'Great question. Two senior engineers were initially skeptical — they had valid concerns about added complexity and operational overhead. Rather than dismissing their worries, I set up a dedicated session where they could stress-test the new architecture. I also paired them with engineers who had experience with microservices at scale. Within two weeks, one of the skeptics became the project\'s biggest advocate and actually proposed an improvement to our service mesh configuration that we adopted. The key was creating space for genuine dialogue rather than forcing alignment.',
      annotation: {
        type: 'perfect' as const,
        note: 'Demonstrates emotional intelligence and conflict resolution. Specific example of converting a skeptic. Shows humility by crediting the team member\'s contribution. Avoids the trap of portraying resistance as purely negative.',
      },
    },
    {
      id: 'p-5',
      speaker: 'interviewer',
      text: 'What is your biggest weakness?',
    },
    {
      id: 'p-6',
      speaker: 'candidate',
      text: 'I tend to over-invest in getting alignment before moving forward, which can slow down decision-making in fast-paced environments. I recognized this pattern about a year ago when a product launch was delayed because I was seeking consensus from too many stakeholders. Since then, I have adopted a "disagree and commit" framework — I set clear decision deadlines, gather input from key stakeholders within that window, and then move forward decisively. My manager noted in my last review that my decision velocity improved significantly while maintaining team buy-in.',
      annotation: {
        type: 'perfect' as const,
        note: 'Genuine vulnerability without self-sabotage. Shows self-awareness with a specific example. Demonstrates active improvement with a concrete framework. Third-party validation from the manager review adds credibility.',
      },
    },
    {
      id: 'p-7',
      speaker: 'interviewer',
      text: 'Why are you interested in this role specifically?',
    },
    {
      id: 'p-8',
      speaker: 'candidate',
      text: 'Three things stood out when I read the job description. First, the emphasis on "engineering velocity as a product feature" resonates with my experience optimizing developer workflows. Second, I am drawn to the scale challenge — serving millions of users requires the kind of distributed systems thinking I have been building toward. Third, your recent blog post about your testing culture — specifically the investment in contract testing — tells me this is a team that takes quality seriously without letting it slow them down. That balance is exactly the environment where I do my best work.',
      annotation: {
        type: 'perfect' as const,
        note: 'Mirrors specific language from the JD ("engineering velocity as a product feature"). References company content showing genuine research. Connects personal strengths to company values. Three clear, distinct reasons show structured thinking.',
      },
    },
  ]
}

function generateCautionaryExchanges() {
  return [
    {
      id: 'c-1',
      speaker: 'interviewer',
      text: 'Tell me about a time you led a project that had significant technical challenges.',
    },
    {
      id: 'c-2',
      speaker: 'candidate',
      text: 'Um, yeah, so we had this project at my last company where we needed to, like, update our systems. It was pretty challenging because the codebase was really old. I worked on it with my team and we eventually got it done. It took a while but, you know, we figured it out. The stakeholders were happy in the end I think.',
      annotation: {
        type: 'cautionary' as const,
        note: 'Pattern: Vague Claim. No specific metrics, timeline, or technical details. Filler words ("um", "like", "you know") signal low confidence. "I think" at the end undermines the entire response. No mention of the candidate\'s specific role or contributions.',
        pattern: 'Vague Claim',
      },
    },
    {
      id: 'c-3',
      speaker: 'interviewer',
      text: 'Can you be more specific about the technical challenges?',
    },
    {
      id: 'c-4',
      speaker: 'candidate',
      text: 'Oh sure, sorry. So the main challenge was... well, there were a lot of challenges actually. The database was slow and we had some API issues. I guess the biggest thing was just getting everything to work together. We had meetings about it and eventually came up with a plan. I think we used some new tools. It was a team effort really.',
      annotation: {
        type: 'cautionary' as const,
        note: 'Pattern: Retreat Under Pressure. When pressed for details, the candidate deflects with vague generalities. "I guess" and "I think" show uncertainty about their own work. Attributing everything to "team effort" without specifying individual contribution is a red flag.',
        pattern: 'Retreat Under Pressure',
      },
    },
    {
      id: 'c-5',
      speaker: 'interviewer',
      text: 'What is your biggest weakness?',
    },
    {
      id: 'c-6',
      speaker: 'candidate',
      text: 'Honestly, I would say I work too hard. I just care so much about the quality of my work that sometimes I put in extra hours. My colleagues always tell me I need to take more breaks but I am just really passionate about what I do.',
      annotation: {
        type: 'cautionary' as const,
        note: 'Pattern: Silence-Filling. Classic non-answer that interviewers see through immediately. Disguising a "strength" as a weakness signals low self-awareness or unwillingness to be vulnerable. No evidence of actual growth or self-improvement.',
        pattern: 'Silence-Filling',
      },
    },
    {
      id: 'c-7',
      speaker: 'interviewer',
      text: 'Why are you interested in this role specifically?',
    },
    {
      id: 'c-8',
      speaker: 'candidate',
      text: 'Well, I have heard great things about the company and I think it would be a good fit for me. I am looking for a new challenge and this seems like an interesting opportunity. The role aligns with my skills and experience, and I think I could contribute a lot to the team. Also the benefits look really good.',
      annotation: {
        type: 'cautionary' as const,
        note: 'Pattern: Vague Claim. Zero company-specific language or research. "I have heard great things" is generic. Mentioning benefits as a motivator is a significant red flag. No connection to company mission, values, or specific aspects of the role.',
        pattern: 'Vague Claim',
      },
    },
  ]
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const limiter = checkRateLimit(`observe:get:${userId}`, 60, 60_000)
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
      id: os.id,
      sourceSessionId: os.sourceSessionId,
      type: os.type,
      exchanges: JSON.parse(os.exchanges as string),
      annotations: JSON.parse(os.annotations as string),
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
    const limiter = checkRateLimit(`observe:create:${userId}`, 30, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many observe generation requests. Please retry shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }
    const body = await request.json()
    const { sourceSessionId, type } = body

    if (!sourceSessionId || !type) {
      return NextResponse.json(
        { error: 'sourceSessionId and type are required' },
        { status: 400 }
      )
    }

    if (type !== 'perfect' && type !== 'cautionary') {
      return NextResponse.json(
        { error: 'type must be "perfect" or "cautionary"' },
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

    // Generate mock exchanges and annotations
    const exchanges =
      type === 'perfect' ? generatePerfectExchanges() : generateCautionaryExchanges()

    const annotations = exchanges
      .filter((e) => e.annotation)
      .map((e) => ({
        exchangeId: e.id,
        type: e.annotation!.type,
        note: e.annotation!.note,
        pattern: 'pattern' in e.annotation! ? (e.annotation as { pattern: string }).pattern : undefined,
      }))

    // Save to ObserveSession
    const observeSession = await prisma.observeSession.create({
      data: {
        sourceSessionId,
        type,
        exchanges: JSON.stringify(exchanges),
        annotations: JSON.stringify(annotations),
      },
    })

    return NextResponse.json({
      id: observeSession.id,
      sourceSessionId,
      type,
      exchanges,
      annotations,
    })
  } catch (error) {
    console.error('Observe API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
