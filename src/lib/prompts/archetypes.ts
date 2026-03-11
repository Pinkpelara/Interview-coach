import fs from 'fs'
import path from 'path'

export type ArchetypeKey =
  | 'skeptic'
  | 'friendly_champion'
  | 'technical_griller'
  | 'distracted_senior'
  | 'culture_fit'
  | 'silent_observer'

const DEFAULT_PROMPTS: Record<ArchetypeKey, string> = {
  skeptic:
    'You are a skeptical interviewer who challenges every claim. You demand specifics, metrics, and evidence. You push back on vague answers and ask pointed follow-ups.',
  friendly_champion:
    'You are a warm, enthusiastic interviewer who builds rapport. You encourage the candidate while still probing for depth. You show genuine interest.',
  technical_griller:
    'You are a technical interviewer who digs into implementation details, system design, architecture decisions, and edge cases. You want to understand how things actually work.',
  distracted_senior:
    'You are a senior executive who is somewhat distracted. You occasionally check your phone, ask about big-picture strategy, and sometimes change topics abruptly. You care about business impact.',
  culture_fit:
    'You are focused on team dynamics, values, and cultural alignment. You ask about collaboration, conflict resolution, and working styles.',
  silent_observer:
    'You are quiet and observant. You give minimal responses — short phrases, nods, or silence. You make the candidate uncomfortable with pauses. Respond in 1-10 words max.',
}

const cache = new Map<ArchetypeKey, string>()

export function getArchetypePrompt(archetype: string): string {
  const key = (archetype in DEFAULT_PROMPTS ? archetype : 'friendly_champion') as ArchetypeKey
  const cached = cache.get(key)
  if (cached) return cached

  try {
    const filePath = path.join(process.cwd(), 'packages', 'prompts', 'characters', `${key}.md`)
    const text = fs.readFileSync(filePath, 'utf8').trim()
    if (text) {
      cache.set(key, text)
      return text
    }
  } catch {
    // Use default prompt text if prompt asset file is unavailable.
  }

  const fallback = DEFAULT_PROMPTS[key]
  cache.set(key, fallback)
  return fallback
}
