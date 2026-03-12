import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pickPersonaForArchetype, type InterviewArchetype } from '@/lib/interviewerPersonas'
import { chatCompletionJSON, isAIConfigured } from '@/lib/ai-gateway'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Character panel generation helpers (V5 3.10)
// ---------------------------------------------------------------------------

const AVATAR_COLORS = ['#4F46E5', '#DC2626', '#059669', '#D97706', '#7C3AED', '#DB2777']
const VOICE_IDS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

const TITLE_TEMPLATES: Record<string, string[]> = {
  skeptic: ['VP of Engineering', 'Director of Product', 'Senior Engineering Manager', 'CTO'],
  friendly_champion: ['Engineering Manager', 'Team Lead', 'Senior Developer', 'Hiring Manager'],
  technical_griller: ['Staff Engineer', 'Principal Engineer', 'Lead Architect', 'Senior SWE'],
  distracted_senior: ['SVP of Operations', 'Chief of Staff', 'Senior Director', 'Managing Director'],
  culture_fit: ['People & Culture Lead', 'HR Business Partner', 'Head of Talent', 'DEI Director'],
  silent_observer: ['Board Member', 'Executive Advisor', 'Co-Founder', 'General Manager'],
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateCharacterPanel(
  stage: string,
  companyName: string,
  intensity?: string
): Array<{
  id: string
  name: string
  title: string
  avatarColor: string
  initials: string
  voiceId: string
  archetype: string
}> {
  const usedIds = new Set<string>()
  const characters: Array<{
    id: string
    name: string
    title: string
    avatarColor: string
    initials: string
    voiceId: string
    archetype: string
  }> = []

  const createChar = (archetype: InterviewArchetype, idx: number) => {
    const seed = `${companyName}:${stage}:${idx}`
    const persona = pickPersonaForArchetype(archetype, usedIds, seed)
    const titles = TITLE_TEMPLATES[archetype] || TITLE_TEMPLATES.friendly_champion
    const nameParts = persona.name.split(' ')
    const initials = nameParts.map(p => p[0]).join('').toUpperCase()

    return {
      id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: persona.name,
      title: `${randomFrom(titles)} at ${companyName}`,
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
      initials,
      voiceId: VOICE_IDS[idx % VOICE_IDS.length],
      archetype,
    }
  }

  const isStress = stage === 'Stress Interview' || intensity === 'high-pressure'

  switch (stage) {
    case 'Phone Screen':
      characters.push(createChar('friendly_champion', 0))
      break

    case 'First Round': {
      // behavioral -> Skeptic + Friendly Champion; technical -> Technical Griller
      characters.push(createChar('skeptic', 0))
      characters.push(createChar('friendly_champion', 1))
      break
    }

    case 'Panel Interview':
    case 'Final Round': {
      // 2-3 characters, include Silent Observer as 3rd if 3
      characters.push(createChar('skeptic', 0))
      characters.push(createChar('friendly_champion', 1))
      characters.push(createChar('silent_observer', 2))
      break
    }

    case 'Case Interview':
      characters.push(createChar('skeptic', 0))
      characters.push(createChar('technical_griller', 1))
      break

    case 'Stress Interview':
      characters.push(createChar('skeptic', 0))
      characters.push(createChar('technical_griller', 1))
      break

    default:
      characters.push(createChar('friendly_champion', 0))
      break
  }

  // For stress/high-pressure, ensure skeptic + technical griller combo
  if (isStress && stage !== 'Stress Interview') {
    // Already handled by the switch above for stress, but for intensity override
    // on other stages, we don't change the panel since the stage logic takes priority
  }

  return characters
}

// ---------------------------------------------------------------------------
// Question plan generation
// ---------------------------------------------------------------------------

interface QuestionPlanItem {
  questionText: string
  questionType: string
  priority: number
}

const STAGE_QUESTION_COUNTS: Record<string, number> = {
  'Phone Screen': 5,
  'First Round': 7,
  'Panel Interview': 8,
  'Final Round': 8,
  'Case Interview': 6,
  'Stress Interview': 6,
}

const DEFAULT_QUESTION_PLANS: Record<string, QuestionPlanItem[]> = {
  'Phone Screen': [
    { questionText: 'Tell me about yourself and why you\'re interested in this role.', questionType: 'behavioral', priority: 1 },
    { questionText: 'Walk me through your most relevant experience for this position.', questionType: 'behavioral', priority: 2 },
    { questionText: 'What do you know about our company and what interests you about working here?', questionType: 'culture', priority: 3 },
    { questionText: 'Describe a challenging project you worked on and how you handled it.', questionType: 'behavioral', priority: 4 },
    { questionText: 'Do you have any questions for me about the role or the team?', questionType: 'closing', priority: 5 },
  ],
  'First Round': [
    { questionText: 'Tell me about yourself and your background.', questionType: 'behavioral', priority: 1 },
    { questionText: 'Walk me through a technical challenge you solved recently.', questionType: 'technical', priority: 2 },
    { questionText: 'Tell me about a time you had a disagreement with a teammate and how you resolved it.', questionType: 'behavioral', priority: 3 },
    { questionText: 'How do you approach breaking down a large, ambiguous problem?', questionType: 'technical', priority: 4 },
    { questionText: 'Describe a time you had to learn something new quickly to deliver on a project.', questionType: 'behavioral', priority: 5 },
    { questionText: 'What\'s your approach to balancing code quality with delivery speed?', questionType: 'technical', priority: 6 },
    { questionText: 'Do you have any questions for us?', questionType: 'closing', priority: 7 },
  ],
  default: [
    { questionText: 'Tell me about yourself.', questionType: 'behavioral', priority: 1 },
    { questionText: 'What interests you about this role?', questionType: 'behavioral', priority: 2 },
    { questionText: 'Describe a challenging project you worked on.', questionType: 'behavioral', priority: 3 },
    { questionText: 'How do you handle working under pressure?', questionType: 'behavioral', priority: 4 },
    { questionText: 'Where do you see yourself in 5 years?', questionType: 'behavioral', priority: 5 },
    { questionText: 'Do you have any questions for us?', questionType: 'closing', priority: 6 },
  ],
}

async function generateQuestionPlan(
  companyName: string,
  jobTitle: string,
  jdText: string | null,
  stage: string,
  intensity: string,
  archetypes: string[]
): Promise<QuestionPlanItem[]> {
  // Try AI generation first
  if (isAIConfigured() && jdText) {
    try {
      const count = STAGE_QUESTION_COUNTS[stage] || 6
      const result = await chatCompletionJSON<{ questions: QuestionPlanItem[] }>(
        `You are an expert interview coach. Generate exactly ${count} interview questions for a ${stage} interview.
The questions should be ordered from opening/icebreaker to closing, mimicking a real interview flow.
The interviewer archetypes on this panel are: ${archetypes.join(', ')}.
Intensity level: ${intensity}.

Return JSON: { "questions": [{ "questionText": "...", "questionType": "behavioral|technical|situational|culture|closing", "priority": 1 }] }

Rules:
- Question 1 should always be an opening/intro question like "Tell me about yourself"
- Last question should be "Do you have any questions for us?" or similar closing
- Mix behavioral, technical, and situational questions based on the role
- For technical roles, include system design or coding approach questions
- For ${intensity === 'high-pressure' ? 'high-pressure: include harder, more probing questions' : intensity === 'warmup' ? 'warmup: keep questions conversational and approachable' : 'standard: balanced difficulty'}
- Questions should be specific to the company and role when possible`,
        `Company: ${companyName}
Job Title: ${jobTitle}
Job Description: ${jdText?.slice(0, 2000) || 'Not provided'}
Stage: ${stage}
Number of questions: ${count}`,
        { taskType: 'question_generation', temperature: 0.7, maxTokens: 1500 }
      )
      if (result.questions?.length > 0) {
        return result.questions.map((q, i) => ({
          questionText: q.questionText,
          questionType: q.questionType || 'behavioral',
          priority: i + 1,
        }))
      }
    } catch (err) {
      console.error('Failed to generate question plan with AI:', err)
    }
  }

  // Fallback to defaults
  return DEFAULT_QUESTION_PLANS[stage] || DEFAULT_QUESTION_PLANS.default
}

// ---------------------------------------------------------------------------
// Question ownership — each question assigned to a specific panelist
// ---------------------------------------------------------------------------

const QUESTION_TYPE_OWNER: Record<string, string[]> = {
  behavioral: ['skeptic', 'friendly_champion'],
  technical: ['technical_griller', 'skeptic'],
  situational: ['skeptic', 'friendly_champion'],
  company_specific: ['culture_fit', 'friendly_champion'],
  culture: ['culture_fit', 'friendly_champion'],
  curveball: ['skeptic', 'technical_griller'],
  opening: ['friendly_champion'],
  closing: ['friendly_champion'],
}

function assignQuestionOwnership(
  questionPlan: QuestionPlanItem[],
  characters: Array<{ id: string; archetype: string }>
): Array<QuestionPlanItem & { ownerId: string; ownerArchetype: string }> {
  // Silent observer never asks questions during the interview
  const activeCharacters = characters.filter(c => c.archetype !== 'silent_observer')
  if (activeCharacters.length === 0) {
    return questionPlan.map(q => ({ ...q, ownerId: characters[0]?.id || '', ownerArchetype: characters[0]?.archetype || '' }))
  }

  return questionPlan.map((q, idx) => {
    const preferredArchetypes = QUESTION_TYPE_OWNER[q.questionType] || ['friendly_champion']
    const match = activeCharacters.find(c => preferredArchetypes.includes(c.archetype))
    const owner = match || activeCharacters[idx % activeCharacters.length]

    return {
      ...q,
      ownerId: owner.id,
      ownerArchetype: owner.archetype,
    }
  })
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

const VALID_STAGES = [
  'Phone Screen',
  'First Round',
  'Panel Interview',
  'Final Round',
  'Case Interview',
  'Stress Interview',
]

const VALID_INTENSITIES = ['warmup', 'standard', 'high-pressure']

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
    const applicationId = params.id
    const body = await request.json()

    const { stage, intensity, targetDurationMin } = body

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `Stage must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      )
    }
    if (intensity && !VALID_INTENSITIES.includes(intensity)) {
      return NextResponse.json(
        { error: `Intensity must be one of: ${VALID_INTENSITIES.join(', ')}` },
        { status: 400 }
      )
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Generate character panel per V5 3.10
    const characters = generateCharacterPanel(
      stage,
      application.companyName,
      intensity
    )

    // Generate structured question plan for this interview
    const archetypes = characters.map(c => c.archetype)
    const questionPlan = await generateQuestionPlan(
      application.companyName,
      application.jobTitle,
      application.jdText,
      stage,
      intensity || 'standard',
      archetypes
    )

    // Assign each question to a specific panelist based on archetype match
    const ownedQuestionPlan = assignQuestionOwnership(questionPlan, characters)

    const interviewSession = await prisma.interviewSession.create({
      data: {
        userId,
        applicationId,
        stage,
        intensity: intensity || 'standard',
        targetDurationMin: targetDurationMin || 45,
        status: 'pending',
        characters,
        unexpectedEvents: JSON.parse(JSON.stringify({
          questionPlan: ownedQuestionPlan,
          questionState: {
            currentQuestionIndex: 0,
            followUpCount: 0,
            sessionShouldEnd: false,
          },
        })),
      },
      include: {
        application: {
          select: { companyName: true, jobTitle: true },
        },
      },
    })

    return NextResponse.json(interviewSession, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
