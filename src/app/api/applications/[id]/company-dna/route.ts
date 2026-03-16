import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectivePlan } from '@/lib/subscription'
import { checkFeature } from '@/lib/feature-gate'
import { chatCompletionJSONValidated, isAIServiceConfigured } from '@/lib/ai'
import { CompanyDNASchema } from '@/lib/ai/validation'
import { companyDnaSystemPrompt } from '@/lib/ai/prompts'

function safeParseJSON(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function deterministicCompanyDNA(args: {
  companyName: string
  jobTitle: string
  jdText: string
  valuesLanguage: string[]
  requiredSkills: string[]
  responsibilities: string[]
  strengths: string[]
  gaps: string[]
}) {
  const valueSignals = args.valuesLanguage.length
    ? args.valuesLanguage
    : ['ownership', 'collaboration', 'execution', 'customer focus']
  const topResp = args.responsibilities.slice(0, 3)
  const topSkills = args.requiredSkills.slice(0, 6)

  return {
    cultureFingerprint: [
      `Role demands high ownership in ${args.jobTitle} scope.`,
      `Team likely values measurable outcomes and delivery reliability.`,
      `Cross-functional communication appears central to success.`,
      `Decision quality and prioritization are likely evaluated early.`,
      `Interviewers will likely test adaptability under ambiguous prompts.`,
    ],
    communicationStyle:
      'Direct, concise, evidence-backed language. Lead with your action and close with measurable outcomes.',
    decisionStyle:
      'Structured and tradeoff-aware. Interviewers likely reward clear rationale over broad generalizations.',
    riskTolerance:
      'Moderate-to-high: candidates are expected to own decisions and explain mitigation plans.',
    interviewTempo:
      'Brisk with follow-ups on vague answers. Expect probes on ownership, prioritization, and impact.',
    panelDynamics: [
      'Hiring manager likely anchors role-fit and execution depth.',
      'Functional interviewer will test process detail and edge-case thinking.',
      'Culture interviewer will probe conflict handling and values alignment language.',
    ],
    valuesLanguageToMirror: valueSignals.slice(0, 12),
    redFlagTriggers: [
      'Overuse of team-only language without clarifying your personal contribution.',
      'Claims without metrics, outcomes, or timeline specifics.',
      'Negative framing about current/previous team or leadership.',
      ...(args.gaps.length ? [`Unaddressed gap area: ${args.gaps[0]}`] : []),
    ].slice(0, 8),
    proofPointsToEmphasize: [
      ...(args.strengths.slice(0, 4).map((s) => `Demonstrate ${s} with one quantified example.`)),
      ...(topSkills.slice(0, 4).map((s) => `Map your real project outcomes directly to ${s}.`)),
    ].slice(0, 10),
    candidateQuestionsToAsk: [
      `For ${args.jobTitle}, what separates a strong first 90 days from an average one at ${args.companyName}?`,
      `How does the team balance speed vs. quality when priorities conflict?`,
      `What are the most common failure modes for this role, and how are they usually prevented?`,
      `How is cross-functional alignment measured when projects span multiple teams?`,
      ...(topResp[0] ? [`What does excellence look like for "${topResp[0]}" in this team?`] : []),
    ].slice(0, 8),
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
    const plan = await getEffectivePlan(userId)
    const gate = checkFeature(plan, 'company_dna')
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, requiredPlan: gate.requiredPlan }, { status: 403 })
    }

    const application = await prisma.application.findFirst({
      where: { id: params.id, userId },
      include: {
        parsedJD: true,
      },
    })
    if (!application) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }

    const valuesLanguage = safeParseJSON(application.parsedJD?.valuesLanguage)
    const requiredSkills = safeParseJSON(application.parsedJD?.requiredSkills)
    const responsibilities = safeParseJSON(application.parsedJD?.responsibilities)
    const strengths = safeParseJSON(application.strengths)
    const gaps = safeParseJSON(application.skillGaps)

    const fallback = deterministicCompanyDNA({
      companyName: application.companyName,
      jobTitle: application.jobTitle,
      jdText: application.jdText,
      valuesLanguage,
      requiredSkills,
      responsibilities,
      strengths,
      gaps,
    })

    let companyDna = fallback
    if (isAIServiceConfigured()) {
      try {
        companyDna = await chatCompletionJSONValidated(
          companyDnaSystemPrompt,
          `Company: ${application.companyName}
Role: ${application.jobTitle}

Job Description:
${application.jdText.slice(0, 6000)}

Extracted values language: ${valuesLanguage.join(', ') || 'none'}
Required skills: ${requiredSkills.join(', ') || 'none'}
Responsibilities: ${responsibilities.join(', ') || 'none'}
Strengths to emphasize: ${strengths.join(', ') || 'none'}
Skill gaps/probe areas: ${gaps.join(', ') || 'none'}

Return JSON with:
- cultureFingerprint (4-10 bullets)
- communicationStyle
- decisionStyle
- riskTolerance
- interviewTempo
- panelDynamics (3-8 bullets)
- valuesLanguageToMirror (4-15 terms)
- redFlagTriggers (3-10 bullets)
- proofPointsToEmphasize (4-12 bullets)
- candidateQuestionsToAsk (4-10 questions)
`,
          CompanyDNASchema,
          { temperature: 0.4, maxTokens: 900 }
        )
      } catch (error) {
        console.error('Company DNA AI generation failed, using deterministic fallback:', error)
      }
    }

    return NextResponse.json({
      application: {
        id: application.id,
        companyName: application.companyName,
        jobTitle: application.jobTitle,
      },
      companyDna,
    })
  } catch (error) {
    console.error('Company DNA API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
