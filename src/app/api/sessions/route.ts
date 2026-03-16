import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

interface Character {
  id: string
  name: string
  firstName: string
  lastName: string
  gender: 'male' | 'female'
  title: string
  archetype: string
  silenceDuration: number
  voiceId: string
  avatarColor: string
  initials: string
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
  }
  unexpectedEvents: Array<{ type: string; trigger_time_ms: number; character_id?: string }>
}

function baseSilenceDurationForArchetype(archetype: string): number {
  switch (archetype) {
    case 'skeptic': return 3500
    case 'friendly_champion': return 1500
    case 'technical_griller': return 4500
    case 'distracted_senior': return 2000
    case 'culture_fit': return 2500
    case 'silent_observer': return 4000
    default: return 2000
  }
}

const INDUSTRY_KEYWORDS: Array<{ industry: string; terms: string[] }> = [
  { industry: 'Technology', terms: ['software', 'engineer', 'developer', 'devops', 'data science', 'cybersecurity', 'product manager', 'ux', 'qa'] },
  { industry: 'Healthcare', terms: ['nurse', 'clinical', 'medical', 'hospital', 'pharmacy', 'therapy', 'patient'] },
  { industry: 'Education', terms: ['teacher', 'professor', 'school', 'curriculum', 'academic', 'classroom'] },
  { industry: 'Finance', terms: ['accounting', 'bank', 'investment', 'audit', 'tax', 'compliance', 'fintech'] },
  { industry: 'Marketing & Communications', terms: ['marketing', 'brand', 'content', 'advertising', 'pr', 'communications'] },
  { industry: 'Government & Public Sector', terms: ['policy', 'public sector', 'civil service', 'regulatory', 'government'] },
  { industry: 'Consulting', terms: ['consultant', 'engagement', 'strategy', 'advisory'] },
  { industry: 'Retail & Hospitality', terms: ['store', 'retail', 'restaurant', 'hotel', 'hospitality', 'customer service'] },
  { industry: 'Legal', terms: ['lawyer', 'paralegal', 'legal', 'counsel', 'contract'] },
  { industry: 'Engineering (Non-Software)', terms: ['mechanical', 'electrical', 'civil', 'chemical', 'manufacturing', 'aerospace'] },
  { industry: 'Sales', terms: ['account executive', 'business development', 'sales', 'pipeline', 'quota'] },
  { industry: 'Human Resources', terms: ['hr', 'human resources', 'recruiter', 'talent acquisition', 'people partner'] },
  { industry: 'Creative & Media', terms: ['graphic design', 'video', 'journalism', 'photography', 'animation'] },
  { industry: 'Nonprofit & Social Services', terms: ['nonprofit', 'community outreach', 'grant', 'social work', 'fundraising'] },
]

