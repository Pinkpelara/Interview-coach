import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletionJSONValidated, isAIServiceConfigured } from '@/lib/ai'
import { QuestionTemplateArraySchema } from '@/lib/ai/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { questionGenerationSystemPrompt } from '@/lib/ai/prompts'

interface QuestionTemplate {
  questionText: string
  questionType: string
  competencyDomain?: string
  whyAsked: string
  framework: string
  modelAnswer: string
  whatNotToSay: string
  timeGuidance: number
  difficulty: number
  likelyFollowUps: string[]
  bestAskedByArchetype: string
  bestStage: string
}

const V6_CATEGORY_COUNTS: Array<{ type: string; count: number }> = [
  { type: 'opening', count: 8 },
  { type: 'behavioral', count: 40 },
  { type: 'situational', count: 18 },
  { type: 'technical', count: 20 },
  { type: 'company-specific', count: 10 },
  { type: 'culture-fit', count: 8 },
  { type: 'motivation', count: 8 },
  { type: 'curveball', count: 6 },
  { type: 'closing-candidate', count: 8 },
  { type: 'salary-negotiation', count: 6 },
]

const V6_TOTAL_QUESTIONS = V6_CATEGORY_COUNTS.reduce((sum, item) => sum + item.count, 0)

function extractResumeClues(resumeText: string): { companyHint: string; metricHint: string } {
  const companyMatch = resumeText.match(/\b(?:at|with)\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/i)
  const numericMatch = resumeText.match(/\b(\d{1,3}%|\$\d[\d,]*|\d+\s*(?:months|years|weeks|days))\b/i)
  return {
    companyHint: companyMatch?.[1]?.trim() || 'my most recent company',
    metricHint: numericMatch?.[1] || '22%',
  }
}

function frameworkForType(type: string): string {
  switch (type) {
    case 'behavioral':
      return 'STAR'
    case 'situational':
      return 'SOAR'
    case 'company-specific':
    case 'motivation':
    case 'salary-negotiation':
      return 'PREP'
    case 'culture-fit':
      return 'PAR'
    default:
      return 'direct'
  }
}

function timeGuidanceForType(type: string): number {
  if (type === 'behavioral') return 120
  if (type === 'technical') return 110
  if (type === 'situational') return 100
  return 90
}

function bestArchetypeForType(type: string): string {
  switch (type) {
    case 'opening':
    case 'closing-candidate':
      return 'friendly_champion'
    case 'behavioral':
    case 'situational':
      return Math.random() > 0.5 ? 'skeptic' : 'friendly_champion'
    case 'technical':
      return Math.random() > 0.35 ? 'technical_griller' : 'skeptic'
    case 'company-specific':
    case 'culture-fit':
    case 'motivation':
      return Math.random() > 0.5 ? 'culture_fit' : 'friendly_champion'
    case 'curveball':
      return Math.random() > 0.5 ? 'skeptic' : 'technical_griller'
    case 'salary-negotiation':
      return 'friendly_champion'
    default:
      return 'friendly_champion'
  }
}

function bestStageForType(type: string): string {
  switch (type) {
    case 'opening':
      return 'phone_screen'
    case 'behavioral':
      return 'first_round'
    case 'situational':
    case 'technical':
      return 'panel'
    case 'company-specific':
    case 'culture-fit':
    case 'closing-candidate':
    case 'salary-negotiation':
      return 'final_round'
    case 'curveball':
      return 'stress'
    default:
      return 'first_round'
  }
}

function difficultyForType(type: string, indexWithinType: number): number {
  if (type === 'curveball') return Math.min(5, 3 + Math.floor(indexWithinType / 2))
  if (type === 'technical') return Math.min(5, 2 + Math.floor(indexWithinType / 6))
  if (type === 'salary-negotiation') return Math.min(5, 2 + Math.floor(indexWithinType / 3))
  return Math.min(5, 1 + Math.floor(indexWithinType / 6))
}

