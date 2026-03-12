import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pickPersonaForArchetype, type InterviewArchetype } from '@/lib/interviewerPersonas'

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

    const interviewSession = await prisma.interviewSession.create({
      data: {
        userId,
        applicationId,
        stage,
        intensity: intensity || 'standard',
        targetDurationMin: targetDurationMin || 45,
        status: 'pending',
        characters,
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