const INDUSTRY_PANEL_TITLES: Record<string, { hiring: string[]; peer: string[]; hr: string[]; optional?: string[] }> = {
  Technology: {
    hiring: ['Engineering Manager', 'Tech Lead', 'VP of Engineering'],
    peer: ['Senior Engineer', 'Staff Engineer', 'Principal Engineer'],
    hr: ['People Partner', 'HR Business Partner', 'Talent Acquisition Manager'],
    optional: ['Product Manager', 'Design Lead'],
  },
  Healthcare: {
    hiring: ['Department Head', 'Nurse Manager', 'Clinical Director'],
    peer: ['Senior Nurse', 'Charge Nurse', 'Senior Clinician'],
    hr: ['HR Representative', 'People Operations'],
    optional: ['Quality/Patient Safety Officer'],
  },
  Education: {
    hiring: ['Principal', 'Vice-Principal', 'Department Chair'],
    peer: ['Grade-Level Lead', 'Fellow Teacher', 'Department Head'],
    hr: ['HR Coordinator', 'School Board Representative'],
    optional: ['Parent Committee Representative'],
  },
  Finance: {
    hiring: ['Finance Director', 'Controller', 'VP Finance'],
    peer: ['Senior Accountant', 'Senior Analyst', 'Investment Associate'],
    hr: ['HR Partner', 'Talent Acquisition'],
    optional: ['Business Unit Leader'],
  },
  'Marketing & Communications': {
    hiring: ['Marketing Director', 'VP Marketing', 'Head of Communications'],
    peer: ['Senior Marketing Manager', 'Content Lead'],
    hr: ['People Partner'],
    optional: ['Sales Leader', 'Creative Director'],
  },
  'Government & Public Sector': {
    hiring: ['Department Supervisor', 'Division Chief'],
    peer: ['Subject Matter Expert', 'Program Lead'],
    hr: ['HR Representative', 'Union Representative'],
    optional: ['Commission Member'],
  },
  Consulting: {
    hiring: ['Engagement Manager', 'Partner', 'Principal'],
    peer: ['Senior Consultant', 'Senior Associate'],
    hr: ['Talent Team', 'HR Partner'],
    optional: ['Practice Leader'],
  },
  'Retail & Hospitality': {
    hiring: ['Store Manager', 'Regional Manager', 'Restaurant Manager'],
    peer: ['Assistant Manager', 'Shift Lead'],
    hr: ['HR Representative', 'People Manager'],
    optional: ['District Manager'],
  },
  Legal: {
    hiring: ['Managing Partner', 'Senior Associate', 'General Counsel'],
    peer: ['Associate Attorney', 'Senior Paralegal'],
    hr: ['HR Manager', 'Recruiting Coordinator'],
  },
  'Engineering (Non-Software)': {
    hiring: ['Engineering Manager', 'Chief Engineer', 'Project Manager'],
    peer: ['Senior Engineer', 'Lead Engineer'],
    hr: ['HR Business Partner'],
    optional: ['Quality Manager', 'Safety Officer'],
  },
  Sales: {
    hiring: ['Sales Director', 'VP Sales', 'Regional Sales Manager'],
    peer: ['Senior Account Executive', 'Sales Team Lead'],
    hr: ['People Partner'],
    optional: ['Sales Operations Manager', 'Customer Success Lead'],
  },
  'Human Resources': {
    hiring: ['HR Director', 'VP People', 'Chief People Officer'],
    peer: ['Senior HR Manager', 'HR Business Partner'],
    hr: ['Talent Acquisition Lead'],
    optional: ['Department Leader'],
  },
  'Creative & Media': {
    hiring: ['Creative Director', 'Head of Content', 'Studio Director'],
    peer: ['Senior Designer', 'Content Producer'],
    hr: ['People Partner'],
  },
  'Nonprofit & Social Services': {
    hiring: ['Program Director', 'Executive Director', 'Operations Director'],
    peer: ['Senior Program Manager', 'Community Outreach Lead'],
    hr: ['HR Manager', 'People Operations'],
  },
  'General / Other': {
    hiring: ['Hiring Manager', 'Department Manager'],
    peer: ['Senior Team Member', 'Lead Specialist'],
    hr: ['People Partner', 'HR Coordinator'],
  },
}

const NAME_POOL = {
  femaleFirst: ['Sarah', 'Emily', 'Priya', 'Maria', 'Aisha', 'Jennifer', 'Natasha', 'Keiko', 'Fatima', 'Rachel', 'Olga', 'Sonia', 'Mei', 'Amara', 'Gabriela', 'Yuki', 'Ingrid', 'Nadia', 'Aaliyah', 'Samantha', 'Li', 'Zara', 'Elena', 'Daphne'],
  maleFirst: ['James', 'Michael', 'Raj', 'Carlos', 'Ahmed', 'David', 'Takeshi', 'Andrei', 'Kwame', 'Liam', 'Marcus', 'Vikram', 'Hassan', 'Diego', 'Wei', 'Tomas', 'Kofi', 'Pavel', 'Arjun', 'Omar', 'Benjamin', 'Yusuf', 'Mateo', 'Hiroshi', 'Ethan'],
  last: ['Chen', 'Patel', 'Rodriguez', 'Kim', 'Mueller', 'Nakamura', 'Okonkwo', 'Johansson', 'Fernandez', 'Shah', 'Thompson', 'Ivanova', 'Ali', 'Santos', 'Tanaka', 'Walsh', 'Dubois', 'Petrov', 'Nguyen', 'Williams', 'Sharma', 'Garcia', 'Sato', "O'Brien", 'Park'],
  }