function buildModelAnswer(
  companyName: string,
  jobTitle: string,
  companyHint: string,
  metricHint: string
): string {
  return `In my most recent role at ${companyHint}, I built the habits and execution discipline that map directly to the ${jobTitle} position at ${companyName}. I start by clarifying the business objective, constraints, and decision criteria so everyone is solving the same problem. Then I break work into milestones with clear ownership, measurable targets, and explicit risk plans. This structure helps me move quickly without sacrificing quality, and it keeps cross-functional stakeholders aligned because expectations are transparent from the beginning.

In one representative example, I led a high-visibility initiative that had shifting requirements and multiple teams involved. I re-scoped deliverables with leadership, documented tradeoffs, and set up a concise weekly risk review to surface blockers early. I personally owned the highest-risk dependencies and made sure the plan reflected both technical realities and business deadlines. During execution, I communicated progress in plain language, escalated decisions quickly, and coached teammates through handoff friction so momentum stayed high. We launched successfully and delivered a measurable improvement of ${metricHint}, while reducing rework and strengthening trust across teams.

What I would bring to ${companyName} is this same pattern of structured thinking, direct ownership, and measurable outcomes. I do not rely on vague claims; I focus on evidence, clear decision-making, and consistent delivery under pressure.`
}

function buildFallbackQuestionText(
  type: string,
  companyName: string,
  jobTitle: string,
  companyHint: string,
  idx: number
): string {
  const n = idx + 1
  const map: Record<string, string> = {
    opening: `Give me your 90-second narrative connecting your background at ${companyHint} to the ${jobTitle} role at ${companyName}.`,
    behavioral: `Tell me about a specific time at ${companyHint} when you demonstrated ${n % 2 === 0 ? 'leadership under ambiguity' : 'cross-functional influence'} relevant to ${jobTitle} at ${companyName}.`,
    situational: `How would you handle a scenario at ${companyName} where, as ${jobTitle}, you receive conflicting priorities from two leaders and still need to deliver on time?`,
    technical: `Walk me through how you would execute a core ${jobTitle} responsibility at ${companyName}, including tradeoffs, failure handling, and measurable success criteria.`,
    'company-specific': `Why ${companyName} specifically, and how does your experience at ${companyHint} map to our expected outcomes for ${jobTitle}?`,
    'culture-fit': `Describe a time you adapted your communication style with teammates very different from you at ${companyHint}, and explain how that would help you succeed in ${companyName}'s culture.`,
    motivation: `Why is this ${jobTitle} role at ${companyName} the right next move for you now, and what would success in your first six months look like?`,
    curveball: `What is one reason ${companyName} should hesitate to hire you for ${jobTitle}, and how are you actively addressing it with concrete evidence?`,
    'closing-candidate': `If you could ask one high-impact closing question to the ${companyName} panel for this ${jobTitle} interview, what would it be and why?`,
    'salary-negotiation': `How would you answer salary expectation questions for ${jobTitle} at ${companyName} while protecting your leverage and keeping the conversation collaborative?`,
  }
  return map[type] || `Question ${n} for ${jobTitle} at ${companyName}.`
}

async function generateQuestionsWithAI(
  companyName: string,
  jobTitle: string,
  resumeText: string,
  jdText: string
): Promise<QuestionTemplate[]> {
  const userPrompt = `Generate exactly ${V6_TOTAL_QUESTIONS} interview questions for a candidate applying to "${jobTitle}" at "${companyName}".

Resume excerpt: ${resumeText.slice(0, 2000)}
Job description excerpt: ${jdText.slice(0, 2000)}

Use this exact distribution:
- opening: 8
- behavioral: 40
- situational: 18
- technical: 20
- company-specific: 10
- culture-fit: 8
- motivation: 8
- curveball: 6
- closing-candidate: 8
- salary-negotiation: 6

Return JSON array items with:
- questionText
- questionType
- competencyDomain (required for behavioral)
- whyAsked
- framework (STAR|SOAR|CAR|PREP|PAR|direct)
- modelAnswer (minimum 200 words, first person, with measurable outcomes)
- whatNotToSay
- timeGuidance
- difficulty (1-5)
- likelyFollowUps (2-3 strings)
- bestAskedByArchetype (skeptic|friendly_champion|technical_griller|distracted_senior|culture_fit|silent_observer)
- bestStage (phone_screen|first_round|panel|final_round|case|stress)

All questions must be personalized to this application.`

  return chatCompletionJSONValidated<QuestionTemplate[]>(
    questionGenerationSystemPrompt,
    userPrompt,
    QuestionTemplateArraySchema,
    { temperature: 0.7, maxTokens: 12000 }
  )
}

