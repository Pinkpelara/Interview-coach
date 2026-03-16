import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectivePlan } from '@/lib/subscription'
import { checkFeature } from '@/lib/feature-gate'
import { chatCompletionJSONValidated, isAIServiceConfigured, z } from '@/lib/ai'

type Difficulty = 'flexible' | 'standard' | 'firm'

const TurnSchema = z.object({
  managerResponse: z.string().min(12),
  annotation: z.string().min(12),
  shouldClose: z.boolean(),
  closeReason: z.string().min(6),
  revisedOfferHint: z.string().min(1),
})

const DebriefSchema = z.object({
  whatWorked: z.string().min(12),
  toImprove: z.string().min(12),
  nextTime: z.string().min(12),
})

function fallbackOpening(difficulty: Difficulty) {
  if (difficulty === 'flexible') {
    return "We'd like to offer you the role at a $115,000 base with total compensation around $135,000. How does that align with your expectations?"
  }
  if (difficulty === 'firm') {
    return "We're excited to extend an offer at a $95,000 base and total package around $110,000. I want to be transparent that budget is tight for this level."
  }
  return "Congratulations — we'd like to extend an offer at a $105,000 base and total compensation around $125,000. What are your thoughts?"
}

function deterministicTurn(candidateMessage: string, difficulty: Difficulty, round: number) {
  const lower = candidateMessage.toLowerCase()
  const mentionsNumber = /\d/.test(candidateMessage)
  const uncertain = /\b(i think|maybe|kind of|sort of|i was hoping)\b/.test(lower)
  const accepted = /\b(accept|sounds good|works for me|deal)\b/.test(lower)

  if (accepted) {
    return {
      managerResponse: 'Great — I appreciate the thoughtful conversation. I will send the formal offer details shortly.',
      annotation: 'You closed professionally. In real negotiations, this is strongest when preceded by a clear rationale and one calibrated counter.',
      shouldClose: true,
      closeReason: 'candidate_accepted',
      revisedOfferHint: 'Accepted current package',
    }
  }

  if (difficulty === 'firm') {
    return {
      managerResponse: 'I understand your ask. We have very limited base flexibility, but I can explore non-salary components like review timing or professional development budget.',
      annotation: uncertain
        ? 'Your language softened your leverage. Use direct framing and a specific target range.'
        : 'Good composure against budget pushback. Keep anchoring to role scope and market benchmarks.',
      shouldClose: round >= 4,
      closeReason: round >= 4 ? 'budget_constrained_close' : 'continue_negotiation',
      revisedOfferHint: 'Base mostly fixed; negotiate scope of benefits',
    }
  }

  if (difficulty === 'flexible') {
    return {
      managerResponse: mentionsNumber
        ? 'That is a reasonable range. I can move on base and improve the signing component if we align on start timing.'
        : 'I am open to adjusting the package. Could you share the specific range you are targeting and your rationale?',
      annotation: mentionsNumber
        ? 'Strong move: specific range plus rationale usually drives better outcomes.'
        : 'Add concrete numbers and external benchmarks to strengthen your counter.',
      shouldClose: round >= 4,
      closeReason: round >= 4 ? 'aligned_close' : 'continue_negotiation',
      revisedOfferHint: 'Likely midpoint agreement with bonus flexibility',
    }
  }

  return {
    managerResponse: mentionsNumber
      ? 'I appreciate the specific counter. We may not match fully on base, but we can improve total compensation mix and progression timeline.'
      : 'Thanks for sharing. To evaluate this fairly, I need a concrete target range and your market rationale.',
    annotation: uncertain
      ? 'Avoid uncertainty phrasing. Use direct statements tied to market data and role impact.'
      : 'Good framing. Keep your ask concise, specific, and anchored to impact.',
    shouldClose: round >= 4,
    closeReason: round >= 4 ? 'standard_close' : 'continue_negotiation',
    revisedOfferHint: 'Partial movement likely; negotiate total comp',
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as { id: string }).id
    const plan = await getEffectivePlan(userId)
    const gate = checkFeature(plan, 'salary_negotiation')
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, requiredPlan: gate.requiredPlan }, { status: 403 })
    }

    const body = await request.json()
    const applicationId = String(body.applicationId || '')
    const difficulty = (body.difficulty || 'standard') as Difficulty
    const round = Number(body.round || 0)
    const candidateMessage = typeof body.candidateMessage === 'string' ? body.candidateMessage.trim() : ''
    const messages = Array.isArray(body.messages) ? body.messages : []

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }
    if (!['flexible', 'standard', 'firm'].includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty.' }, { status: 400 })
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        jdText: true,
        strengths: true,
      },
    })
    if (!application) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }

    if (!candidateMessage) {
      return NextResponse.json({
        managerResponse: fallbackOpening(difficulty),
        annotation: 'Open with appreciation, then anchor your ask with market data and measurable impact.',
        shouldClose: false,
        closeReason: 'opening',
        revisedOfferHint: 'Initial offer presented',
      })
    }

    let turn = deterministicTurn(candidateMessage, difficulty, round)
    if (isAIServiceConfigured()) {
      try {
        const transcript = messages
          .map((m: { speaker?: string; text?: string }) => `${m.speaker || 'unknown'}: ${m.text || ''}`)
          .join('\n')
          .slice(0, 4000)

        turn = await chatCompletionJSONValidated(
          'You are a realistic hiring manager in a salary negotiation simulation. Respond like a human manager with the selected negotiation difficulty. Output JSON only.',
          `Company: ${application.companyName}
Role: ${application.jobTitle}
Difficulty: ${difficulty}
Round: ${round}
Candidate message: ${candidateMessage}
Recent transcript:
${transcript}

Return JSON:
- managerResponse: manager's next line (1-3 sentences)
- annotation: coaching annotation for candidate language quality
- shouldClose: boolean
- closeReason: short reason
- revisedOfferHint: one short line about likely package direction

Difficulty behavior:
- flexible: willing to move if rationale is strong
- standard: partial movement, more pushback
- firm: minimal budget flexibility
`,
          TurnSchema,
          { temperature: 0.45, maxTokens: 280 }
        )
      } catch (error) {
        console.error('Salary negotiation AI turn failed, using deterministic fallback:', error)
      }
    }

    let debrief = null
    if (turn.shouldClose) {
      debrief = {
        whatWorked: 'You stayed engaged in the negotiation and maintained a professional tone.',
        toImprove: turn.annotation,
        nextTime: `Use a crisp target range, role-impact rationale, and a fallback ask for total compensation mix. (${turn.revisedOfferHint})`,
      }
      if (isAIServiceConfigured()) {
        try {
          const transcript = messages
            .map((m: { speaker?: string; text?: string }) => `${m.speaker || 'unknown'}: ${m.text || ''}`)
            .join('\n')
            .slice(0, 4000)
          debrief = await chatCompletionJSONValidated(
            'You are an interview compensation coach. Produce a concise post-negotiation debrief as JSON.',
            `Company: ${application.companyName}
Role: ${application.jobTitle}
Difficulty: ${difficulty}
Final manager response: ${turn.managerResponse}
Transcript:
${transcript}

Return JSON:
- whatWorked
- toImprove
- nextTime`,
            DebriefSchema,
            { temperature: 0.35, maxTokens: 220 }
          )
        } catch (error) {
          console.error('Salary negotiation AI debrief failed, using fallback:', error)
        }
      }
    }

    return NextResponse.json({
      ...turn,
      debrief,
    })
  } catch (error) {
    console.error('Salary negotiation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