const VOICES = {
  male: ['onyx', 'ash', 'echo', 'fable'],
  female: ['nova', 'shimmer', 'sage', 'alloy'],
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#16a34a', '#ef4444', '#f59e0b', '#ec4899', '#22c55e']

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateCharacterId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function classifyIndustry(jobTitle: string, jdText: string): string {
  const source = `${jobTitle} ${jdText}`.toLowerCase()
  for (const item of INDUSTRY_KEYWORDS) {
    if (item.terms.some((term) => source.includes(term.toLowerCase()))) {
      return item.industry
    }
  }
  return 'General / Other'
}

function normalizeInterviewFormat(input?: string | null): 'behavioral' | 'technical' | 'case' | 'mixed' {
  const value = (input || '').toLowerCase()
  if (value.includes('case')) return 'case'
  if (value.includes('technical')) return 'technical'
  if (value.includes('behavioral')) return 'behavioral'
  return 'mixed'
}

function selectArchetypes(stage: string, interviewFormat: 'behavioral' | 'technical' | 'case' | 'mixed'): string[] {
  if (stage === 'Phone Screen') return ['friendly_champion']
  if (stage === 'Case Interview') return ['skeptic', 'technical_griller']
  if (stage === 'Stress Interview') return ['skeptic', 'technical_griller']
  if (stage === 'First Round') {
    if (interviewFormat === 'behavioral') return ['skeptic', 'friendly_champion']
    if (interviewFormat === 'technical') return ['technical_griller']
    if (interviewFormat === 'case') return ['skeptic', 'technical_griller']
    return [Math.random() > 0.5 ? 'friendly_champion' : 'skeptic', Math.random() > 0.5 ? 'technical_griller' : 'skeptic']
  }
  if (stage === 'Panel Interview' || stage === 'Final Round') {
    const set = ['friendly_champion', Math.random() > 0.5 ? 'skeptic' : 'technical_griller']
    if (Math.random() > 0.3) set.push('silent_observer')
    return set
  }
  return ['friendly_champion']
}

function titleForArchetype(industry: string, archetype: string): string {
  const template = INDUSTRY_PANEL_TITLES[industry] || INDUSTRY_PANEL_TITLES['General / Other']
  if (archetype === 'culture_fit') return `${randomFrom(template.hr)}`
  if (archetype === 'technical_griller') return `${randomFrom(template.peer)}`
  if (archetype === 'friendly_champion') return `${randomFrom(template.hiring)}`
  if (archetype === 'skeptic') return `${randomFrom(template.hiring)}`
  if (archetype === 'distracted_senior') return `${randomFrom(template.optional || template.hiring)}`
  return `${randomFrom(template.optional || template.peer)}`
}

function generateName(used: Set<string>): { firstName: string; lastName: string; gender: 'male' | 'female'; voiceId: string } {
  for (let attempts = 0; attempts < 20; attempts++) {
    const gender: 'male' | 'female' = Math.random() > 0.5 ? 'male' : 'female'
    const firstName = gender === 'male' ? randomFrom(NAME_POOL.maleFirst) : randomFrom(NAME_POOL.femaleFirst)
    const lastName = randomFrom(NAME_POOL.last)
    const key = `${firstName} ${lastName}`
    if (used.has(key)) continue
    used.add(key)
    return {
      firstName,
      lastName,
      gender,
      voiceId: randomFrom(gender === 'male' ? VOICES.male : VOICES.female),
    }
  }
  return { firstName: 'Alex', lastName: 'Taylor', gender: 'male', voiceId: randomFrom(VOICES.male) }
}

function adjustSilenceByIntensity(ms: number, intensity: string): number {
  if (intensity === 'warmup') return Math.max(500, ms - 1000)
  if (intensity === 'high-pressure') return ms + 1000
  return ms
}

function parseQuestionType(raw: string): string {
  return (raw || '').toLowerCase()
}

function archetypesForQuestionType(questionType: string): string[] {
  const t = parseQuestionType(questionType)
  if (t === 'behavioral') return ['skeptic', 'friendly_champion']
  if (t === 'technical') return ['technical_griller', 'skeptic']
  if (t === 'situational') return ['skeptic', 'friendly_champion']
  if (t === 'company-specific') return ['culture_fit', 'friendly_champion']
  if (t === 'culture-fit') return ['culture_fit', 'friendly_champion']
  if (t === 'curveball') return ['skeptic', 'technical_griller']
  if (t === 'opening') return ['friendly_champion']
  if (t === 'closing-candidate' || t === 'salary-negotiation' || t === 'motivation') return ['friendly_champion', 'culture_fit']
  return ['friendly_champion']
}

function buildQuestionPlan(questions: Array<{ questionText: string; questionType: string; difficulty: number }>, panel: Character[], durationMinutes: number): SessionQuestion[] {
  const targetCount = durationMinutes <= 20 ? 8 : durationMinutes <= 45 ? 14 : 20
  const selected = questions.slice(0, targetCount)
  return selected.map((q, index) => {
    const preferred = archetypesForQuestionType(q.questionType)
    const owner = panel.find((c) => preferred.includes(c.archetype) && c.archetype !== 'silent_observer')
      || panel.find((c) => c.archetype !== 'silent_observer')
      || panel[0]
    return {
      question_text: q.questionText,
      question_type: q.questionType,
      priority: Math.max(1, Math.min(5, q.difficulty || 3)),
      owner_character_id: owner.id,
      owner_archetype: owner.archetype,
    }
  })
}

function buildUnexpectedEvents(stage: string, panel: Character[], durationMinutes: number): SessionConfigEnvelope['unexpectedEvents'] {
  const events: SessionConfigEnvelope['unexpectedEvents'] = []
  const durationMs = durationMinutes * 60_000
  const distracted = panel.find((c) => c.archetype === 'distracted_senior')
  if (distracted) {
    events.push({ type: 'late_join', trigger_time_ms: 120_000 + Math.floor(Math.random() * 60_000), character_id: distracted.id })
  }
  if (stage !== 'Phone Screen') {
    const nonObserver = panel.filter((c) => c.archetype !== 'silent_observer')
    if (nonObserver.length > 0) {
      events.push({ type: 'video_freeze', trigger_time_ms: Math.floor(durationMs * 0.4), character_id: randomFrom(nonObserver).id })
    }
  }
  events.push({ type: 'curveball_question', trigger_time_ms: Math.floor(durationMs * 0.65) })
  events.push({ type: 'one_more_question', trigger_time_ms: Math.floor(durationMs * 0.9) })
  events.push({ type: 'long_silence', trigger_time_ms: Math.floor(durationMs * 0.55) })
  return events
}

function buildSessionConfig(args: {
  stage: string
  intensity: string
  companyName: string
  industry: string
  interviewFormat: 'behavioral' | 'technical' | 'case' | 'mixed'
  durationMinutes: number
  questions: Array<{ questionText: string; questionType: string; difficulty: number }>
}): SessionConfigEnvelope {
  const usedNames = new Set<string>()
  const archetypes = selectArchetypes(args.stage, args.interviewFormat)
  const panel: Character[] = archetypes.map((archetype, index) => {
    const person = generateName(usedNames)
    const fullName = `${person.firstName} ${person.lastName}`
    return {
      id: generateCharacterId(),
      name: fullName,
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender,
      title: `${titleForArchetype(args.industry, archetype)}, ${args.companyName}`,
      archetype,
      silenceDuration: adjustSilenceByIntensity(baseSilenceDurationForArchetype(archetype), args.intensity),
      voiceId: person.voiceId,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      initials: `${person.firstName[0] || ''}${person.lastName[0] || ''}`.toUpperCase(),
    }
  })

  return {
    panel,
    questionPlan: buildQuestionPlan(args.questions, panel, args.durationMinutes),
    questionState: {
      currentQuestionIndex: 0,
      followUpCount: 0,
      sessionShouldEnd: false,
    },
    unexpectedEvents: buildUnexpectedEvents(args.stage, panel, args.durationMinutes),
  }
}

function parseSessionConfig(raw: string | null): SessionConfigEnvelope | null {
  if (!raw) return null
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
    if (parsed && typeof parsed === 'object') return parsed as SessionConfigEnvelope
  } catch {
    return null
  }
  return null
}