function generateQuestionsFallback(
  companyName: string,
  jobTitle: string,
  resumeText: string
): QuestionTemplate[] {
  const { companyHint, metricHint } = extractResumeClues(resumeText)
  const behavioralDomains = [
    'leadership',
    'conflict_resolution',
    'problem_solving',
    'teamwork',
    'communication',
    'time_management',
    'adaptability',
    'resilience',
    'ownership',
    'stakeholder_focus',
  ]

  const result: QuestionTemplate[] = []
  for (const category of V6_CATEGORY_COUNTS) {
    for (let i = 0; i < category.count; i++) {
      result.push({
        questionText: buildFallbackQuestionText(category.type, companyName, jobTitle, companyHint, i),
        questionType: category.type,
        competencyDomain: category.type === 'behavioral' ? behavioralDomains[i % behavioralDomains.length] : undefined,
        whyAsked: `Interviewers for ${jobTitle} at ${companyName} use this question to test role-relevant judgment, specificity, and evidence quality.`,
        framework: frameworkForType(category.type),
        modelAnswer: buildModelAnswer(companyName, jobTitle, companyHint, metricHint),
        whatNotToSay:
          'Avoid vague statements, hedging language, and team-only wording without clarifying your specific role, actions, and measurable outcomes.',
        timeGuidance: timeGuidanceForType(category.type),
        difficulty: difficultyForType(category.type, i),
        likelyFollowUps: [
          'Can you be specific about your personal contribution in that example?',
          'What was the measurable result, and how did you verify it?',
          `If you had to do it again at ${companyName}, what would you change?`,
        ],
        bestAskedByArchetype: bestArchetypeForType(category.type),
        bestStage: bestStageForType(category.type),
      })
    }
  }
  return result
}

function normalizeFollowUps(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return raw.split('||').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('applicationId')
    const type = searchParams.get('type')
    const difficulty = searchParams.get('difficulty')
    const competency = searchParams.get('competency')

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    const application = await prisma.application.findFirst({ where: { id: applicationId, userId } })
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

    const where: Record<string, unknown> = { applicationId }
    if (type && type !== 'all') where.questionType = type
    if (difficulty) {
      const parsed = Number.parseInt(difficulty, 10)
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) where.difficulty = parsed
    }
    if (competency) {
      where.whyAsked = { contains: `[competency:${competency.toLowerCase()}]`, mode: 'insensitive' }
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        userAnswers: { where: { userId }, orderBy: { updatedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      questions.map((q) => ({
        ...q,
        likelyFollowUps: normalizeFollowUps(q.likelyFollowUp),
      }))
    )
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const limiter = await checkRateLimit(`questions:generate:${userId}`, 8, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many generation attempts. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }

    const { applicationId } = await request.json()
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: { parsedResume: true, parsedJD: true },
    })
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

    const existingCount = await prisma.question.count({ where: { applicationId } })
    if (existingCount > 0 && existingCount < 100) {
      await prisma.question.deleteMany({ where: { applicationId } })
    } else if (existingCount >= 100) {
      return NextResponse.json(
        { error: 'Comprehensive v6 question bank already generated for this application.' },
        { status: 409 }
      )
    }

    let templates: QuestionTemplate[]
    if (isAIServiceConfigured()) {
      try {
        templates = await generateQuestionsWithAI(
          application.companyName,
          application.jobTitle,
          application.resumeText,
          application.jdText
        )
      } catch (aiError) {
        console.error('AI question generation failed, using fallback:', aiError)
        templates = generateQuestionsFallback(application.companyName, application.jobTitle, application.resumeText)
      }
    } else {
      templates = generateQuestionsFallback(application.companyName, application.jobTitle, application.resumeText)
    }

    const createdQuestions = await prisma.$transaction(
      templates.map((q) =>
        prisma.question.create({
          data: {
            applicationId,
            questionText: q.questionText,
            questionType: q.questionType,
            whyAsked: `${q.whyAsked}${q.competencyDomain ? ` [competency:${q.competencyDomain.toLowerCase()}]` : ''}`,
            framework: q.framework,
            modelAnswer: q.modelAnswer,
            whatNotToSay: q.whatNotToSay,
            timeGuidance: q.timeGuidance,
            difficulty: q.difficulty,
            likelyFollowUp: JSON.stringify(q.likelyFollowUps),
          },
        })
      )
    )

    return NextResponse.json(
      createdQuestions.map((q) => ({
        ...q,
        likelyFollowUps: normalizeFollowUps(q.likelyFollowUp),
      })),
      { status: 201 }
    )
  } catch (error) {
    console.error('Error generating questions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
