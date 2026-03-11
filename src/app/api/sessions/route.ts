import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pickPersonaForArchetype, type InterviewArchetype } from '@/lib/interviewerPersonas'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
  avatarKey: string
}

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

function generateCharacterId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function generateTitle(archetype: string, companyName: string): string {
  const templates = TITLE_TEMPLATES[archetype] || TITLE_TEMPLATES.friendly_champion
  const baseTitle = randomFrom(templates)
  return `${baseTitle} at ${companyName}`
}

function silenceDurationForArchetype(archetype: string): number {
  switch (archetype) {
    case 'skeptic': return 3000
    case 'friendly_champion': return 1500
    case 'technical_griller': return 2500
    case 'distracted_senior': return 4000
    case 'culture_fit': return 2000
    case 'silent_observer': return 5000
    default: return 2000
  }
}

function generatePanel(stage: string, companyName: string): Character[] {
  const usedPersonaIds = new Set<string>()
  const characters: Character[] = []

  const createChar = (archetype: InterviewArchetype): Character => {
    const seed = `${companyName}:${stage}:${characters.length}`
    const persona = pickPersonaForArchetype(archetype, usedPersonaIds, seed)
    return {
      id: generateCharacterId(),
      name: persona.name,
      title: generateTitle(archetype, companyName),
      archetype,
      silenceDuration: silenceDurationForArchetype(archetype),
      avatarKey: `${persona.portraitGender}-${persona.portraitIndex}`,
    }
  }

  switch (stage) {
    case 'Phone Screen':
      characters.push(createChar('friendly_champion'))
      break

    case 'First Round':
      characters.push(createChar('friendly_champion'))
      if (Math.random() > 0.4) {
        characters.push(createChar('technical_griller'))
      }
      break

    case 'Panel Interview':
      characters.push(createChar('friendly_champion'))
      characters.push(createChar('technical_griller'))
      characters.push(createChar('culture_fit'))
      break

    case 'Final Round':
      characters.push(createChar('skeptic'))
      characters.push(createChar('friendly_champion'))
      if (Math.random() > 0.3) {
        characters.push(createChar('distracted_senior'))
      }
      break

    case 'Case Interview':
      characters.push(createChar('technical_griller'))
      characters.push(createChar('skeptic'))
      break

    case 'Stress Interview':
      characters.push(createChar('skeptic'))
      characters.push(createChar('technical_griller'))
      break

    default:
      characters.push(createChar('friendly_champion'))
      break
  }

  return characters
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

    return NextResponse.json(sessions)
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

    const characters = generatePanel(stage, application.companyName)

    const interviewSession = await prisma.interviewSession.create({
      data: {
        userId,
        applicationId,
        stage,
        intensity: intensity || 'standard',
        durationMinutes: durationMinutes || 45,
        status: 'pending',
        characters: JSON.stringify(characters),
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
        characters: JSON.parse(interviewSession.characters || '[]'),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