function serializeSessionConfig(config: SessionConfigEnvelope): string {
  return JSON.stringify(config)
}

const VALID_STAGES = [
  'Phone Screen',
  'First Round',
  'Panel Interview',
  'Final Round',
  'Case Interview',
  'Stress Interview',
]

const VALID_INTENSITIES = ['warmup', 'standard', 'high-pressure']

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const sessions = await prisma.interviewSession.findMany({
      where: { userId },
      include: {
        application: {
          select: { companyName: true, jobTitle: true },
        },
        _count: { select: { exchanges: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      sessions.map((s) => {
        const config = parseSessionConfig(s.characters)
        return {
          ...s,
          characters: config?.panel || [],
        }
      })
    )
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const limiter = await checkRateLimit(`sessions:create:${userId}`, 20, 60_000)
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many session requests. Please retry shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } }
      )
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboarded: true },
    })
    if (!user?.onboarded) {
      return NextResponse.json(
        { error: 'Complete onboarding before starting interview sessions.' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const { applicationId, stage, intensity, durationMinutes } = body

    if (!applicationId?.trim()) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }
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

    const industry = classifyIndustry(application.jobTitle, application.jdText)
    const parsedJd = await prisma.parsedJD.findUnique({
      where: { applicationId: application.id },
      select: { interviewFormatPrediction: true },
    })
    const interviewFormat = normalizeInterviewFormat(parsedJd?.interviewFormatPrediction)
    const availableQuestions = await prisma.question.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: 'asc' },
      select: { questionText: true, questionType: true, difficulty: true },
    })

    const sessionConfig = buildSessionConfig({
      stage,
      intensity: intensity || 'standard',
      companyName: application.companyName,
      industry,
      interviewFormat,
      durationMinutes: durationMinutes || 45,
      questions: availableQuestions,
    })

    const interviewSession = await prisma.interviewSession.create({
      data: {
        userId,
        applicationId,
        stage,
        intensity: intensity || 'standard',
        durationMinutes: durationMinutes || 45,
        status: 'pending',
        characters: serializeSessionConfig(sessionConfig),
      },
      include: {
        application: {
          select: { companyName: true, jobTitle: true },
        },
      },
    })

    return NextResponse.json(
      {
        ...interviewSession,
        characters: sessionConfig.panel,
        questionPlan: sessionConfig.questionPlan,
        questionState: sessionConfig.questionState,
        unexpectedEvents: sessionConfig.unexpectedEvents,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
